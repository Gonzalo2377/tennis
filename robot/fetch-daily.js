#!/usr/bin/env node
/* ============================================================
   ACEVALUE — robot diario (tenis · The Odds API)
   ------------------------------------------------------------
   Lee las cuotas de tenis (ATP/WTA) de varias casas, calcula el
   valor y reescribe ../daily.json. La web lo lee sola.

   Variables de entorno:
     ODDS_API_KEY   (obligatoria) — tu clave de The Odds API
     ODDS_REGIONS   eu | uk | us | au   (def. eu)
     ODDS_MAX       nº de torneos a coger (def. 10)
     ODDS_WINDOW_HOURS  ventana hacia delante en horas (def. 96)
     ODDS_SPORT     'auto' (descubre torneos de tenis activos) o
                    lista separada por comas de claves tennis_*.
   ============================================================ */
const fs = require('fs');
const path = require('path');

const API_KEY = process.env.ODDS_API_KEY;
const APITENNIS_KEY = process.env.APITENNIS_KEY || '';
const apiTennis = require('./results-api.js');
const fetchRankElo = require('./rankings-api.js');
const { espnMatches, failures: espnFailures } = require('./espn-results.js');
const { settleState, pendingDays, pairResult, pickIsHome, splitMatch, dayLabelTs, DAY } = require('./settle.js');
let LAST_FINISHED = [];   // partidos terminados de los últimos 5 días (para la FORMA de cada jugador)
const sofaResults = require('./sofascore-results.js');
const sofaRankings = require('./sofascore-rankings.js');
const REGIONS = process.env.ODDS_REGIONS || 'eu';
const MARKET  = 'h2h';
const MAX     = parseInt(process.env.ODDS_MAX || '10', 10);
const WINDOW_HOURS = parseInt(process.env.ODDS_WINDOW_HOURS || '96', 10);
const SPORT   = process.env.ODDS_SPORT || 'auto';
const OUT     = path.join(__dirname, '..', 'daily.json');

// La clave de The Odds API solo hace falta para pedir CUOTAS. En modo resultados
// (ODDS_MODE=scores) liquidamos con ESPN (gratis), así que no se exige.
const SCORES_MODE = (process.env.ODDS_MODE||'').toLowerCase()==='scores';
if (!API_KEY && !SCORES_MODE) { console.error('✗ Falta ODDS_API_KEY'); process.exit(1); }

const CREDITS = { remaining:null, used:null };

/* ---- helpers ---- */
const slug = (s) => (s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'').slice(0,16) || 'p'+Math.random().toString(36).slice(2,7);
function shortName(full){
  // "Carlos Alcaraz" -> "C. Alcaraz" ; keep single tokens as-is. Limpia comas/puntos sobrantes.
  const clean = (full||'').replace(/[.,;:]+$/,'').replace(/,/g,'').trim();
  const parts = clean.split(/\s+/);
  if (parts.length < 2) return clean;
  const last = parts.slice(1).join(' ');
  return parts[0][0] + '. ' + last;
}
function fmtTime(iso){ try { return new Date(iso).toLocaleTimeString('es-ES',{hour:'2-digit',minute:'2-digit',timeZone:'Europe/Madrid'}); } catch(e){ return ''; } }
function fmtDay(iso){ try { return new Date(iso).toLocaleDateString('es-ES',{day:'2-digit',month:'short'}).toUpperCase().replace('.',''); } catch(e){ return ''; } }
function tourOf(key){ return /wta/.test(key) ? 'wta' : 'atp'; }
function eventName(key){
  return key.replace(/^tennis_/,'').replace(/_/g,' ').replace(/\b\w/g, c=>c.toUpperCase());
}

async function api(url){
  const res = await fetch(url);
  const rem = res.headers.get('x-requests-remaining'), used = res.headers.get('x-requests-used');
  if (rem != null) CREDITS.remaining = +rem;
  if (used != null) CREDITS.used = +used;
  return res;
}

async function discoverTennis(){
  const res = await api(`https://api.the-odds-api.com/v4/sports/?apiKey=${API_KEY}`);
  if (!res.ok) throw new Error('sports list '+res.status);
  const list = await res.json();
  return list.filter(s => s.active && !s.has_outrights && /^tennis_/.test(s.key)).map(s=>s.key);
}

async function fetchOdds(key){
  const url = `https://api.the-odds-api.com/v4/sports/${key}/odds/?apiKey=${API_KEY}&regions=${REGIONS}&markets=${MARKET}&oddsFormat=decimal`;
  const res = await api(url);
  if (res.status === 422 || res.status === 404) { console.log(`  - ${key}: sin eventos`); return []; }
  if (!res.ok) { console.log(`  - ${key}: API ${res.status} (omitido)`); return []; }
  console.log(`  - ${key}: ok · créditos restantes ${CREDITS.remaining}`);
  const data = await res.json();
  return data.map(ev => ({ ev, key }));
}

async function fetchScores(keys){
  const out = [];
  for (const key of keys){
    const url = `https://api.the-odds-api.com/v4/sports/${key}/scores/?apiKey=${API_KEY}&daysFrom=3`;
    const res = await api(url);
    if (!res.ok) continue;
    const data = await res.json();
    data.forEach(s => out.push(s));
  }
  return out;
}

/* winner of a finished tennis match: the player with more sets/score */
function winnerOf(ev){
  if (!ev || !ev.completed || !ev.scores) return null;
  const [a,b] = ev.scores;
  if (!a || !b) return null;
  const sa = +a.score, sb = +b.score;
  if (Number.isNaN(sa) || Number.isNaN(sb) || sa === sb) return null;
  return sa > sb ? a.name : b.name;
}

/* ---- RESULTADOS Y LIQUIDACIÓN ----
   Fuente principal: ESPN (gratis), liquidando por PAREJA EXACTA + FECHA (robot/settle.js).
   Refuerzos opcionales: api-tennis (si hay APITENNIS_KEY) y SofaScore por ID (suele dar 403).
   Override manual: robot/results.json {"winners":["Apellido"], "voided":["Apellido"]}. */
function surnameKey(name){ return (name||'').trim().replace(/[.,;:]+$/,'').split(/\s+/).pop().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9-]/gi,'').toLowerCase(); }
function loadManualWinners(){
  try { const r = JSON.parse(fs.readFileSync(__dirname + '/results.json','utf8')); return (r.winners||[]).map(surnameKey).filter(Boolean); }
  catch(e){ return []; }
}
function loadManualVoids(){
  try { const r = JSON.parse(fs.readFileSync(__dirname + '/results.json','utf8')); return (r.voided||[]).map(surnameKey).filter(Boolean); }
  catch(e){ return []; }
}
let LAST_MATCHES = [];   // partidos (ESPN + api-tennis) de esta ejecución → reto escalera

/* liquida S = { RECORD, PENDING, COMBO_*, ARB_*, MODEL_* } (lo modifica) y enseña el recuento.
   Pide a ESPN los días de cada pendiente (±1); BACKFILL=1 → también los que ya fallaron 3 veces. */
