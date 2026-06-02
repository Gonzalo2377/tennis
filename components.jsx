/* ============================================================
   MUNDIAL VALUE — shared components (football)
   ============================================================ */
const { useState, useEffect, useRef } = React;

const teamById = (id) => window.TEAMS[id] || { id, name: (typeof id==='string'? id : 'Equipo'), code: (typeof id==='string'? id.slice(0,3).toUpperCase() : '?'), color: '#3a4768', known: false, elo: null, conf: null, form: '-----' };
const bookById = (id) => window.BOOKS[id] || { id, name: (typeof id==='string'? id : 'Casa'), abbr: (typeof id==='string'? id.slice(0,3).toUpperCase() : '?'), color: '#5b6472' };

const MV_BRAND = (window.MV_CONFIG && window.MV_CONFIG.brand) || { name:'GOL', accent:'VALUE', tagline:'VALOR · FÚTBOL' };

/* ---------- icons ---------- */
const Icon = {
    ball: (p={}) => (<svg viewBox="0 0 24 24" fill="none" stroke={p.c||'#0b0e17'} strokeWidth="1.6" {...p}><circle cx="12" cy="12" r="9"/><path d="m12 7 3 2.2-1.1 3.5h-3.8L9 9.2 12 7zM12 3v4M5 9l3.5.5M19 9l-3.5.5M7 19l2-3M17 19l-2-3"/></svg>),
    bolt: (p={}) => (<svg viewBox="0 0 24 24" fill="currentColor" {...p}><path d="M13 2 4 14h6l-1 8 9-12h-6l1-8z"/></svg>),
    target: (p={}) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" {...p}><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/></svg>),
    layers: (p={}) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" {...p}><path d="m12 2 9 5-9 5-9-5 9-5zM3 12l9 5 9-5M3 17l9 5 9-5"/></svg>),
    chart: (p={}) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" {...p}><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></svg>),
    book: (p={}) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" {...p}><path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2zM19 3v18"/></svg>),
    search: (p={}) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...p}><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>),
    arrow: (p={}) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...p}><path d="M5 12h14M13 6l6 6-6 6"/></svg>),
    lock: (p={}) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" {...p}><rect x="4" y="11" width="16" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>),
    check: (p={}) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" {...p}><path d="M20 6 9 17l-5-5"/></svg>),
    x: (p={}) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...p}><path d="M18 6 6 18M6 6l12 12"/></svg>),
    ext: (p={}) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" {...p}><path d="M14 4h6v6M20 4l-9 9M19 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5"/></svg>),
    trophy: (p={}) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" {...p}><path d="M6 4h12v4a6 6 0 0 1-12 0zM6 6H3v2a3 3 0 0 0 3 3M18 6h3v2a3 3 0 0 1-3 3M9 19h6M12 14v5"/></svg>),
    scale: (p={}) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" {...p}><path d="M12 3v18M7 21h10M12 5l-7 2 7-2 7 2-7-2M5 7l-2.5 6a3 3 0 0 0 6 0L5 7zM19 7l-2.5 6a3 3 0 0 0 6 0L19 7z"/></svg>),
};

function pickInk(hex) {
    if (typeof hex !== 'string' || !/^#?[0-9a-fA-F]{6}$/.test(hex.replace('#',''))) return '#ffffff';
    const c = hex.replace('#',''); const r=parseInt(c.slice(0,2),16), g=parseInt(c.slice(2,4),16), b=parseInt(c.slice(4,6),16);
    return (0.299*r + 0.587*g + 0.114*b) > 150 ? '#0b0e17' : '#ffffff';
}

/* ---------- national-team crest (code box) ---------- */
function Flag({ team, size = 30, radius = 8 }) {
    if (!team) return null;
    return (
        <span className="vc-team__logo" style={{
            width: size, height: size, borderRadius: radius, background: team.color,
            color: pickInk(team.color), fontSize: size * 0.32,
            border: team.color === '#ffffff' ? '1px solid var(--line)' : 'none'
        }}>{team.code}</span>
    );
}

/* ---------- bookmaker chip ---------- */
/* ---------- team crest (logo if provided, else colour monogram) ---------- */
function Crest({ id, size = 30 }) {
    const tm = teamById(id);
    const col = (tm && tm.color) || '#5b6472';
    const logo = (tm && tm.logo) || (window.GOL_LOGOS && window.GOL_LOGOS[id]);
    const wrap = { width:size, height:size, borderRadius:'50%', flexShrink:0, display:'inline-grid', placeItems:'center', overflow:'hidden', boxShadow:'0 1px 4px rgba(0,0,0,.25)' };
    if (logo) return <span style={{ ...wrap, background:'#fff' }}><img src={logo} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} onError={(e)=>{ e.target.style.display='none'; }} /></span>;
    return <span style={{ ...wrap, background:col, color:pickInk(col), fontFamily:'var(--font-mono)', fontWeight:700, fontSize:size*0.3 }}>{(tm && tm.code) || '?'}</span>;
}

