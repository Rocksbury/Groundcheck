// ── STATE ──
var snap = null;
var log  = [];
var afsoLog = [];
var etoLog  = [];
var _bannerStats = { serc: null, afso: null, eto: null };
var _filterActive = false;
var _activeFilter = 'all';
var _tileData     = []; // [{el, rule, c, status}] for re-sort/filter
// Once the user manually changes the View Section dropdown, never auto-switch it again.
var _userPickedSection = false;
// Board view: 'hub' shows the office-tile landing; 'serc'/'afso'/'eto' is drilled into an office.
var _boardView = 'hub';
var _selectMode = false;
var _overview = []; // [{gridId, label, notes, source, img}] — items pinned to the Overview tab
var _trendData = []; // [{el, gridId, label, chart}] for the currently-rendered Trends charts (pin source)
var _overviewNote = {date:'', body:'', author:''}; // shared meeting memo on the Overview tab

// ── LOAD FRESHNESS ──
// Timestamp each office's data was last loaded, so the source badges can flag stale data.
var _loadTimes = { serc: null, afso: null, eto: null };
var _sercRenderTimer = 0;
var STALE_HOURS = 24;

// ── CACHED DOM REFS ──
// Frequently-accessed elements, looked up once instead of on every render.
var _dom = {
  searchInput: document.getElementById('search-input'),
  fstat:       document.getElementById('fstat'),
  srcEquip:    document.getElementById('src-equip'),
  srcLiq:      document.getElementById('src-liq'),
  srcTrain:    document.getElementById('src-train'),
  banner: {}
};
['b-total','b-score','b-met','b-atmin','b-notmet','b-uns','b-cal'].forEach(function(id){
  var numEl = document.getElementById(id);
  var cellEl = numEl.closest('.bcell');
  _dom.banner[id] = {
    num: numEl,
    cell: cellEl,
    lbl: (id === 'b-score') ? document.getElementById('b-score-lbl') : numEl.parentElement.querySelector('.blbl')
  };
  cellEl.addEventListener('click', function(){ bannerCellClick(id); });
});
_dom.scoreGauge = document.getElementById('b-score-gauge');
