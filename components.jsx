/* ACEVALUE — shared components (tennis) */
const { useState, useEffect, useRef } = React;

const playerById = (id) => window.getPlayer(id);
const bookById = (id) => window.getBook(id);

/* ---------- icons ---------- */
const Icon = {
  ball: (p={}) => (<svg viewBox="0 0 24 24" fill="none" stroke={p.c||'#aee100'} strokeWidth="1.7" {...p}><circle cx="12" cy="12" r="9"/><path d="M4.5 6.5c3 2.2 3 8.8 0 11M19.5 6.5c-3 2.2-3 8.8 0 11"/></svg>),
  target: (p={}) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" {...p}><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.6"/></svg>),
  scale: (p={}) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" {...p}><path d="M12 3v18M7 21h10M12 5l-7 2 7-2 7 2-7-2M5 7l-2.5 6a3 3 0 0 0 6 0L5 7zM19 7l-2.5 6a3 3 0 0 0 6 0L19 7z"/></svg>),
  layers: (p={}) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" {...p}><path d="m12 2 9 5-9 5-9-5 9-5zM3 12l9 5 9-5M3 17l9 5 9-5"/></svg>),
  chart: (p={}) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" {...p}><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></svg>),
  book: (p={}) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" {...p}><path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2zM19 3v18"/></svg>),
  search: (p={}) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...p}><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>),
  arrow: (p={}) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...p}><path d="M5 12h14M13 6l6 6-6 6"/></svg>),
  bolt: (p={}) => (<svg viewBox="0 0 24 24" fill="currentColor" {...p}><path d="M13 2 4 14h6l-1 8 9-12h-6l1-8z"/></svg>),
};

/* ---------- player avatar (photo if provided, else polished monogram) ---------- */
function Avatar({ id, size = 44, badge = true }) {
  const p = playerById(id);
  const initials = (p.name || '?').replace(/[^A-Za-zÀ-ÿ.\s]/g, '').split(/\s+/).filter(Boolean).map(s => s[0]).join('').slice(0,2).toUpperCase();
  const grad = p.tour === 'wta' ? 'linear-gradient(135deg,#c2467f,#7a2d8f)' : 'linear-gradient(135deg,#1f6f4a,#16563a)';
  const photo = p.photo || (window.ACE_PHOTOS && window.ACE_PHOTOS[id]);
  const wrap = { position:'relative', width:size, height:size, flexShrink:0, display:'inline-block' };
  const circle = { width:size, height:size, borderRadius:'50%', overflow:'hidden', display:'grid', placeItems:'center', boxShadow:'0 2px 8px rgba(23,21,15,.18)', border:'2px solid var(--surface)' };
  return (
    <span style={wrap}>
      {photo
        ? <span style={circle}><img src={photo} alt={p.name} style={{ width:'100%', height:'100%', objectFit:'cover' }} onError={(e)=>{ e.target.style.display='none'; }} /></span>
        : <span style={{ ...circle, background:grad, color:'#fff', fontFamily:'var(--font-head)', fontWeight:800, fontSize:size*0.36 }}>{initials}</span>}
      {badge && p.flag && <span style={{ position:'absolute', bottom:-2, right:-2, fontSize:size*0.34, lineHeight:1, filter:'drop-shadow(0 1px 1px rgba(0,0,0,.3))' }}>{p.flag}</span>}
    </span>
  );
}

/* next scheduled match for a player (or null) */
function nextMatchFor(id){ return (window.MATCHES||[]).find(m => m.home===id || m.away===id) || null; }

/* ---------- bookmaker chip ---------- */
function Book({ id, showName = true, size = 22 }) {
  const b = bookById(id);
  return (
    <span className="book">
      <span className="book__logo" style={{ background:b.color, width:size, height:size, fontSize:size*0.26 }}>{b.abbr.slice(0,3)}</span>
      {showName && <span>{b.name}</span>}
    </span>
  );
}

