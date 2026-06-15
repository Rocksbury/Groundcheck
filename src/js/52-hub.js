// ── SECTION HUB ──
// Board landing: one tile per office (SERC / AFSO / ETO) showing that office's readiness
// rollup, read straight from _bannerStats (already computed during parse). Click a tile —
// or press 1/2/3 — to drill into that office's board; the logo, the breadcrumb, or 0 returns
// here. Drilled-in rendering is unchanged: the hub is a layer in front, toggled by the
// .board-hub class on #page-board.
//
// Each office's _bannerStats.cells differ in layout, so we map the few cells the card shows
// by index: cells[1] is always the score cell (score:true); `stats` lists which other cells
// to surface under the gauge.
var HUB_OFFICES = [
  { sec:'serc', sub:'EQUIPMENT & VEHICLES',      stats:[0,4,5] },  // Tracked, Below Min, Unserviceable
  { sec:'afso', sub:'FLUIDS & SEALANTS',         stats:[0,4,5] },  // Tracked, Below Min, Unserviceable
  { sec:'eto',  sub:'TRAINING & AUTHORIZATIONS', stats:[0,3,5] }   // Personnel, Level A, Auths Below Min
];
// status class (ok/amb/bad/blu) -> theme colour variable name
var HUB_GCOL = { ok:'green', amb:'amber', bad:'red', blu:'bluhi' };

function renderHub() {
  var grid = document.getElementById('hub-grid');
  if (!grid) return;
  var html = '', scoreSum = 0, scoreN = 0;
  HUB_OFFICES.forEach(function(o){
    var stats = _bannerStats[o.sec];
    if (!stats) {
      // No data for this office yet — a dashed "awaiting data" card that loads on click.
      html += '<button class="shub-card nodata" onclick="document.getElementById(\'fi\').click()">'
            +   '<div class="shub-head"><span class="shub-name">'+o.sec.toUpperCase()+'</span><span class="shub-arrow">&#8250;</span></div>'
            +   '<div class="shub-sub">'+o.sub+'</div>'
            +   '<div class="shub-empty-body"><span class="eglyph">&#8682;</span><div>AWAITING DATA<br>Load the spreadsheet</div></div>'
            +   '<div class="shub-foot">No data loaded</div>'
            + '</button>';
      return;
    }
    var sc = stats.cells[1];                       // score cell
    var pct = parseInt(sc.value, 10);
    var hasPct = !isNaN(pct);
    if (hasPct) { scoreSum += pct; scoreN++; }
    var gcol = sc.cls;                              // ok / amb / bad / blu
    var rows = o.stats.map(function(i){
      var c = stats.cells[i]; if (!c) return '';
      var vcls = c.cls==='bad' ? ' bad' : c.cls==='amb' ? ' amb' : '';
      return '<div>'+c.label+' <span class="v'+vcls+'">'+c.value+'</span></div>';
    }).join('');
    html += '<button class="shub-card '+gcol+'" onclick="setView(\''+o.sec+'\')">'
          +   '<div class="shub-head"><span class="shub-name">'+o.sec.toUpperCase()+'</span><span class="shub-arrow">&#8250;</span></div>'
          +   '<div class="shub-sub">'+o.sub+'</div>'
          +   '<div class="shub-body">'
          +     '<div class="gauge" style="--pct:'+(hasPct?Math.min(100,pct):0)+';--gauge-color:var(--'+(HUB_GCOL[gcol]||'bluhi')+');"><div class="gauge-inner"><div class="bnum '+gcol+'">'+sc.value+'</div></div></div>'
          +     '<div class="shub-stats">'+rows+'</div>'
          +   '</div>'
          +   '<div class="shub-foot">'+sc.label+'</div>'
          + '</button>';
  });
  grid.innerHTML = html;

  // Unit-readiness summary line: mean of the offices that have a numeric score.
  var us = document.getElementById('ur-score'), usub = document.getElementById('ur-sub');
  if (us) {
    if (scoreN) {
      var avg = Math.round(scoreSum / scoreN);
      us.textContent = avg + '%';
      us.className = 'ur-score ' + (avg>=90?'ok':avg>=75?'amb':'bad');
      usub.textContent = '· ' + scoreN + ' of 3 offices loaded';
    } else {
      us.textContent = '—'; us.className = 'ur-score blu';
      usub.textContent = 'no data loaded';
    }
  }
}

// Return to the hub from anywhere (logo click, breadcrumb, 0 key).
function showHub() {
  _boardView = 'hub';
  var bp = document.getElementById('page-board');
  if (bp) {
    if (!bp.classList.contains('on')) {
      var tab = document.querySelector('.tabs .tab');
      if (tab) gotoPage('board', tab);
    }
    bp.classList.add('board-hub');
  }
  renderHub();
}

// Sync the drilled-in office switcher: highlight the current office, disable any without data.
function updateDrillSwitch(sec) {
  var sw = document.getElementById('dsec-switch');
  if (!sw) return;
  Array.prototype.forEach.call(sw.querySelectorAll('button'), function(b){
    var s = b.getAttribute('data-sec');
    b.classList.toggle('on', s === sec);
    b.disabled = !_bannerStats[s];
  });
}

// Land on the hub once the DOM is ready. A saved-report autoload (fires on window 'load',
// after this) repopulates the cards through renderBanner -> renderHub, so it stays on the hub.
document.addEventListener('DOMContentLoaded', function(){ showHub(); });
