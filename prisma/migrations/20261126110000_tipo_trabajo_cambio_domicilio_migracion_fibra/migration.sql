-- Agregar nuevos tipos de trabajo de cliente al enum TipoTrabajo.
-- Aditivo y compatible con tickets existentes.

ALTER TYPE "TipoTrabajo" ADD VALUE IF NOT EXISTS 'CAMBIO_DOMICILIO';
ALTER TYPE "TipoTrabajo" ADD VALUE IF NOT EXISTS 'MIGRACION_SERVICIO_FIBRA';
