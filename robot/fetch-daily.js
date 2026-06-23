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
const espnResults = require('./espn-results.js');
let LAST_FINISHED = [];   // pares terminados (api-tennis+ESPN) accesibles fuera del bloque de liquidación (reto escalera)
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

/* ---- manual results (results.json) — The Odds API no da resultados de tenis,
   así que el dueño escribe los apellidos ganadores y liquidamos con eso. ---- */
function surnameKey(name){ return (name||'').trim().replace(/[.,;:]+$/,'').split(/\s+/).pop().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9-]/gi,'').toLowerCase(); }
function loadManualWinners(){
  try { const r = JSON.parse(fs.readFileSync(__dirname + '/results.json','utf8')); return (r.winners||[]).map(surnameKey).filter(Boolean); }
  catch(e){ return []; }
}
function manualPickResult(p, winners){
  if (!winners.length) return null;
  const pick = surnameKey((p.pickLabel||'').replace(/^Gana\s+/i,''));
  const home = surnameKey(p.homeName), away = surnameKey(p.awayName);
  const opp = pick === home ? away : home;
  const pw = winners.includes(pick), ow = opp && winners.includes(opp);
  if (pw && ow) return null;          // ambos ganaron algún partido → ambiguo, no fiable (deja al pair-based)
  if (pw) return true;
  if (ow) return false;
  return null;
}
function manualLegResult(leg, winners){
  if (!winners.length) return null;
  const pick = surnameKey((leg.pick||'').replace(/^Gana\s+/i,''));
  const names = (leg.match||'').split('–').map(s=>surnameKey(s));
  const opp = names.find(n=>n && n!==pick);
  const pw = winners.includes(pick), ow = opp && winners.includes(opp);
  if (pw && ow) return null;          // ambiguo → no fiable
  if (pw) return true;
  if (ow) return false;
  return null;
}
function manualMatchDone(homeName, awayName, winners){
  if (!winners.length) return false;
  return winners.includes(surnameKey(homeName)) || winners.includes(surnameKey(awayName));
}
/* ESPN pair-based resolver: requires BOTH players of the match to match a finished pair.
   Elimina el falso positivo por apellido suelto (Arnaldi ganando otro partido distinto). */
function espnPairResult(homeName, awayName, pickName, finished){
  if (!finished || !finished.length) return null;
  const h=surnameKey(homeName), a=surnameKey(awayName), pk=surnameKey(pickName);
  for (const f of finished){
    const fh=surnameKey(f.home), fa=surnameKey(f.away);
    if ((fh===h && fa===a) || (fh===a && fa===h)){    // mismo enfrentamiento
      return surnameKey(f.winner)===pk;               // ¿ganó nuestro pick?
    }
  }
  return null;                                        // ese partido no está finalizado en ESPN aún
}
function espnPairDone(homeName, awayName, finished){
  if (!finished || !finished.length) return false;
  const h=surnameKey(homeName), a=surnameKey(awayName);
  return finished.some(f=>{ const fh=surnameKey(f.home), fa=surnameKey(f.away); return (fh===h&&fa===a)||(fh===a&&fa===h); });
}
/* voids: walkover/abandono → apuesta anulada. results.json {"voided":["Arnaldi","Apellido"]} + ESPN. */
function loadManualVoids(){
  try { const r = JSON.parse(fs.readFileSync(__dirname + '/results.json','utf8')); return (r.voided||[]).map(surnameKey).filter(Boolean); }
  catch(e){ return []; }
}
function pickVoided(p, voidPairs, voidNames){
  const h=surnameKey(p.homeName||(p.match||'').split(/[–-]/)[0]);
  const a=surnameKey(p.awayName||(p.match||'').split(/[–-]/)[1]);
  // anulada SOLO si la pareja exacta se retiró (no por un apellido suelto que se retiró en otro partido)
  if (voidPairs && voidPairs.some(v=>(v.a===h&&v.b===a)||(v.a===a&&v.b===h))) return true;
  // override manual (results.json): apellido suelto explícito
  if (voidNames && voidNames.length && (voidNames.includes(h)||voidNames.includes(a))) return true;
  return false;
}
/* re-evalúa registros ya guardados cuando una retirada afecta a una pierna (POR PAREJA):
   pone esa pierna a cuota 1.00, recalcula cuota total y resultado. Corrige combis/picks antiguos. */
function revoidRecords(COMBO_RECORD, RECORD, voidPairs, voidNames){
  const pairVoid=(matchStr)=>{
    const nm=(matchStr||'').split('–').map(s=>surnameKey(s));
    if (nm.length<2) return false;
    if (voidPairs && voidPairs.some(v=>(v.a===nm[0]&&v.b===nm[1])||(v.a===nm[1]&&v.b===nm[0]))) return true;
    if (voidNames && voidNames.length && nm.some(x=>voidNames.includes(x))) return true;   // override manual
    return false;
  };
  let n=0;
  COMBO_RECORD.forEach(c=>{
    let changed=false;
    c.legs.forEach(l=>{ if (pairVoid(l.match) && !l.voided){ l.voided=true; l.odd=1.00; l.win=null; changed=true; } });
    if (changed){
      const nonVoid=c.legs.filter(l=>!l.voided);
      c.totalOdd=+c.legs.reduce((p,l)=>p*(l.voided?1:(l.odd||1)),1).toFixed(2);
      c.result = nonVoid.length===0 ? 'V' : (nonVoid.every(l=>l.win===true)?'W':'L');
      n++;
    }
  });
  RECORD.forEach(r=>{ if (r.result!=='V' && pairVoid(r.match)){ r.result='V'; r.odd=1.00; n++; } });
  return n;
}
/* MODEL ACCURACY: liquida predicciones del modelo con los pares de resultados (gratis).
   Mueve de MODEL_PENDING a MODEL_RECORD con ok=true/false. NO cuenta para el ROI. */