function Book({ id, showName = true, size = 24 }) {
    const b = bookById(id);
    if (!b) return null;
    const col = b.color || '#5b6472';
    const abbr = b.abbr || (typeof id==='string'?id.slice(0,3).toUpperCase():'?');
    return (
        <span className="book">
            <span className="book__mark" style={{ background:col, color:pickInk(col), width:size, height:size }}>{showName ? '' : abbr}</span>
            {showName && (b.name || id)}
        </span>
    );
}

/* ---------- value tag ---------- */
function ValueTag({ edge, hot, small, muted }) {
    const positive = edge >= 2;
    const cls = muted ? 'value value--muted' : hot ? 'value value--hot' : positive ? 'value value--pos' : 'value value--neg';
    const sign = edge >= 0 ? '+' : '';
    return (
        <span className={cls} style={small ? { fontSize:'.72rem', padding:'4px 9px' } : null}>
            {positive && !muted && <span className="value__arrow">▲</span>}{sign}{edge.toFixed(1)}%
        </span>
    );
}

/* ---------- 1X2 odds strip (best price per outcome) ---------- */
function Odds3({ m, t, pickKey }) {
    const keys = [['home', t.home], ['draw', t.draw], ['away', t.away]];
    return (
        <div className="odds3">
            {keys.map(([k, lbl]) => {
                const best = window.bestPrice(m.odds[k]);
                const isPick = k === pickKey;
                return (
                    <div key={k} className={'odd3' + (isPick ? ' best' : '')}>
                        <div className="odd3__k">{lbl}</div>
                        <div className="odd3__v">{best.price.toFixed(2)}</div>
                        <div className="odd3__book">{bookById(best.book).name}</div>
                    </div>
                );
            })}
        </div>
    );
}

/* ============================================================
   NAV
   ============================================================ */
function Nav({ t, lang, setLang, route, go }) {
    const [open, setOpen] = useState(false);
    const links = [
        ['value', t.navValue, Icon.target],
        ['combos', t.navCombos, Icon.layers],
        ['arb', t.navArb, Icon.scale],
        ['record', t.navRecord, Icon.chart],
        ['how', t.navHow, Icon.book],
    ];
    const isActive = (k) => route.view === k || (k==='value'&&route.view==='match') || (k==='combos'&&route.view==='premium');
    return (
        <React.Fragment>
            <header className="nav">
                <div className="nav__inner">
                    <a className="brand" href="#" onClick={(e)=>{e.preventDefault(); go({view:'home'});}}>
                        <span className="brand__mark">{Icon.ball({ style:{width:22,height:22} })}</span>
                        <span>
                            <span className="brand__name">{MV_BRAND.name}<b>{MV_BRAND.accent}</b></span>
                            <span className="brand__sub">{MV_BRAND.tagline || t.brandSub}</span>
                        </span>
                    </a>
                    <nav className="nav__links">
                        {links.map(([k,label,Ic]) => (
                            <a key={k} href="#" className={'nav__link' + (isActive(k)?' active':'')}
                               onClick={(e)=>{e.preventDefault(); go({view:k});}}>{Ic({ style:{width:15,height:15} })}{label}</a>
                        ))}
                    </nav>
                    <span className="nav__spacer" />
                    <div className="search">{Icon.search({})}<input placeholder={t.searchPh} onKeyDown={(e)=>{ if(e.key==='Enter') go({view:'value'}); }} /></div>
                    <button className="lang-btn" onClick={()=>setLang(lang==='es'?'en':'es')}>{lang==='es'?'🇪🇸 ES':'🇬🇧 EN'}</button>
                    <button className="btn btn--lime btn--sm" style={{ flexShrink:0 }} onClick={()=>go({view:'premium'})}>{t.goPremium}</button>
                    <button className={'nav__toggle' + (open?' open':'')} onClick={()=>setOpen(!open)} aria-label="Menu"><span></span><span></span><span></span></button>
                </div>
            </header>
            <div className={'drawer' + (open?' open':'')}>
                <div className="drawer__scrim" onClick={()=>setOpen(false)} />
                <div className="drawer__panel">
                    <div className="search" style={{ marginBottom:18 }}>{Icon.search({})}<input placeholder={t.searchPh} /></div>
                    {links.map(([k,label,Ic]) => (
                        <a key={k} href="#" className={'drawer__link' + (isActive(k)?' active':'')}
                           onClick={(e)=>{e.preventDefault(); setOpen(false); go({view:k});}}>{Ic({ style:{width:18,height:18} })}{label}</a>
                    ))}
                    <button className="btn btn--lime" style={{ width:'100%', marginTop:16 }} onClick={()=>{setOpen(false); go({view:'premium'});}}>{t.goPremium}</button>
                </div>
            </div>
        </React.Fragment>
    );
}

