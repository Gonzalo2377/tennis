/* POST /api/checkout  { tier: 'single' | 'all' }
   Creates a Stripe Checkout Session and returns its URL.
   Env vars (Cloudflare → Settings → Environment variables):
     STRIPE_SECRET_KEY   sk_live_... (or sk_test_...)
     STRIPE_PRICE_SINGLE price_...   (3,99 € one-off)
     STRIPE_PRICE_ALL    price_...   (14,99 €/mes recurring)
*/
import { json } from './_auth.js';

export async function onRequestPost(context) {
    const { request, env } = context;
    if (!env.STRIPE_SECRET_KEY) return json({ error: 'backend_not_configured' }, 501);

    let tier = 'single';
    try { tier = (await request.json()).tier || 'single'; } catch (e) {}

    const price = tier === 'all' ? env.STRIPE_PRICE_ALL : env.STRIPE_PRICE_SINGLE;
    if (!price) return json({ error: 'price_not_configured' }, 500);

    const origin = new URL(request.url).origin;
    const body = new URLSearchParams();
    body.set('mode', tier === 'all' ? 'subscription' : 'payment');
    body.set('line_items[0][price]', price);
    body.set('line_items[0][quantity]', '1');
    body.set('allow_promotion_codes', 'true');
    // On success Stripe sends the user to our verify endpoint, which sets the cookie.
    body.set('success_url', `${origin}/api/verify?session_id={CHECKOUT_SESSION_ID}`);
    body.set('cancel_url', `${origin}/#/premium`);

    const r = await fetch('https://api.stripe.com/v1/checkout/sessions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${env.STRIPE_SECRET_KEY}`, 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
    });
    const s = await r.json();
    if (!r.ok) return json({ error: (s.error && s.error.message) || 'stripe_error' }, 500);
    return json({ url: s.url });
}
