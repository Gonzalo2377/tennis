/* ============================================================
   ACEVALUE — disparador de cron en Cloudflare (tenis)
   ------------------------------------------------------------
   Cloudflare ejecuta cron PUNTUALMENTE (GitHub no). Este Worker
   despierta cada pocas horas y le dice a GitHub: "ejecuta el
   workflow de resultados (Tennis results)".
   Variables en el panel de Cloudflare (ver guía .md):
     OWNER    → tu usuario de GitHub (ej. "Gonzalo2377")
     REPO     → el repositorio (ej. "tennis")
     WORKFLOW → "results.yml"
     BRANCH   → "main"
     GH_TOKEN → token de GitHub con permiso de Actions (secreto)
   ============================================================ */
async function trigger(env){
  const url = `https://api.github.com/repos/${env.OWNER}/${env.REPO}/actions/workflows/${env.WORKFLOW}/dispatches`;
  return fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.GH_TOKEN}`,
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'acevalue-cron',
    },
    body: JSON.stringify({ ref: env.BRANCH || 'main' }),
  });
}
export default {
  async scheduled(event, env, ctx){ const r = await trigger(env); console.log('GitHub dispatch →', r.status); },
  async fetch(request, env, ctx){
    const r = await trigger(env);
    return new Response('GitHub dispatch: ' + r.status + (r.status === 204 ? ' ✅ resultados lanzados' : ' ❌ revisa OWNER/REPO/WORKFLOW/GH_TOKEN'), { status: 200 });
  },
};
