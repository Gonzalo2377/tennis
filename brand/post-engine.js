/* ============================================================
   Generador de posts — motor de dibujo (fútbol + tenis)
   El tema se elige por ?sport=football | tennis en el <script src>.
   ============================================================ */
(function(){
const SPORT = (document.currentScript && document.currentScript.src.match(/sport=(\w+)/) || [])[1] || 'football';

const THEME = SPORT === 'tennis' ? {
  bg:'#1f6f4a', bg2:'#16563a', card:'rgba(255,255,255,0.07)', accent:'#c2e62a', accentDeep:'#aee100',
  ink:'#ffffff', sub:'rgba(255,255,255,.72)', green:'#d4f23a', red:'#ff8a7a',
  head:'"Bricolage Grotesque"', mono:'"Space Mono"',
  brand1:'ACE', brand2:'VALUE', site:'acevalue.me', glow:'rgba(194,230,42,0.2)'
} : {
  bg:'#0b0e17', bg2:'#10131d', card:'rgba(246,196,67,0.07)', accent:'#f6c443', accentDeep:'#caa033',
  ink:'#eef2fb', sub:'#aab3c9', green:'#27d796', red:'#ff6b5e',
  head:'"Big Shoulders Display"', mono:'"Space Mono"',
  brand1:'GOL', brand2:'VALUE', site:'golvalue.online', glow:'rgba(246,196,67,0.16)'
};

const cv=document.getElementById('c'), x=cv.getContext('2d');
const $=id=>document.getElementById(id);
let type='value';

function rr(c,X,Y,w,h,r){c.beginPath();c.moveTo(X+r,Y);c.arcTo(X+w,Y,X+w,Y+h,r);c.arcTo(X+w,Y+h,X,Y+h,r);c.arcTo(X,Y+h,X,Y,r);c.arcTo(X,Y,X+w,Y,r);c.closePath();}
function fit(t,maxW,start,wt){let s=start;do{x.font=(wt||900)+' '+s+'px '+THEME.head;if(x.measureText(t).width<=maxW)break;s-=4;}while(s>24);return s;}
// football ball (pentagon) or tennis ball (seams)
function mark(cx,cy,R){
  x.save();
  if(SPORT==='tennis'){
    x.fillStyle=THEME.accent;x.beginPath();x.arc(cx,cy,R,0,7);x.fill();
    x.save();x.beginPath();x.arc(cx,cy,R,0,7);x.clip();
    x.strokeStyle='#fff';x.lineWidth=R*0.13;x.lineCap='round';
    x.beginPath();x.moveTo(cx-R*1.02,cy-R*0.78);x.quadraticCurveTo(cx+R*0.5,cy,cx-R*1.02,cy+R*0.78);x.stroke();
    x.beginPath();x.moveTo(cx+R*1.02,cy-R*0.78);x.quadraticCurveTo(cx-R*0.5,cy,cx+R*1.02,cy+R*0.78);x.stroke();
    x.restore();
  } else {
    const col=THEME.bg;x.strokeStyle=col;x.fillStyle=col;x.lineWidth=Math.max(2,R*0.085);x.lineCap='round';x.lineJoin='round';
    x.beginPath();x.arc(cx,cy,R,0,7);x.stroke();
    const rp=R*0.4,v=[];for(let i=0;i<5;i++){const a=(-90+i*72)*Math.PI/180;v.push([cx+rp*Math.cos(a),cy+rp*Math.sin(a)]);}
    x.beginPath();v.forEach((p,i)=>i?x.lineTo(p[0],p[1]):x.moveTo(p[0],p[1]));x.closePath();x.fill();
    for(let i=0;i<5;i++){const a=(-90+i*72)*Math.PI/180;x.beginPath();x.moveTo(v[i][0],v[i][1]);x.lineTo(cx+R*Math.cos(a),cy+R*Math.sin(a));x.stroke();}
  }
  x.restore();
}

function base(tag){
  x.fillStyle=THEME.bg;x.fillRect(0,0,1080,1080);
  let g=x.createRadialGradient(820,60,0,820,60,780);g.addColorStop(0,THEME.glow);g.addColorStop(1,'rgba(0,0,0,0)');x.fillStyle=g;x.fillRect(0,0,1080,1080);
  // header
  const S=70;rr(x,70,64,S,S,18);x.fillStyle=SPORT==='tennis'?THEME.bg2:THEME.accent;x.fill();
  if(SPORT==='tennis'){ x.save(); rr(x,70,64,S,S,18); x.clip(); mark(70+S/2,64+S/2,S*0.4); x.restore(); }
  else mark(70+S/2,64+S/2,S*0.34);
  x.textBaseline='middle';x.textAlign='left';
  x.font='900 46px '+THEME.head;x.fillStyle=THEME.ink;x.fillText(THEME.brand1,158,103);
  const wg=x.measureText(THEME.brand1).width;x.fillStyle=THEME.accentDeep;x.fillText(THEME.brand2,158+wg,103);
  x.textAlign='right';x.font='700 22px '+THEME.mono;x.fillStyle=THEME.accentDeep;x.fillText(tag,1010,100);
  x.textBaseline='alphabetic';
  // footer
  x.textAlign='center';x.font='700 30px '+THEME.mono;x.fillStyle=THEME.accentDeep;x.fillText(THEME.site,540,1010);
  x.font='400 19px '+THEME.mono;x.fillStyle=THEME.sub;x.fillText('+18 · Juego responsable · No es consejo financiero',540,1048);
}
function stat(cx,sy,lbl,val,col){x.textAlign='center';x.font='400 21px '+THEME.mono;x.fillStyle=THEME.sub;x.fillText(lbl,cx,sy);x.font='900 52px '+THEME.head;x.fillStyle=col;x.fillText(val,cx,sy+54);}

/* ---------- PICK DE VALOR ---------- */
function drawValue(){
  base('PICK DE VALOR');
  x.textAlign='center';x.font='700 26px '+THEME.mono;x.fillStyle=THEME.accentDeep;x.fillText(($('v_comp').value||'').toUpperCase(),540,232);
  const match=(($('v_home').value||'')+'  vs  '+($('v_away').value||'')).toUpperCase();
  x.font='900 '+fit(match,940,74)+'px '+THEME.head;x.fillStyle=THEME.ink;x.fillText(match,540,316);
  x.font='400 24px '+THEME.mono;x.fillStyle=THEME.sub;x.fillText($('v_time').value||'',540,372);
  const bx=120,by=440,bw=840,bh=300;
  x.save();x.shadowColor=THEME.glow;x.shadowBlur=40;rr(x,bx,by,bw,bh,26);x.fillStyle=THEME.card;x.fill();x.restore();
  rr(x,bx,by,bw,bh,26);x.lineWidth=2;x.strokeStyle=THEME.accentDeep;x.stroke();
  x.textAlign='center';x.font='700 22px '+THEME.mono;x.fillStyle=THEME.accentDeep;x.fillText('NUESTRO PICK',540,by+50);
  x.font='900 '+fit(($('v_pick').value||'').toUpperCase(),760,66)+'px '+THEME.head;x.fillStyle=THEME.ink;x.fillText(($('v_pick').value||'').toUpperCase(),540,by+122);
  x.font='400 20px '+THEME.mono;x.fillStyle=THEME.sub;x.fillText('CUOTA',540,by+186);
  x.font='900 92px '+THEME.head;x.fillStyle=THEME.accent;x.fillText($('v_odd').value||'',540,by+250);
  const sy=830;stat(270,sy,'MODELO',($('v_model').value||'')+'%',THEME.ink);stat(540,sy,'VALOR',$('v_value').value||'',THEME.green);
  x.font='400 21px '+THEME.mono;x.fillStyle=THEME.sub;x.fillText('MEJOR CASA',810,sy);
  x.font='900 '+fit(($('v_book').value||'').toUpperCase(),250,48)+'px '+THEME.head;x.fillStyle=THEME.accent;x.fillText(($('v_book').value||'').toUpperCase(),810,sy+54);
}
/* ---------- COMBINADA ---------- */
function drawCombo(){
  base(SPORT==='tennis'?'COMBINADA':'COMBINADA');
  x.textAlign='center';x.font='700 24px '+THEME.mono;x.fillStyle=THEME.sub;x.fillText(($('c_date').value||'').toUpperCase(),540,222);
  x.font='900 '+fit(($('c_name').value||'').toUpperCase(),900,76)+'px '+THEME.head;x.fillStyle=THEME.ink;x.fillText(($('c_name').value||'').toUpperCase(),540,292);
  const legs=($('c_legs').value||'').split('\n').map(s=>s.trim()).filter(Boolean).slice(0,5);
  let y=380;const rowH=Math.min(78,(620-380)/Math.max(legs.length,1)+34);
  legs.forEach((line,i)=>{
    const m=line.match(/^(.*?)@\s*([\d.,]+)\s*$/);const pick=m?m[1].trim():line;const odd=m?m[2]:'';
    rr(x,120,y,840,rowH-10,14);x.fillStyle=THEME.card;x.fill();
    x.textAlign='left';x.font='700 30px '+THEME.head;x.fillStyle=THEME.ink;
    x.font='700 '+fit(pick.toUpperCase(),600,30)+'px '+THEME.head;x.fillText(pick.toUpperCase(),150,y+(rowH-10)/2+10);
    x.textAlign='right';x.font='900 34px '+THEME.head;x.fillStyle=THEME.accent;x.fillText(odd,930,y+(rowH-10)/2+10);
    y+=rowH;
  });
  const by=Math.max(y+10,720);
  rr(x,120,by,840,150,22);x.fillStyle=THEME.card;x.fill();rr(x,120,by,840,150,22);x.lineWidth=2;x.strokeStyle=THEME.accentDeep;x.stroke();
  // left column: confianza · right column: cuota total
  x.textAlign='left';x.font='400 21px '+THEME.mono;x.fillStyle=THEME.sub;x.fillText('CONFIANZA',158,by+50);
  x.font='900 56px '+THEME.head;x.fillStyle=THEME.green;x.fillText(($('c_conf').value||'')+'%',158,by+115);
  x.textAlign='right';x.font='400 21px '+THEME.mono;x.fillStyle=THEME.sub;x.fillText('CUOTA TOTAL',922,by+50);
  x.font='900 72px '+THEME.head;x.fillStyle=THEME.accent;x.fillText(($('c_total').value||''),922,by+118);
}
/* ---------- SIN RIESGO · IGUAL ---------- */
function drawEven(){
  base('SIN RIESGO · IGUAL');
  x.textAlign='center';x.font='700 24px '+THEME.mono;x.fillStyle=THEME.accentDeep;x.fillText(($('e_comp').value||'').toUpperCase(),540,210);
  const match=(($('e_home').value||'')+'  vs  '+($('e_away').value||'')).toUpperCase();
  x.font='900 '+fit(match,900,60)+'px '+THEME.head;x.fillStyle=THEME.ink;x.fillText(match,540,270);
  const stake=parseFloat(($('e_stake').value||'0').replace(',','.'))||0;
  const legs=($('e_legs').value||'').split('\n').map(s=>s.trim()).filter(Boolean).slice(0,3).map(line=>{
    const m=line.match(/^(.*?)@\s*([\d.,]+)\s*(?:·\s*(.*))?$/);
    return { pick:m?m[1].trim():line, odd:m?parseFloat(m[2].replace(',','.')):0, book:m&&m[3]?m[3].trim():'' };
  });
  let inv=0;legs.forEach(l=>{if(l.odd)inv+=1/l.odd;});
  let y=326;
  legs.forEach((l)=>{
    const st=inv>0?stake*(1/l.odd)/inv:0;
    rr(x,120,y,840,104,16);x.fillStyle=THEME.card;x.fill();
    x.textAlign='left';x.font='700 '+fit(l.pick.toUpperCase(),470,30)+'px '+THEME.head;x.fillStyle=THEME.ink;x.fillText(l.pick.toUpperCase(),150,y+44);
    x.font='400 19px '+THEME.mono;x.fillStyle=THEME.sub;x.fillText((l.book||'').toUpperCase()+'  ·  CUOTA '+l.odd.toFixed(2),150,y+78);
    // stake to place — the key number
    x.textAlign='right';x.font='400 17px '+THEME.mono;x.fillStyle=THEME.sub;x.fillText('PON',930,y+38);
    x.font='900 42px '+THEME.head;x.fillStyle=THEME.accent;x.fillText(st.toFixed(2)+'€',930,y+80);
    y+=116;
  });
  const ret=inv>0?stake/inv:0;const profit=ret-stake;
  const by=y+6;
  rr(x,120,by,840,140,22);x.fillStyle=profit>=0?'rgba(39,215,150,.10)':THEME.card;x.fill();rr(x,120,by,840,140,22);x.lineWidth=2;x.strokeStyle=THEME.green;x.stroke();
  x.textAlign='left';x.font='400 21px '+THEME.mono;x.fillStyle=THEME.sub;x.fillText('INVIERTES '+stake.toFixed(0)+'€',158,by+52);
  x.font='900 40px '+THEME.head;x.fillStyle=THEME.ink;x.fillText('RECUPERAS '+ret.toFixed(2)+'€',158,by+102);
  x.textAlign='right';x.font='400 21px '+THEME.mono;x.fillStyle=THEME.sub;x.fillText('GANES QUIEN GANE',922,by+52);
  x.font='900 60px '+THEME.head;x.fillStyle=THEME.green;x.fillText((profit>=0?'+':'')+profit.toFixed(2)+'€',922,by+110);
}
/* ---------- SIN RIESGO · CUBRIR ---------- */
function drawCover(){
  base('SIN RIESGO · CUBRIR');
  x.textAlign='center';x.font='700 24px '+THEME.mono;x.fillStyle=THEME.accentDeep;x.fillText(($('o_comp').value||'').toUpperCase(),540,206);
  const match=(($('o_home').value||'')+'  vs  '+($('o_away').value||'')).toUpperCase();
  x.font='900 '+fit(match,900,58)+'px '+THEME.head;x.fillStyle=THEME.ink;x.fillText(match,540,262);
  const stake=parseFloat(($('o_stake').value||'0').replace(',','.'))||0;
  const legs=($('o_legs').value||'').split('\n').map(s=>s.trim()).filter(Boolean).slice(0,3).map(line=>{
    const m=line.match(/^(.*?)@\s*([\d.,]+)\s*(?:·\s*(.*))?$/);
    return { pick:m?m[1].trim():line, odd:m?parseFloat(m[2].replace(',','.')):0, book:m&&m[3]?m[3].trim():'' };
  });
  const backIdx=Math.min(Math.max((parseInt($('o_back').value||'1',10)||1)-1,0),legs.length-1);
  // every NON-backed leg breaks even (returns the total); backed leg gets the rest
  let othersStake=0;legs.forEach((l,i)=>{ if(i!==backIdx && l.odd) othersStake+=stake/l.odd; });
  const split=legs.map((l,i)=> i===backIdx ? {...l, st: stake-othersStake} : {...l, st: l.odd?stake/l.odd:0});
  const backLeg=split[backIdx]||split[0];
  const winNet=(backLeg.st*backLeg.odd)-stake;
  let y=312;
  split.forEach((l,i)=>{
    const isBack=i===backIdx;
    rr(x,120,y,840,104,16);x.fillStyle=isBack?'rgba(39,215,150,.12)':THEME.card;x.fill();
    if(isBack){rr(x,120,y,840,104,16);x.lineWidth=2;x.strokeStyle=THEME.green;x.stroke();}
    // marker dot
    x.beginPath();x.arc(160,y+52,9,0,7);x.fillStyle=isBack?THEME.green:'transparent';x.fill();if(!isBack){x.lineWidth=2;x.strokeStyle=THEME.sub;x.stroke();}
    x.textAlign='left';x.font='700 '+fit(l.pick.toUpperCase(),430,28)+'px '+THEME.head;x.fillStyle=THEME.ink;x.fillText(l.pick.toUpperCase(),190,y+44);
    x.font='400 18px '+THEME.mono;x.fillStyle=THEME.sub;x.fillText((l.book||'').toUpperCase()+'  ·  CUOTA '+l.odd.toFixed(2),190,y+76);
    x.textAlign='right';x.font='400 16px '+THEME.mono;x.fillStyle=THEME.sub;x.fillText('PON',930,y+36);
    x.font='900 40px '+THEME.head;x.fillStyle=isBack?THEME.green:THEME.accent;x.fillText(l.st.toFixed(2)+'€',930,y+78);
    y+=116;
  });
  const by=y+6;
  rr(x,120,by,405,150,20);x.fillStyle='rgba(39,215,150,.12)';x.fill();rr(x,120,by,405,150,20);x.lineWidth=2;x.strokeStyle=THEME.green;x.stroke();
  x.textAlign='center';x.font='400 19px '+THEME.mono;x.fillStyle=THEME.sub;x.fillText('SI ACERTAMOS',322,by+46);
  x.font='900 56px '+THEME.head;x.fillStyle=THEME.green;x.fillText((winNet>=0?'+':'')+winNet.toFixed(2)+'€',322,by+108);
  rr(x,555,by,405,150,20);x.fillStyle=THEME.card;x.fill();rr(x,555,by,405,150,20);x.lineWidth=2;x.strokeStyle=THEME.sub;x.stroke();
  x.font='400 19px '+THEME.mono;x.fillStyle=THEME.sub;x.fillText('SI SALE OTRO',757,by+46);
  x.font='900 56px '+THEME.head;x.fillStyle=THEME.sub;x.fillText('0,00€',757,by+108);
}

const DRAW={value:drawValue,combo:drawCombo,even:drawEven,cover:drawCover};
function draw(){ (DRAW[type]||drawValue)(); buildTweet(); }

/* ---------- tweet text ---------- */
function buildTweet(){
  const E={value:'🎯',combo:'🎟️',even:'🟢',cover:'🛡️'}[type];
  const tag={value:'PICK DE VALOR',combo:'COMBINADA',even:'SIN RIESGO',cover:'APUESTA CUBIERTA'}[type];
  let body='';
  if(type==='value'){
    body=`${E} ${tag} · ${$('v_comp').value}\n\n${$('v_home').value} vs ${$('v_away').value} (${$('v_time').value})\n\n✅ ${$('v_pick').value} @${$('v_odd').value} (${$('v_book').value})\n📊 Modelo ${$('v_model').value}% · Valor ${$('v_value').value}`;
  } else if(type==='combo'){
    const legs=($('c_legs').value||'').split('\n').map(s=>s.trim()).filter(Boolean).map(l=>'➕ '+l).join('\n');
    body=`${E} ${$('c_name').value} · ${$('c_date').value}\n\n${legs}\n\n💰 Cuota total ${$('c_total').value} · Confianza ${$('c_conf').value}%`;
  } else if(type==='even'){
    const legs=($('e_legs').value||'').split('\n').map(s=>s.trim()).filter(Boolean).join('\n');
    body=`${E} ${tag} · ${$('e_comp').value}\n\n${$('e_home').value} vs ${$('e_away').value}\nApostando a TODO, ganes quien ganes:\n${legs}\n\n💸 Inviertes ${$('e_stake').value}€ y SIEMPRE recuperas más.`;
  } else {
    const stake=parseFloat(($('o_stake').value||'0').replace(',','.'))||0;
    const legs=($('o_legs').value||'').split('\n').map(s=>s.trim()).filter(Boolean).map(line=>{
      const m=line.match(/^(.*?)@\s*([\d.,]+)\s*(?:·\s*(.*))?$/);
      return { pick:m?m[1].trim():line, odd:m?parseFloat(m[2].replace(',','.')):0, book:m&&m[3]?m[3].trim():'' };
    });
    const backIdx=Math.min(Math.max((parseInt($('o_back').value||'1',10)||1)-1,0),legs.length-1);
    let othersStake=0;legs.forEach((l,i)=>{ if(i!==backIdx && l.odd) othersStake+=stake/l.odd; });
    const split=legs.map((l,i)=> i===backIdx ? {...l, st: stake-othersStake} : {...l, st: l.odd?stake/l.odd:0});
    const backLeg=split[backIdx]||split[0];
    const winNet=backLeg?(backLeg.st*backLeg.odd)-stake:0;
    const lines=split.map((l,i)=>`${i===backIdx?'⭐':'➕'} ${l.pick}: pon ${l.st.toFixed(2)}€ @${l.odd.toFixed(2)}${l.book?' ('+l.book+')':''}`).join('\n');
    body=`${E} ${tag} · ${$('o_comp').value}\n\n${$('o_home').value} vs ${$('o_away').value}\n\n${lines}\n\n✅ Si gana ${backLeg?backLeg.pick:''}: +${winNet.toFixed(2)}€\n➖ Si sale otro: 0€ (recuperas tu apuesta)`;
  }
  $('tweet').textContent = body + `\n\n👉 ${THEME.site}  #${SPORT==='tennis'?'Tenis':'Apuestas'}DeValor +18`;
}
window.copyTweet=()=>{navigator.clipboard.writeText($('tweet').textContent).then(()=>{const b=event.target;const o=b.textContent;b.textContent='✓ Copiado';setTimeout(()=>b.textContent=o,1400);});};
window.download=()=>{draw();cv.toBlob(b=>{const a=document.createElement('a');a.download=THEME.site.split('.')[0]+'-'+type+'.png';a.href=URL.createObjectURL(b);a.click();},'image/png');};

// type switcher
document.querySelectorAll('#type button').forEach(b=>b.addEventListener('click',()=>{
  document.querySelectorAll('#type button').forEach(z=>z.classList.remove('on'));b.classList.add('on');type=b.dataset.t;
  document.querySelectorAll('.fields').forEach(f=>f.classList.toggle('on',f.dataset.f===type));
  draw();
}));
document.querySelectorAll('input,textarea').forEach(el=>el.addEventListener('input',draw));
if(document.fonts&&document.fonts.ready)document.fonts.ready.then(draw);
draw();setTimeout(draw,400);
})();
