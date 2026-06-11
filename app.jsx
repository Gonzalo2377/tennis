/* ACEVALUE — router + boot (tennis) */

function parseHash() {
  const h = (window.location.hash || '').replace(/^#\/?/, '');
  if (!h) return { view:'home' };
  const parts = h.split('/');
  return { view: parts[0] || 'home', id: parts[1] };
}

class ErrorBoundary extends React.Component {
  constructor(p){ super(p); this.state={err:null}; }
  static getDerivedStateFromError(err){ return {err}; }
  componentDidUpdate(prev){ if(prev.routeKey!==this.props.routeKey && this.state.err) this.setState({err:null}); }
  render(){
    if(this.state.err){
      return (
        <div style={{maxWidth:560, margin:'80px auto', padding:'0 22px', textAlign:'center'}}>
          <div style={{fontFamily:'var(--font-head)', fontWeight:800, fontSize:'1.4rem', marginBottom:8}}>Ese partido no se pudo mostrar</div>
          <p style={{color:'var(--ink-2)', lineHeight:1.6, marginBottom:20}}>Faltan datos para analizarlo. Prueba con otro o vuelve al inicio.</p>
          <a href="#/value" onClick={()=>this.setState({err:null})} style={{display:'inline-block', background:'var(--lime)', color:'var(--ink)', fontFamily:'var(--font-head)', fontWeight:800, textDecoration:'none', padding:'12px 22px', borderRadius:11}}>← Ver todas las cuotas</a>
        </div>
      );
    }
    return this.props.children;
  }
}

function App() {
  const [lang, setLangState] = useState(()=>{ try { return localStorage.getItem('ace_lang') || (window.ACE_CONFIG&&window.ACE_CONFIG.defaultLang) || 'es'; } catch(e){ return 'es'; } });
  const [route, setRoute] = useState(parseHash());
  const [, force] = useState(0);

  useEffect(()=>{
    const onHash = ()=>setRoute(parseHash());
    window.addEventListener('hashchange', onHash);
    return ()=>window.removeEventListener('hashchange', onHash);
  }, []);

  const setLang = (l)=>{ setLangState(l); try { localStorage.setItem('ace_lang', l); } catch(e){} };
  const go = (r)=>{ window.location.hash = '#/' + r.view + (r.id?('/'+r.id):''); window.scrollTo({top:0}); };
  const t = window.I18N[lang] || window.I18N.es;

  let view;
  switch (route.view) {
    case 'home':   view = <Home t={t} go={go} />; break;
    case 'value':  view = <ValueBoard t={t} go={go} />; break;
    case 'match':  view = <MatchPage t={t} go={go} id={route.id} />; break;
    case 'arb':    view = <Arbitrage t={t} go={go} />; break;
    case 'combos': view = <Combos t={t} go={go} />; break;
    case 'record': view = <Record t={t} go={go} />; break;
    case 'model':  view = <ModelAccuracy t={t} go={go} />; break;
    case 'how':    view = <How t={t} go={go} />; break;
    default:       view = <Home t={t} go={go} />;
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

/* ---- load the robot's daily feed (cached locally to save API credits) ---- */
function applyDaily(d){
  if(!d) return;
  // dedup helpers (same normalization as the robot: ignore initials, accents, "Gana", date)
  const normSide=s=>(s||'').trim().replace(/^[A-Za-z]\.\s*/,'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
  const normMatch=m=>(m||'').split(/[–\-]/).map(normSide).filter(Boolean).sort().join('|');
  const normPick=s=>(s||'').replace(/^gana\s+/i,'').replace(/^[A-Za-z]\.\s*/,'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
  const dq=(arr,key)=>{const s=new Set();return (arr||[]).filter(o=>{const k=key(o);if(s.has(k))return false;s.add(k);return true;});};
  const pkey=p=>`${normMatch(p.match)}|${normPick(p.pickLabel||p.pick)}`;
  const rkey=r=>`${normMatch(r.match)}|${normPick(r.pick||r.pickLabel)}`;
  const ckey=c=>(c.legs||[]).map(l=>`${normMatch(l.match)}|${normPick(l.pick)}`).sort().join('+');
  const akey=a=>normMatch(a.match);

  if(d.PLAYERS) window.PLAYERS = d.PLAYERS;
  if(d.BOOKS)   window.BOOKS   = d.BOOKS;
  if(Array.isArray(d.MATCHES) && d.MATCHES.length) window.MATCHES = d.MATCHES.filter(m=>!m.noModel);   // oculta partidos de jugadores desconocidos
  if(Array.isArray(d.COMBOS))  window.COMBOS  = d.COMBOS;
  if(Array.isArray(d.RECORD) && d.RECORD.length) window.RECORD = dq(d.RECORD, rkey);
  if(Array.isArray(d.COMBO_RECORD)) window.COMBO_RECORD = dq(d.COMBO_RECORD, ckey);
  if(Array.isArray(d.COMBO_PENDING)) window.COMBO_PENDING = dq(d.COMBO_PENDING, ckey);
  if(Array.isArray(d.ARB_RECORD)) window.ARB_RECORD = dq(d.ARB_RECORD, akey);
  if(Array.isArray(d.MODEL_RECORD)) window.MODEL_RECORD = d.MODEL_RECORD;
  if(Array.isArray(d.MODEL_PENDING)) window.MODEL_PENDING = d.MODEL_PENDING;
  if(Array.isArray(d.EXCLUDE)) window.EXCLUDE = d.EXCLUDE;
  if(Array.isArray(d.PENDING)) {
    // dedup AND drop any pending already settled in the record
    const done = new Set((d.RECORD||[]).map(rkey));
    window.PENDING = dq(d.PENDING, pkey).filter(p=>!done.has(pkey(p)));
  }
  if(d.meta) window.DAILY.meta = d.meta;
}

async function boot(){
  const cfg = window.ACE_CONFIG || {};
  const url = cfg.dataUrl || 'daily.json';
  const cacheMs = (cfg.cacheHours||12)*3600*1000;
  const hasReal = (d)=> d && Array.isArray(d.MATCHES) && d.MATCHES.length > 0;
  try {
    const cached = JSON.parse(localStorage.getItem('ace_feed')||'null');
    // only trust the cache if it actually holds real matches (never cache the demo placeholder)
    if(cached && cached._ts && (Date.now()-cached._ts)<cacheMs && hasReal(cached.data)){
      applyDaily(cached.data);
      console.log('[ACEVALUE] feed from cache');
    } else {
      const res = await fetch(url + '?t=' + Date.now(), { cache:'no-store' });
      if(res.ok){
        const data = await res.json();
        applyDaily(data);
        // only store real feeds → if the robot hasn't run yet, we keep re-checking on every load
        if(hasReal(data)) { try { localStorage.setItem('ace_feed', JSON.stringify({ _ts:Date.now(), data })); } catch(e){} }
        else { try { localStorage.removeItem('ace_feed'); } catch(e){} }
        console.log('[ACEVALUE] feed loaded · matches=' + ((data.MATCHES||[]).length) + ' · ' + (data.meta&&data.meta.updatedAt||''));
      }
    }
  } catch(e){ console.log('[ACEVALUE] feed unavailable, using sample data'); }
  ReactDOM.createRoot(document.getElementById('root')).render(<App />);
}
boot();
