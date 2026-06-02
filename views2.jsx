/* ============================================================
   MUNDIAL VALUE — views part 2: Premium, Record, How
   ============================================================ */

/* ---- premium plan helpers (server-verified if backend present; else Stripe link / demo) ---- */
function isOwner(){ try { return window.MV_OWNER === true || localStorage.getItem('mv_owner') === '1'; } catch(e){ return false; } }
function getPlan(){ if (isOwner()) return 'all'; if (window.MV_PLAN) return window.MV_PLAN; try { return localStorage.getItem('mv_plan') || 'free'; } catch(e){ return 'free'; } }
function setPlanLS(p){ try { localStorage.setItem('mv_plan', p); } catch(e){} }
function stripeUrl(tier){ const s=(window.MV_CONFIG&&window.MV_CONFIG.stripe)||{}; return tier==='single'?s.single:(tier==='all'?s.all:null); }
async function startCheckout(tier, setPlan){
    // 1) real backend: Cloudflare Function creates a Stripe Checkout session
    try {
        const r = await fetch('/api/checkout', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ tier }) });
        if (r.ok) { const j = await r.json(); if (j.url) { window.location.href = j.url; return; } }
    } catch(e){}
    // 2) plain Stripe Payment Link from config.js
    const u = stripeUrl(tier);
    if (u && !/PASTE|^#?$/.test(u)) { window.location.href = u; return; }
    // 3) demo unlock (preview / nothing configured yet)
    setPlanLS(tier); if (setPlan) setPlan(tier);
}

/* a single accumulator card; locked unless `unlocked` */
function ComboCard({ c, t, locked, onUnlock }) {
    const total = window.comboOdds(c);
    const inner = (
        <div className="combo">
            <div className="combo__head">
                <div>
                    <span className="tag tag--lime" style={{ marginBottom:6 }}>{c.tier==='single' ? t.comboOfDay : t.comboTitle}</span>
                    <div className="combo__title">{c.name}</div>
                </div>
                <div style={{ textAlign:'right' }}>
                    <div style={{ fontFamily:'var(--font-mono)', fontSize:'.58rem', letterSpacing:'.12em', textTransform:'uppercase', color:'var(--muted)' }}>{t.comboTotal}</div>
                    <div className="combo__odds">{total.toFixed(2)}</div>
                </div>
            </div>
            <div className="combo__legs">
                {c.legs.map((l,i)=>(
                    <div className="combo-leg" key={i}>
                        <span className="combo-leg__num">{i+1}</span>
                        <div className="combo-leg__main">
                            <div className="combo-leg__match">{l.match}</div>
                            <div className="combo-leg__pick">
                                <span className="combo-leg__pickbadge">{t.pick}</span>
                                <b className="combo-leg__picksel">{l.pick}</b>
                                <span className="combo-leg__book">· {bookById(l.book).name}</span>
                            </div>
                        </div>
                        <span className="combo-leg__odd">{((+l.odd)||0).toFixed(2)}</span>
                    </div>
                ))}
            </div>
            <div className="combo__foot">
                <span className="combo__conf">{t.comboConf}: <b>{c.conf}%</b></span>
                <span style={{ fontFamily:'var(--font-mono)', fontSize:'.72rem', color:'var(--muted)' }}>{c.legs.length} {t.legs}</span>
            </div>
        </div>
    );
    if (!locked) return inner;
    return (
        <div className="locked">
            <div className="locked__content">{inner}</div>
            <div className="locked__overlay">
                <span className="locked__ic">{Icon.lock({ style:{width:24,height:24} })}</span>
                <div style={{ fontFamily:'var(--font-head)', fontWeight:800, fontSize:'1.1rem' }}>{t.lockedTitle}</div>
                <div style={{ color:'var(--text-2)', fontSize:'.88rem', maxWidth:240 }}>{t.lockedSub}</div>
                <button className="btn btn--lime btn--sm" style={{ marginTop:4 }} onClick={onUnlock}>{c.tier==='single' ? t.unlockSingle : t.unlockAll}</button>
            </div>
        </div>
    );
}

