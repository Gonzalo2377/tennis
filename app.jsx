/* ============================================================
   MUNDIAL VALUE — app router + mount
   ============================================================ */

function parseHash() {
    const h = (window.location.hash || '').replace(/^#\/?/, '');
    if (!h) return { view:'home' };
    const parts = h.split('/');
    return { view: parts[0] || 'home', id: parts[1] };
}

/* Catches any render error in a page so a single bad match never blanks the
   whole site — shows a friendly notice + a way back instead of a black screen. */
class ErrorBoundary extends React.Component {
    constructor(p){ super(p); this.state = { err:null }; }
    static getDerivedStateFromError(err){ return { err }; }
    componentDidUpdate(prev){ if (prev.routeKey !== this.props.routeKey && this.state.err) this.setState({ err:null }); }
    render(){
        if (this.state.err) {
            return (
                <div style={{ maxWidth:560, margin:'80px auto', padding:'0 22px', textAlign:'center' }}>
                    <div style={{ fontFamily:'var(--font-head)', fontWeight:800, fontSize:'1.4rem', marginBottom:8 }}>Vaya, ese partido no se pudo mostrar</div>
                    <p style={{ color:'var(--text-2)', lineHeight:1.6, marginBottom:20 }}>Faltan datos para analizarlo. Prueba con otro o vuelve al inicio.</p>
                    <a href="#/value" onClick={()=>this.setState({ err:null })} style={{ display:'inline-block', background:'var(--lime)', color:'#0b0e17', fontFamily:'var(--font-head)', fontWeight:800, textDecoration:'none', padding:'12px 22px', borderRadius:11 }}>← Ver todas las cuotas</a>
                </div>
            );
        }
        return this.props.children;
    }
}

function App() {
    const [lang, setLangState] = useState(() => localStorage.getItem('mv_lang') || 'es');
    const [route, setRoute] = useState(() => parseHash());
    const t = window.I18N[lang];

    function setLang(l){ setLangState(l); localStorage.setItem('mv_lang', l); }
    function go(r){
        setRoute(r);
        const h = '#/' + r.view + (r.id ? '/' + r.id : '');
        if (window.location.hash !== h) window.history.pushState(null,'',h);
        window.scrollTo({ top:0, behavior:'smooth' });
    }
    useEffect(() => {
        const onPop = () => setRoute(parseHash());
        window.addEventListener('popstate', onPop);
        return () => window.removeEventListener('popstate', onPop);
    }, []);

    let view;
    switch (route.view) {
        case 'home':    view = <Home t={t} go={go} lang={lang} />; break;
        case 'today':
        case 'value':   view = <ValueBoard t={t} go={go} lang={lang} />; break;
        case 'match':   view = <MatchPage t={t} go={go} id={route.id} lang={lang} />; break;
        case 'combos':
        case 'premium': view = <Premium t={t} go={go} />; break;
        case 'record':  view = <Record t={t} go={go} />; break;
        case 'arb':     view = <Arbitrage t={t} go={go} lang={lang} />; break;
        case 'how':     view = <How t={t} go={go} />; break;
        default:        view = <Home t={t} go={go} lang={lang} />;
    }

    return (
        <React.Fragment>
            <Ticker />
            <Nav t={t} lang={lang} setLang={setLang} route={route} go={go} />
            <ErrorBoundary routeKey={route.view + (route.id||'')}>{view}</ErrorBoundary>
            <MobileNav t={t} route={route} go={go} />
        </React.Fragment>
    );
}

/* ------------------------------------------------------------
   Boot
   · Reads the daily feed produced by the robot (mundial/daily.json).
   · Caches it in the browser for CONFIG.cacheHours so repeat visits
     in the same window make ZERO extra requests. The site never calls
     The Odds API directly — only the daily robot does (1 call/day).
   · Picks up ?unlocked=single|all from the Stripe redirect to unlock.
   · Falls back to the sample data in data.js (e.g. local preview).
   ------------------------------------------------------------ */
const CFG = window.MV_CONFIG || {};
const DATA_URL = CFG.dataUrl || 'daily.json';
const CACHE_KEY = 'mv_daily_cache_v1';
const CACHE_MS = (CFG.cacheHours != null ? CFG.cacheHours : 12) * 3600 * 1000;

function applyDaily(d) {
    if (!d) return false;
    if (d.TEAMS)   window.TEAMS   = d.TEAMS;
    if (d.BOOKS)   window.BOOKS   = d.BOOKS;
    if (d.MATCHES) window.MATCHES = d.MATCHES;
    if (d.COMBOS)  window.COMBOS  = d.COMBOS;
    if (d.RECORD && d.RECORD.length)  window.RECORD  = d.RECORD;   // keep sample record until real picks are settled
    window.PENDING = Array.isArray(d.PENDING) ? d.PENDING : [];    // our live selections awaiting result
    // de-dup helper: drop entries sharing the same key (first wins)
    const dedupBy = (arr, keyFn) => { const s = new Set(); return (arr||[]).filter(o => { const k = keyFn(o); if (s.has(k)) return false; s.add(k); return true; }); };
    const comboKey = (c) => `${c.date||''}|${(c.legs||[]).map(l=>`${l.match}|${l.pick}`).sort().join(' + ')}`;
    window.PENDING = dedupBy(window.PENDING, p => `${p.date||''}|${p.match||''}|${p.pickLabel||''}`);
    // Combos we hand-pin (always shown) take priority; the robot's settled combos follow, deduped by dayId AND by content.
    const feedCombos = dedupBy(Array.isArray(d.COMBO_RECORD) ? d.COMBO_RECORD : [], comboKey);
    const pinned = Array.isArray(window.COMBO_PINNED) ? window.COMBO_PINNED : [];
    const seen = new Set([...pinned.map(c => c.dayId), ...pinned.map(comboKey)]);
    window.COMBO_RECORD = [...pinned, ...feedCombos.filter(c => !seen.has(c.dayId) && !seen.has(comboKey(c)))];
    window.COMBO_PENDING = dedupBy(Array.isArray(d.COMBO_PENDING) ? d.COMBO_PENDING : (window.COMBO_PENDING || []), comboKey);
    if (d.meta)    window.DAILY.meta = d.meta;
    // Trust the model the robot already computed (single source of truth).
    // Only (re)compute for matches that arrive without one — e.g. older feeds.
    if (window.computeModel && Array.isArray(window.MATCHES)) {
        window.MATCHES.forEach(m => {
            const known = window.TEAMS[m.home] && window.TEAMS[m.away] &&
                          window.TEAMS[m.home].known !== false && window.TEAMS[m.away].known !== false;
            if (!m.model && known) m.model = window.computeModel(m.home, m.away, { neutral: true });
        });
    }
    return true;
}

async function loadDaily() {
    // 1) fresh browser cache → no network at all
    // 1) network FIRST — daily.json is a tiny static file and costs 0 API credits,
    //    so always grab the freshest version. (Fixes returning visitors seeing old data.)
    try {
        const r = await fetch(DATA_URL + '?t=' + Date.now(), { cache: 'no-store' });
        if (r.ok) {
            const d = await r.json();
            try { localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), data: d })); } catch (e) {}
            return d;
        }
    } catch (e) {}
    // 2) offline fallback only: last good copy from this browser
    try {
        const c = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
        if (c && c.data) return c.data;
    } catch (e) {}
    return null;
}

