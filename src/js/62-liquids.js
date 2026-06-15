// ── POL parser helper: reads one sheet from MASTER_INVENTORY_LIST_FOR_POL format ──
// colA=item, colG=qty, colH=min, colF=unit, colE=loc, colK=notes (0-indexed: 0,6,7,5,4,10)
// isSealSheet: if true all rows get cat='Sealant'; otherwise cat='General'
// For NON-PPG, rows at 0-based indices 119-158 (Excel 120-159) are sealants —
// pass sealStartIdx / sealEndIdx to mark that range dynamically.
function parsePOLSheet(ws, isSealSheet, sealStartIdx, sealEndIdx) {
  if (!ws) return [];
  var rows = XLSX.utils.sheet_to_json(ws, {header:1, defval:null});
  var data = [];
  for (var j=2; j<rows.length; j++) {   // skip row 0 (title) and row 1 (header)
    var r = rows[j];
    var item = r[0] ? String(r[0]).trim() : null;
    if (!item) continue;
    var qty  = r[6] !== null && r[6] !== undefined ? Number(r[6]) : null;
    var min  = r[7] !== null && r[7] !== undefined ? Number(r[7]) : null;
    if (min !== null && isNaN(min)) min = null;
    if (qty !== null && isNaN(qty)) qty = null;
    var unit = r[5] ? String(r[5]).trim() : '';
    var loc  = r[4] ? String(r[4]).trim() : '';
    var notes= r[10] ? String(r[10]).replace(/\n/g,' ').trim() : '';
    // Determine category
    var isSeal = isSealSheet || (sealStartIdx !== undefined && j >= sealStartIdx && j <= sealEndIdx);
    var cat = isSeal ? 'Sealant' : 'General';
    var status = 'svc';
    if (qty !== null && min !== null) {
      if (qty <= 0)       status = 'uns';
      else if (qty < min) status = 'low';
    } else if (qty !== null && qty <= 0) { status = 'uns'; }
    data.push({item:item, cat:cat, qty:qty, min:min, unit:unit, status:status, loc:loc, notes:notes, order_date:'', expiry:''});
  }
  return data;
}

