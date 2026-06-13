/* GET /api/me → { plan: 'free' | 'ladder' } */
import { readToken, getCookie, json } from './_auth.js';

export async function onRequestGet(context){
    const { request, env } = context;
    if (!env.AUTH_SECRET) return json({ plan:'free', backend:false });
    const plan = await readToken(getCookie(request, 'ace_access'), env.AUTH_SECRET);
    return json({ plan, backend:true });
}
