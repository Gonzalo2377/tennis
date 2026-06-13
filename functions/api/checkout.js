/* POST /api/checkout  { tier: 'ladder' }
   Crea una sesión de Stripe Checkout (suscripción) y devuelve su URL.
   Env vars (Cloudflare → Settings → Environment variables):
     STRIPE_SECRET_KEY    sk_live_... (o sk_test_...)
     STRIPE_PRICE_LADDER  price_...   (2,49 €/mes recurrente)
*/
import { json } from './_auth.js';

export async function onRequestPost(context){
    const { request, env } = context;
    if (!env.STRIPE_SECRET_KEY) return json({ error:'backend_not_configured' }, 501);

    let tier = 'ladder';
    try { tier = (await request.json()).tier || 'ladder'; } catch (e) {}

    const price = env.STRIPE_PRICE_LADDER;
    if (!price) return json({ error:'price_not_configured' }, 500);

    const origin = new URL(request.url).origin;
    const body = new URLSearchParams();
    body.set('mode', 'subscription');
    body.set('line_items[0][price]', price);
    body.set('line_items[0][quantity]', '1');
    body.set('allow_promotion_codes', 'true');
    body.set('success_url', `${origin}/api/verify?session_id={CHECKOUT_SESSION_ID}`);
    body.set('cancel_url', `${origin}/#/reto`);

    const r = await fetch('https://api.stripe.com/v1/checkout/sessions', {
        method:'POST',
        headers:{ 'Authorization':`Bearer ${env.STRIPE_SECRET_KEY}`, 'Content-Type':'application/x-www-form-urlencoded' },
        body,
    });
    const s = await r.json();
    if (!r.ok) return json({ error:(s.error && s.error.message) || 'stripe_error' }, 500);
    return json({ url: s.url });
}
