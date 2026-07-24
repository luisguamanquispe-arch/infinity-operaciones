# API Cliente — INFINITY Connect

Base URL: `https://<host>/api/cliente`

Autenticación: **Bearer JWT** (`Authorization: Bearer <accessToken>`).  
Audience JWT: `cliente`. Access token: 1 hora. Refresh: 30 días (rotativo).

Wispro **nunca** se llama desde la app. Solo Infinity Soporte (este backend) habla con Wispro.

## Endpoints

### Auth

#### `POST /api/cliente/auth/login`

```json
{ "email": "cliente@infinity.ec", "password": "cliente123" }
```

Respuesta `200`:

```json
{
  "accessToken": "...",
  "refreshToken": "...",
  "expiresIn": 3600,
  "tokenType": "Bearer",
  "user": { "id": "...", "email": "...", "nombre": "...", "clienteId": "..." }
}
```

Rate limit: 10 intentos / 15 min por IP.

#### `POST /api/cliente/auth/refresh`

```json
{ "refreshToken": "..." }
```

Devuelve nuevo par access + refresh (el anterior se revoca).

#### `POST /api/cliente/auth/logout`

Header Bearer opcional + body `{ "refreshToken": "..." }` opcional. Revoca refresh tokens.

### Perfil y servicio

#### `GET /api/cliente/profile`

Bearer requerido. Devuelve `{ profile: { id, email, nombre, cliente: {...} } }`.

#### `GET /api/cliente/dashboard`

Bearer requerido. Devuelve nombre, plan, velocidad, estados, saldo, último pago, fecha de corte, accesos rápidos.

#### `GET /api/cliente/service`

Bearer requerido. Detalle técnico/comercial (IP, MAC, ONU, potencia, infraestructura). Campo `fuente`: `local` | `wispro`.

### Facturación

#### `GET /api/cliente/invoices`

Bearer requerido. `{ saldoPendiente, invoices[], fuente }`. Facturas stub/Wispro (nunca desde la app).

#### `GET /api/cliente/payments`

Bearer requerido. `{ payments[], fuente }`.

### Soporte

#### `GET /api/cliente/tickets`

Bearer requerido. `{ categorias[], tickets[] }` — historial de tickets `SOPORTE`/`RECONEXION` del cliente.

#### `POST /api/cliente/tickets`

```json
{ "categoria": "SIN_INTERNET", "descripcion": "Sin servicio desde esta mañana" }
```

Categorías: `SIN_INTERNET`, `INTERMITENCIA`, `LENTITUD`, `EQUIPO`, `FACTURACION`, `OTRO`.  
Respuesta `201`: `{ ok, ticket: { id, codigo, estado, motivo } }`.

#### `GET /api/cliente/tickets/:id`

Detalle + últimos eventos del ticket (solo del cliente autenticado).

### Speed test

Medición **orientativa** contra Infinity Soporte (no Wispro). La app mide RTT/descarga/subida y guarda el resultado.

#### `GET /api/cliente/speedtest/config`

Plan contratado + parámetros de prueba (`chunkBytes`, `downloadChunks`, etc.).

#### `GET /api/cliente/speedtest/ping`

Respuesta mínima `{ ok, t }` para latencia.

#### `GET /api/cliente/speedtest/download?bytes=524288`

Payload binario (máx. 2 MB) para medir descarga.

#### `POST /api/cliente/speedtest/upload`

Body `application/octet-stream` (máx. 2 MB). Responde `{ bytesReceived }`.

#### `GET /api/cliente/speedtest/results`

Historial (últimos 20).

#### `POST /api/cliente/speedtest/results`

```json
{ "pingMs": 28.5, "downloadMbps": 72.1, "uploadMbps": 18.4, "planMbps": 100, "plataforma": "windows" }
```

Clasifica calidad vs plan (`BUENA` ≥70%, `REGULAR` ≥40%, `BAJA`).

### Chat / IA

Conversaciones `HdConversacion` con canal `CHAT`. El bot responde hasta que el cliente pide «agente» o un humano del Help Desk toma el chat.

#### `GET|POST /api/cliente/chat/session`

Abre o reutiliza la sesión activa. `{ conversacion, mensajes[] }`.

#### `GET /api/cliente/chat/sessions/:id/messages?after=<mensajeId>`

Polling de mensajes nuevos.

#### `POST /api/cliente/chat/sessions/:id/messages`

```json
{ "contenido": "Sin internet desde ayer" }
```

Respuesta `201`: mensajes creados (cliente + posible respuesta IA/sistema).

### Push (dispositivos)

#### `POST /api/cliente/devices`

```json
{ "token": "<fcm-or-local-token>", "plataforma": "android" }
```

#### `DELETE /api/cliente/devices`

```json
{ "token": "..." }
```

Con `FCM_SERVER_KEY` el servidor envía push al responder un agente. Sin key: modo stub (log).

App Android/iOS: ver `infinity-connect/docs/STORE.md` (Firebase + Play/App Store).

## Setup demo

#### `GET|POST /api/setup/cliente-app-usuario`

Header `x-setup-token: <SETUP_TOKEN>` **o** query `?token=<SETUP_TOKEN>`.

```http
POST /api/setup/cliente-app-usuario
x-setup-token: <SETUP_TOKEN>
Content-Type: application/json

{ "email": "cliente@infinity.ec", "password": "cliente123" }
```

## Variables de entorno

| Variable | Descripción |
|----------|-------------|
| `JWT_SECRET` | Firma HS256 (≥32 chars) |
| `SETUP_TOKEN` | Alta de usuario demo |
| `WISPRO_API_URL` | Opcional — URL Wispro |
| `WISPRO_API_TOKEN` | Opcional — token Wispro |
| `OPENAI_API_KEY` | Opcional — bot chat + copiloto Help Desk |
| `OPENAI_MODEL` | Opcional — default `gpt-4o-mini` |
| `FCM_SERVER_KEY` | Opcional — push FCM legacy a dispositivos Connect |

## Roles

Usuarios con `rol=CLIENTE` no pueden iniciar sesión en el panel web de operaciones.
