/* ============================================================
   MUNDIAL VALUE — views part 1: Home, ValueBoard, Match
   ============================================================ */

function pitchBg(stroke) {
    const s = encodeURIComponent(
        `<svg xmlns='http://www.w3.org/2000/svg' width='600' height='400' viewBox='0 0 600 400'>
        <g fill='none' stroke='${stroke}' stroke-width='2'>
        <rect x='20' y='20' width='560' height='360'/>
        <line x1='300' y1='20' x2='300' y2='380'/>
        <circle cx='300' cy='200' r='60'/>
        <rect x='20' y='110' width='90' height='180'/>
        <rect x='490' y='110' width='90' height='180'/>
        <rect x='20' y='155' width='35' height='90'/>
        <rect x='545' y='155' width='35' height='90'/>
        <path d='M110 150 A 60 60 0 0 1 110 250'/>
        <path d='M490 150 A 60 60 0 0 0 490 250'/>
        </g></svg>`
    );
    return `url("data:image/svg+xml,${s}")`;
}

/* rank line: FIFA rank for national teams, league + Elo for clubs */
function teamRank(tm){ return (tm.elo != null) ? (tm.conf || 'Club') : ('FIFA #' + tm.fifa); }

/* value match card */
function ValueCard({ m, t, go, lang }) {
    const home = teamById(m.home), away = teamById(m.away);
    const v = window.matchValue(m);
    const pickLabel = window.outcomeLabel(v.pick.k, m, lang);
    return (
        <div className="vcard" onClick={()=>go({ view:'match', id:m.id })}>
            <div className="vcard__top">
                <span className="vcard__meta">{m.group}</span>
                <span className="vb-time">{m.time}</span>
            </div>
            <div className="vc-team">
                <Flag team={home} /><span className="vc-team__name">{home.name}</span>
                <span className="vc-team__rec">{teamRank(home)}</span>
            </div>
            <div className="vc-team">
                <Flag team={away} /><span className="vc-team__name">{away.name}</span>
                <span className="vc-team__rec">{teamRank(away)}</span>
            </div>
            <Odds3 m={m} t={t} pickKey={v.pick.k} />
            <div className="vcard__foot">
                <span className="vpick">
                    {v.positive
                        ? <React.Fragment>{t.pick}: <b>{pickLabel}</b> · {t.bestAt} {bookById(v.pick.best.book).name}</React.Fragment>
                        : t.noValue}
                </span>
                {v.positive ? <ValueTag edge={v.edge} hot={v.hot} /> : <span className="value value--neg">{t.noValue}</span>}
            </div>
        </div>
    );
}

