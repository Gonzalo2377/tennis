/* ============================================================
   MUNDIAL VALUE — data layer (FOOTBALL · national teams)
   ------------------------------------------------------------
   ⚙️  AUTOMATION HANDOFF
   The whole app reads from window.DAILY. In production a daily
   cron job (GitHub Actions / Vercel Cron) calls an odds API
   (The Odds API · OddsPapi · OddAlerts), computes value, and
   writes a `daily.json` with the SAME shape as window.DAILY.
   The app will fetch daily.json and fall back to this sample.
   See window.DAILY.meta for the contract.
   ============================================================ */

/* ---- bookmakers (Spanish-market relevant) ---- */
window.BOOKS = {
    bet365:   { name: 'Bet365',     abbr: 'B365', color: '#0a7d3c', url: '#' },
    bwin:     { name: 'bwin',       abbr: 'BW',   color: '#1a1a1a', url: '#' },
    williamh: { name: 'William Hill',abbr: 'WH',  color: '#1f5fd6', url: '#' },
    betfair:  { name: 'Betfair',    abbr: 'BF',   color: '#ffb01f', url: '#' },
    winamax:  { name: 'Winamax',    abbr: 'WMX',  color: '#e5484d', url: '#' },
    codere:   { name: 'Codere',     abbr: 'COD',  color: '#0aa05a', url: '#' },
    pinnacle: { name: 'Pinnacle',   abbr: 'PIN',  color: '#3a4660', url: '#' },
    sport888: { name: '888sport',   abbr: '888',  color: '#ff8a1e', url: '#' },
};

/* ---- national teams ---- */
/* form = last 5 results (most recent first), feeds the probability model */
function nt(id, name, code, color, conf, fifa, form) {
    return { id, name, code, color, conf, fifa, form };
}
window.TEAMS = {
    esp: nt('esp','España','ESP','#c8102e','UEFA',2,'WWWDW'),
    fra: nt('fra','Francia','FRA','#1f3a93','UEFA',3,'WWDWW'),
    arg: nt('arg','Argentina','ARG','#6cabdd','CONMEBOL',1,'WWWWD'),
    bra: nt('bra','Brasil','BRA','#ffd23f','CONMEBOL',5,'WDWLW'),
    eng: nt('eng','Inglaterra','ENG','#ffffff','UEFA',4,'WDWWD'),
    por: nt('por','Portugal','POR','#0aa05a','UEFA',6,'WWLWW'),
    ned: nt('ned','Países Bajos','NED','#ff8a1e','UEFA',7,'WWDLW'),
    ger: nt('ger','Alemania','GER','#1a1a1a','UEFA',9,'DWWLW'),
    bel: nt('bel','Bélgica','BEL','#e5484d','UEFA',8,'WLWDW'),
    cro: nt('cro','Croacia','CRO','#c8102e','UEFA',10,'DWDWL'),
    usa: nt('usa','Estados Unidos','USA','#1f5fd6','CONCACAF',16,'WLWDL'),
    mex: nt('mex','México','MEX','#0a7d3c','CONCACAF',14,'LWDWL'),
    mar: nt('mar','Marruecos','MAR','#c8102e','CAF',12,'WWDWL'),
    uru: nt('uru','Uruguay','URU','#6cabdd','CONMEBOL',11,'WDWWL'),
    col: nt('col','Colombia','COL','#ffd23f','CONMEBOL',13,'DWWDW'),
    jpn: nt('jpn','Japón','JPN','#1f3a93','AFC',17,'WWLWD'),
};
/* sample clubs (Elo-rated) so the preview shows value beyond national teams */
Object.assign(window.TEAMS, {
    rmad: { id:'rmad', name:'Real Madrid',     code:'RMA', color:'#e8e8ee', conf:'LaLiga',  elo:2030, form:'WWWDW' },
    fcba: { id:'fcba', name:'Barcelona',       code:'BAR', color:'#1f5fd6', conf:'LaLiga',  elo:1985, form:'WWDWW' },
    mci:  { id:'mci',  name:'Manchester City', code:'MCI', color:'#6cabdd', conf:'Premier', elo:2055, form:'WWWDW' },
    ars:  { id:'ars',  name:'Arsenal',         code:'ARS', color:'#e5484d', conf:'Premier', elo:2010, form:'WWDWW' },
});

/* ---- helper: build a match with multi-book 1X2 odds ---- */
/* model = {home, draw, away} probabilities (sum≈1)            */
/* odds = per-book {home,draw,away} decimal prices             */
function mkMatch(id, group, time, homeId, awayId, model, oddsByBook) {
    return { id, group, time, home: homeId, away: awayId, model, odds: oddsByBook };
}

/* spread of book prices around a center, deterministic-ish */
function spread(center, books, jitter) {
    const out = {};
    books.forEach((b, i) => {
        const j = ((i * 7) % 5 - 2) * jitter; // -2..+2 * jitter
        out[b] = +(center + j).toFixed(2);
    });
    return out;
}

