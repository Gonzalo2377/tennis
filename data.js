/* ============================================================
   ACEVALUE — datos + motor (tenis · 2 vías, sin empate)
   ------------------------------------------------------------
   El robot reescribe PLAYERS / MATCHES / RECORD en daily.json.
   Esto son datos de ejemplo para que la web se vea antes de
   conectar la API.
   ============================================================ */

/* ---- bookmakers (mercado europeo) ---- */
window.BOOKS = {
    pinnacle:  { name:'Pinnacle',  abbr:'PIN', color:'#e23b2e' },
    bet365:    { name:'Bet365',    abbr:'B365',color:'#0a7d3c' },
    williamhill:{name:'WilliamHill',abbr:'WH', color:'#0a2d6e' },
    unibet:    { name:'Unibet',    abbr:'UNI', color:'#14805e' },
    betfair:   { name:'Betfair',   abbr:'BF',  color:'#ffb000' },
    marathonbet:{name:'Marathon',  abbr:'MAR', color:'#d11a2a' },
    onexbet:   { name:'1xBet',     abbr:'1XB', color:'#0a6cff' },
    matchbook: { name:'Matchbook', abbr:'MAT', color:'#1c1c1c' },
};

/* ---- players (grass season 2026 era) ---- */
function P(id, name, country, flag, seed, tour, elo, form){
    return { id, name, country, flag, seed, tour, elo, form };
}
window.PLAYERS = {
    sin: P('sin','J. Sinner','ITA','🇮🇹',1,'atp',2185,['W','W','W','L','W']),
    alc: P('alc','C. Alcaraz','ESP','🇪🇸',2,'atp',2150,['W','W','L','W','W']),
    zve: P('zve','A. Zverev','GER','🇩🇪',3,'atp',2010,['L','W','W','W','L']),
    djo: P('djo','N. Djokovic','SRB','🇷🇸',4,'atp',2040,['W','L','W','W','W']),
    fri: P('fri','T. Fritz','USA','🇺🇸',5,'atp',1925,['W','W','L','L','W']),
    rud: P('rud','C. Ruud','NOR','🇳🇴',7,'atp',1890,['L','W','W','L','W']),
    med: P('med','D. Medvedev','RUS','🇷🇺',6,'atp',1955,['W','L','L','W','W']),
    dim: P('dim','G. Dimitrov','BUL','🇧🇬',12,'atp',1840,['W','W','W','L','L']),
    swi: P('swi','I. Świątek','POL','🇵🇱',1,'wta',2120,['W','W','W','W','L']),
    sab: P('sab','A. Sabalenka','BLR','🇧🇾',2,'wta',2095,['W','W','L','W','W']),
    gau: P('gau','C. Gauff','USA','🇺🇸',3,'wta',2010,['W','L','W','W','W']),
    ryb: P('ryb','E. Rybakina','KAZ','🇰🇿',4,'wta',1990,['L','W','W','W','L']),
    pae: P('pae','J. Paolini','ITA','🇮🇹',5,'wta',1900,['W','W','L','W','L']),
    zhe: P('zhe','Q. Zheng','CHN','🇨🇳',6,'wta',1885,['W','L','W','L','W']),
};

/* helper: build a multi-book 2-way odds map around a "true" prob with noise */
function mkOdds(pA, books, spread){
    // pA = fair win prob of A. Bookmaker adds margin (~5%), each book varies.
    const oddsA={}, oddsB={};
    const fairA=1/pA, fairB=1/(1-pA);
    books.forEach((b,i)=>{
        const jitterA = 1 + (Math.sin(i*1.7)*spread);
        const jitterB = 1 + (Math.cos(i*2.1)*spread);
        const marg = 0.965 - i*0.004;       // some books sharper than others
        oddsA[b]= +(fairA*marg*jitterA).toFixed(2);
        oddsB[b]= +(fairB*marg*jitterB).toFixed(2);
    });
    return { home:oddsA, away:oddsB };
}

