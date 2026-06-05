/* ============================================================
   ACEVALUE — resultados vía SofaScore (gratis, por ID exacto)
   ------------------------------------------------------------
   OddsPapi nos da el sofascoreId de cada partido. SofaScore dice
   quién ganó por ese ID (winnerCode 1=local, 2=visitante), sin
   depender de nombres → cero falsos positivos. Cubre Challenger/ITF.
     resolveSofa(id) → { done, winnerHome, voided } | null
   No necesita API key.
   ============================================================ */
const HOST = 'https://api.sofascore.com/api/v1/event/';

async function resolveSofa(sofaId){
  if (!sofaId) return null;
  try {
    const r = await fetch(HOST + sofaId, { headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36',
      'Accept': 'application/json',
    }});
    if (!r.ok) return null;
    const j = await r.json();
    const ev = j.event; if (!ev) return null;
    const st = (ev.status && ev.status.type) || '';      // 'finished' | 'inprogress' | 'notstarted'
    const code = (ev.status && ev.status.code);
    // 100 = Ended · 110/120 = retired/walkover/coverage-stopped (anulada)
    if (st !== 'finished') return { done:false };
    const voided = code===110 || code===120 || code===70 || code===90;
    if (voided) return { done:true, voided:true };
    if (ev.winnerCode === 1) return { done:true, winnerHome:true };
    if (ev.winnerCode === 2) return { done:true, winnerHome:false };
    return { done:true, voided:true };                   // acabado sin ganador claro → anular
  } catch(e){ return null; }
}

/* ---- name search fallback (para pendientes sin sofascoreId) ----
   Busca un jugador en SofaScore y resuelve el partido contra su rival.
   surnameKey normaliza apellidos para comparar. */
function sk(n){ return (n||'').trim().split(/\s+/).pop().normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase(); }

async function searchEventByNames(homeName, awayName){
  const q = encodeURIComponent((homeName||'').trim());
  try {
    const r = await fetch('https://api.sofascore.com/api/v1/search/all?q=' + q, { headers: {
      'User-Agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36',
      'Accept':'application/json',
    }});
    if (!r.ok) return null;
    const j = await r.json();
    const players = (j.results||[]).filter(x=>x.type==='player' && x.entity && x.entity.id);
    const hk = sk(homeName), ak = sk(awayName);
    for (const pl of players.slice(0,4)){
      const pid = pl.entity.id;
      // últimos partidos de ese jugador
      const er = await fetch('https://api.sofascore.com/api/v1/player/'+pid+'/events/last/0', { headers: {
        'User-Agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36',
        'Accept':'application/json',
      }});
      if (!er.ok) continue;
      const ej = await er.json();
      const evs = (ej.events||[]).reverse();   // más recientes primero
      for (const ev of evs){
        const h = sk(ev.homeTeam && ev.homeTeam.name), a = sk(ev.awayTeam && ev.awayTeam.name);
        if ((h===hk && a===ak) || (h===ak && a===hk)){
          // ¿quién es el "home" de NUESTRO punto de vista?
          const res = await resolveSofa(ev.id);
          if (!res) return null;
          if (!res.done || res.voided) return res;
          // res.winnerHome se refiere al home de SofaScore; mapear a nuestro homeName
          const sofaHomeIsOurHome = (h===hk);
          return { done:true, winnerHome: sofaHomeIsOurHome ? res.winnerHome : !res.winnerHome };
        }
      }
    }
  } catch(e){}
  return null;
}

/* batch: { [sofaId]: {done,winnerHome,voided} } for the ids given */
module.exports = async function sofaResults(ids){
  const out = {};
  for (const id of [...new Set((ids||[]).filter(Boolean))]){
    const r = await resolveSofa(id);
    if (r) out[id] = r;
  }
  return out;
};
module.exports.resolveSofa = resolveSofa;
module.exports.searchEventByNames = searchEventByNames;
