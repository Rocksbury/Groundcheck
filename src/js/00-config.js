// ── RULES ──
var ARULES = [
  {key:'nitrogen_cart',  tile:'Nitrogen Service Cart',        kw:['NITROGEN SERVICE CART','NITROGEN SERVICING CART'], min:2},
  {key:'air_start',      tile:'Continuous Air Start Unit',    kw:['CONTINUOUS AIR START UNIT'],                       min:2},
  {key:'tow_bar',        tile:'Tow Bar',                      kw:['TOW BAR'],                                         min:3},
  {key:'nlg_jack',       tile:'NLG Jack',                     kw:['JACK, AIRCRAFT, NLG LANDING GEAR','NLG JACK'],     min:2},
  {key:'gpu',            tile:'Ground Power Unit',            kw:['GROUND POWER UNIT'],                               min:3},
  {key:'jack_60t',       tile:'60 Ton Hydraulic Jack',        kw:['JACK,HYDRAULIC,60 TON','JACK, HYDRAULIC, 60 TON'], min:7},
  {key:'jack_console',   tile:'Jacking Console',              kw:['JACKING CONSOLE','PUMPING UNIT, HYDRAULIC'],       min:1},
  {key:'floodlight',     tile:'Floodlight (Trailer Mounted)', kw:['FLOODLIGHT'],                                      min:3},
  {key:'heater',         tile:'Heater (Duct Type)',           kw:['HEATER, DUCT TYPE','HEATER,DUCT TYPE'],            min:2},
  {key:'glesco',         tile:'Glesco Air Conditioning',      kw:['GLESCO','GLECO'],                                  min:2},
];
var VRULES = [
  {key:'lox',          tile:'Lox Truck',           kw:['LOX'],                                        min:1},
  {key:'heavy',        tile:'Heavy Truck (AMSE)',   kw:['(H)'],             exclude:['LOX','FLARE'],  min:1},
  {key:'trucks',       tile:'Trucks (Light)',        kw:['(L)'],             exclude:['LOX','FLARE'],        min:6},
  {key:'mule',         tile:'Tow Mule',             kw:['B-1200'],                                     min:1},
  {key:'boom_lift',    tile:'Boom Lift',            kw:['CHERRY PICKER','JLG'],                        min:2},
  {key:'scissor_lg',   tile:'Scissor Lift (Large)', kw:['LARGE SCISSOR LIFT'],                         min:2},
  {key:'scissor_sm',   tile:'Scissor Lift (Small)', kw:['SMALL SCISSOR LIFT'],                         min:2},
  {key:'yellow_trailer',tile:'Yellow Trailer',      kw:['YELLOW TRIPOD JACK TRAILER'],                 min:1},
  {key:'forklift',     tile:'Forklift',             kw:['F/L 3K','F/L 6K','FORKLIFT'],                min:1},
  {key:'tire_carts',   tile:'Tire Carts',           kw:['SPARE TIRE TRAILERS CART','TIRE CART'],      min:2},
];
var ALLRULES = ARULES.concat(VRULES);

// ── DEPLOY READINESS CHECK ──
// Minimum serviceable equipment / qualified personnel needed to send a deployment tomorrow.
// These are deploy-task minimums, separate from (and lower than) the home-station
// minimums in ARULES/VRULES above.
var DEPLOY_EQUIP = [
  {key:'gpu',           label:'Power Unit',  need:1},
  {key:'nitrogen_cart', label:'Nitrogen Cart', need:1},
  {key:'tow_bar',       label:'Tow Bar',     need:1},
  {key:'tire_carts',    label:'Tire Cart',   need:1},
  {key:'heater',        label:'Heater Cart', need:2},
];
var DEPLOY_PERSONNEL = {
  perTrade: {AVN:2, AVS:2, ACS:1}, // minimum "A" qualified (C-Rel + Lvl-A) per trade
  crel: 2, // C-Release qualified, combined across all trades
  pom: 4   // POM qualified, combined across all trades
};

// ── ATGL rules (parsed from ATGL Tracking sheet) ──
// ATGLs keep their NG/Legacy split but have no established minimum — status is banded
// purely by % serviceable of the fleet (see buildAtglSection). `min` is retained only
// as a label hint and is not used in the readiness calculation.
var ATGLRULES = [
  {key:'atgl_ng',     tile:'ATGL (NG)',     type:'NG'},
  {key:'atgl_legacy', tile:'ATGL (Legacy)', type:'Legacy'},
];
// Palletized seats are scored as one combined fleet (no minimum, no seat-type split) —
// see buildPalletsSection. parsePallets still reads each pallet's seatType for the detail view.
// An item only shows on the Chronic Issues board once it's been below minimum in at least this many snapshots.
var CHRONIC_MIN_FAILS = 4;