function Premium({ t, go }) {
    // plan persists in localStorage; Stripe redirect sets it via ?unlocked=
    const [plan, setPlan] = useState(getPlan());
    const combos = window.COMBOS;
    const isUnlocked = (c) => plan==='all' || (plan==='single' && c.tier==='single') || (plan==='free' && c.id==='c1');

    const tiers = [
        { key:'free', name:t.tierFree, amt:'0€', per:'', desc:t.priceFreeDesc, cta:t.getFree, feat:[
            [true,t.featValueBoard],[true,t.featCompare],[true,t.featRecord],[false,t.featComboDay],[false,t.featCombosAll] ] },
        { key:'single', name:t.tierSingle, amt:'3,99€', per:t.perOnce, feat:[
            [true,t.featValueBoard],[true,t.featCompare],[true,t.featComboDay],[false,t.featCombosAll],[false,t.featHistory] ], desc:t.priceSingleDesc, cta:t.getSingle },
        { key:'all', name:t.tierAll, amt:'14,99€', per:t.perMonth, feat:[
            [true,t.featValueBoard],[true,t.featComboDay],[true,t.featCombosAll],[true,t.featHistory],[true,t.featPriority] ], desc:t.priceAllDesc, cta:t.getAll, feat_popular:true },
    ];

    return (
        <main>
            <section className="section">
                <div className="wrap">
                    <span className="eyebrow"><span className="dot" />{t.comboOfDay}</span>
                    <h2 className="section__title" style={{ marginBottom:8 }}>{t.pricingTitle}</h2>
                    {isOwner() && (
                        <div style={{ display:'flex', alignItems:'center', gap:10, background:'rgba(246,196,67,.1)', border:'1px solid rgba(246,196,67,.4)', borderRadius:10, padding:'10px 14px', marginBottom:16 }}>
                            <span style={{ fontFamily:'var(--font-head)', fontWeight:800, color:'var(--lime)', fontSize:'.85rem' }}>👑 MODO DUEÑO</span>
                            <span style={{ color:'var(--text-2)', fontSize:'.85rem' }}>Estás viendo todas las combinadas desbloqueadas. Para salir: <code style={{ color:'var(--lime)' }}>?dueno=salir</code></span>
                        </div>
                    )}
                    <p style={{ color:'var(--text-2)', maxWidth:620, lineHeight:1.6, marginBottom:26 }}>{t.pricingLead}</p>

                    <div className="pricing">
                        {tiers.map(tier => (
                            <div key={tier.key} className={'price-card' + (tier.feat_popular ? ' feat' : '')}>
                                <span className="price-card__tier">{tier.name}</span>
                                <div className="price-card__price"><span className="amt">{tier.amt}</span><span className="per">{tier.per}</span></div>
                                <p className="price-card__desc">{tier.desc}</p>
                                <ul className="price-card__feats">
                                    {tier.feat.map(([on,label],i)=>(
                                        <li key={i} className={on?'':'off'}>{on?Icon.check({}):Icon.x({})}{label}</li>
                                    ))}
                                </ul>
                                <button className={'btn ' + (tier.feat_popular?'btn--lime':'btn--ghost')} onClick={()=> tier.key==='free' ? (setPlanLS('free'), setPlan('free')) : startCheckout(tier.key, setPlan)}>{tier.cta}</button>
                            </div>
                        ))}
                    </div>

                    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:12, margin:'40px 0 16px' }}>
                        <div><span className="eyebrow muted"><span className="dot" />{t.comboTitle}</span><h3 className="section__title" style={{ fontSize:'1.4rem' }}>{t.navCombos}</h3></div>
                        <span className="tag">{plan==='free'?t.tierFree:plan==='single'?t.tierSingle:t.tierAll} · demo</span>
                    </div>
                    <p style={{ color:'var(--text-2)', maxWidth:620, lineHeight:1.6, margin:'-6px 0 22px' }}>{t.comboLead}</p>

                    <div className="grid grid--3" style={{ alignItems:'start' }}>
                        {combos.map(c => <ComboCard key={c.id} c={c} t={t} locked={!isUnlocked(c)} onUnlock={()=>startCheckout(c.tier==='single'?'single':'all', setPlan)} />)}
                    </div>

                    <div className="disclaimer" style={{ marginTop:26 }}><b>{t.discTitle}</b> {t.disc}</div>
                </div>
            </section>
            <Footer t={t} go={go} />
        </main>
    );
}

