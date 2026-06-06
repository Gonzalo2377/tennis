# 🎾 ACEVALUE — disparar "Tennis results" puntual con Cloudflare

GitHub retrasa/salta los cron. Esto hace que **Cloudflare** dispare el workflow de resultados (ESPN/api-tennis, gratis) cada pocas horas, puntual. ~10 min, una vez.

## PARTE A — Token de GitHub
1. GitHub → tu foto → **Settings** → abajo **Developer settings**.
2. **Personal access tokens → Fine-grained tokens → Generate new token**.
3. Name: `acevalue-cron` · Expiration: `No expiration`.
4. **Repository access → Only select repositories →** elige tu repo de tenis.
5. **Permissions → Repository permissions → Actions → Read and write**.
6. **Generate token** → **COPIA** el `github_pat_...` (solo se ve una vez).

## PARTE B — Worker en Cloudflare
1. dash.cloudflare.com → **Workers & Pages → Create → Create Worker**.
2. Nombre: `acevalue-cron` → **Deploy**.
3. **Edit code** → borra todo → pega el contenido de `worker.js` (esta carpeta) → **Deploy**.

## PARTE C — Variables + secreto
Worker → **Settings → Variables and Secrets**:
| Tipo | Nombre | Valor |
|---|---|---|
| Variable | `OWNER` | tu usuario GitHub (ej. `Gonzalo2377`) |
| Variable | `REPO` | el repo (ej. `tennis`) |
| Variable | `WORKFLOW` | `results.yml` |
| Variable | `BRANCH` | `main` |
| **Secret** | `GH_TOKEN` | el token `github_pat_...` |

Guarda/Deploy.

## PARTE D — Horario (cron)
Worker → **Settings → Triggers → Cron Triggers → Add**:
- `0 9,12,15,18,21 * * *`  → 5 veces al día (UTC). Ajusta si quieres.

## PARTE E — Probar ahora
1. Copia la URL del worker (`https://acevalue-cron.TUNOMBRE.workers.dev`).
2. Ábrela en el navegador → debe salir **`GitHub dispatch: 204 ✅`**.
3. GitHub → Actions → verás "Tennis results" ejecutándose.

Listo: Cloudflare dispara los resultados puntual, gratis, cada pocas horas. No sustituye al robot — lo despierta.
