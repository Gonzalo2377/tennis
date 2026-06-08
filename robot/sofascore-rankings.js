/* ============================================================
   ACEVALUE — base de datos PERSISTENTE de jugadores (SofaScore)
   ------------------------------------------------------------
   Mantiene players-db.json con { apellido: {photo, elo, name} }.
   · Lee la caché primero → NO re-pide cada vez (cero esfuerzo/coste).
   · Solo consulta el ranking ATP/WTA si la caché tiene >7 días.
   · ACUMULA: cada actualización añade jugadores nuevos, nunca borra.
   Así, una vez un jugador tiene foto, la conserva para siempre aunque
   SofaScore falle un día. Cubre todo el circuito (ranked ATP+WTA).
   No necesita clave. No caduca.
   ============================================================ */
const fs = require('fs');
const path = require('path');
const HOST = 'https://api.sofascore.com/api/v1';
const { canonSurname } = require('./name-canon.js');
const DB = path.join(__dirname, 'players-db.json');
const UA = {
  'User-Agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36',
  'Accept':'application/json',
};
const WEEK = 7*24*3600*1000;

async function fetchRanking(typeId){
  try { const r = await fetch(`${HOST}/rankings/type/${typeId}`, { headers:UA }); if(!r.ok) return []; const j = await r.json(); return j.rankings || []; }
  catch(e){ return []; }
}

/* returns { photos:{apellido:url}, elo:{apellido:elo} } — desde la BD persistente */
module.exports = async function sofaRankings(){
  // 1) carga la BD acumulada
  let db = { _ts:0, players:{} };
  try { db = JSON.parse(fs.readFileSync(DB,'utf8')); if(!db.players) db.players={}; } catch(e){}

  // 2) ¿toca refrescar el ranking? (>7 días o BD casi vacía)
  const stale = (Date.now() - (db._ts||0)) > WEEK || Object.keys(db.players).length < 100;
  if (stale){
    let added = 0;
    for (const t of [5, 6]){           // 5 = ATP, 6 = WTA
      const rows = await fetchRanking(t);
      rows.forEach(row => {
        const tm = row.team; if (!tm || !tm.id) return;
        const k = canonSurname(tm.name); if (!k) return;
        const rank = row.ranking || row.position || 999;
        const elo = Math.round(2200 - 470 * Math.log10(Math.max(1, rank)));
        const prev = db.players[k];
        // acumula: actualiza foto/elo, nunca borra. La mejor (menor ranking) gana en colisión.
        if (!prev || (prev.rank||999) >= rank){ db.players[k] = { photo:`${HOST}/player/${tm.id}/image`, elo, rank, name:tm.name }; }
        if (!prev) added++;
      });
    }
    if (Object.keys(db.players).length >= 100){
      db._ts = Date.now();
      try { fs.writeFileSync(DB, JSON.stringify(db)); } catch(e){}
      console.log(`· players-db actualizada → ${Object.keys(db.players).length} jugadores (+${added} nuevos)`);
    } else {
      console.log('· players-db: ranking no disponible, uso caché ('+Object.keys(db.players).length+' jugadores)');
    }
  } else {
    console.log(`· players-db: caché vigente → ${Object.keys(db.players).length} jugadores (sin re-pedir)`);
  }

  // 3) devuelve mapas listos para usar
  const photos = {}, elo = {};
  for (const k in db.players){ photos[k] = db.players[k].photo; elo[k] = db.players[k].elo; }
  return { photos, elo };
};
