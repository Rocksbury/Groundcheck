// ── SHARED HELPERS ──
// Find the first row (within the first 6) that has at least `minFilled` non-empty cells — used to skip title/blank rows above a header row.
function findHeaderRow(rows, minFilled) {
  for (var i=0; i<Math.min(6,rows.length); i++) {
    if (rows[i].filter(Boolean).length >= minFilled) return i;
  }
  return 0;
}

// Build a tile DOM element from a common shape used across SERC/AFSO/ETO sections.
function mkTileEl(opts) {
  var el = document.createElement('div');
  el.className = 'tile ' + opts.className;
  var badgeHtml = badgeSplitHtml(opts.badgeText);
  el.innerHTML =
    '<div class="thead"><div class="tname">'+esc(opts.name)+(opts.nameExtra||'')+'</div><div class="mbadge '+opts.badgeClass+'">'+badgeHtml+'</div></div>'+
    (opts.chips ? '<div class="chips">'+opts.chips+'</div>' : '')+
    (opts.note  ? '<div class="tnote">'+esc(opts.note)+'</div>'  : '');
  return el;
}

// Count ETO members per career level (App -> POM -> Level A -> C Release); 'as' = Level A and above.
function levelCounts(members) {
  var lvl = {crel:0, lvla:0, pom:0, app:0};
  members.forEach(function(d){
    var l = d.level.toUpperCase();
    if (/C.?REL/i.test(l))                     lvl.crel++;
    else if (/LEVEL.?A|LVL.?A|LVL A/i.test(l)) lvl.lvla++;
    else if (/POM/i.test(l))                   lvl.pom++;
    else if (/APP/i.test(l))                   lvl.app++;
  });
  lvl.as = lvl.crel + lvl.lvla;
  return lvl;
}

function todayStr() {
  var n=new Date();
  return n.getFullYear()+'-'+pad2(n.getMonth()+1)+'-'+pad2(n.getDate());
}

// Copy tab-separated text to clipboard, with a button feedback flash and a textarea fallback.
function copyToClipboard(text, btn) {
  navigator.clipboard.writeText(text).then(function(){
    if (btn) {
      var orig = btn.textContent;
      btn.textContent = '✓ Copied!';
      setTimeout(function(){ btn.textContent = orig; }, 2500);
    }
  }).catch(function(){
    var ta=document.createElement('textarea'); ta.value=text;
    document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta);
    notify('Snapshot copied. Paste into the GC Log tab in your spreadsheet.', 'success');
  });
}

// Format a load timestamp as a short relative/absolute string for the source badges.
function fmtLoadTime(d) {
  if (!d) return '';
  return fmtUTCTime(d);
}

function updateSources() {
  var defs = [
    {el: _dom.srcEquip, fname: _equipFname, label: 'SERC', t: _loadTimes.serc},
    {el: _dom.srcLiq,   fname: _liqFname,   label: 'AFSO', t: _loadTimes.afso},
    {el: _dom.srcTrain, fname: _trainFname, label: 'ETO',  t: _loadTimes.eto},
  ];
  defs.forEach(function(d){
    if (!d.el) return;
    if (d.fname) {
      var stale = d.t && ((Date.now() - d.t.getTime()) > STALE_HOURS*3600*1000);
      d.el.className = 'src-badge loaded' + (stale ? ' stale' : '');
      var when = d.t ? 'loaded '+fmtLoadTime(d.t) : '';
      d.el.title = (stale ? 'Loaded over '+STALE_HOURS+'h ago — consider reloading the spreadsheet. ' : '') + 'File: '+d.fname + (when ? ' · '+when : '');
      d.el.innerHTML = '<span class="src-dot"></span>'+(stale?'⚠':'✓')+' '+d.label;
    } else {
      d.el.className = 'src-badge';
      d.el.title = '';
      d.el.innerHTML = '<span class="src-dot"></span>'+d.label;
    }
  });
}

// Re-check staleness of already-loaded sources without rebuilding the badges from
// scratch — called once a minute so a long-open tab flags ageing data.
function refreshSourceFreshness() {
  if (_equipFname || _liqFname || _trainFname) updateSources();
}

// Print Report is available as soon as any module has loaded data.
function updatePrintBtn() {
  var has = (_printAmse.length || _printVehs.length)
    || (_atgls && _atgls.length) || (_pallets && _pallets.length)
    || (_liqData && _liqData.length) || (_sealData && _sealData.length)
    || (_trainData && _trainData.length);
  document.getElementById('printbtn').style.display = has ? '' : 'none';
  document.getElementById('savereportbtn').style.display = has ? '' : 'none';
  document.getElementById('emailreportbtn').style.display = has ? '' : 'none';
  var bt = document.getElementById('board-tools'); if (bt) bt.style.display = has ? '' : 'none';
}
