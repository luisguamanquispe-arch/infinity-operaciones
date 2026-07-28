# Importar clientes Wispro (CSV) a Infinity Operaciones

## Importante

1. En Wispro debe exportar en formato **CSV**, no Excel.
2. El servidor de producción debe estar en un deploy que incluya esta función (revise `/api/health` → `gitSha`).

## Cómo cargar el archivo

1. Wispro → **Clientes** → **Exportar** → elija **CSV**.
2. Abra el correo de Wispro y descargue el adjunto `.csv`.
3. En Operaciones (supervisor/admin): **Clientes CRM** → panel **Importar clientes desde Wispro**.
4. **Elegir archivo CSV** → **Subir e importar**.
5. Revise creados / actualizados / errores.

URL: `https://infinity-operaciones-b3ij.onrender.com/supervisor/clientes`

## Columnas del export Wispro (oficial)

Wispro incluye, entre otras:

| Columna Wispro | Campo Operaciones |
|----------------|-------------------|
| Documento/Cédula | cedula |
| Nombre | nombre |
| Teléfono / Celular | telefono |
| Dirección | direccion |
| Barrio / Zona / Ciudad | sector |
| Observaciones / Dato adicional | referencia |
| Latitud / Longitud | lat / lng |

Obligatorios para importar: cédula, nombre, teléfono (o celular), dirección, sector (barrio/zona/ciudad).

## Si falla

| Mensaje | Qué hacer |
|---------|-----------|
| No se admite Excel | Vuelva a exportar eligiendo CSV |
| Faltan columnas… | Revise encabezados; use la plantilla de ejemplo |
| Cédula inválida | Corrija el documento (10 dígitos EC) |
| No autorizado | Entre como supervisor o admin |

## API

```http
POST /api/clientes/import
Content-Type: multipart/form-data
file: <clientes.csv>
```
