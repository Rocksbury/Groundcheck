// ── LOAD SNAPSHOT ──
// Called on boot if a gc-snapshot script tag is found embedded in this file.
function loadSnapshot(payload) {
  if (!payload || payload.v !== 1) return;

  // Restore filenames and load times
  _equipFname  = payload.equipFname  || '';
  _liqFname    = payload.liqFname    || '';
  _trainFname  = payload.trainFname  || '';
  _loadTimes.serc  = payload.loadTimes.serc  ? new Date(payload.loadTimes.serc)  : null;
  _loadTimes.afso  = payload.loadTimes.afso  ? new Date(payload.loadTimes.afso)  : null;
  _loadTimes.eto   = payload.loadTimes.eto   ? new Date(payload.loadTimes.eto)   : null;

  // Restore parsed data — dates in atgls/pallets need to be revived
  _printAmse  = payload.amse     || [];
  _printVehs  = payload.vehs     || [];
  _atgls      = reviveDates(payload.atgls   || []);
  _pallets    = reviveDates(payload.pallets  || []);
  _liqData    = payload.liqData  || [];
  _sealData   = payload.sealData || [];
  _trainData  = payload.trainData|| [];
  _bannerStats= payload.bannerStats || {serc:null, afso:null, eto:null};
  log         = payload.log      || [];
  afsoLog     = payload.afsoLog  || [];
  etoLog      = payload.etoLog   || [];
  _overview   = payload.overview || [];
  _overviewNote = payload.overviewNote || {date:'', body:'', author:''};
  if (_overviewNote.date === undefined) _overviewNote.date = _overviewNote.title || ''; // migrate older {title} memos
  if (_overviewNote.author === undefined) _overviewNote.author = '';

  // Rebuild all sections
  buildBoard(_printAmse, _printVehs, {}, _equipFname, _atgls, _pallets);
  buildLiquidsSection();
  buildSealantsSection();
  buildTrainingSection();
  renderOverview();

  // Restore banner
  computeAfsoBanner();
  computeEtoBanner();

  // Re-show section labels that buildBoard shows (it handles albl/vlbl/atgllbl/palletlbl)
  // AFSO and ETO labels are handled by buildLiquidsSection/buildSealantsSection/buildTrainingSection
  // Force-show filter group
  ['filter-group'].forEach(function(id){
    var el = document.getElementById(id);
    if (el) el.style.display = '';
  });

  // Show a snapshot banner so recipient knows this is a saved report
  var savedAt = new Date(payload.savedAt);
  var label = 'SAVED REPORT \u00b7 ' + fmtUTCDate(savedAt) + ' ' + fmtUTCTime(savedAt);
  var bar = document.createElement('div');
  bar.className = 'gc-report-bar';
  bar.style.cssText = 'background:var(--blue);color:#fff;text-align:center;font-family:var(--cond);font-size:12px;font-weight:700;letter-spacing:2px;padding:5px;';
  bar.textContent = label;
  document.body.insertBefore(bar, document.body.firstChild);

  updateSources();
  updatePrintBtn();
  var s = document.getElementById('boardsec'); if (s && _bannerStats.serc) s.value = 'serc';
  renderBanner();
}

// Re-attach Date objects to atgl/pallet records after JSON round-trip
function reviveDates(arr) {
  return arr.map(function(item) {
    var out = Object.assign({}, item);
    ['eposDue','lpDue'].forEach(function(k){
      if (out[k] && typeof out[k] === 'string') out[k] = new Date(out[k]);
    });
    if (out.inspections) {
      out.inspections = out.inspections.map(function(ins){
        var i2 = Object.assign({}, ins);
        return i2;
      });
    }
    return out;
  });
}

