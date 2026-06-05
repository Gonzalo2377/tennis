/* ACEVALUE — views (tennis) */

/* ============================================================ HOME */
function Home({ t, go }) {
  const all = window.MATCHES.map(m=>({m,v:window.matchValue(m)}));
  const top = all.filter(x=>x.v.positive).sort((a,b)=>b.v.edge-a.v.edge).slice(0,3);
  const picks = top.length ? top : all.sort((a,b)=>b.v.edge-a.v.edge).slice(0,3);
  return (
    <main>
      <section className="hero">
        <div className="hero__net" />
        <div className="hero__inner">
          <span className="eyebrow"><span className="dot" />{t.heroEyebrow}</span>
          <h1 style={{marginTop:14}}>{t.heroTitle1} <span className="court">{t.heroTitle2}</span></h1>
          <p className="hero__lead">{t.heroLead}</p>
          <div className="hero__cta">
            <button className="btn btn--ink" onClick={()=>go({view:'value'})}>{t.heroCta1} {Icon.arrow({style:{width:16,height:16}})}</button>
            <button className="btn btn--lime" onClick={()=>go({view:'arb'})}>{Icon.scale({style:{width:16,height:16}})} {t.heroCta2}</button>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="wrap">
          <div className="section__head">
            <div><span className="eyebrow"><span className="dot" />{t.valueOfDay}</span><h2 className="section__title">{t.boardTitle}</h2></div>
            <button className="btn btn--ghost btn--sm" onClick={()=>go({view:'value'})}>{t.seeAll} {Icon.arrow({style:{width:14,height:14}})}</button>
          </div>
          <div className="grid grid--3">{picks.map(({m})=><ValueCard key={m.id} m={m} t={t} go={go} />)}</div>
        </div>
      </section>
      <Footer t={t} go={go} />
    </main>
  );
}

