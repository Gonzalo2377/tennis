/* ============================================================
   ACEVALUE — fotos + Elo base de jugadores vía SofaScore (gratis)
   ------------------------------------------------------------
   Lee el ranking ATP (type 5) y WTA (type 6). De cada jugador saca:
     · foto:  https://api.sofascore.com/api/v1/player/{id}/image
     · elo base derivado del ranking (nº1 ≈ 2200 … cae con el ranking)
   Cubre ~1000+ jugadores por circuito → la gran mayoría tiene foto.
   No necesita clave. Permanente (no caduca como api-tennis).
   ============================================================ */
const HOST = 'https://api.sofascore.com/api/v1';
const { canonSurname } = require('./name-canon.js');
const UA = {
  'User-Agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36',
  'Accept':'application/json',
};
function sk(n){ return (n||'').trim().replace(/[.,;:]+$/,'').split(/\s+/).pop().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9-]/gi,'').toLowerCase(); }

async function fetchRanking(typeId){
  try { const r = await fetch(`${HOST}/rankings/type/${typeId}`, { headers:UA }); if(!r.ok) return []; const j = await r.json(); return j.rankings || []; }
  catch(e){ return []; }
}

/* returns { photos:{surnameKey:url}, elo:{surnameKey:elo} } */
module.exports = async function sofaRankings(){
  const photos = {}, elo = {};
  for (const t of [5, 6]){           // 5 = ATP, 6 = WTA
    const rows = await fetchRanking(t);
    rows.forEach(row => {
      const tm = row.team; if (!tm || !tm.id) return;
      const k = canonSurname(tm.name); if (!k) return;
      photos[k] = `${HOST}/player/${tm.id}/image`;
      const rank = row.ranking || row.position || 999;
      elo[k] = Math.round(2200 - 470 * Math.log10(Math.max(1, rank)));   // #1≈2200 #50≈1400 #500≈930
    });
  }
  console.log(`· SofaScore rankings → ${Object.keys(photos).length} fotos / Elo base`);
  return { photos, elo };
};