/* ---------- mobile bottom nav ---------- */
function MobileNav({ t, route, go }) {
    const items = [
        ['value', t.navValue, Icon.target],
        ['combos', t.navCombos, Icon.layers],
        ['arb', t.navArb, Icon.scale],
        ['record', t.navRecord, Icon.chart],
    ];
    const isActive = (k) => route.view === k || (k==='value'&&route.view==='match');
    return (
        <nav className="mnav"><div className="mnav__row">
            {items.map(([k,label,Ic]) => (
                <button key={k} className={'mnav__btn' + (isActive(k)?' active':'')} onClick={()=>go({view:k})}>{Ic({})}{label}</button>
            ))}
        </div></nav>
    );
}

/* ---------- updated-at chip ---------- */
function LiveChip({ t }) {
    return <span className="live-chip"><span className="pulse" />{t.autoUpdate}</span>;
}

/* ---------- ticker ---------- */
function Ticker() {
    const items = [
        ['LALIGA','RMA','BAR','—'],['PREMIER','MCI','ARS','—'],['SERIE A','INT','JUV','—'],
        ['BUNDESLIGA','BAY','BVB','—'],['LIGUE 1','PSG','MON','—'],['SELECCIONES','ESP','FRA','—'],
    ];
    const row = (k) => items.map((it,i)=>{
        const [g,a,b]=it;
        return (<span className="tk-item" key={k+i}><span className="tk-lg">{g}</span><span className="tk-team win">{a}</span><span className="tk-sep">vs</span><span className="tk-team">{b}</span></span>);
    });
    return <div className="ticker"><div className="ticker__track">{row('a')}{row('b')}</div></div>;
}

/* ---------- footer ---------- */
function Footer({ t, go }) {
    return (
        <footer className="footer">
            <div className="footer__inner">
                <div style={{ maxWidth:280 }}>
                    <div className="brand" style={{ marginBottom:14 }}>
                        <span className="brand__mark">{Icon.ball({ style:{width:22,height:22} })}</span>
                        <span><span className="brand__name">{MV_BRAND.name}<b>{MV_BRAND.accent}</b></span></span>
                    </div>
                    <p style={{ color:'var(--muted)', fontSize:'.86rem', lineHeight:1.6, margin:0 }}>{t.builtWith}</p>
                </div>
                <div className="footer__col"><h4>{t.footProduct}</h4>
                    <a href="#" onClick={(e)=>{e.preventDefault();go({view:'value'});}}>{t.footValue}</a>
                    <a href="#" onClick={(e)=>{e.preventDefault();go({view:'combos'});}}>{t.footCombos}</a>
                    <a href="#" onClick={(e)=>{e.preventDefault();go({view:'record'});}}>{t.footRecord}</a>
                </div>
                <div className="footer__col"><h4>{t.footInfo}</h4>
                    <a href="#" onClick={(e)=>{e.preventDefault();go({view:'how'});}}>{t.footHow}</a>
                    <a href="#">{t.footAbout}</a><a href="#">{t.footContact}</a>
                </div>
                <div className="footer__col"><h4>{t.footLegal}</h4>
                    <a href="#">{t.footPrivacy}</a><a href="#">{t.footTerms}</a><a href="#">{t.footResp}</a>
                </div>
            </div>
            <div className="footer__legal"><b>+18 · {t.discTitle}</b> {MV_BRAND.name}{MV_BRAND.accent} © 2026 · {t.builtWith}</div>
        </footer>
    );
}

Object.assign(window, {
    Icon, pickInk, Flag, Book, ValueTag, Odds3, Nav, MobileNav, LiveChip, Ticker, Footer, teamById, bookById,
});
