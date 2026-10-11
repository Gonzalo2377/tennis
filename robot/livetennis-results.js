/* ============================================================
   ACEVALUE — resultados vía livetennisapi.com  (FUENTE OPCIONAL)
   ------------------------------------------------------------
   Fuente ADICIONAL de resultados, en paralelo a ESPN y api-tennis.
   Se activa SOLO si existe la variable de entorno LIVETENNISAPI_KEY.
   Sin esa variable no se llama a nada y el robot se comporta
   exactamente igual que antes.

   Qué devuelve (mismo contrato que results-api.js, para poder
   fusionarlo con el resto sin tocar la lógica de liquidación):
     winners  [surnameKey, ...]          → ganadores por apellido
     finished [{home, away, winner}]     → pares terminados
     voided   [{home, away}]             → partidos cancelados
     unfinished []                       → SIEMPRE vacío (ver nota)
     logos    {}                         → SIEMPRE vacío (ver nota)

   Dos huecos honestos de esta fuente:
     · No sirve fotos de jugadores → `logos` se queda vacío y las
       fotos las siguen poniendo api-tennis / build-photos.js.
     · El histórico distingue "terminado" y "cancelado", pero no
       marca "suspendido/aplazado", así que `unfinished` va vacío y
       nunca reabre registros. Reabrir sigue siendo cosa de api-tennis.

   El histórico empieza en 2026 (no hay datos anteriores) y requiere
   un plan BASIC o superior; con una clave FREE la API responde 403 y
   lo decimos por consola en vez de fallar en silencio.
   ============================================================ */
const HOST = 'https://api.livetennisapi.com/api/public/v1';
const PAGE = 100;          // máximo de partidos por página que pedimos
const MAX_PAGES = 40;      // tope de seguridad: nunca paginamos sin fin

function surnameKey(name){ return (name||'').trim().replace(/[.,;:]+$/,'').split(/\s+/).pop().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9-]/gi,'').toLowerCase(); }

async function get(path, key, params){
  const qs = new URLSearchParams(params).toString();
  const r = await fetch(HOST + path + '?' + qs, {
    headers: { 'Authorization': 'Bearer ' + key, 'Accept': 'application/json' }
  });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return r.json();
}

/* returns { winners, finished, voided, unfinished, logos } de los últimos `days` días */
module.exports = async function liveTennisApi(key, days){
  const empty = { winners:[], finished:[], voided:[], unfinished:[], logos:{} };
  if (!key) return empty;

  const fmt = d => d.toISOString().slice(0,10);
  const from = fmt(new Date(Date.now() - (days||5)*24*3600*1000));
  const to   = fmt(new Date(Date.now() + 24*3600*1000));   // incluye hoy

  const rows = [];
  try {
    for (let page = 0; page < MAX_PAGES; page++){
      const j = await get('/history/matches', key, {
        from, to, limit: PAGE, offset: page * PAGE
      });
      const data = (j && j.data) || [];
      rows.push(...data);
      if (!(j && j.meta && j.meta.has_more)) break;
    }
  } catch(e){
    // 403 = el histórico pide plan BASIC; 401 = clave inválida. En ambos casos
    // avisamos y devolvemos vacío: las demás fuentes siguen liquidando igual.
    console.log('· livetennisapi: error', e.message);
    return empty;
  }

  const winners = [], finished = [], voided = [], logos = {};
  rows.forEach(ev => {
    const players = ev.players || {};
    const p1 = players.p1 || {}, p2 = players.p2 || {};
    const n1 = p1.name, n2 = p2.name;
    if (!n1 || !n2) return;

    // CANCELADO → apuesta anulada (cuota 1.00), igual que un walkover.
    if (ev.status === 'cancelled'){ voided.push({ home:n1, away:n2 }); return; }
    if (ev.status !== 'completed') return;

    // `winner` es el id del jugador ganador y sólo viene en partidos
    // terminados. Si falta, el partido queda pendiente: no inventamos ganador.
    const w = ev.winner === p1.id ? n1 : ev.winner === p2.id ? n2 : null;
    if (w){ winners.push(surnameKey(w)); finished.push({ home:n1, away:n2, winner:w }); }
  });

  console.log(`· livetennisapi: ${rows.length} partidos · ${winners.length} terminados · ${voided.length} cancelados`);
  return { winners, finished, voided, unfinished:[], logos };
};
