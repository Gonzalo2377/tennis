#!/usr/bin/env node
/* ============================================================
   MUNDIAL VALUE — daily robot
   ------------------------------------------------------------
   Calls The Odds API once, keeps only FOOTBALL (1X2), maps it to
   the shape the web reads, runs the SAME model as the site, builds
   the day's accumulators, and writes ../daily.json.

   Run:   ODDS_API_KEY=xxxx node fetch-daily.js
   CI:    see ../../.github/workflows/daily-odds.yml

   Node 18+ (built-in fetch). No external dependencies.
   ============================================================ */
'use strict';
const fs = require('fs');
const path = require('path');

/* ---------------- config (env) ---------------- */
const API_KEY = process.env.ODDS_API_KEY;
// World Cup matches live under 'soccer_fifa_world_cup' (only once books list them).
// Out of season, test with any in-season football key, e.g.:
//   soccer_uefa_champs_league · soccer_spain_la_liga · soccer_conmebol_copa_america
//   soccer_china_superleague  · or 'upcoming' to scan everything (we filter football).
// Football competitions to pull. Comma-separated list of The Odds API sport keys.
// You can override from the workflow with the ODDS_SPORT env var.
// Default = the big competitions so finals/derbies always show up.
const SPORT   = process.env.ODDS_SPORT   || [
    'soccer_uefa_champs_league',     // Champions League (incl. la final)
    'soccer_uefa_europa_league',     // Europa League
    'soccer_spain_la_liga',          // LaLiga
    'soccer_epl',                    // Premier League
    'soccer_italy_serie_a',          // Serie A
    'soccer_germany_bundesliga',     // Bundesliga
    'soccer_france_ligue_one',       // Ligue 1
    'soccer_fifa_world_cup',         // Mundial (cuando esté en temporada)
].join(',');
const REGIONS = process.env.ODDS_REGIONS || 'eu';   // eu|uk|us|au (comma-sep). Each region = 1 credit.
const MARKET  = 'h2h';                               // match winner (1X2)
// Optional whitelist of bookmakers (base ids, comma-sep), e.g. "bet365,betfair,winamax,williamhill,pinnacle".
const BOOK_WHITELIST = (process.env.ODDS_BOOKS || '').split(',').map(s => s.trim()).filter(Boolean);
// Only include matches kicking off within this many hours (today + tomorrow).
// Keeps the board focused on imminent fixtures and excludes far-future events
// like the World Cup until it's actually here. Override with ODDS_WINDOW_HOURS.
const WINDOW_HOURS = parseInt(process.env.ODDS_WINDOW_HOURS || '72', 10);
const OUT = path.join(__dirname, '..', 'daily.json');

// running tally of API credits (filled from response headers on every odds/scores call)
const CREDITS = { remaining:null, used:null, lastCall:null };

if (!API_KEY) { console.error('✗ Missing ODDS_API_KEY env var'); process.exit(1); }

/* ---------------- national-team database ----------------
   The Odds API gives team NAMES only → map to id / FIFA rank /
   colour / recent form (form feeds the model). Edit freely;
   unknown teams get a safe fallback (rank 55, neutral colour). */
