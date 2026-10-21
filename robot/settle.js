/* ============================================================
   ACEVALUE — liquidación por PAREJA EXACTA + FECHA
   ------------------------------------------------------------
   Un pick se liquida solo con un partido que:
     1) enfrenta a LOS DOS jugadores del pick (no vale un apellido
        suelto que ganó otro partido), y
     2) se jugó el mismo día ±1 (por p.ts, o por la fecha "18 JUL"
        de los registros antiguos que no guardaban ts).
   Los nombres se comparan con name-canon.js (apellidos compuestos,
   orden invertido, iniciales → distingue a los hermanos Cerundolo).
   ============================================================ */
const { canonSurname } = require('./name-canon.js');

const DAY = 24*3600*1000;
const MONTHS = { ENE:0, JAN:0, FEB:1, MAR:2, ABR:3, APR:3, MAY:4, JUN:5, JUL:6, AGO:7, AUG:7, SEP:8, SEPT:8, OCT:9, NOV:10, DIC:11, DEC:11 };

function norm(w){ return (w||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]/gi,'').toLowerCase(); }
function toks(name){ return (name||'').replace(/[.,;:()]+/g,' ').trim().split(/\s+/).map(norm).filter(Boolean).filter(w=>!/^(jr|ii|iii)$/.test(w)); }
function utcDay(ts){ return Math.floor(ts / DAY); }

/* "18 JUL" (sin año) → ts a mediodía UTC. Año = el más reciente que no quede en el futuro. */
function dayLabelTs(label, now = Date.now()){
  const m = /^(\d{1,2})\s+([A-Za-z]+)/.exec((label||'').trim());
  if (!m) return null;
  const mon = MONTHS[m[2].toUpperCase()];
  if (mon == null) return null;
  let y = new Date(now).getUTCFullYear();
  let ts = Date.UTC(y, mon, +m[1], 12);
  if (ts > now + 7*DAY) ts = Date.UTC(y-1, mon, +m[1], 12);
  return ts;
}

/* ¿es `ours` ("J. Cerundolo", "D. Fokina Alejandro", "M. Camila Osorio Serrano")
   el mismo jugador que `full` (nombre completo de la fuente)? → puntuación 0 = no. */
function nameScore(ours, full){
  const o = toks(ours), f = toks(full);
  if (!o.length || !f.length) return 0;
  const oReal = o.filter(w=>w.length>1), fSet = new Set(f), oSet = new Set(o);
  let score = 0;
  if (canonSurname(ours) && canonSurname(ours) === canonSurname(full)) score = 3;
  else if (oSet.has(f[f.length-1])) score = 2;                       // apellido de la fuente está en el nuestro
  else if (oReal.length && fSet.has(oReal[oReal.length-1])) score = 2;  // nuestro apellido está en el de la fuente
  else if (oReal.length >= 2 && oReal.every(w=>fSet.has(w))) score = 2;
  if (!score) return 0;
  // inicial del nombre de pila: si la nuestra existe y ninguna palabra de la fuente
  // empieza por ella, es otro jugador con el mismo apellido (hermanos) → descartar
  // salvo que el resto del nombre coincida en 2+ palabras.
  const initials = o.filter(w=>w.length===1);
  if (initials.length){
    const okInit = initials.some(i => f.some(w => w[0] === i));
    const shared = oReal.filter(w=>fSet.has(w)).length;
    if (!okInit && shared < 2) return 0;
    if (okInit) score += 1;
  }
  return score;
}

/* busca el partido de la pareja (home, away) en `matches` dentro de la ventana de días.
   when = { ts } (±1 día) o { from, to } (ts límites). Devuelve { m, swapped } o null. */
function findMatch(homeName, awayName, when, matches){
  if (!homeName || !awayName || !matches || !matches.length) return null;
  let lo, hi;
  if (when && when.ts){ lo = utcDay(when.ts) - 1; hi = utcDay(when.ts) + 1; }
  else if (when && when.from){ lo = utcDay(when.from); hi = utcDay(when.to || when.from); }
  else return null;                                   // sin fecha → no liquidamos
  let best = null;
  for (const m of matches){
    const d = utcDay(m.ts);
    if (d < lo || d > hi) continue;
    const s1 = Math.min(nameScore(homeName, m.home), nameScore(awayName, m.away));
    const s2 = Math.min(nameScore(homeName, m.away), nameScore(awayName, m.home));
    const s = Math.max(s1, s2);
    if (!s) continue;
    const dist = when.ts ? Math.abs(m.ts - when.ts) : 0;
    // mejor puntuación; a igualdad, el terminado y el más cercano en fecha
    if (!best || s > best.s || (s === best.s && (m.done && !best.m.done || (m.done === best.m.done && dist < best.dist))))
      best = { m, swapped: s2 > s1, s, dist };
  }
  return best;
}

