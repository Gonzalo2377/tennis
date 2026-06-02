# MUNDIAL VALUE — Guía de instalación (paso a paso)

Todo lo que necesitas para poner la web en marcha y que **se actualice sola cada día**.
Solo tendrás que pegar **2 cosas**: tu clave de The Odds API (en el robot) y tus enlaces de Stripe (en `config.js`).

---

## 0) Qué es cada cosa
```
mundial/
├── index.html          La web
├── config.js           ← TÚ EDITAS: enlaces de Stripe + ajustes
├── theme.css           Estilos
├── data.js             Datos de EJEMPLO (respaldo si aún no hay daily.json)
├── model.js            Modelo de probabilidad (Elo+forma+Poisson/Dixon-Coles)
├── components.jsx, views1.jsx, views2.jsx, app.jsx   La aplicación
├── daily.json          ← lo genera el robot cada día (datos reales)
└── robot/
    ├── fetch-daily.js  El robot (llama a la API y genera daily.json)
    └── README.md
.github/workflows/daily-odds.yml   El cron que ejecuta el robot cada mañana
```
> **Importante:** la web **nunca** llama a The Odds API. Solo lo hace el robot, **1 vez al día**.
> Los visitantes solo leen `daily.json` (archivo estático) → **0 créditos**, tengas las visitas que tengas.
> Además la web cachea los datos en el navegador (`config.cacheHours`).

---

## 1) Tu clave de The Odds API
1. **Regenera la clave** en tu panel de The Odds API (la que pegaste en el chat quedó expuesta).
2. Guárdala; la usarás en el paso 3 (va como *secret*, **nunca** dentro de la web).

> La clave de deporte para el Mundial es `soccer_fifa_world_cup`. **Solo devuelve partidos cuando las casas
> listan el torneo** (cerca de junio). Para **probar antes**, usa una liga en temporada (ver paso 5).

---

## 2) Sube el proyecto a GitHub
1. Crea un repositorio nuevo en GitHub.
2. Sube **todo** el contenido de este proyecto (incluida la carpeta `.github`).

---

## 3) Configura el robot (la automatización)
En tu repo de GitHub:
1. **Settings → Secrets and variables → Actions → New repository secret**
   - Name: `ODDS_API_KEY`
   - Value: tu clave
2. Ya está. El workflow `.github/workflows/daily-odds.yml` se ejecuta **cada día a las 07:00 UTC**,
   genera `mundial/daily.json` y hace commit. Para lanzarlo ahora mismo:
   **Actions → “Daily odds robot” → Run workflow**.

---

## 4) Publica la web (elige UNA)

### Opción A — GitHub Pages (lo más simple, todo en GitHub)
1. **Settings → Pages → Build and deployment → Source: Deploy from a branch**.
2. Branch: `main`, carpeta `/ (root)`. Guarda.
3. Tu web quedará en `https://TU-USUARIO.github.io/TU-REPO/mundial/`.
   - Si la quieres en la raíz, mueve el contenido de `mundial/` a la raíz del repo
     (y en el workflow cambia las rutas `mundial/...` por las nuevas).

### Opción B — Cloudflare Pages (hosting más rápido + dominio propio fácil)
1. En Cloudflare: **Workers & Pages → Create → Pages → Connect to Git** y elige tu repo.
2. Build command: *(vacío)* · Output directory: `mundial`.
3. Deploy. El cron sigue corriendo en **GitHub Actions** (Cloudflare solo sirve la web).
   Cada vez que el robot hace commit de `daily.json`, Cloudflare republica solo.

> Las dos son **gratis**. Si tienes dominio propio, los dos permiten conectarlo.

---

## 5) Probar el robot ahora (fuera de temporada del Mundial)
En tu ordenador (Node 18 o superior):
```bash
cd mundial/robot

# Mundial (cuando esté listado por las casas):
ODDS_API_KEY=tu_clave node fetch-daily.js

# Para PROBAR ya con fútbol en temporada, cambia el deporte:
ODDS_SPORT=soccer_uefa_champs_league ODDS_API_KEY=tu_clave node fetch-daily.js
# o, para escanear todo y filtrar fútbol automáticamente:
ODDS_SPORT=upcoming ODDS_API_KEY=tu_clave node fetch-daily.js
```
Genera `mundial/daily.json`. Abre `mundial/index.html` y verás los datos reales.

**Ver la lista de claves de deporte disponibles:**
`https://api.the-odds-api.com/v4/sports/?apiKey=TU_CLAVE`

### Variables del robot
| Variable | Por defecto | Para qué |
|---|---|---|
| `ODDS_API_KEY` | — (obligatoria) | Tu clave |
| `ODDS_SPORT` | `soccer_fifa_world_cup` | Competición |
| `ODDS_REGIONS` | `eu` | `eu`,`uk`,`us`,`au` (coma). **Cada región = 1 crédito/llamada** |
| `ODDS_BOOKS` | (todas) | Filtrar casas, p. ej. `bet365,betfair,winamax,pinnacle` |

Con el plan **Starter (500 créditos/mes)** y 1 región, 1 llamada/día ≈ **30 créditos/mes**. Margen de sobra.

---

## 6) Cobro Premium con Stripe — dos opciones

### 6A) Rápida (sin backend) — para empezar HOY
Sirve para validar, pero el acceso es "blando": se recuerda en el navegador y alguien podría compartir la URL de desbloqueo.
1. En **Stripe → Payment Links** crea **dos**:
   - **3,99 € pago único** → la "Combinada del día".
   - **14,99 €/mes (suscripción)** → todas las combinadas.
