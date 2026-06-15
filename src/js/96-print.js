// ── SHARED PRINT HELPERS (used by Trends & Overview print) ──
function buildPrintHeader(subtitle, metaLines) {
  var now=new Date(), days=['SUN','MON','TUE','WED','THU','FRI','SAT'];
  var tzAbbr=(new Intl.DateTimeFormat('en-CA',{timeZoneName:'short'}).formatToParts(now).find(function(p){return p.type==='timeZoneName';})||{value:''}).value;
  var ts=days[now.getUTCDay()]+' '+fmtUTCDate(now)+'  '+pad2(now.getHours())+':'+pad2(now.getMinutes())+' '+tzAbbr;
  var crestSrc=(document.querySelector('.logo img')||{}).src||'';
  document.getElementById('print-header').innerHTML=
    '<div style="display:flex;align-items:center;gap:12px;">'+
      (crestSrc?'<img src="'+crestSrc+'" style="width:44px;height:44px;object-fit:contain;">':'')+
      '<div>'+
        '<div class="ph-title">GROUNDCHECK — 429 SQN</div>'+
        '<div class="ph-sub">'+esc(subtitle)+' · C-17 GLOBEMASTER III</div>'+
      '</div>'+
    '</div>'+
    '<div class="ph-meta">'+
      (metaLines||[]).map(function(m){return '<div>'+esc(m)+'</div>';}).join('')+
      '<div>PRINTED: '+ts+'</div>'+
    '</div>';
}
function runBrowserPrint() {
  var origTitle=document.title;
  document.title=reportFilename().replace(/\.html$/,'');
  var restore=function(){ document.title=origTitle; window.removeEventListener('afterprint', restore); };
  window.addEventListener('afterprint', restore);
  window.print();
  setTimeout(restore, 1000);
}
// Trailing run of same met/not-met status, described in words.
function trendDurationText(d, hasMin) {
  if (!hasMin) return '—';
  var present=[];
  for (var i=0;i<d.values.length;i++){ var v=d.values[i]; if (v!=null) present.push(v>=d.min); }
  if (!present.length) return 'no data';
  var last=present[present.length-1], run=1;
  for (var j=present.length-2;j>=0;j--){ if (present[j]===last) run++; else break; }
  var word = last ? 'serviceable' : 'below min';
  return word+' for last '+run+' snapshot'+(run!==1?'s':'');
}

// ── TRENDS PRINT ──
function printTrends() {
  if (!_trendData.length) { notify('No trend charts to print in this section.', 'warn'); return; }
  var secVal=document.getElementById('trendsec').value;
  var secName={serc:'SERC — Equipment & Vehicles', afso:'AFSO — Fluids & Sealants', eto:'ETO — Training & Qualifications'}[secVal]||secVal.toUpperCase();
  var rows=_trendData.map(function(td){
    var d=td.detail||{values:[],dates:[]};
    var hasMin=d.min!=null && !isNaN(d.min);
    var met=0, total=0, last=null;
    for (var i=0;i<d.values.length;i++){ var v=d.values[i]; if (v==null) continue; total++; last=v; if (hasMin && v>=d.min) met++; }
    var good = hasMin && last!=null && last>=d.min;
    var statusTxt = !hasMin ? '—' : (good?'SERVICEABLE':'BELOW MIN');
    var statusCls = !hasMin ? '' : (good?'svc':'uns');
    return '<tr><td class="pt-name">'+esc(td.label)+'</td>'+
      '<td>'+(last!=null?last:'—')+(hasMin?' / '+d.min:'')+'</td>'+
      '<td>'+(hasMin?met+' / '+total:'—')+'</td>'+
      '<td class="pt-cond '+statusCls+'">'+statusTxt+'</td>'+
      '<td class="pt-note">'+esc(trendDurationText(d, hasMin))+'</td></tr>';
  }).join('');
  document.getElementById('print-body').innerHTML=
    '<div class="pt-section"><div class="pt-section-hdr"><span>'+esc(secName)+' — TREND SUMMARY</span></div>'+
    '<table class="pt-table"><thead><tr><th style="width:220px">ITEM</th><th style="width:90px">LATEST</th><th style="width:90px">MET / TOTAL</th><th style="width:110px">STATUS</th><th>DURATION</th></tr></thead><tbody>'+rows+'</tbody></table></div>';
  buildPrintHeader('TRENDS · '+secName.replace(/—.*$/,'').trim(), [document.getElementById('tstat').textContent]);
  runBrowserPrint();
}

