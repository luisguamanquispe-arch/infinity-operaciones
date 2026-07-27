# Backup y restauración — Infinity Operaciones

## Objetivo

Respaldo **lógico** (JSON) de toda la base operativa: usuarios, técnicos, clientes, tickets, órdenes, mediciones, fotos/firmas (opcionales), inventario, novedades, Help Desk y cuentas Connect.

No depende de `pg_dump` (útil en Render Free sin Shell). El archivo se descarga y debe guardarse **fuera** de Render.

## Quién puede usarlo

Solo rol **ADMIN** → Gerencia → **Backup / Restore** (`/gerencia/backup`).

## Descargar backup

1. Login como admin.
2. `/gerencia/backup`
3. Opcional: desmarcar “Incluir imagenData…” para un archivo más liviano (conserva URLs de fotos).
4. **Generar y descargar .json.gz**

API equivalente:

```http
GET /api/gerencia/backup
GET /api/gerencia/backup?media=0
GET /api/gerencia/backup?meta=1
```

## Restaurar

**Destructivo:** borra todas las tablas del sistema y vuelve a insertar el backup.

1. Suba el `.json` o `.json.gz`
2. Escriba exactamente `RESTAURAR`
3. Confirme el diálogo

API:

```http
POST /api/gerencia/backup/restore
Content-Type: multipart/form-data
file: <backup>
confirmPhrase: RESTAURAR
```

Tras restaurar, cierre sesión y vuelva a entrar (usuarios/contraseñas del backup).

## Cron (opcional)

Variable en Render: `BACKUP_CRON_SECRET` (cadena larga aleatoria).

```http
POST /api/backup/cron
Authorization: Bearer <BACKUP_CRON_SECRET>

POST /api/backup/cron?download=1&media=0
Authorization: Bearer <BACKUP_CRON_SECRET>
```

Programe un cron externo (cron-job.org, GitHub Actions) diario y guarde la respuesta con `?download=1` en un almacenamiento externo.

## Formato

```json
{
  "formatVersion": 1,
  "kind": "infinity-operaciones-full",
  "exportedAt": "…",
  "includeMedia": true,
  "counts": { "Usuario": 3, "Ticket": 10 },
  "tables": { "Usuario": [ … ], … }
}
```

## Buenas prácticas

| Práctica | Detalle |
|----------|---------|
| Frecuencia | Diario (cron) + antes de migraciones / cambios mayores |
| Almacenamiento | 2–3 copias (PC + nube + USB/NAS) |
| Prueba | Restaurar en un entorno de prueba al menos 1 vez al mes |
| Media | Con media si hay espacio; sin media si el volumen de fotos es grande |
| Hoteles | **Nunca** mezclar con `infinity-db` de Hoteles; Operaciones usa `infinity-ops-db` |

## Límites

- Tiempo máximo de la API ~120 s (bases muy grandes pueden necesitar `media=0`).
- No incluye archivos en disco/`uploads` si solo existen como ficheros locales sin `imagenData`/URL accesible.
- Free Postgres de Render expira a 30 días: el backup lógico es la red de seguridad principal.
