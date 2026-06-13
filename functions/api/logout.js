/* POST /api/logout → borra la cookie de acceso */
export async function onRequestPost(context){
    const url = new URL(context.request.url);
    const headers = new Headers({ 'Location':`${url.origin}/#/reto`, 'Content-Type':'application/json' });
    headers.append('Set-Cookie', 'ace_access=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax');
    return new Response(JSON.stringify({ ok:true }), { status:200, headers });
}
