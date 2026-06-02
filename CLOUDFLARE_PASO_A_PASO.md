# Publicar GOLVALUE en Cloudflare Pages — PASO A PASO

Resultado final: web publicada en Cloudflare, que **cobra con Stripe** y **da acceso real**
a los que pagan, y que **se actualiza sola cada día**.

Arquitectura (importante): **GitHub guarda el código y ejecuta el robot diario** ·
**Cloudflare aloja la web + el cobro/acceso de Stripe**. Tú casi no tocas GitHub.

---

## PASO 1 · Preparar los archivos
Tienes la carpeta `mundial/`. Vas a subir **su CONTENIDO** (no la carpeta) a la raíz del repo,
así Cloudflare lo detecta todo sin configurar nada raro. Es decir, en la raíz deben quedar:
```
index.html  config.js  theme.css  data.js  model.js
components.jsx  views1.jsx  views2.jsx  app.jsx
functions/   robot/   daily.json (se crea solo)   .github/
```

### Edita SOLO esto antes de subir:
1. **`config.js`** → el nombre de tu web:
   ```js
   brand: { name: 'GOL', accent: 'VALUE', tagline: 'VALOR · FÚTBOL' }
   ```
   (déjalo o cámbialo por tu marca). **No** pongas aquí claves de Stripe ni de la API.

---

## PASO 2 · Subir a GitHub
1. Crea una cuenta en github.com (si no tienes) y un **repositorio nuevo** (privado vale).
2. Sube el **contenido** de `mundial/` a ese repo (botón "Add file → Upload files", arrastra todo).
   - Asegúrate de que `index.html` queda en la raíz del repo, no dentro de una subcarpeta.

---

## PASO 3 · La clave de The Odds API (el robot)
1. **Regenera tu API key** en The Odds API (la anterior se vio en el chat).
2. En tu repo de GitHub: **Settings → Secrets and variables → Actions → New repository secret**
   - Name: `ODDS_API_KEY`  ·  Secret: tu clave  → Add secret.
3. El robot ya está programado (`.github/workflows/daily-odds.yml`) para correr cada mañana.
   Para lanzarlo **ahora**: pestaña **Actions → "Daily odds robot" → Run workflow**.
   Generará `daily.json` y lo subirá al repo.
   - Por defecto usa `ODDS_SPORT: upcoming` (todo el fútbol del día). Cuando empiece el Mundial,
     cambia esa línea del workflow a `soccer_fifa_world_cup` (o déjalo en `upcoming`, también lo incluye).

---

## PASO 4 · Conectar Cloudflare Pages
1. Crea cuenta en **dash.cloudflare.com** (gratis).
2. **Workers & Pages → Create → Pages → Connect to Git** y elige tu repo.
3. Configuración de compilación (déjala así):
   - **Framework preset:** None
   - **Build command:** *(vacío)*
   - **Build output directory:** `/`
4. **Save and Deploy.** En ~1 minuto tendrás una URL tipo `https://tu-proyecto.pages.dev`.
   - Las funciones de `functions/api/*` se activan solas → rutas `/api/checkout`, `/api/verify`, `/api/me`.

> Cada vez que el robot suba un `daily.json` nuevo, Cloudflare **republica solo** con los datos del día.

---

## PASO 5 · Stripe (cobro + acceso real) — la configuración BUENA
Aquí NO usas "Enlaces de pago/Payment Links". Usas **Productos** (el backend crea el pago).

### 5.1 · Crea los productos en Stripe
1. **Stripe → Catálogo de productos → Añadir producto:**
   - Producto 1: *"Combinada del día"* · Precio **3,99 €** · modelo de precios **Único (one-off)**.
   - Producto 2: *"Premium mensual"* · Precio **14,99 €** · modelo **Recurrente · Mensual**.
2. En cada precio, copia su **ID de precio** (empieza por `price_...`). Tendrás dos.

### 5.2 · Copia tu clave secreta
- **Stripe → Desarrolladores → Claves de API → Clave secreta** (`sk_test_...` para probar, `sk_live_...` en real).

### 5.3 · Inventa un secreto para firmar accesos
- Cualquier cadena larga al azar (40+ caracteres). Ej: aporrea el teclado o usa un generador.
  La llamaremos `AUTH_SECRET`.

### 5.4 · Pega las 4 variables en Cloudflare
**Cloudflare → tu proyecto Pages → Settings → Variables and Secrets → Add** (entorno *Production*):
| Nombre | Valor |
|---|---|
| `STRIPE_SECRET_KEY` | tu `sk_test_...` (o `sk_live_...`) |
| `STRIPE_PRICE_SINGLE` | el `price_...` de 3,99 € |
| `STRIPE_PRICE_ALL` | el `price_...` de 14,99 € |
| `AUTH_SECRET` | tu cadena aleatoria |

Marca `STRIPE_SECRET_KEY` y `AUTH_SECRET` como **Secret (encrypt)**. Guarda y pulsa
**Retry deployment** (o Deployments → … → Retry) para que tomen las variables.

> ⚠️ Estas 4 variables van **solo** aquí (servidor). Nunca en `config.js` ni en archivos `.js` del navegador.

### 5.5 · Comprobar que funciona
1. Entra en tu web → **Premium** → "Suscribirme 14,99 €".
2. Te lleva a Stripe. Con clave de prueba usa la tarjeta `4242 4242 4242 4242`, fecha futura, CVC cualquiera.
3. Al pagar, Stripe te devuelve a la web y **las combinadas se desbloquean** (el servidor verifica el pago
   y deja una cookie segura: 3 días la combinada del día, ~1 mes la suscripción).
4. Cuando todo vaya bien con claves de prueba, repite con las claves **live** (`sk_live_` + price IDs live).

---

## PASO 6 · (Opcional) Tu dominio propio
**Cloudflare Pages → tu proyecto → Custom domains → Set up a domain** y sigue los pasos.

---

## ¿Cómo ve un cliente sus picks premium?
- Paga → vuelve a la web → la cookie segura lo identifica → ve **todas** las combinadas (plan 14,99 €)
  o la **combinada del día** (pago 3,99 €). El resto de la web (valor, comparador, récord) es gratis.
- En cada visita, `/api/me` revalida la cookie en el servidor. Al caducar (mes/3 días) se vuelve a pedir pago.

## Resumen de lo que tocas TÚ
- [ ] `config.js`: nombre de la web.
- [ ] GitHub: secret `ODDS_API_KEY`.
- [ ] Cloudflare: 4 variables de Stripe.
- [ ] (Opcional) dominio propio.

## Mejora siguiente (cuando quieras)
**Webhook de Stripe**: para cortar el acceso al instante si alguien cancela o le rechazan el cobro.
Sin él, el acceso simplemente caduca solo (mes/3 días). Pídemelo y lo añado.