/* ---------- equity curve (inline SVG) ---------- */
function EquityCurve() {
    const pts = window.equitySeries();
    const w = 600, h = 120, pad = 6;
    const xs = pts.map(p=>p.x), ys = pts.map(p=>p.y);
    const minY = Math.min(0, ...ys), maxY = Math.max(...ys, 1);
    const maxX = Math.max(...xs) || 1;
    const spanY = (maxY - minY) || 1;
    const sx = (x) => pad + (x/maxX) * (w - pad*2);
    const sy = (y) => h - pad - ((y - minY)/spanY) * (h - pad*2);
    const line = pts.map((p,i)=>`${i?'L':'M'}${sx(p.x).toFixed(1)},${sy(p.y).toFixed(1)}`).join(' ');
    const area = `${line} L${sx(xs[xs.length-1]).toFixed(1)},${(h-pad).toFixed(1)} L${sx(0).toFixed(1)},${(h-pad).toFixed(1)} Z`;
    const zeroY = sy(0);
    return (
        <svg className="equity" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
            <defs><linearGradient id="eq" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="rgba(246,196,67,.35)" /><stop offset="100%" stopColor="rgba(246,196,67,0)" />
            </linearGradient></defs>
            <line x1={pad} y1={zeroY} x2={w-pad} y2={zeroY} stroke="rgba(255,255,255,.12)" strokeWidth="1" strokeDasharray="4 4" />
            <path d={area} fill="url(#eq)" />
            <path d={line} fill="none" stroke="var(--lime)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
        </svg>
    );
}

