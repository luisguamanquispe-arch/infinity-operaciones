-- CreateEnum
CREATE TYPE "SrEstado" AS ENUM ('PENDIENTE', 'EN_PROCESO', 'FINALIZADO');

-- CreateEnum
CREATE TYPE "SrTipoSoporte" AS ENUM (
  'CAMBIO_PASSWORD_WIFI',
  'CAMBIO_SSID',
  'REINICIO_ROUTER',
  'REINICIO_ONU',
  'REINICIO_PUERTO_OLT',
  'ACTUALIZACION_DATOS_CLIENTE',
  'CAMBIO_PLAN',
  'ACTIVACION_SERVICIO',
  'REACTIVACION_PAGO',
  'SUSPENSION_SERVICIO',
  'VERIFICACION_SENAL',
  'VERIFICACION_POTENCIA',
  'CONFIGURACION_WIFI',
  'CONFIGURACION_ROUTER',
  'CONFIGURACION_ONU',
  'CAMBIO_CANAL_WIFI',
  'ASISTENCIA_SMART_TV',
  'CONFIGURACION_IPTV',
  'CONFIGURACION_STREAMING',
  'ASESORIA_TELEFONICA',
  'CONSULTA_FACTURACION',
  'CONSULTA_PAGOS',
  'OTRO'
);

-- CreateEnum
CREATE TYPE "SrResultado" AS ENUM (
  'SOLUCIONADO',
  'SOLUCIONADO_PARCIAL',
  'ESCALADO_SOPORTE_TECNICO',
  'REQUIERE_VISITA',
  'PENDIENTE_SEGUIMIENTO',
  'SIN_SOLUCION'
);

-- CreateEnum
CREATE TYPE "SrTipoAdjunto" AS ENUM ('CAPTURA', 'FOTO_CLIENTE', 'PDF', 'OTRO');

-- CreateTable
CREATE TABLE "SrTicket" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "horaInicio" TIMESTAMP(3),
    "horaFin" TIMESTAMP(3),
    "tiempoMinutos" INTEGER,
    "operadorId" TEXT NOT NULL,
    "clienteId" TEXT,
    "clienteNombre" TEXT NOT NULL,
    "clienteCodigo" TEXT NOT NULL,
    "telefono" TEXT NOT NULL,
    "estado" "SrEstado" NOT NULL DEFAULT 'PENDIENTE',
    "tipoSoporte" "SrTipoSoporte" NOT NULL,
    "tipoSoporteOtro" TEXT,
    "descripcionProblema" TEXT NOT NULL,
    "solucionAplicada" TEXT,
    "resultado" "SrResultado",
    "observaciones" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SrTicket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SrAdjunto" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "tipo" "SrTipoAdjunto" NOT NULL,
    "nombreArchivo" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "dataBase64" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SrAdjunto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SrHistorial" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "usuarioId" TEXT NOT NULL,
    "usuarioNombre" TEXT NOT NULL,
    "tiempoMinutos" INTEGER,
    "estado" "SrEstado" NOT NULL,
    "nota" TEXT,

    CONSTRAINT "SrHistorial_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SrTicket_codigo_key" ON "SrTicket"("codigo");
CREATE INDEX "SrTicket_estado_fecha_idx" ON "SrTicket"("estado", "fecha");
CREATE INDEX "SrTicket_operadorId_idx" ON "SrTicket"("operadorId");
CREATE INDEX "SrTicket_clienteCodigo_idx" ON "SrTicket"("clienteCodigo");
CREATE INDEX "SrTicket_tipoSoporte_idx" ON "SrTicket"("tipoSoporte");
CREATE INDEX "SrAdjunto_ticketId_idx" ON "SrAdjunto"("ticketId");
CREATE INDEX "SrHistorial_ticketId_fecha_idx" ON "SrHistorial"("ticketId", "fecha");

-- AddForeignKey
ALTER TABLE "SrTicket" ADD CONSTRAINT "SrTicket_operadorId_fkey" FOREIGN KEY ("operadorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SrTicket" ADD CONSTRAINT "SrTicket_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SrAdjunto" ADD CONSTRAINT "SrAdjunto_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "SrTicket"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SrHistorial" ADD CONSTRAINT "SrHistorial_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "SrTicket"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SrHistorial" ADD CONSTRAINT "SrHistorial_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
