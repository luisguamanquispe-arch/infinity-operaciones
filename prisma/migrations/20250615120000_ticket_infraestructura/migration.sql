-- Soporte de infraestructura interna (cortes, nodos, actualizaciones)
CREATE TYPE "MotivoInfraestructura" AS ENUM (
  'CORTE_ELECTRICO',
  'CORTE_FIBRA',
  'CONFIG_NODO',
  'ACTUALIZACION'
);

ALTER TYPE "TipoTrabajo" ADD VALUE 'INFRAESTRUCTURA';

ALTER TABLE "Ticket" ADD COLUMN "motivoInfraestructura" "MotivoInfraestructura";
ALTER TABLE "Ticket" ADD COLUMN "nodoAfectado" TEXT;
ALTER TABLE "Ticket" ADD COLUMN "zonaInfra" TEXT;
