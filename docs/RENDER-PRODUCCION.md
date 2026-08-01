# Producción Render — Infinity Operaciones

## URL correcta (única)

**https://infinity-operaciones-b3ij.onrender.com**

Servicio Render: `infinity-operaciones-b3ij`

## URL incorrecta (huérfano — eliminar)

**https://infinity-operaciones-b3ij-3z9n.onrender.com**

No debe recibir deploys. Suele quedar como Preview / servicio duplicado.

---

## Corregir el Deploy Hook (causa raíz)

Los pushes a `main` construyen la imagen en GHCR y luego hacen POST al secret `RENDER_DEPLOY_HOOK`.

Si ese hook es del servicio **3z9n**, la producción real (**b3ij**) nunca se actualiza.

### Pasos

1. Entra a [dashboard.render.com](https://dashboard.render.com)
2. Abre el servicio **`infinity-operaciones-b3ij`** (sin `-3z9n`)
3. **Settings** → **Deploy Hook** → copiar la URL
4. GitHub → repo `infinity-operaciones` → **Settings** → **Secrets and variables** → **Actions**
5. Crear/actualizar secret **`RENDER_DEPLOY_HOOK`** con esa URL (debe ser del b3ij)
6. En Render → **b3ij** → **Manual Deploy** → Deploy latest image (Clear build cache si hace falta)
7. Verificar: https://infinity-operaciones-b3ij.onrender.com/api/health → `gitShaShort` reciente

### Eliminar el huérfano 3z9n

1. Render → servicio **`infinity-operaciones-b3ij-3z9n`**
2. **Settings** → abajo → **Suspend** o **Delete Web Service**
3. Confirmar

Si no aparece en la lista principal: **Blueprints / Preview Environments** / servicios archivados.

---

## Comprobar después

| Host | Esperado |
|------|----------|
| `…-b3ij.onrender.com/api/health` | SHA reciente (`d561411` / `8f993a7`+) |
| `…-b3ij-3z9n…` | Suspendido / 404 / no debe usarse |

Menú **Soporte Remoto** → `/help-desk` solo en **b3ij** actualizado.