async function runSettlement(S){
  const backfill = process.env.BACKFILL === '1';
  const days = pendingDays(S, { backfill });
  let espn = [];
  try { espn = await espnMatches(days); }
  catch(e){ console.log('· ESPN no disponible:', e.message); }
  console.log(`· ESPN: ${days.length} días consultados (${days[0]}…${days[days.length-1]}) · ${espn.filter(m=>m.done).length} partidos terminados · ${espn.filter(m=>m.void).length} retiradas/walkovers`);
  const apiRes = APITENNIS_KEY ? await apiTennis(APITENNIS_KEY, 6) : { matches:[] };
  const matches = [...espn, ...(apiRes.matches||[])];
  LAST_MATCHES = matches;
  // FORMA: solo partidos terminados de los últimos 5 días (como antes)
  LAST_FINISHED = matches.filter(m => m.done && !m.void && m.winner && Date.now() - m.ts < 5*DAY)
    .map(m => ({ home:m.home, away:m.away, winner: m.winner === 'home' ? m.home : m.away }));
  const sofaIds = [...S.PENDING.map(p=>p.sofa), ...S.COMBO_PENDING.flatMap(c=>c.legs.map(l=>l.sofa)), ...S.ARB_PENDING.map(a=>a.sofa), ...S.MODEL_PENDING.map(p=>p.sofa)].filter(Boolean);
  let sofa = {};
  try { sofa = await sofaResults(sofaIds); if (Object.keys(sofa).length) console.log(`· SofaScore (refuerzo): ${Object.keys(sofa).length} resultados por ID`); }
  catch(e){ console.log('· SofaScore no disponible:', e.message); }
  // si ESPN falló algún día, esta vez NO se caduca nada (no anular por culpa de un fallo de red)
  const noExpire = espnFailures.length > 0 || !espn.length;
  if (noExpire) console.log(`· ⚠ ESPN falló en ${espnFailures.length} consultas → hoy no se anula nada por "sin resultado"`);
  const n = settleState(S, { matches, sofa, manualWinners: loadManualWinners(), manualVoids: loadManualVoids(), surnameKey, noExpire });
  const wlv = o => `${o.W} ganadas · ${o.L} falladas · ${o.V} anuladas`;
  console.log(`· liquidados → picks: ${wlv(n.picks)} | combis: ${wlv(n.combos)} | modelo: ${n.model} | surebets: ${n.arbs}`);
  if (n.expired) console.log(`· ${n.expired} sin resultado tras 21 días → ANULADOS (motivo "sin resultado")`);
  if (n.fixed) console.log(`· ${n.fixed} registros del historial corregidos (pareja + fecha)`);
  console.log(`· siguen pendientes: ${S.PENDING.length} picks · ${S.COMBO_PENDING.length} combis · ${S.MODEL_PENDING.length} predicciones del modelo`);
  return n;
}
/* resultado del peldaño del reto escalera: true/false, 'V' (retirada) o null */
function ladderResult(rung){
  const [h, a] = splitMatch(rung.match);
  const ph = pickIsHome(rung, h, a);
  if (ph === null) return null;
  const when = rung.ts ? { ts:rung.ts } : (dayLabelTs(rung.date) ? { from:dayLabelTs(rung.date)-DAY, to:dayLabelTs(rung.date)+2*DAY } : null);
  const r = pairResult(h, a, ph, when, LAST_MATCHES);
  return r === 'V' ? 'V' : r === 'W' ? true : r === 'L' ? false : null;
}
/* historial del más reciente al más antiguo (los registros viejos solo tienen "18 JUL") */
function sortByDate(arr){
  const t = x => x.ts || dayLabelTs(x.date) || 0;
  return arr.map((x,i)=>[x,i]).sort((p,q)=> (t(q[0]) - t(p[0])) || (p[1]-q[1])).map(p=>p[0]);
}

/* ---- engine (mirror of data.js) ---- */
/* unifica casas duplicadas por MARCA: betfair_ex_uk / betfair-ex / betfair → "betfair",
   onexbet / 1xbet → "1xbet", winamax_fr / winamax.es → "winamax", unibet_* → "unibet"… */
function canonBook(id, title){
  let s=(title||id||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
  s=s.replace(/\(.*?\)/g,'').replace(/\b(uk|eu|fr|de|es|it|se|nl|dk|ie|au|com)\b/g,'').replace(/[^a-z0-9]/g,'');
  const alias={ onexbet:'1xbet', betfairexchange:'betfair', betfairex:'betfair', betfairsportsbook:'betfair', sport888:'888sport', '888':'888sport' };
  return alias[s] || s || id;
}
/* CASAS bloqueadas: mercado España. Deja fuera variantes regionales/raras.
   Edita BOOK_DENY para añadir o quitar (por id o nombre, minúsculas). */
const BOOK_DENY = ['marathon','nordicbet','coolbet','pmu','betonline','betanything','everygame','gtbets','ladbrokes','bwin.be','bwinbe','unibet.be','unibetbe','22bet','tipico'];
function bookDenied(id, title){
  const s = ((id||'')+' '+(title||'')).toLowerCase();
  return BOOK_DENY.some(d => s.includes(d));
}
function dedupeBooks(MATCHES, BOOKS){
  const canonOf={}, newBooks={};
  for(const id in BOOKS){ const c=canonBook(id, BOOKS[id]&&BOOKS[id].name); canonOf[id]=c; if(!newBooks[c]) newBooks[c]=Object.assign({}, BOOKS[id], { id:c }); }
  MATCHES.forEach(m=>{ ['home','away'].forEach(k=>{ const src=m.odds[k]||{}, out={}; for(const b in src){ const c=canonOf[b]||canonBook(b); if(out[c]==null || src[b]>out[c]) out[c]=src[b]; } m.odds[k]=out; }); });
  for(const k in BOOKS) delete BOOKS[k];
  Object.assign(BOOKS, newBooks);
}
function bestPrice(map){ let b=null; for(const k in map) if(!b||map[k]>b.price) b={book:k,price:map[k]}; return b; }
function saneBest(map){ const v=Object.values(map).sort((x,y)=>x-y),n=v.length; const med=n?(n%2?v[(n-1)/2]:(v[n/2-1]+v[n/2])/2):0; let b=null; for(const k in map){const p=map[k]; if(med&&(p>med*1.6||p<med*0.55))continue; if(!b||p>b.price)b={book:k,price:p};} return b||bestPrice(map); }
function marketProbs(m){ const avg=o=>{const v=Object.values(o);return v.reduce((s,x)=>s+1/x,0)/v.length;}; const a=avg(m.odds.home),b=avg(m.odds.away),s=a+b; return {home:a/s,away:b/s}; }
function matchValue(m){ const mk=marketProbs(m); const useModel=m.model&&typeof m.model.home==='number'; const prob=useModel?{home:m.model.home,away:m.model.away}:mk; const MIN_P=0.35,MAX_ODD=4.50,MAX_GAP=0.18; const minEdge=(odd)=>Math.max(2,2*Math.pow(odd/1.5,3.2)); const all=['home','away'].map(k=>{const best=saneBest(m.odds[k]);const ev=(prob[k]*best.price-1)*100;const gap=Math.abs(prob[k]-mk[k]);const eligible=prob[k]>=MIN_P&&best.price<=MAX_ODD&&ev>=minEdge(best.price)&&gap<=MAX_GAP;return{k,p:prob[k],best,edge:ev,eligible};}); const outs=[...all].sort((a,b)=>(b.eligible-a.eligible)||(b.edge-a.edge)); const top=outs[0]; return {pick:top,edge:top.edge,positive:top.eligible}; }
/* surebet: back both sides at their best book; marginPct>0 → guaranteed profit */
function arbOf(m){ const legs=['home','away'].map(k=>{const all=m.odds[k];const best=bestPrice(all);const v=Object.values(all).sort((a,b)=>a-b),n=v.length;const med=n?(n%2?v[(n-1)/2]:(v[n/2-1]+v[n/2])/2):0;return {k,book:best.book,price:best.price,suspicious:med&&best.price>med*1.7};}); const inv=legs.reduce((s,l)=>s+1/l.price,0); const marginPct=(1-inv)*100; const susp=legs.some(l=>l.suspicious); return { legs, marginPct, hasArb: marginPct>0.01 && marginPct<=8 && !susp }; }

/* ---- OUR MODEL: Elo + surface + recent form ---- */
let RATINGS = {};
try { RATINGS = require('./ratings.js'); } catch(e){ console.log('· ratings.js no encontrado, modelo desactivado'); }
function lastKey(full){ const t=(full||'').trim().split(/\s+/); const rest=t.length>1?t.slice(1).join(''):t.join(''); return rest.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]/g,''); }
function surfaceOf(key, event){
  const s = ((key||'')+' '+(event||'')).toLowerCase();
  if (/grass|halle|queen|wimbledon|stuttgart|hertogenbosch|libema|eastbourne|nottingham|bad_homburg|berlin/.test(s)) return 'grass';
  if (/clay|roland|french|madrid|rome|monte|barcelona|hamburg|bastad|gstaad|kitzbuhel|umag|estoril/.test(s)) return 'clay';
  return 'hard';
}
function eloOf(name, surface){
  const k = lastKey(name);
  const base = (LIVE_ELO[k] != null) ? LIVE_ELO[k] : (RATINGS[k] ? RATINGS[k].elo : null);
  if (base == null) return null;
  const surfDelta = RATINGS[k] ? (RATINGS[k][surface[0]] || 0) : 0;
  // bonus por forma reciente (últimos 5): cada victoria suma, cada derrota resta, cap ±25
  const f = (FORM_DB[k]||[]).slice(-5);
  const fb = f.length>=3 ? Math.max(-25, Math.min(25, (f.filter(r=>r==='W').length - f.filter(r=>r==='L').length)*7)) : 0;
  return base + surfDelta + fb;
}
/* learn Elo from finished matches (self-updating, K=24, surface-neutral base) */
let LIVE_ELO = {}, ELO_DONE = {}, RANK_ELO = {}, RANK_TS = 0;
let FORM_DB = {}, FORM_DONE = {};   // historial W/L por jugador (clave lastKey) + dedup de partidos ya contados
const SEEDED = new Set();   // jugadores cuyo Elo se INVENTÓ del mercado (no los conocemos de verdad)
function seedElo(name){ const k=lastKey(name); if(LIVE_ELO[k]!=null) return LIVE_ELO[k]; LIVE_ELO[k] = RATINGS[k] ? RATINGS[k].elo : 1700; return LIVE_ELO[k]; }
function updateElo(scores){
  let n=0;
  for(const s of scores){
    const w = winnerOf(s);
    if(!w || !s.id || ELO_DONE[s.id]) continue;
    const players=(s.scores||[]).map(x=>x.name);
    const loser=players.find(p=>p!==w);
    if(!loser) continue;
    const ew=seedElo(w), el=seedElo(loser);
    const exp=1/(1+Math.pow(10,(el-ew)/400)), K=24;
    LIVE_ELO[lastKey(w)]=Math.round(ew+K*(1-exp));
    LIVE_ELO[lastKey(loser)]=Math.round(el-K*(1-exp));
    ELO_DONE[s.id]=1; n++;
  }
  return n;
}
/* model win prob of home using surface-adjusted Elo (+ optional form nudge) */
function modelProbs(homeName, awayName, surface, formMap){
  // si NO conocemos de verdad a algún jugador (Elo inventado del mercado) → sin modelo
  if (SEEDED.has(lastKey(homeName)) || SEEDED.has(lastKey(awayName))) return null;
  let eh = eloOf(homeName, surface), ea = eloOf(awayName, surface);
  if (eh == null || ea == null) return null;           // unknown player → no model
  if (formMap){
    const fn = (nm)=>{ const f=formMap[lastKey(nm)]; if(!f||!f.length) return 0; const w=f.filter(x=>x==='W').length; return (w - (f.length-w)) * 12; };
    eh += fn(homeName); ea += fn(awayName);
  }
  const ph = 1/(1 + Math.pow(10, (ea - eh)/400));
  return { home: ph, away: 1-ph, fromModel:true, eloH:Math.round(eh), eloA:Math.round(ea), surface };
}

