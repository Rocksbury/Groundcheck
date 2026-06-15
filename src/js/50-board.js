// ── BUILD BOARD ──
function buildBoard(amse, vehs, mnotes, fname, atgls, pallets) {
  var ag = document.getElementById('agrid');
  var vg = document.getElementById('vgrid');
  ag.innerHTML = ''; vg.innerHTML = '';
  ['albl','vlbl','snapbtn','filter-group'].forEach(function(id){
    document.getElementById(id).style.display='';
  });
  updatePrintBtn();

  // Reset filter state on new load (keep AFSO/ETO tile registrations intact)
  var _oldTiles = _tileData.filter(function(td){ return td.grid === ag || td.grid === vg; });
  _tileData = _tileData.filter(function(td){ return td.grid !== ag && td.grid !== vg; });
  _activeFilter = 'all';
  document.querySelectorAll('.fbtn[data-f]').forEach(function(b){ b.classList.toggle('on', b.dataset.f==='all'); });
  if (_dom.searchInput) _dom.searchInput.value = '';
  resetAfsoGreenHide();
  // Restore visibility on any tiles hidden by previous search/filter
  _oldTiles.forEach(function(td){ td.el.style.display = ''; });

  var total=0, met=0, atmin=0, notmet=0, tuns=0, tcal=0;
  var snapcounts = {};
  var warnings = [];
  var totalSvc=0, totalMin=0; // for readiness score

  if (!amse.length) warnings.push('Sheet "Critical AMSE Min Max List" not found or returned no readable rows \u2014 AMSE tiles will show zero.');
  if (!vehs.length) warnings.push('Sheet "Vehicle List" not found or returned no readable rows \u2014 Vehicle tiles will show zero.');

  function section(rules, items, grid) {
    rules.forEach(function(rule) {
      var matched = match(items, rule.kw, rule.exclude||[]);
      var c = count(matched);
      snapcounts[rule.key] = c;
      var svc = c.svc, min = rule.min;
      totalSvc += Math.min(svc, min); totalMin += min;
      var below = svc < min, exact = svc === min;
      var status = below ? 'warn' : exact ? 'atmin' : 'ok';
      var tclass = below ? 'twn' : exact ? 'tex' : 'tok';
      var bclass = below ? 'nmet' : exact ? 'ext' : 'met';
      var btext  = svc+'/'+min+' '+(below ? 'BELOW MIN' : exact ? 'AT MIN' : 'MIN MET');
      var nk = Object.keys(mnotes).find(function(k){ return rule.kw.some(function(kw){ return k.indexOf(kw) >= 0 || kw.indexOf(k) >= 0; }); });
      var tnote = nk ? mnotes[nk] : '';
      if (tnote.length > 120) tnote = tnote.slice(0,117)+'\u2026';
      var chips = '';
      if (below || exact) chips += mkchip('svc', svc+' Serviceable');
      if (c.uns > 0) chips += mkchip('uns', c.uns+' Unserviceable');
      if (c.cal > 0) chips += mkchip('cal', c.cal+' Cal / Insp');
      if (c.dep > 0) chips += mkchip('dep', c.dep+' Deployed');

      var el = document.createElement('div');
      var hasDetail = c.uns > 0 || c.cal > 0 || c.dep > 0;
      el.className = 'tile '+tclass+(hasDetail?' hoverable':'');
      el.innerHTML =
        '<div class="thead">' +
          '<div class="tname">'+rule.tile+'</div>' +
          '<div class="mbadge '+bclass+'">'+badgeSplitHtml(btext)+'</div>' +
        '</div>' +
        (chips ? '<div class="chips">'+chips+'</div>' : '') +
        (tnote ? '<div class="tnote">'+esc(tnote)+'</div>' : '');

      if (hasDetail) {
        var _matched = matched, _title = rule.tile;
        el.addEventListener('mouseenter', function(ev){ showPop(ev, _title, _matched); });
        el.addEventListener('mousemove',  function(ev){ movePop(ev); });
        el.addEventListener('mouseleave', hidePop);
      }
      if (matched.length) {
        el.classList.add('clickable');
        (function(_all, _title){
          el.addEventListener('click', function(){ showDetailModal(_title, _all, 'equip'); });
        })(matched, rule.tile);
      }
      // Hide green tiles with no faults — revealed by search, filter, or show-all
      if (status === 'ok' && c.uns === 0 && c.cal === 0 && c.dep === 0) {
        el.setAttribute('data-green-hidden','1');
        el.style.display = 'none';
      }
      grid.appendChild(el);
      _tileData.push({el, rule, c, status, grid: grid, label: rule.tile, tags: rule.kw});
      total++; tuns += c.uns; tcal += c.cal;
      if (below) notmet++; else if (exact) atmin++; else met++;
    });
  }

  section(ARULES, amse, ag);
  section(VRULES, vehs, vg);
  summarizeGrid('agrid', 'albl-sum');
  summarizeGrid('vgrid', 'vlbl-sum');
  // ATGL + Pallet tiles render and return their own readiness stats. Fold them into the
  // SERC totals here so the banner counts come from the same source as the tiles — this
  // is what keeps "Above/At/Below Min" in lock-step with tile colours and the drill-down.
  [buildAtglSection(atgls || []), buildPalletsSection(pallets || [])].forEach(function(s){
    total  += s.total;  met    += s.met;    atmin    += s.atmin;  notmet   += s.notmet;
    tuns   += s.uns;    tcal   += s.cal;    totalSvc += s.totalSvc; totalMin += s.totalMin;
  });

  applyAfsoGreenHide();

  // Banner stats (SERC)
  var score = totalMin > 0 ? Math.round(totalSvc/totalMin*100) : null;
  _bannerStats.serc = {
    label: 'SERC \u2014 Equipment & Vehicle Readiness Overview',
    cells: [
      {label:'Tracked Items',   value: total,                              cls:'blu'},
      {label:'Readiness Score', value: score===null?'\u2014':score+'%',    cls: score===null?'blu':(score>=100?'ok':score>=75?'amb':'bad'), score:true},
      {label:'Above Min',       value: met,    cls:'ok'},
      {label:'At Min',          value: atmin,  cls:'amb'},
      {label:'Below Min',       value: notmet, cls:'bad'},
      {label:'Unserviceable',   value: tuns,   cls:'amb'},
      {label:'Cal / Insp',      value: tcal,   cls:'amb'},
    ]
  };
  _equipStats.total = total; _equipStats.uns = tuns;
  // Show SERC when it's the first office loaded; respect the user's choice otherwise.
  autoSelectSection('serc');
  renderBanner();

  // Warnings
  if (warnings.length) {
    showDataWarning('Data Warning', warnings);
  } else {
    var dwEl = document.getElementById('data-warn'), dwList = document.getElementById('dw-list');
    if (dwList) dwList.innerHTML = '';
    if (dwEl) dwEl.classList.remove('vis');
  }

  // Fstat
  var now = new Date();
  _dom.fstat.textContent = fname+' \u00b7 '+fmtUTCDate(now)+' '+fmtUTCTime(now);

  snap = { date: null, counts: snapcounts };
  var hdr = logHeader();
  document.getElementById('hrow').textContent = hdr.join('\t');

  // Update favicon
  setFavicon(score);

  decoratePins();

  // Re-render after a frame to guarantee the browser has painted the new tile state
  clearTimeout(_sercRenderTimer);
  cancelAnimationFrame(_sercRenderTimer);
  _sercRenderTimer = requestAnimationFrame(function(){
    autoSelectSection('serc');
    renderBanner();
    applyViewState();
  });
}
