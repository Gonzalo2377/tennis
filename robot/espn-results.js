/* ============================================================
   ACEVALUE — resultados de tenis vía ESPN (gratis, sin clave)
   ------------------------------------------------------------
   El scoreboard de ESPN (?dates=AAAAMMDD) devuelve los TORNEOS
   activos ese día. Cada torneo trae sus partidos en
     event.groupings[].competitions[]   (NO en event.competitions)
   Cada partido: competitors[].winner, competitors[].athlete.displayName,
   status.type.name (STATUS_FINAL / STATUS_RETIRED / STATUS_WALKOVER /
   STATUS_CANCELED…) y notes[0].text ("X bt Y 6-3 7-6").

   espnMatches(['20261015', ...]) → [{ id, ts, tour, home, away,
       done, void, winner:'home'|'away'|null, note }]   (solo individuales)
   espnResults(days) → { matches, winners, finished, voided } de los
       últimos `days` días (formato antiguo + `matches` con fecha).
   No necesita API key.
   ============================================================ */
const TOURS = ['atp', 'wta'];
const VOID_STATUS = /RETIRED|WALKOVER|CANCEL|ABANDON|FORFEIT|DEFAULT/;
const VOID_NOTE = /\bret\b|retired|w\/o|walkover|\bdef\b|defaulted|abandon/i;

function ymd(d){ return d.toISOString().slice(0,10).replace(/-/g,''); }

const dayCache = {};       // 'atp:20261015' → events[] (una sola petición por día y circuito)
async function fetchDay(tour, dateStr){
  const key = tour + ':' + dateStr;
  if (dayCache[key]) return dayCache[key];
  const url = `https://site.api.espn.com/apis/site/v2/sports/tennis/${tour}/scoreboard?dates=${dateStr}`;
  let events = null;
  for (let attempt = 0; attempt < 2 && !events; attempt++){
    try {
      // OJO: con User-Agent 'acevalue-bot' ESPN responde 403 → usamos uno de navegador
      const r = await fetch(url, { headers: { 'User-Agent': UA, 'Accept': 'application/json' } });
      if (r.ok) events = (await r.json()).events || [];
    } catch(e){}
  }
  if (!events){ failures.push(key); events = []; }
  dayCache[key] = events;
  return events;
}
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36';
const failures = [];       // días que ESPN no devolvió (si hay alguno, no se caduca nada)

function athleteName(c){
  return (c.athlete && (c.athlete.displayName || c.athlete.fullName || c.athlete.shortName)) || '';
}

/* convierte una competition de ESPN a nuestro formato (null si no es individual) */
function parseCompetition(comp, tour){
  const typeText = (comp.type && (comp.type.slug || comp.type.text)) || '';
  if (/doubles/i.test(typeText)) return null;
  const cs = comp.competitors || [];
  if (cs.length !== 2 || cs.some(c => c.type && c.type !== 'athlete')) return null;
  const byHA = k => cs.find(c => c.homeAway === k);
  const h = byHA('home') || cs[0], a = byHA('away') || cs[1];
  const home = athleteName(h), away = athleteName(a);
  if (!home || !away || /^tbd$/i.test(home) || /^tbd$/i.test(away)) return null;
  const st = (comp.status && comp.status.type) || {};
  const note = ((comp.notes && comp.notes[0] && comp.notes[0].text) || '');
  const isVoid = VOID_STATUS.test(st.name || '') || (st.completed && VOID_NOTE.test(note));
  let winner = h.winner ? 'home' : a.winner ? 'away' : null;
  const done = !!st.completed || isVoid;
  return { id: String(comp.id), ts: new Date(comp.date || comp.startDate).getTime(), tour,
           home, away, done, void: isVoid, winner: isVoid ? null : winner, note };
}

/* partidos individuales de los torneos activos en esas fechas (sin duplicados) */
async function espnMatches(dateStrs){
  const seen = new Map();
  for (const dateStr of [...new Set(dateStrs)].sort()){
    for (const tour of TOURS){
      const events = await fetchDay(tour, dateStr);
      for (const ev of events){
        const comps = [...(ev.competitions || []), ...(ev.groupings || []).flatMap(g => g.competitions || [])];
        for (const comp of comps){
          if (seen.has(String(comp.id))) continue;
          const m = parseCompetition(comp, tour);
          if (m && !Number.isNaN(m.ts)) seen.set(m.id, m);
        }
      }
    }
  }
  return [...seen.values()];
}

/* compatibilidad: últimos `days` días → { matches, winners, finished, voided } */
module.exports = async function espnResults(days = 4){
  const now = Date.now(), dates = [];
  for (let i = 0; i <= days; i++) dates.push(ymd(new Date(now - i*24*3600*1000)));
  const matches = await espnMatches(dates);
  const finished = [], voided = [], winners = new Set();
  for (const m of matches){
    if (!m.done) continue;
    if (m.void){ voided.push({ home:m.home, away:m.away, ts:m.ts }); continue; }
    if (!m.winner) continue;
    const w = m.winner === 'home' ? m.home : m.away;
    winners.add(w); finished.push({ home:m.home, away:m.away, winner:w, ts:m.ts });
  }
  return { matches, winners:[...winners], finished, voided };
};
module.exports.espnMatches = espnMatches;
module.exports.failures = failures;
module.exports.ymd = ymd;