window.MATCHES = [
    mkMatch('w1','Grupo B · J2','18:00','esp','cro', { home:0.62, draw:0.23, away:0.15 }, {
        home: { bet365:1.62, bwin:1.60, williamh:1.65, betfair:1.68, winamax:1.66, pinnacle:1.70, codere:1.61, sport888:1.64 },
        draw: { bet365:3.80, bwin:3.75, williamh:3.90, betfair:4.00, winamax:3.85, pinnacle:4.10, codere:3.70, sport888:3.95 },
        away: { bet365:5.50, bwin:5.25, williamh:5.75, betfair:6.00, winamax:5.60, pinnacle:6.20, codere:5.40, sport888:5.80 },
    }),
    mkMatch('w2','Grupo C · J2','21:00','arg','mex', { home:0.58, draw:0.27, away:0.15 }, {
        home: { bet365:1.70, bwin:1.68, williamh:1.72, betfair:1.75, winamax:1.71, pinnacle:1.78, codere:1.69, sport888:1.73 },
        draw: { bet365:3.50, bwin:3.45, williamh:3.60, betfair:3.70, winamax:3.55, pinnacle:3.80, codere:3.40, sport888:3.65 },
        away: { bet365:5.00, bwin:4.80, williamh:5.20, betfair:5.40, winamax:5.10, pinnacle:5.60, codere:4.90, sport888:5.30 },
    }),
    mkMatch('w3','Grupo D · J2','15:00','fra','usa', { home:0.66, draw:0.21, away:0.13 }, {
        home: { bet365:1.50, bwin:1.48, williamh:1.52, betfair:1.55, winamax:1.51, pinnacle:1.57, codere:1.49, sport888:1.53 },
        draw: { bet365:4.20, bwin:4.10, williamh:4.30, betfair:4.50, winamax:4.25, pinnacle:4.60, codere:4.05, sport888:4.35 },
        away: { bet365:6.50, bwin:6.25, williamh:6.75, betfair:7.00, winamax:6.60, pinnacle:7.20, codere:6.40, sport888:6.80 },
    }),
    mkMatch('w4','Grupo E · J2','18:00','por','mar', { home:0.54, draw:0.26, away:0.20 }, {
        home: { bet365:1.85, bwin:1.82, williamh:1.88, betfair:1.92, winamax:1.86, pinnacle:1.95, codere:1.83, sport888:1.90 },
        draw: { bet365:3.40, bwin:3.35, williamh:3.50, betfair:3.55, winamax:3.45, pinnacle:3.65, codere:3.30, sport888:3.52 },
        away: { bet365:4.20, bwin:4.10, williamh:4.40, betfair:4.50, winamax:4.30, pinnacle:4.65, codere:4.05, sport888:4.45 },
    }),
    mkMatch('w5','Grupo F · J2','21:00','bra','col', { home:0.51, draw:0.27, away:0.22 }, {
        home: { bet365:1.95, bwin:1.92, williamh:1.98, betfair:2.02, winamax:1.96, pinnacle:2.06, codere:1.93, sport888:2.00 },
        draw: { bet365:3.30, bwin:3.25, williamh:3.40, betfair:3.45, winamax:3.35, pinnacle:3.55, codere:3.20, sport888:3.42 },
        away: { bet365:4.00, bwin:3.85, williamh:4.15, betfair:4.25, winamax:4.05, pinnacle:4.40, codere:3.80, sport888:4.20 },
    }),
    mkMatch('w6','Grupo A · J2','15:00','ned','jpn', { home:0.60, draw:0.24, away:0.16 }, {
        home: { bet365:1.66, bwin:1.64, williamh:1.68, betfair:1.72, winamax:1.67, pinnacle:1.75, codere:1.65, sport888:1.70 },
        draw: { bet365:3.70, bwin:3.60, williamh:3.80, betfair:3.90, winamax:3.75, pinnacle:4.00, codere:3.55, sport888:3.85 },
        away: { bet365:5.20, bwin:5.00, williamh:5.40, betfair:5.60, winamax:5.30, pinnacle:5.80, codere:4.95, sport888:5.50 },
    }),
    mkMatch('cl1','LaLiga · J28','21:00','rmad','fcba', { home:0.50, draw:0.26, away:0.24 }, {
        home: { bet365:2.05, bwin:2.00, williamh:2.10, betfair:2.14, winamax:2.06, pinnacle:2.18, codere:2.02, sport888:2.08 },
        draw: { bet365:3.60, bwin:3.55, williamh:3.70, betfair:3.80, winamax:3.65, pinnacle:3.90, codere:3.50, sport888:3.72 },
        away: { bet365:3.50, bwin:3.40, williamh:3.60, betfair:3.70, winamax:3.55, pinnacle:3.85, codere:3.35, sport888:3.62 },
    }),
    mkMatch('cl2','Premier League · J28','18:30','mci','ars', { home:0.52, draw:0.25, away:0.23 }, {
        home: { bet365:1.95, bwin:1.92, williamh:1.98, betfair:2.02, winamax:1.96, pinnacle:2.06, codere:1.93, sport888:2.00 },
        draw: { bet365:3.70, bwin:3.60, williamh:3.80, betfair:3.90, winamax:3.75, pinnacle:4.00, codere:3.55, sport888:3.85 },
        away: { bet365:3.90, bwin:3.75, williamh:4.05, betfair:4.15, winamax:3.95, pinnacle:4.30, codere:3.70, sport888:4.10 },
    }),
];