/* resultado para un pick: 'W' | 'L' | 'V' | null (sin resultado aún)
   pickHome: true si apostamos por el jugador `homeName`. */
function pairResult(homeName, awayName, pickHome, when, matches){
  const f = findMatch(homeName, awayName, when, matches);
  if (!f || !f.m.done) return null;
  if (f.m.void) return 'V';
  if (!f.m.winner) return null;
  const winnerIsOurHome = (f.m.winner === 'home') !== f.swapped;
  return winnerIsOurHome === pickHome ? 'W' : 'L';
}

/* ¿apostamos por el local? usa pickHome/pickKey/side y, si no hay, el nombre del pick */
function pickIsHome(item, homeName, awayName){
  if (typeof item.pickHome === 'boolean') return item.pickHome;
  if (item.pickKey) return item.pickKey === 'home';
  if (item.side) return item.side === 'home';
  const pk = (item.pickLabel || item.pick || '').replace(/^Gana\s+/i,'').trim();
  if (!pk) return null;
  if (norm(pk) === norm(homeName)) return true;
  if (norm(pk) === norm(awayName)) return false;
  const sh = nameScore(pk, homeName), sa = nameScore(pk, awayName);
  return sh === sa ? null : sh > sa;
}

function splitMatch(match){
  const parts = (match||'').split('–').map(s=>s.trim());
  return parts.length === 2 ? parts : [null, null];
}

/* ============================================================
   settleState: liquida TODO lo pendiente con los partidos dados.
   S = { RECORD, PENDING, COMBO_RECORD, COMBO_PENDING, ARB_RECORD,
         ARB_PENDING, MODEL_RECORD, MODEL_PENDING }  (se modifica)
   src = { matches, sofa, manualWinners, manualVoids, surnameKey, now }
   Nada se borra: lo que no tenga resultado a los 21 días pasa al
   historial como ANULADO con motivo "sin resultado".
   ============================================================ */
const EXPIRE = 21*DAY;
const MISS_LIMIT = 3;            // tras 3 intentos sin encontrarlo ya no se piden sus días (salvo BACKFILL)

/* ventana de fechas de un pick/registro: su ts (±1 día) o su etiqueta "18 JUL" (±1 día) */
function whenOf(item){
  if (item.ts) return { ts:item.ts };
  const d = dayLabelTs(item.date);
  return d ? { from:d-DAY, to:d+DAY } : null;
}
/* ventana de una pierna de combinada: su ts o, si es antigua (sin ts), desde el día
   en que se creó la combi hasta 4 días después (las cuotas miran 48–96 h hacia delante) */
function legWhen(leg, combo, tsById){
  const ts = leg.ts || (leg.id && tsById[leg.id]);
  if (ts) return { ts };
  const d = dayLabelTs(combo.date);
  return d ? { from:d-DAY, to:d+4*DAY } : null;
}
function lastTs(when){ return when ? (when.ts || when.to) : null; }

/* override manual (robot/results.json): apellidos ganadores / retirados */
function manualResult(homeName, awayName, pickHome, manual, surnameKey){
  if (!surnameKey) return null;
  const h = surnameKey(homeName), a = surnameKey(awayName);
  if ((manual.voids||[]).some(n => n===h || n===a)) return 'V';
  const ws = manual.winners || [];
  const hw = ws.includes(h), aw = ws.includes(a);
  if (hw === aw) return null;                         // ninguno o ambos → no fiable
  return (hw === pickHome) ? 'W' : 'L';
}

function sofaState(id, pickHome, sofa){
  const r = id && sofa && sofa[id];
  if (!r) return undefined;
  if (!r.done) return null;
  if (r.voided) return 'V';
  return (r.winnerHome === pickHome) ? 'W' : 'L';
}

function comboOutcome(states){
  const nonVoid = states.filter(r=>r!=='V');
  if (!nonVoid.length) return 'V';
  return nonVoid.every(r=>r==='W') ? 'W' : 'L';
}

