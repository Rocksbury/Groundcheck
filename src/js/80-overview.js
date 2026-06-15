// ── OVERVIEW PINBOARD ──
function toggleSelectMode() {
  _selectMode = !_selectMode;
  document.body.classList.toggle('select-mode', _selectMode);
  // Keep every Select Items button (Board + Trends) in sync.
  document.querySelectorAll('.selectmodebtn').forEach(function(b){
    b.classList.toggle('on', _selectMode);
    b.innerHTML = _selectMode ? '&#9733; Done Selecting' : '&#9734; Select Items';
  });
}
function isPinned(gridId, label) {
  return _overview.some(function(o){ return o.gridId===gridId && o.label===label; });
}
function togglePin(gridId, label, source, img) {
  var i = _overview.findIndex(function(o){ return o.gridId===gridId && o.label===label; });
  if (i>=0) _overview.splice(i,1);
  else _overview.push({gridId: gridId, label: label, notes: '', source: source||'board', img: img||null});
  decoratePins();
  decorateTrendPins();
  if (document.getElementById('page-overview').classList.contains('on')) renderOverview();
}
function unpinAt(idx) {
  _overview.splice(idx,1);
  decoratePins();
  decorateTrendPins();
  renderOverview();
}
// Adds a pin control to every currently-rendered Trends chart card.
function decorateTrendPins() {
  _trendData.forEach(function(td){
    if (!td.el) return;
    var pin = td.el.querySelector('.tile-pin');
    if (!pin) {
      pin = document.createElement('div');
      pin.className = 'tile-pin';
      pin.title = 'Pin to Overview';
      pin.innerHTML = '&#9733;';
      pin.onclick = function(e){
        e.stopPropagation(); e.preventDefault();
        var img = td.chart ? td.chart.toBase64Image() : null;
        togglePin(td.gridId, td.label, 'trends', img);
      };
      td.el.appendChild(pin);
      // Clicking the card (outside the star) opens the trend detail popup.
      td.el.classList.add('selectable');
      td.el.onclick = function(){ openTrendDetail(td.gridId, td.label); };
    }
    td.el.classList.toggle('pinned', isPinned(td.gridId, td.label));
  });
}
// Open the trend detail popup: an enlarged snapshot plus a per-snapshot table.
function openTrendDetail(gridId, label) {
  var td = _trendData.find(function(t){ return t.gridId===gridId && t.label===label; });
  if (!td || !td.detail) return;
  var d = td.detail;
  document.getElementById('trenddet-title').textContent = label;
  var img = document.getElementById('trenddet-img');
  img.src = td.chart ? td.chart.toBase64Image() : '';
  var hasMin = d.min !== null && d.min !== undefined && !isNaN(d.min);
  // Build per-snapshot rows (chronological) with a cumulative met/total tally.
  var metSoFar = 0, totalSoFar = 0, rows = '';
  for (var i = 0; i < d.dates.length; i++) {
    var v = d.values[i];
    if (v === null || v === undefined) continue; // no data logged for this snapshot
    totalSoFar++;
    var good = hasMin ? (v >= d.min) : null;
    if (good) metSoFar++;
    var statusCell = good === null
      ? '<span class="td-na">&mdash;</span>'
      : '<span class="td-' + (good ? 'good' : 'bad') + '">' + (good ? 'GOOD' : 'NOT GOOD') + '</span>';
    rows += '<tr><td>' + esc(fmtSnapDate(d.dates[i])) + '</td>' +
      '<td>' + v + (hasMin ? ' / ' + d.min : '') + '</td>' +
      '<td>' + statusCell + '</td>' +
      '<td>' + (hasMin ? metSoFar + ' / ' + totalSoFar : '<span class="td-na">&mdash;</span>') + '</td></tr>';
  }
  var sub = document.getElementById('trenddet-sub');
  if (hasMin) {
    sub.textContent = metSoFar + ' of ' + totalSoFar + ' snapshots met the minimum of ' + d.min + ' ' + (d.unit || '') + '.';
  } else {
    sub.textContent = 'No minimum defined for this item — showing logged values over time.';
  }
  document.getElementById('trenddet-table').innerHTML =
    '<tr><th>Snapshot</th><th>' + (hasMin ? 'Value / Min' : 'Value') + '</th><th>Status</th><th>Met / Total</th></tr>' +
    (rows || '<tr><td colspan="4"><div class="detail-empty">No logged data for this item.</div></td></tr>');
  document.getElementById('trenddet-modal').classList.add('vis');
}
function closeTrendDetail() {
  document.getElementById('trenddet-modal').classList.remove('vis');
}
// In select mode, a click anywhere on a Board tile or Trends card toggles its pin and
// suppresses the normal detail popup. Capture phase + stopPropagation beats the per-tile
// click listeners, so it works no matter the order those listeners were attached.
document.addEventListener('click', function(e){
  if (!_selectMode) return;
  var el = e.target.closest('.tile, .cc');
  if (!el) return;
  var bt = _tileData.find(function(t){ return t.el === el; });
  if (bt && bt.grid) {
    e.stopPropagation(); e.preventDefault();
    togglePin(bt.grid.id, bt.label);
    return;
  }
  var tt = _trendData.find(function(t){ return t.el === el; });
  if (tt) {
    e.stopPropagation(); e.preventDefault();
    togglePin(tt.gridId, tt.label, 'trends', tt.chart ? tt.chart.toBase64Image() : null);
  }
}, true);
// Adds a pin control to every tracked tile and refreshes its pinned state.
function decoratePins() {
  _tileData.forEach(function(td){
    if (!td.el || !td.grid) return;
    var pin = td.el.querySelector('.tile-pin');
    if (!pin) {
      pin = document.createElement('div');
      pin.className = 'tile-pin';
      pin.title = 'Pin to Overview';
      pin.innerHTML = '&#9733;';
      pin.onclick = function(e){
        e.stopPropagation(); e.preventDefault();
        togglePin(td.grid.id, td.label);
      };
      td.el.appendChild(pin);
    }
    td.el.classList.toggle('pinned', isPinned(td.grid.id, td.label));
  });
}
var MEMO_MONTHS = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
function todayMemoDate() {
  var d = new Date();
  return pad2(d.getDate()) + ' ' + MEMO_MONTHS[d.getMonth()] + ' ' + d.getFullYear();
}
// Format a snapshot date for display: ISO strings pass through; bare Excel serials are converted.
function fmtSnapDate(ds) {
  if (ds == null) return '—';
  ds = String(ds).trim();
  if (/^\d{1,6}(\.\d+)?$/.test(ds)) { // Excel serial day number
    var ms = Math.round((parseFloat(ds) - 25569) * 86400000);
    var dt = new Date(ms);
    if (!isNaN(dt)) return pad2(dt.getUTCDate()) + ' ' + MEMO_MONTHS[dt.getUTCMonth()] + ' ' + dt.getUTCFullYear();
  }
  return ds;
}
function renderOverview() {
  // Keep the shared memo fields in sync with state (e.g. after loading a report).
  if (!_overviewNote.date) _overviewNote.date = todayMemoDate(); // default to today on first view
  var md = document.getElementById('ov-memo-date'),
      mb = document.getElementById('ov-memo-body'),
      ma = document.getElementById('ov-memo-author');
  if (md) md.value = _overviewNote.date || '';
  if (mb) mb.value = _overviewNote.body || '';
  if (ma) ma.value = _overviewNote.author || '';
  var grid = document.getElementById('overviewgrid');
  var empty = document.getElementById('overview-empty');
  grid.innerHTML = '';
  if (!_overview.length) { empty.style.display = ''; return; }
  empty.style.display = 'none';
  _overview.forEach(function(item, idx){
    var card = document.createElement('div');
    card.className = 'cc ov-card';
    var head = document.createElement('div');
    head.className = 'ov-head';
    head.innerHTML = '<div class="ov-label">'+esc(item.label)+'</div><button class="ov-remove">Remove</button>';
    head.querySelector('.ov-remove').onclick = function(){ unpinAt(idx); };
    card.appendChild(head);
    if (item.source === 'trends') {
      // Trends charts can't be cloned live (canvas), so show a snapshot image.
      var live = _trendData.find(function(td){ return td.gridId===item.gridId && td.label===item.label; });
      var imgSrc = (live && live.chart) ? live.chart.toBase64Image() : item.img;
      if (live && live.chart) item.img = imgSrc; // refresh the stored snapshot so saves stay current
      if (imgSrc) {
        var im = document.createElement('img');
        im.className = 'ov-trend-img'; im.src = imgSrc; im.alt = item.label;
        card.appendChild(im);
      } else {
        var miss0 = document.createElement('div');
        miss0.className = 'ov-missing';
        miss0.textContent = 'Trend chart not available — open the Trends page to refresh this item.';
        card.appendChild(miss0);
      }
      var notesWrapT = document.createElement('div');
      notesWrapT.className = 'ov-notes';
      notesWrapT.innerHTML = '<label>Notes</label><textarea placeholder="Add discussion notes...">'+esc(item.notes||'')+'</textarea>';
      notesWrapT.querySelector('textarea').oninput = function(e){ item.notes = e.target.value; };
      card.appendChild(notesWrapT);
      grid.appendChild(card);
      return;
    }
    var src = _tileData.find(function(td){ return td.grid && td.grid.id===item.gridId && td.label===item.label; });
    if (src) {
      var tile = src.el.cloneNode(true);
      tile.className = tile.className.replace(/\b(hoverable|clickable|pinned)\b/g,'').trim();
      tile.classList.add('ov-tile');
      tile.removeAttribute('onclick');
      var pin = tile.querySelector('.tile-pin'); if (pin) pin.remove();
      card.appendChild(tile);
    } else {
      var miss = document.createElement('div');
      miss.className = 'ov-missing';
      miss.textContent = 'Not in current data — reload the spreadsheet to refresh this item.';
      card.appendChild(miss);
    }
    var notesWrap = document.createElement('div');
    notesWrap.className = 'ov-notes';
    notesWrap.innerHTML = '<label>Notes</label><textarea placeholder="Add discussion notes...">'+esc(item.notes||'')+'</textarea>';
    notesWrap.querySelector('textarea').oninput = function(e){ item.notes = e.target.value; };
    card.appendChild(notesWrap);
    grid.appendChild(card);
  });
}

