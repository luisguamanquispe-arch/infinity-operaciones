# Publicar Infinity Operaciones en lgbsistemas.ec

Tu sitio **https://lgbsistemas.ec/** hoy es una landing en **Hostinger Horizons**.  
La app (Next.js + PostgreSQL) se publica en **Railway** y se conecta con un **subdominio** en Hostinger.

## Arquitectura recomendada

| URL | Qué va ahí |
|-----|------------|
| `https://lgbsistemas.ec` | Landing comercial (Hostinger — ya la tienes) |
| `https://ops.lgbsistemas.ec` | **App operativa** (Railway) — login técnicos/supervisores |

> Si quieres la app en la raíz (`lgbsistemas.ec`), tendrías que quitar la landing de Hostinger y apuntar el dominio raíz a Railway.

---

## Paso 1 — Subir el código a GitHub

1. Instala [Git for Windows](https://git-scm.com/download/win) si no lo tienes.
2. Crea un repositorio vacío en GitHub (ej. `infinity-operaciones`).
3. En PowerShell:

```powershell
cd C:\Users\MONITOREO-INFINITY\infinity-operaciones
git init
git add .
git commit -m "Preparar deploy producción PostgreSQL"
git branch -M main
git remote add origin https://github.com/TU_USUARIO/infinity-operaciones.git
git push -u origin main
```

---

## Paso 2 — Railway (servidor de la app)

1. [railway.app](https://railway.app) → login con GitHub.
2. **New Project** → **Deploy from GitHub** → selecciona el repo.
3. **+ New** → **Database** → **PostgreSQL** (espera a que quede **Active**).

### Conectar PostgreSQL (obligatorio — sin esto el deploy falla)

El comando de inicio ejecuta `prisma migrate deploy` y **necesita `DATABASE_URL`**. Si no está configurada, el servicio cae y el healthcheck en `/login` responde *service unavailable*.

1. Abre el servicio **web** (tu app Next.js), **no** el de PostgreSQL.
2. Pestaña **Variables**.
3. **+ New Variable** → **Add Reference** (o **Reference Variable**).
4. Servicio: **PostgreSQL** → variable: **`DATABASE_URL`**.
5. Guarda. Railway redeploya automáticamente.

Debe quedar una variable `DATABASE_URL` cuyo valor es una referencia (no vacía), por ejemplo:
`${{Postgres.DATABASE_URL}}`

**Alternativa manual:** en Variables del servicio web, crea:

| Variable | Valor |
|----------|-------|
| `DATABASE_URL` | Copiar el valor desde PostgreSQL → Variables → `DATABASE_URL` |

6. Agrega también estas variables en el **servicio web**:

```env
NODE_ENV=production
JWT_SECRET=<genera con PowerShell abajo>
WHATSAPP_ENABLED=true
WHATSAPP_PHONE=0995870168
WHATSAPP_API_TOKEN=<token Meta>
WHATSAPP_PHONE_NUMBER_ID=<phone number ID>
WHATSAPP_TEMPLATE_NAME=ticket_cerrado
UPLOAD_STORAGE=local
```

Generar JWT:

```powershell
[Convert]::ToBase64String((1..48 | ForEach-Object { Get-Random -Maximum 256 }) -as [byte[]])
```

6. **Settings → Volumes** → montar `/app/public/uploads` (1 GB+) para que las fotos no se pierdan.
7. Espera deploy **Success**. Anota la URL temporal: `https://xxxx.up.railway.app`.

### Seed (usuarios iniciales) — una sola vez

En Railway → servicio web → terminal:

```bash
npm run db:seed
```

Luego cambia las contraseñas en `/gerencia/usuarios`.

---

## Paso 3 — DNS en Hostinger

1. [hpanel.hostinger.com](https://hpanel.hostinger.com) → **Dominios** → `lgbsistemas.ec` → **DNS / Zona DNS**.
2. En Railway → servicio web → **Settings → Networking → Custom Domain**.
3. Agrega: **`ops.lgbsistemas.ec`**
4. Railway muestra un CNAME, por ejemplo: `xxxx.up.railway.app`
5. En Hostinger, crea registro:

| Tipo | Nombre | Valor | TTL |
|------|--------|-------|-----|
| **CNAME** | `ops` | `xxxx.up.railway.app` | 14400 |

6. Espera 5–30 min. En Railway el dominio debe quedar **Active** con HTTPS.

Prueba: **https://ops.lgbsistemas.ec/login**

---

## Paso 4 — Enlazar desde tu web Hostinger

En la landing **lgbsistemas.ec**, agrega un botón:

- Texto: **Acceder al sistema** / **Iniciar sesión**
- URL: `https://ops.lgbsistemas.ec/login`

Así la landing sigue en la raíz y la app operativa en el subdominio.

---

## Paso 5 — PWA en celulares (técnicos)

1. Abrir `https://ops.lgbsistemas.ec` en Chrome (Android) o Safari (iPhone).
2. **Agregar a pantalla de inicio**.
3. GPS y cámara funcionan porque Railway entrega **HTTPS** automático.

---

## Checklist final

- [ ] Deploy Railway en verde
- [ ] `npm run db:seed` ejecutado
- [ ] CNAME `ops` → Railway en Hostinger
- [ ] `https://ops.lgbsistemas.ec/login` carga
- [ ] Botón en lgbsistemas.ec apunta al login
- [ ] Contraseñas de prueba cambiadas
- [ ] WhatsApp Meta configurado (ver DEPLOY.md §3)

---

## Desarrollo local (después del cambio a PostgreSQL)

El proyecto ya usa PostgreSQL. Para desarrollo local:

**Opción A — Neon gratis (sin Docker):**

1. Crear proyecto en [neon.tech](https://neon.tech)
2. En `.env`: `DATABASE_URL="postgresql://..."`
3. `npm run db:migrate` y `npm run db:seed`

**Opción B — Docker:**

```powershell
docker compose up -d
# DATABASE_URL="postgresql://infinity:infinity123@localhost:5432/infinity_ops"
npm run db:migrate
npm run db:seed
npm run dev
```
