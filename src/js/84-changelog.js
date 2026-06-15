// ── CHANGELOG ──
var CHANGELOG = [
  {
    "ver": "v39",
    "date": "JUN 2026",
    "changes": [
      "Board now opens to a SECTION OVERVIEW — one tile per office (SERC / AFSO / ETO) showing that office's readiness score and key counts at a glance, instead of dropping straight into a wall of equipment tiles.",
      "Click a section tile (or press 1 / 2 / 3) to drill into that office's board; the crest, the ALL SECTIONS breadcrumb, or 0 returns to the overview. A compact section switcher appears while drilled in.",
      "Freed the top of the page: a single UNIT READINESS figure plus Load and Can I Deploy now sit above the tiles. The old View Section dropdown is retired (kept hidden internally).",
      "First major change built from the new modular src/ source via the build step."
    ]
  },
  {
    "ver": "v38",
    "date": "JUN 2026",
    "changes": [
      "Accessibility: added a keyboard-focus ring and aria-labels to the search, memo, email, and toolbar controls so the app is usable with a keyboard and screen reader.",
      "Loading spreadsheets is now queued — dropping or selecting more files while a batch is still parsing queues them instead of running two parses at once, with progress toasts.",
      "Built on v36; the experimental v37 board (a flat list of every authorisation) was set aside."
    ]
  },
  {
    "ver": "v36",
    "date": "JUN 2026",
    "changes": [
      "Trends charts now build through one shared helper for all three offices (SERC, AFSO, ETO), removing duplicated card and chart code.",
      "GROUNDCHECK can now load the real ETO Authorization Export from the training app directly (detected automatically) and derive each member's trade, level, and Tow Driver/IC status."
    ]
  },
  {
    "ver": "v35",
    "date": "JUN 2026",
    "changes": [
      "Moved the in-app Guide to a separate GroundCheck Guide.html to shrink the app and speed it up.",
      "Trimmed the in-app changelog to the latest versions — full history now lives in CHANGELOG.txt.",
      "Refactored the Trends code so the three offices share common chart-option and chronic-issue rendering, cutting duplication."
    ]
  },
  {
    "ver": "v34",
    "date": "JUN 2026",
    "changes": [
      "Replaced the embedded squadron crest with a smaller WebP version (same image, sized for display) — cut the file by about 55 KB with no visible change."
    ]
  }
];

function openChangelogModal() {
  var body = document.getElementById('changelog-body');
  body.innerHTML = CHANGELOG.map(function(entry){
    var head = '<div class="cl-head"><span class="cl-ver">'+esc(entry.ver)+'</span>'+
      (entry.date ? '<span class="cl-date">'+esc(entry.date)+'</span>' : '')+'</div>';
    var list = entry.changes.length
      ? '<ul class="cl-list">'+entry.changes.map(function(c){ return '<li>'+esc(c)+'</li>'; }).join('')+'</ul>'
      : '';
    var note = entry.note ? '<div class="cl-note">'+esc(entry.note)+'</div>' : '';
    return '<div class="cl-entry">'+head+list+note+'</div>';
  }).join('') +
    '<div class="cl-note" style="margin-top:6px;">Older versions are listed in CHANGELOG.txt (alongside this file).</div>';
  document.getElementById('changelog-modal').classList.add('vis');
}

function closeChangelogModal() {
  document.getElementById('changelog-modal').classList.remove('vis');
}

// Status -> label/colour for the tile-list drill-down modal opened from the banner.
var TILE_STATUS = {
  warn:  {label:'Below Min', color:'var(--red)'},
  atmin: {label:'At Min',    color:'var(--amber)'},
  ok:    {label:'OK',        color:'var(--green)'},
};

