// ── POPOVER ──
var popEl    = document.getElementById('pop');
var ptitleEl = document.getElementById('ptitle');
var pbodyEl  = document.getElementById('pbody');
var CGROUPS  = [
  {cond:'uns', label:'Unserviceable', color:'#C0392B'},
  {cond:'cal', label:'Cal / Insp',    color:'#E09800'},
  {cond:'dep', label:'Deployed',      color:'#2980B9'},
];

function showPop(ev, title, items) {
  ptitleEl.textContent = title;
  pbodyEl.innerHTML = '';
  CGROUPS.forEach(function(g) {
    var grp = items.filter(function(i){ return i.cond===g.cond; });
    if (!grp.length) return;
    var gdiv = document.createElement('div'); gdiv.className='pop-grp';
    var lbl  = document.createElement('div'); lbl.className='pop-glbl '+g.cond;
    lbl.innerHTML = '<div class="gd" style="background:'+g.color+'"></div>'+g.label+' ('+grp.length+')';
    gdiv.appendChild(lbl);
    grp.forEach(function(item) {
      var idiv = document.createElement('div'); idiv.className='pop-item';
      var note = (item.note||'').trim();
      if (note.length>100) note=note.slice(0,97)+'\u2026';
      var meta = [];
      if (item.inspDate) meta.push('INSP: '+item.inspDate);
      if (item.updatedBy) meta.push('BY: '+item.updatedBy);
      idiv.innerHTML =
        '<div class="pop-itop">' +
          '<div class="pop-cs">'+(item.callsign||'\u2014')+'</div>' +
          (item.loc ? '<div class="pop-loc">'+item.loc+'</div>' : '') +
        '</div>' +
        (meta.length ? '<div style="font-family:var(--mono);font-size:10px;color:var(--muted);letter-spacing:.5px;margin-bottom:4px;">'+meta.join(' &middot; ')+'</div>' : '') +
        (note ? '<div class="pop-note">'+note+'</div>' : '<div class="pop-nonote">No note on file</div>');
      gdiv.appendChild(idiv);
    });
    pbodyEl.appendChild(gdiv);
  });
  if (!pbodyEl.children.length)
    pbodyEl.innerHTML = '<div style="padding:12px 14px;font-family:var(--mono);font-size:10px;color:var(--muted);">No detail available</div>';
  movePop(ev); popEl.classList.add('vis');
}

function movePop(ev) {
  var mg=12, pw=popEl.offsetWidth||320, ph=popEl.offsetHeight||200;
  var x=ev.clientX+mg, y=ev.clientY+mg;
  if (x+pw>window.innerWidth-mg)  x=ev.clientX-pw-mg;
  if (y+ph>window.innerHeight-mg) y=ev.clientY-ph-mg;
  popEl.style.left=x+'px'; popEl.style.top=y+'px';
}
function hidePop() { popEl.classList.remove('vis'); }

// ── TILE DETAIL MODAL ──
// Status -> {label, color, dot} used for both the summary chips and per-row dots
var DETAIL_STATUS = {
  svc: {label:'Serviceable', color:'var(--green)'},
  uns: {label:'Unserviceable', color:'var(--red)'},
  cal: {label:'Cal / Insp', color:'var(--amber)'},
  dep: {label:'Deployed', color:'var(--dep)'},
  low: {label:'Low Stock', color:'var(--amber)'},
};
var STATUS_ORDER = {uns:0, cal:1, low:1, dep:2, svc:3};

