/* ACEVALUE — views part 2 (Sin Riesgo, Combinadas, Récord, Cómo) */

/* ============================================================ SIN RIESGO */
function Arbitrage({ t, go }) {
  const [stake, setStake] = useState(()=>{ try { return +localStorage.getItem('ace_arb_stake')||100; } catch(e){ return 100; } });
  useEffect(()=>{ try { localStorage.setItem('ace_arb_stake', stake); } catch(e){} }, [stake]);
  const [mode, setMode] = useState(()=>{ try { return localStorage.getItem('ace_arb_mode')||'even'; } catch(e){ return 'even'; } });
  useEffect(()=>{ try { localStorage.setItem('ace_arb_mode', mode); } catch(e){} }, [mode]);

  const all = window.findArbs();
  const arbs = all.filter(a=>a.hasArb);
  const near = all.filter(a=>!a.hasArb).slice(0,6);
  const total = Math.max(1, +stake||0);

  const ArbCard = ({ a, isArb }) => {
    const home=playerById(a.m.home), away=playerById(a.m.away);
    // favourite = lower odds; default to profiting on the favourite (most likely)
    const favKey = a.legs[0].price <= a.legs[1].price ? a.legs[0].k : a.legs[1].k;
    const [profitKey, setProfitKey] = useState(favKey);
    // mode 'even' = same profit whoever wins · 'cover' = break-even on one side, profit on the chosen one
    let split, evenRet, evenProfit;
    if (mode==='cover') {
      const safeLeg = a.legs.find(l=>l.k!==profitKey) || a.legs[1];
      const stakeSafe = total / safeLeg.price;        // returns exactly `total` → break-even
      const stakeProfit = total - stakeSafe;
      split = a.legs.map(l => { const stake = l.k===profitKey ? stakeProfit : stakeSafe; return { ...l, stake, ret: stake*l.price }; });
    } else {
      split = window.arbSplit(a.legs, total);
      evenRet = window.arbReturn(a.legs, total);
      evenProfit = evenRet - total;
    }
    const profitLeg = split.find(l=>l.k===profitKey) || split[0];
    const coverNet = profitLeg.ret - total;     // profit if the chosen player wins
    const profitName = (profitKey==='home'?home:away).name.split(' ').pop();
    return (
      <div className="panel" style={{borderColor: isArb?'var(--lime-deep)':'var(--line)', borderWidth: isArb?2:1, borderStyle:'solid'}}>
        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', gap:12, padding:'14px 16px', borderBottom:'1px solid var(--line)', cursor:'pointer'}} onClick={()=>go({view:'match', id:a.m.id})}>
          <div style={{minWidth:0}}>
            <div className="vb-sub">{a.m.event} · {a.m.time}</div>
            <div style={{fontFamily:'var(--font-head)', fontWeight:800, fontSize:'1.05rem'}}>{home.name.split(' ').pop()} <span style={{color:'var(--muted)'}}>v</span> {away.name.split(' ').pop()}</div>
          </div>
          <span className="tag" style={{background: isArb?'rgba(174,225,0,.2)':'var(--bg-2)', color: isArb?'var(--lime-deep)':'var(--muted)', border:'1px solid '+(isArb?'rgba(127,168,0,.4)':'var(--line)')}}>{a.marginPct>=0?'+':''}{a.marginPct.toFixed(2)}%</span>
        </div>
        <div style={{padding:'4px 16px'}}>
          {split.map((l,i)=>{
            const net = l.ret - total; const nc = net>0.005?'var(--pos)':net<-0.005?'var(--neg)':'var(--muted)';
            const isProfit = mode==='cover' && l.k===profitKey;
            return (
              <div key={i} style={{display:'flex', justifyContent:'space-between', alignItems:'center', gap:10, padding:'12px 0', borderBottom: i<split.length-1?'1px solid var(--line-soft)':'none'}}>
                <div style={{minWidth:0, display:'flex', alignItems:'center', gap:8}}>
                  {mode==='cover' && <button onClick={()=>setProfitKey(l.k)} title="Respaldar a este jugador" style={{flexShrink:0, width:22, height:22, borderRadius:'50%', border:'2px solid '+(isProfit?'var(--court)':'var(--line)'), background:isProfit?'var(--court)':'transparent', cursor:'pointer', padding:0}} />}
                  <div style={{minWidth:0}}>
                    <div style={{fontFamily:'var(--font-head)', fontWeight:700, fontSize:'.95rem'}}>{window.outcomeLabel(l.k, a.m)}</div>
                    <div style={{display:'flex', alignItems:'center', gap:6, marginTop:4}}>
                      <span className="vb-sub">{t.arbAt}</span><Book id={l.book} size={18} />
                      {l.suspicious && <span title="Cuota muy alta — verifícala" style={{color:'var(--clay)'}}>⚠</span>}
                    </div>
                  </div>
                </div>
                <div style={{textAlign:'right', whiteSpace:'nowrap'}}>
                  <div style={{fontFamily:'var(--font-mono)', fontWeight:700, fontSize:'.95rem'}}>{l.price.toFixed(2)}</div>
                  <div style={{fontFamily:'var(--font-mono)', fontSize:'.72rem', color:'var(--lime-deep)', marginTop:2}}>{t.arbStake} {l.stake.toFixed(2)}€</div>
                  {mode==='cover' && <div style={{fontFamily:'var(--font-mono)', fontSize:'.7rem', color:nc, marginTop:2}}>{t.arbIfWins} {net>=0?'+':''}{net.toFixed(2)}€</div>}
                </div>
              </div>
            );
          })}
        </div>
        {mode==='even' ? (
          <div className="combo__foot">
            <div><div className="vb-sub">{t.arbReturnsAll}</div><div style={{fontFamily:'var(--font-head)', fontWeight:800, fontSize:'1.05rem'}}>{evenRet.toFixed(2)}€</div></div>
            <div style={{textAlign:'right'}}><div className="vb-sub">{t.arbProfit}</div><div style={{fontFamily:'var(--font-head)', fontWeight:800, fontSize:'1.15rem', color: evenProfit>0?'var(--pos)':'var(--neg)'}}>{evenProfit>=0?'+':''}{evenProfit.toFixed(2)}€</div></div>
          </div>
        ) : (
          <div className="combo__foot">
            <div><div className="vb-sub">{t.arbCoverIf} {profitName}</div><div style={{fontFamily:'var(--font-head)', fontWeight:800, fontSize:'1.15rem', color: coverNet>0?'var(--pos)':'var(--neg)'}}>{coverNet>=0?'+':''}{coverNet.toFixed(2)}€</div></div>
            <div style={{textAlign:'right'}}><div className="vb-sub">{t.arbCoverElse}</div><div style={{fontFamily:'var(--font-head)', fontWeight:800, fontSize:'1.05rem', color:'var(--muted)'}}>0,00€</div></div>
          </div>
        )}
        {!isArb && <div style={{padding:'8px 16px', fontFamily:'var(--font-mono)', fontSize:'.66rem', color:'var(--muted)', background:'var(--bg-2)'}}>{t.arbNearTag}</div>}
      </div>
    );
  };

  return (
    <main>
      <section className="section">
        <div className="wrap">
          <div className="section__head">
            <div><span className="eyebrow"><span className="dot" />{t.arbEyebrow}</span><h2 className="section__title">{t.arbTitle}</h2></div>
            {arbs.length>0 && <span className="tag tag--lime">{arbs.length} {t.arbFound}</span>}
          </div>
          <p style={{color:'var(--ink-2)', maxWidth:680, margin:'-6px 0 20px', lineHeight:1.6}}>{t.arbLead}</p>

          <div className="panel panel--pad" style={{display:'flex', alignItems:'center', gap:14, flexWrap:'wrap', marginBottom:24}}>
            <label style={{fontFamily:'var(--font-mono)', fontSize:'.66rem', letterSpacing:'.1em', textTransform:'uppercase', color:'var(--muted)'}}>{t.arbStakeLabel}</label>
            <div style={{display:'flex', alignItems:'center', gap:8}}>
              <input type="number" min="1" value={stake} onChange={e=>setStake(e.target.value)} style={{width:120, background:'var(--bg)', border:'1px solid var(--line)', color:'var(--ink)', borderRadius:9, padding:'10px 12px', fontFamily:'var(--font-mono)', fontSize:'1rem', fontWeight:700}} />
              <span style={{fontFamily:'var(--font-head)', fontWeight:800, fontSize:'1.1rem', color:'var(--muted)'}}>€</span>
            </div>
            <div style={{display:'flex', gap:7}}>
              {[50,100,250,500].map(val=>(
                <button key={val} onClick={()=>setStake(val)} style={{background: +stake===val?'var(--ink)':'var(--surface)', color: +stake===val?'#f3f1ea':'var(--ink-2)', border:'1px solid '+(+stake===val?'var(--ink)':'var(--line)'), borderRadius:8, padding:'8px 12px', fontFamily:'var(--font-mono)', fontWeight:700, fontSize:'.8rem'}}>{val}€</button>
              ))}
            </div>
            <div style={{flex:1}} />
            <div style={{display:'flex', flexDirection:'column', gap:5}}>
              <label style={{fontFamily:'var(--font-mono)', fontSize:'.6rem', letterSpacing:'.1em', textTransform:'uppercase', color:'var(--muted)'}}>{t.arbModeLabel}</label>
              <div style={{display:'flex', gap:0, border:'1px solid var(--line)', borderRadius:9, overflow:'hidden'}}>
                {[['even',t.arbModeEven],['cover',t.arbModeCover]].map(([k,lbl])=>(
                  <button key={k} onClick={()=>setMode(k)} style={{background: mode===k?'var(--court)':'var(--surface)', color: mode===k?'#fff':'var(--ink-2)', border:'none', padding:'8px 14px', fontFamily:'var(--font-mono)', fontWeight:700, fontSize:'.74rem', cursor:'pointer'}}>{lbl}</button>
                ))}
              </div>
            </div>
          </div>
          <p style={{fontFamily:'var(--font-mono)', fontSize:'.72rem', color:'var(--muted)', margin:'-14px 0 22px', lineHeight:1.5}}>{mode==='even'?t.arbModeEvenHint:t.arbModeCoverHint}</p>

          {arbs.length>0 ? (
            <div className="grid grid--3">{arbs.map(a=><ArbCard key={a.m.id} a={a} isArb />)}</div>
          ) : (
            <div className="panel panel--pad" style={{textAlign:'center', padding:'34px 22px', marginBottom:26}}>
              <div style={{fontFamily:'var(--font-head)', fontWeight:800, fontSize:'1.15rem', marginBottom:6}}>{t.arbNone}</div>
              <div style={{color:'var(--ink-2)', maxWidth:520, margin:'0 auto'}}>{t.arbNoneLead}</div>
            </div>
          )}

          {near.length>0 && (
            <div style={{marginTop:30}}>
              <span className="eyebrow muted"><span className="dot" />{t.arbNear}</span>
              <div className="grid grid--3" style={{marginTop:14}}>{near.map(a=><ArbCard key={a.m.id} a={a} isArb={false} />)}</div>
            </div>
          )}
          <div className="disclaimer" style={{marginTop:24}}><b>{t.discTitle}</b> {t.arbDisc}</div>
        </div>
      </section>
      <Footer t={t} go={go} />
    </main>
  );
}

