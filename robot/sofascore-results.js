/* ============================================================
   ACEVALUE — resultados vía SofaScore (REFUERZO OPCIONAL, por ID)
   ------------------------------------------------------------
   OddsPapi nos da el sofascoreId de algunos partidos. SofaScore dice
   quién ganó por ese ID (winnerCode 1=local, 2=visitante).
   OJO: SofaScore responde 403 a los robots (también desde GitHub
   Actions), así que NO es la fuente principal: la principal es ESPN
   (por pareja + fecha). Si el primer intento da 403/429, se desactiva
   el resto de la ejecución. SOFASCORE=0 lo desactiva siempre.
   Códigos comprobados con partidos reales (oct-2026):
     100 Ended · 91 Walkover · 92 Retired (ambos type 'finished' y CON
     winnerCode → hay que anularlos a mano) · 70 Canceled (type 'canceled')
     60 Postponed · 80 Interrupted (siguen pendientes).
     resolveSofa(id) → { done, winnerHome, voided } | null
   ============================================================ */
const HOSTS = ['https://api.sofascore.com/api/v1/', 'https://www.sofascore.com/api/v1/'];
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36';
const VOID_CODES = new Set([70, 90, 91, 92, 93, 94, 95, 96]);   // cancelado, abandonado, walkover, retirada, descalificación…
let blocked = process.env.SOFASCORE === '0';

/* GET con corte: si SofaScore bloquea (403/429) no insistimos en toda la ejecución */
async function sofaGet(pathAndQuery){
  if (blocked) return null;
  for (const host of HOSTS){
    let r;
    try { r = await fetch(host + pathAndQuery, { headers: { 'User-Agent': UA, 'Accept': 'application/json' } }); }
    catch(e){ continue; }
    if (r.ok) return r.json();
    if (r.status === 404) return null;
  }
  blocked = true;
  console.log('· SofaScore bloqueado (403) → se omite en esta ejecución');
  return null;
}

async function resolveSofa(sofaId){
  if (!sofaId) return null;
  try {
    const j = await sofaGet('event/' + sofaId);
    const ev = j && j.event; if (!ev) return null;
    const st = (ev.status && ev.status.type) || '';      // 'finished' | 'canceled' | 'inprogress' | 'notstarted' | 'postponed'
    const code = (ev.status && ev.status.code);
    if (VOID_CODES.has(code) || st === 'canceled') return { done:true, voided:true };
    if (st !== 'finished') return { done:false };
    if (ev.winnerCode === 1) return { done:true, winnerHome:true };
    if (ev.winnerCode === 2) return { done:true, winnerHome:false };
    return { done:true, voided:true };                   // acabado sin ganador claro → anular
  } catch(e){ return null; }
}

/* batch: { [sofaId]: {done,winnerHome,voided} } for the ids given.
   (La búsqueda por nombre se quitó: emparejaba por apellido suelto y sin fecha.) */
module.exports = async function sofaResults(ids){
  const out = {};
  for (const id of [...new Set((ids||[]).filter(Boolean))]){
    if (blocked) break;
    const r = await resolveSofa(id);
    if (r) out[id] = r;
  }
  return out;
};
module.exports.resolveSofa = resolveSofa;
