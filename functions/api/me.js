/* GET /api/me → { plan: 'free' | 'single' | 'all' }
   The site calls this on load to know what to unlock. Reads the
   signed cookie set by /api/verify and validates it server-side.
   Env: AUTH_SECRET
*/
import { readToken, getCookie, json } from './_auth.js';

export async function onRequestGet(context) {
    const { request, env } = context;
    if (!env.AUTH_SECRET) return json({ plan: 'free', backend: false });
    const plan = await readToken(getCookie(request, 'mv_access'), env.AUTH_SECRET);
    return json({ plan, backend: true });
}
