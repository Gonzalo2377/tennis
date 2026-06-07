/* ============================================================
   ACEVALUE — OddsPapi (cuotas de torneos medianos/pequeños)
   ------------------------------------------------------------
   Complementa a The Odds API: ésta trae lo grande (ATP/WTA/Masters/
   Grand Slam); OddsPapi rellena Challenger + ATP250/WTA125K (y ITF
   si sobra presupuesto), que es donde aparecen surebets de calidad.

   Estrategia anti-créditos (free = 250 req/mes ≈ 8/día):
     · /fixtures = 1 petición (lista completa del día)
     · /odds     = 1 petición POR partido → limitado por ODDSPAPI_MAX
     · descarta los partidos que The Odds API YA trajo (no duplica)
     · excluye SRL (fake), Juniors, Wheelchairs, UTR, dobles

   Devuelve eventos en el MISMO formato que The Odds API:
     { ev:{id,home_team,away_team,commence_time,bookmakers,_event,_tour}, key }
   ============================================================ */
const HOST = 'https://api.oddspapi.io/v4';
const SPORT_ID = 12;   // Tennis

// PRIORIDAD por importancia (menor número = más importante). OddsPapi rellena lo grande
// que The Odds API NO cubre o que está topado, y baja a challenger/ITF si queda presupuesto.
const PRIORITY = {
  'grand-slam':0, 'atp':1, 'wta':1, 'masters':1, 'atp-1000':1, 'wta-1000':1,
  'atp-500':2, 'wta-500':2, 'atp-250':3, 'wta-250':3,
  'challenger':4, 'wta-125k':4, 'atp-challenger':4,
  'itf-men':6, 'itf-women':6,
};
const rankOf = (cs)=> PRIORITY[cs] != null ? PRIORITY[cs] : 9;
const TIER1 = Object.keys(PRIORITY).filter(k=>PRIORITY[k]<=4);   // todo menos ITF = se pide siempre
const TIER2 = ['itf-men', 'itf-women'];
// Nunca: simulados (fake), exhibición y categorías sin valor real.
const EXCLUDE = ['simulated-reality','simulated-reality-women','utr-men','utr-women','juniors','wheelchairs','wheelchairs-juniors','legends'];

