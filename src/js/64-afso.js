// ── Green-hide: clean tiles suppressed by default, revealed by search/filter/show-all ──
var _afsoShowAll = false;
function applyAfsoGreenHide() {
  var grids = [
    {gid:'agrid',      lblId:'albl'},
    {gid:'vgrid',      lblId:'vlbl'},
    {gid:'atglgrid',   lblId:'atgllbl'},
    {gid:'lgrid',      lblId:'llbl'},
    {gid:'sgrid',      lblId:'sllbl'}
  ];
  grids.forEach(function(g) {
    var grid = document.getElementById(g.gid);
    if (!grid) return;
    var lbl = document.getElementById(g.lblId);
    if (!lbl) return;
    var hidden = 0;
    Array.from(grid.querySelectorAll('[data-green-hidden]')).forEach(function(el) {
      if (el.style.display === 'none') hidden++;
    });
    var badgeClass = 'afso-hidden-badge-'+g.gid;
    var badge = lbl.querySelector('.'+badgeClass);
    if (hidden > 0) {
      if (!badge) {
        badge = document.createElement('span');
        badge.className = 'afso-hidden-badge '+badgeClass;
        badge.style.cssText = 'font-family:var(--cond);font-size:11px;font-weight:600;letter-spacing:1px;color:var(--muted);margin-left:10px;cursor:pointer;text-decoration:underline;text-underline-offset:2px;';
        badge.onclick = function(e){ e.stopPropagation(); _afsoShowAll=true; applyViewState(); };
        lbl.appendChild(badge);
      }
      badge.textContent = '+'+hidden+' fully serviceable \u2014 show all';
      badge.style.display = '';
    } else if (badge) {
      badge.style.display = 'none';
    }
  });
}
function resetAfsoGreenHide() {
  _afsoShowAll = false;
  ['agrid','vgrid','atglgrid','lgrid','sgrid'].forEach(function(gid){
    var g = document.getElementById(gid);
    if (g) Array.from(g.querySelectorAll('[data-green-hidden]')).forEach(function(el){ el.style.display = 'none'; });
  });
  applyAfsoGreenHide();
}

function buildLiquidsSection() {
  var lg = document.getElementById('lgrid');
  var ll = document.getElementById('llbl');
  _tileData = _tileData.filter(function(td){ return td.grid !== lg; });
  lg.innerHTML = '';
  if (!_liqData || !_liqData.length) { ll.style.display = 'none'; decoratePins(); return; }
  ll.style.display = '';

  // Decide render mode: if only one category exists (e.g. POL "General"), render per-item tiles.
  // Otherwise group by category as before.
  var cats = {};
  _liqData.forEach(function(d) {
    if (!cats[d.cat]) cats[d.cat] = [];
    cats[d.cat].push(d);
  });
  var catKeys = Object.keys(cats);
  var perItem = catKeys.length === 1 && catKeys[0] === 'General';

  var anyTile = false;

  if (perItem) {
    // Per-item tiles (same layout as sealants)
    _liqData.forEach(function(d) {
      var tclass = d.status==='uns' ? 'twn' : d.status==='low' ? 'tex' : 'tok';
      var bclass = d.status==='uns' ? 'nmet' : d.status==='low' ? 'ext' : 'met';
      var status = d.status==='uns' ? 'warn' : d.status==='low' ? 'atmin' : 'ok';
      var btext  = d.qty!==null ? d.qty+(d.unit?' '+d.unit:'') : d.status.toUpperCase();
      var chips = '';
      if (d.status==='svc') chips += mkchip('svc', 'Stocked');
      if (d.status==='low') chips += mkchip('cal', 'Low Stock');
      if (d.status==='uns') chips += mkchip('uns', 'Out of Stock');
      var parts = [];
      if (d.loc)  parts.push(d.loc);
      if (d.qty!==null) parts.push('Qty: '+d.qty+(d.unit?' '+d.unit:'')+(d.min!==null?' / Min: '+d.min:''));
      if (d.notes) parts.push(d.notes);
      var tnote = parts.join(' · ');
      var el = mkTileEl({className: tclass, name: d.item, badgeClass: bclass, badgeText: btext, chips: chips, note: tnote});
      el.classList.add('clickable');
      if (status === 'ok') { el.setAttribute('data-green-hidden','1'); el.style.display = 'none'; }
      (function(_d){ el.addEventListener('click', function(){ showDetailModal(_d.item, [_d], 'stock'); }); })(d);
      lg.appendChild(el);
      _tileData.push({el: el, grid: lg, label: d.item, tags: [d.item.toUpperCase()], status: status, c: {uns: d.status==='uns'?1:0, cal: d.status==='low'?1:0, dep: 0}});
      anyTile = true;
    });
  } else {
    // Category-grouped tiles (generic AFSO spreadsheet format)
    catKeys.forEach(function(cat) {
      var items = cats[cat];
      var svc = items.filter(function(d){ return d.status==='svc'; }).length;
      var low = items.filter(function(d){ return d.status==='low'; }).length;
      var uns = items.filter(function(d){ return d.status==='uns'; }).length;
      var tclass = uns>0 ? 'twn' : low>0 ? 'tex' : 'tok';
      var bclass = uns>0 ? 'nmet' : low>0 ? 'ext' : 'met';
      var btext  = uns>0 ? uns+' UNSERV' : low>0 ? low+' LOW STOCK' : 'ALL STOCKED';
      var status = uns>0 ? 'warn' : low>0 ? 'atmin' : 'ok';
      var chips = '';
      if (svc>0) chips += mkchip('svc', svc+' Stocked');
      if (low>0) chips += mkchip('cal', low+' Low');
      if (uns>0) chips += mkchip('uns', uns+' Unserviceable');
      var noteItems = items.map(function(d){
        var parts = [d.item];
        if (d.qty!==null) parts.push('Stock: '+d.qty+(d.unit?' '+d.unit:'')+(d.min!==null?' / Min: '+d.min:''));
        if (d.status==='low') parts.push('Supply Waiting');
        if (d.status==='uns') parts.push('OUT OF STOCK');
        return parts.join(' · ');
      });
      var tnote = noteItems.slice(0,3).join(' | ');
      if (noteItems.length>3) tnote += ' …';
      var el = mkTileEl({className: tclass, name: cat, badgeClass: bclass, badgeText: btext, chips: chips, note: tnote});
      el.classList.add('clickable');
      if (status === 'ok' && uns === 0) { el.setAttribute('data-green-hidden','1'); el.style.display = 'none'; }
      lg.appendChild(el);
      _tileData.push({el: el, grid: lg, label: cat, tags: items.map(function(d){ return d.item.toUpperCase(); }), status: status, c: {uns: uns, cal: low, dep: 0}});
      anyTile = true;
    });
  }

  if (!anyTile) lg.innerHTML = '<div class="empty"><h3>No Data</h3><p>No readable rows found.</p></div>';
  applyAfsoGreenHide();
  summarizeGrid('lgrid', 'llbl-sum');
  decoratePins();
}

