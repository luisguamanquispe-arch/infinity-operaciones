# Guía de despliegue — Infinity Operaciones

## Requisitos previos

- Node.js 20+
- PostgreSQL 14+ (local, Neon, Railway, Supabase, etc.)
- Cuenta Meta Business (para WhatsApp)
- Dominio HTTPS (obligatorio en producción para PWA y GPS)

---

## 1. PostgreSQL

### Opción A — Local con Docker (desarrollo)

```powershell
cd C:\Users\MONITOREO-INFINITY\infinity-operaciones
docker compose up -d
copy .env.example .env
# Editar .env — DATABASE_URL ya apunta a localhost:5432
```

```powershell
& "C:\Program Files\nodejs\npm.cmd" install
& "C:\Program Files\nodejs\npm.cmd" run db:migrate:dev -- --name init
& "C:\Program Files\nodejs\npm.cmd" run db:seed
& "C:\Program Files\nodejs\npm.cmd" run dev
```

### Opción B — Neon / Supabase (gratis, cloud)

1. Crear proyecto en [neon.tech](https://neon.tech) o [supabase.com](https://supabase.com)
2. Copiar la connection string:
   ```
   postgresql://user:pass@host/db?sslmode=require
   ```
3. Pegar en `DATABASE_URL`

### Opción C — Railway PostgreSQL

1. Crear servicio **PostgreSQL** en Railway
2. Railway inyecta `DATABASE_URL` automáticamente al servicio web

---

## 2. JWT_SECRET seguro

**Nunca uses el secreto de desarrollo en producción.**

Generar secreto (PowerShell):

```powershell
[Convert]::ToBase64String((1..48 | ForEach-Object { Get-Random -Maximum 256 }) -as [byte[]])
```

O con OpenSSL:

```bash
openssl rand -base64 48
```

Configurar en `.env` o panel del hosting:

```
JWT_SECRET=tu-secreto-generado-minimo-32-caracteres
```

La app **rechaza arrancar en producción** si `JWT_SECRET` tiene menos de 32 caracteres.

---

## 3. WhatsApp — Meta Cloud API

### Paso 1: Configurar Meta Business

1. Ir a [developers.facebook.com](https://developers.facebook.com)
2. Crear app → tipo **Business**
3. Agregar producto **WhatsApp**
4. En **API Setup** copiar:
   - **Phone number ID** → `WHATSAPP_PHONE_NUMBER_ID`
   - **Temporary/Permanent token** → `WHATSAPP_API_TOKEN`

### Paso 2: Crear plantilla de mensaje

En Meta Business Manager → WhatsApp → Message templates:

| Campo | Valor |
|-------|-------|
| Nombre | `ticket_cerrado` |
| Idioma | Español |
| Categoría | Utility |
| Cuerpo | `Infinity Internet informa que su ticket {{1}} ha sido solucionado exitosamente. Si presenta novedades contáctenos al {{2}}.` |

Esperar aprobación de Meta (24–48h).

### Paso 3: Variables de entorno

```env
WHATSAPP_ENABLED="true"
WHATSAPP_PHONE="0995870168"
WHATSAPP_API_TOKEN="EAAxxxx..."
WHATSAPP_PHONE_NUMBER_ID="123456789012345"
WHATSAPP_TEMPLATE_NAME="ticket_cerrado"
WHATSAPP_API_VERSION="v21.0"
```

### Probar

Al cerrar un ticket, revisa logs del servidor. Si falla, verifica:
- Plantilla aprobada
- Teléfono del cliente en formato Ecuador (`099...` o `593...`)
- Token no expirado

---

## 4. Almacenamiento de fotos

| Plataforma | Configuración recomendada |
|------------|---------------------------|
| **VPS / Railway** | `UPLOAD_STORAGE=local` + volumen persistente |
| **Vercel** | `UPLOAD_STORAGE=s3` (Cloudflare R2 o AWS S3) |

### Cloudflare R2 (compatible S3)

```env
UPLOAD_STORAGE="s3"
S3_BUCKET="infinity-uploads"
S3_REGION="auto"
S3_ACCESS_KEY="..."
S3_SECRET_KEY="..."
S3_ENDPOINT="https://ACCOUNT_ID.r2.cloudflarestorage.com"
S3_PUBLIC_URL="https://uploads.tudominio.com"
```

---

## 5. Despliegue por plataforma

### Railway (recomendado)

1. Subir repo a GitHub
2. [railway.app](https://railway.app) → New Project → Deploy from GitHub
3. Agregar servicio **PostgreSQL**
4. Variables de entorno (Settings → Variables):

   ```
   DATABASE_URL        (auto desde PostgreSQL)
   JWT_SECRET          (generado)
   WHATSAPP_ENABLED    true
   WHATSAPP_API_TOKEN  ...
   WHATSAPP_PHONE_NUMBER_ID ...
   WHATSAPP_TEMPLATE_NAME ticket_cerrado
   UPLOAD_STORAGE      local
   NODE_ENV            production
   ```

5. Railway ejecuta `prisma migrate deploy` al iniciar (ver `railway.toml`)
6. Seed inicial (una vez, en Railway shell):
   ```
   npm run db:seed
   ```

### Vercel

> **Nota:** Vercel es serverless. Las fotos **no persisten** en disco local.
> Usa `UPLOAD_STORAGE=s3` con Cloudflare R2.

1. Importar repo en [vercel.com](https://vercel.com)
2. Variables de entorno en Project Settings
3. Build command (automático vía `vercel.json`):
   ```
   npx prisma generate && npm run build
   ```
4. Migraciones — ejecutar una vez desde local apuntando a la BD de producción:
   ```powershell
   $env:DATABASE_URL="postgresql://..."
   npx prisma migrate deploy
   npx tsx prisma/seed.ts
   ```

### VPS (Docker)

```bash
git clone <repo> /opt/infinity-operaciones
cd /opt/infinity-operaciones
cp .env.example .env
# Editar .env con valores de producción

docker compose up -d          # PostgreSQL
docker build -t infinity-app .
docker run -d \
  --name infinity-app \
  --env-file .env \
  -p 3000:3000 \
  -v infinity_uploads:/app/public/uploads \
  --network host \
  infinity-app
```

Con Nginx + SSL (Certbot):

```nginx
server {
    listen 443 ssl;
    server_name ops.infinity.ec;

    ssl_certificate /etc/letsencrypt/live/ops.infinity.ec/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/ops.infinity.ec/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        client_max_body_size 10M;
    }
}
```

---

## 6. Checklist pre-producción

- [ ] `DATABASE_URL` apunta a PostgreSQL (no SQLite)
- [ ] `JWT_SECRET` generado aleatoriamente (≥32 chars)
- [ ] `NODE_ENV=production`
- [ ] Migraciones aplicadas: `npm run db:migrate`
- [ ] Seed o usuarios reales creados
- [ ] WhatsApp: plantilla aprobada y token configurado
- [ ] Fotos: S3/R2 si usas Vercel; volumen si usas VPS
- [ ] HTTPS activo (PWA + geolocalización móvil)
- [ ] Cambiar contraseñas de prueba (`tecnico123`, etc.)

---

## 7. Comandos útiles

| Comando | Descripción |
|---------|-------------|
| `npm run db:migrate:dev` | Crear migración (desarrollo) |
| `npm run db:migrate` | Aplicar migraciones (producción) |
| `npm run db:seed` | Datos iniciales |
| `npm run build` | Build producción |
| `npm run start` | Servidor producción |

---

## Soporte

- Meta WhatsApp API: https://developers.facebook.com/docs/whatsapp/cloud-api
- Prisma + PostgreSQL: https://www.prisma.io/docs/orm/overview/databases/postgresql
- Railway docs: https://docs.railway.app