window.MATCHES = [
    { id:'m1', tour:'atp', event:'ATP 500 · Queen\u2019s', round:'Cuartos', surface:'Hierba', time:'14:00',
      home:'sin', away:'dim', odds: mkOdds(0.80, ['pinnacle','bet365','williamhill','unibet','betfair','onexbet'], 0.05) },
    { id:'m2', tour:'atp', event:'ATP 500 · Halle', round:'Cuartos', surface:'Hierba', time:'15:30',
      home:'med', away:'fri', odds: mkOdds(0.52, ['pinnacle','bet365','marathonbet','unibet','onexbet','matchbook'], 0.07) },
    { id:'m3', tour:'atp', event:'ATP 500 · Queen\u2019s', round:'Cuartos', surface:'Hierba', time:'17:00',
      home:'alc', away:'rud', odds: mkOdds(0.71, ['pinnacle','bet365','williamhill','betfair','onexbet'], 0.06) },
    { id:'m4', tour:'wta', event:'WTA 500 · Berlín', round:'Octavos', surface:'Hierba', time:'12:30',
      home:'swi', away:'pae', odds: mkOdds(0.68, ['pinnacle','bet365','unibet','marathonbet','onexbet','matchbook'], 0.08) },
    { id:'m5', tour:'wta', event:'WTA 500 · Berlín', round:'Octavos', surface:'Hierba', time:'13:45',
      home:'sab', away:'zhe', odds: mkOdds(0.74, ['pinnacle','bet365','williamhill','unibet','onexbet'], 0.05) },
    { id:'m6', tour:'atp', event:'ATP 250 · Stuttgart', round:'Semifinal', surface:'Hierba', time:'16:15',
      home:'zve', away:'djo', odds: mkOdds(0.46, ['pinnacle','bet365','marathonbet','betfair','onexbet','matchbook'], 0.09) },
    { id:'m7', tour:'wta', event:'WTA 500 · Berlín', round:'Octavos', surface:'Hierba', time:'18:00',
      home:'gau', away:'ryb', odds: mkOdds(0.55, ['pinnacle','bet365','unibet','williamhill','onexbet'], 0.07) },
];

/* ============================================================
   ENGINE
   ============================================================ */