const TEAMS_DB = [
    { id:'arg', name:'Argentina',      code:'ARG', color:'#6cabdd', conf:'CONMEBOL', fifa:1,  form:'WWWWD', aliases:['argentina'] },
    { id:'esp', name:'España',         code:'ESP', color:'#c8102e', conf:'UEFA',     fifa:2,  form:'WWWDW', aliases:['spain','españa','espana'] },
    { id:'fra', name:'Francia',        code:'FRA', color:'#1f3a93', conf:'UEFA',     fifa:3,  form:'WWDWW', aliases:['france','francia'] },
    { id:'eng', name:'Inglaterra',     code:'ENG', color:'#ffffff', conf:'UEFA',     fifa:4,  form:'WDWWD', aliases:['england','inglaterra'] },
    { id:'bra', name:'Brasil',         code:'BRA', color:'#ffd23f', conf:'CONMEBOL', fifa:5,  form:'WDWLW', aliases:['brazil','brasil'] },
    { id:'por', name:'Portugal',       code:'POR', color:'#0aa05a', conf:'UEFA',     fifa:6,  form:'WWLWW', aliases:['portugal'] },
    { id:'ned', name:'Países Bajos',   code:'NED', color:'#ff8a1e', conf:'UEFA',     fifa:7,  form:'WWDLW', aliases:['netherlands','holland','holanda','países bajos','paises bajos'] },
    { id:'bel', name:'Bélgica',        code:'BEL', color:'#e5484d', conf:'UEFA',     fifa:8,  form:'WLWDW', aliases:['belgium','bélgica','belgica'] },
    { id:'ger', name:'Alemania',       code:'GER', color:'#1a1a1a', conf:'UEFA',     fifa:9,  form:'DWWLW', aliases:['germany','alemania'] },
    { id:'cro', name:'Croacia',        code:'CRO', color:'#c8102e', conf:'UEFA',     fifa:10, form:'DWDWL', aliases:['croatia','croacia'] },
    { id:'uru', name:'Uruguay',        code:'URU', color:'#6cabdd', conf:'CONMEBOL', fifa:11, form:'WDWWL', aliases:['uruguay'] },
    { id:'mar', name:'Marruecos',      code:'MAR', color:'#c8102e', conf:'CAF',      fifa:12, form:'WWDWL', aliases:['morocco','marruecos'] },
    { id:'col', name:'Colombia',       code:'COL', color:'#ffd23f', conf:'CONMEBOL', fifa:13, form:'DWWDW', aliases:['colombia'] },
    { id:'ita', name:'Italia',         code:'ITA', color:'#1f5fd6', conf:'UEFA',     fifa:9,  form:'WWDWL', aliases:['italy','italia'] },
    { id:'mex', name:'México',         code:'MEX', color:'#0a7d3c', conf:'CONCACAF', fifa:14, form:'LWDWL', aliases:['mexico','méxico'] },
    { id:'usa', name:'Estados Unidos', code:'USA', color:'#1f5fd6', conf:'CONCACAF', fifa:16, form:'WLWDL', aliases:['usa','united states','estados unidos'] },
    { id:'jpn', name:'Japón',          code:'JPN', color:'#1f3a93', conf:'AFC',      fifa:17, form:'WWLWD', aliases:['japan','japón','japon'] },
    { id:'sen', name:'Senegal',        code:'SEN', color:'#0aa05a', conf:'CAF',      fifa:18, form:'WDWLW', aliases:['senegal'] },
    { id:'sui', name:'Suiza',          code:'SUI', color:'#e5484d', conf:'UEFA',     fifa:19, form:'DWDLW', aliases:['switzerland','suiza'] },
    { id:'den', name:'Dinamarca',      code:'DEN', color:'#c8102e', conf:'UEFA',     fifa:20, form:'WLDWW', aliases:['denmark','dinamarca'] },
    { id:'aut', name:'Austria',        code:'AUT', color:'#e5484d', conf:'UEFA',     fifa:22, form:'WWDLW', aliases:['austria'] },
    { id:'kor', name:'Corea del Sur',  code:'KOR', color:'#1f5fd6', conf:'AFC',      fifa:23, form:'WDLWD', aliases:['south korea','korea republic','corea del sur'] },
    { id:'ecu', name:'Ecuador',        code:'ECU', color:'#ffd23f', conf:'CONMEBOL', fifa:24, form:'DWDWL', aliases:['ecuador'] },
    { id:'ukr', name:'Ucrania',        code:'UKR', color:'#ffd23f', conf:'UEFA',     fifa:25, form:'WLDWD', aliases:['ukraine','ucrania'] },
    { id:'tur', name:'Turquía',        code:'TUR', color:'#c8102e', conf:'UEFA',     fifa:26, form:'WWLDW', aliases:['turkey','turquia','türkiye','turkiye'] },
    { id:'can', name:'Canadá',         code:'CAN', color:'#c8102e', conf:'CONCACAF', fifa:27, form:'WLWDL', aliases:['canada','canadá'] },
    { id:'pol', name:'Polonia',        code:'POL', color:'#e5484d', conf:'UEFA',     fifa:28, form:'LWDWL', aliases:['poland','polonia'] },
    { id:'wal', name:'Gales',          code:'WAL', color:'#c8102e', conf:'UEFA',     fifa:29, form:'DLWDW', aliases:['wales','gales'] },
    { id:'pan', name:'Panamá',         code:'PAN', color:'#c8102e', conf:'CONCACAF', fifa:30, form:'WDLWL', aliases:['panama','panamá'] },
    { id:'sco', name:'Escocia',        code:'SCO', color:'#1f3a93', conf:'UEFA',     fifa:31, form:'WDWLL', aliases:['scotland','escocia'] },
    { id:'nor', name:'Noruega',        code:'NOR', color:'#c8102e', conf:'UEFA',     fifa:32, form:'WWWDL', aliases:['norway','noruega'] },
    { id:'egy', name:'Egipto',         code:'EGY', color:'#c8102e', conf:'CAF',      fifa:33, form:'WDWLW', aliases:['egypt','egipto'] },
    { id:'nga', name:'Nigeria',        code:'NGA', color:'#0aa05a', conf:'CAF',      fifa:34, form:'DWLWD', aliases:['nigeria'] },
    { id:'aus', name:'Australia',      code:'AUS', color:'#ffd23f', conf:'AFC',      fifa:35, form:'WDWLW', aliases:['australia'] },
    { id:'civ', name:'Costa de Marfil',code:'CIV', color:'#ff8a1e', conf:'CAF',      fifa:40, form:'WWDLW', aliases:['ivory coast','cote d\'ivoire','costa de marfil'] },
    { id:'cri', name:'Costa Rica',     code:'CRC', color:'#c8102e', conf:'CONCACAF', fifa:43, form:'LWDLW', aliases:['costa rica'] },
    { id:'qat', name:'Catar',          code:'QAT', color:'#7d1128', conf:'AFC',      fifa:44, form:'WLDWW', aliases:['qatar','catar'] },
    { id:'sau', name:'Arabia Saudí',   code:'KSA', color:'#0aa05a', conf:'AFC',      fifa:58, form:'LDWLW', aliases:['saudi arabia','arabia saudi','arabia saudí'] },
    { id:'irn', name:'Irán',           code:'IRN', color:'#0aa05a', conf:'AFC',      fifa:20, form:'WDWWL', aliases:['iran','irán','ir iran'] },
];

/* ---------------- club database (Elo ratings) ----------------
   For league football. Elo ≈ clubelo scale (top ≈ 2000+, mid ≈ 1750,
   low ≈ 1550). The model uses `elo` directly instead of a FIFA rank.
   Add/adjust clubs freely; tweak `elo` to retune the value model.
   `aliases` must match the names The Odds API returns. */