/* ---- ODDS / VALUE ENGINE ------------------------------------ */
/* best price per outcome across books */
window.bestPrice = function (oddsMap) {
    let best = null;
    for (const b in oddsMap) if (!best || oddsMap[b] > best.price) best = { book: b, price: oddsMap[b] };
    return best;
};
/* best price ignoring an absurd outlier (> 1.5× the median = likely stale/erroneous) */
window.saneBest = function (oddsMap) {
    const v = Object.values(oddsMap).sort((a,b)=>a-b);
    const n = v.length;
    const med = n ? (n%2 ? v[(n-1)/2] : (v[n/2-1]+v[n/2])/2) : 0;
    let best = null;
    for (const b in oddsMap) { const p = oddsMap[b]; if (med && p > med*1.5) continue; if (!best || p > best.price) best = { book: b, price: p }; }
    return best || window.bestPrice(oddsMap);
};
/* consensus implied prob (avg of 1/odds) per outcome, then de-vig across the 3 outcomes */
window.marketProbs = function (m) {
    const avg = (o) => { const v = Object.values(o); return v.reduce((s,x)=>s+1/x,0) / v.length; };
    const h = avg(m.odds.home), d = avg(m.odds.draw), a = avg(m.odds.away);
    const s = h + d + a;
    return { home: h/s, draw: d/s, away: a/s };
};
/* Value per outcome. Two complementary signals:
   · rated match (we know both teams)  → model edge = model prob − market prob
   · unrated match (lower leagues etc.) → market-outlier edge: how much the BEST
     available price beats the no-vig consensus (legit line-shopping value, needs
     no team ratings, so it works in ANY competition). */
window.matchValue = function (m) {
    const mk = window.marketProbs(m);
    // Robust model: if the feed didn't attach one (unknown teams / older feed),
    // fall back to the de-vig market probabilities so nothing ever crashes.
    const model = (m.model && typeof m.model.home === 'number')
        ? m.model
        : Object.assign({}, mk, { fromMarket: true });
    const fromMarket = model.fromMarket;
    // Eligibility: a value pick must be CREDIBLE, not just a high-variance longshot.
    //  · real probability ≥ 33%   · best odds ≤ 3.40
    const MIN_P = 0.33, MAX_ODD = 3.40;
    const all = ['home','draw','away'].map(k => {
        const best = window.saneBest(m.odds[k]);
        const p = fromMarket ? mk[k] : model[k];
        const evPct = (mk[k] * best.price - 1) * 100;
        const rawEdge = fromMarket ? evPct : (model[k] - mk[k]) * 100;
        const eligible = p >= MIN_P && best.price <= MAX_ODD;
        return { k, modelP: model[k], mktP: mk[k], best, edge: rawEdge, ev: evPct, p, eligible };
    });
    const eligibles = all.filter(o => o.eligible).sort((a,b)=>b.edge - a.edge);
    // pick = best edge AMONG eligible; if none eligible, fall back to the favourite
    // (highest probability) just for display — never a longshot.
    const pick = eligibles.length ? eligibles[0] : [...all].sort((a,b)=>b.p - a.p)[0];
    const positive = pick.eligible && pick.edge >= 2;
    const outs = [...all].sort((a,b)=> (b.eligible - a.eligible) || (b.edge - a.edge));
    return {
        outcomes: outs,
        pick,
        edge: pick.edge,
        ev: pick.ev,
        positive,
        hot: positive && pick.edge >= 6,
        source: fromMarket ? 'market' : 'model',
        mk,
    };
};
window.outcomeLabel = function (k, m, lang) {
    if (k === 'draw') return lang === 'en' ? 'Draw' : 'Empate';
    const id = k === 'home' ? m.home : m.away;
    const tm = window.teamById ? window.teamById(id) : window.TEAMS[id];
    return (tm && tm.name) || (typeof id === 'string' ? id : 'Equipo');
};

/* ---- ARBITRAJE / SUREBETS ----------------------------------
   Apostar a TODOS los resultados de un partido, cada uno en la casa que
   mejor lo paga. Si la suma de probabilidades implícitas (1/cuota) es < 1,
   hay beneficio garantizado gane quien gane.  margen% = (1 - Σ 1/cuota)·100  */
window.findArbs = function (matches) {
    const list = matches || window.MATCHES || [];
    const out = [];
    list.forEach(m => {
        if (!m.odds) return;
        const keys = ['home','draw','away'].filter(k => m.odds[k] && Object.keys(m.odds[k]).length);
        if (keys.length < 2) return;                       // need at least 2 outcomes priced
        const legs = keys.map(k => {
            const all = m.odds[k];
            const best = window.bestPrice(all);            // TRUE best price (where you'd place it)
            const vals = Object.values(all).sort((a,b)=>a-b);
            const n = vals.length;
            const med = n ? (n%2 ? vals[(n-1)/2] : (vals[n/2-1]+vals[n/2])/2) : 0;
            const suspicious = med && best.price > med * 1.6;   // outlier → maybe a bookmaker error
            return { k, book: best.book, price: best.price, suspicious };
        });
        const inv = legs.reduce((s,l)=> s + 1/l.price, 0);
        const marginPct = (1 - inv) * 100;                 // >0 → guaranteed profit
        const distinctBooks = new Set(legs.map(l=>l.book)).size;
        out.push({
            m, legs, inv, marginPct,
            distinctBooks,
            sameBook: distinctBooks < 2,                   // info: all best prices at one book (rare)
            hasArb: marginPct > 0.01,                      // a positive margin IS a surebet
            suspicious: legs.some(l=>l.suspicious),
        });
    });
    return out.sort((a,b)=> b.marginPct - a.marginPct);
};
/* split a total stake across the legs so every outcome returns the same amount */
window.arbSplit = function (legs, total) {
    const inv = legs.reduce((s,l)=> s + 1/l.price, 0);
    return legs.map(l => {
        const stake = total * (1/l.price) / inv;
        return Object.assign({}, l, { stake, ret: stake * l.price });
    });
};
window.arbReturn = function (legs, total) {
    const inv = legs.reduce((s,l)=> s + 1/l.price, 0);
    return total / inv;     // guaranteed payout regardless of result
};

