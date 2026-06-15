// ── SAVE REPORT ──
function saveReport() {
  var payload = {
    v: 1,
    savedAt: new Date().toISOString(),
    equipFname:  _equipFname  || '',
    liqFname:    _liqFname    || '',
    trainFname:  _trainFname  || '',
    loadTimes: {
      serc:  _loadTimes.serc  ? _loadTimes.serc.toISOString()  : null,
      afso:  _loadTimes.afso  ? _loadTimes.afso.toISOString()  : null,
      eto:   _loadTimes.eto   ? _loadTimes.eto.toISOString()   : null,
    },
    amse:        _printAmse   || [],
    vehs:        _printVehs   || [],
    atgls:       _atgls       || [],
    pallets:     _pallets      || [],
    liqData:     _liqData     || [],
    sealData:    _sealData    || [],
    trainData:   _trainData   || [],
    bannerStats: _bannerStats,
    log:         log          || [],
    afsoLog:     afsoLog      || [],
    etoLog:      etoLog       || [],
    overview:    _overview    || [],
    overviewNote: _overviewNote || {date:'', body:'', author:''},
  };

  // Clone the document and clean out all live DOM state so the saved file is
  // a clean shell that loadSnapshot() can rebuild from the JSON payload.
  var clone = document.documentElement.cloneNode(true);

  // Clear all tile grids
  ['agrid','vgrid','atglgrid','lgrid','sgrid','tgrid'].forEach(function(id) {
    var el = clone.querySelector('#'+id);
    if (el) el.innerHTML = '';
  });

  // Reset section labels: hide them all (loadSnapshot will re-show as needed)
  ['albl','vlbl','atgllbl','palletlbl','llbl','sllbl','tlbl'].forEach(function(id) {
    var el = clone.querySelector('#'+id);
    if (el) el.style.display = 'none';
  });

  // Hide buttons that loadSnapshot will re-show
  ['printbtn','savereportbtn','emailreportbtn','snapbtn','afsosnapbtn','etosnapbtn'].forEach(function(id) {
    var el = clone.querySelector('#'+id);
    if (el) el.style.display = 'none';
  });

  // Reset filter/sort/search state
  clone.querySelectorAll('.fbtn[data-f]').forEach(function(b){ b.classList.toggle('on', b.dataset.f==='all'); });
  clone.querySelectorAll('.fbtn[data-s]').forEach(function(b){ b.classList.toggle('on', b.dataset.s==='default'); });
  var si = clone.querySelector('#search-input'); if (si) si.value = '';
  // Reset QOL widgets (search count/clear, empty-state, board tools, shortcuts overlay, collapsed sections)
  var sc = clone.querySelector('#search-count'); if (sc) sc.textContent = '';
  var scl = clone.querySelector('#search-clear'); if (scl) scl.style.display = 'none';
  var nmc = clone.querySelector('#no-match'); if (nmc) nmc.style.display = 'none';
  var btc = clone.querySelector('#board-tools'); if (btc) btc.style.display = 'none';
  var shc = clone.querySelector('#shortcuts-help'); if (shc) shc.classList.remove('vis');
  clone.querySelectorAll('.slbl.collapsible.collapsed').forEach(function(h){ h.classList.remove('collapsed'); });

  // Reset source badges
  [{id:'src-equip',label:'SERC'},{id:'src-liq',label:'AFSO'},{id:'src-train',label:'ETO'}].forEach(function(d){
    var el = clone.querySelector('#'+d.id);
    if (el) { el.className = 'src-badge'; el.innerHTML = '<span class="src-dot"></span>'+d.label; }
  });

  // Reset fstat
  var fs = clone.querySelector('#fstat'); if (fs) fs.textContent = '';
  var ts = clone.querySelector('#tstat'); if (ts) ts.textContent = 'No log data loaded';

  // Remove data-warn visibility and reset its title + list to the default
  var dw = clone.querySelector('#data-warn');
  if (dw) {
    dw.classList.remove('vis');
    var dwt = dw.querySelector('.dw-title'); if (dwt) dwt.textContent = 'Data Warning';
    var dwl = dw.querySelector('#dw-list'); if (dwl) dwl.innerHTML = '';
  }
  // Drop any live toasts from the saved shell
  var th = clone.querySelector('#toast-host'); if (th) th.innerHTML = '';

  // Remove any previous snapshot, remove any saved-report bar
  clone.querySelectorAll('#gc-snapshot').forEach(function(el){ el.remove(); });
  clone.querySelectorAll('.gc-report-bar').forEach(function(el){ el.remove(); });

  // Remove afso-hidden-badges injected at runtime
  clone.querySelectorAll('.afso-hidden-badge').forEach(function(el){ el.remove(); });

  // Inject snapshot JSON into <head>
  var snapshotEl = document.createElement('script');
  snapshotEl.type = 'application/json';
  snapshotEl.id = 'gc-snapshot';
  snapshotEl.textContent = JSON.stringify(payload);
  clone.querySelector('head').appendChild(snapshotEl);

  var html = '<!DOCTYPE html>\n' + clone.outerHTML;
  var fname = reportFilename();

  var blob = new Blob([html], {type: 'text/html'});
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = fname;
  a.click();
  URL.revokeObjectURL(a.href);
}