// ── OVERVIEW PRINT ──
function printOverview() {
  if (!_overviewNote.date) _overviewNote.date = todayMemoDate();
  var memo=_overviewNote||{};
  var memoHtml='';
  if ((memo.date||'').trim() || (memo.body||'').trim() || (memo.author||'').trim()) {
    memoHtml='<div class="pt-section"><div class="pt-section-hdr"><span>MEETING MEMO</span></div>'+
      '<table class="pt-table"><tbody>'+
      (memo.date?'<tr><td class="pt-name" style="width:120px">DATE</td><td>'+esc(memo.date)+'</td></tr>':'')+
      (memo.author?'<tr><td class="pt-name">AUTHOR</td><td>'+esc(memo.author)+'</td></tr>':'')+
      (memo.body?'<tr><td class="pt-name">NOTES</td><td class="pt-note" style="white-space:pre-wrap">'+esc(memo.body)+'</td></tr>':'')+
      '</tbody></table></div>';
  }
  var rows=_overview.map(function(item){
    var status='—', cls='';
    if (item.source==='trends') {
      var te=_trendData.find(function(t){ return t.gridId===item.gridId && t.label===item.label; });
      if (te && te.detail) {
        var d=te.detail, hasMin=d.min!=null && !isNaN(d.min), met=0,total=0,last=null;
        for (var i=0;i<d.values.length;i++){ var v=d.values[i]; if(v==null)continue; total++; last=v; if(hasMin&&v>=d.min)met++; }
        status = hasMin ? (last>=d.min?'Serviceable':'Below min')+' · '+met+'/'+total+' met' : (last!=null?last+' logged':'—');
        cls = hasMin ? (last>=d.min?'svc':'uns') : '';
      } else { status='Trend not in current data'; }
    } else {
      var be=_tileData.find(function(t){ return t.grid && t.grid.id===item.gridId && t.label===item.label; });
      if (be && be.el) {
        var badge=be.el.querySelector('.mbadge'); var chip=be.el.querySelector('.chips');
        status=((badge?badge.textContent.replace(/\s+/g,' ').trim():'')+(chip?' · '+chip.textContent.replace(/\s+/g,' ').trim():'')).trim()||'—';
        if (be.el.classList.contains('nmet')) cls='uns'; else if (be.el.classList.contains('met')) cls='svc';
      } else { status='Not in current data'; }
    }
    return '<tr><td class="pt-name">'+esc(item.label)+'</td>'+
      '<td class="pt-cond '+cls+'">'+esc(status)+'</td>'+
      '<td class="pt-note" style="white-space:pre-wrap">'+(item.notes?esc(item.notes):'—')+'</td></tr>';
  }).join('');
  var itemsHtml = _overview.length
    ? '<div class="pt-section"><div class="pt-section-hdr"><span>PINNED ITEMS ('+_overview.length+')</span></div>'+
      '<table class="pt-table"><thead><tr><th style="width:220px">ITEM</th><th style="width:240px">STATUS</th><th>NOTES</th></tr></thead><tbody>'+rows+'</tbody></table></div>'
    : '<div class="pt-section"><div class="pt-section-hdr"><span>PINNED ITEMS</span></div><p style="font-family:Consolas,monospace;font-size:10px;padding:6px;">No items pinned.</p></div>';
  document.getElementById('print-body').innerHTML=memoHtml+itemsHtml;
  buildPrintHeader('OVERVIEW', [memo.date?('DATE: '+memo.date):'', memo.author?('AUTHOR: '+memo.author):''].filter(Boolean));
  runBrowserPrint();
}

var COND_LABEL={svc:'SERVICEABLE',uns:'UNSERVICEABLE',cal:'INSP / CAL',dep:'DEPLOYED'};

function buildSercPrintSection(rule, items) {
  var matched=match(items,rule.kw,rule.exclude||[]); if (!matched.length) return '';
  var c=count(matched), svc=c.svc, min=rule.min;
  var bclass=svc<min?'nmet':svc===min?'ext':'met';
  var btext=svc<min?'BELOW MIN \u00b7 '+svc+'/'+min:svc===min?'AT MIN \u00b7 '+svc+'/'+min:'MIN MET \u00b7 '+svc+'/'+min;
  var ORDER={uns:0,cal:1,dep:2,svc:3};
  var rows=matched.slice().sort(function(a,b){return (ORDER[a.cond]||9)-(ORDER[b.cond]||9);}).map(function(item){
    return '<tr><td class="pt-cs">'+esc(item.callsign)+'</td>'+
      '<td class="pt-cond '+item.cond+'">'+(COND_LABEL[item.cond]||item.cond.toUpperCase())+'</td>'+
      '<td class="pt-loc">'+esc(item.loc)+'</td>'+
      '<td class="pt-name">'+esc(item.name.replace(/\s{2,}/g,' '))+'</td>'+
      '<td class="pt-note">'+esc(item.note)+'</td></tr>';
  }).join('');
  return '<div class="pt-section"><div class="pt-section-hdr"><span>'+esc(rule.tile)+'</span><span class="pt-min-badge '+bclass+'">'+btext+'</span></div>'+
    '<table class="pt-table"><thead><tr><th style="width:72px">CALLSIGN</th><th style="width:88px">CONDITION</th><th style="width:90px">LOCATION</th><th style="width:200px">ITEM</th><th>SPECIAL NOTES</th></tr></thead><tbody>'+rows+'</tbody></table></div>';
}

function buildSercPrintSections() {
  var html='';
  ARULES.forEach(function(rule){ html+=buildSercPrintSection(rule,_printAmse); });
  if (_printVehs.length) VRULES.forEach(function(rule){ html+=buildSercPrintSection(rule,_printVehs); });
  return html;
}

