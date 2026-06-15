// ── SNAPSHOT ──
function logHeader() {
  var cols = ['Date'];
  ALLRULES.forEach(function(r){ cols.push(r.key+'_svc',r.key+'_uns',r.key+'_cal',r.key+'_dep'); });
  return cols;
}

function takeSnap() {
  if (!snap) { notify('Load the SERC spreadsheet first.', 'warn'); return; }
  var dateVal = todayStr();
  var hdr = logHeader();
  var row = [dateVal];
  ALLRULES.forEach(function(r){
    var c = snap.counts[r.key] || {svc:0,uns:0,cal:0,dep:0};
    row.push(c.svc,c.uns,c.cal,c.dep);
  });
  var text = (log.length===0 ? hdr.join('\t')+'\n' : '') + row.join('\t');
  copyToClipboard(text, document.getElementById('snapbtn'));
}

// AFSO snapshot \u2014 one Qty/Status pair per fluid category and per sealant item
function takeAfsoSnap() {
  if ((!_liqData || !_liqData.length) && (!_sealData || !_sealData.length)) { notify('Load the AFSO spreadsheet first.', 'warn'); return; }
  var hdr = ['Date'], row = [todayStr()];
  (_liqData||[]).concat(_sealData||[]).forEach(function(d){
    hdr.push(d.item+'_qty', d.item+'_status');
    row.push(d.qty!==null ? d.qty : '', d.status.toUpperCase());
  });
  copyToClipboard(hdr.join('\t')+'\n'+row.join('\t'), document.getElementById('afsosnapbtn'));
}

// ETO snapshot \u2014 As/Total per trade plus current Tow Driver / Tow IC counts
function takeEtoSnap() {
  if (!_trainData || !_trainData.length) { notify('Load the ETO spreadsheet first.', 'warn'); return; }
  var hdr = ['Date'], row = [todayStr()];
  var trades = {};
  _trainData.forEach(function(d){ (trades[d.trade] = trades[d.trade]||[]).push(d); });
  Object.keys(trades).sort(function(a,b){
    var ai=TRADE_ORDER.indexOf(a); if(ai<0) ai=99;
    var bi=TRADE_ORDER.indexOf(b); if(bi<0) bi=99;
    return ai-bi || a.localeCompare(b);
  }).forEach(function(trade){
    var lvl = levelCounts(trades[trade]);
    hdr.push(trade+'_As', trade+'_Total');
    row.push(lvl.as, trades[trade].length);
  });
  Object.keys(AUTH_MIN).forEach(function(auth){
    var count = authCount(auth);
    hdr.push(auth.replace(/\s+/g,'')+'_count');
    row.push(count);
  });
  copyToClipboard(hdr.join('\t')+'\n'+row.join('\t'), document.getElementById('etosnapbtn'));
}

// ── LOG PARSE ──
function parseLog(rows) {
  if (rows.length < 2) return [];
  var hdrs = rows[0].map(function(h){ return h ? String(h).trim() : ''; });
  var out = [];
  for (var i=1; i<rows.length; i++) {
    var r=rows[i]; if (!r[0]) continue;
    var dv=r[0];
    var ds=dv instanceof Date ? dv.toISOString().slice(0,10) : String(dv).trim();
    var s={date:ds, counts:{}};
    ALLRULES.forEach(function(rule){
      // Skip rules that weren't logged in this snapshot (added to ALLRULES later) so
      // their charts/chronic-issue calcs don't treat "never tracked" as "always zero".
      var hasCol = ['svc','uns','cal','dep'].some(function(sf){ return hdrs.indexOf(rule.key+'_'+sf) >= 0; });
      if (!hasCol) return;
      s.counts[rule.key]={svc:0,uns:0,cal:0,dep:0};
      ['svc','uns','cal','dep'].forEach(function(sf){
        var col=rule.key+'_'+sf, idx=hdrs.indexOf(col);
        if (idx>=0 && r[idx]!==null) s.counts[rule.key][sf]=Number(r[idx])||0;
      });
    });
    out.push(s);
  }
  return out;
}

