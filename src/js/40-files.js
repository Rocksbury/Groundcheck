// ── FILE INPUT ──
document.getElementById('fi').addEventListener('change', function(e){
  var files = Array.from(e.target.files).filter(function(f){ return /\.(xlsx|xlsm)$/i.test(f.name); });
  if (files.length) processFiles(files);
  this.value = '';
});

// ── SNAPSHOT BOOT ──
// If this file was saved via saveReport(), a gc-snapshot script tag will be present.
// Detect it and load directly without waiting for a file drop.
(function(){
  var el = document.getElementById('gc-snapshot');
  if (!el) return;
  try {
    var payload = JSON.parse(el.textContent);
    // Defer until DOM + JS are fully ready
    window.addEventListener('load', function(){ loadSnapshot(payload); });
  } catch(e) { console.warn('[GC] Failed to parse snapshot:', e); }
})();

// ── DRAG AND DROP ──
var dropOverlay = document.getElementById('drop-overlay');
var _dragDepth  = 0;
document.addEventListener('dragenter', function(e){ e.preventDefault(); _dragDepth++; if (_dragDepth===1) dropOverlay.classList.add('active'); });
document.addEventListener('dragleave', function(e){ _dragDepth--; if (_dragDepth===0) dropOverlay.classList.remove('active'); });
document.addEventListener('dragover',  function(e){ e.preventDefault(); e.dataTransfer.dropEffect='copy'; });
document.addEventListener('drop', function(e){
  e.preventDefault(); _dragDepth=0; dropOverlay.classList.remove('active');
  var files = Array.from(e.dataTransfer.files).filter(function(f){ return /\.(xlsx|xlsm)$/i.test(f.name); });
  if (files.length) processFiles(files);
});

// Guard so files dropped/selected while a batch is still parsing don't run a second
// processFiles() concurrently (which clobbers the shared badge state and can interleave
// parseWB calls). A second batch is queued and processed once the current one finishes.
var _processingFiles = false;
var _fileQueue = [];

function processFiles(files) {
  if (_processingFiles) {
    // Already parsing — stash these and pick them up when the current batch drains.
    _fileQueue.push.apply(_fileQueue, files);
    notify('Files queued. Processing will continue after the current batch.', 'info', 2000);
    return;
  }
  _processingFiles = true;
  if (files.length) notify('Processing ' + files.length + ' file(s).', 'info', 2000);

  function next(idx) {
    if (idx >= files.length) {
      // Batch done — drain any files queued while we were busy, else clear the flag.
      _processingFiles = false;
      if (_fileQueue.length) {
        var nextBatch = _fileQueue.slice();
        _fileQueue = [];
        processFiles(nextBatch);
        return;
      }
      notify('All files processed.', 'success', 2000);
      return;
    }
    var f = files[idx];
    // Show a "Parsing…" state on the relevant badge immediately so the user knows it's working
    var isEquip = /\.xlsm?$/i.test(f.name);
    var badgeId = isEquip ? 'src-equip' : /pol|ppg|non.ppg/i.test(f.name) ? 'src-liq' : null;
    if (badgeId) {
      var badge = document.getElementById(badgeId);
      if (badge) {
        badge.className = 'src-badge stale';
        badge.innerHTML = '<span class="src-dot"></span>Parsing \u2026 ' + f.name;
      }
    }
    var reader = new FileReader();
    reader.onload = function(e) {
      var buf = e.target.result;
      // Yield main thread so browser can paint the "Parsing…" badge before blocking on XLSX.read
      setTimeout(function() {
        try { var wb = XLSX.read(buf, {type:'array', cellDates:true}); parseWB(wb, f.name); }
        catch(err) {
          console.warn('Error reading '+f.name+': '+err.message);
          notify('Could not read "'+f.name+'": '+err.message, 'warn');
          updateSources();
        }
        next(idx+1);
      }, 20);
    };
    reader.readAsArrayBuffer(f);
  }
  next(0);
}

function parseWB(wb, fname) {
  var sheets = wb.SheetNames;
  var hasEquip = sheets.some(function(s){ return s === 'Critical AMSE Min Max List' || s === 'Vehicle List'; });
  var hasLiq   = sheets.some(function(s){ return /consumab|lubric|oil|liquid|fuel|non-ppg|ppg.items/i.test(s); });
  var hasTrain = sheets.some(function(s){ return /training|qualif|personnel|course/i.test(s); });
  // Real CC177 training-app export: detected by an "Authorization Code" header column.
  var hasAuthExport = sheets.some(function(s){
    var r = XLSX.utils.sheet_to_json(wb.Sheets[s], {header:1, defval:null})[0] || [];
    return r.some(function(c){ return /authorization code/i.test(String(c)); });
  });
  if (hasEquip) { parseEquipment(wb, fname); }
  else if (hasLiq)   { parseLiquids(wb, fname); }
  else if (hasAuthExport) { parseAuthExport(wb, fname); }
  else if (hasTrain) { parseTraining(wb, fname); }
  else {
    showDataWarning('Unrecognised File', [
      'Could not identify "'+fname+'" — no matching sheet found.',
      'Equipment: needs a "Critical AMSE Min Max List" or "Vehicle List" sheet.',
      'Liquids: needs a sheet named with Consumable, Lubricant, Oil, Liquid, or Fuel.',
      'Training: needs a sheet named with Training, Qualification, Personnel, or Course.',
      'ETO Auth Export: needs an "Authorization Code" column (raw training-app export).'
    ]);
    notify('Could not identify "'+fname+'" — see the data warning above.', 'warn');
  }
}

