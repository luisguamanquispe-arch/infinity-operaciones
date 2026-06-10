# Infinity Operaciones

Dashboard operativo para técnicos ISP — **Infinity Internet**.

Permite que cada técnico gestione sus órdenes de trabajo desde el celular, mientras supervisores y administradores monitorean la operación en tiempo real.

## Características

- **Panel del Técnico**: resumen del día, mapa con ruta, órdenes con filtros
- **Orden de servicio**: datos del cliente, cronómetro GPS, evidencia fotográfica
- **Medición técnica**: RX/TX, ping, speedtest
- **Material e inventario**: descuento automático de stock
- **Firma digital** del cliente con GPS
- **Cierre con checklist** obligatorio + WhatsApp (Meta Cloud API)
- **Panel Supervisor**: KPIs, mapa en vivo, técnicos en campo
- **Panel Gerencial**: SLA, rendimiento por técnico, operación del mes
- **PWA**: instalable en Android, iPhone y tablet sin Play Store

## Requisitos

- Node.js 20+
- npm
- Docker Desktop (solo si usas PostgreSQL local; por defecto usa SQLite)

## Instalación

```powershell
cd C:\Users\MONITOREO-INFINITY\infinity-operaciones
copy .env.example .env
& "C:\Program Files\nodejs\npm.cmd" install
& "C:\Program Files\nodejs\npm.cmd" run db:setup:dev
& "C:\Program Files\nodejs\npm.cmd" run dev
```

> **Nota:** Desarrollo usa SQLite (`file:./dev.db`). Para PostgreSQL en producción ver [DEPLOY.md](./DEPLOY.md).

Abre [http://localhost:3000](http://localhost:3000)

## Ingresar tickets de soporte

1. Inicia sesión como **Supervisor** (`supervisor@infinity.ec` / `super123`)
2. En el panel, pulsa **"Nuevo ticket de soporte"**
3. O ve directo a: **http://localhost:3000/supervisor/tickets/nuevo**
4. Busca al cliente por cédula/nombre o ingresa uno nuevo
5. Completa tipo, prioridad, motivo y asigna técnico
6. El ticket aparece en el panel del técnico asignado

## Registrar técnicos nuevos

1. Inicia sesión como **Gerencia** (`admin@infinity.ec` / `admin123`)
2. Pulsa **"Nuevo técnico"** o ve a: **http://localhost:3000/gerencia/tecnicos/nuevo**
3. Completa nombre, email, contraseña, teléfono y vehículo
4. El técnico ingresa en `/login` con su email y contraseña

## Editar tickets

1. Inicia sesión como **Supervisor** (`supervisor@infinity.ec` / `super123`)
2. En **Tickets activos**, pulsa **"Editar →"** en el ticket deseado
3. O ve directo a: `/supervisor/tickets/[id]/editar`
4. Modifica: tipo, prioridad, estado, técnico, motivo, descripción
5. Guarda cambios

## Cambiar contraseñas (admin, supervisor, técnicos)

1. Inicia sesión como **Gerencia** (`admin@infinity.ec` / `admin123`)
2. Pulsa **"Usuarios y claves"** o ve a: **http://localhost:3000/gerencia/usuarios**
3. Pulsa **"Cambiar clave"** en el usuario deseado
4. Ingresa nueva contraseña (mínimo 6 caracteres) y confirma
5. El usuario ingresa con su email y la nueva clave

## Reportes de órdenes finalizadas

1. Inicia sesión como **Supervisor** o **Gerencia**
2. Pulsa **"Reportes finalizados"** o ve a: **http://localhost:3000/reportes**
3. Filtra por fecha, técnico, tipo, sector o busca por ticket/cliente
4. Pulsa **"Ver reporte →"** para ver evidencia fotográfica, medición, firma y checklist
5. Usa **Imprimir** para generar PDF desde el navegador

## Usuarios de prueba

| Rol        | Email                    | Contraseña  |
|------------|--------------------------|-------------|
| Técnico    | juan@infinity.ec         | tecnico123  |
| Supervisor | supervisor@infinity.ec   | super123    |
| Gerencia   | admin@infinity.ec        | admin123    |

## Scripts

| Comando          | Descripción                    |
|------------------|--------------------------------|
| `npm run dev`    | Servidor de desarrollo         |
| `npm run build`  | Build de producción            |
| `npm run db:setup` | Crear BD + datos de prueba |
| `npm run db:seed`  | Solo datos de prueba         |

## Estructura

```
src/
├── app/
│   ├── api/          # REST API
│   ├── tecnico/      # Dashboard y órdenes
│   ├── supervisor/   # Monitoreo en vivo
│   └── gerencia/     # KPIs gerenciales
├── components/       # UI reutilizable
└── lib/              # Auth, Prisma, utilidades
prisma/
├── schema.prisma     # Modelo de datos
└── seed.ts           # Datos de prueba Ambato
```

## Producción

**Guía sencilla (recomendada):** **[PUBLICAR-SIMPLE.md](./PUBLICAR-SIMPLE.md)** — Render + subdominio `ops.lgbsistemas.ec`

Guía completa Railway/Hostinger: **[PUBLICAR-LGB.md](./PUBLICAR-LGB.md)** · **[DEPLOY.md](./DEPLOY.md)**

### Resumen rápido

1. **PostgreSQL**: `docker compose up -d` o Neon/Railway
2. **JWT**: `JWT_SECRET` con mínimo 32 caracteres (`openssl rand -base64 48`)
3. **WhatsApp**: Meta Cloud API — ver DEPLOY.md sección 3
4. **Deploy**: Railway (recomendado) | Vercel (+ S3) | VPS (Docker)

```env
DATABASE_URL="postgresql://user:pass@host:5432/infinity_ops?sslmode=require"
JWT_SECRET="secreto-generado-aleatorio"
WHATSAPP_ENABLED="true"
WHATSAPP_API_TOKEN="..."
WHATSAPP_PHONE_NUMBER_ID="..."
WHATSAPP_TEMPLATE_NAME="ticket_cerrado"
UPLOAD_STORAGE="local"
NODE_ENV="production"
```

## Flujo operativo

```
Cliente reporta → Ticket creado → Supervisor asigna → Técnico notificado
→ Inicia cronómetro → Llega al sitio → Fotos + reparación
→ Medición + firma → Cierra ticket → WhatsApp al cliente → KPIs actualizados
```