function openPrintModal() {
  var haveSerc = _printAmse.length || _printVehs.length;
  var haveAfso = (_liqData && _liqData.length) || (_sealData && _sealData.length);
  var haveEto  = _trainData && _trainData.length;
  if (!haveSerc && !haveAfso && !haveEto) { notify('Load a spreadsheet first.', 'warn'); return; }
  var opts = document.getElementById('print-options');
  function row(id, label, enabled) {
    return '<label class="modal-option'+(enabled?'':' disabled')+'">'+
      '<input type="checkbox" id="'+id+'" '+(enabled?'checked':'disabled')+'>'+label+
      (enabled?'':' (no data loaded)')+'</label>';
  }
  opts.innerHTML =
    row('pm-serc', 'SERC \u2014 Equipment &amp; Vehicles', haveSerc) +
    row('pm-afso', 'AFSO \u2014 Fluids &amp; Sealants', haveAfso) +
    row('pm-eto',  'ETO \u2014 Training &amp; Qualifications', haveEto);
  document.getElementById('print-modal').classList.add('vis');
}

function closePrintModal() {
  document.getElementById('print-modal').classList.remove('vis');
}

document.addEventListener('keydown', function(e){
  if (e.key === 'Escape') closePrintModal();
});

function confirmPrint() {
  var wantSerc = !!(document.getElementById('pm-serc') && document.getElementById('pm-serc').checked);
  var wantAfso = !!(document.getElementById('pm-afso') && document.getElementById('pm-afso').checked);
  var wantEto  = !!(document.getElementById('pm-eto')  && document.getElementById('pm-eto').checked);
  if (!wantSerc && !wantAfso && !wantEto) { notify('Select at least one section to print.', 'warn'); return; }
  closePrintModal();

  var ph=document.getElementById('print-header');
  var fstat=_dom.fstat.textContent;
  var now=new Date(), days=['SUN','MON','TUE','WED','THU','FRI','SAT'];
  var tzAbbr=(new Intl.DateTimeFormat('en-CA',{timeZoneName:'short'}).formatToParts(now).find(function(p){return p.type==='timeZoneName';})||{value:''}).value;
  var ts=days[now.getUTCDay()]+' '+fmtUTCDate(now)+'  '+pad2(now.getHours())+':'+pad2(now.getMinutes())+' '+tzAbbr+'  /  '+fmtUTCTime(now);
  var crestSrc=(document.querySelector('.logo img')||{}).src||'';
  var scoreEl=document.getElementById('b-score');
  var sections = [];
  if (wantSerc) sections.push('SERC');
  if (wantAfso) sections.push('AFSO');
  if (wantEto)  sections.push('ETO');
  ph.innerHTML=
    '<div style="display:flex;align-items:center;gap:12px;">'+
      (crestSrc?'<img src="'+crestSrc+'" style="width:44px;height:44px;object-fit:contain;">':'')+
      '<div>'+
        '<div class="ph-title">GROUNDCHECK \u2014 429 SQN</div>'+
        '<div class="ph-sub">'+sections.join(' / ')+' \u00b7 C-17 GLOBEMASTER III</div>'+
      '</div>'+
    '</div>'+
    '<div class="ph-meta">'+
      (wantSerc && scoreEl && scoreEl.textContent!=='\u2014'?'<div>READINESS: '+scoreEl.textContent+'</div>':'')+
      (wantSerc && fstat!=='No file loaded'?'<div>'+fstat+'</div>':'')+
      '<div>PRINTED: '+ts+'</div>'+
    '</div>';

  var pb=document.getElementById('print-body'); pb.innerHTML='';
  var html='';
  if (wantSerc) html += buildSercPrintSections();
  if (wantAfso) html += buildAfsoPrintSections();
  if (wantEto)  html += buildEtoPrintSections();
  pb.innerHTML=html;

  // Use the standard report name as the document title while printing so
  // "Save as PDF" suggests "429 Readiness Report <date>.pdf".
  var origTitle = document.title;
  document.title = reportFilename().replace(/\.html$/,'');
  var restoreTitle = function(){ document.title = origTitle; window.removeEventListener('afterprint', restoreTitle); };
  window.addEventListener('afterprint', restoreTitle);
  window.print();
  setTimeout(restoreTitle, 1000);
}