/* ---- COMBINADAS (accumulators) ----------------------------- */
/* free users: locked. €3.99: combo of the day. €14.99/mo: all */
window.COMBOS = [
    {
        id:'c1', tier:'single', conf:84, name:'Combinada del Día',
        legs:[
            { match:'Francia – EE. UU.', pick:'Gana Francia', odd:1.50, book:'pinnacle' },
            { match:'España – Croacia',  pick:'Gana España',  odd:1.70, book:'pinnacle' },
            { match:'Países Bajos – Japón', pick:'Gana P. Bajos', odd:1.75, book:'betfair' },
        ],
    },
    {
        id:'c2', tier:'all', conf:71, name:'Combinada Valor Medio',
        legs:[
            { match:'Portugal – Marruecos', pick:'Gana Portugal', odd:1.95, book:'pinnacle' },
            { match:'Argentina – México', pick:'Gana Argentina', odd:1.78, book:'pinnacle' },
            { match:'Brasil – Colombia', pick:'Doble oportunidad 1X', odd:1.40, book:'bet365' },
        ],
    },
    {
        id:'c3', tier:'all', conf:62, name:'Combinada Alto Valor',
        legs:[
            { match:'Marruecos – Portugal', pick:'Marruecos +1.5', odd:1.55, book:'winamax' },
            { match:'México – Argentina', pick:'Empate al desc.', odd:2.10, book:'betfair' },
            { match:'Colombia – Brasil', pick:'Ambos marcan', odd:1.72, book:'bet365' },
            { match:'Japón – P. Bajos', pick:'Japón +1.5', odd:1.60, book:'codere' },
        ],
    },
];
window.comboOdds = function (c) { return c.legs.reduce((p,l)=>p*l.odd, 1); };

/* ---- TRACK RECORD (our picks ledger vs the books) ---------- */
/* result: 'W' won, 'L' lost, 'P' push/void · stake in units (1u flat) */
window.RECORD = [
    { date:'18 JUN', pick:'Gana Alemania', match:'Alemania – Escocia', odd:1.55, book:'pinnacle', stake:1, result:'W' },
    { date:'18 JUN', pick:'Empate', match:'México – Polonia', odd:3.40, book:'betfair', stake:1, result:'W' },
    { date:'19 JUN', pick:'Gana Francia', match:'Francia – Australia', odd:1.40, book:'bet365', stake:1, result:'W' },
    { date:'19 JUN', pick:'Doble 1X', match:'Bélgica – Marruecos', odd:1.30, book:'codere', stake:1, result:'L' },
    { date:'20 JUN', pick:'Gana España', match:'España – Italia', odd:2.05, book:'pinnacle', stake:1, result:'W' },
    { date:'20 JUN', pick:'Ambos marcan', match:'Brasil – Serbia', odd:1.85, book:'winamax', stake:1, result:'L' },
    { date:'21 JUN', pick:'Gana Portugal', match:'Portugal – Ghana', odd:1.45, book:'bet365', stake:1, result:'W' },
    { date:'21 JUN', pick:'Argentina -1.5', match:'Argentina – Arabia', odd:1.95, book:'betfair', stake:1, result:'W' },
    { date:'22 JUN', pick:'Gana Países Bajos', match:'P. Bajos – Ecuador', odd:1.62, book:'pinnacle', stake:1, result:'W' },
    { date:'22 JUN', pick:'Over 2.5', match:'Inglaterra – Irán', odd:1.70, book:'sport888', stake:1, result:'L' },
    { date:'23 JUN', pick:'Gana Croacia', match:'Croacia – Canadá', odd:1.75, book:'williamh', stake:1, result:'W' },
    { date:'23 JUN', pick:'Empate', match:'Uruguay – Corea', odd:3.10, book:'betfair', stake:1, result:'W' },
];
/* selections published and awaiting the result (the robot fills this in production) */
window.PENDING = [
    { id:'demo1', date:'31 MAY', match:'PSG – Arsenal', pickLabel:'Gana Arsenal', odd:3.25, book:'unibet' },
];
/* PINNED combos — always shown on the Record page, even before the robot settles
   real ones. Edit this array to feature your own resolved accas. */