// AFSO log parse — generic "<item>_qty" / "<item>_status" column pairs, varies per spreadsheet
function parseAfsoLog(rows) {
  if (rows.length < 2) return [];
  var hdrs = rows[0].map(function(h){ return h ? String(h).trim() : ''; });
  var out = [];
  for (var i=1; i<rows.length; i++) {
    var r=rows[i]; if (!r[0]) continue;
    var dv=r[0];
    var ds=dv instanceof Date ? dv.toISOString().slice(0,10) : String(dv).trim();
    var s={date:ds, items:{}};
    hdrs.forEach(function(h,idx){
      var mq=h.match(/^(.*)_qty$/), ms=h.match(/^(.*)_status$/);
      if (mq) {
        s.items[mq[1]] = s.items[mq[1]] || {};
        s.items[mq[1]].qty = r[idx]!==null ? Number(r[idx]) : null;
      } else if (ms) {
        s.items[ms[1]] = s.items[ms[1]] || {};
        s.items[ms[1]].status = r[idx]!==null ? String(r[idx]).trim() : '';
      }
    });
    out.push(s);
  }
  return out;
}

// ETO log parse — "<trade>_As" / "<trade>_Total" column pairs plus "<auth>_count" columns
function parseEtoLog(rows) {
  if (rows.length < 2) return [];
  var hdrs = rows[0].map(function(h){ return h ? String(h).trim() : ''; });
  var out = [];
  for (var i=1; i<rows.length; i++) {
    var r=rows[i]; if (!r[0]) continue;
    var dv=r[0];
    var ds=dv instanceof Date ? dv.toISOString().slice(0,10) : String(dv).trim();
    var s={date:ds, trades:{}, auths:{}};
    hdrs.forEach(function(h,idx){
      var ma=h.match(/^(.*)_As$/), mt=h.match(/^(.*)_Total$/), mc=h.match(/^(.*)_count$/);
      if (ma) {
        s.trades[ma[1]] = s.trades[ma[1]] || {};
        s.trades[ma[1]].as = r[idx]!==null ? Number(r[idx]) : null;
      } else if (mt) {
        s.trades[mt[1]] = s.trades[mt[1]] || {};
        s.trades[mt[1]].total = r[idx]!==null ? Number(r[idx]) : null;
      } else if (mc) {
        s.auths[mc[1]] = r[idx]!==null ? Number(r[idx]) : null;
      }
    });
    out.push(s);
  }
  return out;
}

// ── TREND HELPERS ──
// Convert a "#RRGGBB" string to "rgba(r,g,b,a)" for chart fill colours.
function hexToRgba(hex, a) {
  hex = (hex||'').replace('#','').trim();
  if (hex.length===3) hex = hex.split('').map(function(c){ return c+c; }).join('');
  if (hex.length!==6) return 'rgba(128,128,128,'+a+')';
  var r=parseInt(hex.slice(0,2),16), g=parseInt(hex.slice(2,4),16), b=parseInt(hex.slice(4,6),16);
  return 'rgba('+r+','+g+','+b+','+a+')';
}