function settleState(S, src){
  const now = src.now || Date.now();
  const matches = src.matches || [], sofa = src.sofa || {};
  const manual = { winners: src.manualWinners || [], voids: src.manualVoids || [] };
  const surnameKey = src.surnameKey;
  const tsById = {};
  [...S.PENDING, ...S.RECORD].forEach(p => { if (p.id && p.ts) tsById[p.id] = p.ts; });
  const n = { picks:{W:0,L:0,V:0}, combos:{W:0,L:0,V:0}, model:0, arbs:0, fixed:0, expired:0 };

  /* resultado de una apuesta simple sobre (home, away) */
  const resultOf = (homeName, awayName, pickHome, when, sofaId) => {
    if (pickHome === null || pickHome === undefined || !homeName || !awayName) return null;
    const sf = sofaState(sofaId, pickHome, sofa);
    if (sf) return sf;                                  // SofaScore por ID (si respondió)
    const r = pairResult(homeName, awayName, pickHome, when, matches);
    if (r) return r;                                    // ESPN / api-tennis por pareja + fecha
    return manualResult(homeName, awayName, pickHome, manual, surnameKey);
  };

  // ---- 1) re-verifica el historial (solo con partidos de SU fecha) ----
  S.RECORD.forEach(r => {
    const [h, a] = splitMatch(r.match); const ph = pickIsHome(r, h, a);
    if (ph === null) return;
    const res = pairResult(h, a, ph, whenOf(r), matches);
    if (!res || res === r.result) return;
    if (res === 'V'){ if (r.odd !== 1) r.oddOrig = r.odd; r.odd = 1.00; r.reason = 'retirada'; }
    else { if (r.oddOrig) r.odd = r.oddOrig; delete r.reason; }
    r.result = res; n.fixed++;
  });
  S.COMBO_RECORD.forEach(c => {
    let changed = false;
    c.legs.forEach(l => {
      const [h, a] = splitMatch(l.match); const ph = pickIsHome(l, h, a);
      if (ph === null) return;
      const res = pairResult(h, a, ph, legWhen(l, c, tsById), matches);
      if (!res) return;
      const cur = l.voided ? 'V' : (l.win === true ? 'W' : l.win === false ? 'L' : null);
      if (res === cur) return;
      if (res === 'V'){ if (l.odd !== 1) l.oddOrig = l.odd; l.voided = true; l.odd = 1.00; l.win = null; l.reason = 'retirada'; }
      else { if (l.oddOrig) l.odd = l.oddOrig; l.voided = false; l.win = (res === 'W'); delete l.reason; }
      changed = true;
    });
    if (changed){
      c.totalOdd = +c.legs.reduce((p,l)=>p*(l.voided?1:(l.odd||1)),1).toFixed(2);
      c.result = comboOutcome(c.legs.map(l => l.voided ? 'V' : (l.win ? 'W' : 'L')));
      n.fixed++;
    }
  });

  // ---- 2) picks simples ----
  const still = [];
  S.PENDING.forEach(p => {
    if (p.ts && p.ts > now){ still.push(p); return; }          // aún no ha empezado
    const ph = pickIsHome(p, p.homeName, p.awayName);
    const when = whenOf(p);
    let res = resultOf(p.homeName, p.awayName, ph, when, p.sofa);
    let reason = res === 'V' ? 'retirada' : undefined;
    if (!res){
      const end = lastTs(when);
      if (end && now - end > EXPIRE && !src.noExpire){ res = 'V'; reason = 'sin resultado'; n.expired++; }
      else { if (end && now - end > 2*DAY) p.miss = (p.miss||0) + 1; still.push(p); return; }
    }
    const rec = { id:p.id, ts:p.ts, date:p.date, match:p.match, pick:p.pickLabel, pickHome:ph, odd:p.odd, book:p.book, result:res };
    if (res === 'V'){ rec.oddOrig = p.odd; rec.odd = 1.00; rec.reason = reason; }
    S.RECORD.unshift(rec); n.picks[res]++;
  });
  S.PENDING = still;

  // ---- 3) combinadas: cuando TODAS las piernas tienen resultado ----
  const cstill = [];
  S.COMBO_PENDING.forEach(c => {
    const whens = c.legs.map(l => legWhen(l, c, tsById));
    if (c.legs.some((l,i) => whens[i] && whens[i].ts && whens[i].ts > now)){ cstill.push(c); return; }
    const states = c.legs.map((l,i) => {
      const h = l.homeName || splitMatch(l.match)[0], a = l.awayName || splitMatch(l.match)[1];
      return resultOf(h, a, pickIsHome(l, h, a), whens[i], l.sofa);
    });
    const noResult = states.map(r => r === null);
    if (noResult.some(Boolean)){
      const end = Math.max(...whens.map(w => lastTs(w) || 0));
      if (end && now - end > EXPIRE && !src.noExpire){ n.expired++; states.forEach((r,i) => { if (r === null) states[i] = 'V'; }); }
      else { if (end && now - end > 2*DAY) c.miss = (c.miss||0) + 1; cstill.push(c); return; }
    }
    const totalOdd = +c.legs.reduce((p,l,i)=> p*(states[i]==='V'?1:l.odd),1).toFixed(2);
    const result = comboOutcome(states);
    S.COMBO_RECORD.unshift({ date:c.date, name:c.name, totalOdd, result,
      legs:c.legs.map((l,i)=>{
        const o = { match:l.match, pick:l.pick, side:l.side, odd: states[i]==='V'?1.00:l.odd, win: states[i]==='V'?null:states[i]==='W', voided: states[i]==='V' };
        if (whens[i] && whens[i].ts) o.ts = whens[i].ts;
        if (states[i]==='V'){ o.oddOrig = l.odd; o.reason = noResult[i] ? 'sin resultado' : 'retirada'; }
        return o; }) });
    n.combos[result]++;
  });
  S.COMBO_PENDING = cstill;

  // ---- 4) surebets (beneficio fijo: solo hace falta saber que terminó) ----
  const astill = [];
  S.ARB_PENDING.forEach(a => {
    if (a.ts && a.ts > now){ astill.push(a); return; }
    const f = findMatch(a.homeName, a.awayName, whenOf(a), matches);
    const sf = a.sofa && sofa[a.sofa];
    const done = (f && f.m.done) || (sf && sf.done);
    const voided = (f && f.m.done && f.m.void) || (sf && sf.done && sf.voided);
    const end = lastTs(whenOf(a));
    if (!done && !(end && now - end > EXPIRE && !src.noExpire)){ astill.push(a); return; }
    if (voided || !done) return;                        // retirada / sin resultado → la surebet no cuenta
    S.ARB_RECORD.unshift({ date:a.date, match:a.match, marginPct:a.marginPct, profit:a.profit, legs:a.legs });
    n.arbs++;
  });
  S.ARB_PENDING = astill;

  // ---- 5) precisión del modelo (no es apuesta: lo que no se encuentre en 21 días se descarta) ----
  const mstill = [];
  S.MODEL_PENDING.forEach(p => {
    if (p.ts && p.ts > now){ mstill.push(p); return; }
    const [h0, a0] = splitMatch(p.match);
    const h = p.homeName || h0, a = p.awayName || a0;
    const when = whenOf(p);
    const sf = sofaState(p.sofa, p.predHome, sofa);
    const res = sf || pairResult(h, a, p.predHome, when, matches);
    if (res === 'V') return;
    if (!res){
      const end = lastTs(when);
      if (end && now - end > EXPIRE && !src.noExpire) return;
      if (end && now - end > 2*DAY) p.miss = (p.miss||0) + 1;
      mstill.push(p); return;
    }
    S.MODEL_RECORD.unshift({ date:p.date, ts:p.ts, match:p.match, predName:p.predName, prob:p.prob, ok: res === 'W' });
    n.model++;
  });
  S.MODEL_PENDING = mstill;
  return n;
}

