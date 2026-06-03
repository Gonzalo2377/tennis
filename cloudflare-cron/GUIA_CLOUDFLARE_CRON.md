# 🎾 Robot del tenis fiable con Cloudflare (cron)

Igual que hiciste con el fútbol. Cloudflare despierta a GitHub cada mañana para ejecutar el robot del tenis. ~5 min.

## 1. Token de GitHub (puedes REUTILIZAR el del fútbol)
Si el token `golvalue-cron` ya tiene acceso **también al repo del tenis**, sáltate este paso.
Si no, crea uno nuevo (GitHub → Settings → Developer settings → Fine-grained tokens):
- **Repository access** → el repo del TENIS.
- **Permissions → Actions → Read and write**.
- Copia el token `github_pat_...`.

## 2. Crear el Worker
1. Cloudflare → **Workers & Pages → Create → Create Worker**.
2. Nombre: `acevalue-cron` → **Deploy**.
3. **Edit code** → borra todo y pega el contenido de `worker.js` (esta carpeta) → **Deploy**.

## 3. Variables (Settings → Variables and Secrets)
Variables de texto:
| Nombre | Valor |
|---|---|
| `OWNER` | tu usuario de GitHub |
| `REPO` | el repo del **tenis** (ej. `acevalue`) |
| `WORKFLOW` | `daily-tennis.yml` |
| `BRANCH` | `main` |

Secreto:
| Nombre | Valor |
|---|---|
| `GH_TOKEN` | tu token `github_pat_...` |

→ **Deploy/Save**.

## 4. Horario (Settings → Triggers → Cron)
- `0 7 * * *` → 07:00 UTC ≈ **09:00 España**. (El robot de tenis ya tiene su propio cron interno a las 07:17 UTC; con esto te aseguras de que se dispara.)

## 5. Probar AHORA
Abre la URL del worker (`https://acevalue-cron.TUNOMBRE.workers.dev`).
Debe salir: **`GitHub dispatch: 204 ✅ robot de tenis lanzado`**.
Mira GitHub → Actions → "Daily tennis robot" ejecutándose. ✓

¡Listo! Cada mañana el tenis se actualiza solo, igual que el fútbol. 🎾