function buildSealantsSection() {
  var sg = document.getElementById('sgrid');
  var sl = document.getElementById('sllbl');
  // Remove any previous sealant tiles from _tileData
  _tileData = _tileData.filter(function(td){ return td.grid !== sg; });
  sg.innerHTML = '';
  if (!_sealData || !_sealData.length) { sl.style.display = 'none'; decoratePins(); return; }
  sl.style.display = '';
  _sealData.forEach(function(d) {
    var tclass = d.status==='uns' ? 'twn' : d.status==='low' ? 'tex' : 'tok';
    var bclass = d.status==='uns' ? 'nmet' : d.status==='low' ? 'ext' : 'met';
    var status = d.status==='uns' ? 'warn' : d.status==='low' ? 'atmin' : 'ok';
    var btext  = d.qty!==null ? d.qty+(d.unit?' '+d.unit:'') : d.status.toUpperCase();
    var chips = '';
    if (d.status==='svc') chips += mkchip('svc', 'Stocked');
    if (d.status==='low') chips += mkchip('cal', 'Low Stock');
    if (d.status==='uns') chips += mkchip('uns', 'Unserviceable');
    var parts = [];
    if (d.qty!==null) parts.push('Stock: '+d.qty+(d.unit?' '+d.unit:'')+(d.min!==null?' / Min: '+d.min:''));
    if (d.order_date) parts.push('Ordered: '+d.order_date);
    if (d.expiry)     parts.push('Exp: '+d.expiry);
    if (d.status==='low') parts.push('Supply Waiting');
    if (d.status==='uns') parts.push('OUT OF STOCK');
    var tnote = parts.join(' · ');
    var el = mkTileEl({className: tclass, name: d.item, badgeClass: bclass, badgeText: btext, chips: chips, note: tnote});
    el.classList.add('clickable');
    if (status === 'ok') { el.setAttribute('data-green-hidden','1'); el.style.display = 'none'; }
    (function(_d){
      el.addEventListener('click', function(){ showDetailModal(_d.item, [_d], 'stock'); });
    })(d);
    sg.appendChild(el);
    _tileData.push({el: el, grid: sg, label: d.item, tags: [d.item.toUpperCase()], status: status, c: {uns: d.status==='uns'?1:0, cal: d.status==='low'?1:0, dep: 0}});
  });
  applyAfsoGreenHide();
  summarizeGrid('sgrid', 'sllbl-sum');
  decoratePins();
}