window.COMBO_PINNED = [
    { dayId:'31may·win', date:'31 MAY', name:'Combinada GRATIS', tier:'free', totalOdd:2.63, result:'W',
      legs:[ {match:'Palmeiras – Ceará', pick:'Gana Palmeiras', odd:1.33, win:true},
             {match:'R. Santander – Cádiz', pick:'Gana R. Santander', odd:1.39, win:true},
             {match:'Almería – Castellón', pick:'Gana Almería', odd:1.42, win:true} ] },
];
/* resolved accumulators — won only if EVERY leg won (the robot settles these automatically) */
window.COMBO_RECORD = [
    { dayId:'29may·c2', date:'29 MAY', name:'Combinada Valor', tier:'all', totalOdd:4.90, result:'L',
      legs:[ {match:'Francia – EE. UU.', pick:'Gana Francia', odd:1.50, win:true},
             {match:'España – Croacia', pick:'Gana España', odd:1.70, win:true},
             {match:'P. Bajos – Japón', pick:'Gana P. Bajos', odd:1.92, win:false} ] },
    { dayId:'28may·c1', date:'28 MAY', name:'Combinada del Día', tier:'single', totalOdd:3.10, result:'W',
      legs:[ {match:'Portugal – Marruecos', pick:'Gana Portugal', odd:1.75, win:true},
             {match:'Argentina – México', pick:'Gana Argentina', odd:1.77, win:true} ] },
];
window.COMBO_PENDING = window.COMBO_PENDING || [];
// pinned combos always lead, deduped by dayId
window.COMBO_RECORD = [...window.COMBO_PINNED, ...window.COMBO_RECORD.filter(c => !window.COMBO_PINNED.some(p => p.dayId === c.dayId))];
window.recordSummary = function () {
    const r = (window.RECORD || []).filter(x => x && !x.legs && x.result);
    let staked = 0, ret = 0, w = 0, l = 0, p = 0;
    const num = (v,d)=>{ const x=+v; return isFinite(x)?x:d; };
    r.forEach(x => {
        const stake = num(x.stake, 1), odd = num(x.odd, 0);
        staked += stake;
        if (x.result === 'W') { ret += stake * odd; w++; }
        else if (x.result === 'P') { ret += stake; p++; }
        else { l++; }
    });
    const denom = (w + l) || 1;
    const safeStaked = staked || 1;
    const profit = ret - staked;
    return {
        picks: r.length, w, l, p,
        winRate: Math.round(w / denom * 100),
        profit: +profit.toFixed(2),
        roi: +((profit / safeStaked) * 100).toFixed(1),
        avgOdd: r.length ? +(r.reduce((s,x)=>s+num(x.odd,0),0)/r.length).toFixed(2) : 0,
        staked,
    };
};
/* cumulative profit points for the equity curve */
window.equitySeries = function () {
    let cum = 0; const pts = [{ x:0, y:0 }];
    const num = (v,d)=>{ const x=+v; return isFinite(x)?x:d; };
    (window.RECORD || []).filter(x => x && !x.legs && x.result).forEach((x, i) => {
        const stake = num(x.stake, 1), odd = num(x.odd, 0);
        if (x.result === 'W') cum += stake * (odd - 1);
        else if (x.result === 'L') cum -= stake;
        pts.push({ x: i+1, y: +cum.toFixed(2) });
    });
    return pts;
};

/* ---- META / automation contract ---- */
window.DAILY = {
    meta: {
        updatedAt: '2026-06-21T08:00:00Z',
        source: 'sample',            // → 'the-odds-api' | 'oddspapi' | 'oddalerts'
        sport: 'soccer_fifa_world_cup',
        market: 'h2h',               // match winner (1X2)
        note: 'Replace with daily.json produced by the cron. Same keys: TEAMS, BOOKS, MATCHES, COMBOS, RECORD.',
    },
};

/* ============================================================
   i18n
   ============================================================ */
