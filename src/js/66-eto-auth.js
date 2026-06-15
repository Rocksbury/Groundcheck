var TRADE_ORDER = ['AVN','AVS','ACS'];
var AUTH_MIN = { 'Tow Driver': 6, 'Tow IC': 6 };

// Count personnel currently holding a given authorisation (Tow Driver / Tow IC).
function authCount(auth) {
  return (_trainData||[]).filter(function(d){ return auth==='Tow Driver' ? d.towD : d.towIC; }).length;
}

function parseTraining(wb, fname) {
  _trainFname = fname;
  _loadTimes.eto = new Date();
  var wsName = wb.SheetNames.find(function(s){ return /training|qualif|personnel|course/i.test(s); }) || wb.SheetNames[0];
  var ws = wb.Sheets[wsName];
  if (!ws) { _trainData = []; etoLog = []; updateSources(); buildTrainingSection(); document.getElementById('etosnapbtn').style.display='none'; updatePrintBtn(); computeEtoBanner(); renderBanner(); return; }
  var rows = XLSX.utils.sheet_to_json(ws, {header:1, defval:null});
  var hdri = findHeaderRow(rows, 2);
  var hdr = rows[hdri].map(function(c){ return c ? String(c).trim().toLowerCase() : ''; });
  var ci = { last:-1, first:-1, trade:-1, level:-1, towd:-1, towic:-1 };
  hdr.forEach(function(h,i){
    if      (ci.last<0   && /last|surname/i.test(h))           ci.last   = i;
    if      (ci.first<0  && /first|given/i.test(h))            ci.first  = i;
    if      (ci.towd<0   && /tow.?driv/i.test(h))              ci.towd   = i;
    if      (ci.towic<0  && /tow.?ic/i.test(h))                ci.towic  = i;
    if      (ci.trade<0  && /trade|section|sqn/i.test(h))      ci.trade  = i;
    if      (ci.level<0  && /level|rank|tier|class/i.test(h))  ci.level  = i;
  });
  var data = [];
  for (var j=hdri+1; j<rows.length; j++) {
    var r = rows[j];
    var last  = ci.last>=0  && r[ci.last]  ? String(r[ci.last]).trim()  : '';
    var first = ci.first>=0 && r[ci.first] ? String(r[ci.first]).trim() : '';
    if (!last && !first) continue;
    var trade = ci.trade>=0 && r[ci.trade] ? String(r[ci.trade]).trim().toUpperCase() : 'OTHER';
    var level = ci.level>=0 && r[ci.level] ? String(r[ci.level]).trim() : '';
    var towD  = ci.towd>=0  && r[ci.towd]  ? /^y/i.test(String(r[ci.towd]).trim())  : false;
    var towIC = ci.towic>=0 && r[ci.towic] ? /^y/i.test(String(r[ci.towic]).trim()) : false;
    data.push({trade: trade, level: level, towD: towD, towIC: towIC});
  }
  _trainData = data;
  finalizeEto(wb);
}

// Shared finalize step for any ETO source (roster template or Auth Export): pulls any GC Log,
// rebuilds the section, and refreshes the banner/sources/print state.
function finalizeEto(wb) {
  var wsEtoLog = wb.Sheets['GC Log'];
  etoLog = wsEtoLog ? parseEtoLog(XLSX.utils.sheet_to_json(wsEtoLog,{header:1,defval:null})) : [];
  buildTrainingSection();
  document.getElementById('etosnapbtn').style.display = _trainData.length ? '' : 'none';
  updateSources();
  updatePrintBtn();
  computeEtoBanner();
  autoSelectSection('eto');
  renderBanner();
  if (document.getElementById('page-trends').classList.contains('on')) renderTrends();
}