window.bestPrice = function(map){
    let best=null;
    for(const b in map) if(!best || map[b]>best.price) best={book:b, price:map[b]};
    return best;
};
window.saneBest = function(map){
    const v=Object.values(map).sort((a,b)=>a-b), n=v.length;
    const med = n ? (n%2 ? v[(n-1)/2] : (v[n/2-1]+v[n/2])/2) : 0;
    let best=null;
    for(const b in map){ const p=map[b]; if(med && p>med*1.6) continue; if(!best||p>best.price) best={book:b,price:p}; }
    return best || window.bestPrice(map);
};
/* de-vig 2-way market consensus (avg of 1/odds per side, normalised) */
window.marketProbs = function(m){
    const avg=o=>{const v=Object.values(o);return v.reduce((s,x)=>s+1/x,0)/v.length;};
    const a=avg(m.odds.home), b=avg(m.odds.away), s=a+b;
    return { home:a/s, away:b/s };
};
/* value: best price vs fair consensus → EV%. Eligible if credible (prob≥35%, odds≤3.2). */
window.matchValue = function(m){
    const mk = window.marketProbs(m);
    // use our model's probability when the feed provides it, else de-vig market
    const useModel = m.model && typeof m.model.home === 'number';
    const prob = useModel ? { home:m.model.home, away:m.model.away } : mk;
    const MIN_P=0.35, MAX_ODD=4.50;
    // cuanto más alta la cuota, más valor (edge) exigimos para fiarnos:
    //  cuota 1.5 → ≥2% · 2.0 → ≥4% · 3.0 → ≥8% · 3.25 → ≥9% · 4.5 → ≥14%
    const minEdge = (odd)=> Math.max(2, 2 + (odd-1.5)*4);
    const all = ['home','away'].map(k=>{
        const best = window.saneBest(m.odds[k]);
        const ev = (prob[k]*best.price - 1)*100;
        const eligible = prob[k]>=MIN_P && best.price<=MAX_ODD && ev>=minEdge(best.price);
        return { k, p:prob[k], best, edge:ev, eligible };
    });
    const outs = [...all].sort((a,b)=>(b.eligible-a.eligible)||(b.edge-a.edge));
    const top = outs[0];
    const valid = top.eligible;
    return { outcomes:outs, pick:top, edge:top.edge, positive:valid, hot:valid&&top.edge>=minEdge(top.best.price)*2 };
};
/* SUREBET (2-way): back both sides at their best book. margin>0 → guaranteed. */
window.findArbs = function(matches){
    const list = matches || window.MATCHES || [];
    const out = [];
    list.forEach(m=>{
        if(!m.odds || !m.odds.home || !m.odds.away) return;
        const legs = ['home','away'].map(k=>{
            const all=m.odds[k]; const best=window.bestPrice(all);
            const v=Object.values(all).sort((a,b)=>a-b), n=v.length;
            const med=n?(n%2?v[(n-1)/2]:(v[n/2-1]+v[n/2])/2):0;
            return { k, book:best.book, price:best.price, suspicious: med && best.price>med*1.7 };
        });
        const inv = legs.reduce((s,l)=>s+1/l.price,0);
        const marginPct = (1-inv)*100;
        out.push({ m, legs, inv, marginPct, hasArb: marginPct>0.01, suspicious: legs.some(l=>l.suspicious) });
    });
    return out.sort((a,b)=>b.marginPct-a.marginPct);
};
window.arbSplit = function(legs,total){
    const inv = legs.reduce((s,l)=>s+1/l.price,0);
    return legs.map(l=>{ const stake=total*(1/l.price)/inv; return Object.assign({},l,{stake, ret:stake*l.price}); });
};
window.arbReturn = function(legs,total){ const inv=legs.reduce((s,l)=>s+1/l.price,0); return total/inv; };

/* per-player value breakdown for the match page. Uses Pinnacle (sharpest book)
   as the "fair" probability when available, else the de-vig consensus. */
window.valueBreakdown = function(m){
  const mk = window.marketProbs(m);
  const avgOdd = (k)=>{ const v=Object.values(m.odds[k]); return v.reduce((s,x)=>s+x,0)/v.length; };
  let sharp, sharpFrom;
  if (m.model && typeof m.model.home === 'number'){
    sharp = { home:m.model.home, away:m.model.away }; sharpFrom = 'modelo';   // our Elo+surface model
  } else {
    const ph = m.odds.home && m.odds.home.pinnacle, pa = m.odds.away && m.odds.away.pinnacle;
    if (ph != null && pa != null){ const ih=1/ph, ia=1/pa, s=ih+ia; sharp={home:ih/s, away:ia/s}; sharpFrom='Pinnacle'; }
    else { sharp = mk; sharpFrom='consenso'; }
  }
  const rows = ['home','away'].map(k => {
    const best = window.saneBest(m.odds[k]);
    const prob = sharp[k], fair = 1/prob;
    const valuePct = (best.price * prob - 1) * 100;
    return { k, prob, mktProb: mk[k], avgOdd: avgOdd(k), fair, best, valuePct, value: valuePct >= 1.5 };
  });
  return { rows, sharpFrom, model: m.model || null };
};

window.getPlayer = (id)=> window.PLAYERS[id] || { id, name:(typeof id==='string'?id:'Jugador'), country:'', flag:'', seed:'', tour:'atp', elo:null, form:[] };
window.getBook = (id)=> window.BOOKS[id] || { id, name:(typeof id==='string'?id:'Casa'), abbr:'?', color:'#888' };
window.outcomeLabel = (k,m)=> window.getPlayer(k==='home'?m.home:m.away).name;

