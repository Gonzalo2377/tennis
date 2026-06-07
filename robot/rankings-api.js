/* ============================================================
   ACEVALUE — rankings ATP/WTA → Elo base (vía api-tennis)
   ------------------------------------------------------------
   Trae el ranking oficial ATP y WTA y convierte la POSICIÓN en
   un Elo base realista para CADA jugador rankeado (incluidos
   challengers que tienen ranking). Así el modelo arranca con
   nivel real (no con la cuota) y luego se auto-refina con los
   resultados. Cachea para no pedirlo cada día (1 vez/semana basta).
   Requiere APITENNIS_KEY.
   ============================================================ */
const HOST = 'https://api.api-tennis.com/tennis/';
function sk(n){ return (n||'').trim().replace(/[.,;:]+$/,'').split(/\s+/).pop().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9-]/gi,'').toLowerCase(); }

// rank → Elo: nº1 ≈ 2200, 10 ≈ 1970, 50 ≈ 1810, 100 ≈ 1740, 300 ≈ 1620, 700 ≈ 1530.
function rankToElo(rank){
  const r = Math.max(1, +rank || 9999);
  return Math.round(2200 - 230 * Math.log10(r));
}

async function fetchStanding(key, eventType){
  try {
    const qs = new URLSearchParams({ method:'get_standings', event_type:eventType, APIkey:key }).toString();
    const r = await fetch(HOST + '?' + qs);
    if (!r.ok) return [];
    const j = await r.json();
    return (j && j.result) || [];
  } catch(e){ return []; }
}

/* returns { [surnameKey]: eloBase } for all ranked ATP + WTA players */
module.exports = async function fetchRankElo(key){
  if (!key) return {};
  const out = {};
  for (const type of ['ATP', 'WTA']){
    const rows = await fetchStanding(key, type);
    rows.forEach(p => {
      const name = p.player || p.player_name || '';
      const rank = p.place || p.rank || p.position;
      if (!name || !rank) return;
      const k = sk(name);
      const elo = rankToElo(rank);
      // si un apellido aparece en ATP y WTA (raro), nos quedamos con el mejor Elo
      if (out[k] == null || elo > out[k]) out[k] = elo;
    });
  }
  console.log(`· rankings api-tennis → Elo base de ${Object.keys(out).length} jugadores`);
  return out;
};