window.I18N = {
    es: {
        brandSub:'VALOR · FÚTBOL',
        navToday:'Hoy', navValue:'Valor', navCombos:'Combinadas', navRecord:'Récord', navHow:'Cómo funciona', navArb:'Sin Riesgo',
        arbEyebrow:'BENEFICIO GARANTIZADO · GANE QUIEN GANE',
        arbTitle:'Apuestas sin riesgo',
        arbLead:'Apostando a TODOS los resultados de un partido (1, X y 2) —cada uno en la casa que mejor lo paga— recuperas lo mismo gane quien gane, incluido el empate. Solo ocurre cuando las casas discrepan lo suficiente. Aquí escaneamos cada partido en busca de esa diferencia.',
        arbStakeLabel:'Inversión total a repartir',
        arbFound:'arbitrajes activos',
        arbNone:'Ahora mismo no hay arbitrajes garantizados',
        arbNoneLead:'Los arbitrajes son raros y duran poco. Te mostramos igualmente las mejores oportunidades de hoy, ordenadas por cercanía al beneficio garantizado.',
        arbProfit:'Beneficio garantizado',
        arbMargin:'Margen',
        arbStake:'Apuesta', arbReturns:'Devuelve', arbAt:'en', arbReturnsAll:'Retorno (cualquier resultado)', arbIfWins:'Si gana:',
        arbNear:'Más cerca del arbitraje',
        arbNearTag:'aún no garantiza profit',
        arbSuspect:'⚠ Cuota muy alta en una casa: verifícala antes de apostar (podría ser un error).',
        arbHow:'Cómo se reparte',
        arbDisc:'El arbitraje requiere cuentas en varias casas y actuar rápido: las cuotas cambian y algunas casas limitan a quienes lo hacen. Verifica siempre las cuotas en la casa antes de apostar.',
        searchPh:'Buscar equipo o partido…',
        updated:'Actualizado hoy', autoUpdate:'Se actualiza solo cada mañana',
        heroEyebrow:'CUOTAS CON VALOR · FÚTBOL',
        heroTitle1:'EL VALOR', heroTitle2:'DEL FÚTBOL.',
        heroLead:'Cada día comparamos las cuotas de ganador de las principales casas con la probabilidad real de nuestro modelo, en las grandes ligas y en las competiciones de selecciones. Te decimos qué apostar y en qué casa está la mejor cuota.',
        heroCta1:'Ver valor de hoy', heroCta2:'Cómo funciona',
        statMatches:'Partidos hoy', statBooks:'Casas comparadas', statValue:'Picks con valor', statRoi:'ROI histórico',
        todayTitle:'Valor del día', todayLink:'Ver tablero completo',
        boardEyebrow:'TABLERO · MERCADO vs MODELO',
        boardTitle:'Cuotas con valor — ganador',
        boardLead:'Para cada partido analizamos 1 (local), X (empate) y 2 (visitante). Te marcamos el pick con valor, la probabilidad de nuestro modelo y la mejor casa donde apostarlo.',
        thMatch:'Partido', thTime:'Hora', thPick:'Pick de valor', thModel:'Modelo', thBest:'Mejor cuota', thBook:'Casa', thEdge:'Valor', thEv:'EV',
        withValueCount:'con valor hoy', allAnalysed:'Todos los partidos analizados', noValueTitle:'Hoy no hay valor claro', noValueLead:'Nuestro modelo no encuentra una cuota con valor suficiente en los partidos de hoy. Preferimos no recomendar nada antes que forzar un pick. Vuelve mañana.',
        home:'1', draw:'X', away:'2', homeL:'Local', drawL:'Empate', awayL:'Visitante',
        model:'Modelo', market:'Mercado', edge:'Valor', pick:'Pick', noValue:'Sin valor', bestAt:'mejor en',
        viewMatch:'Ver partido', allBooks:'Todas las casas', bestOdds:'Mejor cuota',
        matchAnalysis:'Análisis del partido', winProb:'Prob. victoria', priceCompare:'Comparador de cuotas',
        priceLead:'Mejor cuota de cada resultado, casa por casa. Apuesta siempre en la verde (la más alta).',
        outcome:'Resultado', allBooksTitle:'Todas las casas',
        modelBreakdown:'Cómo lo ve el modelo', mdRating:'Rating (Elo)', mdXg:'Goles esperados (xG)', mdForm:'Forma (últimos 5)', mdMethod:'Poisson + Dixon-Coles · rating FIFA ajustado por forma',
        mdMarketOnly:'Para este partido aún no tenemos rating propio de los equipos, así que mostramos la probabilidad del mercado (sin valor calculado). El comparador de cuotas sigue activo.', mdMethodMarket:'Probabilidad del mercado (consenso sin margen) · sin rating propio',
        comboTitle:'Combinadas Premium', comboLead:'Combinaciones seleccionadas por nuestro modelo, con la confianza estimada y la casa de cada selección.',
        comboOfDay:'Combinada del día', comboConf:'Confianza del modelo', comboTotal:'Cuota total', legs:'selecciones', goPremium:'Hazte Premium',
        unlock:'Desbloquear', unlockSingle:'Desbloquea esta combinada — 3,99€', unlockAll:'Todas las combinadas — 14,99€/mes',
        lockedTitle:'Contenido Premium', lockedSub:'Hazte Premium para ver esta combinada completa',
        pricingTitle:'Hazte Premium', pricingLead:'Las cuotas con valor de cada partido son gratis. Las combinadas listas para jugar son Premium.',
        tierFree:'Gratis', tierSingle:'Combinada', tierAll:'Todo acceso',
        priceFreeDesc:'Análisis de valor de cada partido del Mundial, comparador de casas y nuestro récord público.',
        priceSingleDesc:'La combinada del día, la más factible según el modelo. Pago único, sin suscripción.',
        priceAllDesc:'Todas las combinadas diarias (factibles y de valor alto) durante todo el Mundial.',
        perOnce:'pago único', perMonth:'/mes',
        featValueBoard:'Tablero de cuotas con valor', featCompare:'Comparador de casas', featRecord:'Récord público',
        featComboDay:'Combinada del día', featCombosAll:'Todas las combinadas diarias', featHistory:'Histórico de combinadas', featPriority:'Alertas cada mañana',
        getFree:'Empezar gratis', getSingle:'Comprar 3,99€', getAll:'Suscribirme 14,99€',
        recordTitle:'Nuestro récord', recordEyebrow:'TRANSPARENCIA · RESULTADOS REALES',
        recordLead:'Cada pick que publicamos queda registrado, gane o pierda. Apuesta plana de 1 unidad. Así puedes ver nuestro rendimiento real frente a las casas.',
        roi:'ROI', profit:'Beneficio', winRate:'% Acierto', totalPicks:'Picks totales', avgOdd:'Cuota media', units:'u',
        pendingTitle:'Nuestras selecciones · en juego', pendingLead:'Picks que ya hemos publicado y están a la espera de resultado. Quedan registrados aquí con su cuota antes de empezar el partido — transparencia total.', pendingEmpty:'Ahora mismo no hay selecciones pendientes. Vuelve cuando publiquemos el próximo pick.', statusPending:'EN JUEGO',
        colDate:'Fecha', colPick:'Pick', colMatch:'Partido', colOdd:'Cuota', colBook:'Casa', colResult:'Resultado', colProfit:'Beneficio',
        comboRecTitle:'Combinadas resueltas', comboRecLead:'Cada combinada que publicamos queda registrada cuando se juegan todos sus partidos. Solo gana si aciertan TODAS las selecciones.',
        resW:'GANADA', resL:'FALLADA', resP:'NULA',
        howTitle:'Cómo funciona', howLead:'Sin humo. Esto es lo que hace el modelo cada mañana, de forma automática.',
        step1T:'Cuotas del mercado', step1D:'Cada mañana descargamos las cuotas de ganador (1X2) de 8 casas para todos los partidos del día.',
        step2T:'Probabilidad real', step2D:'Nuestro modelo (ranking FIFA, forma, bajas, contexto del torneo) calcula la probabilidad real de cada resultado.',
        step3T:'Detección de valor', step3D:'Valor = probabilidad del modelo − probabilidad implícita del mercado. Si es positivo, la cuota paga de más.',
        step4T:'Mejor casa', step4D:'Comparamos las 8 casas y te decimos exactamente dónde está la cuota más alta para ese pick.',
        autoTitle:'100% automatizado', autoD:'Un proceso diario descarga las cuotas, calcula el valor y publica todo solo. Tú no tienes que hacer nada cada día.',
        discTitle:'Juega con responsabilidad.',
        disc:'Esta plataforma es una herramienta de análisis estadístico con fines informativos. No garantiza resultados ni beneficios. El valor es una estimación de nuestro modelo. Las cuotas cambian; verifica siempre en la casa antes de apostar. +18. Juego responsable. Si crees que tienes un problema con el juego, llama al 900 200 225 (España).',
        footProduct:'Producto', footInfo:'Información', footLegal:'Legal',
        footValue:'Valor de hoy', footCombos:'Combinadas', footRecord:'Récord', footHow:'Cómo funciona',
        footAbout:'Sobre nosotros', footContact:'Contacto', footPrivacy:'Privacidad', footTerms:'Términos', footResp:'Juego responsable',
        builtWith:'Cuotas de ejemplo · Estructura lista para API de cuotas (actualización diaria automática)',
        vs:'vs', best:'MEJOR',
    },
    en: {
        brandSub:'VALUE · FOOTBALL',
        navToday:'Today', navValue:'Value', navCombos:'Accas', navRecord:'Record', navHow:'How it works', navArb:'No-Risk',
        arbEyebrow:'GUARANTEED PROFIT · WHOEVER WINS',
        arbTitle:'No-risk bets',
        arbLead:'By backing EVERY outcome of a match (home, draw and away) —each at the bookmaker paying it best— you get the same return whoever wins, draw included. It only happens when bookmakers disagree enough. Here we scan every match for that gap.',
        arbStakeLabel:'Total stake to split',
        arbFound:'live arbs',
        arbNone:'No guaranteed arbitrage right now',
        arbNoneLead:'Arbs are rare and short-lived. We still show today\\u2019s best opportunities, sorted by how close they are to guaranteed profit.',
        arbProfit:'Guaranteed profit',
        arbMargin:'Margin',
        arbStake:'Stake', arbReturns:'Returns', arbAt:'at', arbReturnsAll:'Return (any result)', arbIfWins:'If wins:',
        arbNear:'Closest to an arb',
        arbNearTag:'not yet guaranteed profit',
        arbSuspect:'⚠ Very high price at one book: verify it before betting (could be an error).',
        arbHow:'How to split',
        arbDisc:'Arbitrage needs accounts at several bookmakers and quick action: odds move and some books limit arbers. Always verify the odds at the book before betting.',
        searchPh:'Search team or match…',
        updated:'Updated today', autoUpdate:'Auto-updates every morning',
        heroEyebrow:'VALUE ODDS · FOOTBALL',
        heroTitle1:'FOOTBALL', heroTitle2:'VALUE.',
        heroLead:'Every day we compare the match-winner odds from the top books with our model\u2019s true probability, across the big leagues and national-team competitions. We tell you what to back and which book has the best price.',
        heroCta1:'See today\u2019s value', heroCta2:'How it works',
        statMatches:'Matches today', statBooks:'Books compared', statValue:'Value picks', statRoi:'All-time ROI',
        todayTitle:'Value of the day', todayLink:'Open full board',
        boardEyebrow:'BOARD · MARKET vs MODEL',
        boardTitle:'Value odds — match winner',
        boardLead:'For every match we analyse 1 (home), X (draw) and 2 (away). We flag the value pick, our model\u2019s probability and the best book to place it.',
        thMatch:'Match', thTime:'Time', thPick:'Value pick', thModel:'Model', thBest:'Best odds', thBook:'Book', thEdge:'Value', thEv:'EV',
        withValueCount:'with value today', allAnalysed:'All analysed matches', noValueTitle:'No clear value today', noValueLead:'Our model finds no odds with enough value in today\u2019s matches. We\u2019d rather recommend nothing than force a pick. Check back tomorrow.',
        home:'1', draw:'X', away:'2', homeL:'Home', drawL:'Draw', awayL:'Away',
        model:'Model', market:'Market', edge:'Value', pick:'Pick', noValue:'No value', bestAt:'best at',
        viewMatch:'View match', allBooks:'All books', bestOdds:'Best odds',
        matchAnalysis:'Match analysis', winProb:'Win prob.', priceCompare:'Odds comparison',
        priceLead:'Best price for each outcome, book by book. Always back the green one (the highest).',
        outcome:'Outcome', allBooksTitle:'All bookmakers',
        modelBreakdown:'How the model sees it', mdRating:'Rating (Elo)', mdXg:'Expected goals (xG)', mdForm:'Form (last 5)', mdMethod:'Poisson + Dixon-Coles · FIFA rating adjusted by form',
        mdMarketOnly:'We don\u2019t have our own rating for these teams yet, so we show the market probability (no value computed). The odds comparison is still active.', mdMethodMarket:'Market probability (de-vigged consensus) · no in-house rating',
        comboTitle:'Premium accumulators', comboLead:'Accumulators picked by our model, with estimated confidence and the book for each leg.',
        comboOfDay:'Acca of the day', comboConf:'Model confidence', comboTotal:'Total odds', legs:'legs', goPremium:'Go Premium',
        unlock:'Unlock', unlockSingle:'Unlock this acca — €3.99', unlockAll:'All accas — €14.99/mo',
        lockedTitle:'Premium content', lockedSub:'Go Premium to see this full accumulator',
        pricingTitle:'Go Premium', pricingLead:'The value odds for every match are free. The ready-to-play accumulators are Premium.',
        tierFree:'Free', tierSingle:'Acca', tierAll:'All access',
        priceFreeDesc:'Value analysis for every World Cup match, the odds comparison and our public record.',
        priceSingleDesc:'The acca of the day, the most likely per the model. One-off payment, no subscription.',
        priceAllDesc:'Every daily acca (safe and high-value) for the whole World Cup.',
        perOnce:'one-off', perMonth:'/mo',
        featValueBoard:'Value odds board', featCompare:'Odds comparison', featRecord:'Public record',
        featComboDay:'Acca of the day', featCombosAll:'All daily accas', featHistory:'Acca history', featPriority:'Morning alerts',
        getFree:'Start free', getSingle:'Buy €3.99', getAll:'Subscribe €14.99',
        recordTitle:'Our record', recordEyebrow:'TRANSPARENCY · REAL RESULTS',
        recordLead:'Every pick we publish is logged, win or lose. Flat 1-unit stakes. So you can see our real performance against the books.',
        roi:'ROI', profit:'Profit', winRate:'Win %', totalPicks:'Total picks', avgOdd:'Avg odds', units:'u',
        pendingTitle:'Our selections · live', pendingLead:'Picks we have already published and are awaiting the result. Logged here with their pre-match odds — full transparency.', pendingEmpty:'No pending selections right now. Check back when we post the next pick.', statusPending:'LIVE',
        colDate:'Date', colPick:'Pick', colMatch:'Match', colOdd:'Odds', colBook:'Book', colResult:'Result', colProfit:'Profit',
        comboRecTitle:'Settled accumulators', comboRecLead:'Every acca we publish is logged once all its matches are played. It only wins if ALL legs come in.',
        resW:'WON', resL:'LOST', resP:'VOID',
        howTitle:'How it works', howLead:'No smoke. Here\u2019s what the model does every morning, automatically.',
        step1T:'Market odds', step1D:'Every morning we pull match-winner (1X2) odds from 8 books for all of the day\u2019s matches.',
        step2T:'True probability', step2D:'Our model (FIFA ranking, form, absences, tournament context) computes the real probability of each outcome.',
        step3T:'Value detection', step3D:'Value = model probability − market implied probability. If positive, the price pays too much.',
        step4T:'Best book', step4D:'We compare the 8 books and tell you exactly where the highest price for that pick is.',
        autoTitle:'100% automated', autoD:'A daily job pulls the odds, computes value and publishes everything on its own. You don\u2019t have to do anything each day.',
        discTitle:'Play responsibly.',
        disc:'This platform is a statistical analysis tool for informational purposes. It does not guarantee outcomes or profit. Value is our model\u2019s estimate. Odds change; always verify at the book before betting. 18+. Responsible gaming.',
        footProduct:'Product', footInfo:'Info', footLegal:'Legal',
        footValue:'Today\u2019s value', footCombos:'Accas', footRecord:'Record', footHow:'How it works',
        footAbout:'About', footContact:'Contact', footPrivacy:'Privacy', footTerms:'Terms', footResp:'Responsible gaming',
        builtWith:'Sample odds · Structure ready for an odds API (automatic daily update)',
        vs:'vs', best:'BEST',
    }
};
