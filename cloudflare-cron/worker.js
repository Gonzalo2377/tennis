/* ============================================================
   ACEVALUE — disparador de cron en Cloudflare (tenis)
   ------------------------------------------------------------
   Igual que en el fútbol: Cloudflare despierta a GitHub cada
   mañana para ejecutar el robot del tenis (es puntual; el cron
   de GitHub no). El robot (robot/fetch-daily.js) no cambia.

   Variables (en el panel de Cloudflare → Settings → Variables):
     · OWNER     → tu usuario de GitHub (ej. "Gonzalo2377")
     · REPO      → el repo del TENIS (ej. "acevalue")
     · WORKFLOW  → "daily-tennis.yml"
     · BRANCH    → "main"
     · GH_TOKEN  → (SECRET) token de GitHub con permiso Actions: Read and write
   ============================================================ */
export default {
  async scheduled(event, env, ctx) {
    await dispatch(env);
  },
  // permite probarlo abriendo la URL del worker en el navegador
  async fetch(request, env, ctx) {
    const status = await dispatch(env);
    return new Response(
      'GitHub dispatch: ' + status + (status === 204 ? ' ✅ robot de tenis lanzado' : ' ❌ revisa OWNER/REPO/GH_TOKEN'),
      { status: 200 }
    );
  },
};

async function dispatch(env){
  const url = `https://api.github.com/repos/${env.OWNER}/${env.REPO}/actions/workflows/${env.WORKFLOW}/dispatches`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.GH_TOKEN}`,
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'acevalue-cron',
    },
    body: JSON.stringify({ ref: env.BRANCH || 'main' }),
  });
  console.log('GitHub dispatch →', res.status, await res.text());
  return res.status;
}