function settleModel(MODEL_PENDING, MODEL_RECORD, finished, sofa){
  const fp=(finished||[]).map(f=>({a:surnameKey(f.home),b:surnameKey(f.away),w:surnameKey(f.winner)}));
  const still=[]; let n=0;
  MODEL_PENDING.forEach(p=>{
    const nm=(p.match||'').split('–').map(s=>surnameKey(s));
    let winnerHome=null;
    const sf=p.sofa&&sofa&&sofa[p.sofa];
    if(sf&&sf.done&&!sf.voided) winnerHome=sf.winnerHome;
    else if(sf&&sf.done&&sf.voided){ return; }     // retirada → se descarta de precisión
    if(winnerHome===null){
      const f=fp.find(v=>(v.a===nm[0]&&v.b===nm[1])||(v.a===nm[1]&&v.b===nm[0]));
      if(f) winnerHome=(f.w===nm[0]) === (surnameKey(p.homeName)===nm[0]) ? (f.w===surnameKey(p.homeName)) : (f.w===surnameKey(p.homeName));
      if(f) winnerHome=(f.w===surnameKey(p.homeName));
    }
    if(winnerHome===null){ still.push(p); return; }
    const ok=(winnerHome===p.predHome);
    MODEL_RECORD.unshift({ date:p.date, match:p.match, predName:p.predName, prob:p.prob, ok });
    n++;
  });
  MODEL_PENDING.length=0; still.forEach(x=>MODEL_PENDING.push(x));
  return n;
}
/* RE-VERIFICA cada registro contra los resultados reales (pares api-tennis) y lo corrige:
   GANADA/FALLADA según el ganador real, ANULADA si la pareja se retiró. Des-anula los mal anulados. */
function reverifyRecords(RECORD, COMBO_RECORD, finished, voidPairs){
  const fp=(finished||[]).map(f=>({a:surnameKey(f.home),b:surnameKey(f.away),w:surnameKey(f.winner)}));
  const look=(matchStr)=>{
    const nm=(matchStr||'').split('–').map(s=>surnameKey(s)); if(nm.length<2) return null;
    if((voidPairs||[]).some(v=>(v.a===nm[0]&&v.b===nm[1])||(v.a===nm[1]&&v.b===nm[0]))) return {void:true};
    const f=fp.find(v=>(v.a===nm[0]&&v.b===nm[1])||(v.a===nm[1]&&v.b===nm[0]));
    return f?{winner:f.w}:null;
  };
  let n=0;
  RECORD.forEach(r=>{
    const res=look(r.match); if(!res) return;
    const pick=surnameKey((r.pick||'').replace(/^Gana\s+/i,''));
    const correct = res.void ? 'V' : (res.winner===pick?'W':'L');
    if(r.result!==correct){ if(correct==='V'){ if(r.odd!==1) r.oddOrig=r.odd; r.odd=1.00; } else if(r.oddOrig){ r.odd=r.oddOrig; } r.result=correct; n++; }
  });
  COMBO_RECORD.forEach(c=>{
    let changed=false;
    c.legs.forEach(l=>{
      const res=look(l.match); if(!res) return;
      const pick=surnameKey((l.pick||'').replace(/^Gana\s+/i,''));
      if(res.void){ if(!l.voided){ l.voided=true; l.odd=1.00; l.win=null; changed=true; } }
      else { const win=(res.winner===pick); if(l.win!==win||l.voided){ l.win=win; l.voided=false; changed=true; } }
    });
    if(changed){
      const nonVoid=c.legs.filter(l=>!l.voided);
      c.totalOdd=+c.legs.reduce((p,l)=>p*(l.voided?1:(l.odd||1)),1).toFixed(2);
      c.result=nonVoid.length===0?'V':(nonVoid.every(l=>l.win===true)?'W':'L');
      n++;
    }
  });
  return n;
}
/* reabre registros mal liquidados cuando api-tennis dice que el partido sigue interrumpido/suspendido.
   Mueve el pick de RECORD a PENDING (volverá a liquidarse cuando de verdad acabe). */