function club(id, name, code, color, elo, form, aliases) { return { id, name, code, color, conf:'Club', elo, form, aliases: aliases || [] }; }
const CLUBS_DB = [
    // LaLiga
    club('rmad','Real Madrid','RMA','#e8e8ee',2030,'WWWDW',['real madrid','real madrid cf']),
    club('fcba','Barcelona','BAR','#1f5fd6',1985,'WWDWW',['barcelona','fc barcelona']),
    club('atm','Atlético Madrid','ATM','#c8102e',1945,'WDWWL',['atletico madrid','atlético madrid','atletico de madrid','club atletico de madrid']),
    club('ath','Athletic Club','ATH','#c8102e',1825,'WDWLW',['athletic bilbao','athletic club']),
    club('rso','Real Sociedad','RSO','#1f5fd6',1805,'DWLWD',['real sociedad']),
    club('vil','Villarreal','VIL','#ffd23f',1815,'WWDLW',['villarreal','villarreal cf']),
    club('bet','Real Betis','BET','#0aa05a',1780,'DWDWL',['real betis','betis']),
    club('sev','Sevilla','SEV','#e5484d',1755,'LWDLW',['sevilla','sevilla fc']),
    club('gir','Girona','GIR','#c8102e',1795,'WLWDW',['girona','girona fc']),
    club('vcf','Valencia','VAL','#ff8a1e',1715,'LWDLW',['valencia','valencia cf']),
    // Premier League
    club('mci','Manchester City','MCI','#6cabdd',2055,'WWWDW',['manchester city','man city']),
    club('ars','Arsenal','ARS','#e5484d',2010,'WWDWW',['arsenal']),
    club('liv','Liverpool','LIV','#c8102e',2005,'WDWWW',['liverpool']),
    club('che','Chelsea','CHE','#1f5fd6',1905,'WDWLW',['chelsea']),
    club('tot','Tottenham','TOT','#e8e8ee',1880,'WLWDL',['tottenham','tottenham hotspur','spurs']),
    club('mun','Manchester United','MUN','#e5484d',1865,'LWDWL',['manchester united','man utd','man united']),
    club('avl','Aston Villa','AVL','#7d1128',1875,'WDWLW',['aston villa']),
    club('new','Newcastle','NEW','#1a1a1a',1870,'WWLDW',['newcastle','newcastle united']),
    club('bha','Brighton','BHA','#1f5fd6',1820,'DWLDW',['brighton','brighton and hove albion','brighton & hove albion']),
    club('whu','West Ham','WHU','#7d1128',1775,'LWDLL',['west ham','west ham united']),
    // Serie A
    club('int','Inter','INT','#1f5fd6',1985,'WWDWW',['inter milan','internazionale','inter']),
    club('juv','Juventus','JUV','#1a1a1a',1905,'WDWDL',['juventus']),
    club('mil','AC Milan','MIL','#e5484d',1900,'WDLWW',['ac milan','milan']),
    club('nap','Napoli','NAP','#6cabdd',1910,'WWWDL',['napoli']),
    club('ata','Atalanta','ATA','#1f3a93',1925,'WWDWW',['atalanta','atalanta bc']),
    club('rom','Roma','ROM','#7d1128',1850,'DWLWD',['as roma','roma']),
    club('laz','Lazio','LAZ','#6cabdd',1830,'WDLDW',['lazio','ss lazio']),
    club('fio','Fiorentina','FIO','#b07bff',1810,'LWDWL',['fiorentina','acf fiorentina']),
    // Bundesliga
    club('bay','Bayern Múnich','BAY','#e5484d',2010,'WWWDW',['bayern munich','bayern münchen','fc bayern munich','bayern munchen']),
    club('lev','Bayer Leverkusen','LEV','#e5484d',1975,'WWDWW',['bayer leverkusen','leverkusen']),
    club('bvb','Borussia Dortmund','BVB','#ffd23f',1905,'WDLWW',['borussia dortmund','dortmund']),
    club('rbl','RB Leipzig','RBL','#e5484d',1900,'WLWDW',['rb leipzig','leipzig']),
    club('stu','Stuttgart','STU','#e8e8ee',1835,'WWDLW',['vfb stuttgart','stuttgart']),
    club('ein','Eintracht Frankfurt','SGE','#1a1a1a',1825,'DWLWD',['eintracht frankfurt','frankfurt']),
    // Ligue 1
    club('psg','PSG','PSG','#1f3a93',1985,'WWWDW',['paris saint germain','psg','paris saint-germain']),
    club('mon','Monaco','MON','#e5484d',1855,'WDWLW',['monaco','as monaco']),
    club('mar','Marseille','OM','#6cabdd',1825,'WLDWW',['marseille','olympique marseille']),
    club('lil','Lille','LIL','#e5484d',1820,'DWWLD',['lille','losc lille']),
    club('lyo','Lyon','LYO','#1f5fd6',1785,'LWDWL',['lyon','olympique lyonnais']),
    club('nic','Nice','NIC','#e5484d',1800,'WDLDW',['nice','ogc nice']),
    // Portugal / Netherlands / others (CL/EL regulars)
    club('ben','Benfica','BEN','#e5484d',1875,'WWDWW',['benfica','sl benfica']),
    club('por','Porto','POR','#1f5fd6',1855,'WDWWL',['porto','fc porto']),
    club('spo','Sporting CP','SCP','#0aa05a',1880,'WWWDL',['sporting cp','sporting lisbon','sporting']),
    club('psv','PSV','PSV','#e5484d',1825,'WWDWW',['psv','psv eindhoven']),
    club('fey','Feyenoord','FEY','#e5484d',1820,'WDWLW',['feyenoord']),
    club('aja','Ajax','AJA','#e5484d',1785,'LWDWL',['ajax']),
    club('gal','Galatasaray','GAL','#e5a000',1820,'WWWDW',['galatasaray']),
    club('fnb','Fenerbahce','FEN','#1f3a93',1820,'WWDWL',['fenerbahce','fenerbahçe']),
    club('cel','Celtic','CEL','#0aa05a',1785,'WWDWW',['celtic']),
    // Brasil — Série A (ratings aproximados)
    club('pal','Palmeiras','PAL','#0aa05a',1870,'WWDWW',['palmeiras','se palmeiras']),
    club('fla','Flamengo','FLA','#e5484d',1875,'WWWDW',['flamengo','cr flamengo']),
    club('bot','Botafogo','BOT','#1a1a1a',1840,'WDWWL',['botafogo']),
    club('fluf','Fluminense','FLU','#0a7d3c',1790,'DWLWD',['fluminense']),
    club('cor','Corinthians','COR','#1a1a1a',1795,'WDLWW',['corinthians']),
    club('spa','São Paulo','SAO','#e5484d',1810,'WWDLW',['sao paulo','são paulo','sao paulo fc']),
    club('intbr','Internacional','INT-BR','#e5484d',1805,'WDWWL',['internacional','sc internacional']),
    club('grem','Grêmio','GRE','#1f5fd6',1785,'LWDWL',['gremio','grêmio']),
    club('atmg','Atlético Mineiro','CAM','#1a1a1a',1820,'WWLWD',['atletico mineiro','atlético mineiro','atletico-mg']),
    club('cru','Cruzeiro','CRU','#1f5fd6',1795,'WDWLW',['cruzeiro']),
    club('bah','Bahia','BAH','#1f5fd6',1770,'DWLDW',['bahia','ec bahia']),
    club('vasco','Vasco da Gama','VAS','#1a1a1a',1745,'LWDLW',['vasco da gama','vasco']),
    club('forta','Fortaleza','FOR','#1f5fd6',1775,'WLWDW',['fortaleza','fortaleza ec']),
    // Argentina (Libertadores / liga)
    club('riv','River Plate','RIV','#e5484d',1880,'WWDWW',['river plate','ca river plate']),
    club('boca','Boca Juniors','BOC','#1f3a93',1850,'WDWWL',['boca juniors','ca boca juniors']),
    club('raci','Racing Club','RAC','#6cabdd',1800,'WDLWW',['racing club','racing']),
];
const BOOK_COLORS = {
    bet365:'#0a7d3c', bwin:'#1a1a1a', williamhill:'#1f5fd6', betfair:'#ffb01f', winamax:'#e5484d',
    codere:'#0aa05a', pinnacle:'#3a4660', sport888:'#ff8a1e', unibet:'#0aa05a', marathonbet:'#1f5fd6',
    betclic:'#e5484d', nordicbet:'#1f3a93', betsson:'#ff8a1e', leovegas:'#e5a000', tipico:'#c8102e',
    onexbet:'#1f5fd6', coolbet:'#0aa05a', betonlineag:'#1a1a1a',
};