function Record({ t, go }) {
    const rec = window.recordSummary();
    let cum = 0;
    return (
        <main>
            <section className="section">
                <div className="wrap">
                    <span className="eyebrow"><span className="dot" />{t.recordEyebrow}</span>
                    <h2 className="section__title" style={{ marginBottom:8 }}>{t.recordTitle}</h2>
                    <p style={{ color:'var(--text-2)', maxWidth:660, lineHeight:1.6, marginBottom:26 }}>{t.recordLead}</p>

                    {isOwner() && window.DAILY && window.DAILY.meta && window.DAILY.meta.credits && (window.DAILY.meta.credits.used != null || window.DAILY.meta.credits.remaining != null) && (
                        <div style={{ display:'flex', alignItems:'center', gap:18, flexWrap:'wrap', background:'rgba(246,196,67,.08)', border:'1px solid rgba(246,196,67,.32)', borderRadius:12, padding:'12px 18px', marginBottom:22 }}>
                            <span style={{ fontFamily:'var(--font-head)', fontWeight:800, color:'var(--lime)', fontSize:'.85rem' }}>👑 API · The Odds API</span>
                            <span style={{ fontFamily:'var(--font-mono)', fontSize:'.82rem', color:'var(--text-2)' }}>Créditos usados: <b style={{ color:'var(--text)' }}>{window.DAILY.meta.credits.used ?? '—'}</b></span>
                            <span style={{ fontFamily:'var(--font-mono)', fontSize:'.82rem', color:'var(--text-2)' }}>Restantes: <b style={{ color:'var(--green)' }}>{window.DAILY.meta.credits.remaining ?? '—'}</b></span>
                            <span style={{ fontFamily:'var(--font-mono)', fontSize:'.7rem', color:'var(--muted)' }}>actualizado {window.DAILY.meta.updatedAt ? new Date(window.DAILY.meta.updatedAt).toLocaleString('es-ES') : ''}</span>
                        </div>
                    )}

                    <div className="rec-stats">
                        <div className="rec-stat"><div className="rec-stat__l">{t.roi}</div><div className="rec-stat__v pos">+{rec.roi}%</div><div className="rec-stat__s">{rec.staked}{t.units} {t.profit.toLowerCase()}</div></div>
                        <div className="rec-stat"><div className="rec-stat__l">{t.profit}</div><div className="rec-stat__v pos">+{rec.profit}{t.units}</div><div className="rec-stat__s">{t.avgOdd} {rec.avgOdd}</div></div>
                        <div className="rec-stat"><div className="rec-stat__l">{t.winRate}</div><div className="rec-stat__v">{rec.winRate}%</div><div className="rec-stat__s">{rec.w}{t.resW[0]} · {rec.l}{t.resL[0]}</div></div>
                        <div className="rec-stat"><div className="rec-stat__l">{t.totalPicks}</div><div className="rec-stat__v">{rec.picks}</div><div className="rec-stat__s">1{t.units}/pick</div></div>
                    </div>

                    <div className="panel panel--pad" style={{ marginBottom:22 }}>
                        <span className="eyebrow muted"><span className="dot" />{t.profit} ({t.units})</span>
                        <div style={{ marginTop:14 }}><EquityCurve /></div>
                    </div>

                    {Array.isArray(window.PENDING) && window.PENDING.length > 0 && (
                        <div className="panel panel--pad" style={{ marginBottom:22, borderColor:'rgba(246,196,67,.3)' }}>
                            <span className="eyebrow"><span className="dot" />{t.pendingTitle}</span>
                            <p style={{ color:'var(--text-2)', fontSize:'.9rem', lineHeight:1.55, margin:'10px 0 16px', maxWidth:660 }}>{t.pendingLead}</p>
                            {window.PENDING.map((p,i)=>(
                                <div className="oc-row" key={i} style={{ alignItems:'center' }}>
                                    <div>
                                        <div className="oc-name">{p.pickLabel} <span style={{ color:'var(--muted)', fontWeight:400, fontFamily:'var(--font-mono)', fontSize:'.8rem' }}>· {p.match}</span></div>
                                        <div className="oc-sub">{p.date} · {bookById(p.book) ? bookById(p.book).name : p.book}</div>
                                    </div>
                                    <div style={{ display:'flex', alignItems:'center', gap:14 }}>
                                        <span style={{ fontFamily:'var(--font-mono)', fontWeight:700, fontSize:'1.1rem' }}>{(+p.odd).toFixed(2)}</span>
                                        <span className="res-pill p" style={{ background:'rgba(246,196,67,.14)', color:'var(--lime)' }}>{t.statusPending}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    <div className="panel">
                        <div className="ptable-scroll">
                        <table className="ledger">
                            <thead><tr>
                                <th className="l">{t.colDate}</th><th className="l">{t.colPick}</th><th className="l">{t.colMatch}</th>
                                <th>{t.colOdd}</th><th>{t.colBook}</th><th>{t.colResult}</th><th>{t.colProfit}</th>
                            </tr></thead>
                            <tbody>
                                {window.RECORD.filter(x => x && !x.legs && x.result).map((x,i)=>{
                                    const stake = (typeof x.stake==='number'&&isFinite(x.stake))?x.stake:1;
                                    const odd = (+x.odd)||0;
                                    const p = x.result==='W' ? stake*(odd-1) : x.result==='L' ? -stake : 0;
                                    cum += p;
                                    const resCls = x.result==='W'?'w':x.result==='L'?'l':'p';
                                    const resLbl = x.result==='W'?t.resW:x.result==='L'?t.resL:t.resP;
                                    return (
                                        <tr key={i}>
                                            <td className="l" style={{ color:'var(--muted)' }}>{x.date}</td>
                                            <td className="l" style={{ fontFamily:'var(--font-head)', fontWeight:600 }}>{x.pick}</td>
                                            <td className="l" style={{ color:'var(--text-2)' }}>{x.match}</td>
                                            <td>{odd.toFixed(2)}</td>
                                            <td><Book id={x.book} showName={false} size={20} /></td>
                                            <td><span className={'res-pill ' + resCls}>{resLbl}</span></td>
                                            <td className={'profit ' + (p>=0?'pos':'neg')}>{p>=0?'+':''}{p.toFixed(2)}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                        </div>
                    </div>

                    {Array.isArray(window.COMBO_RECORD) && window.COMBO_RECORD.length > 0 && (
                        <div style={{ marginTop:30 }}>
                            <span className="eyebrow"><span className="dot" />{t.comboRecTitle}</span>
                            <p style={{ color:'var(--text-2)', fontSize:'.9rem', lineHeight:1.55, margin:'10px 0 16px', maxWidth:660 }}>{t.comboRecLead}</p>
                            <div className="grid grid--3">
                                {window.COMBO_RECORD.map((c,i)=>{
                                    const won = c.result==='W';
                                    return (
                                        <div className="panel" key={i} style={{ borderColor: won?'rgba(39,215,150,.4)':'rgba(255,107,94,.4)', overflow:'hidden' }}>
                                            <div className="combo__head" style={{ borderBottom:'1px solid var(--line)' }}>
                                                <div>
                                                    <div style={{ fontFamily:'var(--font-mono)', fontSize:'.66rem', color:'var(--muted)', letterSpacing:'.1em' }}>{c.date}</div>
                                                    <div style={{ fontFamily:'var(--font-head)', fontWeight:800, fontSize:'1.05rem' }}>{c.name}</div>
                                                </div>
                                                <span className={'res-pill ' + (won?'w':'l')}>{won?t.resW:t.resL}</span>
                                            </div>
                                            <div style={{ padding:'4px 16px' }}>
                                                {(c.legs||[]).map((l,j)=>(
                                                    <div key={j} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:10, padding:'9px 0', borderBottom: j<c.legs.length-1?'1px solid var(--line)':'none' }}>
                                                        <div style={{ minWidth:0 }}>
                                                            <div style={{ fontFamily:'var(--font-head)', fontWeight:700, fontSize:'.88rem', color: l.win?'var(--text)':'var(--muted)', textDecoration: l.win?'none':'line-through' }}>{l.pick}</div>
                                                            <div style={{ fontFamily:'var(--font-mono)', fontSize:'.66rem', color:'var(--muted)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{l.match}</div>
                                                        </div>
                                                        <span style={{ fontFamily:'var(--font-mono)', fontWeight:700, fontSize:'.82rem', color: l.win?'var(--green)':'var(--red)' }}>{l.win?'✓':'✗'} {((+l.odd)||0).toFixed(2)}</span>
                                                    </div>
                                                ))}
                                            </div>
                                            <div className="combo__foot">
                                                <span style={{ fontFamily:'var(--font-mono)', fontSize:'.72rem', color:'var(--muted)' }}>{t.comboTotal}</span>
                                                <span style={{ fontFamily:'var(--font-head)', fontWeight:800, fontSize:'1.1rem', color: won?'var(--green)':'var(--red)' }}>{((+c.totalOdd)||0).toFixed(2)}</span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    <div className="disclaimer" style={{ marginTop:22 }}><b>{t.discTitle}</b> {t.disc}</div>
                </div>
            </section>
            <Footer t={t} go={go} />
        </main>
    );
}

function How({ t, go }) {
    const steps = [
        [t.step1T, t.step1D, Icon.book],
        [t.step2T, t.step2D, Icon.target],
        [t.step3T, t.step3D, Icon.bolt],
        [t.step4T, t.step4D, Icon.book],
    ];
    return (
        <main>
            <section className="section">
                <div className="wrap">
                    <span className="eyebrow"><span className="dot" />{t.navHow}</span>
                    <h2 className="section__title" style={{ marginBottom:8 }}>{t.howTitle}</h2>
                    <p style={{ color:'var(--text-2)', maxWidth:620, lineHeight:1.6, marginBottom:26 }}>{t.howLead}</p>

                    <div className="grid grid--2" style={{ marginBottom:26 }}>
                        {steps.map(([h,d,Ic],i)=>(
                            <div className="panel panel--pad" key={i}>
                                <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:10 }}>
                                    <span style={{ width:38, height:38, borderRadius:10, background:'rgba(246,196,67,.14)', display:'grid', placeItems:'center', color:'var(--lime)' }}>{Ic({ style:{width:19,height:19} })}</span>
                                    <span className="mono" style={{ fontSize:'1.6rem', color:'var(--lime)', fontFamily:'var(--font-display)' }}>0{i+1}</span>
                                </div>
                                <h3 style={{ fontFamily:'var(--font-head)', fontWeight:800, margin:'0 0 8px', fontSize:'1.15rem' }}>{h}</h3>
                                <p style={{ color:'var(--text-2)', lineHeight:1.6, margin:0, fontSize:'.92rem' }}>{d}</p>
                            </div>
                        ))}
                    </div>

                    <div className="panel panel--pad" style={{ background:'linear-gradient(160deg, var(--surface) 0%, rgba(246,196,67,.06) 100%)', borderColor:'rgba(246,196,67,.3)' }}>
                        <div style={{ display:'flex', alignItems:'center', gap:14, flexWrap:'wrap' }}>
                            <span style={{ width:46, height:46, borderRadius:12, background:'var(--lime)', display:'grid', placeItems:'center', color:'#0b0e17' }}>{Icon.bolt({ style:{width:24,height:24} })}</span>
                            <div style={{ flex:1, minWidth:240 }}>
                                <h3 style={{ fontFamily:'var(--font-head)', fontWeight:800, margin:'0 0 4px', fontSize:'1.3rem' }}>{t.autoTitle}</h3>
                                <p style={{ color:'var(--text-2)', lineHeight:1.55, margin:0 }}>{t.autoD}</p>
                            </div>
                        </div>
                    </div>

                    <button className="btn btn--lime" style={{ marginTop:24 }} onClick={()=>go({view:'value'})}>{t.heroCta1} {Icon.arrow({ style:{width:17,height:17} })}</button>
                    <div className="disclaimer" style={{ marginTop:24 }}><b>{t.discTitle}</b> {t.disc}</div>
                </div>
            </section>
            <Footer t={t} go={go} />
        </main>
    );
}

Object.assign(window, { Premium, Record, How, ComboCard, EquityCurve, Arbitrage });

/* ============================================================
   ARBITRAJES / SUREBETS
   ============================================================ */
function Arbitrage({ t, go, lang }) {
    const [stake, setStake] = useState(() => { try { return +localStorage.getItem('mv_arb_stake') || 100; } catch(e){ return 100; } });
    useEffect(() => { try { localStorage.setItem('mv_arb_stake', stake); } catch(e){} }, [stake]);

    const all = window.findArbs ? window.findArbs() : [];
    const arbs = all.filter(a => a.hasArb);
    const near = all.filter(a => !a.hasArb).slice(0, 6);
    const total = Math.max(1, +stake || 0);

    const ArbCard = ({ a, isArb }) => {
        const home = teamById(a.m.home), away = teamById(a.m.away);
        const split = window.arbSplit(a.legs, total);
        const ret = window.arbReturn(a.legs, total);
        const profit = ret - total;
        return (
            <div className="panel" style={{ overflow:'hidden', borderColor: isArb ? 'rgba(39,215,150,.45)' : 'var(--line)' }}>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:12, padding:'14px 16px', borderBottom:'1px solid var(--line)', cursor:'pointer' }} onClick={()=>go({view:'match', id:a.m.id})}>
                    <div style={{ display:'flex', alignItems:'center', gap:10, minWidth:0 }}>
                        <span style={{ display:'inline-flex' }}><Crest id={a.m.home} size={28} /><span style={{ marginLeft:-9 }}><Crest id={a.m.away} size={28} /></span></span>
                        <div style={{ minWidth:0 }}>
                            <div style={{ fontFamily:'var(--font-mono)', fontSize:'.62rem', color:'var(--muted)', letterSpacing:'.1em', textTransform:'uppercase' }}>{a.m.group} · {a.m.time}</div>
                            <div style={{ fontFamily:'var(--font-head)', fontWeight:800, fontSize:'1.05rem', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{home.code} <span style={{ color:'var(--muted)' }}>v</span> {away.code}</div>
                        </div>
                    </div>
                    <span style={{ fontFamily:'var(--font-mono)', fontWeight:700, fontSize:'.78rem', padding:'5px 10px', borderRadius:8, whiteSpace:'nowrap',
                        background: isArb ? 'rgba(39,215,150,.13)' : 'rgba(255,255,255,.04)',
                        color: isArb ? 'var(--green)' : 'var(--muted)',
                        border: '1px solid ' + (isArb ? 'rgba(39,215,150,.4)' : 'var(--line)') }}>
                        {a.marginPct >= 0 ? '+' : ''}{a.marginPct.toFixed(2)}%
                    </span>
                </div>

                <div style={{ padding:'4px 16px' }}>
                    {split.map((l,i) => (
                        <div key={i} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:10, padding:'11px 0', borderBottom: i<split.length-1?'1px solid var(--line)':'none' }}>
                            <div style={{ minWidth:0, flex:1 }}>
                                <div style={{ fontFamily:'var(--font-head)', fontWeight:700, fontSize:'.9rem', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{window.outcomeLabel(l.k, a.m, lang)}</div>
                                <div style={{ display:'flex', alignItems:'center', gap:6, marginTop:3 }}>
                                    <span style={{ fontFamily:'var(--font-mono)', fontSize:'.66rem', color:'var(--muted)' }}>{t.arbAt}</span>
                                    <Book id={l.book} size={18} />
                                    {l.suspicious && <span title={t.arbSuspect} style={{ color:'#ffb01f', fontSize:'.8rem' }}>⚠</span>}
                                </div>
                            </div>
                            <div style={{ textAlign:'right', whiteSpace:'nowrap' }}>
                                <div style={{ fontFamily:'var(--font-mono)', fontWeight:700, fontSize:'.95rem', color:'var(--text)' }}>{l.price.toFixed(2)}</div>
                                <div style={{ fontFamily:'var(--font-mono)', fontSize:'.7rem', color:'var(--lime)', marginTop:2 }}>{t.arbStake} {l.stake.toFixed(2)}€</div>
                            </div>
                        </div>
                    ))}
                </div>

                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:10, padding:'12px 16px', background:'rgba(255,255,255,.02)', borderTop:'1px solid var(--line)' }}>
                    <div>
                        <div style={{ fontFamily:'var(--font-mono)', fontSize:'.62rem', color:'var(--muted)', letterSpacing:'.08em', textTransform:'uppercase' }}>{t.arbReturnsAll}</div>
                        <div style={{ fontFamily:'var(--font-head)', fontWeight:800, fontSize:'1.05rem' }}>{ret.toFixed(2)}€</div>
                    </div>
                    <div style={{ textAlign:'right' }}>
                        <div style={{ fontFamily:'var(--font-mono)', fontSize:'.62rem', color:'var(--muted)', letterSpacing:'.08em', textTransform:'uppercase' }}>{t.arbProfit}</div>
                        <div style={{ fontFamily:'var(--font-head)', fontWeight:800, fontSize:'1.15rem', color: profit > 0 ? 'var(--green)' : 'var(--red)' }}>{profit >= 0 ? '+' : ''}{profit.toFixed(2)}€</div>
                    </div>
                </div>
                {!isArb && <div style={{ padding:'8px 16px', fontFamily:'var(--font-mono)', fontSize:'.66rem', color:'var(--muted)', background:'rgba(255,255,255,.02)' }}>{t.arbNearTag}</div>}
            </div>
        );
    };

    return (
        <main>
            <section className="section">
                <div className="wrap">
                    <div className="section__head">
                        <div>
                            <span className="eyebrow"><span className="dot" />{t.arbEyebrow}</span>
                            <h2 className="section__title">{t.arbTitle}</h2>
                        </div>
                        {arbs.length > 0 && <span className="tag tag--lime">{arbs.length} {t.arbFound}</span>}
                    </div>
                    <p style={{ color:'var(--text-2)', maxWidth:680, margin:'-8px 0 20px', lineHeight:1.6 }}>{t.arbLead}</p>

                    {/* stake control */}
                    <div className="panel panel--pad" style={{ display:'flex', alignItems:'center', gap:14, flexWrap:'wrap', marginBottom:24 }}>
                        <label style={{ fontFamily:'var(--font-mono)', fontSize:'.66rem', letterSpacing:'.1em', textTransform:'uppercase', color:'var(--muted)' }}>{t.arbStakeLabel}</label>
                        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                            <input type="number" min="1" value={stake} onChange={e=>setStake(e.target.value)}
                                style={{ width:120, background:'var(--bg)', border:'1px solid var(--line)', color:'var(--text)', borderRadius:9, padding:'10px 12px', fontFamily:'var(--font-mono)', fontSize:'1rem', fontWeight:700 }} />
                            <span style={{ fontFamily:'var(--font-head)', fontWeight:800, fontSize:'1.1rem', color:'var(--muted)' }}>€</span>
                        </div>
                        <div style={{ display:'flex', gap:7 }}>
                            {[50,100,250,500].map(v => (
                                <button key={v} onClick={()=>setStake(v)} style={{ cursor:'pointer', background: +stake===v ? 'var(--lime)' : 'rgba(255,255,255,.04)', color: +stake===v ? '#0b0e17' : 'var(--text-2)', border:'1px solid ' + (+stake===v ? 'var(--lime)' : 'var(--line)'), borderRadius:8, padding:'8px 12px', fontFamily:'var(--font-mono)', fontWeight:700, fontSize:'.8rem' }}>{v}€</button>
                            ))}
                        </div>
                    </div>

                    {arbs.length > 0 ? (
                        <div className="grid grid--3">{arbs.map(a => <ArbCard key={a.m.id} a={a} isArb />)}</div>
                    ) : (
                        <div className="panel panel--pad" style={{ textAlign:'center', padding:'34px 22px', marginBottom:26 }}>
                            <div style={{ fontFamily:'var(--font-head)', fontWeight:800, fontSize:'1.15rem', marginBottom:6 }}>{t.arbNone}</div>
                            <div style={{ color:'var(--text-2)', fontSize:'.9rem', lineHeight:1.55, maxWidth:520, margin:'0 auto' }}>{t.arbNoneLead}</div>
                        </div>
                    )}

                    {near.length > 0 && (
                        <div style={{ marginTop:30 }}>
                            <span className="eyebrow muted"><span className="dot" />{t.arbNear}</span>
                            <div className="grid grid--3" style={{ marginTop:14 }}>{near.map(a => <ArbCard key={a.m.id} a={a} isArb={false} />)}</div>
                        </div>
                    )}

                    <div className="disclaimer" style={{ marginTop:24 }}><b>{t.discTitle}</b> {t.arbDisc}</div>
                </div>
            </section>
            <Footer t={t} go={go} />
        </main>
    );
}