/* ---------- live search with player suggestions ---------- */
function norm(s){ return (s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase(); }
function SearchBox({ t, go }) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [noMatch, setNoMatch] = useState(null);
  const ref = useRef(null);
  useEffect(()=>{
    const onDoc = (e)=>{ if(ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return ()=>document.removeEventListener('mousedown', onDoc);
  }, []);
  const results = q.trim().length >= 2
    ? Object.values(window.PLAYERS||{}).filter(p => norm(p.name).includes(norm(q.trim()))).slice(0,6)
    : [];
  const pick = (p)=>{
    const m = nextMatchFor(p.id);
    if (m){ setOpen(false); setQ(''); setNoMatch(null); go({ view:'match', id:m.id }); }
    else { setNoMatch(p.id); }
  };
  return (
    <div ref={ref} style={{ position:'relative', minWidth:200 }}>
      <div className="search" style={{ minWidth:0 }}>
        {Icon.search({})}
        <input value={q} placeholder={t.searchPh}
          onChange={(e)=>{ setQ(e.target.value); setOpen(true); setNoMatch(null); }}
          onFocus={()=>setOpen(true)}
          onKeyDown={(e)=>{ if(e.key==='Enter'){ if(results[0]) pick(results[0]); else go({view:'value'}); } }} />
      </div>
      {open && q.trim().length>=2 && (
        <div style={{ position:'absolute', top:'calc(100% + 6px)', right:0, width:'min(330px, 86vw)', background:'var(--surface)', border:'1px solid var(--line)', borderRadius:14, boxShadow:'var(--shadow-lg)', zIndex:70, overflow:'hidden' }}>
          {results.length === 0 ? (
            <div style={{ padding:'14px 16px', color:'var(--muted)', fontSize:'.86rem' }}>{t.searchNone}</div>
          ) : results.map(p=>{
            const m = nextMatchFor(p.id);
            const opp = m ? playerById(m.home===p.id ? m.away : m.home) : null;
            return (
              <button key={p.id} onClick={()=>pick(p)} style={{ width:'100%', display:'flex', alignItems:'center', gap:11, padding:'10px 14px', background:'none', border:'none', borderBottom:'1px solid var(--line-soft)', textAlign:'left' }}
                onMouseEnter={(e)=>e.currentTarget.style.background='var(--bg-2)'} onMouseLeave={(e)=>e.currentTarget.style.background='none'}>
                <Avatar id={p.id} size={38} />
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontFamily:'var(--font-head)', fontWeight:700, fontSize:'.95rem' }}>{p.name}</div>
                  <div className="player__meta">
                    {m
                      ? <span>{t.searchNext}: {t.vs} {opp.name} · {m.time}</span>
                      : (noMatch===p.id ? <span style={{color:'var(--clay)'}}>{t.searchNoNext}</span> : <span>{(p.tour||'').toUpperCase()}</span>)}
                  </div>
                </div>
                {m && <span style={{ color:'var(--court)' }}>{Icon.arrow({ style:{width:16,height:16} })}</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ---------- value tag ---------- */
function ValueTag({ edge, hot, small, muted }) {
  const positive = edge >= 1.5;
  const cls = muted ? 'value value--muted' : hot ? 'value value--hot' : positive ? 'value value--pos' : 'value value--neg';
  const sign = edge >= 0 ? '+' : '';
  return (
    <span className={cls} style={small ? { fontSize:'.74rem', padding:'4px 9px' } : null}>
      {positive && !muted && <span className="value__arrow">▲</span>}{sign}{edge.toFixed(1)}%
    </span>
  );
}

/* ---------- player chip ---------- */
function PlayerChip({ id, right=false, big=false }) {
  const p = playerById(id);
  return (
    <div className="player" style={right ? { flexDirection:'row-reverse', textAlign:'right' } : null}>
      <span className="player__seed">{p.flag || (p.seed||'')}</span>
      <div>
        <div className="player__name" style={big?{fontSize:'1.05rem'}:null}>{p.name}</div>
        <div className="player__meta">{p.country}{p.seed?` · #${p.seed}`:''}</div>
      </div>
    </div>
  );
}

/* ---------- form pills ---------- */
function Form({ list }) {
  return <span className="form">{(list||[]).slice(-5).map((r,i)=><span key={i} className={r==='W'?'w':'l'}>{r}</span>)}</span>;
}

/* ---------- live chip ---------- */
function LiveChip({ t }) {
  return <span className="live-chip"><span className="pulse" />{t.autoUpdate}</span>;
}

/* ---------- ticker ---------- */
function Ticker() {
  const items = (window.MATCHES||[]).slice(0,7).map(m=>{
    const h=playerById(m.home), a=playerById(m.away), b=window.saneBest(m.odds.home);
    return { l:`${h.name.split(' ').pop()} v ${a.name.split(' ').pop()}`, o:b.price.toFixed(2) };
  });
  const row = (
    <div className="ticker__row">
      {items.concat(items).map((x,i)=>(<span key={i}>{x.l} <b>{x.o}</b></span>))}
    </div>
  );
  return <div className="ticker">{row}</div>;
}

/* ---------- NAV ---------- */
function Nav({ t, lang, setLang, route, go }) {
  const [open, setOpen] = useState(false);
  const links = [
    ['value', t.navValue, Icon.target],
    ['arb', t.navArb, Icon.scale],
    ['combos', t.navCombos, Icon.layers],
    ['record', t.navRecord, Icon.chart],
    ['how', t.navHow, Icon.book],
  ];
  const isActive = (k) => route.view === k || (k==='value'&&route.view==='match');
  return (
    <React.Fragment>
      <header className="nav">
        <div className="nav__inner">
          <a className="brand" href="#" onClick={(e)=>{e.preventDefault();go({view:'home'});}}>
            <span className="brand__mark">{Icon.ball({ style:{width:22,height:22} })}</span>
            <span>
              <span className="brand__name">ACE<span className="v">VALUE</span></span>
              <span className="brand__sub" style={{display:'block'}}>{t.brandSub}</span>
            </span>
          </a>
          <nav className="nav__links">
            {links.map(([k,label,Ic])=>(
              <a key={k} href="#" className={'nav__link'+(isActive(k)?' active':'')} onClick={(e)=>{e.preventDefault();go({view:k});}}>{Ic({})}{label}</a>
            ))}
          </nav>
          <span className="nav__spacer" />
          <SearchBox t={t} go={go} />
          <button className="lang-btn" onClick={()=>setLang(lang==='es'?'en':'es')}>{lang==='es'?'🇪🇸 ES':'🇬🇧 EN'}</button>
          <button className={'nav__toggle'+(open?' open':'')} onClick={()=>setOpen(!open)} aria-label="Menu"><span></span><span></span><span></span></button>
        </div>
      </header>
      <div className={'drawer'+(open?' open':'')}>
        <div style={{marginBottom:12}}><SearchBox t={t} go={(r)=>{setOpen(false);go(r);}} /></div>
        {links.map(([k,label,Ic])=>(
          <a key={k} href="#" className={'drawer__link'+(isActive(k)?' active':'')} onClick={(e)=>{e.preventDefault();setOpen(false);go({view:k});}}>{Ic({})}{label}</a>
        ))}
        <button className="lang-btn" style={{marginTop:14,width:'100%'}} onClick={()=>setLang(lang==='es'?'en':'es')}>{lang==='es'?'🇪🇸 Español':'🇬🇧 English'}</button>
      </div>
    </React.Fragment>
  );
}

/* ---------- MOBILE NAV ---------- */
function MobileNav({ t, route, go }) {
  const items = [
    ['value', t.navValue, Icon.target],
    ['arb', t.navArb, Icon.scale],
    ['combos', t.navCombos, Icon.layers],
    ['record', t.navRecord, Icon.chart],
  ];
  const isActive = (k) => route.view === k || (k==='value'&&route.view==='match');
  return (
    <nav className="mnav"><div className="mnav__row">
      {items.map(([k,label,Ic])=>(
        <button key={k} className={'mnav__btn'+(isActive(k)?' active':'')} onClick={()=>go({view:k})}>{Ic({})}{label}</button>
      ))}
    </div></nav>
  );
}

/* ---------- footer ---------- */
function Footer({ t, go }) {
  return (
    <footer className="footer">
      <div className="footer__grid">
        <div>
          <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:10 }}>
            <span className="brand__mark" style={{width:34,height:34}}>{Icon.ball({ style:{width:20,height:20} })}</span>
            <span className="brand__name" style={{color:'#f3f1ea'}}>ACE<span style={{color:'var(--lime)'}}>VALUE</span></span>
          </div>
          <p style={{ fontSize:'.86rem', maxWidth:'34ch', lineHeight:1.6 }}>{t.disc}</p>
        </div>
        <div><h4>{t.footProduct}</h4>
          <a href="#" onClick={(e)=>{e.preventDefault();go({view:'value'});}}>{t.footValue}</a>
          <a href="#" onClick={(e)=>{e.preventDefault();go({view:'arb'});}}>{t.footArb}</a>
          <a href="#" onClick={(e)=>{e.preventDefault();go({view:'combos'});}}>{t.footCombos}</a>
          <a href="#" onClick={(e)=>{e.preventDefault();go({view:'record'});}}>{t.footRecord}</a>
        </div>
        <div><h4>{t.footInfo}</h4>
          <a href="#" onClick={(e)=>{e.preventDefault();go({view:'how'});}}>{t.footHow}</a>
          <a href="#">{t.footAbout}</a><a href="#">{t.footContact}</a>
        </div>
      </div>
    </footer>
  );
}

Object.assign(window, { Icon, Avatar, nextMatchFor, Book, ValueTag, SearchBox, PlayerChip, Form, LiveChip, Ticker, Nav, MobileNav, Footer });
