/* ACEVALUE — views3: Distribuidor de bankroll + Stats Ranking */

/* ============================================================ DISTRIBUIDOR DE BANKROLL */
function Distributor({ t, go }) {
  const [budget, setBudget] = useState(()=>{ try { return +localStorage.getItem('ace_bank')||100; } catch(e){ return 100; } });
  const [risk, setRisk]   = useState(()=>{ try { return localStorage.getItem('ace_risk')||'equilibrado'; } catch(e){ return 'equilibrado'; } });
  const [spread, setSpread] = useState(()=>{ try { return localStorage.getItem('ace_spread')||'equilibrado'; } catch(e){ return 'equilibrado'; } });
  useEffect(()=>{ try{ localStorage.setItem('ace_bank',budget); localStorage.setItem('ace_risk',risk); localStorage.setItem('ace_spread',spread); }catch(e){} },[budget,risk,spread]);

  const plan = window.bankrollPlan(Math.max(1,+budget||0), risk, spread);
  const Seg = ({val,set,opts}) => (
    <div style={{display:'flex', gap:0, border:'1px solid var(--line)', borderRadius:10, overflow:'hidden'}}>
      {opts.map(([k,lbl])=>(
        <button key={k} onClick={()=>set(k)} style={{flex:1, border:'none', padding:'9px 10px', cursor:'pointer',
          background: val===k?'var(--court)':'var(--surface)', color: val===k?'#fff':'var(--ink-2)',
          fontFamily:'var(--font-body)', fontWeight:700, fontSize:'.8rem'}}>{lbl}</button>
      ))}
    </div>
  );

  return (
    <main>
      <section className="section">
        <div className="wrap">
          <div className="section__head">
            <div><span className="eyebrow"><span className="dot" />{t.distEyebrow}</span><h2 className="section__title">{t.distTitle}</h2></div>
          </div>
          <p style={{color:'var(--ink-2)', maxWidth:680, margin:'-6px 0 20px', lineHeight:1.6}}>{t.distLead}</p>

          {/* controles */}
          <div className="panel panel--pad" style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:16, marginBottom:22}}>
            <div>
              <label style={{fontFamily:'var(--font-mono)', fontSize:'.64rem', letterSpacing:'.1em', textTransform:'uppercase', color:'var(--muted)', display:'block', marginBottom:6}}>{t.distBudget}</label>
              <div style={{display:'flex', alignItems:'center', gap:8}}>
                <input type="number" min="1" value={budget} onChange={e=>setBudget(e.target.value)}
                  style={{width:'100%', background:'var(--bg)', border:'1px solid var(--line)', color:'var(--ink)', borderRadius:9, padding:'10px 12px', fontFamily:'var(--font-mono)', fontSize:'1rem', fontWeight:700}} />
                <span style={{fontFamily:'var(--font-head)', fontWeight:800, color:'var(--muted)'}}>€</span>
              </div>
              <div style={{display:'flex', gap:6, marginTop:8}}>
                {[50,100,250,500].map(v=>(
                  <button key={v} onClick={()=>setBudget(v)} style={{flex:1, background:+budget===v?'var(--ink)':'var(--surface)', color:+budget===v?'#fff':'var(--ink-2)', border:'1px solid '+(+budget===v?'var(--ink)':'var(--line)'), borderRadius:7, padding:'6px 0', fontFamily:'var(--font-mono)', fontWeight:700, fontSize:'.72rem', cursor:'pointer'}}>{v}€</button>
                ))}
              </div>
            </div>
            <div>
              <label style={{fontFamily:'var(--font-mono)', fontSize:'.64rem', letterSpacing:'.1em', textTransform:'uppercase', color:'var(--muted)', display:'block', marginBottom:6}}>{t.distRisk}</label>
              <Seg val={risk} set={setRisk} opts={[['conservador',t.distCons],['equilibrado',t.distEq],['arriesgado',t.distAgg]]} />
              <div style={{fontFamily:'var(--font-mono)', fontSize:'.62rem', color:'var(--muted)', marginTop:8, lineHeight:1.4}}>{risk==='conservador'?t.distConsH:risk==='arriesgado'?t.distAggH:t.distEqH}</div>
            </div>
            <div>
              <label style={{fontFamily:'var(--font-mono)', fontSize:'.64rem', letterSpacing:'.1em', textTransform:'uppercase', color:'var(--muted)', display:'block', marginBottom:6}}>{t.distSpread}</label>
              <Seg val={spread} set={setSpread} opts={[['concentrado',t.distConc],['equilibrado',t.distEq],['diversificado',t.distDiv]]} />
              <div style={{fontFamily:'var(--font-mono)', fontSize:'.62rem', color:'var(--muted)', marginTop:8, lineHeight:1.4}}>{t.distSpreadH}</div>
            </div>
          </div>

          {plan.lines.length>0 ? (
            <React.Fragment>
              <div className="panel"><div className="vboard-scroll">
                <table className="vboard">
                  <thead><tr>
                    <th className="l">{t.distPick}</th><th>{t.thBest}</th><th>{t.thBook}</th><th>{t.distStake}</th><th>{t.distRet}</th>
                  </tr></thead>
                  <tbody>
                    {plan.lines.map((l,i)=>(
                      <tr key={i} onClick={()=>go({view:'match', id:l.m.id})}>
                        <td className="l"><b style={{fontFamily:'var(--font-head)'}}>{l.name}</b><div className="vb-sub" style={{marginTop:2}}>{Math.round(l.p*100)}% real · +{l.edge.toFixed(1)}%</div></td>
                        <td><b style={{fontFamily:'var(--font-mono)', color:'var(--court)'}}>{l.odd.toFixed(2)}</b></td>
                        <td><Book id={l.book} showName={false} size={20} /></td>
                        <td><b style={{fontFamily:'var(--font-mono)', fontSize:'1rem'}}>{l.stake.toFixed(2)}€</b></td>
                        <td><span style={{fontFamily:'var(--font-mono)', color:'var(--lime-deep)'}}>{l.ret.toFixed(2)}€</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="combo__foot">
                <span style={{fontFamily:'var(--font-mono)', fontSize:'.74rem', color:'var(--muted)'}}>{t.distAssigned}: <b style={{color:'var(--ink)'}}>{plan.total.toFixed(2)}€</b> / {(+budget).toFixed(0)}€</span>
                <span style={{fontFamily:'var(--font-head)', fontWeight:800, color:'var(--pos)'}}>{t.distEV} +{plan.evTotal.toFixed(2)}€</span>
              </div></div>
              <div className="disclaimer" style={{marginTop:18}}><b>{t.discTitle}</b> {t.distDisc}</div>
            </React.Fragment>
          ) : (
            <div className="panel panel--pad" style={{textAlign:'center', padding:'40px 22px'}}>
              <div style={{fontFamily:'var(--font-head)', fontWeight:800, fontSize:'1.15rem', marginBottom:6}}>{t.distNone}</div>
              <div style={{color:'var(--ink-2)'}}>{t.distNoneH}</div>
            </div>
          )}
        </div>
      </section>
      <Footer t={t} go={go} />
    </main>
  );
}

/* ============================================================ STATS RANKING */
function StatsRanking({ t, go }) {
  const [tour, setTour] = useState('atp');
  const [surf, setSurf] = useState('all');
  const rows = window.statsRanking(tour, surf);
  const Seg = ({val,set,opts}) => (
    <div style={{display:'flex', gap:0, border:'1px solid var(--line)', borderRadius:10, overflow:'hidden'}}>
      {opts.map(([k,lbl])=>(
        <button key={k} onClick={()=>set(k)} style={{border:'none', padding:'8px 13px', cursor:'pointer',
          background: val===k?'var(--court)':'var(--surface)', color: val===k?'#fff':'var(--ink-2)',
          fontFamily:'var(--font-body)', fontWeight:700, fontSize:'.8rem'}}>{lbl}</button>
      ))}
    </div>
  );
  return (
    <main>
      <section className="section">
        <div className="wrap">
          <div className="section__head">
            <div><span className="eyebrow"><span className="dot" />{t.rankEyebrow}</span><h2 className="section__title">{t.rankTitle}</h2></div>
            <div style={{display:'flex', gap:10, flexWrap:'wrap'}}>
              <Seg val={tour} set={setTour} opts={[['atp','ATP'],['wta','WTA']]} />
              <Seg val={surf} set={setSurf} opts={[['all',t.rankAll],['clay','🟧'],['hard','🟦'],['grass','🟩']]} />
            </div>
          </div>
          <p style={{color:'var(--ink-2)', maxWidth:680, margin:'-6px 0 20px', lineHeight:1.6}}>{t.rankLead}</p>
          <div className="panel"><div className="vboard-scroll">
            <table className="vboard">
              <thead><tr><th>#</th><th className="l">{t.rankPlayer}</th><th>{t.rankRating}</th><th>{t.rankForm}</th></tr></thead>
              <tbody>
                {rows.map((p,i)=>(
                  <tr key={p.id} style={{cursor:'default'}}>
                    <td><b style={{fontFamily:'var(--font-mono)', color:i<3?'var(--lime-deep)':'var(--muted)'}}>{i+1}</b></td>
                    <td className="l"><div style={{display:'flex', alignItems:'center', gap:9}}>
                      <Avatar id={p.id} size={28} badge={false} />
                      <span><b style={{fontFamily:'var(--font-head)'}}>{p.name}</b> <span className="vb-sub">{p.country}</span></span>
                    </div></td>
                    <td><b style={{fontFamily:'var(--font-mono)'}}>{p.elo}</b></td>
                    <td><Form list={p.form} /></td>
                  </tr>
                ))}
                {rows.length===0 && <tr><td colSpan="4" style={{textAlign:'center', padding:'30px', color:'var(--muted)'}}>{t.rankNone}</td></tr>}
              </tbody>
            </table>
          </div></div>
          <div className="disclaimer" style={{marginTop:18}}><b>{t.rankNote}</b> {t.rankNoteH}</div>
        </div>
      </section>
      <Footer t={t} go={go} />
    </main>
  );
}

Object.assign(window, { Distributor, StatsRanking });
