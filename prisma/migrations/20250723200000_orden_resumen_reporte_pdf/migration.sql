-- AlterTable
ALTER TABLE "OrdenServicio" ADD COLUMN IF NOT EXISTS "resumenTrabajo" TEXT;
ALTER TABLE "OrdenServicio" ADD COLUMN IF NOT EXISTS "reportePdfUrl" TEXT;
ALTER TABLE "OrdenServicio" ADD COLUMN IF NOT EXISTS "reporteEnviadoWhatsapp" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "OrdenServicio" ADD COLUMN IF NOT EXISTS "reporteEnviadoEmail" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "OrdenServicio" ADD COLUMN IF NOT EXISTS "correoReporte" TEXT;