// Resolve the shared status palette + Chart.js theme options from current CSS variables,
// so trend charts follow the same colours/theme as the rest of the UI (light/dark).
function trendChartTheme() {
  var isLight = document.body.classList.contains('light');
  var cs = getComputedStyle(document.body);
  var gridColor = isLight?'rgba(0,0,0,.06)':'rgba(255,255,255,.04)';
  var tickColor = cs.getPropertyValue('--muted').trim()||'#4A6070';
  return {
    isLight: isLight,
    COL: {
      green: cs.getPropertyValue('--green').trim()||'#27AE60',
      red:   cs.getPropertyValue('--red').trim()||'#C0392B',
      amber: cs.getPropertyValue('--amber').trim()||'#E09800',
      blue:  cs.getPropertyValue('--bluhi').trim()||'#2980B9',
    },
    minLineColor: isLight?'rgba(0,0,0,.3)':'rgba(255,255,255,.25)',
    gridColor: gridColor, tickColor: tickColor,
    tooltipOpts: {
      backgroundColor:cs.getPropertyValue('--pop-bg').trim()||'#1C2733',
      titleFont:{family:'Consolas',size:10},bodyFont:{family:'Consolas',size:10},
      borderColor:cs.getPropertyValue('--border').trim()||'#1e2e3d',borderWidth:1,
      titleColor:cs.getPropertyValue('--text').trim()||'#D4E0EA',
      bodyColor:cs.getPropertyValue('--lbl').trim()||'#7A9BB0',
    },
    scaleOpts: {
      x:{grid:{color:gridColor},ticks:{color:tickColor,font:{family:'Consolas',size:9},maxRotation:45}},
      y:{grid:{color:gridColor},ticks:{color:tickColor,font:{family:'Consolas',size:9},stepSize:1},min:0}
    }
  };
}

// Returns a small ▲/▼/— badge comparing the last two non-null values in `arr`.
function deltaBadge(arr) {
  var vals = arr.filter(function(v){ return v!=null; });
  if (vals.length<2) return '';
  var d = vals[vals.length-1] - vals[vals.length-2];
  if (d===0) return '<span class="cc-delta flat" title="No change since previous snapshot">&#8212;</span>';
  var cls = d>0 ? 'up' : 'down', arrow = d>0 ? '&#9650;' : '&#9660;';
  return '<span class="cc-delta '+cls+'" title="Change since previous snapshot">'+arrow+' '+(d>0?'+':'')+d+'</span>';
}

// ── TREND SEARCH & FILTER ──
var _trendFilter = 'all';
var _trendSearchDebounce = null;
function onTrendSearchInput() {
  clearTimeout(_trendSearchDebounce);
  _trendSearchDebounce = setTimeout(applyTrendFilter, 120);
}
function clearTrendSearch() {
  var el = document.getElementById('trend-search');
  if (el) { el.value=''; el.focus(); }
  applyTrendFilter();
}
function setTrendFilter(val, btn) {
  _trendFilter = val;
  document.querySelectorAll('.fbtn[data-tf]').forEach(function(b){ b.classList.toggle('on', b.dataset.tf === val); });
  applyTrendFilter();
}
function clearTrendFilters() {
  var el = document.getElementById('trend-search');
  if (el) el.value='';
  _trendFilter='all';
  document.querySelectorAll('.fbtn[data-tf]').forEach(function(b){ b.classList.toggle('on', b.dataset.tf === 'all'); });
  applyTrendFilter();
}
// Apply the search box + ALL/BELOW MIN filter to the chart cards in the active section's grid.
function applyTrendFilter() {
  var sec = document.getElementById('trendsec').value;
  var gridId = sec==='serc' ? 'cgrid' : sec==='afso' ? 'afsocgrid' : 'etocgrid';
  var grid = document.getElementById(gridId);
  var query = (document.getElementById('trend-search')||{}).value || '';
  query = query.toUpperCase().trim();
  var cards = grid ? grid.querySelectorAll('.cc[data-name]') : [];
  var shown=0;
  cards.forEach(function(c){
    var nameMatch = !query || c.dataset.name.toUpperCase().indexOf(query)>=0;
    var filterMatch = _trendFilter!=='below' || c.dataset.belowmin==='1';
    var show = nameMatch && filterMatch;
    c.style.display = show ? '' : 'none';
    if (show) shown++;
  });
  var clearBtn = document.getElementById('trend-search-clear');
  if (clearBtn) clearBtn.style.display = query ? '' : 'none';
  var countEl = document.getElementById('trend-count');
  var active = !!query || _trendFilter!=='all';
  if (countEl) countEl.textContent = (active && cards.length) ? ('showing ' + shown + ' of ' + cards.length) : '';
  var nm = document.getElementById('trend-no-match');
  if (nm) nm.style.display = (active && shown===0 && cards.length>0) ? '' : 'none';
}