// AFSO print \u2014 fluids grouped by category, then one row per sealant item
function buildAfsoPrintSections() {
  var html='';
  var STATUS_LABEL={svc:'SERVICEABLE',uns:'UNSERVICEABLE',low:'LOW STOCK',cal:'INSP / CAL'};
  if (_liqData && _liqData.length) {
    var cats = {};
    _liqData.forEach(function(d){ (cats[d.cat]=cats[d.cat]||[]).push(d); });
    var rows = '';
    Object.keys(cats).forEach(function(cat){
      cats[cat].forEach(function(d){
        rows += '<tr><td class="pt-name">'+esc(d.item)+'</td>'+
          '<td>'+esc(cat)+'</td>'+
          '<td>'+(d.qty!==null?d.qty:'')+' '+esc(d.unit)+'</td>'+
          '<td>'+(d.min!==null?d.min:'')+'</td>'+
          '<td class="pt-cond '+(d.status==='uns'?'uns':d.status==='low'?'cal':'svc')+'">'+(STATUS_LABEL[d.status]||d.status.toUpperCase())+'</td>'+
          '<td class="pt-note">'+esc(d.notes)+'</td></tr>';
      });
    });
    html += '<div class="pt-section"><div class="pt-section-hdr"><span>AFSO \u2014 FLUIDS</span></div>'+
      '<table class="pt-table"><thead><tr><th style="width:200px">ITEM</th><th style="width:140px">CATEGORY</th><th style="width:90px">QTY</th><th style="width:60px">MIN</th><th style="width:100px">STATUS</th><th>NOTES</th></tr></thead><tbody>'+rows+'</tbody></table></div>';
  }
  if (_sealData && _sealData.length) {
    var rows2 = _sealData.map(function(d){
      return '<tr><td class="pt-name">'+esc(d.item)+'</td>'+
        '<td>'+(d.qty!==null?d.qty:'')+' '+esc(d.unit)+'</td>'+
        '<td>'+(d.min!==null?d.min:'')+'</td>'+
        '<td class="pt-cond '+(d.status==='uns'?'uns':d.status==='low'?'cal':'svc')+'">'+(STATUS_LABEL[d.status]||d.status.toUpperCase())+'</td>'+
        '<td>'+esc(d.expiry)+'</td>'+
        '<td class="pt-note">'+esc(d.notes)+'</td></tr>';
    }).join('');
    html += '<div class="pt-section"><div class="pt-section-hdr"><span>AFSO \u2014 SEALANTS</span></div>'+
      '<table class="pt-table"><thead><tr><th style="width:200px">ITEM</th><th style="width:90px">QTY</th><th style="width:60px">MIN</th><th style="width:100px">STATUS</th><th style="width:100px">EXPIRY</th><th>NOTES</th></tr></thead><tbody>'+rows2+'</tbody></table></div>';
  }
  return html;
}

// ETO print \u2014 As/Total per trade plus Tow Driver / Tow IC manning
function buildEtoPrintSections() {
  if (!_trainData || !_trainData.length) return '';
  var trades = {};
  _trainData.forEach(function(d){ (trades[d.trade]=trades[d.trade]||[]).push(d); });
  var rows = Object.keys(trades).sort(function(a,b){
    var ai=TRADE_ORDER.indexOf(a); if(ai<0) ai=99;
    var bi=TRADE_ORDER.indexOf(b); if(bi<0) bi=99;
    return ai-bi || a.localeCompare(b);
  }).map(function(trade){
    var lvl = levelCounts(trades[trade]);
    return '<tr><td class="pt-name">'+esc(trade)+'</td>'+
      '<td>'+lvl.crel+'</td><td>'+lvl.lvla+'</td><td>'+lvl.pom+'</td><td>'+lvl.app+'</td>'+
      '<td>'+lvl.as+' / '+trades[trade].length+'</td></tr>';
  }).join('');
  var html = '<div class="pt-section"><div class="pt-section-hdr"><span>ETO \u2014 TRADE QUALIFICATIONS</span></div>'+
    '<table class="pt-table"><thead><tr><th style="width:120px">TRADE</th><th>C-REL</th><th>LVL-A</th><th>POM</th><th>APPRENTICE</th><th style="width:100px">AS / TOTAL</th></tr></thead><tbody>'+rows+'</tbody></table></div>';

  var authRows = Object.keys(AUTH_MIN).map(function(auth){
    var min = AUTH_MIN[auth];
    var count = authCount(auth);
    return '<tr><td class="pt-name">'+esc(auth)+'</td><td>'+count+'</td><td>'+min+'</td>'+
      '<td class="pt-cond '+(count<min?'uns':'svc')+'">'+(count<min?'BELOW MIN':'OK')+'</td></tr>';
  }).join('');
  html += '<div class="pt-section"><div class="pt-section-hdr"><span>ETO \u2014 AUTHORISATIONS</span></div>'+
    '<table class="pt-table"><thead><tr><th style="width:160px">AUTH</th><th style="width:80px">CURRENT</th><th style="width:80px">MIN</th><th style="width:120px">STATUS</th></tr></thead><tbody>'+authRows+'</tbody></table></div>';
  return html;
}