async function main(){
  // SCORES-ONLY mode: cheap refresh that only settles finished picks/combos/surebets.
  if ((process.env.ODDS_MODE||'').toLowerCase()==='scores'){ await scoresOnly(); return; }
  // load the self-updating Elo learned so far (seeded from ratings.js on first run)
  try { const prevE = JSON.parse(fs.readFileSync(OUT,'utf8')); LIVE_ELO = prevE.ELO || {}; ELO_DONE = prevE.ELO_DONE || {}; RANK_ELO = prevE.RANK_ELO || {}; RANK_TS = prevE.RANK_TS || 0; FORM_DB = prevE.FORM_DB || {}; FORM_DONE = prevE.FORM_DONE || {}; } catch(e){}
  if (Object.keys(LIVE_ELO).length === 0) { for (const k in RATINGS) LIVE_ELO[k] = RATINGS[k].elo; console.log(`· Elo sembrado con ${Object.keys(LIVE_ELO).length} jugadores de ratings.js`); }
  // RANKING ATP/WTA → Elo base (1 vez por semana). Da nivel real a TODOS los rankeados (incl. challenger).
  let RANKING = [];
  try { const prevR = JSON.parse(fs.readFileSync(OUT,'utf8')); RANKING = prevR.RANKING || []; } catch(e){}
  if (APITENNIS_KEY && (Date.now() - (RANK_TS||0) > 7*24*3600*1000)){
    try { const re = await fetchRankElo(APITENNIS_KEY); if (re && re.elo && Object.keys(re.elo).length){ RANK_ELO = re.elo; RANK_TS = Date.now(); if (re.list && re.list.length) RANKING = re.list; } } catch(e){ console.log('· rankings no disponibles:', e.message); }
  }
  // siembra el Elo base de ranking en jugadores que aún no hemos aprendido (no pisa lo aprendido)
  for (const k in RANK_ELO){ if (LIVE_ELO[k] == null) LIVE_ELO[k] = RANK_ELO[k]; }

  let keys = SPORT.split(',').map(s=>s.trim()).filter(Boolean);
  if (keys.length===1 && keys[0].toLowerCase()==='auto'){
    try { keys = (await discoverTennis()).slice(0, MAX); console.log(`· AUTO: torneos de tenis activos → ${keys.join(', ') || '(ninguno)'}`); }
    catch(e){ console.log('· AUTO falló:', e.message); keys = []; }
  }
  if (!keys.length){ console.log('· Sin torneos de tenis activos ahora mismo.'); }

  // pull odds
  const raw = [];
  for (const key of keys){ const r = await fetchOdds(key); raw.push(...r); }

  // OddsPapi: rellena Challenger + ATP250/WTA125K (+ ITF si sobra) que The Odds API no cubre.
  if (process.env.ODDSPAPI_KEY) {
    try {
      const fetchOddspapi = require('./oddspapi.js');
      const extra = await fetchOddspapi(process.env.ODDSPAPI_KEY, {
        windowHours: WINDOW_HOURS,
        maxOdds: parseInt(process.env.ODDSPAPI_MAX || '6', 10),
        existingEvents: raw,
      });
      raw.push(...extra);
    } catch(e){ console.log('· OddsPapi no disponible:', e.message); }
  }

  const now = Date.now();
  const horizon = now + WINDOW_HOURS*3600*1000;
  const BOOKS = {}, PLAYERS = {}, MATCHES = [];
  const COLORS = ['#e23b2e','#0a7d3c','#0a2d6e','#14805e','#ffb000','#d11a2a','#0a6cff','#1c1c1c','#7a4ddb','#d9730d'];

  raw.forEach(({ev,key})=>{
    const ct = new Date(ev.commence_time).getTime();
    // CORTAFUEGOS: solo cuotas PRE-PARTIDO. Si ya empezó (o empieza en <2 min) lo descartamos,
    // porque las cuotas en directo son volátiles/erróneas (favorito a 1.01, etc.).
    if (ct < now + 2*60*1000 || ct > horizon) return;
    if (!ev.home_team || !ev.away_team || !ev.bookmakers || !ev.bookmakers.length) return;

    const evName = ev._event || eventName(key);
    const evTour = ev._tour || tourOf(key);
    const hId = slug(ev.home_team), aId = slug(ev.away_team);
    PLAYERS[hId] = PLAYERS[hId] || { id:hId, name:shortName(ev.home_team), country:'', flag:'', seed:'', tour:evTour, elo:null, form:[] };
    PLAYERS[aId] = PLAYERS[aId] || { id:aId, name:shortName(ev.away_team), country:'', flag:'', seed:'', tour:evTour, elo:null, form:[] };

    const oddsH = {}, oddsA = {};
    ev.bookmakers.forEach((bk,i)=>{
      const mkt = (bk.markets||[]).find(m=>m.key==='h2h');
      if (!mkt) return;
      const oH = mkt.outcomes.find(o=>o.name===ev.home_team);
      const oA = mkt.outcomes.find(o=>o.name===ev.away_team);
      if (!oH || !oA) return;
      const bid = bk.key;
      if (bookDenied(bid, bk.title)) return;   // casas no relevantes para España / cuotas raras → fuera
      BOOKS[bid] = BOOKS[bid] || { id:bid, name:bk.title||bid, abbr:(bk.title||bid).replace(/[^a-zA-Z0-9]/g,'').slice(0,3).toUpperCase(), color: COLORS[Object.keys(BOOKS).length % COLORS.length] };
      oddsH[bid] = +oH.price; oddsA[bid] = +oA.price;
    });
    if (Object.keys(oddsH).length < 2) return;                  // need 2+ books for value/arb

    const surface = surfaceOf(key, evName);
    // Si no conocemos a un jugador (challenger/ITF), le SEMBRAMOS un Elo derivado de la cuota
    // de mercado de ESTE partido. Así TODOS tienen rating y, con los resultados reales, el
    // modelo lo va refinando solo (updateElo) — y con el tiempo encuentra valor en los bajos.
    { const mk0=marketProbs({odds:{home:ev.bookmakers&&oddsH,away:oddsA}});
      const seedFromMarket=(name, pImplied, oppName)=>{
        const k=lastKey(name);
        if (LIVE_ELO[k]!=null || (RATINGS[k]&&RATINGS[k].elo!=null) || RANK_ELO[k]!=null) return;
        const ok=lastKey(oppName), oppE=(LIVE_ELO[ok]!=null?LIVE_ELO[ok]:(RATINGS[ok]?RATINGS[ok].elo:1700));
        const p=Math.min(0.92, Math.max(0.08, pImplied));
        LIVE_ELO[k]=Math.round(oppE + 400*Math.log10(p/(1-p)));   // Elo que reproduce esa prob vs el rival
        SEEDED.add(k);                                            // marcado como "no lo conocemos de verdad"
      };
      seedFromMarket(ev.home_team, mk0.home, ev.away_team);
      seedFromMarket(ev.away_team, mk0.away, ev.home_team);
    }
    const model = modelProbs(ev.home_team, ev.away_team, surface, null);
    MATCHES.push({
      id: ev.id, tour:evTour, event:evName, round:'', surface: surface==='grass'?'Hierba':surface==='clay'?'Tierra':'Dura', time:fmtTime(ev.commence_time), day:fmtDay(ev.commence_time),
      home:hId, away:aId, odds:{ home:oddsH, away:oddsA },
      model: model || undefined,
      noModel: model ? undefined : true,   // jugador desconocido → ocultar en la web
      ts: new Date(ev.commence_time).getTime(),
      sofa: ev._sofa || null,
      _commence: ev.commence_time, _sport:key,
    });
  });

  // MERGE with previous board: keep matches from the last run that haven't STARTED yet
  // and aren't in today's fetch. This stops the board (and its surebets/value picks) from
  // vanishing just because OddsPapi rotated to a different set of 6 matches.
  try {
    const prevD = JSON.parse(fs.readFileSync(OUT,'utf8'));
    const haveIds = new Set(MATCHES.map(m=>m.id));
    const LIVE_WINDOW = 8*3600*1000;                 // keep a started match on the board up to 8h
    const cutoff = Date.now() - LIVE_WINDOW;          // older than that → assume done, drop
    (prevD.MATCHES||[]).forEach(pm=>{
      if (haveIds.has(pm.id)) return;                 // refreshed this run → use the new one
      const ts = pm.ts || (pm._commence ? new Date(pm._commence).getTime() : 0);
      if (!ts || ts < cutoff) return;                 // too old → let it go
      [pm.home, pm.away].forEach(pid=>{ if(prevD.PLAYERS && prevD.PLAYERS[pid] && !PLAYERS[pid]) PLAYERS[pid]=prevD.PLAYERS[pid]; });
      Object.assign(BOOKS, Object.fromEntries(Object.entries(prevD.BOOKS||{}).filter(([k])=>!BOOKS[k])));
      MATCHES.push(Object.assign({}, pm, { ts, live: ts<=Date.now(), _commence: pm._commence || new Date(ts).toISOString(), _sport: pm._sport || 'tennis_prev' }));
      haveIds.add(pm.id);
    });
  } catch(e){}

  MATCHES.sort((a,b)=> new Date(a._commence)-new Date(b._commence));

  // ---- FOTOS (siempre, independiente de la liquidación) ----
  // Se aplican SOLO desde la biblioteca player-photos.json. Así, corra lo que corra
  // (odds o results), todos los jugadores con foto en la biblioteca la tienen.
  try {
    const canonF = require('./name-canon.js').canonSurname;
    const simpleF = (n)=>(n||'').trim().split(/\s+/).pop().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]/gi,'').toLowerCase();
    let lib={}; try { lib=(JSON.parse(fs.readFileSync(__dirname+'/player-photos.json','utf8')).photos)||{}; } catch(e){}
    const noPhoto=[];
    Object.values(PLAYERS).forEach(p=>{ const u=lib[canonF(p.name)]||lib[simpleF(p.name)]; if(u) p.photo=u; else if(!p.photo) noPhoto.push(p.name); const fk=lastKey(p.name); if(FORM_DB[fk]&&FORM_DB[fk].length) p.form=FORM_DB[fk].slice(-5); });
    if (noPhoto.length) console.log(`· ${noPhoto.length} jugadores SIN foto en biblioteca: ${noPhoto.join(', ')}`);
  } catch(e){ console.log('· fotos biblioteca error:', e.message); }


  const valued = MATCHES.map(m=>({m,v:matchValue(m)})).filter(x=>x.v.positive).sort((a,b)=>b.v.edge-a.v.edge);
  const label = (m,k)=> 'Gana ' + PLAYERS[k==='home'?m.home:m.away].name;
  const legOf = (x)=>({ id:x.m.id, sport:x.m._sport, ts:new Date(x.m._commence).getTime(), side:x.v.pick.k, sofa:x.m.sofa||null,
                        match:`${PLAYERS[x.m.home].name} – ${PLAYERS[x.m.away].name}`, pick:label(x.m,x.v.pick.k),
                        odd:+x.v.pick.best.price.toFixed(2), book:x.v.pick.best.book });
  const COMBOS = [];
  // Construye una combinada en UNA SOLA CASA: elige la casa que, teniendo cuota para
  // TODAS las selecciones, da la cuota combinada (producto) más alta. Más fácil de apostar.
  const buildCombo = (id, name, picks)=>{
    // casas que tienen cuota para todas las piernas en el lado elegido
    const common = picks.reduce((acc,x)=>{
      const o = x.m.odds[x.v.pick.k] || {};
      const books = Object.keys(o).filter(b=> o[b] > 1);
      return acc===null ? books : acc.filter(b=> books.includes(b));
    }, null) || [];
    let book=null, prod=0;
    common.forEach(b=>{
      const p = picks.reduce((pr,x)=> pr * x.m.odds[x.v.pick.k][b], 1);
      if (p > prod){ prod = p; book = b; }   // la casa con mayor cuota combinada
    });
    const legs = picks.map(x=>{
      const o = x.m.odds[x.v.pick.k] || {};
      const useBook = book && o[book] > 1 ? book : x.v.pick.best.book;   // si no hay casa común, cae a la mejor por pierna
      const useOdd  = book && o[book] > 1 ? o[book] : x.v.pick.best.price;
      return { id:x.m.id, sport:x.m._sport, ts:new Date(x.m._commence).getTime(), side:x.v.pick.k, sofa:x.m.sofa||null,
               match:`${PLAYERS[x.m.home].name} – ${PLAYERS[x.m.away].name}`, pick:label(x.m,x.v.pick.k),
               odd:+useOdd.toFixed(2), book:useBook };
    });
    return { id, name, conf:conf(picks), book: book||null, legs };
  };
  // Para COMBINADAS: favoritos creíbles, pero no tan estrictos como antes (salían pocas).
  const comboLeg = (x)=> x.v.pick && x.v.pick.best && x.v.pick.best.price <= 2.20 && x.v.pick.p >= 0.50;
  let surePool = MATCHES.map(m=>({m,v:matchValue(m)})).filter(comboLeg).sort((a,b)=>b.v.pick.p-a.v.pick.p);
  // fallback: si quedan pocos favoritos, completa con los más probables del día (sin tope)
  if (surePool.length < 3){
    const extra = MATCHES.map(m=>({m,v:matchValue(m)})).filter(x=>x.v.pick&&x.v.pick.best&&x.v.pick.best.price<=3.0)
      .sort((a,b)=>b.v.pick.p-a.v.pick.p);
    const seen=new Set(surePool.map(x=>x.m.id));
    extra.forEach(x=>{ if(!seen.has(x.m.id)){ surePool.push(x); seen.add(x.m.id); } });
  }
  // pool de valor PERO acotado: con valor y cuota no disparada (≤2.40), para la "Valor"
  const valPool = valued.filter(x=>x.v.pick.best.price<=2.40).sort((a,b)=>b.v.edge-a.v.edge);
  const conf = (arr)=> Math.round(arr.reduce((p,x)=>p*x.v.pick.p,1)*100);
  // c1 — Combinada del Día: 3 favoritos (o 2 si solo hay 2 partidos)
  if (surePool.length>=2){
    const n = surePool.length>=3 ? 3 : 2;
    COMBOS.push(buildCombo('c1', 'Combinada del Día', surePool.slice(0,n)));
  }
  if (valPool.length>=2){
    const legs=valPool.slice(0,3);
    const sig=legs.map(l=>l.m.id).sort().join('|');
    const sig1=surePool.slice(0,3).map(l=>l.m.id).sort().join('|');
    if (sig!==sig1) COMBOS.push(buildCombo('c2', 'Combinada Valor', legs));
  }

  // ---- track record (settle finished picks via scores) ----
  let RECORD=[], PENDING=[], COMBO_RECORD=[], COMBO_PENDING=[], ARB_RECORD=[], ARB_PENDING=[], MODEL_RECORD=[], MODEL_PENDING=[], LADDER=null, LADDER_HISTORY=[];
  try { const prev=JSON.parse(fs.readFileSync(OUT,'utf8')); RECORD=prev.RECORD||[]; PENDING=prev.PENDING||[]; COMBO_RECORD=prev.COMBO_RECORD||[]; COMBO_PENDING=prev.COMBO_PENDING||[]; ARB_RECORD=prev.ARB_RECORD||[]; ARB_PENDING=prev.ARB_PENDING||[]; MODEL_RECORD=prev.MODEL_RECORD||[]; MODEL_PENDING=prev.MODEL_PENDING||[]; LADDER=prev.LADDER||null; LADDER_HISTORY=prev.LADDER_HISTORY||[]; } catch(e){}
  // RESET=1 → empieza el historial de cero (para limpiar datos viejos corruptos)
  if (process.env.RESET==='1'){ RECORD=[]; PENDING=[]; COMBO_RECORD=[]; COMBO_PENDING=[]; ARB_RECORD=[]; ARB_PENDING=[]; MODEL_RECORD=[]; MODEL_PENDING=[]; LADDER=null; LADDER_HISTORY=[]; console.log('· RESET: historial vaciado, empezando limpio'); }

  // dedup
  const dedupe=(arr,key)=>{const s=new Set();return arr.filter(o=>{const k=key(o);if(s.has(k))return false;s.add(k);return true;});};
  const normPick=s=>(s||'').replace(/^gana\s+/i,'').replace(/^[A-Za-z]\.\s*/,'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
  // normalise a "A. Kalinskaya – M. Chwalińska" / "Kalinskaya – Chwalinska" to the same key
  const normSide=s=>(s||'').trim().replace(/^[A-Za-z]\.\s*/,'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
  const normMatch=m=>(m||'').split(/[–\-]/).map(normSide).filter(Boolean).sort().join('|');
  // record/pending dedup ignore date + initials/accents → one entry per match+pick
  const sSig=r=>`${normMatch(r.match)}|${normPick(r.pick||r.pickLabel)}`;
  const pendKey=p=>`${normMatch(p.match)}|${normPick(p.pickLabel||p.pick)}`;
  const cKey=c=>`${(c.legs||[]).map(l=>`${normMatch(l.match)}|${normPick(l.pick)}`).sort().join('+')}`;
  const aKey=a=>normMatch(a.match);
  RECORD=dedupe(RECORD,sSig); PENDING=dedupe(PENDING,pendKey); COMBO_RECORD=dedupe(COMBO_RECORD,cKey); COMBO_PENDING=dedupe(COMBO_PENDING,cKey); ARB_RECORD=dedupe(ARB_RECORD,aKey); ARB_PENDING=dedupe(ARB_PENDING,aKey);

  // ---- SEED: manually-added picks waiting to be settled (robot/seed-pending.json) ----
  // Lets us re-inject picks that were missed. Added only if not already pending/settled.
  try {
    const seed = JSON.parse(fs.readFileSync(__dirname + '/seed-pending.json', 'utf8'));
    const seenP = new Set([...PENDING, ...RECORD].map(sSig));
    (seed.PENDING || []).forEach(p => { if (!seenP.has(sSig(p))) { PENDING.push(p); seenP.add(sSig(p)); } });
    // surebets que añadimos a mano → directos al HISTORIAL (beneficio garantizado, no se espera resultado)
    const seenA = new Set([...ARB_PENDING, ...ARB_RECORD].map(aKey));
    (seed.ARB_PENDING || []).forEach(a => { if (!seenA.has(aKey(a))) { ARB_RECORD.unshift(a); seenA.add(aKey(a)); } });
    console.log(`· seed: +${(seed.PENDING||[]).length} picks · +${(seed.ARB_PENDING||[]).length} surebets (los nuevos)`);
  } catch(e){ /* no seed file → ignore */ }

  // ---- LIQUIDACIÓN: ESPN por pareja + fecha (gratis). Ver robot/settle.js ----
  const S = { RECORD, PENDING, COMBO_RECORD, COMBO_PENDING, ARB_RECORD, ARB_PENDING, MODEL_RECORD, MODEL_PENDING };
  try { await runSettlement(S); }
  catch(e){ console.log('· liquidación no disponible:', e.message); }
  ({ RECORD, PENDING, COMBO_RECORD, COMBO_PENDING, ARB_RECORD, ARB_PENDING, MODEL_RECORD, MODEL_PENDING } = S);
  try {
    // fotos + Elo base de SofaScore (gratis, permanente, cubre todo el circuito)
    try {
      const sr = await sofaRankings();
      const canon = require('./name-canon.js').canonSurname;
      // refresca player-photos.json 1 vez/semana desde el ranking ATP/WTA (auto, ~1800 jugadores)
      let manual={}; const pf=__dirname+'/player-photos.json';
      try { const j=JSON.parse(fs.readFileSync(pf,'utf8')); manual=j.photos||{};
        const age=Date.now()-(j.builtAt||0);
        if (APITENNIS_KEY && age > 7*24*3600*1000){
          try { const built=await require('./build-photos.js')(APITENNIS_KEY);
            if (Object.keys(built).length>200){ manual=Object.assign(built, manual); fs.writeFileSync(pf, JSON.stringify({ _nota:j._nota||'auto', builtAt:Date.now(), photos:manual }, null, 2)); }
          } catch(e){ console.log('· build-photos error:', e.message); }
        }
      } catch(e){}
      // FOTOS: SOLO desde la biblioteca (player-photos.json). No se busca en la API por partido.
      // La biblioteca se (re)construye sola 1 vez/semana desde el ranking completo ATP+WTA.
      const simple=(n)=>(n||'').trim().split(/\s+/).pop().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]/gi,'').toLowerCase();
      const pick=(p)=>{ const a=canon(p.name), b=simple(p.name); return manual[a]||manual[b]||null; };
      let noPhoto=[];
      Object.values(PLAYERS).forEach(p=>{ const u=pick(p); if(u) p.photo=u; else if(!p.photo) noPhoto.push(p.name+' ['+canon(p.name)+']'); });
      if (noPhoto.length) console.log(`· ${noPhoto.length} jugadores SIN foto en biblioteca: ${noPhoto.join(', ')}`);
    } catch(e){ console.log('· SofaScore fotos no disponibles:', e.message); }
    const scores=[];
    const learned = updateElo(scores);            // self-update Elo from finished matches
    if (learned) console.log(`· Elo actualizado con ${learned} resultados`);
    // acumula FORMA (W/L) por jugador desde los partidos terminados, sin duplicar
    (LAST_FINISHED||[]).forEach(f=>{ if(!f||!f.winner) return; const sig=surnameKey(f.home)+'|'+surnameKey(f.away)+'|'+surnameKey(f.winner); if(FORM_DONE[sig]) return; FORM_DONE[sig]=1; const wk=lastKey(f.winner), lk=lastKey(f.winner===f.home?f.away:f.home); if(wk){(FORM_DB[wk]=FORM_DB[wk]||[]).push('W'); FORM_DB[wk]=FORM_DB[wk].slice(-10);} if(lk){(FORM_DB[lk]=FORM_DB[lk]||[]).push('L'); FORM_DB[lk]=FORM_DB[lk].slice(-10);} });
  } catch(e){ console.log('· fotos/forma no disponibles:', e.message); }

  // snapshot today's picks + combos as pending
  const today=fmtDay(new Date().toISOString());

  // ---- MODEL ACCURACY: snapshot la predicción del modelo para CADA partido del tablero ----
  // (favorito según el modelo). NO es pick de apuesta, NO cuenta para el ROI. Solo precisión.
  { const mSig=p=>`${(p.match||'').toLowerCase()}`;
    const mSeen=new Set([...MODEL_PENDING.map(mSig), ...MODEL_RECORD.map(mSig)]);
    MATCHES.forEach(m=>{
      const mk=marketProbs(m); const mdl=(m.model&&typeof m.model.home==='number')?m.model:mk;
      const predHome = mdl.home>=mdl.away;
      const match=`${PLAYERS[m.home].name} – ${PLAYERS[m.away].name}`;
      if(mSeen.has(match.toLowerCase())) return;
      MODEL_PENDING.push({ date:fmtDay(m._commence||new Date().toISOString()), ts:new Date(m._commence||Date.now()).getTime(),
        match, predHome, prob:Math.round((predHome?mdl.home:mdl.away)*100),
        predName:(predHome?PLAYERS[m.home]:PLAYERS[m.away]).name, sofa:m.sofa||null,
        homeName:PLAYERS[m.home].name, awayName:PLAYERS[m.away].name });
      mSeen.add(match.toLowerCase());
    });
  }

  // ---- RETO ESCALERA: liquida el peldaño de hoy y genera el siguiente ----
  // Banca 10€ → meta 250€ en ~10 peldaños, cada uno con el pick MÁS CLARO del día.
  try {
    const LAD_START=10, LAD_TARGET=250, LAD_STEPS=10;
    if(!LADDER) LADDER={ id:'L'+Date.now().toString(36), start:LAD_START, target:LAD_TARGET, steps:LAD_STEPS, current:0, status:'live', bank:LAD_START, rungs:[] };

    // 1) liquidar el peldaño marcado "today" si su partido ya terminó
    const todayRung=LADDER.rungs.find(r=>r.result==='today');
    if(todayRung){
      const res=ladderResult(todayRung);
      if(res==='V'){ LADDER.rungs=LADDER.rungs.filter(r=>r!==todayRung); console.log('· Reto escalera: peldaño anulado (retirada), la banca sigue igual'); }
      else if(res===true){ todayRung.result='W'; LADDER.current++; LADDER.bank=todayRung.bank; }
      else if(res===false){
        todayRung.result='L';
        LADDER_HISTORY.unshift({ id:LADDER.id, start:LADDER.start, target:LADDER.target, brokeAt:todayRung.n, reached:+((LADDER.bank)||LADDER.start).toFixed(2), result:'broken', date:todayRung.date||today });
        LADDER=null;   // se rompió → nueva escalera
      }
    }
    // 2) ¿completada? Solo cuando la banca llega a la META (250€), no por nº de peldaños.
    if(LADDER && LADDER.bank>=LADDER.target){
      LADDER_HISTORY.unshift({ id:LADDER.id, start:LADDER.start, target:LADDER.target, reached:+LADDER.bank.toFixed(2), result:'completed', date:today });
      LADDER=null;
    } else if(LADDER && LADDER.current>=LADDER.steps){
      LADDER.steps = LADDER.current + 1;   // aún no llega a 250 → añade un peldaño (más días)
    }
    if(!LADDER) LADDER={ id:'L'+Date.now().toString(36), start:LAD_START, target:LAD_TARGET, steps:LAD_STEPS, current:0, status:'live', bank:LAD_START, rungs:[] };

    // 3) generar el peldaño de HOY si no hay uno pendiente: el pick MÁS CLARO (cuota más baja, prob alta)
    const hasToday=LADDER.rungs.some(r=>r.result==='today');
    const settledToday=LADDER.rungs.some(r=>(r.result==='W'||r.result==='L') && r.date===today);
    if(!hasToday && !settledToday && LADDER.bank<LADDER.target){
      // candidatos: favoritos creíbles del modelo, cuota 1.20–1.55, que empiecen pronto
      const cand=MATCHES.map(m=>{ const v=matchValue(m); const mk=marketProbs(m); const mdl=(m.model&&typeof m.model.home==='number')?m.model:mk;
          const k=mdl.home>=mdl.away?'home':'away'; const best=saneBest(m.odds[k]); return {m,k,prob:mdl[k],odd:best.price,book:best.book}; })
        .filter(c=> c.odd>=1.18 && c.odd<=1.55 && c.prob>=0.66 && new Date(c.m._commence).getTime()>Date.now()+30*60*1000)
        .sort((a,b)=> a.odd-b.odd);   // el más claro = cuota más baja
      const pick=cand[0];
      if(pick){
        const stepN=LADDER.current+1;
        const newBank=+((LADDER.bank||LADDER.start)*pick.odd).toFixed(2);
        LADDER.rungs=LADDER.rungs.filter(r=>r.result==='W'||r.result==='L');   // limpia placeholders
        LADDER.rungs.push({ n:stepN, match:`${PLAYERS[pick.m.home].name} – ${PLAYERS[pick.m.away].name}`,
          pick:`Gana ${PLAYERS[pick.k==='home'?pick.m.home:pick.m.away].name}`, odd:+pick.odd.toFixed(2), book:pick.book,
          bank:newBank, result:'today', date:today, ts:new Date(pick.m._commence).getTime(), sofa:pick.m.sofa||null });
        // limita peldaños futuros mostrados a la META: no rellenar más allá de lo necesario
        for(let i=stepN+1;i<=LADDER.steps;i++) LADDER.rungs.push({ n:i });
      } else { console.log('· Reto escalera: sin pick claro hoy, esperamos a mañana'); }
    }
    LADDER_HISTORY=LADDER_HISTORY.slice(0,12);
    console.log(`· Reto escalera: peldaño ${LADDER.current}/${LADDER.steps} · banca ${(LADDER.bank||LADDER.start).toFixed(2)}€ · meta ${LADDER.target}€`);
  } catch(e){ console.log('· reto escalera error:', e.message); }

  // already-settled signature (match+pick normalized) → never re-add a pick that's in the record
  const recSig=new Set(RECORD.map(sSig));
  // clean any pending that's already settled (fixes the "EN JUEGO + GANADA" duplicate)
  PENDING=PENDING.filter(p=>!recSig.has(pendKey(p)));
  const haveId=new Set([...PENDING.map(p=>p.id), ...RECORD.map(r=>r.id).filter(Boolean)]);
  valued.forEach(x=>{
    if (haveId.has(x.m.id)) return;
    const match=`${PLAYERS[x.m.home].name} – ${PLAYERS[x.m.away].name}`;
    const pickLabel=label(x.m,x.v.pick.k);
    const sig=`${normMatch(match)}|${normPick(pickLabel)}`;
    if (recSig.has(sig)) return;   // already in record → skip
    if (PENDING.some(p=>pendKey(p)===sig)) return;  // already pending → skip
    if (new Date(x.m._commence).getTime() < Date.now()-30*60*1000) return;   // already started → don't track as fresh pick
    PENDING.push({ id:x.m.id, sport:x.m._sport, ts:new Date(x.m._commence).getTime(), date:fmtDay(x.m._commence), sofa:x.m.sofa||null, pickHome:x.v.pick.k==='home',
      match, pickKey:x.v.pick.k, pickLabel,
      odd:+x.v.pick.best.price.toFixed(2), book:x.v.pick.best.book, homeName:PLAYERS[x.m.home].name, awayName:PLAYERS[x.m.away].name });
    haveId.add(x.m.id);
  });
  const haveCombo=new Set([...COMBO_PENDING, ...COMBO_RECORD].map(cKey));
  COMBOS.forEach(c=>{
    if (!c.legs.every(l=>l.id&&l.sport)) return;
    const snap={ dayId:today+'·'+c.id, date:today, name:c.name, legs:c.legs.map(l=>({ id:l.id, sport:l.sport, ts:l.ts, side:l.side, sofa:l.sofa||null, match:l.match, pick:l.pick, odd:l.odd, homeName:(l.match||'').split('–')[0].trim(), awayName:(l.match||'').split('–')[1]?l.match.split('–')[1].trim():'' })) };
    if (haveCombo.has(cKey(snap))) return;
    COMBO_PENDING.push(snap); haveCombo.add(cKey(snap));
  });
  // snapshot today's surebets (guaranteed-profit at 100€ reference) → DIRECTOS al historial
  const REF=100;
  const haveArb=new Set([...ARB_PENDING, ...ARB_RECORD].map(aKey));
  MATCHES.forEach(m=>{
    const a=arbOf(m); if(!a.hasArb) return;
    const inv=a.legs.reduce((s,l)=>s+1/l.price,0);
    const profit=+((REF/inv)-REF).toFixed(2);
    const rec={ date:today, match:`${PLAYERS[m.home].name} – ${PLAYERS[m.away].name}`, marginPct:+a.marginPct.toFixed(2), profit,
      ts:new Date(m._commence).getTime(),
      homeName:PLAYERS[m.home].name, awayName:PLAYERS[m.away].name, sport:m._sport,
      legs:a.legs.map(l=>({ pick:label(m,l.k), odd:+l.price.toFixed(2), book:l.book })) };
    if (haveArb.has(aKey(rec))) return;
    ARB_RECORD.unshift(rec); haveArb.add(aKey(rec));
  });

  // lo que no tenga resultado a los 21 días lo pasa settle.js al historial como ANULADO
  // ("sin resultado"): ya no se borra nada en silencio.
  // FINAL dedup pass — collapse any duplicate that slipped in via seed/snapshot regardless of order
  PENDING=dedupe(PENDING,pendKey);
  RECORD=dedupe(RECORD,sSig);
  COMBO_PENDING=dedupe(COMBO_PENDING,cKey); COMBO_RECORD=dedupe(COMBO_RECORD,cKey);
  ARB_PENDING=dedupe(ARB_PENDING,aKey); ARB_RECORD=dedupe(ARB_RECORD,aKey);
  // and never keep a pending that's already settled in the record
  { const done=new Set(RECORD.map(sSig)); PENDING=PENDING.filter(p=>!done.has(pendKey(p))); }
  // historial COMPLETO (sin recortes); la web ya pagina. Ordenado del más reciente al más antiguo.
  RECORD=sortByDate(RECORD); COMBO_RECORD=sortByDate(COMBO_RECORD); MODEL_RECORD=sortByDate(MODEL_RECORD);
  MATCHES.forEach(m=>{ delete m._commence; delete m._sport; });   // keep `ts` for next-run merge
  dedupeBooks(MATCHES, BOOKS);   // unifica casas duplicadas (Betfair, 1xBet, Unibet…) por marca

  // safety net: keep yesterday's board if today is empty (dead time)
  let keepMatches=MATCHES, keepPlayers=PLAYERS, keepBooks=BOOKS, keepCombos=COMBOS, stale=false;
  if (!MATCHES.length){
    try { const prev=JSON.parse(fs.readFileSync(OUT,'utf8')); if (prev.MATCHES&&prev.MATCHES.length){ keepMatches=prev.MATCHES; keepPlayers=prev.PLAYERS||{}; keepBooks=prev.BOOKS||{}; keepCombos=prev.COMBOS||[]; stale=true; console.log('  ⚠ sin partidos nuevos → conservo el tablero anterior'); } } catch(e){}
  }

  // keep ELO_DONE from growing forever
  { const ids=Object.keys(ELO_DONE); if(ids.length>1500){ const drop=ids.slice(0,ids.length-1500); drop.forEach(k=>delete ELO_DONE[k]); } }

  const daily = {
    meta:{ updatedAt:new Date().toISOString(), source:'the-odds-api', sport:'tennis', regions:REGIONS, market:MARKET,
           matches:keepMatches.length, valuePicks:valued.length, books:Object.keys(keepBooks).length, stale,
           model:{ players:Object.keys(LIVE_ELO).length }, credits:{ remaining:CREDITS.remaining, used:CREDITS.used } },
    PLAYERS:keepPlayers, BOOKS:keepBooks, MATCHES:keepMatches, COMBOS:keepCombos,
    RECORD, PENDING, COMBO_RECORD, COMBO_PENDING, ARB_RECORD, ARB_PENDING,
    MODEL_RECORD, MODEL_PENDING,
    LADDER, LADDER_HISTORY,
    RANKING: (function(){ let lib={}; try{ lib=(JSON.parse(fs.readFileSync(__dirname+'/player-photos.json','utf8')).photos)||{}; }catch(e){} const cs=require('./name-canon.js').canonSurname; return (RANKING||[]).slice(0,300).map(r=>{ const k=lastKey(r.name); return { name:r.name, tour:r.tour, rank:r.rank, elo:(LIVE_ELO[k]!=null?LIVE_ELO[k]:r.elo), country:r.country||'', photo:(lib[cs(r.name)]||lib[k]||null), form:(FORM_DB[k]||[]).slice(-5) }; }); })(),
    FORM_DB, FORM_DONE,
    ELO:LIVE_ELO, ELO_DONE, RANK_ELO, RANK_TS,
  };
  fs.writeFileSync(OUT, JSON.stringify(daily, null, 2));
  console.log(`✓ ${OUT}\n  ${keepMatches.length} partidos · ${valued.length} con valor · ${Object.keys(keepBooks).length} casas · ${COMBOS.length} combis · ${RECORD.length} en récord · ${PENDING.length} pendientes`);
  console.log(`  créditos API → usados ${CREDITS.used} · restantes ${CREDITS.remaining}`);
}

