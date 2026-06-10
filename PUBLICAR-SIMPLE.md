# Publicar en lgbsistemas.ec — guía sencilla

Tu landing **https://lgbsistemas.ec** queda en Hostinger.  
La **app operativa** va en un subdominio: **https://ops.lgbsistemas.ec**

> No hace falta tocar código ni usar Docker. Solo GitHub (ya lo tienes) + Render + un CNAME en Hostinger.

---

## Opción recomendada: Render (más fácil que Railway)

Render conecta la base de datos **automáticamente**. No tienes que buscar ni copiar `DATABASE_URL`.

### 1. Crear cuenta y desplegar (5 min)

1. Entra a [render.com](https://render.com) → **Get Started** → login con **GitHub**.
2. **New +** → **Blueprint**.
3. Conecta el repo: `luisguamanquispe-arch/infinity-operaciones`.
4. Render detecta `render.yaml` y muestra:
   - **Web Service** `infinity-operaciones`
   - **PostgreSQL** `infinity-db`
5. Clic en **Apply**. Espera 5–10 min (build + migraciones).

Cuando termine, tendrás una URL tipo:  
`https://infinity-operaciones-xxxx.onrender.com`

Prueba: `https://TU-URL.onrender.com/login`

### 2. Datos iniciales (usuarios de prueba)

Render **Free no incluye Shell**. Usa una de estas opciones:

**Opción A — Desde tu PC (ahora mismo):**

1. Render → **`infinity-db`** → **Connect** → copia **External Database URL**
2. PowerShell:

```powershell
cd C:\Users\MONITOREO-INFINITY\infinity-operaciones
$env:DATABASE_URL="postgresql://..."   # pegar URL de Render
& "C:\Program Files\nodejs\npm.cmd" run db:seed
```

**Opción B — Automático:** tras push + redeploy, la app crea usuarios si la BD está vacía.

Usuarios de prueba (cámbialos después en `/gerencia/usuarios`):

| Rol | Email | Clave |
|-----|-------|-------|
| Técnico | juan@infinity.ec | tecnico123 |
| Supervisor | supervisor@infinity.ec | super123 |
| Admin | admin@infinity.ec | admin123 |

### 3. Dominio ops.lgbsistemas.ec (Hostinger)

1. Render → **infinity-operaciones** → **Settings** → **Custom Domains**.
2. Agrega: `ops.lgbsistemas.ec`
3. Render muestra un CNAME (ej. `infinity-operaciones-xxxx.onrender.com`).
4. [hpanel.hostinger.com](https://hpanel.hostinger.com) → **Dominios** → `lgbsistemas.ec` → **DNS**:

| Tipo | Nombre | Valor |
|------|--------|-------|
| CNAME | `ops` | el que Render indique |

5. Espera 5–30 min. Prueba: **https://ops.lgbsistemas.ec/login**

### 4. Botón en tu web Hostinger

En la landing **lgbsistemas.ec** (Horizons), agrega un botón:

- Texto: **Ingresar al sistema**
- Enlace: `https://ops.lgbsistemas.ec/login`

---

## Variables opcionales (WhatsApp)

Render → **infinity-operaciones** → **Environment**:

```env
WHATSAPP_ENABLED=true
WHATSAPP_API_TOKEN=tu_token_meta
WHATSAPP_PHONE_NUMBER_ID=tu_phone_id
```

Ver plantilla Meta en `DEPLOY.md` sección 3.

---

## Plan gratuito de Render — qué saber

| Aspecto | Detalle |
|---------|---------|
| Costo | $0 (web + PostgreSQL free) |
| Arranque | Tras ~15 min sin uso, la app “duerme” y tarda ~30 s en despertar |
| Fotos | En plan free pueden perderse al redeploy; para producción seria considera plan **Starter** (~$7/mes) |
| HTTPS | Automático en Render y en tu subdominio |

---

## Comparación rápida

| Método | Dificultad | Base de datos | Mejor para |
|--------|------------|---------------|------------|
| **Render + render.yaml** | ⭐ Fácil | Auto-conectada | **Recomendado** |
| Railway | ⭐⭐ Media | Manual (referencia DATABASE_URL) | Si ya lo usas |
| Vercel + Neon | ⭐⭐ Media | Neon aparte + S3 para fotos | Solo si conoces Vercel |
| VPS Hostinger | ⭐⭐⭐ Difícil | Docker/SSH | Control total |

---

## Si algo falla

**Build error con Prisma**  
→ Ya está corregido en el Dockerfile; Render usa Nixpacks/Node directo.

**Login no carga / 503**  
→ Revisa **Logs** en Render. Si falta migración: Shell → `npx prisma migrate deploy`.

**ops.lgbsistemas.ec no resuelve**  
→ Espera propagación DNS o verifica el CNAME `ops` en Hostinger.

---

## Resumen en 4 pasos

```
1. render.com → Blueprint → repo GitHub → Apply
2. Shell → npm run db:seed
3. Hostinger DNS: CNAME ops → onrender.com
4. Botón en lgbsistemas.ec → ops.lgbsistemas.ec/login
```

Tu landing sigue en **lgbsistemas.ec**. La app operativa en **ops.lgbsistemas.ec**. Sin mezclar los dos.