/* ============================================================ VALUE CARD */
function ValueCard({ m, t, go }) {
  const home=playerById(m.home), away=playerById(m.away);
  const v=window.matchValue(m);
  const pickName = window.outcomeLabel(v.pick.k, m);
  return (
    <div className="panel" style={{cursor:'pointer'}} onClick={()=>go({view:'match', id:m.id})}>
      <div style={{padding:'16px 18px', borderBottom:'1px solid var(--line)', display:'flex', justifyContent:'space-between', alignItems:'center', gap:10}}>
        <div style={{display:'flex', alignItems:'center', gap:11, minWidth:0}}>
          <span style={{display:'inline-flex'}}><Avatar id={m.home} size={34} badge={false} /><span style={{marginLeft:-10}}><Avatar id={m.away} size={34} badge={false} /></span></span>
          <div style={{minWidth:0}}>
            <div className="vb-sub">{m.event}{m.round?(' · '+m.round):''}</div>
            <div style={{fontFamily:'var(--font-head)', fontWeight:700, fontSize:'1rem', marginTop:2, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>{home.name.split(' ').pop()} <span style={{color:'var(--muted)'}}>{t.vs}</span> {away.name.split(' ').pop()}</div>
          </div>
        </div>
        <span className="tag tag--court">{m.day ? m.day+' · '+m.time : m.time}</span>
      </div>
      <div style={{padding:'14px 18px'}}>
        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10}}>
          <span className="vb-sub">{t.thPick}</span>
          {v.positive ? <ValueTag edge={v.edge} hot={v.hot} small /> : <span className="value value--muted" style={{fontSize:'.74rem'}}>—</span>}
        </div>
        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
          <div>
            <div style={{fontFamily:'var(--font-head)', fontWeight:800, fontSize:'1.1rem'}}>{v.positive ? pickName : '—'}</div>
            <div style={{marginTop:6}}><Book id={v.pick.best.book} size={20} /></div>
          </div>
          <div style={{textAlign:'right'}}>
            <div style={{fontFamily:'var(--font-head)', fontWeight:800, fontSize:'2rem', lineHeight:1, color:'var(--court)'}}>{v.pick.best.price.toFixed(2)}</div>
            <div className="vb-sub" style={{marginTop:2}}>{Math.round(v.pick.p*100)}% real</div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ============================================================ VALUE BOARD */
function ValueBoard({ t, go }) {
  const all = window.MATCHES.map(m=>({m,v:window.matchValue(m)}));
  const withValue = all.filter(x=>x.v.positive).sort((a,b)=>b.v.edge-a.v.edge);
  const rest = all.filter(x=>!x.v.positive).sort((a,b)=>b.v.pick.p-a.v.pick.p);
  return (
    <main>
      <section className="section">
        <div className="wrap">
          <div className="section__head">
            <div>
              <div style={{display:'flex', gap:12, alignItems:'center', flexWrap:'wrap'}}>
                <span className="eyebrow"><span className="dot" />{t.boardEyebrow}</span><LiveChip t={t} />
              </div>
              <h2 className="section__title">{t.boardTitle}</h2>
            </div>
            <span className="tag tag--lime">{withValue.length} {t.withValueCount}</span>
          </div>
          <p style={{color:'var(--ink-2)', maxWidth:660, margin:'-6px 0 22px', lineHeight:1.6}}>{t.boardLead}</p>

          {withValue.length>0 ? (
            <div className="grid grid--3">{withValue.map(({m})=><ValueCard key={m.id} m={m} t={t} go={go} />)}</div>
          ) : (
            <div className="panel panel--pad" style={{textAlign:'center', padding:'40px 22px'}}>
              <div style={{fontFamily:'var(--font-head)', fontWeight:800, fontSize:'1.2rem', marginBottom:6}}>{t.noValueTitle}</div>
              <div style={{color:'var(--ink-2)'}}>{t.noValueLead}</div>
            </div>
          )}

          <div className="section__head" style={{marginTop:36}}>
            <span className="eyebrow muted"><span className="dot" />{t.allAnalysed}</span>
          </div>
          <div className="panel"><div className="vboard-scroll">
            <table className="vboard">
              <thead><tr>
                <th className="l">{t.thMatch}</th><th>{t.thTime}</th><th className="l">{t.thPick}</th><th>{t.thMarket}</th><th>{t.thBest}</th><th>{t.thBook}</th><th>{t.thEdge}</th>
              </tr></thead>
              <tbody>
                {[...withValue, ...rest].map(({m,v})=>{
                  const h=playerById(m.home), a=playerById(m.away);
                  return (
                    <tr key={m.id} onClick={()=>go({view:'match', id:m.id})}>
                      <td className="l"><span className="vb-match">{h.name.split(' ').pop()} <span style={{color:'var(--muted)'}}>v</span> {a.name.split(' ').pop()}</span><div className="vb-sub" style={{marginTop:2}}>{m.event}</div></td>
                      <td><span className="vb-sub">{m.day ? m.day+' · '+m.time : m.time}</span></td>
                      <td className="l">{v.positive ? <b style={{fontFamily:'var(--font-head)'}}>{window.outcomeLabel(v.pick.k,m)}</b> : <span style={{color:'var(--faint)'}}>—</span>}</td>
                      <td style={{color:'var(--muted)', fontFamily:'var(--font-mono)', fontSize:'.82rem'}}>{Math.round(v.pick.p*100)}%</td>
                      <td><b style={{fontFamily:'var(--font-mono)', color: v.positive?'var(--court)':'var(--muted)'}}>{v.pick.best.price.toFixed(2)}</b></td>
                      <td>{v.positive ? <Book id={v.pick.best.book} showName={false} size={20} /> : <span style={{color:'var(--faint)'}}>—</span>}</td>
                      <td>{v.positive ? <ValueTag edge={v.edge} hot={v.hot} small /> : <span style={{color:'var(--faint)', fontFamily:'var(--font-mono)', fontSize:'.8rem'}}>—</span>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div></div>
          <div className="disclaimer" style={{marginTop:22}}><b>{t.discTitle}</b> {t.disc}</div>
        </div>
      </section>
      <Footer t={t} go={go} />
    </main>
  );
}

/* ============================================================ MATCH PAGE */
function MatchPage({ t, go, id }) {
  const m = window.MATCHES.find(x=>x.id===id) || window.MATCHES[0];
  const home=playerById(m.home), away=playerById(m.away);
  const v=window.matchValue(m), mk=window.marketProbs(m);
  const books = Array.from(new Set([...Object.keys(m.odds.home||{}), ...Object.keys(m.odds.away||{})]));
  const bestH=window.bestPrice(m.odds.home).book, bestA=window.bestPrice(m.odds.away).book;
  return (
    <main>
      <section className="section">
        <div className="wrap">
          <button className="btn btn--ghost btn--sm" style={{marginBottom:18}} onClick={()=>go({view:'value'})}>← {t.navValue}</button>
          <div className="mh">
            <div className="mh__side">
              <Avatar id={m.home} size={76} badge />
              <div className="mh__name">{home.name}</div>
              <div style={{opacity:.8, fontFamily:'var(--font-mono)', fontSize:'.7rem'}}>{home.country}{home.seed?` · #${home.seed}`:''}</div>
              <Form list={home.form} />
            </div>
            <div className="mh__center">
              <div className="mh__proj">{Math.round(mk.home*100)} · {Math.round(mk.away*100)}</div>
              <div className="mh__lbl">{m.surface} · {m.round}</div>
              <div className="mh__lbl" style={{marginTop:6}}>{m.event}</div>
              <div className="mh__lbl" style={{marginTop:4, color:'var(--lime-deep)'}}>{m.day ? m.day+' · '+m.time : m.time}</div>
            </div>
            <div className="mh__side away">
              <Avatar id={m.away} size={76} badge />
              <div className="mh__name">{away.name}</div>
              <div style={{opacity:.8, fontFamily:'var(--font-mono)', fontSize:'.7rem'}}>{away.country}{away.seed?` · #${away.seed}`:''}</div>
              <Form list={away.form} />
            </div>
          </div>

          {/* value picks */}
          <div className="section__head" style={{marginTop:30}}>
            <span className="eyebrow"><span className="dot" />{t.thPick}</span>
          </div>
          <div className="grid grid--2">
            {[['home',home,v.outcomes.find(o=>o.k==='home')],['away',away,v.outcomes.find(o=>o.k==='away')]].map(([side,pl,o])=>(
              <div className="panel panel--pad" key={side} style={{display:'flex', justifyContent:'space-between', alignItems:'center', gap:12, borderColor: (v.positive&&v.pick.k===side)?'var(--lime-deep)':'var(--line)', borderWidth: (v.positive&&v.pick.k===side)?2:1, borderStyle:'solid'}}>
                <div>
                  <div style={{fontFamily:'var(--font-head)', fontWeight:800, fontSize:'1.1rem'}}>{t.heroCta1 && 'Gana '}{pl.name}</div>
                  <div className="vb-sub" style={{marginTop:4}}>{Math.round(o.p*100)}% real · <Book id={o.best.book} showName={true} size={18} /></div>
                </div>
                <div style={{textAlign:'right'}}>
                  <div style={{fontFamily:'var(--font-head)', fontWeight:800, fontSize:'1.8rem', color:'var(--court)'}}>{o.best.price.toFixed(2)}</div>
                  {o.edge>=1.5 ? <ValueTag edge={o.edge} hot={o.edge>=4} small /> : <span className="vb-sub">sin valor</span>}
                </div>
              </div>
            ))}
          </div>

          {/* value breakdown — fair price vs best available */}
          {(() => {
            const vb = window.valueBreakdown(m);
            return (
              <React.Fragment>
                <div className="section__head" style={{marginTop:30}}>
                  <span className="eyebrow"><span className="dot" />{t.vaTitle}</span>
                </div>
                <div className="panel panel--pad">
                  <p style={{color:'var(--ink-2)', fontSize:'.88rem', lineHeight:1.6, margin:'0 0 16px'}}>{t.vaIntro.replace('{src}', vb.sharpFrom)}</p>
                  {vb.rows.map((r,i)=>{
                    const pl = r.k==='home'?home:away;
                    const probPct = Math.round(r.prob*100);
                    return (
                      <div key={r.k} style={{padding:'14px 0', borderTop: i>0?'1px solid var(--line-soft)':'none'}}>
                        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', gap:10, marginBottom:10}}>
                          <div style={{display:'flex', alignItems:'center', gap:10, minWidth:0}}>
                            <Avatar id={r.k==='home'?m.home:m.away} size={32} badge={false} />
                            <span style={{fontFamily:'var(--font-head)', fontWeight:700}}>{pl.name}</span>
                          </div>
                          {r.value
                            ? <ValueTag edge={r.valuePct} hot={r.valuePct>=4} small />
                            : <span className="value value--muted" style={{fontSize:'.74rem'}}>{t.vaNoValue}</span>}
                        </div>
                        {/* probability bar: fair (sharp) prob */}
                        <div style={{height:8, background:'var(--bg-2)', borderRadius:99, overflow:'hidden', marginBottom:8}}>
                          <div style={{width:probPct+'%', height:'100%', background: r.value?'var(--lime)':'var(--court)', borderRadius:99}} />
                        </div>
                        <div style={{display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:8, fontFamily:'var(--font-mono)', fontSize:'.74rem'}}>
                          <div><div style={{color:'var(--muted)', fontSize:'.62rem', textTransform:'uppercase', letterSpacing:'.06em'}}>{t.vaProb}</div><b>{probPct}%</b></div>
                          <div><div style={{color:'var(--muted)', fontSize:'.62rem', textTransform:'uppercase', letterSpacing:'.06em'}}>{t.vaOur}</div><b>{r.fair.toFixed(2)}</b></div>
                          <div><div style={{color:'var(--muted)', fontSize:'.62rem', textTransform:'uppercase', letterSpacing:'.06em'}}>{t.vaAvg}</div><b>{r.avgOdd.toFixed(2)}</b></div>
                          <div><div style={{color:'var(--muted)', fontSize:'.62rem', textTransform:'uppercase', letterSpacing:'.06em'}}>{t.vaBest}</div><b style={{color:'var(--court)'}}>{r.best.price.toFixed(2)}</b></div>
                          <div><div style={{color:'var(--muted)', fontSize:'.62rem', textTransform:'uppercase', letterSpacing:'.06em'}}>{t.thBook}</div><Book id={r.best.book} showName={false} size={18} /></div>
                        </div>
                      </div>
                    );
                  })}
                  <p style={{color:'var(--muted)', fontSize:'.74rem', lineHeight:1.5, margin:'14px 0 0', fontFamily:'var(--font-mono)'}}>{t.vaFoot}</p>
                </div>
              </React.Fragment>
            );
          })()}

          {/* price comparison */}
          <div className="section__head" style={{marginTop:30}}>
            <span className="eyebrow muted"><span className="dot" />{t.thBest} · {books.length} {t.footProduct?'casas':'books'}</span>
          </div>
          <div className="panel"><div className="vboard-scroll">
            <table className="vboard">
              <thead><tr><th className="l">{t.thBook}</th><th>{home.name.split(' ').pop()}</th><th>{away.name.split(' ').pop()}</th></tr></thead>
              <tbody>
                {books.map(bk=>(
                  <tr key={bk} style={{cursor:'default'}}>
                    <td className="l"><Book id={bk} size={20} /></td>
                    <td><span className={'pcell'+(bk===bestH?' best':'')}>{m.odds.home[bk]!=null?m.odds.home[bk].toFixed(2):'—'}</span></td>
                    <td><span className={'pcell'+(bk===bestA?' best':'')}>{m.odds.away[bk]!=null?m.odds.away[bk].toFixed(2):'—'}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div></div>
          <div className="disclaimer" style={{marginTop:22}}><b>{t.discTitle}</b> {t.disc}</div>
        </div>
      </section>
      <Footer t={t} go={go} />
    </main>
  );
}

Object.assign(window, { Home, ValueCard, ValueBoard, MatchPage });
