-- CreateEnum
CREATE TYPE "IrEstadoReporte" AS ENUM ('PENDIENTE', 'EN_PROCESO', 'FINALIZADO');

-- CreateEnum
CREATE TYPE "IrTipoTrabajo" AS ENUM (
  'CORTE_FIBRA',
  'EMPALME',
  'CAMBIO_NAP',
  'CAMBIO_CTO',
  'CAMBIO_SPLITTER',
  'CAMBIO_POSTE',
  'CAMBIO_CABLE',
  'MANTENIMIENTO_PREVENTIVO',
  'MANTENIMIENTO_CORRECTIVO',
  'AMPLIACION_RED',
  'OTRO'
);

-- CreateEnum
CREATE TYPE "IrTipoFoto" AS ENUM ('ANTES', 'DURANTE', 'DESPUES');

-- CreateEnum
CREATE TYPE "IrTipoFirma" AS ENUM ('TECNICO', 'SUPERVISOR');

-- CreateTable
CREATE TABLE "IrReporte" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "horaInicio" TIMESTAMP(3),
    "horaFin" TIMESTAMP(3),
    "tecnicoId" TEXT NOT NULL,
    "supervisorUsuarioId" TEXT,
    "estado" "IrEstadoReporte" NOT NULL DEFAULT 'PENDIENTE',
    "prioridad" "Prioridad" NOT NULL DEFAULT 'MEDIA',
    "tipoTrabajo" "IrTipoTrabajo" NOT NULL,
    "tipoTrabajoOtro" TEXT,
    "provincia" TEXT NOT NULL,
    "canton" TEXT NOT NULL,
    "parroquia" TEXT NOT NULL,
    "sector" TEXT NOT NULL,
    "direccion" TEXT NOT NULL,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "descripcion" TEXT NOT NULL,
    "observaciones" TEXT,
    "creadoPorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IrReporte_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IrMaterial" (
    "id" TEXT NOT NULL,
    "reporteId" TEXT NOT NULL,
    "material" TEXT NOT NULL,
    "cantidad" DOUBLE PRECISION NOT NULL,
    "unidad" TEXT NOT NULL DEFAULT 'unidad',

    CONSTRAINT "IrMaterial_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IrFoto" (
    "id" TEXT NOT NULL,
    "reporteId" TEXT NOT NULL,
    "tipo" "IrTipoFoto" NOT NULL,
    "url" TEXT NOT NULL,
    "imagenData" TEXT,
    "tomadaEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IrFoto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IrFirma" (
    "id" TEXT NOT NULL,
    "reporteId" TEXT NOT NULL,
    "tipo" "IrTipoFirma" NOT NULL,
    "nombre" TEXT NOT NULL,
    "imagenUrl" TEXT NOT NULL,
    "imagenData" TEXT,
    "firmadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IrFirma_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "IrReporte_codigo_key" ON "IrReporte"("codigo");
CREATE INDEX "IrReporte_estado_fecha_idx" ON "IrReporte"("estado", "fecha");
CREATE INDEX "IrReporte_tecnicoId_idx" ON "IrReporte"("tecnicoId");
CREATE INDEX "IrReporte_sector_idx" ON "IrReporte"("sector");
CREATE INDEX "IrMaterial_reporteId_idx" ON "IrMaterial"("reporteId");
CREATE INDEX "IrFoto_reporteId_tipo_idx" ON "IrFoto"("reporteId", "tipo");
CREATE UNIQUE INDEX "IrFirma_reporteId_tipo_key" ON "IrFirma"("reporteId", "tipo");
CREATE INDEX "IrFirma_reporteId_idx" ON "IrFirma"("reporteId");

-- AddForeignKey
ALTER TABLE "IrReporte" ADD CONSTRAINT "IrReporte_tecnicoId_fkey" FOREIGN KEY ("tecnicoId") REFERENCES "Tecnico"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "IrReporte" ADD CONSTRAINT "IrReporte_supervisorUsuarioId_fkey" FOREIGN KEY ("supervisorUsuarioId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "IrReporte" ADD CONSTRAINT "IrReporte_creadoPorId_fkey" FOREIGN KEY ("creadoPorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "IrMaterial" ADD CONSTRAINT "IrMaterial_reporteId_fkey" FOREIGN KEY ("reporteId") REFERENCES "IrReporte"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "IrFoto" ADD CONSTRAINT "IrFoto_reporteId_fkey" FOREIGN KEY ("reporteId") REFERENCES "IrReporte"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "IrFirma" ADD CONSTRAINT "IrFirma_reporteId_fkey" FOREIGN KEY ("reporteId") REFERENCES "IrReporte"("id") ON DELETE CASCADE ON UPDATE CASCADE;
