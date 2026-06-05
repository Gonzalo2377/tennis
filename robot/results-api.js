/* ============================================================
   ACEVALUE — resultados + fotos vía api-tennis.com
   ------------------------------------------------------------
   Una sola fuente nos da: partidos terminados con su ganador
   (para liquidar picks/combis/surebets) y la foto de cada
   jugador (para los avatares).
   Requiere la variable de entorno APITENNIS_KEY.
   ============================================================ */
const HOST = 'https://api.api-tennis.com/tennis/';

function surnameKey(name){ return (name||'').trim().replace(/[.,;:]+$/,'').split(/\s+/).pop().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9-]/gi,'').toLowerCase(); }

async function get(method, key, params){
  const qs = new URLSearchParams(Object.assign({ method, APIkey:key }, params)).toString();
  const r = await fetch(HOST + '?' + qs);
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return r.json();
}

/* returns { winners:[surnameKey,...], finished:[{home,away,winner}], logos:{...} } for the last `days` */
module.exports = async function apiTennis(key, days){
  if (!key) return { winners:[], finished:[], logos:{} };
  const fmt = d => d.toISOString().slice(0,10);
  const start = fmt(new Date(Date.now() - (days||5)*24*3600*1000));
  const stop  = fmt(new Date(Date.now() + 24*3600*1000));   // include today
  let j;
  try { j = await get('get_fixtures', key, { date_start:start, date_stop:stop }); }
  catch(e){ console.log('· api-tennis: error', e.message); return { winners:[], finished:[], logos:{} }; }
  const rows = (j && j.result) || [];
  const winners = [], finished = [], voided = [], logos = {};
  rows.forEach(ev => {
    const p1 = ev.event_first_player, p2 = ev.event_second_player;
    if (ev.event_first_player_logo)  logos[surnameKey(p1)] = ev.event_first_player_logo;
    if (ev.event_second_player_logo) logos[surnameKey(p2)] = ev.event_second_player_logo;
    const st = (ev.event_status||'').toLowerCase();
    const fr = (ev.event_final_result||'') + ' ' + (ev.event_game_result||'');
    // RETIRADA / WALKOVER → apuesta anulada (cuota 1.00)
    const isVoid = /retir|walkover|w\/o|abandon|cancel|awarded|def\b/.test(st) || /\bret\.?\b|w\/o|walkover/i.test(fr);
    if (isVoid && p1 && p2){ voided.push({ home:p1, away:p2 }); return; }
    if (st !== 'finished') return;
    const w = ev.event_winner === 'First Player' ? p1 : ev.event_winner === 'Second Player' ? p2 : null;
    if (w){ winners.push(surnameKey(w)); finished.push({ home:p1, away:p2, winner:w }); }
  });
  console.log(`· api-tennis: ${rows.length} fixtures · ${winners.length} terminados · ${voided.length} retiradas · ${Object.keys(logos).length} fotos`);
  return { winners, finished, voided, logos };
};
