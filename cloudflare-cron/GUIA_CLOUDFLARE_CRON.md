# 🤖 Robot fiable con Cloudflare (cron) — paso a paso

GitHub a veces no dispara el robot por las mañanas. Esto hace que **Cloudflare** lo dispare cada día de forma puntual. Tu robot no cambia: solo le ponemos un despertador fiable.

⏱️ Tiempo: ~10 minutos. Solo se hace una vez.

---

## PARTE A — Crear un token de GitHub (el "permiso")

1. Entra en GitHub → arriba a la derecha, tu foto → **Settings**.
2. Abajo del todo, menú izquierdo → **Developer settings**.
3. **Personal access tokens** → **Fine-grained tokens** → botón **Generate new token**.
4. Rellena:
   - **Token name:** `golvalue-cron`
   - **Expiration:** `No expiration` (o 1 año).
   - **Repository access** → **Only select repositories** → elige tu repo (el de la web).
   - **Permissions** → **Repository permissions** → busca **Actions** → ponlo en **Read and write**.
5. Abajo → **Generate token** → **COPIA el token** (empieza por `github_pat_...`). ⚠️ Solo se ve una vez, guárdalo.

---

## PARTE B — Crear el Worker en Cloudflare

1. Entra en **dash.cloudflare.com** → menú izquierdo → **Workers & Pages**.
2. **Create application** → **Create Worker**.
3. Nombre: `golvalue-cron` → **Deploy** (despliega el de ejemplo, lo cambiamos ahora).
4. Pulsa **Edit code**.
5. Borra todo lo que haya y **pega el contenido de `worker.js`** (el archivo de esta carpeta).
6. Arriba a la derecha → **Deploy** (Save and deploy).

---

## PARTE C — Configurar las variables y el secreto

En la página del Worker → pestaña **Settings** → **Variables and Secrets**:

1. **Variables de texto** (botón Add variable), crea estas 4:
   | Nombre | Valor |
   |---|---|
   | `OWNER` | tu usuario de GitHub (ej. `pablo123`) |
   | `REPO` | el nombre del repo (ej. `wordlcup`) |
   | `WORKFLOW` | `daily-odds.yml` |
   | `BRANCH` | `main` |

2. **Secreto** (botón Add → tipo **Secret**), crea 1:
   | Nombre | Valor |
   |---|---|
   | `GH_TOKEN` | el token `github_pat_...` que copiaste |

3. **Deploy / Save** para guardar.

> 💡 ¿No sabes tu OWNER y REPO? Mira la URL de tu repo en GitHub:
> `github.com/OWNER/REPO` → ej. `github.com/pablo123/wordlcup` → OWNER=`pablo123`, REPO=`wordlcup`.

---

## PARTE D — Poner el horario (el cron)

En el Worker → **Settings** → **Triggers** (o **Cron Triggers**) → **Add Cron Trigger**:

- Escribe: `0 7 * * *`  → se ejecuta cada día a las **07:00 UTC** (= 09:00 en España).
- **Add** / **Save**.

(Si lo quieres a otra hora: el primer número son minutos, el segundo la hora en UTC. España = UTC+2 en verano, así que resta 2.)

---

## PARTE E — Probar que funciona AHORA (sin esperar a mañana)

1. En el Worker, arriba, copia su URL (algo como `https://golvalue-cron.TUNOMBRE.workers.dev`).
2. Ábrela en el navegador.
3. Debe salir: **`GitHub dispatch: 204 ✅ robot lanzado`**.
4. Ve a GitHub → pestaña **Actions** → verás el robot **ejecutándose** en unos segundos.
5. Cuando acabe (verde ✓), abre `tudominio.online/daily.json` y mira que `updatedAt` es de ahora. 🎉

Si sale `❌`: revisa que `OWNER`, `REPO` y `GH_TOKEN` están bien escritos (sin espacios) y que el token tiene permiso **Actions: Read and write**.

---

## ¿Y ya está?
Sí. A partir de ahora Cloudflare despierta a GitHub cada mañana y el robot actualiza la web solo. No tienes que tocar nada más.

> Nota: esto **no sustituye** al robot — lo **dispara**. El robot (`robot/fetch-daily.js`) y su workflow (`.github/workflows/daily-odds.yml`) siguen siendo los que hacen el trabajo y guardan `daily.json`.
