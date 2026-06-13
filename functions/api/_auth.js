/* ============================================================
   ACEVALUE — auth helpers (Cloudflare Pages Functions)
   Cookie firmada con HMAC-SHA256. Sin base de datos.
   ============================================================ */
const enc = new TextEncoder();
function b64url(bytes){ let s=btoa(String.fromCharCode(...new Uint8Array(bytes))); return s.replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,''); }
async function hmac(payload, secret){ const key=await crypto.subtle.importKey('raw', enc.encode(secret), {name:'HMAC',hash:'SHA-256'}, false, ['sign']); const sig=await crypto.subtle.sign('HMAC', key, enc.encode(payload)); return b64url(sig); }
export async function makeToken(plan, ttlSeconds, secret){ const exp=Math.floor(Date.now()/1000)+ttlSeconds; const payload=`${plan}.${exp}`; const sig=await hmac(payload, secret); return `${payload}.${sig}`; }
export async function readToken(token, secret){
    if(!token) return 'free';
    const parts=token.split('.'); if(parts.length!==3) return 'free';
    const [plan, exp, sig]=parts;
    const expected=await hmac(`${plan}.${exp}`, secret);
    if(sig!==expected) return 'free';
    if(parseInt(exp,10)*1000 < Date.now()) return 'free';
    return (plan==='ladder'||plan==='all') ? plan : 'free';
}
export function getCookie(request, name){ const c=request.headers.get('Cookie')||''; const m=c.match(new RegExp('(?:^|; )'+name+'=([^;]+)')); return m?decodeURIComponent(m[1]):null; }
export function json(obj, status=200){ return new Response(JSON.stringify(obj), { status, headers:{ 'Content-Type':'application/json', 'Cache-Control':'no-store' } }); }