/* ---- COMBINADAS ---- */
window.COMBOS = [
    { id:'c1', name:'Combinada del Día', conf:74,
      legs:[ {match:'Sinner – Dimitrov', pick:'Gana Sinner', odd:1.28, book:'pinnacle'},
             {match:'Sabalenka – Zheng', pick:'Gana Sabalenka', odd:1.40, book:'bet365'},
             {match:'Alcaraz – Ruud', pick:'Gana Alcaraz', odd:1.44, book:'unibet'} ] },
    { id:'c2', name:'Combinada Valor', conf:61,
      legs:[ {match:'Świątek – Paolini', pick:'Gana Świątek', odd:1.52, book:'pinnacle'},
             {match:'Gauff – Rybakina', pick:'Gana Gauff', odd:1.92, book:'onexbet'},
             {match:'Medvedev – Fritz', pick:'Gana Medvedev', odd:1.95, book:'matchbook'} ] },
];

/* ---- TRACK RECORD (1u flat) ---- */
window.RECORD = [
    { date:'04 JUN', match:'M. Kostyuk – M. Andreeva', pick:'Gana M. Andreeva', odd:2.20, book:'betfair', result:'W' },
    { date:'04 JUN', match:'D. Shnaider – M. Chwalinska', pick:'Gana D. Shnaider', odd:1.59, book:'bet365', result:'L' },
    { date:'03 JUN', match:'Kalinskaya – Chwalinska', pick:'Gana A. Kalinskaya', odd:2.00, book:'matchbook', result:'L' },
];
window.COMBO_RECORD = [];
window.COMBO_PENDING = [
    { date:'05 JUN', name:'Combinada del Día',
      legs:[ {match:'M. Arnaldi – F. Cobolli', pick:'Gana M. Arnaldi', odd:3.15, ts:1780664400000},
             {match:'M. Chwalinska – M. Andreeva', pick:'Gana M. Andreeva', odd:1.28, ts:1780750800000} ] },
];
window.PENDING = [];
/* SIN RIESGO — historial de surebets capturados (beneficio garantizado a 100€ de referencia) */
window.ARB_RECORD = [
  { date:'03 JUN', match:'Sabalenka – Shnaider', marginPct:1.42, profit:1.44,
    legs:[ {pick:'Gana A. Sabalenka', odd:1.15, book:'gtbets'}, {pick:'Gana D. Shnaider', odd:8.60, book:'betfair'} ] },
];
window.recordSummary = function(){
    const r = window.RECORD || [];
    let staked=0, returned=0, w=0;
    r.forEach(x=>{ staked+=1; if(x.result==='W'){ returned+=x.odd; w++; } });
    const profit = returned - staked;
    const roi = staked ? (profit/staked)*100 : 0;
    const hit = r.length ? (w/r.length)*100 : 0;
    return { n:r.length, w, l:r.length-w, profit, roi, hit, staked };
};
window.comboSummary = function(){
    const c = window.COMBO_RECORD || [];
    const w = c.filter(x=>x.result==='W').length;
    const hit = c.length ? (w/c.length)*100 : 0;
    return { n:c.length, w, l:c.length-w, hit };
};
window.arbSummary = function(){
    const a = window.ARB_RECORD || [];
    const profit = a.reduce((s,x)=> s + (x.profit||0), 0);
    const avg = a.length ? a.reduce((s,x)=> s + (x.marginPct||0), 0)/a.length : 0;
    return { n:a.length, profit, avg };
};

/* ============================================================
   i18n
   ============================================================ */
