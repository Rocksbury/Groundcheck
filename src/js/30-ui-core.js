// ── THEME ──
function setThemeBtn(isLight) {
  var icon = document.getElementById('theme-icon'), lbl = document.getElementById('theme-label'), btn = document.getElementById('theme-toggle');
  if (!icon || !lbl) return;
  icon.textContent = isLight ? '\u263E' : '\u2600\uFE0F';
  lbl.textContent = isLight ? 'NIGHT MODE' : 'DAY MODE';
  if (btn) btn.title = isLight ? 'Switch to night mode' : 'Switch to day mode';
}
function toggleTheme() {
  var isLight = document.body.classList.toggle('light');
  setThemeBtn(isLight);
  try { localStorage.setItem('gc_theme', isLight ? 'light' : 'dark'); } catch(e){}
  if (document.getElementById('page-trends').classList.contains('on')) renderTrends();
}
(function(){
  try { if (localStorage.getItem('gc_theme') === 'light') {
    document.body.classList.add('light');
    document.addEventListener('DOMContentLoaded', function(){ setThemeBtn(true); });
  }} catch(e){}
})();

// ── SOURCE FRESHNESS ──
// Once a minute, re-check whether any loaded source has crossed the staleness threshold.
setInterval(refreshSourceFreshness, 60000);

// ── PAGE ──
function gotoPage(name, btn) {
  document.querySelectorAll('.page').forEach(function(p){p.classList.remove('on');});
  document.querySelectorAll('.tab').forEach(function(b){b.classList.remove('on');});
  document.getElementById('page-'+name).classList.add('on');
  btn.classList.add('on');
  if (name === 'trends') renderTrends();
  if (name === 'overview') renderOverview();
}

// ── ESCAPE KEY: close popover ──
document.addEventListener('keydown', function(e){
  if (e.key === 'Escape') hidePop();
});

// ── KEYBOARD SHORTCUTS ──
// /  focus search · 1/2/3 view office · P print · C collapse-all · ? help · Esc clear/close
document.addEventListener('keydown', function(e){
  var t = e.target, tag = t && t.tagName ? t.tagName.toLowerCase() : '';
  var typing = tag === 'input' || tag === 'textarea' || tag === 'select' || (t && t.isContentEditable);

  if (e.key === 'Escape') {
    var sh = document.getElementById('shortcuts-help');
    if (sh && sh.classList.contains('vis')) { sh.classList.remove('vis'); return; }
    if (_dom.searchInput && document.activeElement === _dom.searchInput && _dom.searchInput.value) { clearSearch(); return; }
    return; // other Esc handlers (modals/popover) run via their own listeners
  }
  if (e.key === '/' && !typing) {
    if (_dom.searchInput) { e.preventDefault(); _dom.searchInput.focus(); _dom.searchInput.select(); }
    return;
  }
  if (e.key === '?' && !typing) { e.preventDefault(); toggleShortcutsHelp(); return; }

  if (typing || e.ctrlKey || e.metaKey || e.altKey) return; // don't hijack typing or browser combos

  switch (e.key) {
    case '1': e.preventDefault(); setView('serc'); break;
    case '2': e.preventDefault(); setView('afso'); break;
    case '3': e.preventDefault(); setView('eto');  break;
    case '0': e.preventDefault(); showHub(); break;
    case 'p': case 'P': e.preventDefault(); if (typeof openPrintModal === 'function') openPrintModal(); break;
    case 'c': case 'C': e.preventDefault(); toggleCollapseAll(); break;
  }
});

// ── NORMALISE CONDITION ──
function nc(raw) {
  if (!raw) return null;
  var s = String(raw).toUpperCase().trim();
  if (s === 'S' || s === 'SERVICEABLE') return 'svc';
  if (s === 'U/S' || s === 'UNSERVICEABLE') return 'uns';
  if (s.indexOf('INSP') >= 0 || s.indexOf('CAL') >= 0) return 'cal';
  if (s === 'DEPLOYED') return 'dep';
  return null;
}

// ── MATCH ──
function match(items, kws, exclude) {
  return items.filter(function(i){
    var hit = kws.some(function(k){ return i.name.indexOf(k) >= 0; });
    if (!hit) return false;
    if (exclude && exclude.length) {
      var ex = exclude.some(function(e){ return i.name.indexOf(e) >= 0; });
      if (ex) return false;
    }
    return true;
  });
}

// ── COUNT ──
function count(items) {
  var c = {svc:0, uns:0, cal:0, dep:0};
  items.forEach(function(i){ if (c[i.cond] !== undefined) c[i.cond]++; });
  return c;
}