// ── RENDER TRENDS ──
// Dispatcher: shows the selected section's trend panel and renders only that one.
// Shared Trends helpers (used by all three offices to cut duplication).
// Chronic Issues grid — list items are {name, bc, total, pct}.
function chronicGridHtml(list) {
  if (!list.length) return '<div style="font-family:var(--mono);font-size:10px;color:var(--muted);padding:8px 28px;">No items below minimum in '+CHRONIC_MIN_FAILS+'+ snapshots in this period.</div>';
  return list.map(function(d){
    var cls = d.pct>=75 ? '' : 'amb';
    return '<div class="ccard '+cls+'"><div class="cname">'+esc(d.name)+'</div>'+
      '<div class="cstat '+(d.pct<75?'amb':'')+'">Below min <em>'+d.bc+'/'+d.total+'</em> snapshots ('+d.pct+'%)</div></div>';
  }).join('');
}
// Standard Chart.js line-chart options for every trend chart.
function trendOpts(T) {
  return {responsive:true,maintainAspectRatio:false,animation:false,
    plugins:{legend:{display:false},tooltip:T.tooltipOpts},
    scales:T.scaleOpts};
}
// One legend swatch + label; legMin() is the dashed "Minimum" swatch.
function legChip(color, label){ return '<div class="cc-li"><div class="cc-ld" style="background:'+color+'"></div>'+label+'</div>'; }
function legMin(){ return '<div class="cc-li"><div class="cc-ld" style="background:rgba(128,128,128,.4);border:1px dashed #888"></div>Minimum</div>'; }
// The right-hand side of a chart-card title: delta badge + optional MIN: n.
function trendTitleExtra(deltaHtml, min){
  return '<span style="display:flex;align-items:center;gap:6px;">'+deltaHtml+(min!=null?'<span style="font-family:var(--mono);font-size:9px;color:var(--muted)">MIN: '+min+'</span>':'')+'</span>';
}
// Shared builder for a Trends chart card (.cc): builds the card + line chart and registers it
// in window._charts and _trendData. o = {label, titleHtml, canvasId, legendHtml, belowMin, snapCount, datasets, dates, detail, T}.
function buildTrendCard(grid, o) {
  var card = document.createElement('div');
  card.className = 'cc';
  card.dataset.name = o.label;
  card.dataset.belowmin = o.belowMin ? '1' : '0';
  card.innerHTML =
    '<div class="cc-title">'+o.titleHtml+'</div>'+
    '<div class="cc-sub">'+o.snapCount+' SNAPSHOT'+(o.snapCount!==1?'S':'')+'</div>'+
    '<div class="cc-wrap"><canvas id="'+o.canvasId+'"></canvas></div>'+
    '<div class="cc-legend">'+o.legendHtml+'</div>';
  grid.appendChild(card);
  var chart = new Chart(card.querySelector('#'+o.canvasId).getContext('2d'),
    {type:'line', data:{labels:o.dates, datasets:o.datasets}, options:trendOpts(o.T)});
  window._charts.push(chart);
  _trendData.push({el:card, gridId:grid.id, label:o.label, chart:chart, detail:o.detail});
  return card;
}
function renderTrends() {
  var sec = document.getElementById('trendsec').value;
  document.getElementById('trend-serc').style.display = sec==='serc' ? '' : 'none';
  document.getElementById('trend-afso').style.display = sec==='afso' ? '' : 'none';
  document.getElementById('trend-eto').style.display  = sec==='eto'  ? '' : 'none';
  _trendData = []; // rebuilt by the active section's render below
  if (sec==='serc')      renderSercTrends();
  else if (sec==='afso') renderAfsoTrends();
  else                    renderEtoTrends();
  decorateTrendPins();
  applyTrendFilter();
}

