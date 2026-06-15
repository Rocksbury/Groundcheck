// ── FAVICON ──
function setFavicon(score) {
  try {
    var color = score === null ? '#4A6070' : score >= 100 ? '#27AE60' : score >= 75 ? '#E09800' : '#C0392B';
    var c = document.createElement('canvas'); c.width=32; c.height=32;
    var ctx = c.getContext('2d');
    ctx.beginPath(); ctx.arc(16,16,14,0,Math.PI*2); ctx.fillStyle=color; ctx.fill();
    if (score !== null) {
      ctx.fillStyle='#fff'; ctx.font='bold 11px sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.fillText(score+'%', 16, 17);
    }
    var link = document.querySelector("link[rel*='icon']") || document.createElement('link');
    link.type='image/x-icon'; link.rel='shortcut icon'; link.href=c.toDataURL();
    document.head.appendChild(link);
  } catch(e){}
}

// ── SEARCH (debounced) ──
// Typing fires this on every keystroke; applyViewState() itself is deferred until
// typing pauses for ~120ms so large boards don't re-render on every character.
var _searchDebounce = null;
function onSearchInput() {
  clearTimeout(_searchDebounce);
  _searchDebounce = setTimeout(applyViewState, 120);
}

// ── FILTER ──
function setFilter(val, btn) {
  _activeFilter = val;
  document.querySelectorAll('.fbtn[data-f]').forEach(function(b){ b.classList.toggle('on', b.dataset.f === val); });
  applyViewState();
}

// Apply current filter state to all tiles
function applyViewState() {
  var query = (_dom.searchInput ? _dom.searchInput.value : '').toUpperCase().trim();
  var shown = 0, totalTiles = _tileData.length;

  // Show/hide based on search + filter
  _tileData.forEach(function(td) {
    var searchMatch = !query
      || td.label.toUpperCase().indexOf(query) >= 0
      || td.tags.some(function(k){ return k.toUpperCase().indexOf(query) >= 0; });
    var filterMatch = true;
    if (_activeFilter === 'warn')       filterMatch = td.status === 'warn';
    else if (_activeFilter === 'atmin') filterMatch = td.status === 'atmin';
    else if (_activeFilter === 'uns')   filterMatch = td.c.uns > 0;
    else if (_activeFilter === 'cal')   filterMatch = td.c.cal > 0;
    else if (_activeFilter === 'dep')   filterMatch = td.c.dep > 0;
    // AFSO green tiles: hide unless searching, filter active, show-all toggled, or tile has faulted items
    var greenHidden = td.el.hasAttribute('data-green-hidden')
      && !_afsoShowAll && !query && _activeFilter === 'all'
      && td.c.uns === 0 && td.c.cal === 0 && td.c.dep === 0;
    var show = searchMatch && filterMatch && !greenHidden;
    td.el.classList.remove('dimmed');
    td.el.style.display = show ? '' : 'none';
    if (show) shown++;
  });
  // Update hidden-count badges on AFSO section labels
  applyAfsoGreenHide();

  // QOL: result count, clear button, and empty-state message
  var active = !!query || _activeFilter !== 'all';
  var clearBtn = document.getElementById('search-clear');
  if (clearBtn) clearBtn.style.display = query ? '' : 'none';
  var countEl = document.getElementById('search-count');
  if (countEl) countEl.textContent = (active && totalTiles) ? ('showing ' + shown + ' of ' + totalTiles) : '';
  var nm = document.getElementById('no-match');
  if (nm) nm.style.display = (active && shown === 0 && totalTiles > 0) ? '' : 'none';
}

// QOL: clear just the search box (keeps any active filter), then refocus it.
function clearSearch() {
  if (_dom.searchInput) _dom.searchInput.value = '';
  applyViewState();
  if (_dom.searchInput) _dom.searchInput.focus();
}

// QOL: reset both search and filter back to "show everything".
function clearSearchAndFilter() {
  if (_dom.searchInput) _dom.searchInput.value = '';
  _activeFilter = 'all';
  document.querySelectorAll('.fbtn[data-f]').forEach(function(b){ b.classList.toggle('on', b.dataset.f === 'all'); });
  applyViewState();
}

// QOL: collapse or expand every visible Board section in one click.
function toggleCollapseAll() {
  var hdrs = Array.prototype.slice.call(document.querySelectorAll('.slbl.collapsible'))
    .filter(function(h){ return h.style.display !== 'none'; });
  if (!hdrs.length) return;
  var anyOpen = hdrs.some(function(h){ return !h.classList.contains('collapsed'); });
  hdrs.forEach(function(h){ h.classList.toggle('collapsed', anyOpen); });
  updateCollapseAllBtn(anyOpen); // anyOpen ? we just collapsed them all : we just expanded
}
function updateCollapseAllBtn(collapsed) {
  var b = document.getElementById('collapse-all-btn');
  if (b) b.innerHTML = collapsed ? '▼ Expand All' : '▲ Collapse All';
}
