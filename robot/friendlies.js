/* ============================================================
   GOLVALUE — amistosos de selecciones vía API-Football
   ------------------------------------------------------------
   The Odds API no trae amistosos internacionales; esta fuente sí.
   Devuelve eventos en el MISMO formato que The Odds API para que
   el robot principal los procese igual (resolveTeam, odds, modelo).

   Requiere la variable de entorno APIFOOTBALL_KEY (api-sports.io).
   Liga 10 = "Friendlies" (selecciones). Plan free: 100 req/día.
   ============================================================ */
const HOST = 'https://v3.football.api-sports.io';

async function af(path, key){
  const r = await fetch(HOST + path, { headers: { 'x-apisports-key': key } });
  if (!r.ok) throw new Error('API-Football ' + r.status);
  return r.json();
}
function slugBook(n){ return (n||'book').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]/g,'').slice(0,14) || 'book'; }

/* fetch upcoming international friendlies with 1X2 odds → Odds-API-shaped events */
module.exports = async function fetchFriendlies(key, windowHours){
  if (!key) return [];
  const year = new Date().getFullYear();
  const from = new Date().toISOString().slice(0,10);
  const to   = new Date(Date.now() + windowHours*3600*1000).toISOString().slice(0,10);

  let fxResp;
  try { fxResp = await af(`/fixtures?league=10&season=${year}&from=${from}&to=${to}&timezone=UTC`, key); }
  catch(e){ console.log('· amistosos: fixtures falló:', e.message); return []; }

  const fixtures = {};
  (fxResp.response || []).forEach(f => {
    fixtures[f.fixture.id] = {
      home: f.teams.home.name, away: f.teams.away.name,
      homeLogo: f.teams.home.logo, awayLogo: f.teams.away.logo,
      date: f.fixture.date, status: f.fixture.status && f.fixture.status.short,
    };
  });
  const ids = Object.keys(fixtures);
  if (!ids.length) { console.log('· amistosos: 0 partidos en la ventana'); return []; }

  // odds (bulk, paginated) — Match Winner (bet id 1)
  const oddsById = {};
  let page = 1, total = 1;
  try {
    do {
      const od = await af(`/odds?league=10&season=${year}&bet=1&page=${page}`, key);
      total = (od.paging && od.paging.total) || 1;
      (od.response || []).forEach(o => { oddsById[o.fixture.id] = o.bookmakers || []; });
      page++;
    } while (page <= total && page <= 4);
  } catch(e){ console.log('· amistosos: odds falló:', e.message); }

  const events = [];
  for (const id of ids){
    const fx = fixtures[id];
    if (fx.status && fx.status !== 'NS' && fx.status !== 'TBD') continue;   // sólo no empezados
    const bms = oddsById[id];
    if (!bms || !bms.length) continue;
    const bookmakers = bms.map(bm => {
      const bet = (bm.bets || []).find(b => String(b.id) === '1' || /match winner|1x2|winner/i.test(b.name || ''));
      if (!bet || !bet.values) return null;
      const outcomes = [];
      bet.values.forEach(v => {
        const val = String(v.value || '').toLowerCase(); const price = parseFloat(v.odd);
        if (!price) return;
        if (val === 'home' || val === '1') outcomes.push({ name: fx.home, price });
        else if (val === 'away' || val === '2') outcomes.push({ name: fx.away, price });
        else if (val === 'draw' || val === 'x') outcomes.push({ name: 'Draw', price });
      });
      if (outcomes.length < 3) return null;
      return { key: slugBook(bm.name), title: bm.name, markets: [{ key: 'h2h', outcomes }] };
    }).filter(Boolean);
    if (!bookmakers.length) continue;
    events.push({
      id: 'af' + id, sport_key: 'soccer_intl_friendly',
      home_team: fx.home, away_team: fx.away, commence_time: fx.date, bookmakers,
      _logos: { home: fx.homeLogo, away: fx.awayLogo },
    });
  }
  console.log(`· amistosos: ${events.length} partidos con cuotas (de ${ids.length} fixtures)`);
  return events;
};