// Open the full-list detail modal for a tile.
// type: 'equip' -> items have {callsign, cond, loc, inspDate, note}
//       'stock' -> items have {item, qty, min, unit, status, loc, order_date, expiry, notes}
function showDetailModal(title, items, type) {
  document.getElementById('detail-title').textContent = title;
  var sub = document.getElementById('detail-sub');
  var tbl = document.getElementById('detail-table');
  sub.innerHTML = '';
  tbl.innerHTML = '';

  if (!items || !items.length) {
    tbl.innerHTML = '<tr><td><div class="detail-empty">No items found for this tile.</div></td></tr>';
    document.getElementById('detail-modal').classList.add('vis');
    return;
  }

  if (type === 'equip') {
    // Summary counts
    var counts = count(items);
    var order = ['svc','uns','cal','dep'];
    order.forEach(function(k){
      if (!counts[k]) return;
      var s = DETAIL_STATUS[k];
      sub.innerHTML += '<div class="detail-stat"><div class="dot" style="background:'+s.color+'"></div>'+counts[k]+' '+s.label+'</div>';
    });
    // Sort: worst status first, then by callsign
    var sorted = items.slice().sort(function(a,b){
      var oa = STATUS_ORDER[a.cond]!==undefined?STATUS_ORDER[a.cond]:9;
      var ob = STATUS_ORDER[b.cond]!==undefined?STATUS_ORDER[b.cond]:9;
      if (oa !== ob) return oa-ob;
      return (a.callsign||'').localeCompare(b.callsign||'');
    });
    var rows = '<tr><th>TA / TNT / EMR</th><th>Status</th><th>Location</th><th>Last Insp/Cal</th><th>Notes</th></tr>';
    sorted.forEach(function(it){
      var s = DETAIL_STATUS[it.cond] || {label:it.cond, color:'var(--muted)'};
      var note = (it.note||'').trim();
      if (note.length>140) note = note.slice(0,137)+'…';
      rows += '<tr>'+
        '<td>'+esc(it.callsign||'—')+'</td>'+
        '<td><div class="dt-status"><div class="dot" style="background:'+s.color+'"></div>'+esc(s.label)+'</div></td>'+
        '<td>'+esc(it.loc||'—')+'</td>'+
        '<td>'+esc(it.inspDate||'—')+'</td>'+
        '<td class="dt-note">'+(note?esc(note):'—')+'</td>'+
      '</tr>';
    });
    tbl.innerHTML = rows;
  } else if (type === 'stock') {
    var c2 = {svc:0, low:0, uns:0, cal:0};
    items.forEach(function(d){ if (c2[d.status]!==undefined) c2[d.status]++; });
    [['svc','Stocked'],['low','Low Stock'],['uns','Unserviceable']].forEach(function(p){
      if (!c2[p[0]]) return;
      var s = DETAIL_STATUS[p[0]];
      sub.innerHTML += '<div class="detail-stat"><div class="dot" style="background:'+s.color+'"></div>'+c2[p[0]]+' '+p[1]+'</div>';
    });
    var sorted2 = items.slice().sort(function(a,b){
      var oa = STATUS_ORDER[a.status]!==undefined?STATUS_ORDER[a.status]:9;
      var ob = STATUS_ORDER[b.status]!==undefined?STATUS_ORDER[b.status]:9;
      if (oa !== ob) return oa-ob;
      return (a.item||'').localeCompare(b.item||'');
    });
    var rows2 = '<tr><th>Item</th><th>Status</th><th>Stock / Min</th><th>Location</th><th>Order / Expiry</th><th>Notes</th></tr>';
    sorted2.forEach(function(d){
      var s = DETAIL_STATUS[d.status] || {label:d.status, color:'var(--muted)'};
      var stock = d.qty!==null ? d.qty+(d.unit?' '+d.unit:'')+(d.min!==null?' / '+d.min:'') : '—';
      var dates = [];
      if (d.order_date) dates.push('Ord: '+d.order_date);
      if (d.expiry)     dates.push('Exp: '+d.expiry);
      var note = (d.notes||'').trim();
      if (note.length>140) note = note.slice(0,137)+'…';
      rows2 += '<tr>'+
        '<td>'+esc(d.item)+'</td>'+
        '<td><div class="dt-status"><div class="dot" style="background:'+s.color+'"></div>'+esc(s.label)+'</div></td>'+
        '<td>'+esc(stock)+'</td>'+
        '<td>'+esc(d.loc||'—')+'</td>'+
        '<td>'+(dates.length?esc(dates.join(' · ')):'—')+'</td>'+
        '<td class="dt-note">'+(note?esc(note):'—')+'</td>'+
      '</tr>';
    });
    tbl.innerHTML = rows2;
  }

  document.getElementById('detail-modal').classList.add('vis');
}

function closeDetailModal() {
  document.getElementById('detail-modal').classList.remove('vis');
}

// ── DEPLOY READINESS CHECK ──
// Compares current serviceable equipment & qualified personnel against the deploy
// minimums in DEPLOY_EQUIP / DEPLOY_PERSONNEL, highlights the relevant tiles, and
// shows a GO / NO-GO modal with a per-requirement breakdown.
function checkDeployable() {
  if (!snap || !snap.counts) { notify('Load the SERC spreadsheet first.', 'warn'); return; }
  if (!_trainData || !_trainData.length) { notify('Load the ETO spreadsheet first.', 'warn'); return; }

  var rows = [];
  var go = true;

  DEPLOY_EQUIP.forEach(function(item){
    var c = snap.counts[item.key] || {svc:0};
    var ok = c.svc >= item.need;
    if (!ok) go = false;
    rows.push({label: item.label, have: c.svc, need: item.need, ok: ok});
  });

  // Per-trade "A qualified" (C-Rel + Lvl-A) minimums
  var trades = {};
  _trainData.forEach(function(d){ (trades[d.trade] = trades[d.trade] || []).push(d); });
  Object.keys(DEPLOY_PERSONNEL.perTrade).forEach(function(trade){
    var lvl = levelCounts(trades[trade] || []);
    var need = DEPLOY_PERSONNEL.perTrade[trade];
    var ok = lvl.as >= need;
    if (!ok) go = false;
    rows.push({label: trade + ' — A Qualified', have: lvl.as, need: need, ok: ok});
  });

  // Combined C-Release / POM minimums across all trades
  var allLvl = levelCounts(_trainData);
  var crelOk = allLvl.crel >= DEPLOY_PERSONNEL.crel;
  var pomOk  = allLvl.pom  >= DEPLOY_PERSONNEL.pom;
  if (!crelOk) go = false;
  if (!pomOk)  go = false;
  rows.push({label: 'C-Release (combined)',   have: allLvl.crel, need: DEPLOY_PERSONNEL.crel, ok: crelOk});
  rows.push({label: 'POM Qualified (combined)', have: allLvl.pom, need: DEPLOY_PERSONNEL.pom, ok: pomOk});

  showDeployModal(go, rows);
}

function showDeployModal(go, rows) {
  var verdict = document.getElementById('deploy-verdict');
  verdict.textContent = go ? '✔ GO — DEPLOYABLE' : '✖ NO-GO — NOT DEPLOYABLE';
  verdict.className = 'deploy-verdict ' + (go ? 'go' : 'nogo');
  var body = document.getElementById('deploy-body');
  body.innerHTML = rows.map(function(r){
    var color = r.ok ? 'var(--green)' : 'var(--red)';
    return '<tr class="'+(r.ok?'ok':'bad')+'"><td>'+esc(r.label)+'</td><td>'+r.have+' / '+r.need+'</td>'+
      '<td><div class="dt-status"><div class="dot" style="background:'+color+'"></div>'+(r.ok?'MET':'SHORT')+'</div></td></tr>';
  }).join('');
  document.getElementById('deploy-modal').classList.add('vis');
}

function closeDeployModal() {
  document.getElementById('deploy-modal').classList.remove('vis');
}