// QOL: switch the View Section from a keyboard shortcut (also jumps to the Board page).
function setView(sec) {
  var sel = document.getElementById('boardsec');
  if (!sel) return;
  var boardPage = document.getElementById('page-board');
  if (boardPage && !boardPage.classList.contains('on')) {
    var boardTab = document.querySelector('.tabs .tab');
    if (boardTab) gotoPage('board', boardTab);
  }
  if (!_bannerStats[sec]) { notify(sec.toUpperCase() + ' has no data loaded yet.', 'warn'); return; }
  if (boardPage) boardPage.classList.remove('board-hub');  // leave the hub, drill into the office
  _boardView = sec;
  sel.value = sec;
  onSectionChange();
  updateDrillSwitch(sec);
}

// Focus the board on one office: expand that office's sections, collapse the others'.
// Only acts on sections that are actually loaded (visible headers).
function focusOffice(sec) {
  Object.keys(SECTION_LABELS).forEach(function(office) {
    var collapse = office !== sec;
    SECTION_LABELS[office].forEach(function(id) {
      var h = document.getElementById(id);
      if (h && h.style.display !== 'none') h.classList.toggle('collapsed', collapse);
    });
  });
  updateCollapseAllBtn(false); // the focused office is now expanded, so next action is "collapse all"
}

// QOL: reset the board view — expand every section, undoing any office focus.
function resetFocus() {
  var hdrs = document.querySelectorAll('.slbl.collapsible');
  hdrs.forEach(function(h){ h.classList.remove('collapsed'); });
  updateCollapseAllBtn(false);
}

// QOL: show/hide the keyboard shortcuts legend.
function toggleShortcutsHelp() {
  var el = document.getElementById('shortcuts-help');
  if (el) el.classList.toggle('vis');
}
