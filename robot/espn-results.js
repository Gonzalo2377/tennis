/* ============================================================
   ACEVALUE — resultados de tenis vía ESPN (gratis, sin clave)
   ------------------------------------------------------------
   La API pública de ESPN devuelve los marcadores ATP/WTA por día.
   Devolvemos la lista de APELLIDOS ganadores (para liquidar picks)
   y un mapa de "partido terminado" para los surebets.
     winners: ['andreeva','chwalinska', ...]
     finished: [{home:'kostyuk', away:'andreeva', winner:'andreeva'}, ...]
   No necesita API key.
   ============================================================ */
const TOURS = ['atp', 'wta'];

function surname(name){
  // "Mirra Andreeva" -> "andreeva" ; handles accents
  return (name||'').trim().split(/\s+/).pop().normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
}
function ymd(d){ return d.toISOString().slice(0,10).replace(/-/g,''); }

async function fetchDay(tour, dateStr){
  const url = `https://site.api.espn.com/apis/site/v2/sports/tennis/${tour}/scoreboard?dates=${dateStr}`;
  try {
    const r = await fetch(url, { headers: { 'User-Agent': 'acevalue-bot' } });
    if (!r.ok) return [];
    const j = await r.json();
    return j.events || [];
  } catch(e){ return []; }
}

/* returns { winners:[surnames], finished:[{home,away,winner}] } for the last `days` days */
module.exports = async function espnResults(days = 4){
  const winners = new Set();
  const finished = [];
  const voided = [];          // walkovers / no-shows → apuesta anulada
  const now = new Date();
  for (let i = 0; i <= days; i++){
    const d = new Date(now.getTime() - i*24*3600*1000);
    const dateStr = ymd(d);
    for (const tour of TOURS){
      const events = await fetchDay(tour, dateStr);
      for (const ev of events){
        const comp = (ev.competitions && ev.competitions[0]) || null;
        if (!comp) continue;
        const status = (comp.status && comp.status.type && comp.status.type.completed) ||
                       (ev.status && ev.status.type && ev.status.type.completed);
        if (!status) continue;                        // solo partidos TERMINADOS
        const cs = comp.competitors || [];
        if (cs.length < 2) continue;
        // each competitor: { athlete:{displayName}, winner:true/false }  (singles)
        const nameOf = c => surname((c.athlete && (c.athlete.displayName || c.athlete.shortName)) ||
                                    (c.team && c.team.displayName) || c.displayName || '');
        const a = cs[0], b = cs[1];
        const an = nameOf(a), bn = nameOf(b);
        if (!an || !bn) continue;
        const detail = ((comp.status && comp.status.type && (comp.status.type.detail||comp.status.type.description||comp.status.type.name)) || '').toLowerCase();
        // el texto del resultado ("X bt Y 6-3 2-1 RET" / "... walkover") es la señal más fiable
        const noteText = ((comp.notes && comp.notes[0] && comp.notes[0].text) || (ev.notes && ev.notes[0] && ev.notes[0].text) || '').toLowerCase();
        const blob = detail + ' ' + noteText;
        const isWalkover = /walkover|w\/o|\bw-o\b|no[\s-]?show|cancel|\bret\b|retir|abandon|\bdef\b|defaulted|withdrew|withdrawn/.test(blob);
        if (isWalkover){ voided.push({ home:an, away:bn }); continue; }   // anulada, no cuenta W/L
        let wn = null;
        if (a.winner) wn = an; else if (b.winner) wn = bn;
        if (!wn){
          // fallback: compare scores if winner flag missing
          const sa = +(a.score||0), sb = +(b.score||0);
          if (sa !== sb) wn = sa > sb ? an : bn;
        }
        if (wn){ winners.add(wn); finished.push({ home:an, away:bn, winner:wn }); }
      }
    }
  }
  return { winners: [...winners], finished, voided };
};