// Shared dated filename for Save Report / Email Report — keeps the two in sync.
function reportFilename() {
  return '429 Readiness Report ' + fmtUTCDate(new Date()) + '.html';
}

// ── EMAIL REPORT ──
// Saves the report (same file as "Save Report"), then opens a modal with a
// pre-filled subject/body summarising current readiness stats so the user can
// review/edit, copy the text, or hand off to their email client. Browsers cannot
// attach files to a mailto: link or guarantee a mail client is configured, so the
// user is prompted to attach the just-downloaded report file themselves.
function emailReport() {
  saveReport();

  var dateStr = fmtUTCDate(new Date());
  var fname = reportFilename();

  var lines = [];
  lines.push('429 SQN GROUNDCHECK — Readiness Summary');
  lines.push('Date: ' + dateStr);
  lines.push('');

  ['serc','afso','eto'].forEach(function(sec){
    var stats = _bannerStats[sec];
    if (!stats) return;
    lines.push(stats.label);
    lines.push(stats.cells.map(function(c){ return c.label + ': ' + c.value; }).join('  |  '));
    lines.push('');
  });

  lines.push('Full report attached: ' + fname);
  lines.push('(The report has just been downloaded — please attach it from your Downloads folder before sending.)');
  lines.push('');
  lines.push('Generated by GROUNDCHECK 429 SQN');

  document.getElementById('email-fname').textContent = fname;
  document.getElementById('email-to').value = '';
  document.getElementById('email-subject').value = '429 SQN GROUNDCHECK Readiness Report — ' + dateStr;
  document.getElementById('email-body').value = lines.join('\n');
  document.getElementById('email-modal').classList.add('vis');
}

function closeEmailModal() {
  document.getElementById('email-modal').classList.remove('vis');
}

// Open the user's default email client via mailto: with the (possibly edited) fields.
function sendEmailReport() {
  var to = document.getElementById('email-to').value.trim();
  var subject = document.getElementById('email-subject').value;
  var body = document.getElementById('email-body').value;
  var mailto = 'mailto:' + encodeURIComponent(to).replace(/%40/g,'@').replace(/%2C/g,',')
    + '?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(body);
  window.location.href = mailto;
}

// Copy the summary body to the clipboard, with a button feedback flash.
function copyEmailBody() {
  var body = document.getElementById('email-body').value;
  var btn = document.getElementById('email-copy-btn');
  navigator.clipboard.writeText(body).then(function(){
    var orig = btn.textContent;
    btn.textContent = '✓ Copied!';
    setTimeout(function(){ btn.textContent = orig; }, 2500);
  });
}