window.I18N = {
  es: {
    brandSub:'TENIS · VALOR',
    navValue:'Valor', navArb:'Sin Riesgo', navCombos:'Combinadas', navRecord:'Récord', navHow:'Cómo funciona', statusPend:'EN JUEGO',
    searchPh:'Buscar jugador o partido…', updated:'Actualizado hoy', autoUpdate:'Se actualiza solo cada día',
    searchNone:'Sin resultados', searchNext:'Próximo', searchNoNext:'Sin próximo partido programado',
    vs:'vs',
    heroEyebrow:'EL MODELO VS EL MERCADO',
    heroTitle1:'Cuotas de tenis', heroTitle2:'con valor.',
    heroLead:'Comparamos la cuota del mercado con la probabilidad real para detectar el valor que las casas no ven. Y como el tenis es a dos —sin empate— encontramos apuestas sin riesgo a diario.',
    heroCta1:'Ver el valor de hoy', heroCta2:'Apuestas sin riesgo',
    valueOfDay:'Valor del día', seeAll:'Ver todo',
    boardEyebrow:'TABLERO · CUOTAS CON VALOR', boardTitle:'Valor de hoy',
    boardLead:'Mejor cuota de cada partido frente a la probabilidad real del mercado. En amarillo, las que tienen valor según nuestro modelo.',
    withValueCount:'con valor hoy', allAnalysed:'Todos los partidos analizados',
    noValueTitle:'Hoy no hay valor claro', noValueLead:'Preferimos no recomendar nada antes que forzar un pick. Vuelve mañana.',
    thMatch:'Partido', thTime:'Hora', thPick:'Pick de valor', thMarket:'Mercado', thBest:'Mejor cuota', thBook:'Casa', thEdge:'Valor',
    vaTitle:'Análisis de valor', vaIntro:'Calculamos la probabilidad real con NUESTRO modelo ({src}): Elo del jugador + ventaja por superficie + forma reciente. La comparamos con la cuota media del mercado y la mejor disponible. Si pagan más de lo justo, hay valor.',
    vaProb:'Prob. modelo', vaOur:'Nuestra cuota', vaAvg:'Media mercado', vaFair:'Cuota justa', vaBest:'Mejor cuota', vaNoValue:'Sin valor',
    vaFoot:'Prob. modelo = nuestra estimación (Elo + superficie + forma) · Nuestra cuota = 1/prob · Media = promedio de casas · Valor = cuánto paga de más la mejor casa frente a lo justo.',
    // arb
    arbEyebrow:'BENEFICIO GARANTIZADO · GANE QUIEN GANE', arbTitle:'Apuestas sin riesgo',
    arbLead:'En tenis solo hay dos resultados. Apostando a los DOS jugadores —cada uno en la casa que mejor lo paga— recuperas lo mismo gane quien gane. Aquí escaneamos cada partido buscando esa diferencia.',
    arbStakeLabel:'Inversión total a repartir', arbFound:'sin riesgo hoy',
    arbNone:'Ahora mismo no hay apuestas sin riesgo', arbNoneLead:'Cambian en segundos. Te mostramos las oportunidades más cercanas, ordenadas por margen.',
    arbProfit:'Beneficio garantizado', arbReturnsAll:'Retorno (cualquier resultado)',
    arbStake:'Apuesta', arbAt:'en', arbIfWins:'Si gana:', arbNear:'Más cerca del valor', arbNearTag:'aún no garantiza profit',
    arbModeLabel:'Reparto', arbModeEven:'Igual', arbModeCover:'Cubrir',
    arbModeEvenHint:'Reparto equilibrado: recuperas lo MISMO gane quien gane (beneficio garantizado).',
    arbModeCoverHint:'Cubrir: si gana el jugador que respaldas (●) ganas dinero; si gana el otro, recuperas tu apuesta (0, ni ganas ni pierdes). Toca el círculo para elegir a quién respaldas.',
    arbCoverIf:'Si gana', arbCoverElse:'Si gana el otro',
    arbDisc:'Requiere cuentas en varias casas y actuar rápido: las cuotas se mueven y algunas casas limitan. Verifica siempre la cuota antes de apostar.',
    // combos
    comboEyebrow:'COMBINADAS DEL DÍA', comboTitle:'Combinadas',
    comboLead:'Nuestras combinadas de tenis del día, con la mejor casa para cada selección y la cuota total.',
    comboConf:'Confianza', comboTotal:'Cuota total', comboLegs:'selecciones',
    // record
    recEyebrow:'TRANSPARENCIA TOTAL', recTitle:'Nuestro récord', recLead:'Cada pick que publicamos queda registrado, gane o pierda. A 1 unidad por apuesta.',
    stHit:'Acierto', stRoi:'ROI', stProfit:'Beneficio', stPicks:'Picks', units:'u',
    colDate:'Fecha', colMatch:'Partido', colPick:'Pick', colOdd:'Cuota', colBook:'Casa', colResult:'Resultado',
    resW:'Ganada', resL:'Fallada',
    comboRecTitle:'Combinadas resueltas', comboRecLead:'Cada combinada queda registrada al terminar. Solo gana si aciertan TODAS las selecciones.',
    arbRecTitle:'Historial sin riesgo', arbRecLead:'Cada apuesta sin riesgo (reparto «Igual») que detectamos queda registrada con su beneficio garantizado, calculado sobre 100€ de referencia.',
    arbRecN:'Surebets', arbRecProfit:'Beneficio acumulado', arbRecAvg:'Margen medio', arbRecMargin:'Margen',
    pendingTitle:'Nuestras selecciones · en juego', pendingLead:'Picks ya publicados a la espera de resultado. Quedan registrados con su cuota antes de empezar el partido.', pendingTag:'EN JUEGO',
    // how
    howEyebrow:'CÓMO FUNCIONA', howTitle:'El método', 
    how1t:'1 · Recogemos las cuotas', how1d:'Cada día leemos las cuotas de varias casas para los partidos ATP y WTA.',
    how2t:'2 · Calculamos la probabilidad real', how2d:'Quitamos el margen de la casa y promediamos el mercado para estimar la probabilidad justa de cada jugador.',
    how3t:'3 · Buscamos el valor y el riesgo cero', how3d:'Marcamos los picks donde la mejor cuota supera a la probabilidad real, y los partidos donde apostar a los dos lados garantiza beneficio.',
    autoTitle:'Todo automático', autoD:'La web se actualiza sola cada día con las cuotas nuevas. Nada que tocar a mano.',
    footProduct:'Producto', footValue:'Valor', footArb:'Sin riesgo', footCombos:'Combinadas', footRecord:'Récord',
    footInfo:'Info', footHow:'Cómo funciona', footAbout:'Sobre nosotros', footContact:'Contacto',
    discTitle:'Juego responsable.', disc:'Contenido informativo, no es consejo de inversión. Apostar conlleva riesgo. +18. Juega con responsabilidad.',
  },
  en: {
    brandSub:'TENNIS · VALUE',
    navValue:'Value', navArb:'No-Risk', navCombos:'Accas', navRecord:'Record', navHow:'How it works', statusPend:'LIVE',
    searchPh:'Search player or match…', updated:'Updated today', autoUpdate:'Auto-updates daily',
    searchNone:'No results', searchNext:'Next', searchNoNext:'No upcoming match scheduled',
    vs:'vs',
    heroEyebrow:'THE MODEL VS THE MARKET',
    heroTitle1:'Tennis odds', heroTitle2:'with value.',
    heroLead:'We compare the market price with the true probability to surface the value bookmakers miss. And since tennis is two-way —no draw— we find no-risk bets daily.',
    heroCta1:'See today\u2019s value', heroCta2:'No-risk bets',
    valueOfDay:'Value of the day', seeAll:'See all',
    boardEyebrow:'BOARD · VALUE ODDS', boardTitle:'Today\u2019s value',
    boardLead:'Best price of each match vs the market\u2019s true probability. In yellow, the ones with value per our model.',
    withValueCount:'with value today', allAnalysed:'All analysed matches',
    noValueTitle:'No clear value today', noValueLead:'We\u2019d rather recommend nothing than force a pick. Check back tomorrow.',
    thMatch:'Match', thTime:'Time', thPick:'Value pick', thMarket:'Market', thBest:'Best odds', thBook:'Book', thEdge:'Value',
    vaTitle:'Value breakdown', vaIntro:'We compute the true probability with OUR model ({src}): player Elo + surface edge + recent form. We compare it to the market average price and the best available. If they pay more than fair, there is value.',
    vaProb:'Model prob', vaOur:'Our odds', vaAvg:'Market avg', vaFair:'Fair odds', vaBest:'Best odds', vaNoValue:'No value',
    vaFoot:'Model prob = our estimate (Elo + surface + form) · Our odds = 1/prob · Avg = books average · Value = how much more the best book pays vs fair.',
    arbEyebrow:'GUARANTEED PROFIT · WHOEVER WINS', arbTitle:'No-risk bets',
    arbLead:'Tennis has only two outcomes. Backing BOTH players —each at the bookmaker paying it best— returns the same whoever wins. Here we scan every match for that gap.',
    arbStakeLabel:'Total stake to split', arbFound:'no-risk today',
    arbNone:'No no-risk bets right now', arbNoneLead:'They change within seconds. We show the closest opportunities, sorted by margin.',
    arbProfit:'Guaranteed profit', arbReturnsAll:'Return (any result)',
    arbStake:'Stake', arbAt:'at', arbIfWins:'If wins:', arbNear:'Closest to value', arbNearTag:'not yet guaranteed profit',
    arbModeLabel:'Split', arbModeEven:'Even', arbModeCover:'Cover',
    arbModeEvenHint:'Balanced split: you get back the SAME whoever wins (guaranteed profit).',
    arbModeCoverHint:'Cover: if the player you back (●) wins you profit; if the other wins you get your stake back (0, no loss). Tap the circle to choose who to back.',
    arbCoverIf:'If wins', arbCoverElse:'If the other wins',
    arbDisc:'Needs accounts at several bookmakers and quick action: odds move and some books limit. Always verify the price before betting.',
    comboEyebrow:'ACCAS OF THE DAY', comboTitle:'Accumulators',
    comboLead:'Our tennis accas of the day, with the best book for each leg and the total odds.',
    comboConf:'Confidence', comboTotal:'Total odds', comboLegs:'legs',
    recEyebrow:'FULL TRANSPARENCY', recTitle:'Our record', recLead:'Every pick we publish is logged, win or lose. At 1 unit per bet.',
    stHit:'Hit rate', stRoi:'ROI', stProfit:'Profit', stPicks:'Picks', units:'u',
    colDate:'Date', colMatch:'Match', colPick:'Pick', colOdd:'Odds', colBook:'Book', colResult:'Result',
    resW:'Won', resL:'Lost',
    comboRecTitle:'Settled accas', comboRecLead:'Every acca is logged once it ends. It only wins if ALL legs come in.',
    arbRecTitle:'No-risk history', arbRecLead:'Every no-risk bet we catch is logged with its guaranteed profit (on a 100€ reference stake).',
    arbRecN:'Surebets', arbRecProfit:'Total profit', arbRecAvg:'Avg margin', arbRecMargin:'Margin',
    pendingTitle:'Our selections · live', pendingLead:'Picks already published, awaiting the result. Logged with their pre-match odds.', pendingTag:'LIVE',
    howEyebrow:'HOW IT WORKS', howTitle:'The method',
    how1t:'1 · We collect the odds', how1d:'Every day we read odds from several bookmakers for ATP and WTA matches.',
    how2t:'2 · We compute the true probability', how2d:'We strip the bookmaker margin and average the market to estimate each player\u2019s fair probability.',
    how3t:'3 · We find value and zero risk', how3d:'We flag picks where the best price beats the true probability, and matches where backing both sides guarantees profit.',
    autoTitle:'Fully automatic', autoD:'The site updates itself daily with fresh odds. Nothing to do by hand.',
    footProduct:'Product', footValue:'Value', footArb:'No-risk', footCombos:'Accas', footRecord:'Record',
    footInfo:'Info', footHow:'How it works', footAbout:'About', footContact:'Contact',
    discTitle:'Responsible gambling.', disc:'Informational content, not investment advice. Betting carries risk. 18+. Please play responsibly.',
  }
};

window.DAILY = { meta:{} };