/* ---------- HOME ---------- */
function Home({ t, go, lang }) {
    const ranked = window.MATCHES.map(m => ({ m, v: window.matchValue(m) })).sort((a,b)=>b.v.edge - a.v.edge);
    const top = ranked.slice(0,3).map(x=>x.m);
    const valueCount = ranked.filter(x=>x.v.positive).length;
    const rec = window.recordSummary();
    return (
        <main>
            <section className="hero">
                <div className="hero__court" style={{ backgroundImage: pitchBg('rgba(246,196,67,.9)') }} />
                <div className="hero__glow" />
                <div className="hero__inner">
                    <div style={{ display:'flex', gap:12, flexWrap:'wrap', alignItems:'center', marginBottom:4 }}>
                        <span className="eyebrow"><span className="dot" />{t.heroEyebrow}</span>
                        <LiveChip t={t} />
                    </div>
                    <h1>{t.heroTitle1}<br /><span className="lime">{t.heroTitle2}</span></h1>
                    <p className="hero__lead">{t.heroLead}</p>
                    <div className="hero__cta">
                        <button className="btn btn--lime" onClick={()=>go({view:'value'})}>{t.heroCta1} {Icon.arrow({ style:{width:17,height:17} })}</button>
                        <button className="btn btn--ghost" onClick={()=>go({view:'how'})}>{t.heroCta2}</button>
                    </div>
                    <div className="hero__stats">
                        <div className="hero__stat"><div className="n">{window.MATCHES.length}</div><div className="l">{t.statMatches}</div></div>
                        <div className="hero__stat"><div className="n">{Object.keys(window.BOOKS).length}</div><div className="l">{t.statBooks}</div></div>
                        <div className="hero__stat"><div className="n"><span className="lime">{valueCount}</span></div><div className="l">{t.statValue}</div></div>
                        <div className="hero__stat"><div className="n"><span className="lime">+{rec.roi}%</span></div><div className="l">{t.statRoi}</div></div>
                    </div>
                </div>
            </section>

            <section className="section">
                <div className="wrap">
                    <div className="section__head">
                        <div>
                            <span className="eyebrow"><span className="dot" />{t.boardEyebrow}</span>
                            <h2 className="section__title">{t.todayTitle}</h2>
                        </div>
                        <a className="section__link" href="#" onClick={(e)=>{e.preventDefault(); go({view:'value'});}}>{t.todayLink} {Icon.arrow({ style:{width:14,height:14} })}</a>
                    </div>
                    <div className="grid grid--3">{top.map(m => <ValueCard key={m.id} m={m} t={t} go={go} lang={lang} />)}</div>
                </div>
            </section>

            {/* record teaser + premium teaser */}
            <section className="section" style={{ paddingTop:0 }}>
                <div className="wrap">
                    <div className="grid grid--main">
                        <div className="panel panel--pad">
                            <div className="section__head" style={{ marginBottom:18 }}>
                                <div><span className="eyebrow muted"><span className="dot" />{t.recordEyebrow}</span><h3 className="section__title" style={{ fontSize:'1.3rem' }}>{t.recordTitle}</h3></div>
                                <a className="section__link" href="#" onClick={(e)=>{e.preventDefault(); go({view:'record'});}}>{t.navRecord} {Icon.arrow({ style:{width:13,height:13} })}</a>
                            </div>
                            <div className="rec-stats" style={{ marginBottom:0 }}>
                                <div className="rec-stat"><div className="rec-stat__l">{t.roi}</div><div className="rec-stat__v pos">+{rec.roi}%</div></div>
                                <div className="rec-stat"><div className="rec-stat__l">{t.profit}</div><div className="rec-stat__v pos">+{rec.profit}{t.units}</div></div>
                                <div className="rec-stat"><div className="rec-stat__l">{t.winRate}</div><div className="rec-stat__v">{rec.winRate}%</div></div>
                                <div className="rec-stat"><div className="rec-stat__l">{t.totalPicks}</div><div className="rec-stat__v">{rec.picks}</div></div>
                            </div>
                        </div>
                        <div className="panel panel--pad" style={{ display:'flex', flexDirection:'column', justifyContent:'space-between', background:'linear-gradient(160deg, var(--surface) 0%, rgba(246,196,67,.05) 100%)' }}>
                            <div>
                                <span className="eyebrow"><span className="dot" />{t.comboOfDay}</span>
                                <h3 className="section__title" style={{ fontSize:'1.4rem', margin:'10px 0' }}>{t.comboTitle}</h3>
                                <p style={{ color:'var(--text-2)', fontSize:'.92rem', lineHeight:1.55, margin:0 }}>{t.priceAllDesc}</p>
                            </div>
                            <button className="btn btn--lime" style={{ marginTop:18, alignSelf:'flex-start' }} onClick={()=>go({view:'premium'})}>{t.goPremium} {Icon.arrow({ style:{width:16,height:16} })}</button>
                        </div>
                    </div>
                </div>
            </section>
            <Footer t={t} go={go} />
        </main>
    );
}

