# Importar clientes Wispro (CSV o Excel) a Infinity Operaciones

## Acceso

Solo **supervisor** o **admin**:

1. Entrar a Operaciones.
2. Abrir **Clientes CRM / Importar Wispro** (panel supervisor o gerencia).
3. URL directa: `https://infinity-operaciones-b3ij.onrender.com/supervisor/clientes`

## Cómo exportar desde Wispro

1. Wispro → **Clientes** → **Exportar**.
2. Elija **CSV** o **Excel** (.xlsx).
3. Descargue el archivo (correo o descarga del panel).

## Cómo importar en Operaciones

1. En el panel verde **Importar todos los clientes desde Wispro**.
2. **Elegir CSV o Excel** → seleccione el archivo.
3. **Subir e importar**.
4. Revise creados / actualizados / errores.

- Clientes **nuevos** se crean.
- Si la **cédula** ya existe, se **actualiza** el registro.
- Máximo **25 MB** por archivo.

## Columnas del export Wispro

| Columna Wispro | Campo Operaciones |
|----------------|-------------------|
| Documento/Cédula | cedula |
| Nombre | nombre |
| Teléfono / Celular | telefono |
| Dirección | direccion |
| Barrio / Zona / Ciudad | sector |
| Observaciones / Dato adicional | referencia |
| Latitud / Longitud | lat / lng |
| Plan | plan |

Obligatorios: cédula, nombre, teléfono (o celular), dirección, sector (barrio/zona/ciudad).

## Si falla

| Mensaje | Qué hacer |
|---------|-----------|
| Faltan columnas… | Revise encabezados; use la plantilla CSV de ejemplo |
| Cédula inválida | Corrija el documento (10 dígitos EC) |
| No autorizado | Entre como supervisor o admin |
| Formato no admitido | Use `.csv`, `.xlsx` o `.xls` |

## API

```http
POST /api/clientes/import
Content-Type: multipart/form-data
file: <clientes.csv|clientes.xlsx>
```

Roles: `SUPERVISOR` o `ADMIN`.