function reopenRecords(RECORD, PENDING, COMBO_RECORD, COMBO_PENDING, unfinishedPairs){
  if (!unfinishedPairs || !unfinishedPairs.length) return 0;
  const isUnf=(matchStr)=>{ const nm=(matchStr||'').split('–').map(s=>surnameKey(s)); if(nm.length<2) return false; return unfinishedPairs.some(v=>(v.a===nm[0]&&v.b===nm[1])||(v.a===nm[1]&&v.b===nm[0])); };
  let n=0;
  for (let i=RECORD.length-1;i>=0;i--){ const r=RECORD[i]; if(isUnf(r.match)){ PENDING.push({ id:r.id, date:r.date, match:r.match, pickLabel:r.pick, odd:r.odd, book:r.book, homeName:(r.match||'').split('–')[0].trim(), awayName:(r.match||'').split('–')[1]?r.match.split('–')[1].trim():'' }); RECORD.splice(i,1); n++; } }
  for (let i=COMBO_RECORD.length-1;i>=0;i--){ const c=COMBO_RECORD[i]; if(c.legs.some(l=>isUnf(l.match))){ COMBO_PENDING.push(c); COMBO_RECORD.splice(i,1); n++; } }
  return n;
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

  try {
    // scores for pending picks/combos AND for today's active tournaments (so Elo keeps learning)
    const need=[...new Set([...PENDING.map(p=>p.sport), ...COMBO_PENDING.flatMap(c=>c.legs.map(l=>l.sport)), ...ARB_PENDING.map(p=>p.sport), ...keys].filter(Boolean))];
    if (need.length){
      const scores=await fetchScores(need);
      const apiRes = APITENNIS_KEY ? await apiTennis(APITENNIS_KEY, 6) : { winners:[], finished:[], logos:{} };
      let espn = { winners:[], finished:[] };
      try { espn = await espnResults(5); console.log(`· ESPN: ${espn.winners.length} ganadores · ${espn.finished.length} partidos terminados`); }
      catch(e){ console.log('· ESPN no disponible:', e.message); }
      espn.finished = [...(espn.finished||[]), ...(apiRes.finished||[])];   // api-tennis pares → picks/combis/surebets
      LAST_FINISHED = espn.finished;
      const manualWinners=[...loadManualWinners(), ...apiRes.winners, ...espn.winners];   // ESPN (gratis) + api-tennis + manual
      if (manualWinners.length) console.log(`· liquidando con ${manualWinners.length} ganadores (api-tennis + results.json)`);
      // SofaScore por ID exacto (challenger/ITF/todo, sin errores de nombres)
      const sofaIds=[...PENDING.map(p=>p.sofa), ...COMBO_PENDING.flatMap(c=>c.legs.map(l=>l.sofa)), ...ARB_PENDING.map(a=>a.sofa)].filter(Boolean);
      let sofa={}; try { sofa=await sofaResults(sofaIds); console.log(`· SofaScore: ${Object.keys(sofa).length} resultados por ID`); } catch(e){ console.log('· SofaScore no disponible:', e.message); }
      // FALLBACK por nombre para pendientes SIN sofascoreId (challengers viejos). Cachea por partido.
      const nameCache={};
      async function sofaByName(homeName, awayName){
        const key=(surnameKey(homeName)+'|'+surnameKey(awayName));
        if (key in nameCache) return nameCache[key];
        let r=null; try { r=await sofaResults.searchEventByNames(homeName, awayName); } catch(e){}
        nameCache[key]=r; return r;
      }
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
      const learned = updateElo(scores);            // self-update Elo from finished matches
      if (learned) console.log(`· Elo actualizado con ${learned} resultados`);
      // acumula FORMA (W/L) por jugador desde los partidos terminados, sin duplicar
      (LAST_FINISHED||[]).forEach(f=>{ if(!f||!f.winner) return; const sig=surnameKey(f.home)+'|'+surnameKey(f.away)+'|'+surnameKey(f.winner); if(FORM_DONE[sig]) return; FORM_DONE[sig]=1; const wk=lastKey(f.winner), lk=lastKey(f.winner===f.home?f.away:f.home); if(wk){(FORM_DB[wk]=FORM_DB[wk]||[]).push('W'); FORM_DB[wk]=FORM_DB[wk].slice(-10);} if(lk){(FORM_DB[lk]=FORM_DB[lk]||[]).push('L'); FORM_DB[lk]=FORM_DB[lk].slice(-10);} });
      const winners={}; scores.forEach(s=>{ const w=winnerOf(s); if(w) winners[shortName(w)]=w; });
      // settleable once the match has STARTED; if there's no confirmed result yet it just stays pending.
      const playedEnough = ts => !ts || ts <= Date.now();
      // settle singles: only if played; manual winners first, then API scores.
      const voidPairs=[...(espn.voided||[]), ...(apiRes.voided||[])].map(v=>({a:surnameKey(v.home),b:surnameKey(v.away)}));
      const voidNames=loadManualVoids();
      { const fixed=revoidRecords(COMBO_RECORD, RECORD, voidPairs, voidNames); if(fixed) console.log(`· ${fixed} registros corregidos por retirada`); }
      { const rv=reverifyRecords(RECORD, COMBO_RECORD, espn.finished, voidPairs); if(rv) console.log(`· ${rv} registros re-verificados (resultado real)`); }
      { const reop=reopenRecords(RECORD, PENDING, COMBO_RECORD, COMBO_PENDING, apiRes.unfinished); if(reop) console.log(`· ${reop} registros reabiertos (partido interrumpido)`); }
      { const sm=settleModel(MODEL_PENDING, MODEL_RECORD, espn.finished, sofa); if(sm) console.log(`· ${sm} predicciones del modelo verificadas`); }
      // PRE-RESUELVE por nombre los pendientes SIN sofascoreId (challengers viejos)
      const byName={};
      for (const p of PENDING){ if(!p.sofa && p.homeName && p.awayName){ const k=surnameKey(p.homeName)+'|'+surnameKey(p.awayName); if(!(k in byName)) byName[k]=await sofaByName(p.homeName,p.awayName); } }
      for (const c of COMBO_PENDING){ for (const l of c.legs){ if(!l.sofa && l.homeName && l.awayName){ const k=surnameKey(l.homeName)+'|'+surnameKey(l.awayName); if(!(k in byName)) byName[k]=await sofaByName(l.homeName,l.awayName); } } }
      for (const a of ARB_PENDING){ if(!a.sofa && a.homeName && a.awayName){ const k=surnameKey(a.homeName)+'|'+surnameKey(a.awayName); if(!(k in byName)) byName[k]=await sofaByName(a.homeName,a.awayName); } }
      const nameRes=(home,away)=> byName[surnameKey(home)+'|'+surnameKey(away)] || null;
      const nameMatches=Object.values(byName).filter(Boolean).length;
      if (nameMatches) console.log(`· SofaScore por nombre: ${nameMatches} partidos resueltos`);
      const still=[];
      PENDING.forEach(p=>{
        if (!playedEnough(p.ts)){ still.push(p); return; }          // not finished yet → keep waiting
        if (pickVoided(p, voidPairs, voidNames)){ RECORD.unshift({ id:p.id, date:p.date, match:p.match, pick:p.pickLabel, oddOrig:p.odd, odd:1.00, book:p.book, result:'V' }); return; }
        // 0º SofaScore por ID (lo más fiable), 1º ESPN por pareja, 2º api-tennis scores, 3º apellido suelto
        const sf = (p.sofa && sofa[p.sofa]) || nameRes(p.homeName, p.awayName);
        let w = null;
        if (sf && sf.done){ if (sf.voided){ RECORD.unshift({ id:p.id, date:p.date, match:p.match, pick:p.pickLabel, oddOrig:p.odd, odd:1.00, book:p.book, result:'V' }); return; } w = (sf.winnerHome === (p.pickKey==='home')); }
        else if (sf && !sf.done){ still.push(p); return; }   // SofaScore dice que aún no acabó → esperar
        if (w===null) w = espnPairResult(p.homeName, p.awayName, (p.pickLabel||'').replace(/^Gana\s+/i,''), espn.finished);
        if (w===null) w = winnerNameFor(scores, p);
        if (w===null) w = manualPickResult(p, manualWinners);
        if (w===null){ still.push(p); return; }
        RECORD.unshift({ id:p.id, date:p.date, match:p.match, pick:p.pickLabel, odd:p.odd, book:p.book, result: w?'W':'L' });
      });
      PENDING=still;
      // settle combos — only when EVERY leg has plausibly finished
      const cstill=[];
      COMBO_PENDING.forEach(c=>{
        if (!c.legs.every(l=>playedEnough(l.ts))){ cstill.push(c); return; }   // some leg not finished → keep
        const states=c.legs.map(l=>{
          if (pickVoided({match:l.match, pickLabel:l.pick, homeName:(l.match||'').split('–')[0], awayName:(l.match||'').split('–')[1]}, voidPairs, voidNames)) return 'V';
          const s=(l.sofa&&sofa[l.sofa])||nameRes(l.homeName,l.awayName);
          if (s&&s.done&&s.voided) return 'V';
          if (s&&s.done&&!s.voided) return (s.winnerHome===(l.side==='home'));
          const nm=(l.match||'').split('–'); let r=espnPairResult(nm[0],nm[1],(l.pick||'').replace(/^Gana\s+/i,''),espn.finished);
          if(r===null) r=manualLegResult(l, manualWinners);
          if(r===null) r=legWin(scores,l);
          return r;
        });
        if (states.some(r=>r===null)){ cstill.push(c); return; }   // alguna pierna sin resolver → sigue pendiente
        // pierna retirada → cuota 1.00. Resultado según las piernas NO anuladas.
        const nonVoid=states.filter(r=>r!=='V');
        const won=nonVoid.length>0 && nonVoid.every(r=>r===true);
        const allVoid=nonVoid.length===0;
        const totalOdd=+c.legs.reduce((p,l,i)=> p*(states[i]==='V'?1:l.odd),1).toFixed(2);
        COMBO_RECORD.unshift({ date:c.date, name:c.name, totalOdd, result: allVoid?'V':(won?'W':'L'),
          legs:c.legs.map((l,i)=>({ match:l.match, pick:l.pick, odd: states[i]==='V'?1.00:l.odd, win: states[i]==='V'?null:states[i], voided: states[i]==='V' })) });
      });
      COMBO_PENDING=cstill;
      // settle surebets — al terminar el partido. Si fue retirada/anulada → se descarta (no aparece).
      const astill=[];
      ARB_PENDING.forEach(a=>{
        if (!playedEnough(a.ts)){ astill.push(a); return; }         // not finished yet → keep
        const sfa = (a.sofa && sofa[a.sofa]) || nameRes(a.homeName, a.awayName);
        const sfaVoid = (sfa && sfa.done && sfa.voided) || pickVoided({homeName:a.homeName, awayName:a.awayName, match:a.match}, voidPairs, voidNames);
        const done = (sfa && sfa.done) || espnPairDone(a.homeName, a.awayName, espn.finished) || matchFinished(scores, a.homeName, a.awayName) || sfaVoid;
        if (!done){ astill.push(a); return; }
        if (sfaVoid) return;   // retirada → la surebet no se registra (desaparece)
        ARB_RECORD.unshift({ date:a.date, match:a.match, marginPct:a.marginPct, profit:a.profit, legs:a.legs });
      });
      ARB_PENDING=astill;
    }
  } catch(e){ console.log('· scores no disponibles:', e.message); }

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
    const finishedPairs=(LAST_FINISHED||[]).map(f=>({a:surnameKey(f.home),b:surnameKey(f.away),w:surnameKey(f.winner)}));
    const resolvePick=(match, pickName)=>{
      const nm=(match||'').split('–').map(s=>surnameKey(s)); if(nm.length<2) return null;
      const f=finishedPairs.find(v=>(v.a===nm[0]&&v.b===nm[1])||(v.a===nm[1]&&v.b===nm[0]));
      if(!f) return null; return f.w===surnameKey((pickName||'').replace(/^Gana\s+/i,''));
    };
    if(!LADDER) LADDER={ id:'L'+Date.now().toString(36), start:LAD_START, target:LAD_TARGET, steps:LAD_STEPS, current:0, status:'live', bank:LAD_START, rungs:[] };

    // 1) liquidar el peldaño marcado "today" si su partido ya terminó
    const todayRung=LADDER.rungs.find(r=>r.result==='today');
    if(todayRung){
      const res=resolvePick(todayRung.match, todayRung.pick);
      if(res===true){ todayRung.result='W'; LADDER.current++; LADDER.bank=todayRung.bank; }
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
          bank:newBank, result:'today', date:today, sofa:pick.m.sofa||null });
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
    const snap={ dayId:today+'·'+c.id, date:today, name:c.name, legs:c.legs.map(l=>({ id:l.id, sport:l.sport, side:l.side, sofa:l.sofa||null, match:l.match, pick:l.pick, odd:l.odd, homeName:(l.match||'').split('–')[0].trim(), awayName:(l.match||'').split('–')[1]?l.match.split('–')[1].trim():'' })) };
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

  // housekeeping — solo red de seguridad para items MUY viejos (3 semanas) que ESPN nunca
  // pudo cerrar. Lo normal es que ESPN los liquide; el robot de cuotas NO borra nada activo.
  const EXP=21*24*3600*1000;
  PENDING=PENDING.filter(p=>!p.ts || (Date.now()-p.ts)<EXP);
  ARB_PENDING=ARB_PENDING.filter(a=>!a.ts || (Date.now()-a.ts)<EXP);
  COMBO_PENDING=COMBO_PENDING.filter(c=>!c.legs || c.legs.some(l=>!l.ts || (Date.now()-l.ts)<EXP));
  // FINAL dedup pass — collapse any duplicate that slipped in via seed/snapshot regardless of order
  PENDING=dedupe(PENDING,pendKey);
  RECORD=dedupe(RECORD,sSig);
  COMBO_PENDING=dedupe(COMBO_PENDING,cKey); COMBO_RECORD=dedupe(COMBO_RECORD,cKey);
  ARB_PENDING=dedupe(ARB_PENDING,aKey); ARB_RECORD=dedupe(ARB_RECORD,aKey);
  // and never keep a pending that's already settled in the record
  { const done=new Set(RECORD.map(sSig)); PENDING=PENDING.filter(p=>!done.has(pendKey(p))); }
  RECORD=RECORD.slice(0,60); COMBO_RECORD=COMBO_RECORD.slice(0,40); ARB_RECORD=ARB_RECORD.slice(0,40);
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
    MODEL_RECORD: MODEL_RECORD.slice(0,400), MODEL_PENDING,
    LADDER, LADDER_HISTORY,
    RANKING: (function(){ let lib={}; try{ lib=(JSON.parse(fs.readFileSync(__dirname+'/player-photos.json','utf8')).photos)||{}; }catch(e){} const cs=require('./name-canon.js').canonSurname; return (RANKING||[]).slice(0,300).map(r=>{ const k=lastKey(r.name); return { name:r.name, tour:r.tour, rank:r.rank, elo:(LIVE_ELO[k]!=null?LIVE_ELO[k]:r.elo), country:r.country||'', photo:(lib[cs(r.name)]||lib[k]||null), form:(FORM_DB[k]||[]).slice(-5) }; }); })(),
    FORM_DB, FORM_DONE,
    ELO:LIVE_ELO, ELO_DONE, RANK_ELO, RANK_TS,
  };
  fs.writeFileSync(OUT, JSON.stringify(daily, null, 2));
  console.log(`✓ ${OUT}\n  ${keepMatches.length} partidos · ${valued.length} con valor · ${Object.keys(keepBooks).length} casas · ${COMBOS.length} combis · ${RECORD.length} en récord · ${PENDING.length} pendientes`);
  console.log(`  créditos API → usados ${CREDITS.used} · restantes ${CREDITS.remaining}`);
}