/* ============================================================ COMBINADAS */
function Combos({ t, go }) {
  const combos = window.COMBOS || [];
  return (
    <main>
      <section className="section">
        <div className="wrap">
          <div className="section__head">
            <div><span className="eyebrow"><span className="dot" />{t.comboEyebrow}</span><h2 className="section__title">{t.comboTitle}</h2></div>
          </div>
          <p style={{color:'var(--ink-2)', maxWidth:660, margin:'-6px 0 22px', lineHeight:1.6}}>{t.comboLead}</p>
          <div className="grid grid--2">
            {combos.map(c=>{
              const total = c.legs.reduce((p,l)=>p*l.odd,1);
              return (
                <div className="panel" key={c.id}>
                  <div className="combo__head" style={{borderBottom:'1px solid var(--line)'}}>
                    <div style={{fontFamily:'var(--font-head)', fontWeight:800, fontSize:'1.2rem'}}>{c.name}</div>
                    <span className="tag tag--court">{t.comboConf} {c.conf}%</span>
                  </div>
                  <div style={{padding:'4px 16px'}}>
                    {c.legs.map((l,i)=>(
                      <div key={i} style={{display:'flex', justifyContent:'space-between', alignItems:'center', gap:10, padding:'12px 0', borderBottom: i<c.legs.length-1?'1px solid var(--line-soft)':'none'}}>
                        <div style={{minWidth:0}}>
                          <div style={{fontFamily:'var(--font-head)', fontWeight:700, fontSize:'.95rem'}}>{l.pick}</div>
                          <div style={{display:'flex', alignItems:'center', gap:6, marginTop:4}}><span className="vb-sub">{l.match} · </span><Book id={l.book} size={16} /></div>
                        </div>
                        <span style={{fontFamily:'var(--font-mono)', fontWeight:700, fontSize:'.95rem', color:'var(--court)'}}>{l.odd.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                  <div className="combo__foot">
                    <span style={{fontFamily:'var(--font-mono)', fontSize:'.72rem', color:'var(--muted)'}}>{c.legs.length} {t.comboLegs} · {t.comboTotal}</span>
                    <span style={{fontFamily:'var(--font-head)', fontWeight:800, fontSize:'1.3rem', color:'var(--lime-deep)'}}>{total.toFixed(2)}</span>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="disclaimer" style={{marginTop:24}}><b>{t.discTitle}</b> {t.disc}</div>
        </div>
      </section>
      <Footer t={t} go={go} />
    </main>
  );
}

/* ============================================================ RÉCORD */
function Record({ t, go }) {
  const s = window.recordSummary();
  let cum=0;
  // "en juego" = picks ya registrados por el robot + los picks de valor de HOY del tablero
  // (así siempre se ven los actuales, aunque el robot aún no los haya guardado)
  const settledSig = new Set((window.RECORD||[]).map(r=>`${r.match}|${r.pick||r.pickLabel}`));
  const livePicks = (window.MATCHES||[]).map(m=>({m,v:window.matchValue(m)})).filter(x=>x.v.positive).map(x=>({
      date:'HOY', match:`${window.playerById(x.m.home).name} – ${window.playerById(x.m.away).name}`,
      pickLabel: window.outcomeLabel(x.v.pick.k, x.m), odd:+x.v.pick.best.price.toFixed(2), book:x.v.pick.best.book }));
  const seenPend = new Set();
  const pendingList = [...(window.PENDING||[]), ...livePicks].filter(p=>{
    const sig=`${p.match}|${p.pickLabel||p.pick}`;
    if (settledSig.has(sig) || seenPend.has(sig)) return false;
    seenPend.add(sig); return true;
  });
  return (
    <main>
      <section className="section">
        <div className="wrap">
          <div className="section__head">
            <div><span className="eyebrow"><span className="dot" />{t.recEyebrow}</span><h2 className="section__title">{t.recTitle}</h2></div>
          </div>
          <p style={{color:'var(--ink-2)', maxWidth:660, margin:'-6px 0 22px', lineHeight:1.6}}>{t.recLead}</p>

          <div className="grid grid--3" style={{gridTemplateColumns:'repeat(4,1fr)', marginBottom:26}}>
            <div className="stat"><div className="stat__lbl">{t.stHit}</div><div className="stat__val">{s.hit.toFixed(0)}%</div></div>
            <div className="stat"><div className="stat__lbl">{t.stRoi}</div><div className="stat__val" style={{color: s.roi>=0?'var(--pos)':'var(--neg)'}}>{s.roi>=0?'+':''}{s.roi.toFixed(1)}%</div></div>
            <div className="stat"><div className="stat__lbl">{t.stProfit}</div><div className="stat__val" style={{color: s.profit>=0?'var(--pos)':'var(--neg)'}}>{s.profit>=0?'+':''}{s.profit.toFixed(2)}{t.units}</div></div>
            <div className="stat"><div className="stat__lbl">{t.stPicks}</div><div className="stat__val">{s.n}</div></div>
          </div>

          {pendingList.length>0 && (
            <div style={{marginBottom:26}}>
              <span className="eyebrow"><span className="dot" />{t.pendingTitle}</span>
              <p style={{color:'var(--ink-2)', fontSize:'.9rem', margin:'10px 0 14px', maxWidth:660, lineHeight:1.55}}>{t.pendingLead}</p>
              <div className="panel"><div className="vboard-scroll">
                <table className="vboard">
                  <thead><tr><th>{t.colDate}</th><th className="l">{t.colMatch}</th><th className="l">{t.colPick}</th><th>{t.colOdd}</th><th>{t.colBook}</th><th>{t.colResult}</th></tr></thead>
                  <tbody>
                    {pendingList.map((p,i)=>(
                      <tr key={i} style={{cursor:'default'}}>
                        <td><span className="vb-sub">{p.date}</span></td>
                        <td className="l"><span className="vb-match" style={{fontSize:'.9rem'}}>{p.match}</span></td>
                        <td className="l">{p.pickLabel||p.pick}</td>
                        <td><b style={{fontFamily:'var(--font-mono)'}}>{(p.odd||0).toFixed(2)}</b></td>
                        <td><Book id={p.book} showName={false} size={20} /></td>
                        <td><span className="res-pill" style={{background:'rgba(174,225,0,.18)', color:'var(--lime-deep)', border:'1px solid rgba(127,168,0,.4)'}}>{t.pendingTag}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div></div>
            </div>
          )}

          <div className="panel"><div className="vboard-scroll">
            <table className="vboard">
              <thead><tr><th>{t.colDate}</th><th className="l">{t.colMatch}</th><th className="l">{t.colPick}</th><th>{t.colOdd}</th><th>{t.colBook}</th><th>{t.colResult}</th></tr></thead>
              <tbody>
                {window.RECORD.map((r,i)=>(
                  <tr key={i} style={{cursor:'default'}}>
                    <td><span className="vb-sub">{r.date}</span></td>
                    <td className="l"><span className="vb-match" style={{fontSize:'.9rem'}}>{r.match}</span></td>
                    <td className="l">{r.pick}</td>
                    <td><b style={{fontFamily:'var(--font-mono)'}}>{r.odd.toFixed(2)}</b></td>
                    <td><Book id={r.book} showName={false} size={20} /></td>
                    <td><span className={'res-pill '+(r.result==='W'?'w':'l')}>{r.result==='W'?t.resW:t.resL}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div></div>

          {Array.isArray(window.COMBO_RECORD) && window.COMBO_RECORD.length>0 && (
            <div style={{marginTop:30}}>
              <span className="eyebrow"><span className="dot" />{t.comboRecTitle}</span>
              <p style={{color:'var(--ink-2)', fontSize:'.9rem', margin:'10px 0 16px', maxWidth:660, lineHeight:1.55}}>{t.comboRecLead}</p>
              <div className="grid grid--2">
                {window.COMBO_RECORD.map((c,i)=>{
                  const won=c.result==='W';
                  return (
                    <div className="panel" key={i} style={{borderColor: won?'rgba(31,138,76,.4)':'rgba(210,64,42,.4)', borderWidth:1, borderStyle:'solid'}}>
                      <div className="combo__head" style={{borderBottom:'1px solid var(--line)'}}>
                        <div><div className="vb-sub">{c.date}</div><div style={{fontFamily:'var(--font-head)', fontWeight:800, fontSize:'1.05rem'}}>{c.name}</div></div>
                        <span className={'res-pill '+(won?'w':'l')}>{won?t.resW:t.resL}</span>
                      </div>
                      <div style={{padding:'4px 16px'}}>
                        {c.legs.map((l,j)=>(
                          <div key={j} style={{display:'flex', justifyContent:'space-between', alignItems:'center', gap:10, padding:'10px 0', borderBottom: j<c.legs.length-1?'1px solid var(--line-soft)':'none'}}>
                            <div style={{minWidth:0}}>
                              <div style={{fontFamily:'var(--font-head)', fontWeight:700, fontSize:'.88rem', color: l.win?'var(--ink)':'var(--muted)', textDecoration: l.win?'none':'line-through'}}>{l.pick}</div>
                              <div className="vb-sub">{l.match}</div>
                            </div>
                            <span style={{fontFamily:'var(--font-mono)', fontWeight:700, fontSize:'.82rem', color: l.win?'var(--pos)':'var(--neg)'}}>{l.win?'✓':'✗'} {l.odd.toFixed(2)}</span>
                          </div>
                        ))}
                      </div>
                      <div className="combo__foot">
                        <span style={{fontFamily:'var(--font-mono)', fontSize:'.72rem', color:'var(--muted)'}}>{t.comboTotal}</span>
                        <span style={{fontFamily:'var(--font-head)', fontWeight:800, fontSize:'1.1rem', color: won?'var(--pos)':'var(--neg)'}}>{c.totalOdd.toFixed(2)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {Array.isArray(window.ARB_RECORD) && window.ARB_RECORD.length>0 && (() => { const as=window.arbSummary(); return (
            <div style={{marginTop:30}}>
              <span className="eyebrow"><span className="dot" />{t.arbRecTitle}</span>
              <p style={{color:'var(--ink-2)', fontSize:'.9rem', margin:'10px 0 16px', maxWidth:660, lineHeight:1.55}}>{t.arbRecLead}</p>
              <div className="grid grid--3" style={{marginBottom:16}}>
                <div className="stat"><div className="stat__lbl">{t.arbRecN}</div><div className="stat__val">{as.n}</div></div>
                <div className="stat"><div className="stat__lbl">{t.arbRecProfit}</div><div className="stat__val" style={{color:'var(--pos)'}}>+{as.profit.toFixed(2)}€</div></div>
                <div className="stat"><div className="stat__lbl">{t.arbRecAvg}</div><div className="stat__val" style={{color:'var(--pos)'}}>+{as.avg.toFixed(2)}%</div></div>
              </div>
              <div className="panel"><div className="vboard-scroll">
                <table className="vboard">
                  <thead><tr><th>{t.colDate}</th><th className="l">{t.colMatch}</th><th className="l">{t.colPick}</th><th>{t.arbRecMargin}</th><th>{t.stProfit}</th></tr></thead>
                  <tbody>
                    {window.ARB_RECORD.map((a,i)=>(
                      <tr key={i} style={{cursor:'default'}}>
                        <td><span className="vb-sub">{a.date}</span></td>
                        <td className="l"><span className="vb-match" style={{fontSize:'.9rem'}}>{a.match}</span></td>
                        <td className="l"><div style={{display:'flex', flexDirection:'column', gap:2}}>{a.legs.map((l,j)=>(<span key={j} style={{fontSize:'.8rem'}}>{l.pick} <b style={{fontFamily:'var(--font-mono)'}}>{l.odd.toFixed(2)}</b> · <Book id={l.book} showName={false} size={16} /></span>))}</div></td>
                        <td><span className="value value--pos" style={{fontSize:'.78rem'}}>+{a.marginPct.toFixed(2)}%</span></td>
                        <td><b style={{fontFamily:'var(--font-mono)', color:'var(--pos)'}}>+{(a.profit||0).toFixed(2)}€</b></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div></div>
            </div>
          ); })()}
          <div className="disclaimer" style={{marginTop:24}}><b>{t.discTitle}</b> {t.disc}</div>
        </div>
      </section>
      <Footer t={t} go={go} />
    </main>
  );
}

/* ============================================================ CÓMO FUNCIONA */
function How({ t, go }) {
  const steps = [[t.how1t,t.how1d],[t.how2t,t.how2d],[t.how3t,t.how3d]];
  return (
    <main>
      <section className="section">
        <div className="wrap">
          <div className="section__head"><div><span className="eyebrow"><span className="dot" />{t.howEyebrow}</span><h2 className="section__title">{t.howTitle}</h2></div></div>
          <div className="grid grid--3">
            {steps.map(([title,desc],i)=>(
              <div className="panel panel--pad" key={i}>
                <div style={{width:42, height:42, borderRadius:12, background:'var(--court)', display:'grid', placeItems:'center', color:'var(--lime)', fontFamily:'var(--font-head)', fontWeight:800, fontSize:'1.2rem', marginBottom:14}}>{i+1}</div>
                <h3 style={{fontFamily:'var(--font-head)', fontWeight:800, fontSize:'1.15rem', marginBottom:8}}>{title}</h3>
                <p style={{color:'var(--ink-2)', lineHeight:1.6}}>{desc}</p>
              </div>
            ))}
          </div>
          <div className="panel panel--pad" style={{marginTop:22, display:'flex', alignItems:'center', gap:16, flexWrap:'wrap', background:'var(--ink)', color:'#f3f1ea', border:'none'}}>
            <span style={{width:46, height:46, borderRadius:12, background:'var(--lime)', display:'grid', placeItems:'center', color:'var(--ink)'}}>{Icon.bolt({style:{width:24,height:24}})}</span>
            <div style={{flex:1, minWidth:240}}>
              <h3 style={{fontFamily:'var(--font-head)', fontWeight:800, margin:'0 0 4px', fontSize:'1.3rem'}}>{t.autoTitle}</h3>
              <p style={{color:'#cfcabb', lineHeight:1.55, margin:0}}>{t.autoD}</p>
            </div>
          </div>
          <button className="btn btn--lime" style={{marginTop:24}} onClick={()=>go({view:'value'})}>{t.heroCta1} {Icon.arrow({style:{width:16,height:16}})}</button>
          <div className="disclaimer" style={{marginTop:24}}><b>{t.discTitle}</b> {t.disc}</div>
        </div>
      </section>
      <Footer t={t} go={go} />
    </main>
  );
}

Object.assign(window, { Arbitrage, Combos, Record, How });