/* ---------- VALUE BOARD ---------- */
function ValueBoard({ t, go, lang }) {
    const all = window.MATCHES.map(m => ({ m, v: window.matchValue(m) }));
    const withValue = all.filter(x => x.v.positive).sort((a,b)=>b.v.edge - a.v.edge);
    const rest = all.filter(x => !x.v.positive).sort((a,b)=>b.v.pick.modelP - a.v.pick.modelP);
    return (
        <main>
            <section className="section">
                <div className="wrap">
                    <div className="section__head">
                        <div>
                            <div style={{ display:'flex', gap:12, flexWrap:'wrap', alignItems:'center' }}>
                                <span className="eyebrow"><span className="dot" />{t.boardEyebrow}</span><LiveChip t={t} />
                            </div>
                            <h2 className="section__title">{t.boardTitle}</h2>
                        </div>
                        <span className="tag tag--lime">{withValue.length} {t.withValueCount}</span>
                    </div>
                    <p style={{ color:'var(--text-2)', maxWidth:660, margin:'-8px 0 22px', lineHeight:1.6 }}>{t.boardLead}</p>

                    {withValue.length > 0 ? (
                        <div className="grid grid--3">
                            {withValue.map(({m}) => <ValueCard key={m.id} m={m} t={t} go={go} lang={lang} />)}
                        </div>
                    ) : (
                        <div className="panel panel--pad" style={{ textAlign:'center', padding:'42px 22px' }}>
                            <div style={{ fontFamily:'var(--font-head)', fontWeight:800, fontSize:'1.2rem', marginBottom:6 }}>{t.noValueTitle}</div>
                            <div style={{ color:'var(--text-2)', fontSize:'.92rem' }}>{t.noValueLead}</div>
                        </div>
                    )}

                    {/* secondary: all analysed matches (transparency) */}
                    <div className="section__head" style={{ marginTop:38 }}>
                        <div><span className="eyebrow muted"><span className="dot" />{t.allAnalysed}</span></div>
                    </div>
                    <div className="panel">
                        <div className="vboard-scroll">
                        <table className="vboard">
                            <thead><tr>
                                <th className="l">{t.thMatch}</th><th>{t.thTime}</th>
                                <th>{t.thPick}</th><th>{t.thModel}</th><th>{t.thBest}</th><th>{t.thBook}</th><th>{t.thEdge}</th>
                            </tr></thead>
                            <tbody>
                                {[...withValue, ...rest].map(({m,v}) => {
                                    const home=teamById(m.home), away=teamById(m.away);
                                    const pickLabel = window.outcomeLabel(v.pick.k, m, lang);
                                    return (
                                        <tr key={m.id} onClick={()=>go({view:'match', id:m.id})} style={v.positive ? { background:'rgba(246,196,67,.05)' } : null}>
                                            <td className="l"><span className="vb-match">{home.code} <span className="vs">{t.vs}</span> {away.code}</span><div className="vb-time" style={{ marginTop:2 }}>{m.group}</div></td>
                                            <td><span className="vb-time">{m.time}</span></td>
                                            <td className="l"><span style={{ fontFamily:'var(--font-head)', fontWeight: v.positive?700:500, color: v.positive ? 'var(--lime)' : 'var(--text-2)' }}>{pickLabel}</span></td>
                                            <td style={{ color: v.positive ? 'var(--lime)' : 'var(--muted)' }}>{Math.round(v.pick.modelP*100)}%</td>
                                            <td><b style={{ color: v.positive ? 'var(--text)' : 'var(--text-2)' }}>{v.pick.best.price.toFixed(2)}</b></td>
                                            <td><Book id={v.pick.best.book} showName={false} size={22} /></td>
                                            <td><ValueTag edge={v.edge} hot={v.hot} small muted={!v.positive} /></td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                        </div>
                    </div>
                </div>
            </section>
            <Footer t={t} go={go} />
        </main>
    );
}

/* ---------- MATCH PAGE ---------- */
function MatchPage({ t, go, id, lang }) {
    const m = window.MATCHES.find(x=>x.id===id) || window.MATCHES[0];
    const home=teamById(m.home), away=teamById(m.away);
    const v = window.matchValue(m);
    const mdl = (m.model && typeof m.model.home === 'number') ? m.model : window.marketProbs(m);
    // only the books that actually quote THIS match (a feed match may carry a subset)
    const books = Array.from(new Set([
        ...Object.keys(m.odds.home||{}), ...Object.keys(m.odds.draw||{}), ...Object.keys(m.odds.away||{})
    ]));

    return (
        <main>
            <section className="match-hero">
                <div className="match-hero__inner">
                    <span className="eyebrow"><span className="dot" />{m.group} · {m.time}</span>
                    <div className="mh-teams">
                        <div className="mh-team">
                            <span className="mh-team__crest" style={{ background:home.color, color:pickInk(home.color), border: home.color==='#ffffff'?'1px solid var(--line)':'none' }}>{home.code}</span>
                            <div><div className="mh-team__name">{home.name}</div><div className="mh-team__rec">{teamRank(home)}{home.elo==null && home.conf ? ' · ' + home.conf : ''}</div></div>
                        </div>
                        <div className="mh-center">
                            <div className="mh-center__lbl">{t.winProb}</div>
                            <div className="mh-center__proj">{Math.round(mdl.home*100)}<span className="mh-vs"> · </span>{Math.round(mdl.away*100)}</div>
                            <div className="mh-center__lbl" style={{ marginTop:8 }}>{t.drawL} {Math.round(mdl.draw*100)}%</div>
                        </div>
                        <div className="mh-team">
                            <span className="mh-team__crest" style={{ background:away.color, color:pickInk(away.color), border: away.color==='#ffffff'?'1px solid var(--line)':'none' }}>{away.code}</span>
                            <div><div className="mh-team__name">{away.name}</div><div className="mh-team__rec">{teamRank(away)}{away.elo==null && away.conf ? ' · ' + away.conf : ''}</div></div>
                        </div>
                    </div>
                </div>
            </section>

            <section className="section">
                <div className="wrap">
                    <div className="grid grid--main">
                        {/* value picks per outcome */}
                        <div>
                            <span className="eyebrow muted"><span className="dot" />{t.boardEyebrow}</span>
                            <h2 className="section__title" style={{ marginBottom:18 }}>{t.matchAnalysis}</h2>
                            <div className="panel panel--pad">
                                {v.outcomes.map(o => {
                                    const lbl = window.outcomeLabel(o.k, m, lang);
                                    const isPick = o.k === v.pick.k && v.positive;
                                    return (
                                        <div className="oc-row" key={o.k}>
                                            <div>
                                                <div className="oc-name">{lbl} {isPick && <span className="tag tag--lime" style={{ marginLeft:8 }}>{t.pick}</span>}</div>
                                                <div className="oc-sub">{t.model} {Math.round(o.modelP*100)}% · {t.market} {Math.round(o.mktP*100)}% · {bookById(o.best.book).name}</div>
                                            </div>
                                            <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                                                <ValueTag edge={o.edge} hot={o.k===v.pick.k && v.hot} small />
                                                <span style={{ fontFamily:'var(--font-mono)', fontWeight:700, fontSize:'1.15rem', color:isPick?'var(--lime)':'var(--text)', minWidth:52, textAlign:'right' }}>{o.best.price.toFixed(2)}</span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                            <div className="panel panel--pad" style={{ marginTop:16 }}>
                                <span className="eyebrow muted"><span className="dot" />{t.modelBreakdown}</span>
                                {(!m.model || m.model.fromMarket) ? (
                                    <p style={{ color:'var(--text-2)', fontSize:'.88rem', lineHeight:1.55, margin:'12px 0 4px' }}>{t.mdMarketOnly}</p>
                                ) : (
                                <div className="grid grid--2" style={{ marginTop:14, marginBottom:6 }}>
                                    {[home, away].map((tm, idx) => {
                                        const lam = idx === 0 ? m.model.lambdaH : m.model.lambdaA;
                                        const rat = idx === 0 ? m.model.ratingH : m.model.ratingA;
                                        return (
                                            <div key={tm.id} className="panel" style={{ background:'var(--surface-2)', padding:'14px 16px' }}>
                                                <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:8 }}>
                                                    <Flag team={tm} size={24} radius={6} /><span style={{ fontFamily:'var(--font-head)', fontWeight:700 }}>{tm.name}</span>
                                                </div>
                                                <div className="kv"><span className="kv__k">{t.mdRating}</span><span className="kv__v">{Math.round(rat)}</span></div>
                                                <div className="kv"><span className="kv__k">{t.mdXg}</span><span className="kv__v" style={{ color:'var(--lime)' }}>{lam.toFixed(2)}</span></div>
                                                <div className="kv" style={{ borderBottom:'none' }}>
                                                    <span className="kv__k">{t.mdForm}</span>
                                                    <span className="form-pills">{tm.form.split('').map((f,i)=>(<span key={i} className={'fp ' + (f==='W'?'w':f==='D'?'p':'l')}>{f}</span>))}</span>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                                )}
                                <div style={{ fontFamily:'var(--font-mono)', fontSize:'.66rem', color:'var(--muted)', letterSpacing:'.04em', marginTop:8 }}>{(!m.model || m.model.fromMarket) ? t.mdMethodMarket : t.mdMethod}</div>
                            </div>
                            <div className="disclaimer" style={{ marginTop:18 }}><b>{t.discTitle}</b> {t.disc}</div>
                        </div>

                        {/* price comparison: all books */}
                        <div className="panel">
                            <div className="panel__head">
                                <span className="panel__title">{t.priceCompare}</span>
                            </div>
                            <div className="panel--pad" style={{ paddingTop:14, paddingBottom:6 }}>
                                <p style={{ color:'var(--text-2)', fontSize:'.84rem', lineHeight:1.5, margin:'0 0 6px' }}>{t.priceLead}</p>
                            </div>
                            <div className="ptable-scroll" style={{ padding:'0 6px 10px' }}>
                            <table className="ptable">
                                <thead><tr>
                                    <th className="l">{t.colBook}</th><th>{t.home}</th><th>{t.draw}</th><th>{t.away}</th>
                                </tr></thead>
                                <tbody>
                                    {books.map(bk => {
                                        const bestH = window.bestPrice(m.odds.home).book;
                                        const bestD = window.bestPrice(m.odds.draw).book;
                                        const bestA = window.bestPrice(m.odds.away).book;
                                        return (
                                            <tr key={bk}>
                                                <td className="l"><Book id={bk} size={20} /></td>
                                                <td><span className={'pcell' + (bk===bestH?' best':'')}>{m.odds.home[bk]!=null?m.odds.home[bk].toFixed(2):'—'}</span></td>
                                                <td><span className={'pcell' + (bk===bestD?' best':'')}>{m.odds.draw[bk]!=null?m.odds.draw[bk].toFixed(2):'—'}</span></td>
                                                <td><span className={'pcell' + (bk===bestA?' best':'')}>{m.odds.away[bk]!=null?m.odds.away[bk].toFixed(2):'—'}</span></td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                            </div>
                        </div>
                    </div>
                </div>
            </section>
            <Footer t={t} go={go} />
        </main>
    );
}

Object.assign(window, { Home, ValueBoard, MatchPage, ValueCard, pitchBg });
