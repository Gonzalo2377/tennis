/* ============================================================
   ACEVALUE — construye player-photos.json desde el ranking
   ------------------------------------------------------------
   Lee el ranking ATP+WTA de api-tennis (2 llamadas) y genera un
   mapa  apellidoCanónico → URL de foto  para ~1800 jugadores.
   URL determinista de api-tennis: {key}_{inicial}-{apellido}.jpg
   Se cachea en player-photos.json y se refresca 1 vez/semana.
   ============================================================ */
const { canonSurname } = require('./name-canon.js');

const HOST = 'https://api.api-tennis.com/tennis/';
async function get(method, key, params){
  const qs = new URLSearchParams(Object.assign({ method, APIkey:key }, params||{})).toString();
  const r = await fetch(HOST + '?' + qs);
  if (!r.ok) throw new Error('api-tennis ' + r.status);
  return r.json();
}
function norm(w){ return (w||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]/gi,'').toLowerCase(); }
function photoUrl(player_key, name){
  const t = (name||'').replace(/[.,;:]+/g,' ').trim().split(/\s+/).filter(Boolean);
  if (!t.length) return null;
  const initial = norm(t[0]).slice(0,1);
  const last = canonSurname(name);
  if (!initial || !last) return null;
  return 'https://api.api-tennis.com/logo-tennis/' + player_key + '_' + initial + '-' + last + '.jpg';
}

module.exports = async function buildPhotos(key){
  const out = {};
  for (const ev of ['ATP','WTA']){
    let j; try { j = await get('get_standings', key, { event_type:ev }); } catch(e){ console.log('· build-photos '+ev+':', e.message); continue; }
    (j.result || []).forEach(r => {
      const k = canonSurname(r.player);
      if (!k || out[k]) return;
      const url = photoUrl(r.player_key, r.player);
      if (url) out[k] = url;
    });
  }
  console.log('· build-photos: ' + Object.keys(out).length + ' jugadores con foto');
  return out;
};