/* SCORES-ONLY mode (ODDS_MODE=scores): solo liquida picks/combis/surebets/modelo con ESPN.
   NO pide cuotas → 0 créditos; MATCHES, BOOKS y meta.credits no se tocan. */
async function scoresOnly(){
  let d;
  try { d = JSON.parse(fs.readFileSync(OUT,'utf8')); } catch(e){ console.log('· scores-only: no hay daily.json'); return; }
  const S = { RECORD:d.RECORD||[], PENDING:d.PENDING||[], COMBO_RECORD:d.COMBO_RECORD||[], COMBO_PENDING:d.COMBO_PENDING||[],
              ARB_RECORD:d.ARB_RECORD||[], ARB_PENDING:d.ARB_PENDING||[], MODEL_RECORD:d.MODEL_RECORD||[], MODEL_PENDING:d.MODEL_PENDING||[] };
  // inject manual seed (surebets → directas al historial; picks → pendientes). NO toca MATCHES ni gasta créditos.
  try {
    const seed = JSON.parse(fs.readFileSync(__dirname + '/seed-pending.json', 'utf8'));
    const sSig2=r=>`${(r.match||'').toLowerCase()}|${(r.pick||r.pickLabel||'').replace(/^gana\s+/i,'').toLowerCase()}`;
    const aKey2=a=>(a.match||'').toLowerCase();
    const seenP=new Set([...S.PENDING,...S.RECORD].map(sSig2));
    (seed.PENDING||[]).forEach(p=>{ if(!seenP.has(sSig2(p))){ S.PENDING.push(p); seenP.add(sSig2(p)); } });
    const seenA=new Set([...S.ARB_PENDING,...S.ARB_RECORD].map(aKey2));
    (seed.ARB_PENDING||[]).forEach(a=>{ if(!seenA.has(aKey2(a))){ S.ARB_RECORD.unshift(a); seenA.add(aKey2(a)); } });
  } catch(e){}
  const anythingPending = S.PENDING.length || S.COMBO_PENDING.length || S.ARB_PENDING.length || S.MODEL_PENDING.length || (d.LADDER && (d.LADDER.rungs||[]).some(r=>r.result==='today'));
  if (anythingPending){
    try { await runSettlement(S); } catch(e){ console.log('· scores-only: error', e.message); }
    // fotos desde la biblioteca (player-photos.json) / BD de SofaScore (gratis)
    if (d.PLAYERS){
      try {
        const sr = await sofaRankings();
        const canon = require('./name-canon.js').canonSurname;
        let manual={}; try { manual=(JSON.parse(fs.readFileSync(__dirname+'/player-photos.json','utf8')).photos)||{}; } catch(e){}
        Object.values(d.PLAYERS).forEach(p=>{ const k=canon(p.name); if(manual[k]) p.photo=manual[k]; else if(!p.photo && sr.photos[k]) p.photo=sr.photos[k]; });
      } catch(e){}
    }
    // RETO ESCALERA (solo liquidar el peldaño de hoy; NO genera el siguiente — eso lo hace el run de odds)
    try {
      const L=d.LADDER; const LH=d.LADDER_HISTORY||[];
      if(L && Array.isArray(L.rungs)){
        const tr=L.rungs.find(r=>r.result==='today');
        const res=tr ? ladderResult(tr) : null;
        if(res==='V'){ L.rungs=L.rungs.filter(r=>r!==tr); console.log('· Reto escalera: peldaño anulado (retirada), la banca sigue igual'); }
        else if(res!==null){
          if(res){ tr.result='W'; L.current=(L.current||0)+1; L.bank=tr.bank; }
          else { tr.result='L'; LH.unshift({id:L.id,start:L.start,target:L.target,brokeAt:tr.n,reached:+((L.bank)||L.start).toFixed(2),result:'broken',date:tr.date||''}); d.LADDER=null; }
          d.LADDER_HISTORY=LH.slice(0,12);
          console.log('· Reto escalera (ESPN): peldaño '+tr.n+' → '+(res?'GANADO':'FALLADO'));
        }
        if(d.LADDER && d.LADDER.bank>=d.LADDER.target){ LH.unshift({id:d.LADDER.id,start:d.LADDER.start,target:d.LADDER.target,reached:+d.LADDER.bank.toFixed(2),result:'completed',date:''}); d.LADDER=null; d.LADDER_HISTORY=LH.slice(0,12); } else if(d.LADDER && d.LADDER.current>=d.LADDER.steps){ d.LADDER.steps=d.LADDER.current+1; }
      }
    } catch(e){ console.log('· escalera scores-only error:', e.message); }
  } else console.log('· scores-only: nada pendiente (seed inyectado si había)');
  // historial COMPLETO (sin recortes), del más reciente al más antiguo
  d.RECORD=sortByDate(S.RECORD); d.PENDING=S.PENDING; d.COMBO_RECORD=sortByDate(S.COMBO_RECORD); d.COMBO_PENDING=S.COMBO_PENDING;
  d.ARB_RECORD=S.ARB_RECORD; d.ARB_PENDING=S.ARB_PENDING; d.MODEL_RECORD=sortByDate(S.MODEL_RECORD); d.MODEL_PENDING=S.MODEL_PENDING;
  if(d.meta) d.meta.updatedAt=new Date().toISOString();
  fs.writeFileSync(OUT, JSON.stringify(d,null,2));
  const tally = arr => { const t={W:0,L:0,V:0}; arr.forEach(r=>{ if(t[r.result]!=null) t[r.result]++; }); return `${t.W}W/${t.L}L/${t.V}V`; };
  console.log(`✓ scores-only: historial picks ${d.RECORD.length} (${tally(d.RECORD)}) · combis ${d.COMBO_RECORD.length} (${tally(d.COMBO_RECORD)}) · pendientes ${d.PENDING.length} picks / ${d.COMBO_PENDING.length} combis`);
}

main().catch(e=>{ console.error('✗', e); process.exit(1); });
