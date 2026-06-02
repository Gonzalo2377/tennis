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
const REGIONS = process.env.ODDS_REGIONS || 'eu';
const MARKET  = 'h2h';
const MAX     = parseInt(process.env.ODDS_MAX || '10', 10);
const WINDOW_HOURS = parseInt(process.env.ODDS_WINDOW_HOURS || '96', 10);
const SPORT   = process.env.ODDS_SPORT || 'auto';
const OUT     = path.join(__dirname, '..', 'daily.json');

if (!API_KEY) { console.error('✗ Falta ODDS_API_KEY'); process.exit(1); }

const CREDITS = { remaining:null, used:null };

/* ---- helpers ---- */
const slug = (s) => (s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'').slice(0,16) || 'p'+Math.random().toString(36).slice(2,7);
function shortName(full){
  // "Carlos Alcaraz" -> "C. Alcaraz" ; keep single tokens as-is
  const parts = (full||'').trim().split(/\s+/);
  if (parts.length < 2) return full;
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

/* ---- engine (mirror of data.js) ---- */
function bestPrice(map){ let b=null; for(const k in map) if(!b||map[k]>b.price) b={book:k,price:map[k]}; return b; }
function saneBest(map){ const v=Object.values(map).sort((x,y)=>x-y),n=v.length; const med=n?(n%2?v[(n-1)/2]:(v[n/2-1]+v[n/2])/2):0; let b=null; for(const k in map){const p=map[k]; if(med&&p>med*1.6)continue; if(!b||p>b.price)b={book:k,price:p};} return b||bestPrice(map); }
function marketProbs(m){ const avg=o=>{const v=Object.values(o);return v.reduce((s,x)=>s+1/x,0)/v.length;}; const a=avg(m.odds.home),b=avg(m.odds.away),s=a+b; return {home:a/s,away:b/s}; }
function matchValue(m){ const mk=marketProbs(m); const MIN_P=0.35,MAX_ODD=3.20; const all=['home','away'].map(k=>{const best=saneBest(m.odds[k]);const ev=(mk[k]*best.price-1)*100;const eligible=mk[k]>=MIN_P&&best.price<=MAX_ODD;return{k,p:mk[k],best,edge:ev,eligible};}); const outs=[...all].sort((a,b)=>(b.eligible-a.eligible)||(b.edge-a.edge)); const top=outs[0]; return {pick:top,edge:top.edge,positive:top.eligible&&top.edge>=1.5}; }

async function main(){
  let keys = SPORT.split(',').map(s=>s.trim()).filter(Boolean);
  if (keys.length===1 && keys[0].toLowerCase()==='auto'){
    try { keys = (await discoverTennis()).slice(0, MAX); console.log(`· AUTO: torneos de tenis activos → ${keys.join(', ') || '(ninguno)'}`); }
    catch(e){ console.log('· AUTO falló:', e.message); keys = []; }
  }
  if (!keys.length){ console.log('· Sin torneos de tenis activos ahora mismo.'); }

  // pull odds
  const raw = [];
  for (const key of keys){ const r = await fetchOdds(key); raw.push(...r); }

  const now = Date.now();
  const horizon = now + WINDOW_HOURS*3600*1000;
  const BOOKS = {}, PLAYERS = {}, MATCHES = [];
  const COLORS = ['#e23b2e','#0a7d3c','#0a2d6e','#14805e','#ffb000','#d11a2a','#0a6cff','#1c1c1c','#7a4ddb','#d9730d'];

  raw.forEach(({ev,key})=>{
    const ct = new Date(ev.commence_time).getTime();
    if (ct < now - 30*60*1000 || ct > horizon) return;          // skip started/too-far
    if (!ev.home_team || !ev.away_team || !ev.bookmakers || !ev.bookmakers.length) return;

    const hId = slug(ev.home_team), aId = slug(ev.away_team);
    PLAYERS[hId] = PLAYERS[hId] || { id:hId, name:shortName(ev.home_team), country:'', flag:'', seed:'', tour:tourOf(key), elo:null, form:[] };
    PLAYERS[aId] = PLAYERS[aId] || { id:aId, name:shortName(ev.away_team), country:'', flag:'', seed:'', tour:tourOf(key), elo:null, form:[] };

    const oddsH = {}, oddsA = {};
    ev.bookmakers.forEach((bk,i)=>{
      const mkt = (bk.markets||[]).find(m=>m.key==='h2h');
      if (!mkt) return;
      const oH = mkt.outcomes.find(o=>o.name===ev.home_team);
      const oA = mkt.outcomes.find(o=>o.name===ev.away_team);
      if (!oH || !oA) return;
      const bid = bk.key;
      BOOKS[bid] = BOOKS[bid] || { id:bid, name:bk.title||bid, abbr:(bk.title||bid).replace(/[^a-zA-Z0-9]/g,'').slice(0,3).toUpperCase(), color: COLORS[Object.keys(BOOKS).length % COLORS.length] };
      oddsH[bid] = +oH.price; oddsA[bid] = +oA.price;
    });
    if (Object.keys(oddsH).length < 2) return;                  // need 2+ books for value/arb

    MATCHES.push({
      id: ev.id, tour:tourOf(key), event:eventName(key), round:'', surface:'', time:fmtTime(ev.commence_time),
      home:hId, away:aId, odds:{ home:oddsH, away:oddsA },
      _commence: ev.commence_time, _sport:key,
    });
  });

  MATCHES.sort((a,b)=> new Date(a._commence)-new Date(b._commence));

  // value picks + combos
  const valued = MATCHES.map(m=>({m,v:matchValue(m)})).filter(x=>x.v.positive).sort((a,b)=>b.v.edge-a.v.edge);
  const label = (m,k)=> 'Gana ' + PLAYERS[k==='home'?m.home:m.away].name;
  const legOf = (x)=>({ id:x.m.id, sport:x.m._sport, ts:new Date(x.m._commence).getTime(), side:x.v.pick.k,
                        match:`${PLAYERS[x.m.home].name} – ${PLAYERS[x.m.away].name}`, pick:label(x.m,x.v.pick.k),
                        odd:+x.v.pick.best.price.toFixed(2), book:x.v.pick.best.book });
  const COMBOS = [];
  const pool = valued.length>=2 ? valued : MATCHES.map(m=>({m,v:matchValue(m)})).sort((a,b)=>b.v.pick.p-a.v.pick.p);
  if (pool.length>=2){
    const conf = (arr)=> Math.round(arr.reduce((p,x)=>p*x.v.pick.p,1)*100);
    COMBOS.push({ id:'c1', name:'Combinada del Día', conf:conf(pool.slice(0,3)), legs:pool.slice(0,3).map(legOf) });
    if (pool.length>=3) COMBOS.push({ id:'c2', name:'Combinada Valor', conf:conf(pool.slice(1,4).length?pool.slice(1,4):pool.slice(0,3)), legs:(pool.slice(1,4).length>=2?pool.slice(1,4):pool.slice(0,3)).map(legOf) });
  }

  // ---- track record (settle finished picks via scores) ----
  let RECORD=[], PENDING=[], COMBO_RECORD=[], COMBO_PENDING=[];
  try { const prev=JSON.parse(fs.readFileSync(OUT,'utf8')); RECORD=prev.RECORD||[]; PENDING=prev.PENDING||[]; COMBO_RECORD=prev.COMBO_RECORD||[]; COMBO_PENDING=prev.COMBO_PENDING||[]; } catch(e){}

  // dedup
  const dedupe=(arr,key)=>{const s=new Set();return arr.filter(o=>{const k=key(o);if(s.has(k))return false;s.add(k);return true;});};
  const sSig=r=>`${r.date||''}|${r.match||''}|${r.pick||r.pickLabel||''}`;
  const cKey=c=>`${c.date||''}|${(c.legs||[]).map(l=>`${l.match}|${l.pick}`).sort().join('+')}`;
  RECORD=dedupe(RECORD,sSig); PENDING=dedupe(PENDING,sSig); COMBO_RECORD=dedupe(COMBO_RECORD,cKey); COMBO_PENDING=dedupe(COMBO_PENDING,cKey);

  try {
    const need=[...new Set([...PENDING.map(p=>p.sport), ...COMBO_PENDING.flatMap(c=>c.legs.map(l=>l.sport))].filter(Boolean))];
    if (need.length){
      const scores=await fetchScores(need);
      const byName={}; scores.forEach(s=>{ const w=winnerOf(s); if(w) byName[w]=true; (s.scores||[]).forEach(()=>{}); });
      const winners={}; scores.forEach(s=>{ const w=winnerOf(s); if(w) winners[shortName(w)]=w; });
      // settle singles: a pick wins if its player's shortName is among winners
      const still=[];
      PENDING.forEach(p=>{
        const w = winnerNameFor(scores, p);
        if (w===null){ still.push(p); return; }
        RECORD.unshift({ id:p.id, date:p.date, match:p.match, pick:p.pickLabel, odd:p.odd, book:p.book, result: w?'W':'L' });
      });
      PENDING=still;
      // settle combos
      const cstill=[];
      COMBO_PENDING.forEach(c=>{
        const res=c.legs.map(l=>legWin(scores,l));
        if (res.some(r=>r===null)){ cstill.push(c); return; }
        const won=res.every(Boolean);
        COMBO_RECORD.unshift({ date:c.date, name:c.name, totalOdd:+c.legs.reduce((p,l)=>p*l.odd,1).toFixed(2), result:won?'W':'L',
          legs:c.legs.map((l,i)=>({ match:l.match, pick:l.pick, odd:l.odd, win:res[i] })) });
      });
      COMBO_PENDING=cstill;
    }
  } catch(e){ console.log('· scores no disponibles:', e.message); }

  // snapshot today's picks + combos as pending
  const today=fmtDay(new Date().toISOString());
  const haveId=new Set([...PENDING.map(p=>p.id), ...RECORD.map(r=>r.id).filter(Boolean)]);
  valued.slice(0,3).forEach(x=>{
    if (haveId.has(x.m.id)) return;
    PENDING.push({ id:x.m.id, sport:x.m._sport, ts:new Date(x.m._commence).getTime(), date:fmtDay(x.m._commence),
      match:`${PLAYERS[x.m.home].name} – ${PLAYERS[x.m.away].name}`, pickKey:x.v.pick.k, pickLabel:label(x.m,x.v.pick.k),
      odd:+x.v.pick.best.price.toFixed(2), book:x.v.pick.best.book, homeName:PLAYERS[x.m.home].name, awayName:PLAYERS[x.m.away].name });
    haveId.add(x.m.id);
  });
  const haveCombo=new Set([...COMBO_PENDING, ...COMBO_RECORD].map(cKey));
  COMBOS.forEach(c=>{
    if (!c.legs.every(l=>l.id&&l.sport)) return;
    const snap={ dayId:today+'·'+c.id, date:today, name:c.name, legs:c.legs.map(l=>({ id:l.id, sport:l.sport, side:l.side, match:l.match, pick:l.pick, odd:l.odd, homeName:'', awayName:'' })) };
    if (haveCombo.has(cKey(snap))) return;
    COMBO_PENDING.push(snap); haveCombo.add(cKey(snap));
  });

  // housekeeping
  const EXP=5*24*3600*1000;
  PENDING=PENDING.filter(p=>!p.ts || (Date.now()-p.ts)<EXP);
  RECORD=RECORD.slice(0,60); COMBO_RECORD=COMBO_RECORD.slice(0,40);
  MATCHES.forEach(m=>{ delete m._commence; delete m._sport; });

  // safety net: keep yesterday's board if today is empty (dead time)
  let keepMatches=MATCHES, keepPlayers=PLAYERS, keepBooks=BOOKS, keepCombos=COMBOS, stale=false;
  if (!MATCHES.length){
    try { const prev=JSON.parse(fs.readFileSync(OUT,'utf8')); if (prev.MATCHES&&prev.MATCHES.length){ keepMatches=prev.MATCHES; keepPlayers=prev.PLAYERS||{}; keepBooks=prev.BOOKS||{}; keepCombos=prev.COMBOS||[]; stale=true; console.log('  ⚠ sin partidos nuevos → conservo el tablero anterior'); } } catch(e){}
  }

  const daily = {
    meta:{ updatedAt:new Date().toISOString(), source:'the-odds-api', sport:'tennis', regions:REGIONS, market:MARKET,
           matches:keepMatches.length, valuePicks:valued.length, books:Object.keys(keepBooks).length, stale,
           credits:{ remaining:CREDITS.remaining, used:CREDITS.used } },
    PLAYERS:keepPlayers, BOOKS:keepBooks, MATCHES:keepMatches, COMBOS:keepCombos,
    RECORD, PENDING, COMBO_RECORD, COMBO_PENDING,
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
  for (const s of scores){
    const w = winnerOf(s);
    if (!w) continue;
    const players=(s.scores||[]).map(x=>shortName(x.name));
    if (players.some(x=>x===p.homeName) && players.some(x=>x===p.awayName)){
      const winnerShort=shortName(w);
      const pickName=(p.pickLabel||'').replace(/^Gana\s+/,'');
      return winnerShort===pickName;
    }
  }
  return null;
}

main().catch(e=>{ console.error('✗', e); process.exit(1); });
