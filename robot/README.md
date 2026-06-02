# MUNDIAL VALUE — robot diario (automatización)

Esto hace que la web **se actualice sola cada mañana** sin que toques nada.

## Qué hace
1. Llama **una vez al día** a The Odds API (partidos + cuotas de varias casas, en una sola petición).
2. Mapea cada selección, calcula la probabilidad con **el mismo modelo que la web** (Elo desde ranking FIFA + forma + Poisson/Dixon-Coles).
3. Detecta el **valor** (modelo vs mercado) y genera las **combinadas** del día.
4. Escribe `mundial/daily.json`. La web lo lee al cargar (si no existe, usa los datos de ejemplo).

## Puesta en marcha (una sola vez)

### Opción A — GitHub Actions (gratis, recomendado)
1. Sube este proyecto a un repositorio de GitHub.
2. **Regenera tu API key** en The Odds API (la anterior quedó expuesta) y cópiala.
3. En el repo: **Settings → Secrets and variables → Actions → New repository secret**
   - Nombre: `ODDS_API_KEY`
   - Valor: tu clave
4. Listo. El workflow `.github/workflows/daily-odds.yml` se ejecuta cada día a las 07:00 UTC
   y hace commit de `mundial/daily.json`. Puedes lanzarlo a mano en la pestaña **Actions → Daily odds robot → Run workflow**.
5. Si publicas con **GitHub Pages**, la web queda actualizada automáticamente al hacer commit.

### Opción B — tu propio hosting (donde tienes AdSense)
Ejecuta el script en un cron de tu servidor y deja el `daily.json` junto al `index.html`:
```bash
ODDS_API_KEY=tu_clave node mundial/robot/fetch-daily.js
```
Programa ese comando cada mañana (cron de Linux, tarea de cPanel, Vercel Cron, etc.).

## Probarlo ahora mismo
```bash
cd mundial/robot
ODDS_API_KEY=tu_clave node fetch-daily.js
# genera ../daily.json
```
> El Mundial usa la clave de deporte `soccer_fifa_world_cup`. **Fuera de temporada** esa clave no
> devuelve partidos; para probar antes del torneo, exporta otra, p. ej.:
> `ODDS_SPORT=soccer_uefa_champs_league ODDS_API_KEY=... node fetch-daily.js`
> (lista de claves: `https://api.the-odds-api.com/v4/sports/?apiKey=TU_CLAVE`).

## Variables de entorno
| Variable | Por defecto | Para qué |
|---|---|---|
| `ODDS_API_KEY` | — (obligatoria) | Tu clave de The Odds API |
| `ODDS_SPORT` | `soccer_fifa_world_cup` | Clave del deporte/competición |
| `ODDS_REGIONS` | `eu` | Casas por región: `eu`, `uk`, `us`, `au` (separadas por coma). **Cada región gasta 1 crédito** por llamada |

Con el plan **Starter (500 créditos/mes)** y 1 región, una llamada diaria gasta ~30 créditos/mes. Tienes margen de sobra para llamar varias veces al día o añadir regiones.

## Editar las selecciones / el modelo
- **Selecciones** (ranking FIFA, colores, forma): edita `TEAMS_DB` arriba en `fetch-daily.js`.
  Cualquier equipo que no esté en la lista entra con valores por defecto (ranking 55, color neutro).
- **Modelo**: las funciones del modelo en `fetch-daily.js` son **idénticas** a `mundial/model.js`.
  Si tocas una, toca la otra para que web y robot coincidan.

## Pendiente (siguiente nivel)
- **Liquidación automática del récord**: ahora el `RECORD` se conserva entre días pero los resultados
  (ganada/fallada) se marcan a mano. Para automatizarlo se usa el **Scores API** de The Odds API
  (`/v4/sports/{sport}/scores/`), que devuelve el resultado final de cada partido.
- **Cobro Premium (3,99 € / 14,99 €)**: requiere Stripe. La interfaz de planes ya está; falta enchufar el pago.