/* did the pick's player win? null = match not finished yet */
function legWin(scores, leg){
  // find a finished match whose players match this leg's "A – B"
  const names = leg.match.split('–').map(s=>s.trim());
  for (const s of scores){
    const w = winnerOf(s);
    if (!w) continue;
    const players = (s.scores||[]).map(x=>shortName(x.name));
    if (players.some(p=>p===names[0]) && players.some(p=>p===names[1])){
      const winnerShort = shortName(w);
      const pickName = leg.pick.replace(/^Gana\s+/,'');
      return winnerShort === pickName;
    }
  }
  return null;
}
function winnerNameFor(scores, p){
  const N=s=>(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
  for (const s of scores){
    const w = winnerOf(s);
    if (!w) continue;
    const players=(s.scores||[]).map(x=>N(shortName(x.name)));
    if (players.some(x=>x===N(p.homeName)) && players.some(x=>x===N(p.awayName))){
      const pickName=N((p.pickLabel||'').replace(/^Gana\s+/,''));
      return N(shortName(w))===pickName;
    }
  }
  return null;
}
/* true if a match between these two players is finished in the scores feed */
function matchFinished(scores, homeName, awayName){
  const N=s=>(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
  for (const s of scores){
    if (!winnerOf(s)) continue;
    const players=(s.scores||[]).map(x=>N(shortName(x.name)));
    if (players.some(x=>x===N(homeName)) && players.some(x=>x===N(awayName))) return true;
  }
  return false;
}

/* SCORES-ONLY mode: cheap midday refresh — only settles finished picks/combos/surebets. */
async function scoresOnly(){
  let d;
  try { d = JSON.parse(fs.readFileSync(OUT,'utf8')); } catch(e){ console.log('· scores-only: no hay daily.json'); return; }
  let RECORD=d.RECORD||[], PENDING=d.PENDING||[], COMBO_RECORD=d.COMBO_RECORD||[], COMBO_PENDING=d.COMBO_PENDING||[], ARB_RECORD=d.ARB_RECORD||[], ARB_PENDING=d.ARB_PENDING||[], MODEL_RECORD=d.MODEL_RECORD||[], MODEL_PENDING=d.MODEL_PENDING||[];
  // inject manual seed (surebets → directas al historial; picks → pendientes). NO toca MATCHES ni gasta créditos.
  try {
    const seed = JSON.parse(fs.readFileSync(__dirname + '/seed-pending.json', 'utf8'));
    const sSig2=r=>`${(r.match||'').toLowerCase()}|${(r.pick||r.pickLabel||'').replace(/^gana\s+/i,'').toLowerCase()}`;
    const aKey2=a=>(a.match||'').toLowerCase();
    const seenP=new Set([...PENDING,...RECORD].map(sSig2));
    (seed.PENDING||[]).forEach(p=>{ if(!seenP.has(sSig2(p))){ PENDING.push(p); seenP.add(sSig2(p)); } });
    const seenA=new Set([...ARB_PENDING,...ARB_RECORD].map(aKey2));
    (seed.ARB_PENDING||[]).forEach(a=>{ if(!seenA.has(aKey2(a))){ ARB_RECORD.unshift(a); seenA.add(aKey2(a)); } });
  } catch(e){}
  const anythingPending = PENDING.length || COMBO_PENDING.length || ARB_PENDING.length;
  if(!anythingPending){
    // nada que liquidar, pero quizá inyectamos seed → guardamos igual (MATCHES intactos)
    d.RECORD=RECORD.slice(0,60); d.PENDING=PENDING; d.COMBO_RECORD=COMBO_RECORD; d.COMBO_PENDING=COMBO_PENDING; d.ARB_RECORD=ARB_RECORD.slice(0,40); d.ARB_PENDING=ARB_PENDING;
    if(d.meta) d.meta.updatedAt=new Date().toISOString();
    fs.writeFileSync(OUT, JSON.stringify(d,null,2));
    console.log('· scores-only: nada pendiente (seed inyectado si había)'); return;
  }
  try {
    // 100% FREE refresh: settle from ESPN (gratis) + manual only. NO Odds API call → 0 créditos.
    const scores=[];
    const apiRes = APITENNIS_KEY ? await apiTennis(APITENNIS_KEY, 6) : { winners:[], finished:[], logos:{} };
    let espn = { winners:[], finished:[] };
    try { espn = await espnResults(5); console.log(`· scores-only ESPN: ${espn.winners.length} ganadores`); } catch(e){ console.log('· ESPN error:', e.message); }
    espn.finished = [...(espn.finished||[]), ...(apiRes.finished||[])];   // api-tennis pares → picks/combis/surebets
    const manualWinners=[...loadManualWinners(), ...apiRes.winners, ...espn.winners];
    if (d.PLAYERS && Object.keys(apiRes.logos).length){
      const canon=require('./name-canon.js').canonSurname;
      const simple=(n)=>(n||'').trim().split(/\s+/).pop().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]/gi,'').toLowerCase();
      let manual={}; try { manual=(JSON.parse(fs.readFileSync(__dirname+'/player-photos.json','utf8')).photos)||{}; } catch(e){}
      Object.values(d.PLAYERS).forEach(p=>{ const a=canon(p.name), b=simple(p.name); const u=manual[a]||manual[b]||apiRes.logos[a]||apiRes.logos[b]; if(u) p.photo=u; });
    }
    // fotos desde la BD persistente de SofaScore (gratis, no re-pide si la caché está vigente)
    if (d.PLAYERS){
      try {
        const sr = await sofaRankings();
        const canon = require('./name-canon.js').canonSurname;
        let manual={}; try { manual=(JSON.parse(fs.readFileSync(__dirname+'/player-photos.json','utf8')).photos)||{}; } catch(e){}
        Object.values(d.PLAYERS).forEach(p=>{ const k=canon(p.name); if(manual[k]) p.photo=manual[k]; else if(!p.photo && sr.photos[k]) p.photo=sr.photos[k]; });
      } catch(e){}
    }
    const pe=ts=>!ts||ts<=Date.now();
    const sofaIds=[...PENDING.map(p=>p.sofa), ...COMBO_PENDING.flatMap(c=>c.legs.map(l=>l.sofa)), ...ARB_PENDING.map(a=>a.sofa)].filter(Boolean);
    let sofa={}; try { sofa=await sofaResults(sofaIds); console.log(`· scores-only SofaScore: ${Object.keys(sofa).length} resultados`); } catch(e){}
    // name fallback (challengers sin ID)
    const byName={};
    const sofaByName=async(h,a)=>{ const k=surnameKey(h)+'|'+surnameKey(a); if(k in byName) return byName[k]; let r=null; try{ r=await sofaResults.searchEventByNames(h,a); }catch(e){} byName[k]=r; return r; };
    for (const p of PENDING){ if(!p.sofa&&p.homeName&&p.awayName) await sofaByName(p.homeName,p.awayName); }
    for (const c of COMBO_PENDING){ for (const l of c.legs){ if(!l.sofa&&l.homeName&&l.awayName) await sofaByName(l.homeName,l.awayName); } }
    for (const a of ARB_PENDING){ if(!a.sofa&&a.homeName&&a.awayName) await sofaByName(a.homeName,a.awayName); }
    const nameRes=(h,a)=> byName[surnameKey(h)+'|'+surnameKey(a)] || null;
    const voidPairs=[...(espn.voided||[]), ...(apiRes.voided||[])].map(v=>({a:surnameKey(v.home),b:surnameKey(v.away)}));
    const voidNames=loadManualVoids();
    { const fixed=revoidRecords(COMBO_RECORD, RECORD, voidPairs, voidNames); if(fixed) console.log(`· ${fixed} registros corregidos por retirada`); }
    { const rv=reverifyRecords(RECORD, COMBO_RECORD, espn.finished, voidPairs); if(rv) console.log(`· ${rv} registros re-verificados (resultado real)`); }
    { const reop=reopenRecords(RECORD, PENDING, COMBO_RECORD, COMBO_PENDING, apiRes.unfinished); if(reop) console.log(`· ${reop} registros reabiertos (partido interrumpido)`); }
    { const sm=settleModel(MODEL_PENDING, MODEL_RECORD, espn.finished, sofa); if(sm) console.log(`· ${sm} predicciones del modelo verificadas`); }
    const still=[]; PENDING.forEach(p=>{ if(!pe(p.ts)){still.push(p);return;} if(pickVoided(p,voidPairs,voidNames)){RECORD.unshift({id:p.id,date:p.date,match:p.match,pick:p.pickLabel,oddOrig:p.odd,odd:1.00,book:p.book,result:'V'});return;} const sf=(p.sofa&&sofa[p.sofa])||nameRes(p.homeName,p.awayName); let w=null; if(sf&&sf.done){ if(sf.voided){RECORD.unshift({id:p.id,date:p.date,match:p.match,pick:p.pickLabel,oddOrig:p.odd,odd:1.00,book:p.book,result:'V'});return;} w=(sf.winnerHome===(p.pickKey==='home')); } else if(sf&&!sf.done){still.push(p);return;} if(w===null) w=espnPairResult(p.homeName,p.awayName,(p.pickLabel||'').replace(/^Gana\s+/i,''),espn.finished); if(w===null) w=manualPickResult(p,manualWinners); if(w===null){still.push(p);return;} RECORD.unshift({id:p.id,date:p.date,match:p.match,pick:p.pickLabel,odd:p.odd,book:p.book,result:w?'W':'L'}); }); PENDING=still;
    const cstill=[]; COMBO_PENDING.forEach(c=>{ if(!c.legs.every(l=>pe(l.ts))){cstill.push(c);return;} const states=c.legs.map(l=>{ if(pickVoided({match:l.match,pickLabel:l.pick,homeName:(l.match||'').split('–')[0],awayName:(l.match||'').split('–')[1]},voidPairs,voidNames)) return 'V'; const s=(l.sofa&&sofa[l.sofa])||nameRes(l.homeName,l.awayName); if(s&&s.done&&s.voided) return 'V'; if(s&&s.done&&!s.voided) return (s.winnerHome===(l.side==='home')); const nm=(l.match||'').split('–'); let r=espnPairResult(nm[0],nm[1],(l.pick||'').replace(/^Gana\s+/i,''),espn.finished); if(r===null) r=manualLegResult(l,manualWinners); if(r===null) r=legWin(scores,l); return r; }); if(states.some(r=>r===null)){cstill.push(c);return;} const nonVoid=states.filter(r=>r!=='V'); const won=nonVoid.length>0&&nonVoid.every(r=>r===true); const allVoid=nonVoid.length===0; const totalOdd=+c.legs.reduce((p,l,i)=>p*(states[i]==='V'?1:l.odd),1).toFixed(2); COMBO_RECORD.unshift({date:c.date,name:c.name,totalOdd,result:allVoid?'V':(won?'W':'L'),legs:c.legs.map((l,i)=>({match:l.match,pick:l.pick,odd:states[i]==='V'?1.00:l.odd,win:states[i]==='V'?null:states[i],voided:states[i]==='V'}))}); }); COMBO_PENDING=cstill;
    const astill=[]; ARB_PENDING.forEach(a=>{ if(!pe(a.ts)){astill.push(a);return;} const sfa=(a.sofa&&sofa[a.sofa])||nameRes(a.homeName,a.awayName); const sfaVoid=(sfa&&sfa.done&&sfa.voided)||pickVoided({homeName:a.homeName,awayName:a.awayName,match:a.match},voidPairs,voidNames); const done=(sfa&&sfa.done)||espnPairDone(a.homeName,a.awayName,espn.finished)||matchFinished(scores,a.homeName,a.awayName)||sfaVoid; if(!done){astill.push(a);return;} if(sfaVoid) return; ARB_RECORD.unshift({date:a.date,match:a.match,marginPct:a.marginPct,profit:a.profit,legs:a.legs}); }); ARB_PENDING=astill;
    // RETO ESCALERA (solo liquidar el peldaño de hoy; NO genera el siguiente — eso lo hace el run de odds)
    try {
      const L=d.LADDER; const LH=d.LADDER_HISTORY||[];
      if(L && Array.isArray(L.rungs)){
        const fin=(espn.finished||[]).map(f=>({a:surnameKey(f.home),b:surnameKey(f.away),w:surnameKey(f.winner)}));
        const tr=L.rungs.find(r=>r.result==='today');
        if(tr){
          const nm=(tr.match||'').split('–').map(s=>surnameKey(s));
          const f=nm.length>=2?fin.find(v=>(v.a===nm[0]&&v.b===nm[1])||(v.a===nm[1]&&v.b===nm[0])):null;
          if(f){
            const won=f.w===surnameKey((tr.pick||'').replace(/^Gana\s+/i,''));
            if(won){ tr.result='W'; L.current=(L.current||0)+1; L.bank=tr.bank; }
            else { tr.result='L'; LH.unshift({id:L.id,start:L.start,target:L.target,brokeAt:tr.n,reached:+((L.bank)||L.start).toFixed(2),result:'broken',date:tr.date||''}); d.LADDER=null; }
            d.LADDER_HISTORY=LH.slice(0,12);
            console.log('· Reto escalera (ESPN): peldaño '+tr.n+' → '+(won?'GANADO':'FALLADO'));
          }
        }
        if(d.LADDER && d.LADDER.bank>=d.LADDER.target){ LH.unshift({id:d.LADDER.id,start:d.LADDER.start,target:d.LADDER.target,reached:+d.LADDER.bank.toFixed(2),result:'completed',date:''}); d.LADDER=null; d.LADDER_HISTORY=LH.slice(0,12); } else if(d.LADDER && d.LADDER.current>=d.LADDER.steps){ d.LADDER.steps=d.LADDER.current+1; }
      }
    } catch(e){ console.log('· escalera scores-only error:', e.message); }
  } catch(e){ console.log('· scores-only: error', e.message); }
  d.RECORD=RECORD.slice(0,60); d.PENDING=PENDING; d.COMBO_RECORD=COMBO_RECORD.slice(0,40); d.COMBO_PENDING=COMBO_PENDING; d.ARB_RECORD=ARB_RECORD.slice(0,40); d.ARB_PENDING=ARB_PENDING; d.MODEL_RECORD=MODEL_RECORD.slice(0,400); d.MODEL_PENDING=MODEL_PENDING;
  if(d.meta) d.meta.updatedAt=new Date().toISOString();
  fs.writeFileSync(OUT, JSON.stringify(d,null,2));
  console.log(`✓ scores-only: ${RECORD.length} en récord · ${PENDING.length} pendientes`);
}

main().catch(e=>{ console.error('✗', e); process.exit(1); });