// How many of the last WEEKS log snapshots had this tile in the same state as `cellId`.
// Returns {n, total} or null if there's no log history that can answer the question for this tile.
var TREND_WEEKS = 16;
function tileWeekHistory(td, cellId) {
  if (td.rule && td.rule.key && log.length) {
    var snaps = log.slice(-TREND_WEEKS);
    var key = td.rule.key, min = td.rule.min;
    var n = snaps.filter(function(s){
      var c = s.counts[key];
      if (!c) return false;
      switch (cellId) {
        case 'b-uns':    return c.uns > 0;
        case 'b-cal':    return c.cal > 0;
        case 'b-notmet': return c.svc < min;
        case 'b-atmin':  return c.svc === min;
        default: return false;
      }
    }).length;
    return {n: n, total: snaps.length};
  }
  if ((td.grid.id === 'lgrid' || td.grid.id === 'sgrid') && afsoLog.length && (cellId === 'b-uns' || cellId === 'b-cal')) {
    var wantStatus = cellId === 'b-uns' ? 'UNS' : 'LOW';
    var snaps2 = afsoLog.slice(-TREND_WEEKS);
    var tags = td.tags || [];
    var n2 = snaps2.filter(function(s){
      return Object.keys(s.items).some(function(k){
        return tags.indexOf(k.toUpperCase()) >= 0 && s.items[k].status === wantStatus;
      });
    }).length;
    return {n: n2, total: snaps2.length};
  }
  if (td.grid.id === 'tgrid' && cellId === 'b-notmet' && etoLog.length && td.tags && td.tags.indexOf('AUTH') >= 0) {
    var authKey = td.label.replace(/\s+/g,'');
    var authMin = AUTH_MIN[td.label];
    var snaps3 = etoLog.slice(-TREND_WEEKS);
    var n3 = snaps3.filter(function(s){ return (s.auths[authKey]||0) < authMin; }).length;
    return {n: n3, total: snaps3.length};
  }
  return null;
}

// Open the detail modal listing the tiles behind a clicked banner stat.
// Clicking a row jumps to and briefly highlights that tile on the board.
function showTileListModal(title, tiles, cellId) {
  document.getElementById('detail-title').textContent = title;
  var sub = document.getElementById('detail-sub');
  var tbl = document.getElementById('detail-table');
  sub.innerHTML = '';
  tbl.innerHTML = '';

  if (!tiles || !tiles.length) {
    tbl.innerHTML = '<tr><td><div class="detail-empty">No tiles found for this stat.</div></td></tr>';
    document.getElementById('detail-modal').classList.add('vis');
    return;
  }

  var rows = '<tr><th>Item</th><th>Status</th><th>Detail</th><th>Last '+TREND_WEEKS+' Weeks</th></tr>';
  tiles.forEach(function(td){
    var s = TILE_STATUS[td.status] || {label:td.status, color:'var(--muted)'};
    var badgeEl = td.el.querySelector('.mbadge');
    var detail = badgeEl ? badgeEl.textContent.trim() : '';
    var hist = cellId ? tileWeekHistory(td, cellId) : null;
    var trendCell;
    if (!hist) {
      trendCell = '<span style="color:var(--muted);">—</span>';
    } else {
      var ratio = hist.total ? hist.n / hist.total : 0;
      var col = ratio >= .5 ? 'var(--red)' : ratio > 0 ? 'var(--amber)' : 'var(--green)';
      trendCell = '<span style="color:'+col+';font-weight:700;">'+hist.n+' / '+hist.total+'</span> wks';
    }
    rows += '<tr class="dt-row" style="cursor:pointer;">'+
      '<td>'+esc(td.label)+'</td>'+
      '<td><div class="dt-status"><div class="dot" style="background:'+s.color+'"></div>'+esc(s.label)+'</div></td>'+
      '<td class="dt-note">'+esc(detail)+'</td>'+
      '<td>'+trendCell+'</td>'+
    '</tr>';
  });
  tbl.innerHTML = rows;

  Array.from(tbl.querySelectorAll('tr.dt-row')).forEach(function(tr, i){
    tr.addEventListener('click', function(){
      closeDetailModal();
      var el = tiles[i].el;
      el.scrollIntoView({behavior:'smooth', block:'center'});
      el.classList.remove('tile-flash'); void el.offsetWidth; el.classList.add('tile-flash');
    });
  });

  document.getElementById('detail-modal').classList.add('vis');
}

document.addEventListener('keydown', function(e){
  if (e.key === 'Escape') { closeDetailModal(); closeEmailModal(); closeTrendDetail(); }
});