function handleUnlockRedirect() {
    try {
        // Read query params from BOTH the normal search AND the hash — a hash-router
        // URL like  /#/record?dueno=KEY  hides the query from location.search.
        const fromHash = (location.hash.split('?')[1]) || '';
        const p = new URLSearchParams(location.search);
        const ph = new URLSearchParams(fromHash);
        const get = (k) => p.get(k) || ph.get(k);
        const u = get('unlocked');
        if (u === 'single' || u === 'all') {
            localStorage.setItem('mv_plan', u);
        }
        // OWNER MODE: ?dueno=CLAVE unlocks everything locally; ?dueno=salir exits.
        const owner = (get('dueno') || get('owner') || '').trim().toLowerCase();
        const key = ((window.MV_CONFIG && window.MV_CONFIG.ownerKey) || '').trim().toLowerCase();
        if (owner) {
            if (owner === 'salir' || owner === 'exit') { localStorage.removeItem('mv_owner'); localStorage.removeItem('mv_plan'); }
            else if (key && owner === key) { localStorage.setItem('mv_owner', '1'); localStorage.setItem('mv_plan', 'all'); }
            else { console.warn('[GOLVALUE] modo dueño: la clave no coincide con MV_CONFIG.ownerKey en config.js'); }
            // strip the query but keep the hash route
            const cleanHash = location.hash.split('?')[0];
            history.replaceState({}, '', location.pathname + cleanHash);
        }
        if (localStorage.getItem('mv_owner') === '1') { window.MV_OWNER = true; window.MV_PLAN = 'all'; localStorage.setItem('mv_plan', 'all'); }
    } catch (e) {}
}

async function boot() {
    handleUnlockRedirect();
    // Ask the backend (Cloudflare Function) who this visitor is, if present.
    try {
        const r = await fetch('/api/me', { cache: 'no-store' });
        if (r.ok) {
            const j = await r.json();
            window.MV_BACKEND = !!j.backend;
            if (j.plan && !window.MV_OWNER) window.MV_PLAN = j.plan;   // server is the source of truth (unless owner)
        }
    } catch (e) {}
    const d = await loadDaily();
    if (applyDaily(d)) {
        console.log('[MUNDIAL VALUE] feed loaded ·', (d.meta && d.meta.updatedAt) || '');
    } else {
        console.log('[MUNDIAL VALUE] no daily.json — using sample data');
    }
    ReactDOM.createRoot(document.getElementById('root')).render(<App />);
}
boot();
