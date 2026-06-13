/* ACEVALUE — views part 2 (Sin Riesgo, Combinadas, Récord, Cómo) */

/* ============================================================ SIN RIESGO */
function Arbitrage({ t, go }) {
  const [, force] = useState(0);
  const [stake, setStake] = useState(()=>{ try { return +localStorage.getItem('ace_arb_stake')||100; } catch(e){ return 100; } });
  useEffect(()=>{ try { localStorage.setItem('ace_arb_stake', stake); } catch(e){} }, [stake]);
  const [mode, setMode] = useState(()=>{ try { return localStorage.getItem('ace_arb_mode')||'even'; } catch(e){ return 'even'; } });
  useEffect(()=>{ try { localStorage.setItem('ace_arb_mode', mode); } catch(e){} }, [mode]);
  // redondeo de apuestas → evita cifras con decimales que delatan la cuenta ante la casa
  const [round, setRound] = useState(()=>{ try { return localStorage.getItem('ace_arb_round')||'0.01'; } catch(e){ return '0.01'; } });
  useEffect(()=>{ try { localStorage.setItem('ace_arb_round', round); } catch(e){} }, [round]);
  const roundStake = (v)=>{ const step=+round; return step>0 ? Math.max(step, Math.round(v/step)*step) : v; };

  const all = window.findArbs();
  const liveArbs = all.filter(a=>a.hasArb);
  const near = all.filter(a=>!a.hasArb).slice(0,6);
  // also show tracked surebets from ARB_PENDING (seed / capturados) que no estén ya en vivo
  const _nm = (s)=>(s||'').split(/[–\-]/).map(x=>x.trim().replace(/^[A-Za-z]\.\s*/,'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase()).filter(Boolean).sort().join('|');
  const liveSigs = new Set(liveArbs.map(a=>_nm(`${playerById(a.m.home).name} – ${playerById(a.m.away).name}`)));
  const pendArbs = (window.ARB_PENDING||[]).filter(p=>!liveSigs.has(_nm(p.match))).map(p=>({
    m: { home:p.homeName, away:p.awayName, event:p.event||'Surebet', time:p.time||'', day:p.date, live:false, _pending:true },
    legs: [ {k:'home', price:(p.legs[0]||{}).odd||1, book:(p.legs[0]||{}).book},
            {k:'away', price:(p.legs[1]||{}).odd||1, book:(p.legs[1]||{}).book} ],
    marginPct: p.marginPct, hasArb:true,
  }));
  const arbs = [...liveArbs, ...pendArbs];
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
    }
    // redondea cada apuesta a cifra "humana" y recalcula retornos reales con esas cifras
    split = split.map(l => { const st = roundStake(l.stake); return { ...l, stake: st, ret: st * l.price }; });
    const realTotal = split.reduce((s,l)=>s+l.stake, 0);
    if (mode!=='cover') {
      evenRet = Math.min(...split.map(l=>l.ret));    // peor caso garantizado tras redondear
      evenProfit = evenRet - realTotal;
    }
    const profitLeg = split.find(l=>l.k===profitKey) || split[0];
    const coverNet = profitLeg.ret - realTotal;     // profit if the chosen player wins
    const profitName = (profitKey==='home'?home:away).name.split(' ').pop();
    return (
      <div className="panel" style={{borderColor: isArb?'var(--lime-deep)':'var(--line)', borderWidth: isArb?2:1, borderStyle:'solid'}}>
        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', gap:12, padding:'14px 16px', borderBottom:'1px solid var(--line)', cursor:'pointer'}} onClick={()=>go({view:'match', id:a.m.id})}>
          <div style={{minWidth:0}}>
            <div className="vb-sub">{a.m.event} · {a.m.day ? a.m.day+' · '+a.m.time : a.m.time}</div>
            <div style={{fontFamily:'var(--font-head)', fontWeight:800, fontSize:'1.05rem'}}>{home.name.split(' ').pop()} <span style={{color:'var(--muted)'}}>v</span> {away.name.split(' ').pop()}</div>
          </div>
          <span className="tag" style={{background: isArb?'rgba(174,225,0,.2)':'var(--bg-2)', color: isArb?'var(--lime-deep)':'var(--muted)', border:'1px solid '+(isArb?'rgba(127,168,0,.4)':'var(--line)')}}>{a.marginPct>=0?'+':''}{a.marginPct.toFixed(2)}%</span>
        </div>
        <div style={{padding:'4px 16px'}}>
          {split.map((l,i)=>{
            const net = l.ret - realTotal; const nc = net>0.005?'var(--pos)':net<-0.005?'var(--neg)':'var(--muted)';
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
                  <div style={{fontFamily:'var(--font-mono)', fontSize:'.72rem', color:'var(--lime-deep)', marginTop:2}}>{t.arbStake} {(+round>0 ? l.stake.toFixed(0) : l.stake.toFixed(2))}€</div>
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
            <div style={{display:'flex', gap:10, alignItems:'center'}}>
              <BookFilter onChange={()=>force(n=>n+1)} />
              {arbs.length>0 && <span className="tag tag--lime">{arbs.length} {t.arbFound}</span>}
            </div>
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
            <div style={{display:'flex', flexDirection:'column', gap:5}}>
              <label style={{fontFamily:'var(--font-mono)', fontSize:'.6rem', letterSpacing:'.1em', textTransform:'uppercase', color:'var(--muted)'}}>{t.arbRoundLabel}</label>
              <div style={{display:'flex', gap:0, border:'1px solid var(--line)', borderRadius:9, overflow:'hidden'}}>
                {[['0','€0,01'],['1','1€'],['5','5€']].map(([k,lbl])=>(
                  <button key={k} onClick={()=>setRound(k)} style={{background: round===k?'var(--court)':'var(--surface)', color: round===k?'#fff':'var(--ink-2)', border:'none', padding:'8px 12px', fontFamily:'var(--font-mono)', fontWeight:700, fontSize:'.74rem', cursor:'pointer'}}>{lbl}</button>
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
          <div className="grid grid--2" style={{alignItems:'stretch'}}>
            {combos.map(c=>{
              const total = c.legs.reduce((p,l)=>p*l.odd,1);
              return (
                <div className="panel" key={c.id} style={{display:'flex', flexDirection:'column'}}>
                  <div className="combo__head" style={{borderBottom:'1px solid var(--line)'}}>
                    <div style={{fontFamily:'var(--font-head)', fontWeight:800, fontSize:'1.2rem'}}>{c.name}</div>
                    <span className="tag tag--court">{t.comboConf} {c.conf}%</span>
                  </div>
                  <div style={{padding:'4px 16px', flex:1}}>
                    {c.legs.map((l,i)=>(
                      <div key={i} style={{display:'flex', justifyContent:'space-between', alignItems:'center', gap:10, padding:'13px 0', borderBottom: i<c.legs.length-1?'1px solid var(--line-soft)':'none'}}>
                        <div style={{minWidth:0}}>
                          <div style={{fontFamily:'var(--font-head)', fontWeight:700, fontSize:'.95rem'}}>{l.pick}</div>
                          <div style={{display:'flex', alignItems:'center', gap:6, marginTop:4}}><span className="vb-sub">{l.match} · </span><Book id={l.book} size={16} /></div>
                        </div>
                        <span style={{fontFamily:'var(--font-mono)', fontWeight:700, fontSize:'.95rem', color:'var(--court)'}}>{l.odd.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                  <div className="combo__foot" style={{marginTop:'auto'}}>
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

/* ============================================================ EQUITY CURVE */
function EquityCurve() {
  const pts = window.equitySeries ? window.equitySeries() : [{x:0,y:0}];
  const w=600, h=120, pad=6;
  const xs=pts.map(p=>p.x), ys=pts.map(p=>p.y);
  const minY=Math.min(0,...ys), maxY=Math.max(...ys,1);
  const maxX=Math.max(...xs)||1, spanY=(maxY-minY)||1;
  const sx=(x)=>pad+(x/maxX)*(w-pad*2);
  const sy=(y)=>h-pad-((y-minY)/spanY)*(h-pad*2);
  const line=pts.map((p,i)=>`${i?'L':'M'}${sx(p.x).toFixed(1)},${sy(p.y).toFixed(1)}`).join(' ');
  const area=`${line} L${sx(xs[xs.length-1]).toFixed(1)},${(h-pad).toFixed(1)} L${sx(0).toFixed(1)},${(h-pad).toFixed(1)} Z`;
  const zeroY=sy(0);
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{width:'100%', height:120, display:'block'}}>
      <defs><linearGradient id="eqT" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="rgba(31,111,74,.28)"/><stop offset="100%" stopColor="rgba(31,111,74,0)"/></linearGradient></defs>
      <line x1={pad} y1={zeroY} x2={w-pad} y2={zeroY} stroke="rgba(23,21,15,.14)" strokeWidth="1" strokeDasharray="4 4"/>
      <path d={area} fill="url(#eqT)"/>
      <path d={line} fill="none" stroke="var(--court)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round"/>
    </svg>
  );
}

/* ============================================================ RÉCORD */
function Record({ t, go }) {
  const s = window.recordSummary();
  let cum=0;
  // normalize so "Gana M. Arnaldi" (robot) and "M. Arnaldi" (live board) collapse to one
  const _ns=s=>(s||'').trim().replace(/^[A-Za-z]\.\s*/,'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
  const _nm=m=>(m||'').split(/[–\-]/).map(_ns).filter(Boolean).sort().join('|');
  const _np=s=>(s||'').replace(/^gana\s+/i,'').replace(/^[A-Za-z]\.\s*/,'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
  const psig=p=>`${_nm(p.match)}|${_np(p.pickLabel||p.pick)}`;
  // lista negra: partidos a ocultar del récord/pendientes (window.EXCLUDE = ["Ilagan – Shimizu", ...])
  const exSet = new Set((window.EXCLUDE||[]).map(_nm));
  const isExcluded = p => exSet.has(_nm(p.match));
  // "en juego" = picks registrados por el robot + los picks de valor de HOY del tablero
  const settledSig = new Set((window.RECORD||[]).map(r=>psig({match:r.match, pickLabel:r.pick||r.pickLabel})));
  const livePicks = (window.MATCHES||[]).map(m=>({m,v:window.matchValue(m)})).filter(x=>x.v.positive).map(x=>({
      date:'HOY', match:`${window.playerById(x.m.home).name} – ${window.playerById(x.m.away).name}`,
      pickLabel: window.outcomeLabel(x.v.pick.k, x.m), odd:+x.v.pick.best.price.toFixed(2), book:x.v.pick.best.book }));
  const seenPend = new Set();
  const pendingList = [...(window.PENDING||[]), ...livePicks].filter(p=>{
    if (isExcluded(p)) return false;                          // en lista negra → fuera
    const sig=psig(p);
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

          <div className="panel panel--pad" style={{marginBottom:26}}>
            <span className="eyebrow muted"><span className="dot" />{t.stProfit} ({t.units})</span>
            <div style={{marginTop:14}}><EquityCurve /></div>
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
                    <td><span className={'res-pill '+(r.result==='W'?'w':r.result==='V'?'v':'l')}>{r.result==='W'?t.resW:r.result==='V'?t.resV:t.resL}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div></div>

          {Array.isArray(window.COMBO_PENDING) && window.COMBO_PENDING.length>0 && (
            <div style={{marginTop:30}}>
              <span className="eyebrow"><span className="dot" />{t.navCombos} · {t.statusPend||'EN JUEGO'}</span>
              <div className="grid grid--2" style={{marginTop:14, alignItems:'stretch'}}>
                {window.COMBO_PENDING.map((c,i)=>(
                  <div className="panel" key={i} style={{display:'flex', flexDirection:'column', opacity:.9}}>
                    <div className="combo__head" style={{borderBottom:'1px solid var(--line)'}}>
                      <div><div className="vb-sub">{c.date}</div><div style={{fontFamily:'var(--font-head)', fontWeight:800, fontSize:'1.05rem'}}>{c.name}</div></div>
                      <span className="res-pill" style={{background:'rgba(174,225,0,.18)', color:'var(--lime-deep)', border:'1px solid rgba(127,168,0,.4)'}}>EN JUEGO</span>
                    </div>
                    <div style={{padding:'4px 16px', flex:1}}>
                      {c.legs.map((l,j)=>(
                        <div key={j} style={{display:'flex', justifyContent:'space-between', alignItems:'center', gap:10, padding:'11px 0', borderBottom: j<c.legs.length-1?'1px solid var(--line-soft)':'none'}}>
                          <div style={{minWidth:0}}>
                            <div style={{fontFamily:'var(--font-head)', fontWeight:700, fontSize:'.88rem'}}>{l.pick}</div>
                            <div className="vb-sub">{l.match}</div>
                          </div>
                          <span style={{fontFamily:'var(--font-mono)', fontWeight:700, fontSize:'.82rem', color:'var(--court)'}}>{l.odd.toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                    <div className="combo__foot" style={{marginTop:'auto'}}>
                      <span style={{fontFamily:'var(--font-mono)', fontSize:'.72rem', color:'var(--muted)'}}>{t.comboTotal}</span>
                      <span style={{fontFamily:'var(--font-head)', fontWeight:800, fontSize:'1.1rem', color:'var(--lime-deep)'}}>{c.legs.reduce((p,l)=>p*l.odd,1).toFixed(2)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {Array.isArray(window.COMBO_RECORD) && window.COMBO_RECORD.length>0 && (
            <div style={{marginTop:30}}>
              <span className="eyebrow"><span className="dot" />{t.comboRecTitle}</span>
              <p style={{color:'var(--ink-2)', fontSize:'.9rem', margin:'10px 0 16px', maxWidth:660, lineHeight:1.55}}>{t.comboRecLead}</p>
              {(()=>{ const cs=window.comboSummary(); return (
                <div className="grid grid--3" style={{marginBottom:16}}>
                  <div className="stat"><div className="stat__lbl">{t.comboRecRoi||'ROI combis'}</div><div className="stat__val" style={{color: cs.profit>=0?'var(--pos)':'var(--neg)'}}>{cs.profit>=0?'+':''}{cs.roi}%</div></div>
                  <div className="stat"><div className="stat__lbl">{t.comboRecProfit||'Beneficio'}</div><div className="stat__val" style={{color: cs.profit>=0?'var(--pos)':'var(--neg)'}}>{cs.profit>=0?'+':''}{cs.profit}u</div></div>
                  <div className="stat"><div className="stat__lbl">{t.comboRecN||'Combis'}</div><div className="stat__val">{cs.w}-{cs.l} <span style={{fontSize:'.5em', color:'var(--muted)'}}>{Math.round(cs.hit)}%</span></div></div>
                </div>
              ); })()}
              <div className="grid grid--2">
                {window.COMBO_RECORD.map((c,i)=>{
                  const won=c.result==='W'; const vd=c.result==='V';
                  return (
                    <div className="panel" key={i} style={{borderColor: vd?'rgba(131,125,108,.4)':won?'rgba(31,138,76,.4)':'rgba(210,64,42,.4)', borderWidth:1, borderStyle:'solid'}}>
                      <div className="combo__head" style={{borderBottom:'1px solid var(--line)'}}>
                        <div><div className="vb-sub">{c.date}</div><div style={{fontFamily:'var(--font-head)', fontWeight:800, fontSize:'1.05rem'}}>{c.name}</div></div>
                        <span className={'res-pill '+(won?'w':vd?'v':'l')}>{won?t.resW:vd?t.resV:t.resL}</span>
                      </div>
                      <div style={{padding:'4px 16px'}}>
                        {c.legs.map((l,j)=>(
                          <div key={j} style={{display:'flex', justifyContent:'space-between', alignItems:'center', gap:10, padding:'10px 0', borderBottom: j<c.legs.length-1?'1px solid var(--line-soft)':'none'}}>
                            <div style={{minWidth:0}}>
                              <div style={{fontFamily:'var(--font-head)', fontWeight:700, fontSize:'.88rem', color: l.voided?'var(--muted)':l.win?'var(--ink)':'var(--muted)', textDecoration: (l.voided||l.win)?'none':'line-through'}}>{l.pick}</div>
                              <div className="vb-sub">{l.match}{l.voided?' · retirada':''}</div>
                            </div>
                            <span style={{fontFamily:'var(--font-mono)', fontWeight:700, fontSize:'.82rem', color: l.voided?'var(--muted)':l.win?'var(--pos)':'var(--neg)'}}>{l.voided?'∅':l.win?'✓':'✗'} {(l.odd||1).toFixed(2)}</span>
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

Object.assign(window, { Arbitrage, Combos, Record, How, ModelAccuracy, Ladder, EquityCurve });

/* ============================================================ RETO ESCALERA */
function Ladder({ t, go }) {
  const L = window.LADDER || { rungs:[], start:10, target:250, steps:10, current:0, status:'live', bank:10 };
  const hist = window.LADDER_HISTORY || [];
  const unlocked = (window.ACE_PLAN === 'ladder' || window.ACE_PLAN === 'all');
  const [busy, setBusy] = useState(false);
  const pct = Math.round((L.current / (L.steps||10)) * 100);

  const subscribe = async () => {
    setBusy(true);
    try {
      const r = await fetch('/api/checkout', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ tier:'ladder' }) });
      const j = await r.json();
      if (j.url) location.href = j.url; else { alert(j.error==='backend_not_configured'?'Pagos aún no configurados.':(j.error||'Error')); setBusy(false); }
    } catch(e){ alert('Error de conexión'); setBusy(false); }
  };

  return (
    <main>
      <section className="section">
        <div className="wrap">
          <div className="section__head">
            <div>
              <span className="eyebrow"><span className="dot" />{t.ladEyebrow}</span>
              <h2 className="section__title">{t.ladTitle}</h2>
            </div>
            <span className="tag tag--lime">{L.start}€ → {L.target}€</span>
          </div>
          <p style={{color:'var(--ink-2)', maxWidth:680, margin:'-6px 0 18px', lineHeight:1.6}}>{t.ladLead}</p>

          {/* progreso */}
          <div className="panel panel--pad" style={{marginBottom:20}}>
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'baseline', marginBottom:10}}>
              <span style={{fontFamily:'var(--font-mono)', fontSize:'.72rem', color:'var(--muted)', textTransform:'uppercase', letterSpacing:'.1em'}}>{t.ladStep} {L.current}/{L.steps}</span>
              <span style={{fontFamily:'var(--font-head)', fontWeight:800, fontSize:'1.4rem', color:'var(--court)'}}>{(L.bank||L.start).toFixed(2)}€</span>
            </div>
            <div style={{height:10, borderRadius:99, background:'var(--bg-2)', overflow:'hidden'}}>
              <div style={{height:'100%', width:pct+'%', background:'linear-gradient(90deg,var(--court),var(--lime))', borderRadius:99, transition:'width .4s'}} />
            </div>
          </div>

          {/* escalera de peldaños */}
          <div className="panel" style={{overflow:'hidden'}}>
            {L.rungs.map((r,i)=>{
              const done = r.result==='W';
              const lost = r.result==='L';
              const today = r.result==='today';
              const future = !r.result;
              const locked = today && !unlocked;
              return (
                <div key={i} style={{display:'flex', alignItems:'center', gap:12, padding:'13px 16px', borderBottom: i<L.rungs.length-1?'1px solid var(--line-soft)':'none',
                  background: today?'rgba(174,225,0,.07)':'transparent', opacity: future?0.5:1}}>
                  <span style={{width:30, height:30, borderRadius:'50%', flexShrink:0, display:'grid', placeItems:'center', fontFamily:'var(--font-head)', fontWeight:800, fontSize:'.85rem',
                    background: done?'var(--pos)':lost?'var(--neg)':today?'var(--court)':'var(--bg-2)', color: (done||lost||today)?'#fff':'var(--muted)'}}>
                    {done?'✓':lost?'✗':r.n}
                  </span>
                  <div style={{flex:1, minWidth:0}}>
                    {today && locked ? (
                      <div style={{fontFamily:'var(--font-head)', fontWeight:700, color:'var(--court)'}}>🔒 {t.ladTodayLocked}</div>
                    ) : today ? (
                      <div><div style={{fontFamily:'var(--font-head)', fontWeight:700, fontSize:'.95rem'}}>{r.pick||t.ladSoon}</div>
                        {r.match && <div className="vb-sub">{r.match}{r.book?' · '+(window.bookById?window.bookById(r.book).name:r.book):''}</div>}</div>
                    ) : (done||lost) ? (
                      <div><div style={{fontFamily:'var(--font-head)', fontWeight:700, fontSize:'.92rem', textDecoration: lost?'line-through':'none', color: lost?'var(--muted)':'var(--ink)'}}>{r.pick}</div>
                        <div className="vb-sub">{r.match}</div></div>
                    ) : (
                      <div style={{fontFamily:'var(--font-mono)', fontSize:'.8rem', color:'var(--muted)'}}>{t.ladStep} {r.n}</div>
                    )}
                  </div>
                  <div style={{textAlign:'right', whiteSpace:'nowrap'}}>
                    {r.odd && (today&&locked ? <span style={{filter:'blur(5px)', fontFamily:'var(--font-mono)', fontWeight:700}}>1.30</span>
                      : <span style={{fontFamily:'var(--font-mono)', fontWeight:700, color:'var(--court)'}}>{r.odd.toFixed(2)}</span>)}
                    {r.bank!=null && <div className="vb-sub">{r.bank.toFixed(2)}€</div>}
                  </div>
                </div>
              );
            })}
          </div>

          {/* paywall */}
          {!unlocked && (
            <div className="panel panel--pad" style={{marginTop:20, textAlign:'center', border:'2px solid var(--lime-deep)'}}>
              <div style={{fontFamily:'var(--font-head)', fontWeight:800, fontSize:'1.3rem', marginBottom:6}}>{t.ladCtaTitle}</div>
              <p style={{color:'var(--ink-2)', maxWidth:460, margin:'0 auto 14px', lineHeight:1.55}}>{t.ladCtaLead}</p>
              <button className="btn btn--lime" onClick={subscribe} disabled={busy} style={{fontSize:'1.05rem', padding:'13px 26px'}}>
                {busy?'…':t.ladCtaBtn}
              </button>
              <div style={{fontFamily:'var(--font-mono)', fontSize:'.68rem', color:'var(--muted)', marginTop:10}}>{t.ladCtaFine}</div>
            </div>
          )}
          {unlocked && (
            <div style={{marginTop:14, fontFamily:'var(--font-mono)', fontSize:'.72rem', color:'var(--pos)', textAlign:'center'}}>✅ {t.ladActive}</div>
          )}

          {/* historial de escaleras */}
          {hist.length>0 && (
            <div style={{marginTop:30}}>
              <span className="eyebrow muted"><span className="dot" />{t.ladHistTitle}</span>
              <div className="grid grid--2" style={{marginTop:14}}>
                {hist.map((h,i)=>(
                  <div className="panel panel--pad" key={i} style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                    <div>
                      <div style={{fontFamily:'var(--font-head)', fontWeight:700}}>{h.start}€ → {h.target}€</div>
                      <div className="vb-sub">{h.date}</div>
                    </div>
                    <span className={'res-pill '+(h.result==='completed'?'w':'l')}>{h.result==='completed'?t.ladDone:`${t.ladBroke} ${h.brokeAt} · ${h.reached}€`}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="disclaimer" style={{marginTop:24}}><b>{t.discTitle}</b> {t.disc}</div>
        </div>
      </section>
      <Footer t={t} go={go} />
    </main>
  );
}

/* ============================================================ ACIERTOS DEL MODELO */
function ModelAccuracy({ t, go }) {
  const s = window.modelSummary ? window.modelSummary() : { n:0, ok:0, ko:0, acc:0 };
  const rec = window.MODEL_RECORD || [];
  return (
    <main>
      <section className="section">
        <div className="wrap">
          <div className="section__head">
            <div><span className="eyebrow"><span className="dot" />{t.modelEyebrow}</span><h2 className="section__title">{t.modelTitle}</h2></div>
          </div>
          <p style={{color:'var(--ink-2)', maxWidth:680, margin:'-6px 0 22px', lineHeight:1.6}}>{t.modelLead}</p>

          <div className="grid grid--3" style={{gridTemplateColumns:'repeat(4,1fr)', marginBottom:26}}>
            <div className="stat"><div className="stat__lbl">{t.modelAcc}</div><div className="stat__val" style={{color:'var(--court)'}}>{s.acc.toFixed(0)}%</div></div>
            <div className="stat"><div className="stat__lbl">{t.modelHits}</div><div className="stat__val" style={{color:'var(--pos)'}}>{s.ok}</div></div>
            <div className="stat"><div className="stat__lbl">{t.modelMiss}</div><div className="stat__val" style={{color:'var(--neg)'}}>{s.ko}</div></div>
            <div className="stat"><div className="stat__lbl">{t.modelN}</div><div className="stat__val">{s.n}</div></div>
          </div>

          {rec.length>0 ? (
            <div className="panel"><div className="vboard-scroll">
              <table className="vboard">
                <thead><tr><th>{t.colDate}</th><th className="l">{t.colMatch}</th><th className="l">{t.modelColPred}</th><th>{t.modelColProb}</th><th>{t.modelColRes}</th></tr></thead>
                <tbody>
                  {rec.map((m,i)=>(
                    <tr key={i} style={{cursor:'default'}}>
                      <td><span className="vb-sub">{m.date}</span></td>
                      <td className="l"><span className="vb-match" style={{fontSize:'.9rem'}}>{m.match}</span></td>
                      <td className="l">{m.predName}</td>
                      <td style={{fontFamily:'var(--font-mono)', color:'var(--muted)'}}>{m.prob}%</td>
                      <td><span className={'res-pill '+(m.ok?'w':'l')}>{m.ok?t.modelOk:t.modelKo}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div></div>
          ) : (
            <div className="panel panel--pad" style={{textAlign:'center', padding:'40px 22px'}}>
              <div style={{fontFamily:'var(--font-head)', fontWeight:800, fontSize:'1.1rem'}}>—</div>
            </div>
          )}
          <div className="disclaimer" style={{marginTop:22}}><b>{t.discTitle}</b> {t.disc}</div>
        </div>
      </section>
      <Footer t={t} go={go} />
    </main>
  );
}