function surname(n){ return (n||'').trim().split(/\s+/).pop().normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase(); }
function isDoubles(n){ return /\s\/\s|\//.test(n||''); }
function ymd(t){ return new Date(t).toISOString().slice(0,10); }
// OddsPapi devuelve "Apellido Nombre" → reordenamos a "Nombre Apellido" (estándar) para
// que el resto del pipeline (shortName, surname, ESPN) funcione bien. Solo nombres de 2 palabras.
function reorder(n){ n=(n||'').replace(/[.,;:]+/g,' ').replace(/\s+/g,' ').trim(); const p=n.split(/\s+/); return p.length===2 ? p[1]+' '+p[0] : n; }

// Casas de apuestas EU/UK conocidas (donde la gente sí tiene cuenta). Editable con ODDSPAPI_BOOKS.
// Se compara por "contiene", así cubre variantes (bwin.dk, 888sport, etc.).
const ALLOWED_BOOKS = (process.env.ODDSPAPI_BOOKS ||
  'bet365,betfair,williamhill,unibet,betsson,marathonbet,1xbet,onexbet,pinnacle,888sport,sport888,betclic,nordicbet,coolbet,winamax,betano,betway,betvictor,tipico,bwin,leovegas,betfred,paddypower,ladbrokes,codere,parionssport,pmu,oddset,22bet,marathon'
).split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
const bookAllowed = (slug) => ALLOWED_BOOKS.some(a => String(slug).toLowerCase().includes(a));

module.exports = async function fetchOddspapi(key, opts){
  const { windowHours = 96, maxOdds = 6, existingEvents = [] } = opts || {};
  if (!key) return [];
  const now = Date.now(), horizon = now + windowHours*3600*1000;

  // 1) lista de partidos (1 petición)
  let fixtures = [];
  try {
    const r = await fetch(`${HOST}/fixtures?apiKey=${key}&sportId=${SPORT_ID}&from=${ymd(now)}&to=${ymd(horizon)}`);
    if (!r.ok) { console.log('· OddsPapi fixtures: API ' + r.status); return []; }
    fixtures = await r.json();
    if (!Array.isArray(fixtures)) return [];
  } catch(e){ console.log('· OddsPapi fixtures error:', e.message); return []; }

  // partidos que The Odds API ya cubrió → no gastar créditos en ellos
  const have = new Set();
  existingEvents.forEach(({ev}) => {
    if (ev && ev.home_team && ev.away_team) have.add([surname(ev.home_team), surname(ev.away_team)].sort().join('|'));
  });

  const elig = fixtures.filter(f => {
    if (!f.hasOdds) return false;
    if (f.statusId !== 0 && f.statusName !== 'Pre-Game') return false;     // sólo no empezados
    const cs = (f.categorySlug || '').toLowerCase();
    if (EXCLUDE.includes(cs)) return false;
    if (!TIER1.includes(cs) && !TIER2.includes(cs)) return false;
    if (isDoubles(f.participant1Name) || isDoubles(f.participant2Name)) return false;
    const ct = new Date(f.startTime).getTime();
    if (ct < now + 2*60*1000 || ct > horizon) return false;                // pre-partido, dentro de ventana
    const sig = [surname(reorder(f.participant1Name)), surname(reorder(f.participant2Name))].sort().join('|');
    if (have.has(sig)) return false;                                        // ya lo tenemos de The Odds API
    return true;
  });

  // ordena por IMPORTANCIA (Grand Slam/Masters/500/250 antes que challenger, ITF al final),
  // y dentro de cada nivel por hora de inicio. Así gastamos créditos en lo más importante.
  elig.sort((a,b) => {
    const ra = rankOf((a.categorySlug||'').toLowerCase());
    const rb = rankOf((b.categorySlug||'').toLowerCase());
    return ra - rb || (new Date(a.startTime) - new Date(b.startTime));
  });

  const pick = elig.slice(0, maxOdds);
  const events = [];
  for (const f of pick){
    try {
      const r = await fetch(`${HOST}/odds?apiKey=${key}&fixtureId=${f.fixtureId}`);
      if (!r.ok) continue;
      const od = await r.json();
      const bmk = od.bookmakerOdds || {};
      const bookmakers = [];
      for (const slug in bmk){
        const b = bmk[slug];
        if (!b || b.bookmakerIsActive === false || b.suspended === true) continue;
        if (!bookAllowed(slug)) continue;                                   // solo casas EU/UK conocidas
        const m = b.markets && b.markets['121'];                            // 121 = Match Winner
        if (!m || m.marketActive === false || !m.outcomes) continue;
        const o1 = m.outcomes['121'], o2 = m.outcomes['122'];               // 121 = jugador 1, 122 = jugador 2
        const p1 = o1 && o1.players && o1.players['0'];
        const p2 = o2 && o2.players && o2.players['0'];
        if (!p1 || !p2 || p1.active === false || p2.active === false) continue;
        const price1 = +p1.price, price2 = +p2.price;
        if (!(price1 > 1) || !(price2 > 1)) continue;
        bookmakers.push({ key: slug, title: slug, markets: [{ key:'h2h', outcomes:[
          { name: reorder(f.participant1Name), price: price1 },
          { name: reorder(f.participant2Name), price: price2 },
        ]}]});
      }
      if (bookmakers.length < 2) continue;                                  // necesitamos 2+ casas
      const cs = (f.categorySlug || '').toLowerCase();
      const tour = /women|wta/.test(cs) ? 'wta' : 'atp';
      events.push({ ev: {
        id: 'op' + f.fixtureId, home_team: reorder(f.participant1Name), away_team: reorder(f.participant2Name),
        commence_time: f.startTime, bookmakers,
        _event: f.tournamentName || f.categoryName || 'Tenis', _tour: tour,
        _sofa: (f.externalProviders && f.externalProviders.sofascoreId) || null,
      }, key: 'tennis_oddspapi_' + tour });
    } catch(e){ /* skip this fixture */ }
  }
  console.log(`· OddsPapi: ${events.length} partidos con cuotas (de ${elig.length} elegibles, ${pick.length} consultados, presupuesto ${maxOdds})`);
  return events;
};