function renderSercTrends() {
  var cg=document.getElementById('cgrid'), chg=document.getElementById('chrgrid');
  var rng=parseInt(document.getElementById('rng').value);
  document.getElementById('tstat').textContent = log.length+' snapshot'+(log.length!==1?'s':'')+' in SERC GC Log';
  if (window._charts) window._charts.forEach(function(c){ c.destroy(); });
  window._charts=[];
  if (!log.length) {
    chg.innerHTML='';
    cg.innerHTML='<div class="nolog"><strong>No Trend Data</strong>Load a spreadsheet with a <strong>GC Log</strong> tab.</div>';
    document.getElementById('chrlbl').style.display='none';
    document.getElementById('chtlbl').style.display='none';
    return;
  }
  document.getElementById('chrlbl').style.display='';
  document.getElementById('chtlbl').style.display='';
  var snaps = rng===0 ? log : log.slice(-rng);
  var dates = snaps.map(function(s){ return s.date.slice(5); });
  var T = trendChartTheme();

  // ── Chronic Issues ──
  var chronic = ALLRULES.map(function(rule){
    var present = snaps.filter(function(s){ return !!s.counts[rule.key]; });
    if (!present.length) return null;
    var bc = present.filter(function(s){ return s.counts[rule.key].svc < rule.min; }).length;
    return {name:rule.tile, bc:bc, total:present.length, pct:Math.round(bc/present.length*100)};
  }).filter(function(d){ return d && d.bc>=CHRONIC_MIN_FAILS; }).sort(function(a,b){ return b.pct-a.pct; });
  chg.innerHTML = chronicGridHtml(chronic);

  // ── Serviceability Over Time (skip items with no logged data in this range) ──
  cg.innerHTML='';
  ALLRULES.forEach(function(rule){
    if (snaps.every(function(s){ return !s.counts[rule.key]; })) return;
    var svcD=snaps.map(function(s){ return s.counts[rule.key]?s.counts[rule.key].svc:null; });
    var unsD=snaps.map(function(s){ return s.counts[rule.key]?s.counts[rule.key].uns:null; });
    var calD=snaps.map(function(s){ return s.counts[rule.key]?s.counts[rule.key].cal:null; });
    var depD=snaps.map(function(s){ return s.counts[rule.key]?s.counts[rule.key].dep:null; });
    var minL=snaps.map(function(){ return rule.min; });
    var _detail={dates:snaps.map(function(s){return s.date;}),values:svcD.slice(),min:rule.min,unit:'serviceable'};
    var lastSvc=null;
    for (var i=svcD.length-1;i>=0;i--){ if (svcD[i]!=null){ lastSvc=svcD[i]; break; } }
    var belowMin = lastSvc!=null && lastSvc<rule.min;
    var datasets=[
      {data:svcD,borderColor:T.COL.green,backgroundColor:hexToRgba(T.COL.green,.12),borderWidth:2,fill:true,tension:.3,pointRadius:3,pointBackgroundColor:T.COL.green,spanGaps:true},
      {data:unsD,borderColor:T.COL.red,backgroundColor:hexToRgba(T.COL.red,.08),borderWidth:2,fill:true,tension:.3,pointRadius:3,pointBackgroundColor:T.COL.red,spanGaps:true},
      {data:calD,borderColor:T.COL.amber,backgroundColor:hexToRgba(T.COL.amber,.08),borderWidth:2,fill:true,tension:.3,pointRadius:3,pointBackgroundColor:T.COL.amber,spanGaps:true},
      {data:depD,borderColor:T.COL.blue,backgroundColor:hexToRgba(T.COL.blue,.08),borderWidth:2,fill:true,tension:.3,pointRadius:3,pointBackgroundColor:T.COL.blue,spanGaps:true},
      {data:minL,borderColor:T.minLineColor,borderWidth:1,borderDash:[4,4],fill:false,tension:0,pointRadius:0},
    ];
    buildTrendCard(cg, {label:rule.tile, titleHtml:rule.tile+trendTitleExtra(deltaBadge(svcD), rule.min),
      canvasId:'ch-'+rule.key, belowMin:belowMin, snapCount:snaps.length, dates:dates, datasets:datasets, detail:_detail, T:T,
      legendHtml: legChip(T.COL.green,'Serviceable')+legChip(T.COL.red,'Unserviceable')+legChip(T.COL.amber,'Cal/Insp')+legChip(T.COL.blue,'Deployed')+legMin()});
  });
  if (!cg.children.length) cg.innerHTML='<div class="nolog"><strong>No Trend Data</strong>No items have logged data in this range.</div>';
}