/* días (AAAAMMDD, UTC) que hay que pedir a ESPN para liquidar lo pendiente.
   backfill=true → todos; si no, se saltan los que ya fallaron MISS_LIMIT veces. */
function pendingDays(S, { backfill = false, recentDays = 5, now = Date.now() } = {}){
  const days = new Set();
  const ymd = t => new Date(t).toISOString().slice(0,10).replace(/-/g,'');
  const addWhen = w => {
    if (!w) return;
    const from = w.ts ? w.ts - DAY : w.from, to = Math.min(w.ts ? w.ts + DAY : w.to, now);
    for (let d = utcDay(from); d <= utcDay(to); d++) days.add(ymd(d*DAY));
  };
  const tsById = {};
  [...S.PENDING, ...S.RECORD].forEach(p => { if (p.id && p.ts) tsById[p.id] = p.ts; });
  const want = it => backfill || (it.miss||0) < MISS_LIMIT;
  S.PENDING.filter(want).forEach(p => addWhen(whenOf(p)));
  S.ARB_PENDING.filter(want).forEach(a => addWhen(whenOf(a)));
  S.MODEL_PENDING.filter(want).forEach(p => addWhen(whenOf(p)));
  S.COMBO_PENDING.filter(want).forEach(c => c.legs.forEach(l => addWhen(legWhen(l, c, tsById))));
  for (let i = 0; i <= recentDays; i++) days.add(ymd(now - i*DAY));
  return [...days].sort();
}

module.exports = { nameScore, findMatch, pairResult, pickIsHome, splitMatch, dayLabelTs, utcDay, DAY,
                   settleState, pendingDays, whenOf, EXPIRE };