const norm = (s) => (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim();
const aliasMap = {};
[...TEAMS_DB, ...CLUBS_DB].forEach(t => { aliasMap[norm(t.name)] = t; (t.aliases||[]).forEach(a => aliasMap[norm(a)] = t); });

function resolveTeam(name, sink) {
    const hit = aliasMap[norm(name)];
    if (hit) { sink[hit.id] = { id:hit.id, name:hit.name, code:hit.code, color:hit.color, conf:hit.conf, fifa:hit.fifa, elo:hit.elo, form:hit.form, known:true }; return hit.id; }
    const id = norm(name).replace(/[^a-z0-9]/g,'').slice(0,6) || ('t' + Object.keys(sink).length);
    sink[id] = { id, name, code: name.replace(/[^A-Za-z]/g,'').slice(0,3).toUpperCase() || 'TBD', color:'#5a6b8c', conf:'—', fifa:55, form:'', known:false };
    return id;
}

/* normalise regional bookmaker keys to a single brand id (best price kept) */
const REGION = /(_ex)?(_(eu|uk|us|au|fr|de|se|nl|it|es|dk|no|fi|ie|pt|be|ca))+$/;
function baseBook(key){ return (key||'').toLowerCase().replace(REGION,'').replace(/[^a-z0-9]/g,'') || key; }
function bookName(title){ return (title||'').replace(/\s*\(.*\)\s*$/,'').trim(); }
function bookAbbr(name){ return (name||'').replace(/[^A-Za-z0-9]/g,'').slice(0,4).toUpperCase(); }

/* ---------------- the model (ported 1:1 from model.js) -------- */
function ratingFromRank(rank){ return 1500 + 560 * Math.exp(-0.035 * (rank - 1)); }
function baseRating(team){ if(!team) return ratingFromRank(55); if(team.elo!=null) return team.elo; return ratingFromRank(team.fifa!=null?team.fifa:55); }
function formScore(form){ if(!form) return 0; const p={W:3,D:1,L:0}; let s=0,n=0; for(const c of form){ if(p[c]!=null){s+=p[c];n++;} } return n ? ((s/n)-1.5)*28 : 0; }
const _f=[1]; function factorial(n){ if(_f[n]!=null)return _f[n]; let r=_f[_f.length-1]; for(let i=_f.length;i<=n;i++){r*=i;_f[i]=r;} return _f[n]; }
function poisson(k,l){ return Math.exp(-l)*Math.pow(l,k)/factorial(k); }
function dcTau(i,j,lh,la,rho){ if(i===0&&j===0)return 1-lh*la*rho; if(i===0&&j===1)return 1+lh*rho; if(i===1&&j===0)return 1+la*rho; if(i===1&&j===1)return 1-rho; return 1; }
function computeModel(homeId, awayId, teams, opts){
    opts=opts||{}; const H=teams[homeId], A=teams[awayId];
    if(!H||!A) return { home:1/3, draw:1/3, away:1/3 };
    const rH=baseRating(H)+formScore(H.form);
    const rA=baseRating(A)+formScore(A.form);
    const homeAdv = opts.neutral===false ? 65 : 16;
    const sup=(rH-rA+homeAdv)/120;
    const avg=(rH+rA)/2;
    let totals=Math.max(2.1,Math.min(3.1, 2.7-(avg-1850)/650));
    const lh=Math.max(0.18,(totals+sup)/2), la=Math.max(0.18,(totals-sup)/2);
    const rho=-0.08, MAX=10; let pH=0,pD=0,pA=0;
    for(let i=0;i<=MAX;i++){ const pi=poisson(i,lh); for(let j=0;j<=MAX;j++){ const p=pi*poisson(j,la)*dcTau(i,j,lh,la,rho); if(i>j)pH+=p; else if(i===j)pD+=p; else pA+=p; } }
    const s=pH+pD+pA||1;
    return { home:pH/s, draw:pD/s, away:pA/s, lambdaH:lh, lambdaA:la, ratingH:rH, ratingA:rA, sup };
}

/* ---------------- value helpers ------------------------------ */
function bestPrice(map){ let best=null; for(const b in map) if(!best||map[b]>best.price) best={book:b,price:map[b]}; return best; }
/* median price across books (to detect a single stale/erroneous outlier) */
function medianPrice(map){ const v=Object.values(map).sort((a,b)=>a-b); const n=v.length; return n ? (n%2 ? v[(n-1)/2] : (v[n/2-1]+v[n/2])/2) : 0; }
/* best price IGNORING an absurd outlier (> 1.5× the median = likely stale/in-play) */
function saneBest(map){ const med=medianPrice(map); let best=null; for(const b in map){ const p=map[b]; if(med && p>med*1.5) continue; if(!best||p>best.price) best={book:b,price:p}; } return best || bestPrice(map); }
function marketProbs(m){ const avg=o=>{const v=Object.values(o);return v.reduce((s,x)=>s+1/x,0)/v.length;}; const h=avg(m.odds.home),d=avg(m.odds.draw),a=avg(m.odds.away),s=h+d+a; return {home:h/s,draw:d/s,away:a/s}; }
function matchValue(m){ const mk=marketProbs(m); const fromMarket=m.model&&m.model.fromMarket; const MIN_P=0.33, MAX_ODD=3.40; const all=['home','draw','away'].map(k=>{ const best=saneBest(m.odds[k]); const p=fromMarket?mk[k]:m.model[k]; const ev=(mk[k]*best.price-1)*100; const edge=fromMarket?ev:(m.model[k]-mk[k])*100; const eligible=p>=MIN_P && best.price<=MAX_ODD; return {k,modelP:m.model[k],mktP:mk[k],best,edge,ev,p,eligible}; }); const eligibles=all.filter(o=>o.eligible).sort((a,b)=>b.edge-a.edge); const pick=eligibles.length?eligibles[0]:[...all].sort((a,b)=>b.p-a.p)[0]; const positive=pick.eligible&&pick.edge>=2; return {pick,edge:pick.edge,positive,source:fromMarket?'market':'model'}; }

/* ---------------- API ---------------------------------------- */
// Priority ranking of competitions by visibility/popularity. In AUTO mode we keep
// the active soccer leagues that rank highest here (up to ODDS_MAX). Edit the order
// to taste. Anything not listed still counts, but after every ranked league.
const SPORT_PRIORITY = [
    // European club elite
    'soccer_uefa_champs_league', 'soccer_uefa_europa_league', 'soccer_uefa_europa_conference_league',
    // Big-5 domestic leagues
    'soccer_epl', 'soccer_spain_la_liga', 'soccer_italy_serie_a', 'soccer_germany_bundesliga', 'soccer_france_ligue_one',
    // National teams
    'soccer_fifa_world_cup', 'soccer_uefa_nations_league', 'soccer_uefa_european_championship',
    'soccer_conmebol_copa_america', 'soccer_fifa_world_cup_qualifiers_europe',
    // South America clubs
    'soccer_conmebol_copa_libertadores', 'soccer_conmebol_copa_sudamericana',
    'soccer_brazil_campeonato', 'soccer_argentina_primera_division',
    // Other popular domestic leagues
    'soccer_netherlands_eredivisie', 'soccer_portugal_primeira_liga', 'soccer_usa_mls',
    'soccer_mexico_ligamx', 'soccer_turkey_super_league', 'soccer_england_efl_champ',
    'soccer_spain_segunda_division', 'soccer_italy_serie_b', 'soccer_germany_bundesliga2',
    'soccer_france_ligue_two', 'soccer_brazil_serie_b', 'soccer_belgium_first_div',
    'soccer_japan_j_league', 'soccer_australia_aleague', 'soccer_sweden_allsvenskan',
    'soccer_norway_eliteserien', 'soccer_denmark_superliga', 'soccer_switzerland_superleague',
    'soccer_austria_bundesliga', 'soccer_greece_super_league', 'soccer_poland_ekstraklasa',
];

// Pull one sport key. A 422/404 (competition out of season) is not fatal:
// we just skip it and keep the others.
async function fetchOne(sportKey){
    const url = `https://api.the-odds-api.com/v4/sports/${sportKey}/odds/?apiKey=${API_KEY}&regions=${REGIONS}&markets=${MARKET}&oddsFormat=decimal`;
    const res = await fetch(url);
    if (res.status === 422 || res.status === 404) { console.log(`  - ${sportKey}: sin eventos (fuera de temporada)`); return []; }
    if (!res.ok) { console.log(`  - ${sportKey}: API ${res.status} (omitido)`); return []; }
    const rem = res.headers.get('x-requests-remaining'), used = res.headers.get('x-requests-used');
    if (rem != null)  CREDITS.remaining = +rem;
    if (used != null) CREDITS.used = +used;
    CREDITS.lastCall = sportKey;
    console.log(`  - ${sportKey}: ok · creditos restantes ${rem} · usados ${used}`);
    return res.json();
}
async function fetchOdds(){
    let keys = SPORT.split(',').map(s => s.trim()).filter(Boolean);

    // AUTO mode: discover which soccer leagues are in season right now and keep the
    // most relevant ones by SPORT_PRIORITY (not just the first ones the API returns).
    // The /sports list is FREE (0 credits); odds are pulled only for the chosen leagues.
    if (keys.length === 1 && keys[0].toLowerCase() === 'auto') {
        try {
            const res = await fetch(`https://api.the-odds-api.com/v4/sports/?apiKey=${API_KEY}`);
            const list = res.ok ? await res.json() : [];
            const MAX = parseInt(process.env.ODDS_MAX || '12', 10);
            const active = list
                .filter(s => s.active && !s.has_outrights && /^soccer_/.test(s.key))
                .map(s => s.key);
            const rank = (k) => { const i = SPORT_PRIORITY.indexOf(k); return i === -1 ? 999 : i; };
            keys = active.sort((a, b) => rank(a) - rank(b) || a.localeCompare(b)).slice(0, MAX);
            console.log(`· AUTO: ${active.length} ligas activas → elijo top ${keys.length} por relevancia:\n  ${keys.join(', ')}`);
        } catch (e) {
            console.log('· AUTO falló, uso lista por defecto:', e.message);
            keys = ['soccer_uefa_champs_league','soccer_uefa_europa_league'];
        }
    }

    let all = [];
    for (const k of keys) {
        try { const part = await fetchOne(k); if (Array.isArray(part)) all = all.concat(part); }
        catch (e) { console.log(`  - ${k}: error ${e.message} (omitido)`); }
    }
    return all;
}
const fmtGroup = (iso)=> new Date(iso).toLocaleDateString('es-ES',{weekday:'short',day:'2-digit',month:'short',timeZone:'Europe/Madrid'});
const fmtTime  = (iso)=> new Date(iso).toLocaleTimeString('es-ES',{hour:'2-digit',minute:'2-digit',timeZone:'Europe/Madrid'});
const fmtDay   = (iso)=> new Date(iso||Date.now()).toLocaleDateString('es-ES',{day:'2-digit',month:'short',timeZone:'Europe/Madrid'}).toUpperCase();

/* ---------------- SCORES (auto-settlement) -------------------
   The Odds API /scores returns finished games with their score, so
   the robot can mark each tracked pick as WON/LOST by itself. */
async function fetchScoresOne(sportKey){
    const url = `https://api.the-odds-api.com/v4/sports/${sportKey}/scores/?apiKey=${API_KEY}&daysFrom=3`;
    const res = await fetch(url);
    if (!res.ok) { console.log(`  scores ${sportKey}: API ${res.status} (omitido)`); return []; }
    const rem = res.headers.get('x-requests-remaining'), used = res.headers.get('x-requests-used');
    if (rem != null)  CREDITS.remaining = +rem;
    if (used != null) CREDITS.used = +used;
    return res.json();
}
async function fetchScores(keys){
    let all = [];
    for (const k of keys) { try { const p = await fetchScoresOne(k); if (Array.isArray(p)) all = all.concat(p); } catch(e){} }
    return all;
}
/* winner from a finished score event → 'home' | 'draw' | 'away' | null */
function winnerOf(ev){
    if (!ev || !ev.completed || !Array.isArray(ev.scores)) return null;
    const h = ev.scores.find(s => s.name === ev.home_team);
    const a = ev.scores.find(s => s.name === ev.away_team);
    if (!h || !a) return null;
    const hs = +h.score, as = +a.score;
    if (Number.isNaN(hs) || Number.isNaN(as)) return null;
    return hs > as ? 'home' : (hs < as ? 'away' : 'draw');
}
/* settle PENDING picks against finished scores → append results to RECORD */
function settle(pending, scores, RECORD){
    const byId = {}; scores.forEach(s => { if (s && s.id) byId[s.id] = s; });
    const stillPending = [];
    let settled = 0;
    for (const p of pending) {
        const ev = byId[p.id];
        const w = winnerOf(ev);
        if (!w) { stillPending.push(p); continue; }    // not finished yet → keep waiting
        const result = (w === p.pickKey) ? 'W' : 'L';
        RECORD.unshift({ id: p.id, date: p.date, pick: p.pickLabel, match: p.match, odd: p.odd, book: p.book, stake: 1, result });
        settled++;
    }
    if (settled) console.log(`· liquidados ${settled} picks (resultado real)`);
    return { stillPending, RECORD };
}

/* settle pending COMBOS: a combo wins only if ALL its legs win. Once every leg
   has a final score, move it from COMBO_PENDING to COMBO_RECORD (W/L). */
function settleCombos(pending, scores, RECORD){
    const byId = {}; scores.forEach(s => { if (s && s.id) byId[s.id] = s; });
    const still = [];
    let settled = 0;
    for (const c of pending) {
        const results = c.legs.map(l => winnerOf(byId[l.id]));   // null until that match is final
        if (results.some(r => !r)) { still.push(c); continue; }  // at least one leg unfinished
        const won = c.legs.every((l,i) => results[i] === l.side);
        const totalOdd = +c.legs.reduce((p,l)=>p*l.odd,1).toFixed(2);
        RECORD.unshift({ dayId:c.dayId, date:c.date, name:c.name, tier:c.tier, legs:c.legs.map(l=>({ match:l.match, pick:l.pick, odd:l.odd, win:(null) })).map((o,i)=>({ ...o, win: results[i]===c.legs[i].side })), totalOdd, result: won ? 'W' : 'L' });
        settled++;
    }
    if (settled) console.log(`· liquidadas ${settled} combinadas (resultado real)`);
    return { still, RECORD };
}

/* ---------------- build daily.json --------------------------- */
const fetchFriendlies = require('./friendlies.js');
async function main(){
    const events = await fetchOdds();
    console.log(`· ${events.length} events returned`);

    // extra source: international friendlies via API-Football (national-team friendlies
    // that The Odds API doesn't carry). Set APIFOOTBALL_KEY to enable.
    if (process.env.APIFOOTBALL_KEY) {
        try {
            const fr = await fetchFriendlies(process.env.APIFOOTBALL_KEY, WINDOW_HOURS);
            if (fr.length) events.push(...fr);
        } catch(e){ console.log('· amistosos no disponibles:', e.message); }
    }

    const TEAMS = {}, BOOKS = {}, MATCHES = [];

    for (const ev of events) {
        if (!/^soccer/.test(ev.sport_key || '')) continue;   // FOOTBALL only
        // time window: only PRE-MATCH fixtures within the next WINDOW_HOURS.
        // Skipping already-started games avoids stale/in-play odds being read as value.
        const ko = new Date(ev.commence_time).getTime();
        if (Number.isNaN(ko)) continue;
        if (ko <= Date.now() + 5*60*1000) continue;                  // ya empezado o a punto (≤5 min) → fuera
        if (ko > Date.now() + WINDOW_HOURS*3600*1000) continue;       // too far away (e.g. World Cup)

        const homeId = resolveTeam(ev.home_team, TEAMS);
        const awayId = resolveTeam(ev.away_team, TEAMS);
        const odds = { home:{}, draw:{}, away:{} };

        for (const bk of (ev.bookmakers || [])) {
            const id = baseBook(bk.key);
            if (BOOK_WHITELIST.length && !BOOK_WHITELIST.includes(id)) continue;
            const mkt = (bk.markets || []).find(x => x.key === 'h2h');
            if (!mkt) continue;
            BOOKS[id] = BOOKS[id] || { name: bookName(bk.title) || id, abbr: bookAbbr(bookName(bk.title)) || id.slice(0,4).toUpperCase(), color: BOOK_COLORS[id] || '#5a6b8c', url:'#' };
            for (const o of mkt.outcomes) {
                let slot = null;
                if (o.name === ev.home_team) slot = 'home';
                else if (o.name === ev.away_team) slot = 'away';
                else if (/draw|empate|tie|x/i.test(o.name)) slot = 'draw';
                if (!slot) continue;
                // keep the BEST (highest) price across a brand's regional variants
                if (!odds[slot][id] || o.price > odds[slot][id]) odds[slot][id] = o.price;
            }
        }
        if (!Object.keys(odds.home).length || !Object.keys(odds.draw).length || !Object.keys(odds.away).length) continue;

        MATCHES.push({ id: ev.id || `${homeId}-${awayId}`, group: fmtGroup(ev.commence_time), time: fmtTime(ev.commence_time), home: homeId, away: awayId, odds, _commence: ev.commence_time, _sport: ev.sport_key });
        if (ev._logos) { if (ev._logos.home && TEAMS[homeId]) TEAMS[homeId].logo = ev._logos.home; if (ev._logos.away && TEAMS[awayId]) TEAMS[awayId].logo = ev._logos.away; }
    }

    // Attach probabilities:
    //  · both teams known (FIFA rank) → full value model (can surface value)
    //  · otherwise (e.g. clubs we don't rate) → use de-vigged market so we NEVER
    //    fabricate value; the match still shows with the full odds comparison.
    MATCHES.forEach(m => {
        const bothKnown = TEAMS[m.home].known && TEAMS[m.away].known;
        m.model = bothKnown
            ? computeModel(m.home, m.away, TEAMS, { neutral:true })
            : Object.assign(marketProbs(m), { fromMarket:true });
    });
    const valued = MATCHES.map(m => ({ m, v: matchValue(m) })).filter(x => x.v.positive).sort((a,b)=>b.v.pick.modelP - a.v.pick.modelP);

    // ---- auto-build the day's accumulators ----
    const label = (m,k) => k==='draw' ? 'Empate' : (k==='home' ? `Gana ${TEAMS[m.home].name}` : `Gana ${TEAMS[m.away].name}`);
    const legOf = (x) => ({ id:x.m.id, sport:x.m._sport, ts:new Date(x.m._commence).getTime(), side:x.v.pick.k, match:`${TEAMS[x.m.home].name} – ${TEAMS[x.m.away].name}`, pick:label(x.m,x.v.pick.k), odd:+x.v.pick.best.price.toFixed(2), book:x.v.pick.best.book });
    const confOf = (arr) => Math.round(arr.reduce((p,x)=>p*x.v.pick.modelP,1)*100);
    const COMBOS = [];
    // Safe pool: each match's most-likely pick (favourite), credible odds. Used as
    // fallback so there is ALWAYS a combo, even on days with little/no "value".
    const safePool = MATCHES.map(m => ({ m, v: matchValue(m) }))
        .filter(x => x.v.pick && x.v.pick.best && x.v.pick.best.price >= 1.20 && x.v.pick.best.price <= 3.60 && x.v.pick.modelP >= 0.38)
        .sort((a,b)=> b.v.pick.modelP - a.v.pick.modelP);
    const seen = (arr) => { const s=new Set(); return arr.filter(x=>{ if(s.has(x.m.id)) return false; s.add(x.m.id); return true; }); };
    const merge = (...pools) => seen([].concat(...pools));
    const byEdge = [...valued].sort((a,b)=>b.v.edge-a.v.edge);

    // FIREWALL #1 — never publish two combos with the same set of picks.
    // Signature = the legs' "match|pick" sorted, so order doesn't matter.
    const comboSig = (legs) => legs.map(l => `${l.match}|${l.pick}`).sort().join(' + ');
    const usedSigs = new Set();
    function pushCombo(meta, pool, n){
        // try a few starting offsets so a thin day can still yield DISTINCT combos
        for (let off = 0; off + n <= pool.length && off <= 3; off++){
            const legs = pool.slice(off, off+n).map(legOf);
            if (legs.length < n) break;
            const sig = comboSig(legs);
            if (usedSigs.has(sig)) continue;          // identical to one already added → skip
            usedSigs.add(sig);
            COMBOS.push({ ...meta, conf: confOf(pool.slice(off, off+n)), legs });
            return true;
        }
        return false;
    }

    // c1 — Combinada del Día (taster + 3,99€): the MOST LIKELY one (value first, fill with favourites)
    pushCombo({ id:'c1', tier:'single', name:'Combinada del Día' }, merge(valued, safePool), 3);
    // c2 — Combinada Valor (14,99€): value by edge, fallback to safe — only if DISTINCT from c1
    pushCombo({ id:'c2', tier:'all', name: valued.length>=2 ? 'Combinada Valor' : 'Combinada Segura' }, merge(byEdge, safePool), 3);
    // c3 — Combinada Larga (14,99€): 4 legs when possible — only if DISTINCT
    pushCombo({ id:'c3', tier:'all', name:'Combinada Larga' }, merge(byEdge, safePool), 4);

    // ---- track record: read previous state, settle finished picks + combos ----
    let RECORD = [], PENDING = [], COMBO_PENDING = [], COMBO_RECORD = [];
    try { const prev = JSON.parse(fs.readFileSync(OUT,'utf8')); RECORD = prev.RECORD || []; PENDING = prev.PENDING || []; COMBO_PENDING = prev.COMBO_PENDING || []; COMBO_RECORD = prev.COMBO_RECORD || []; } catch (e) {}

    // MIGRATION: older versions accidentally mixed combo-shaped entries into RECORD.
    // Move anything with `legs` (a combo) out of RECORD into COMBO_RECORD, and keep
    // only clean single picks in RECORD. Self-heals the ledger on the next run.
    {
        const strayCombos = RECORD.filter(x => x && x.legs);
        if (strayCombos.length) COMBO_RECORD = [...strayCombos, ...COMBO_RECORD];
        RECORD = RECORD.filter(x => x && !x.legs && x.result);
    }

    // FIREWALL #2 — kill duplicates that share the SAME pick + date (singles) or the
    // SAME set of legs + date (combos). Keeps the first occurrence, drops the rest.
    const dedupBy = (arr, keyFn) => { const s = new Set(); return arr.filter(o => { const k = keyFn(o); if (s.has(k)) return false; s.add(k); return true; }); };
    const singleSig = (r) => `${r.date||''}|${r.match||''}|${r.pick||r.pickLabel||''}`;
    const comboKey  = (c) => `${c.date||''}|${(c.legs||[]).map(l=>`${l.match}|${l.pick}`).sort().join(' + ')}`;
    RECORD        = dedupBy(RECORD, singleSig);
    PENDING       = dedupBy(PENDING, singleSig);
    COMBO_RECORD  = dedupBy(COMBO_RECORD, comboKey);
    COMBO_PENDING = dedupBy(COMBO_PENDING, comboKey);
    try {
        // query scores for any competition with a pending single pick OR combo leg (saves credits)
        const need = [...new Set([
            ...PENDING.map(p => p.sport),
            ...COMBO_PENDING.flatMap(c => c.legs.map(l => l.sport)),
        ].filter(Boolean))];
        if (need.length) {
            const scores = await fetchScores(need);
            const out = settle(PENDING, scores, RECORD);
            PENDING = out.stillPending; RECORD = out.RECORD;
            const cout = settleCombos(COMBO_PENDING, scores, COMBO_RECORD);
            COMBO_PENDING = cout.still; COMBO_RECORD = cout.RECORD;
        }
    } catch (e) { console.log('· scores no disponibles:', e.message); }

    // ---- snapshot TODAY's combos so we can settle them later (once per day per combo) ----
    const today = fmtDay(new Date().toISOString());
    const haveCombo = new Set(COMBO_PENDING.map(c=>c.dayId).concat(COMBO_RECORD.map(c=>c.dayId)));
    const haveComboSig = new Set([...COMBO_PENDING, ...COMBO_RECORD].map(comboKey));
    COMBOS.forEach(c => {
        const dayId = today + '·' + c.id;
        // only snapshot combos whose legs are all near-term (real, settle-able) matches
        const settleable = c.legs.every(l => l.id && l.sport);
        const snap = { dayId, date: today, name: c.name, tier: c.tier, legs: c.legs.map(l=>({ id:l.id, sport:l.sport, side:l.side, match:l.match, pick:l.pick, odd:l.odd })) };
        // skip if same id OR same set of legs+date already tracked (FIREWALL #3)
        if (!settleable || haveCombo.has(dayId) || haveComboSig.has(comboKey(snap))) return;
        COMBO_PENDING.push(snap);
        haveCombo.add(dayId); haveComboSig.add(comboKey(snap));
    });

    // ---- register today's headline value picks as PENDING (to settle later) ----
    // Track up to the top 3 value picks of the day; never duplicate by event id OR pick+date.
    const haveId = new Set([...PENDING.map(p=>p.id), ...RECORD.map(r=>r.id).filter(Boolean)]);
    const havePickSig = new Set([...PENDING, ...RECORD].map(singleSig));
    valued.slice(0,3).forEach(x => {
        const entry = {
            id: x.m.id,
            sport: x.m._sport,
            ts: new Date(x.m._commence).getTime(),
            date: fmtDay(x.m._commence),
            match: `${TEAMS[x.m.home].name} – ${TEAMS[x.m.away].name}`,
            pickKey: x.v.pick.k,
            pickLabel: label(x.m, x.v.pick.k),
            odd: +x.v.pick.best.price.toFixed(2),
            book: x.v.pick.best.book,
        };
        const sig = singleSig({ date: entry.date, match: entry.match, pickLabel: entry.pickLabel });
        if (haveId.has(x.m.id) || havePickSig.has(sig)) return;   // FIREWALL: no dup by id or pick+date
        PENDING.push(entry);
        haveId.add(x.m.id); havePickSig.add(sig);
    });
    // Clean the pending list:
    //  · drop legacy entries with no timestamp (old junk),
    //  · drop picks registered too far in the future (odds not final yet — e.g. World Cup weeks away),
    //  · drop stale picks >4 days past kickoff that never settled.
    const EXPIRY = 4*24*3600*1000;
    const AHEAD  = WINDOW_HOURS*3600*1000 + 6*3600*1000;
    PENDING = PENDING.filter(p => p.ts && (p.ts - Date.now()) < AHEAD && (Date.now() - p.ts) < EXPIRY);
    RECORD = RECORD.slice(0, 60);   // keep the ledger tidy
    // same housekeeping for combos: drop ones whose last leg is >5 days past and never settled
    const COMBO_EXPIRY = 5*24*3600*1000;
    COMBO_PENDING = COMBO_PENDING.filter(c => c.legs.some(l => l.ts && (Date.now() - l.ts) < COMBO_EXPIRY) || c.legs.every(l => !l.ts));
    COMBO_RECORD = COMBO_RECORD.slice(0, 40);
    // strip internal fields from matches before writing
    MATCHES.forEach(m => { delete m._commence; delete m._sport; });

    // SAFETY NET: if this run found NO upcoming matches (dead season — e.g. early June
    // before the World Cup), do NOT blank the board. Reuse the previous day's matches,
    // books, teams and combos so the site always shows something. We still update the
    // record/pending (those were settled above).
    let keepTeams = TEAMS, keepBooks = BOOKS, keepMatches = MATCHES, keepCombos = COMBOS;
    let stale = false;
    if (!MATCHES.length) {
        try {
            const prev = JSON.parse(fs.readFileSync(OUT, 'utf8'));
            if (prev.MATCHES && prev.MATCHES.length) {
                keepTeams = prev.TEAMS || TEAMS; keepBooks = prev.BOOKS || BOOKS;
                keepMatches = prev.MATCHES; keepCombos = prev.COMBOS || [];
                stale = true;
                console.log(`  ⚠ sin partidos nuevos → conservo ${keepMatches.length} del día anterior (no vacío el tablero)`);
            }
        } catch (e) {}
    }

    const daily = {
        meta: {
            updatedAt:new Date().toISOString(), source:'the-odds-api', sport:SPORT, regions:REGIONS, market:MARKET,
            matches:keepMatches.length, valuePicks:valued.length, books:Object.keys(keepBooks).length,
            stale, credits: { remaining: CREDITS.remaining, used: CREDITS.used },
        },
        TEAMS:keepTeams, BOOKS:keepBooks, MATCHES:keepMatches, COMBOS:keepCombos, RECORD, PENDING, COMBO_PENDING, COMBO_RECORD,
    };
    fs.writeFileSync(OUT, JSON.stringify(daily, null, 2));
    console.log(`✓ wrote ${OUT}\n  ${MATCHES.length} football matches · ${valued.length} value picks · ${Object.keys(BOOKS).length} books · ${COMBOS.length} accas · ${RECORD.length} en récord · ${PENDING.length} pendientes · ${COMBO_RECORD.length} combis resueltas · ${COMBO_PENDING.length} combis en juego`);
    console.log(`  créditos API → usados ${CREDITS.used} · restantes ${CREDITS.remaining}`);
    if (!MATCHES.length) console.log('  (no football matches for this sport key right now — see SETUP to test with an in-season league)');
}

main().catch(e => { console.error('✗', e.message); process.exit(1); });