// AFSO trends — one chart per fluid category / sealant item, plotting Qty vs Min over time
function renderAfsoTrends() {
  var cg = document.getElementById('afsocgrid'), chg = document.getElementById('afsochrgrid');
  var rng = parseInt(document.getElementById('rng').value);
  document.getElementById('tstat').textContent = afsoLog.length+' snapshot'+(afsoLog.length!==1?'s':'')+' in AFSO GC Log';
  if (window._charts) window._charts.forEach(function(c){ c.destroy(); });
  window._charts=[];
  if (!afsoLog.length) {
    document.getElementById('afsotlbl').style.display='none';
    document.getElementById('afsochrlbl').style.display='none';
    chg.innerHTML='';
    cg.innerHTML='<div class="nolog"><strong>No Trend Data</strong>Use the AFSO <strong>↓ Log Snapshot</strong> button and paste rows into a <strong>GC Log</strong> tab in the AFSO spreadsheet.</div>';
    return;
  }
  document.getElementById('afsotlbl').style.display='';
  document.getElementById('afsochrlbl').style.display='';
  var snaps = rng===0 ? afsoLog : afsoLog.slice(-rng);
  var dates = snaps.map(function(s){ return s.date.slice(5); });
  var T = trendChartTheme();
  var items = (_liqData||[]).concat(_sealData||[]);

  // ── Chronic Issues ──
  var chronic = items.filter(function(d){ return d.min!==null && !isNaN(d.min); }).map(function(d){
    var present = snaps.filter(function(s){ return s.items[d.item] && s.items[d.item].qty!=null; });
    if (!present.length) return null;
    var bc = present.filter(function(s){ return s.items[d.item].qty < d.min; }).length;
    return {name:d.item, bc:bc, total:present.length, pct:Math.round(bc/present.length*100)};
  }).filter(function(d){ return d && d.bc>=CHRONIC_MIN_FAILS; }).sort(function(a,b){ return b.pct-a.pct; });
  chg.innerHTML = chronicGridHtml(chronic);

  // ── Stock Levels Over Time ──
  cg.innerHTML='';
  items.forEach(function(d){
    var qtyD  = snaps.map(function(s){ return (s.items[d.item] && s.items[d.item].qty!=null) ? s.items[d.item].qty : null; });
    if (qtyD.every(function(v){ return v===null; })) return; // item not present in any snapshot
    var hasMin = d.min !== null && !isNaN(d.min);
    var minL = hasMin ? snaps.map(function(){ return d.min; }) : null;
    var _detail={dates:snaps.map(function(s){return s.date;}),values:qtyD.slice(),min:hasMin?d.min:null,unit:'in stock'};
    var lastQty=null;
    for (var i=qtyD.length-1;i>=0;i--){ if (qtyD[i]!=null){ lastQty=qtyD[i]; break; } }
    var belowMin = hasMin && lastQty!=null && lastQty<d.min;
    var safeKey = d.item.replace(/[^a-z0-9]+/gi,'_');
    var datasets=[{data:qtyD,borderColor:T.COL.green,backgroundColor:hexToRgba(T.COL.green,.12),borderWidth:2,fill:true,tension:.3,pointRadius:3,pointBackgroundColor:T.COL.green,spanGaps:true}];
    if (minL) datasets.push({data:minL,borderColor:T.minLineColor,borderWidth:1,borderDash:[4,4],fill:false,tension:0,pointRadius:0});
    buildTrendCard(cg, {label:d.item, titleHtml:esc(d.item)+trendTitleExtra(deltaBadge(qtyD), hasMin?d.min:null),
      canvasId:'ach-'+safeKey, belowMin:belowMin, snapCount:snaps.length, dates:dates, datasets:datasets, detail:_detail, T:T,
      legendHtml: legChip(T.COL.green,'Qty On Hand')+(hasMin?legMin():'')});
  });
  if (!cg.children.length) cg.innerHTML='<div class="nolog"><strong>No Trend Data</strong>Items in the GC Log no longer match items in the loaded spreadsheet.</div>';
}