2. En cada Payment Link: **After payment → Redirect to a URL**:
   - 3,99 €: `https://TU-DOMINIO/?unlocked=single`
   - 14,99 €: `https://TU-DOMINIO/?unlocked=all`
3. Pega las dos URLs en **`mundial/config.js`** (`stripe.single` y `stripe.all`).

### 6B) De verdad (recomendada) — control de acceso real con Cloudflare
La web ya trae un mini-backend en `mundial/functions/api/` (solo funciona en **Cloudflare Pages**, opción 4B).
El visitante paga, Stripe confirma el pago **en el servidor**, y se entrega una cookie firmada que el navegador **no puede falsificar**. Sin Payment Links, sin base de datos.

**Qué tienes que hacer:**
1. En **Stripe → Productos** crea dos precios y copia sus IDs (`price_...`):
   - Precio único 3,99 € → `STRIPE_PRICE_SINGLE`
   - Precio recurrente 14,99 €/mes → `STRIPE_PRICE_ALL`
2. Copia tu **clave secreta** de Stripe (`sk_live_...` o `sk_test_...`) → `STRIPE_SECRET_KEY`.
3. Inventa una cadena larga y aleatoria para firmar las cookies → `AUTH_SECRET`
   (p. ej. genera una en https://generate-secret.now.sh/64 o escribe 40+ caracteres al azar).
4. En **Cloudflare Pages → tu proyecto → Settings → Environment variables**, añade las 4:
   `STRIPE_SECRET_KEY`, `STRIPE_PRICE_SINGLE`, `STRIPE_PRICE_ALL`, `AUTH_SECRET`. Vuelve a desplegar.
5. **No necesitas tocar `config.js`** para esto: la web detecta el backend sola
   (botón → `/api/checkout` → Stripe → `/api/verify` pone la cookie → `/api/me` dice el plan).

**Cómo da acceso, en cristiano:** el botón llama a `/api/checkout`, que crea la sesión de pago de Stripe;
al pagar, Stripe devuelve al usuario a `/api/verify`, que **comprueba con Stripe que el pago es real** y
deja una cookie segura (3 días para la combinada, ~1 mes para la suscripción). En cada visita, `/api/me`
lee esa cookie y decide qué desbloquear.

> **Mejora opcional (más adelante):** un *webhook* de Stripe para cortar el acceso al instante si alguien
> cancela o le rechazan el cobro de la suscripción. Sin webhook, el acceso caduca solo al mes y se revalida
> en la siguiente compra/renovación. Te lo monto cuando quieras.

> ⚠️ **Nunca** pongas `STRIPE_SECRET_KEY` ni `AUTH_SECRET` en `config.js` ni en ningún `.js` del navegador:
> esas claves van **solo** en las variables de entorno de Cloudflare (en el servidor).

---

## 7) Liquidación automática del récord (¡YA INCLUIDA!)
El robot **marca solo** cada pick como GANADA/FALLADA usando los resultados reales:
- Cada día guarda el/los pick(s) de valor destacados como **pendientes** (campo `PENDING` en `daily.json`).
- En las siguientes ejecuciones consulta el endpoint **`/scores`** de The Odds API **solo de las
  competiciones que tienen un pick pendiente** (para no gastar créditos de más) y, cuando el partido
  termina, lo pasa al **récord** con su resultado y beneficio. El récord de la web se actualiza solo.
- No tienes que hacer **nada**.

> 💳 Créditos: el endpoint de resultados (`/scores` con `daysFrom`) gasta créditos aparte. Por eso solo se
> consulta para las competiciones con picks pendientes (normalmente 1–3 al día). Si algún mes te acercas al
> límite de 500, reduce la lista de competiciones en el workflow (`ODDS_SPORT`).

---

## Resumen de lo que tienes que tocar TÚ
- [ ] **Nombre de la web**: edita `brand` en `mundial/config.js` (ahora pone `GOL` + `VALUE`).
- [ ] `ODDS_API_KEY` como *secret* en GitHub (paso 3).
- [ ] **Premium**: o bien 2 Payment Links en `config.js` (rápido, 6A), o bien las 4 variables de Stripe en Cloudflare (recomendado, 6B).
- [ ] (Cuando empiece el Mundial) confirmar que `ODDS_SPORT=soccer_fifa_world_cup` devuelve partidos.

## Sobre "todo el fútbol" ahora y el Mundial después
- El robot **ya filtra solo fútbol** y vale para cualquier competición: cambia `ODDS_SPORT` a la liga en
  temporada (o `upcoming` para todo el fútbol del día). **No hay que cambiar código** cuando llegue el Mundial:
  pones `ODDS_SPORT=soccer_fifa_world_cup` y los partidos pasan a ser de selecciones automáticamente.
- **Matiz del valor:** el modelo calcula "valor" para selecciones (ranking FIFA en `TEAMS_DB`) **y para
  clubes** (rating Elo en `CLUBS_DB`, dentro de `robot/fetch-daily.js`). Si aparece un equipo que no está en
  ninguna de las dos listas, la web lo muestra con su comparador de cuotas pero usa la probabilidad del
  mercado y **no inventa valor**. Para añadir clubes o retocar su fuerza, edita `CLUBS_DB` (campo `elo`).

Nada más. El resto va solo. 🟡
