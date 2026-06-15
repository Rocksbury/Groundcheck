// ── DATE/TIME HELPERS ──
// Single source of truth for month abbreviations and date formatting, used by
// spreadsheet-cell formatting, report stamps, filenames and the print header.
var MONTHS = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
function pad2(v){ return String(v).padStart(2,'0'); }
// Format a Date from a spreadsheet cell in local time as "D MMM YYYY" (day not zero-padded).
function fmtDateCell(d){ return d instanceof Date ? d.getDate()+' '+MONTHS[d.getMonth()]+' '+d.getFullYear() : ''; }
// Format the date portion of a UTC report stamp as "DD MMM YYYY" (day zero-padded).
function fmtUTCDate(d){ return pad2(d.getUTCDate())+' '+MONTHS[d.getUTCMonth()]+' '+d.getUTCFullYear(); }
// Format the time portion of a UTC report stamp as "HH:MMZ".
function fmtUTCTime(d){ return pad2(d.getUTCHours())+':'+pad2(d.getUTCMinutes())+'Z'; }

// ── NON-BLOCKING FEEDBACK ──
// Transient toast for user-action feedback (replaces blocking alert()).
// tone: 'info' (default) | 'warn' | 'success'.
function notify(msg, tone, ms){
  var host = document.getElementById('toast-host');
  if (!host) { return; }
  var t = document.createElement('div');
  t.className = 'gc-toast ' + (tone || 'info');
  t.textContent = msg;
  host.appendChild(t);
  requestAnimationFrame(function(){ t.classList.add('show'); });
  var life = ms || (tone === 'warn' ? 5000 : 3000);
  setTimeout(function(){
    t.classList.remove('show');
    setTimeout(function(){ if (t.parentNode) t.parentNode.removeChild(t); }, 220);
  }, life);
}

// Show the persistent red data-warning banner with the given title + bullet lines.
function showDataWarning(title, lines){
  var dwEl = document.getElementById('data-warn'), dwList = document.getElementById('dw-list');
  var dwTitle = dwEl ? dwEl.querySelector('.dw-title') : null;
  if (!dwEl || !dwList) return;
  if (dwTitle && title) dwTitle.textContent = title;
  dwList.innerHTML = '';
  (lines || []).forEach(function(w){ var li=document.createElement('li'); li.textContent=w; dwList.appendChild(li); });
  dwEl.classList.add('vis');
}
var _liqData = null, _liqFname = '';
var _sealData = null;
var _trainData = null, _trainFname = '';
var _equipFname = '';
var _equipStats = {total:0, uns:0};