// ETO trends — one chart per trade (As vs Total) plus one per under-strength authorisation (Count vs Min)
function renderEtoTrends() {
  var cg = document.getElementById('etocgrid'), chg = document.getElementById('etochrgrid');
  var rng = parseInt(document.getElementById('rng').value);
  document.getElementById('tstat').textContent = etoLog.length+' snapshot'+(etoLog.length!==1?'s':'')+' in ETO GC Log';
  if (window._charts) window._charts.forEach(function(c){ c.destroy(); });
  window._charts=[];
  if (!etoLog.length) {
    document.getElementById('etotlbl').style.display='none';
    document.getElementById('etochrlbl').style.display='none';
    chg.innerHTML='';
    cg.innerHTML='<div class="nolog"><strong>No Trend Data</strong>Use the ETO <strong>↓ Log Snapshot</strong> button and paste rows into a <strong>GC Log</strong> tab in the ETO spreadsheet.</div>';
    return;
  }
  document.getElementById('etotlbl').style.display='';
  document.getElementById('etochrlbl').style.display='';
  var snaps = rng===0 ? etoLog : etoLog.slice(-rng);
  var dates = snaps.map(function(s){ return s.date.slice(5); });
  var T = trendChartTheme();
  cg.innerHTML='';

  // Trade & authorisation keys seen across the displayed snapshots
  var trades = {};
  snaps.forEach(function(s){ Object.keys(s.trades).forEach(function(t){ trades[t]=true; }); });
  var tradeKeys = Object.keys(trades).sort(function(a,b){
    var ai=TRADE_ORDER.indexOf(a); if(ai<0) ai=99;
    var bi=TRADE_ORDER.indexOf(b); if(bi<0) bi=99;
    return ai-bi || a.localeCompare(b);
  });
  var auths = {};
  snaps.forEach(function(s){ Object.keys(s.auths).forEach(function(a){ auths[a]=true; }); });

  // ── Chronic Issues — trades below their deploy minimum, auths below AUTH_MIN ──
  var chronic = [];
  tradeKeys.forEach(function(trade){
    var minReq = DEPLOY_PERSONNEL.perTrade[trade];
    if (minReq==null) return;
    var present = snaps.filter(function(s){ return s.trades[trade] && s.trades[trade].as!=null; });
    if (!present.length) return;
    var bc = present.filter(function(s){ return s.trades[trade].as < minReq; }).length;
    if (bc>=CHRONIC_MIN_FAILS) chronic.push({name:trade+' — A-Qualified', bc:bc, total:present.length, pct:Math.round(bc/present.length*100)});
  });
  Object.keys(auths).forEach(function(authKey){
    var authName = Object.keys(AUTH_MIN).find(function(k){ return k.replace(/\s+/g,'')===authKey; }) || authKey;
    var min = AUTH_MIN[authName];
    if (min==null) return;
    var present = snaps.filter(function(s){ return s.auths[authKey]!=null; });
    if (!present.length) return;
    var bc = present.filter(function(s){ return s.auths[authKey] < min; }).length;
    if (bc>=CHRONIC_MIN_FAILS) chronic.push({name:authName, bc:bc, total:present.length, pct:Math.round(bc/present.length*100)});
  });
  chronic.sort(function(a,b){ return b.pct-a.pct; });
  chg.innerHTML = chronicGridHtml(chronic);

  // Trade tiles: As vs Total
  tradeKeys.forEach(function(trade){
    var asD  = snaps.map(function(s){ return (s.trades[trade] && s.trades[trade].as!=null)    ? s.trades[trade].as    : null; });
    var totD = snaps.map(function(s){ return (s.trades[trade] && s.trades[trade].total!=null) ? s.trades[trade].total : null; });
    if (asD.every(function(v){ return v===null; })) return;
    var minReq = DEPLOY_PERSONNEL.perTrade[trade];
    var _detail={dates:snaps.map(function(s){return s.date;}),values:asD.slice(),min:(minReq!=null?minReq:null),unit:'A-qualified'};
    var lastAs=null;
    for (var i=asD.length-1;i>=0;i--){ if (asD[i]!=null){ lastAs=asD[i]; break; } }
    var belowMin = minReq!=null && lastAs!=null && lastAs<minReq;
    var safeKey = trade.replace(/[^a-z0-9]+/gi,'_');
    var datasets=[
      {data:asD, borderColor:T.COL.green,backgroundColor:hexToRgba(T.COL.green,.12),borderWidth:2,fill:true,tension:.3,pointRadius:3,pointBackgroundColor:T.COL.green,spanGaps:true},
      {data:totD,borderColor:T.COL.blue,backgroundColor:hexToRgba(T.COL.blue,.08),borderWidth:2,fill:true,tension:.3,pointRadius:3,pointBackgroundColor:T.COL.blue,spanGaps:true},
    ];
    buildTrendCard(cg, {label:trade, titleHtml:esc(trade)+deltaBadge(asD),
      canvasId:'ech-'+safeKey, belowMin:belowMin, snapCount:snaps.length, dates:dates, datasets:datasets, detail:_detail, T:T,
      legendHtml: legChip(T.COL.green,'C-Rel + Lvl-A')+legChip(T.COL.blue,'Total')});
  });

  // Authorisation tiles: Count vs Min
  Object.keys(auths).forEach(function(authKey){
    var cntD = snaps.map(function(s){ return s.auths[authKey]!=null ? s.auths[authKey] : null; });
    if (cntD.every(function(v){ return v===null; })) return;
    var authName = Object.keys(AUTH_MIN).find(function(k){ return k.replace(/\s+/g,'')===authKey; }) || authKey;
    var min = AUTH_MIN[authName];
    var minL = min!=null ? snaps.map(function(){ return min; }) : null;
    var _detail={dates:snaps.map(function(s){return s.date;}),values:cntD.slice(),min:(min!=null?min:null),unit:'qualified'};
    var lastCnt=null;
    for (var i=cntD.length-1;i>=0;i--){ if (cntD[i]!=null){ lastCnt=cntD[i]; break; } }
    var belowMin = min!=null && lastCnt!=null && lastCnt<min;
    var safeKey = authKey.replace(/[^a-z0-9]+/gi,'_');
    var datasets=[{data:cntD,borderColor:T.COL.green,backgroundColor:hexToRgba(T.COL.green,.12),borderWidth:2,fill:true,tension:.3,pointRadius:3,pointBackgroundColor:T.COL.green,spanGaps:true}];
    if (minL) datasets.push({data:minL,borderColor:T.minLineColor,borderWidth:1,borderDash:[4,4],fill:false,tension:0,pointRadius:0});
    buildTrendCard(cg, {label:authName, titleHtml:esc(authName)+trendTitleExtra(deltaBadge(cntD), min!=null?min:null),
      canvasId:'auch-'+safeKey, belowMin:belowMin, snapCount:snaps.length, dates:dates, datasets:datasets, detail:_detail, T:T,
      legendHtml: legChip(T.COL.green,'Qualified')+(minL?legMin():'')});
  });

  if (!cg.children.length) cg.innerHTML='<div class="nolog"><strong>No Trend Data</strong>Trades/authorisations in the GC Log no longer match the loaded spreadsheet.</div>';
}

// -- PRINT --
var _printAmse = [], _printVehs = [], _atgls = [], _pallets = [];
