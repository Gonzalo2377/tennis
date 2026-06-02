/* GET /api/verify?session_id=...
   Stripe redirects here after payment. We confirm the session is
   really paid, then set a signed HttpOnly cookie with the plan and
   bounce the user back to the site. The browser can't forge it.
   Env: STRIPE_SECRET_KEY, AUTH_SECRET (any long random string)
*/
import { makeToken } from './_auth.js';

export async function onRequestGet(context) {
    const { request, env } = context;
    const url = new URL(request.url);
    const sid = url.searchParams.get('session_id');
    const home = `${url.origin}/#/premium`;
    if (!sid || !env.STRIPE_SECRET_KEY || !env.AUTH_SECRET) return Response.redirect(home, 302);

    const r = await fetch(`https://api.stripe.com/v1/checkout/sessions/${sid}`, {
        headers: { 'Authorization': `Bearer ${env.STRIPE_SECRET_KEY}` },
    });
    const s = await r.json();

    let plan = 'free', ttl = 0;
    const paid = s && (s.payment_status === 'paid' || s.status === 'complete');
    if (paid) {
        if (s.mode === 'subscription') { plan = 'all';    ttl = 60 * 60 * 24 * 31; }  // ~1 month, re-checked on renewal
        else                          { plan = 'single';  ttl = 60 * 60 * 24 * 3; }   // acca of the day: 3 days
    }
    if (plan === 'free') return Response.redirect(home, 302);

    const token = await makeToken(plan, ttl, env.AUTH_SECRET);
    const headers = new Headers({ 'Location': `${url.origin}/?unlocked=${plan}#/premium` });
    headers.append('Set-Cookie', `mv_access=${token}; Path=/; Max-Age=${ttl}; HttpOnly; Secure; SameSite=Lax`);
    return new Response(null, { status: 302, headers });
}
