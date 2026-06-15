// ── ATGL TRACKING ──
function parseAtgl(wb) {
  var ws = wb.Sheets['ATGL Tracking'];
  var atgls = [];
  if (!ws) return atgls;
  var rows = XLSX.utils.sheet_to_json(ws, {header:1, defval:null});
  var currentType = 'NG';
  for (var i = 0; i < rows.length; i++) {
    var r = rows[i];
    // Col A marks type: 'NG' or 'Legacy'
    if (r[0] && /^NG$/i.test(String(r[0]).trim())) currentType = 'NG';
    if (r[0] && /^Legacy$/i.test(String(r[0]).trim())) currentType = 'Legacy';
    // Col B = serial (Ser #XXX or CF XXX) — identifies a new unit
    var serial = r[1] ? String(r[1]).trim() : null;
    if (!serial || !/^(Ser\s*#|CF\s)/i.test(serial)) continue;
    serial = serial.replace(/\s+/g, ' ').trim();
    var cond  = r[2] ? String(r[2]).trim() : '';
    var loc   = r[3] ? String(r[3]).trim() : '';
    var hours = r[4] !== null && r[4] !== undefined ? Number(r[4]) : null;
    var comment = r[11] ? String(r[11]).replace(/\n/g,' ').trim() : '';
    // Collect inspection rows (450h row is the same row; subsequent rows have F=5000h, 5 year)
    var inspections = [];
    for (var k = i; k <= i+3 && k < rows.length; k++) {
      var ir = rows[k];
      var itype = ir[5] ? String(ir[5]).trim() : null;
      var idue  = ir[6] !== null && ir[6] !== undefined ? ir[6] : null;
      var irem  = ir[7] !== null && ir[7] !== undefined ? ir[7] : null;
      if (itype) {
        var dueStr = '';
        if (idue instanceof Date) {
          dueStr = fmtDateCell(idue);
        } else if (idue) { dueStr = String(idue).trim(); }
        var remNum = irem !== null ? Number(irem) : NaN;
        inspections.push({type: itype, due: dueStr, remaining: isNaN(remNum) ? null : Math.round(remNum)});
      }
    }
    atgls.push({serial, type: currentType, cond: nc(cond) || (cond?'uns':'svc'), loc, hours, inspections, comment});
  }
  return atgls;
}

// Empty readiness-stats accumulator. Returned by the SERC tile builders so buildBoard
// can fold their counts into the banner from a single source of truth (the tiles).
function _zeroStats(){ return {total:0, met:0, atmin:0, notmet:0, uns:0, cal:0, totalSvc:0, totalMin:0}; }

function buildAtglSection(atgls) {
  var ag = document.getElementById('atglgrid');
  var al = document.getElementById('atgllbl');
  _tileData = _tileData.filter(function(td){ return td.grid !== ag; });
  ag.innerHTML = '';
  if (!atgls || !atgls.length) { al.style.display='none'; document.getElementById('atgllbl-sum').textContent=''; return _zeroStats(); }
  al.style.display = '';
  var today = new Date();
  var st = _zeroStats();
  ATGLRULES.forEach(function(rule) {
    var units = atgls.filter(function(a){ return a.type === rule.type; });
    if (!units.length) return;
    var svc = units.filter(function(a){ return a.cond === 'svc'; }).length;
    var uns = units.filter(function(a){ return a.cond === 'uns'; }).length;
    var cal = units.filter(function(a){ return a.cond === 'cal'; }).length;
    var total = units.length;
    // No established minimum — band by % serviceable of the whole fleet: >=80% SERV, 50-79% AT MIN, <50% U/S
    var pct = total > 0 ? (svc / total) * 100 : 100;
    var status = pct >= 80 ? 'ok' : pct >= 50 ? 'atmin' : 'warn';
    var tclass = status==='warn' ? 'twn' : status==='atmin' ? 'tex' : 'tok';
    var bclass = status==='warn' ? 'nmet' : status==='atmin' ? 'ext' : 'met';
    var btext  = svc+'/'+total+' SVC · '+Math.round(pct)+'%';
    var chips = '';
    if (svc>0) chips += mkchip('svc', svc+' Svc');
    if (uns>0) chips += mkchip('uns', uns+' U/S');
    if (cal>0) chips += mkchip('cal', cal+' Cal');
    // Check for inspections overdue or due within 30 days
    var warnInsp = [];
    units.forEach(function(a){
      a.inspections.forEach(function(ins){
        if (ins.remaining !== null && ins.remaining <= 30) {
          warnInsp.push(a.serial+' '+ins.type+(ins.remaining<0?' OVERDUE':' due in '+ins.remaining+'h/d'));
        }
      });
    });
    if (warnInsp.length) chips += mkchip('cal', warnInsp.length+' Insp');
    var noteLines = units.map(function(a){
      var parts = [a.serial, a.loc||'', a.cond.toUpperCase()];
      if (a.hours!==null) parts.push(Math.round(a.hours)+'h');
      if (a.comment) parts.push(a.comment.substring(0,40));
      return parts.filter(Boolean).join(' · ');
    });
    var tnote = noteLines.slice(0,3).join(' | ');
    var el = mkTileEl({className:tclass, name:rule.tile, badgeClass:bclass, badgeText:btext, chips:chips, note:tnote});
    el.classList.add('clickable');
    if (status==='ok' && uns===0 && cal===0) { el.setAttribute('data-green-hidden','1'); el.style.display='none'; }
    (function(_units, _rule, _warnInsp){
      el.addEventListener('click', function(){
        var items = _units.map(function(a){
          var lines = [a.serial+' — '+a.cond.toUpperCase()+(a.loc?' @ '+a.loc:'')+(a.hours!==null?' · '+Math.round(a.hours)+'h':'')];
          a.inspections.forEach(function(ins){
            var flag = ins.remaining!==null && ins.remaining<=30 ? (ins.remaining<0?' ⚠ OVERDUE':' ⚠ DUE SOON') : '';
            lines.push('  '+ins.type+': due '+ins.due+(ins.remaining!==null?' ('+ins.remaining+' rem)':'')+flag);
          });
          if (a.comment) lines.push('  Note: '+a.comment);
          return {item: lines.join('\n'), status: a.cond==='uns'?'uns':a.cond==='cal'?'cal':'svc', loc:a.loc, notes:''};
        });
        showDetailModal(_rule.tile, items, 'equip');
      });
    })(units, rule, warnInsp);
    ag.appendChild(el);
    _tileData.push({el:el, rule:null, c:{uns:uns, cal:cal+(warnInsp.length>0?1:0), dep:0}, status:status, grid:ag, label:rule.tile, tags:[rule.tile.toUpperCase(), rule.type.toUpperCase()]});
    st.total++; st.uns += uns; st.cal += cal+(warnInsp.length>0?1:0);
    st.totalSvc += svc; st.totalMin += total; // readiness score = serviceable / fleet size
    if (status==='warn') st.notmet++; else if (status==='atmin') st.atmin++; else st.met++;
  });
  applyAfsoGreenHide();
  summarizeGrid('atglgrid','atgllbl-sum');
  var atglSum = document.getElementById('atgllbl-sum');
  if (atglSum.textContent) atglSum.textContent = 'ATGLs: ' + atglSum.textContent;
  return st;
}

// ── PALLETIZED SEAT TRACKING ──
function parsePallets(wb) {
  var ws = wb.Sheets['Palletized Seat Tracking'];
  var pallets = [];
  if (!ws) return pallets;
  var rows = XLSX.utils.sheet_to_json(ws, {header:1, defval:null});
  // Header at row containing 'Pallet #' in col A (not the summary 'Pallet Status' row)
  var hdrIdx = -1;
  for (var i=18; i<30; i++) {
    if (rows[i] && rows[i][0] && /pallet\s*#/i.test(String(rows[i][0]))) { hdrIdx = i; break; }
  }
  if (hdrIdx < 0) return pallets;
  var today = new Date();
  for (var j = hdrIdx+1; j < rows.length; j++) {
    var r = rows[j];
    var palNum = r[0] !== null && r[0] !== undefined ? String(r[0]).trim() : null;
    if (!palNum || /^(SPARE|LSAS)/i.test(palNum)) break;
    if (!/^\d/.test(palNum)) continue; // skip any non-numeric label rows
    var seatType = r[1] !== null && r[1] !== undefined ? String(r[1]).trim() : '';
    var status   = r[2] ? String(r[2]).trim() : '';
    var loc      = r[3] ? String(r[3]).trim() : '';
    var lpSN     = r[4] ? String(r[4]).trim() : '';
    var eposDue  = r[6] instanceof Date ? r[6] : null;
    var lpDue    = r[8] instanceof Date ? r[8] : null;
    var comment  = r[9] ? String(r[9]).replace(/\n/g,' ').trim() : '';
    var cond = nc(status) || 'svc';
    // EPOS overdue = treat as cal even if unit is S
    var eposOverdue = eposDue && eposDue < today;
    pallets.push({palNum, seatType, cond, loc, lpSN, eposDue, lpDue, eposOverdue, comment, eposDueStr: fmtDateCell(eposDue), lpDueStr: fmtDateCell(lpDue)});
  }
  return pallets;
}

function buildPalletsSection(pallets) {
  var ag = document.getElementById('atglgrid');
  var al = document.getElementById('atgllbl');
  if (!pallets || !pallets.length) { document.getElementById('palletlbl-sum').textContent=''; return _zeroStats(); }
  al.style.display = '';
  var st = _zeroStats();

  // One combined tile across all (non-spare) pallets — no established minimum, so band by
  // % serviceable of the whole fleet: >=80% SERV, 50-79% AT MIN, <50% U/S.
  var svc      = pallets.filter(function(p){ return p.cond==='svc' && !p.eposOverdue; }).length;
  var uns      = pallets.filter(function(p){ return p.cond==='uns'; }).length;
  var eposWarn = pallets.filter(function(p){ return p.eposOverdue && p.cond!=='uns'; }).length;
  var total    = pallets.length;
  var pct = total > 0 ? (svc / total) * 100 : 100;
  var status = pct >= 80 ? 'ok' : pct >= 50 ? 'atmin' : 'warn';
  var tclass = status==='warn'?'twn':status==='atmin'?'tex':'tok';
  var bclass = status==='warn'?'nmet':status==='atmin'?'ext':'met';
  var btext  = svc+'/'+total+' SVC · '+Math.round(pct)+'%';
  var chips  = '';
  if (svc>0)      chips += mkchip('svc', svc+' Svc');
  if (uns>0)      chips += mkchip('uns', uns+' U/S');
  if (eposWarn>0) chips += mkchip('cal', eposWarn+' EPOS OD');
  var noteLines = pallets.map(function(p){
    var parts = ['#'+p.palNum, p.seatType?p.seatType+'-seat':'', p.cond.toUpperCase(), p.loc];
    if (p.eposOverdue) parts.push('EPOS OVERDUE '+p.eposDueStr);
    else if (p.eposDueStr) parts.push('EPOS due '+p.eposDueStr);
    if (p.comment) parts.push(p.comment.substring(0,30));
    return parts.filter(Boolean).join(' · ');
  });
  var tnote = noteLines.slice(0,3).join(' | ');
  if (noteLines.length>3) tnote += ' …';
  var el = mkTileEl({className:tclass, name:'Palletized Seats', badgeClass:bclass, badgeText:btext, chips:chips, note:tnote});
  el.classList.add('clickable');
  if (status==='ok' && uns===0 && eposWarn===0) { el.setAttribute('data-green-hidden','1'); el.style.display='none'; }
  (function(_units){
    el.addEventListener('click', function(){
      var items = _units.map(function(p){
        var parts = ['Pallet #'+p.palNum+(p.seatType?' ('+p.seatType+'-seat)':'')+' — '+p.cond.toUpperCase()+(p.loc?' @ '+p.loc:'')];
        if (p.lpSN) parts.push('LP S/N: '+p.lpSN);
        if (p.eposDueStr) parts.push('EPOS Due: '+p.eposDueStr+(p.eposOverdue?' ⚠ OVERDUE':''));
        if (p.lpDueStr)   parts.push('LP Due: '+p.lpDueStr);
        if (p.comment)    parts.push('Note: '+p.comment);
        return {item: parts.join(' · '), status: p.cond==='uns'?'uns':p.eposOverdue?'cal':'svc', loc:p.loc, notes:''};
      });
      showDetailModal('Palletized Seats', items, 'equip');
    });
  })(pallets);
  ag.appendChild(el);
  _tileData.push({el:el, rule:null, c:{uns:uns, cal:eposWarn, dep:0}, status:status, grid:ag, label:'Palletized Seats', tags:['PALLET','PALLETIZED SEATS']});
  st.total = 1; st.uns = uns; st.cal = eposWarn;
  st.totalSvc = svc; st.totalMin = total; // readiness score = serviceable / fleet size
  if (status==='warn') st.notmet = 1; else if (status==='atmin') st.atmin = 1; else st.met = 1;

  applyAfsoGreenHide();
  document.getElementById('palletlbl-sum').textContent = '/ Pallets: ' + svc+'/'+total+' serviceable ('+Math.round(pct)+'%)';
  return st;
}

// Render the top banner for whichever office is selected in #boardsec, falling back
// to the first office with data if the selected one hasn't been loaded yet.
// Collapse/expand a Board section (SERC/AFSO/ETO group) by toggling its header class —
// the matching .grid is hidden via the adjacent-sibling CSS rule.
function toggleSection(el) {
  el.classList.toggle('collapsed');
}
// Build a short "N items · N below min · N at min" summary for a section header
// based on the tile classes already rendered into its grid.
function summarizeGrid(gridId, sumId) {
  var grid = document.getElementById(gridId), sum = document.getElementById(sumId);
  if (!grid || !sum) return;
  var tiles = grid.querySelectorAll(':scope > .tile');
  if (!tiles.length) { sum.textContent = ''; return; }
  // .twn = below min; [data-shortfall] = ETO auth tiles below minimum manning (styled neutral, not .twn)
  var below = grid.querySelectorAll(':scope > .tile.twn, :scope > .tile[data-shortfall]').length;
  var atmin = grid.querySelectorAll(':scope > .tile.tex').length;
  var txt = tiles.length + (tiles.length===1 ? ' item' : ' items');
  var bits = [];
  if (below) bits.push(below + ' below min');
  if (atmin) bits.push(atmin + ' at min');
  txt += '  ·  ' + (bits.length ? bits.join('  ·  ') : 'all OK');
  sum.textContent = txt;
}

// Called when the user manually changes the View Section dropdown — locks out auto-switching.
function onSectionChange() {
  _userPickedSection = true;
  renderBanner();
  var sel = document.getElementById('boardsec');
  if (sel && sel.value) focusOffice(sel.value);
}

// Point the View Section dropdown at a freshly-loaded office, but only when it won't
// surprise the user: never once they've picked a section themselves, and never when the
// current view already shows an office with data. This shows the first-loaded office and
// then leaves the view put, instead of letting load order silently hijack what's on screen.
function autoSelectSection(sec) {
  var selEl = document.getElementById('boardsec');
  if (!selEl || _userPickedSection) return;
  var cur = selEl.value;
  if (cur === sec) return;          // already showing it
  if (_bannerStats[cur]) return;    // current view has data — don't yank it away
  selEl.value = sec;
}

function renderBanner() {
  var sel = document.getElementById('boardsec');
  var avail = { serc: !!_bannerStats.serc, afso: !!_bannerStats.afso, eto: !!_bannerStats.eto };
  Array.from(sel.options).forEach(function(opt){ opt.disabled = !avail[opt.value]; });
  var sec = sel.value;
  if (!avail[sec]) {
    var fallback = ['serc','afso','eto'].find(function(k){ return avail[k]; });
    if (fallback) { sec = fallback; sel.value = fallback; }
  }
  var stats = _bannerStats[sec];
  document.getElementById('banner-title').textContent = stats ? stats.label : 'No Data Loaded';
  var cellIds = ['b-total','b-score','b-met','b-atmin','b-notmet','b-uns','b-cal'];
  var gaugeColors = { ok: 'var(--green)', amb: 'var(--amber)', bad: 'var(--red)', blu: 'var(--bluhi)' };
  cellIds.forEach(function(id, i){
    var ref = _dom.banner[id];
    var numEl = ref.num, lblEl = ref.lbl;
    if (!stats) {
      numEl.textContent = '—'; numEl.className = 'bnum blu';
      if (ref.cell) ref.cell.classList.remove('clickable');
      if (id === 'b-score') {
        _dom.scoreGauge.style.setProperty('--pct', 0);
        _dom.scoreGauge.style.setProperty('--gauge-color', gaugeColors.blu);
      }
      return;
    }
    var c = stats.cells[i];
    numEl.textContent = c.value;
    numEl.className = 'bnum ' + c.cls;
    lblEl.textContent = c.label;
    if (ref.cell) {
      var dd = BANNER_DRILLDOWN[sec] && BANNER_DRILLDOWN[sec][id];
      ref.cell.classList.toggle('clickable', !!dd);
    }
    if (id === 'b-score') {
      var pct = parseInt(c.value, 10);
      if (isNaN(pct)) pct = 0;
      _dom.scoreGauge.style.setProperty('--pct', Math.min(100, pct));
      _dom.scoreGauge.style.setProperty('--gauge-color', gaugeColors[c.cls] || gaugeColors.blu);
    }
  });
  // Keep the hub cards and the drilled-in switcher in step with freshly-parsed data.
  if (_boardView === 'hub') renderHub();
  updateDrillSwitch(sec);
}

// Grids belonging to each section's tile registry, used by banner drill-down.
var GRID_SECTIONS = { serc:['agrid','vgrid','atglgrid'], afso:['lgrid','sgrid'], eto:['tgrid'] };
// Section header (.slbl) ids per office, used to focus the board on one office.
var SECTION_LABELS = { serc:['albl','vlbl','atgllbl'], afso:['llbl','sllbl'], eto:['tlbl'] };

// Per-section, per-banner-cell filters used to drill down from a banner stat into the matching tiles.
var BANNER_DRILLDOWN = {
  serc: {
    'b-atmin':  function(td){ return td.status==='atmin'; },
    'b-notmet': function(td){ return td.status==='warn'; },
    'b-uns':    function(td){ return td.c && td.c.uns>0; },
    'b-cal':    function(td){ return td.c && td.c.cal>0; },
  },
  afso: {
    'b-atmin':  function(td){ return td.status==='atmin'; },
    'b-notmet': function(td){ return td.status==='warn'; },
    'b-uns':    function(td){ return td.c && td.c.uns>0; },
    'b-cal':    function(td){ return td.c && td.c.cal>0; },
  },
  eto: {
    'b-notmet': function(td){ return td.tags && td.tags.indexOf('AUTH')>=0; },
  }
};

// Click handler for clickable banner cells — shows the tiles behind that stat.
function bannerCellClick(cellId) {
  var sel = document.getElementById('boardsec');
  var sec = sel.value;
  var stats = _bannerStats[sec];
  var dd = stats && BANNER_DRILLDOWN[sec] && BANNER_DRILLDOWN[sec][cellId];
  if (!dd) return;
  var grids = GRID_SECTIONS[sec] || [];
  var tiles = _tileData.filter(function(td){
    return grids.indexOf(td.grid.id) >= 0 && dd(td);
  });
  var ref = _dom.banner[cellId];
  var title = (stats.label.split('—')[0].trim() || sec.toUpperCase()) + ' — ' + ref.lbl.textContent;
  showTileListModal(title, tiles, cellId);
}

// AFSO banner stats — stock levels vs minimum across fluids + sealants
function computeAfsoBanner() {
  var items = (_liqData||[]).concat(_sealData||[]);
  if (!items.length) { _bannerStats.afso = null; return; }
  var totalSvc=0, totalMin=0, above=0, at=0, below=0, uns=0, low=0;
  items.forEach(function(d){
    if (d.status==='uns') uns++;
    if (d.status==='low') low++;
    if (d.min!==null && !isNaN(d.min)) {
      var qty = d.qty!==null ? d.qty : 0;
      totalSvc += Math.min(qty, d.min); totalMin += d.min;
      if (qty>d.min) above++; else if (qty===d.min) at++; else below++;
    }
  });
  var score = totalMin>0 ? Math.round(totalSvc/totalMin*100) : null;
  _bannerStats.afso = {
    label: 'AFSO — Fluids & Sealants Stock Overview',
    cells: [
      {label:'Tracked Items', value: items.length, cls:'blu'},
      {label:'Stock Score',   value: score===null?'—':score+'%', cls: score===null?'blu':(score>=100?'ok':score>=75?'amb':'bad'), score:true},
      {label:'Above Min',     value: above, cls:'ok'},
      {label:'At Min',        value: at,    cls:'amb'},
      {label:'Below Min',     value: below, cls:'bad'},
      {label:'Unserviceable', value: uns,   cls:'amb'},
      {label:'Low Stock',     value: low,   cls:'amb'},
    ]
  };
}

// ETO banner stats — career-level breakdown plus authorisation manning
function computeEtoBanner() {
  if (!_trainData || !_trainData.length) { _bannerStats.eto = null; return; }
  var lvl = levelCounts(_trainData);
  var total = _trainData.length;
  var score = total>0 ? Math.round(lvl.as/total*100) : null;
  var aboveAuth=0, atAuth=0, belowAuth=0;
  Object.keys(AUTH_MIN).forEach(function(auth){
    var min = AUTH_MIN[auth];
    var count = authCount(auth);
    if (count>min) aboveAuth++; else if (count===min) atAuth++; else belowAuth++;
  });
  _bannerStats.eto = {
    label: 'ETO — Training & Qualifications Overview',
    cells: [
      {label:'Personnel Tracked',    value: total, cls:'blu'},
      {label:'Qualification Score',  value: score===null?'—':score+'%', cls: score===null?'blu':(score>=75?'ok':score>=50?'amb':'bad'), score:true},
      {label:'C-Rel',                value: lvl.crel, cls:'ok'},
      {label:'Level A',              value: lvl.lvla, cls:'ok'},
      {label:'POM / Apprentice',     value: lvl.pom+lvl.app, cls:'amb'},
      {label:'Auths Below Min',      value: belowAuth, cls:'bad'},
      {label:'Auths At/Above Min',   value: aboveAuth+atAuth, cls:'amb'},
    ]
  };
}

function mkchip(type, label) {
  return '<div class="chip '+type+'"><div class="dot"></div>'+label+'</div>';
}

function esc(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

// Split badge text: if it matches "N/M LABEL" or "N LABEL", render the number large and the label small.
function badgeSplitHtml(text) {
  var m = text ? String(text).match(/^(\d+\/\d+|\d+)\s*(.*)$/) : null;
  if (!m) return text || '';
  return '<span style="font-size:22px;font-weight:800;line-height:1;">'+m[1]+'</span>'+(m[2]?'<span style="font-size:11px;font-weight:700;letter-spacing:1px;margin-left:3px;opacity:.8;">'+m[2]+'</span>':'');
}
