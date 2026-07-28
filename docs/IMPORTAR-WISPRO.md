# Importar clientes Wispro (CSV) a Infinity Operaciones

## Cómo cargar el archivo

1. En **Wispro**, exporte el listado de clientes a **CSV** (UTF-8).
2. Revise que existan al menos estas columnas (o renómbrelas):
   - `cedula`, `nombre`, `telefono`, `direccion`, `sector`
3. Opcional: descargue la plantilla desde la app:
   - `/plantillas/clientes-wispro.csv`
4. Inicie sesión como **supervisor** o **admin**.
5. Vaya a **Clientes CRM** (`/supervisor/clientes`).
6. Clic en **Importar CSV Wispro** y elija el archivo.
7. Revise el resumen: creados / actualizados / errores por fila.

URL típica: `https://infinity-operaciones-b3ij.onrender.com/supervisor/clientes`

## Comportamiento

- **Upsert por cédula**: si el cliente ya existe, se actualizan sus datos; si no, se crea.
- Cédula ecuatoriana válida (misma validación que el alta manual).
- Separador `,` o `;` detectado automáticamente.
- Máximo **10 MB** por archivo.

## Campos aceptados

| Columna CSV (ejemplos) | Campo sistema |
|------------------------|---------------|
| cedula, identification, dni | cedula |
| nombre, name, client_name | nombre |
| telefono, phone, mobile | telefono |
| plan, plan_name | plan |
| direccion, address | direccion |
| sector, barrio, neighborhood | sector |
| referencia, reference | referencia |
| nodo, node | nodo |
| caja_nap, nap, caja | cajaNap |
| puerto, port | puerto |
| onu, onu_serial, serial_onu | onuSerial |
| potencia, rx, optical_power | potencia |
| lat, latitude | lat |
| lng, longitude | lng |
| activo, active, status | activo |

## API

```http
POST /api/clientes/import
Content-Type: multipart/form-data
file: <clientes.csv>
```

Requiere sesión SUPERVISOR o ADMIN.

## Notas

- Filas vacías se omiten.
- Filas inválidas aparecen en el reporte de errores y no detienen el resto de la importación.
- Si Wispro usa encabezados muy distintos, renómbralos según la plantilla o solicite agregar aliases.
