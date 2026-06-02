/* ============================================================
   GOLVALUE — disparador de cron en Cloudflare
   ------------------------------------------------------------
   Cloudflare ejecuta cron PUNTUALMENTE (GitHub no). Este Worker
   se despierta cada mañana y le dice a GitHub: "ejecuta el robot".
   Así tu robot (robot/fetch-daily.js) sigue igual, pero el disparo
   es fiable.

   QUÉ NECESITAS (todo en el panel de Cloudflare, ver guía .md):
     · Variable  OWNER     → tu usuario de GitHub (ej. "pablo123")
     · Variable  REPO      → el nombre del repositorio (ej. "wordlcup")
     · Variable  WORKFLOW  → "daily-odds.yml"
     · Variable  BRANCH    → "main"
     · SECRETO   GH_TOKEN  → un token de GitHub con permiso de Actions
   ============================================================ */
export default {
  async scheduled(event, env, ctx) {
    const url = `https://api.github.com/repos/${env.OWNER}/${env.REPO}/actions/workflows/${env.WORKFLOW}/dispatches`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.GH_TOKEN}`,
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'golvalue-cron',
      },
      body: JSON.stringify({ ref: env.BRANCH || 'main' }),
    });
    console.log('GitHub dispatch →', res.status, await res.text());
  },

  // permite probarlo a mano abriendo la URL del worker en el navegador
  async fetch(request, env, ctx) {
    const url = `https://api.github.com/repos/${env.OWNER}/${env.REPO}/actions/workflows/${env.WORKFLOW}/dispatches`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.GH_TOKEN}`,
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'golvalue-cron',
      },
      body: JSON.stringify({ ref: env.BRANCH || 'main' }),
    });
    return new Response('GitHub dispatch: ' + res.status + (res.status === 204 ? ' ✅ robot lanzado' : ' ❌ revisa OWNER/REPO/GH_TOKEN'), { status: 200 });
  },
};
