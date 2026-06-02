# ACEVALUE — puesta en marcha (tenis)

Web de cuotas de tenis con **valor**, **apuestas sin riesgo** (surebets), **combinadas** y **récord**. Se actualiza sola cada día con The Odds API. Sin premium (de momento).

## 1. Subir a GitHub + Cloudflare Pages
1. Crea un repositorio nuevo en GitHub (ej. `acevalue`).
2. Sube **todo el contenido de la carpeta `tennis/`** a la RAÍZ del repo (que `index.html` quede en la raíz, no dentro de `tennis/`).
3. En Cloudflare → **Workers & Pages → Create → Pages → Connect to Git** → elige el repo → Deploy. Sin build command; carpeta de salida `/`.

## 2. Conectar la API (The Odds API)
1. En GitHub → repo → **Settings → Secrets and variables → Actions → New repository secret**.
2. Nombre: `ODDS_API_KEY` · Valor: tu clave (la que te dieron).
3. Settings → Actions → General → **Workflow permissions** → **Read and write**.
4. Ve a **Actions → Daily tennis robot → Run workflow** para lanzarlo a mano la primera vez.
5. Abre `tudominio/daily.json` y comprueba que `updatedAt` es de ahora. ¡Listo!

A partir de ahí se ejecuta solo cada mañana. (Si el cron de GitHub no dispara, usa el mismo truco del Worker de Cloudflare que en la web de fútbol.)

## 3. Ajustes rápidos
- Más/menos torneos: variable `ODDS_MAX` en el workflow.
- Ventana de días: `ODDS_WINDOW_HOURS` (96 = 4 días).
- Idioma por defecto y caché: `config.js`.

## Notas
- El tenis es a **2 vías** (sin empate), por eso la sección **Sin Riesgo** encuentra oportunidades a menudo. Aun así cambian en segundos: verifica la cuota en la casa antes de apostar.
- Los datos que ves sin conectar la API son de ejemplo; al ejecutar el robot se sustituyen por partidos reales.
- +18 · Juego responsable. Contenido informativo, no es consejo de inversión.