function parseLiquids(wb, fname) {
  _liqFname = fname;
  _loadTimes.afso = new Date();

  var data = [];

  // ── POL format: NON-PPG ITEMS + PPG ITEMS ──
  var isPOL = wb.SheetNames.some(function(s){ return /non-ppg|ppg.items/i.test(s); });
  if (isPOL) {
    // NON-PPG ITEMS: rows 120-159 (0-based j=119 to j=158) are sealants
    var wsNPPG = wb.Sheets['NON-PPG ITEMS'];
    if (wsNPPG) {
      var nppgRowCount = XLSX.utils.decode_range(wsNPPG['!ref']).e.r + 1;
      if (nppgRowCount <= 119) console.warn('[GC] "NON-PPG ITEMS" has only '+nppgRowCount+' rows — expected sealant rows 120-159 are missing. Check the sheet against the template (row/column layout may have changed).');
      data = data.concat(parsePOLSheet(wsNPPG, false, 119, 158));
    }
    // PPG ITEMS: all rows are fluids (mostly sealants in practice, but no category column — keep as General)
    var wsPPG = wb.Sheets['PPG ITEMS'];
    if (wsPPG) data = data.concat(parsePOLSheet(wsPPG, false));
  } else {
    // ── Generic format: find sheet by name keyword ──
    var wsName = wb.SheetNames.find(function(s){ return /consumab|lubric|oil|liquid|fuel/i.test(s); }) || wb.SheetNames[0];
    var ws = wb.Sheets[wsName];
    if (!ws) { _liqData = []; _sealData = []; afsoLog = []; updateSources(); buildLiquidsSection(); buildSealantsSection(); document.getElementById('afsosnapbtn').style.display='none'; updatePrintBtn(); computeAfsoBanner(); renderBanner(); return; }
    var rows = XLSX.utils.sheet_to_json(ws, {header:1, defval:null});
    var hdri = findHeaderRow(rows, 3);
    var hdr = rows[hdri].map(function(c){ return c ? String(c).trim().toLowerCase() : ''; });
    var ci = { item:-1, qty:-1, min:-1, unit:-1, status:-1, loc:-1, notes:-1, cat:-1, order_date:-1, expiry:-1 };
    hdr.forEach(function(h,i){
      if      (ci.item<0       && /item|name|descri|product/i.test(h))     ci.item       = i;
      else if (ci.cat<0        && /cat|category|type|group/i.test(h))       ci.cat        = i;
      if      (ci.qty<0        && /qty|quant|on.?hand|stock|have/i.test(h)) ci.qty        = i;
      if      (ci.min<0        && /min|req|required|need/i.test(h))         ci.min        = i;
      if      (ci.unit<0       && /unit|uom|measure/i.test(h))              ci.unit       = i;
      if      (ci.status<0     && /^status$/i.test(h))                      ci.status     = i;
      if      (ci.loc<0        && /loc|bin|storage|where/i.test(h))         ci.loc        = i;
      if      (ci.notes<0      && /note|remark|comment/i.test(h))           ci.notes      = i;
      if      (ci.order_date<0 && /order/i.test(h))                         ci.order_date = i;
      if      (ci.expiry<0     && /expir|expiry|exp date/i.test(h))         ci.expiry     = i;
    });
    for (var j=hdri+1; j<rows.length; j++) {
      var r = rows[j];
      var item = ci.item>=0 && r[ci.item] ? String(r[ci.item]).trim() : null;
      if (!item) continue;
      var qty = ci.qty>=0 && r[ci.qty] !== null ? Number(r[ci.qty]) : null;
      var min = ci.min>=0 && r[ci.min] !== null ? Number(r[ci.min]) : null;
      var unit = ci.unit>=0 && r[ci.unit] ? String(r[ci.unit]).trim() : '';
      var cat  = ci.cat>=0 && r[ci.cat]  ? String(r[ci.cat]).trim()  : 'General';
      var loc  = ci.loc>=0 && r[ci.loc]  ? String(r[ci.loc]).trim()  : '';
      var notes= ci.notes>=0 && r[ci.notes] ? String(r[ci.notes]).replace(/\n/g,' ').trim() : '';
      var order_date = ci.order_date>=0 && r[ci.order_date] ? String(r[ci.order_date]).trim() : '';
      var expiry     = ci.expiry>=0     && r[ci.expiry]     ? String(r[ci.expiry]).trim()     : '';
      var statusRaw = ci.status>=0 && r[ci.status] ? String(r[ci.status]).trim().toUpperCase() : '';
      var status = 'svc';
      if (/^(uns|u\/s|unserv|no)/i.test(statusRaw)) status = 'uns';
      else if (/^(cal|insp)/i.test(statusRaw))       status = 'cal';
      else if (/^(low|wait)/i.test(statusRaw))       status = 'low';
      else if (qty !== null && min !== null && !isNaN(qty) && !isNaN(min)) {
        if (qty <= 0)       status = 'uns';
        else if (qty < min) status = 'low';
      }
      data.push({item:item, cat:cat, qty:qty, min:min, unit:unit, status:status, loc:loc, notes:notes, order_date:order_date, expiry:expiry});
    }
  }

  // Sealants are tracked individually (one tile per item); fluids stay grouped by category
  _sealData = data.filter(function(d){ return /sealant/i.test(d.cat); });
  _liqData  = data.filter(function(d){ return !/sealant/i.test(d.cat); });
  var wsAfsoLog = wb.Sheets['GC Log'];
  afsoLog = wsAfsoLog ? parseAfsoLog(XLSX.utils.sheet_to_json(wsAfsoLog,{header:1,defval:null})) : [];
  buildLiquidsSection();
  buildSealantsSection();
  document.getElementById('afsosnapbtn').style.display = (_liqData.length || _sealData.length) ? '' : 'none';
  updateSources();
  updatePrintBtn();
  computeAfsoBanner();
  autoSelectSection('afso');
  renderBanner();
  if (document.getElementById('page-trends').classList.contains('on')) renderTrends();
}
