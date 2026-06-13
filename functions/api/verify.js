/* GET /api/verify?session_id=...  → confirma el pago y pone la cookie firmada. */
import { makeToken } from './_auth.js';

export async function onRequestGet(context){
    const { request, env } = context;
    const url = new URL(request.url);
    const sid = url.searchParams.get('session_id');
    const home = `${url.origin}/#/reto`;
    if (!sid || !env.STRIPE_SECRET_KEY || !env.AUTH_SECRET) return Response.redirect(home, 302);

    const r = await fetch(`https://api.stripe.com/v1/checkout/sessions/${sid}`, {
        headers:{ 'Authorization':`Bearer ${env.STRIPE_SECRET_KEY}` },
    });
    const s = await r.json();
    const paid = s && (s.payment_status === 'paid' || s.status === 'complete');
    if (!paid) return Response.redirect(home, 302);

    const ttl = 60*60*24*31;   // ~1 mes (se renueva al pagar la siguiente cuota)
    const token = await makeToken('ladder', ttl, env.AUTH_SECRET);
    const headers = new Headers({ 'Location': `${url.origin}/?unlocked=ladder#/reto` });
    headers.append('Set-Cookie', `ace_access=${token}; Path=/; Max-Age=${ttl}; HttpOnly; Secure; SameSite=Lax`);
    return new Response(null, { status: 302, headers });
}