function parseEquipment(wb, fname) {
  _equipFname = fname;
  _loadTimes.serc = new Date();
  const wsA = wb.Sheets['Critical AMSE Min Max List'];
  const amse = [];
  // Build dynamic min lookup from spreadsheet (col G = index 6, row index 3+ = data)
  const dynMin = {};
  if (wsA) {
    const ra = XLSX.utils.sheet_to_json(wsA,{header:1,defval:null});
    for (let i=3; i<ra.length; i++) {
      const r = ra[i];
      const raw = r[3] ? String(r[3]) : null;
      if (raw) {
        const name = raw.replace(/\(NSN[^)]*\)/gi,'').replace(/\n/g,' ').trim().toUpperCase();
        const cond = nc(r[4]);
        if (cond) {
          var inspRaw = r[12];
          var inspDate = '';
          if (inspRaw instanceof Date) {
            inspDate = fmtDateCell(inspRaw);
          } else if (inspRaw) { inspDate = String(inspRaw).trim(); }
          amse.push({name, cond, callsign: r[1]?String(r[1]).trim():'', note: r[10]?String(r[10]).replace(/\n/g,' ').trim():'', loc: r[13]?String(r[13]).trim():'', updatedBy: r[11]?String(r[11]).trim():'', inspDate});
        }
      }
      if (!r[6] || !r[3]) continue; // skip if no min or no name
      const nm = String(r[3]).replace(/\(NSN[^)]*\)/gi,'').replace(/\n/g,' ').trim().toUpperCase();
      const minVal = Number(r[6]);
      if (!isNaN(minVal) && minVal > 0) dynMin[nm] = minVal;
    }
  }

  const wsV = wb.Sheets['Vehicle List'];
  const vehs = [];
  if (wsV) {
    const rv = XLSX.utils.sheet_to_json(wsV,{header:1,defval:null});
    for (let j=15; j<rv.length; j++) {
      const r = rv[j];
      const cond = nc(r[8]);
      if (!cond) continue;
      const vtype = r[4]?String(r[4]).toUpperCase().trim():'';
      const vmake = r[2]?String(r[2]).toUpperCase().trim():'';
      var vinspRaw = r[11];
      var vinspDate = '';
      if (vinspRaw instanceof Date) {
        vinspDate = fmtDateCell(vinspRaw);
      } else if (vinspRaw && String(vinspRaw).trim().toLowerCase() !== 'n/a') { vinspDate = String(vinspRaw).trim(); }
      vehs.push({name:(vtype+' '+vmake).trim(), cond, callsign:r[1]?String(r[1]).trim():vmake, note:r[12]?String(r[12]).replace(/\n/g,' ').trim():'', loc:r[10]?String(r[10]).trim():'', inspDate:vinspDate, updatedBy:''});
    }
  }
  const wsM = wb.Sheets['minimum amse list'];
  const mnotes = {};
  if (wsM) {
    XLSX.utils.sheet_to_json(wsM,{header:1,defval:null}).forEach(function(r){
      const n = r[6]?String(r[6]).trim().toUpperCase():null;
      const v = r[11]?String(r[11]).trim():null;
      if (n&&v) mnotes[n]=v;
    });
  }
  const wsL = wb.Sheets['GC Log'];
  if (wsL) {
    log = parseLog(XLSX.utils.sheet_to_json(wsL,{header:1,defval:null}));
    document.getElementById('tstat').textContent = log.length+' snapshot'+(log.length!==1?'s':'')+' in GC Log';
  } else {
    log = [];
    document.getElementById('tstat').textContent = 'No GC Log tab found';
  }
  // Override hardcoded mins with spreadsheet values where available
  ARULES.forEach(function(rule) {
    var best = null;
    rule.kw.forEach(function(kw) {
      Object.keys(dynMin).forEach(function(nm) {
        if (nm.indexOf(kw) >= 0) {
          if (best === null || dynMin[nm] > best) best = dynMin[nm];
        }
      });
    });
    if (best !== null) rule.min = best;
  });

  _printAmse = amse; _printVehs = vehs;
  var atgls   = parseAtgl(wb);   _atgls   = atgls;
  var pallets  = parsePallets(wb); _pallets = pallets;
  buildBoard(amse, vehs, mnotes, fname, atgls, pallets);
  updateSources();
  if (document.getElementById('page-trends').classList.contains('on')) renderTrends();
}