// Map a CC177 training-app "Auth Export" (flat one-row-per-authorization) into the same
// roster shape parseTraining produces: one {trade, level, towD, towIC} per member.
// Derivation rules (see project memory): trade from MOS Name; Level A = holds 500-LVA-01,
// otherwise POM (C-Release/Apprentice not yet distinguishable from this export); Tow Driver =
// 177-SRV-02, Tow IC = 177-SRV-03 (Tow Crew Supervisor).
function parseAuthExport(wb, fname) {
  _trainFname = fname;
  _loadTimes.eto = new Date();
  var wsName = wb.SheetNames.find(function(s){
    var r = XLSX.utils.sheet_to_json(wb.Sheets[s], {header:1, defval:null})[0] || [];
    return r.some(function(c){ return /authorization code/i.test(String(c)); });
  }) || wb.SheetNames[0];
  var rows = XLSX.utils.sheet_to_json(wb.Sheets[wsName], {header:1, defval:null});
  var hdri = findHeaderRow(rows, 2);
  var hdr = rows[hdri].map(function(c){ return c ? String(c).trim().toLowerCase() : ''; });
  var col = function(re){ return hdr.findIndex(function(h){ return re.test(h); }); };
  var ci = {rank:col(/^rank$/), surname:col(/surname|last/), code:col(/authorization code|auth.*code/),
            name:col(/^name$/), mos:col(/mos name/)};
  // Group rows by member (Rank + Surname is the only reliable person key in this export).
  var people = {};
  for (var j=hdri+1; j<rows.length; j++) {
    var r = rows[j]; if (!r) continue;
    var sur = ci.surname>=0 && r[ci.surname] ? String(r[ci.surname]).trim() : '';
    if (!sur) continue;
    var key = (ci.rank>=0 && r[ci.rank] ? String(r[ci.rank]).trim()+' ' : '') + sur;
    var p = people[key] || (people[key] = {mos:'', codes:[], names:[]});
    if (!p.mos && ci.mos>=0 && r[ci.mos]) p.mos = String(r[ci.mos]).trim();
    if (ci.code>=0 && r[ci.code]) p.codes.push(String(r[ci.code]).trim().toUpperCase());
    if (ci.name>=0 && r[ci.name]) p.names.push(String(r[ci.name]).trim().toLowerCase());
  }
  var data = Object.keys(people).map(function(key){
    var p = people[key];
    var trade = (p.mos || 'OTHER').replace(/\s*tech\s*$/i, '').trim().toUpperCase() || 'OTHER';
    var hasCode = function(c){ return p.codes.indexOf(c) >= 0; };
    var hasName = function(re){ return p.names.some(function(n){ return re.test(n); }); };
    var level = (hasCode('500-LVA-01') || hasName(/maintenance release \(level a\)/)) ? 'Level A' : 'POM';
    var towD  = hasCode('177-SRV-02') || hasName(/tow crew driver/);
    var towIC = hasCode('177-SRV-03') || hasName(/tow crew supervisor/);
    return {trade: trade, level: level, towD: towD, towIC: towIC};
  });
  _trainData = data;
  finalizeEto(wb);
}

function buildTrainingSection() {
  var tg = document.getElementById('tgrid');
  var tl = document.getElementById('tlbl');
  // Remove any previous training tiles from _tileData
  _tileData = _tileData.filter(function(td){ return td.grid !== tg; });
  tg.innerHTML = '';
  if (!_trainData || !_trainData.length) { tl.style.display = 'none'; return; }
  tl.style.display = '';

  // Group by trade (AVN/AVS/ACS first, others after)
  var trades = {};
  _trainData.forEach(function(d) {
    if (!trades[d.trade]) trades[d.trade] = [];
    trades[d.trade].push(d);
  });
  var tradeKeys = Object.keys(trades).sort(function(a,b){
    var ai = TRADE_ORDER.indexOf(a); if (ai<0) ai = 99;
    var bi = TRADE_ORDER.indexOf(b); if (bi<0) bi = 99;
    return ai - bi || a.localeCompare(b);
  });

  var anyTile = false;
  tradeKeys.forEach(function(trade) {
    var members = trades[trade];
    var lvl = levelCounts(members);
    var btext = lvl.as+' As / '+members.length+' Total';
    var chips = '';
    if (lvl.crel) chips += mkchip('svc', lvl.crel+' C-Rel');
    if (lvl.lvla) chips += mkchip('svc', lvl.lvla+' Lvl-A');
    if (lvl.pom)  chips += mkchip('cal', lvl.pom+' POM');
    if (lvl.app)  chips += mkchip('cal', lvl.app+' App');
    var lvlParts = [];
    if (lvl.crel) lvlParts.push('C-Rel: '+lvl.crel);
    if (lvl.lvla) lvlParts.push('Lvl-A: '+lvl.lvla);
    if (lvl.pom)  lvlParts.push('POM: '+lvl.pom);
    if (lvl.app)  lvlParts.push('App: '+lvl.app);
    var nameExtra = lvl.crel ? '<span class="crel-inline">C-REL: '+lvl.crel+'</span>' : '';
    var el = mkTileEl({className: 'tok', name: trade, nameExtra: nameExtra, badgeClass: 'met', badgeText: btext, chips: chips, note: lvlParts.join(' · ')});
    tg.appendChild(el);
    _tileData.push({el: el, grid: tg, label: trade, tags: [], status: 'ok', c: {uns: 0, cal: 0, dep: 0}});
    anyTile = true;
  });

  // Auth tiles — quietly tracked, only surfaced when manning falls short.
  // Auths don't expire; shown neutral (blue) for now pending manning discussion.
  Object.keys(AUTH_MIN).forEach(function(auth){
    var min = AUTH_MIN[auth];
    var count = authCount(auth);
    if (count >= min) return; // at/above minimum: tile stays hidden
    var short = min - count;
    var btext = count+'/'+min+' QUALIFIED';
    var chips = mkchip('svc', count+' Current') + mkchip('dep', short+' Short');
    var tnote = 'Below minimum manning — need '+short+' more';
    var el = mkTileEl({className: 'tinfo', name: auth, badgeClass: 'info', badgeText: btext, chips: chips, note: tnote});
    el.setAttribute('data-shortfall','1'); // counted as "below min" in the section summary
    tg.appendChild(el);
    _tileData.push({el: el, grid: tg, label: auth, tags: ['AUTH'], status: 'ok', c: {uns: 0, cal: 0, dep: 0}});
    anyTile = true;
  });

  if (!anyTile) tg.innerHTML = '<div class="empty"><h3>No Data</h3><p>No readable rows found.</p></div>';
  summarizeGrid('tgrid', 'tlbl-sum');
  decoratePins();
}
