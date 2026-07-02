-- Infinity Remote Help Desk

CREATE TYPE "HdCanal" AS ENUM ('WHATSAPP', 'CHAT', 'LLAMADA', 'VIDEO');
CREATE TYPE "HdEstadoConversacion" AS ENUM ('EN_COLA', 'EN_ATENCION', 'EN_ESPERA_CLIENTE', 'RESUELTO', 'ESCALADO', 'CERRADO');
CREATE TYPE "HdTipoCliente" AS ENUM ('EXISTENTE', 'NUEVO', 'PROSPECTO');
CREATE TYPE "HdMotivoEscalamiento" AS ENUM ('FIBRA_ROTA', 'NAP_DANADA', 'ONU_DANADA', 'ROUTER_DANADO', 'SIN_POTENCIA', 'CAMBIO_ACOMETIDA', 'INSTALACION', 'MUDANZA', 'REUBICACION', 'OTRO');
CREATE TYPE "HdTipoAccionRemota" AS ENUM ('WIFI_SSID', 'WIFI_PASSWORD', 'WIFI_CANAL', 'WIFI_OCULTAR', 'ROUTER_REINICIO', 'ROUTER_FIRMWARE', 'ROUTER_BACKUP', 'ROUTER_RESTORE', 'SPEED_TEST', 'PING', 'TRACEROUTE', 'DNS_TEST', 'DIAG_POTENCIA', 'DIAG_ONU', 'DIAG_DISPOSITIVOS', 'OTRO');
CREATE TYPE "HdAutorMensaje" AS ENUM ('CLIENTE', 'AGENTE', 'IA', 'SISTEMA');

ALTER TYPE "Rol" ADD VALUE IF NOT EXISTS 'HELP_DESK';

CREATE TABLE "HdConversacion" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "clienteId" TEXT,
    "prospectoNombre" TEXT,
    "prospectoTelefono" TEXT,
    "prospectoEmail" TEXT,
    "canal" "HdCanal" NOT NULL DEFAULT 'WHATSAPP',
    "estado" "HdEstadoConversacion" NOT NULL DEFAULT 'EN_COLA',
    "tipoCliente" "HdTipoCliente" NOT NULL DEFAULT 'EXISTENTE',
    "asignadoAId" TEXT,
    "ticketId" TEXT,
    "motivo" TEXT,
    "resumenIa" TEXT,
    "diagnosticoIa" TEXT,
    "prioridad" "Prioridad" NOT NULL DEFAULT 'MEDIA',
    "slaVenceEn" TIMESTAMP(3),
    "satisfaccion" INTEGER,
    "metadataJson" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "cerradoEn" TIMESTAMP(3),
    CONSTRAINT "HdConversacion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "HdMensaje" (
    "id" TEXT NOT NULL,
    "conversacionId" TEXT NOT NULL,
    "autor" "HdAutorMensaje" NOT NULL,
    "usuarioId" TEXT,
    "contenido" TEXT NOT NULL,
    "metadataJson" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "HdMensaje_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "HdAccionRemota" (
    "id" TEXT NOT NULL,
    "conversacionId" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "tipo" "HdTipoAccionRemota" NOT NULL,
    "configAnterior" TEXT,
    "configNueva" TEXT,
    "motivo" TEXT,
    "observaciones" TEXT,
    "ipAgente" TEXT,
    "exito" BOOLEAN NOT NULL DEFAULT true,
    "resultadoJson" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "HdAccionRemota_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "HdEscalamiento" (
    "id" TEXT NOT NULL,
    "conversacionId" TEXT NOT NULL,
    "motivo" "HdMotivoEscalamiento" NOT NULL,
    "ticketEscaladoId" TEXT,
    "resumenIa" TEXT NOT NULL,
    "diagnostico" TEXT,
    "accionesJson" TEXT,
    "materialSugerido" TEXT,
    "tiempoEstimadoMin" INTEGER,
    "prioridad" "Prioridad" NOT NULL DEFAULT 'MEDIA',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "HdEscalamiento_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "HdSugerenciaIa" (
    "id" TEXT NOT NULL,
    "conversacionId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "contenido" TEXT NOT NULL,
    "metadataJson" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "HdSugerenciaIa_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "HdArticuloConocimiento" (
    "id" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "categoria" TEXT NOT NULL,
    "marca" TEXT,
    "contenido" TEXT NOT NULL,
    "tags" TEXT NOT NULL DEFAULT '',
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "HdArticuloConocimiento_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "HdSesionAgente" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "conectado" BOOLEAN NOT NULL DEFAULT false,
    "ultimoPing" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "HdSesionAgente_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "HdConversacion_codigo_key" ON "HdConversacion"("codigo");
CREATE UNIQUE INDEX "HdConversacion_ticketId_key" ON "HdConversacion"("ticketId");
CREATE UNIQUE INDEX "HdEscalamiento_conversacionId_key" ON "HdEscalamiento"("conversacionId");
CREATE UNIQUE INDEX "HdEscalamiento_ticketEscaladoId_key" ON "HdEscalamiento"("ticketEscaladoId");
CREATE UNIQUE INDEX "HdSesionAgente_usuarioId_key" ON "HdSesionAgente"("usuarioId");

CREATE INDEX "HdConversacion_estado_idx" ON "HdConversacion"("estado");
CREATE INDEX "HdConversacion_asignadoAId_idx" ON "HdConversacion"("asignadoAId");
CREATE INDEX "HdConversacion_createdAt_idx" ON "HdConversacion"("createdAt");
CREATE INDEX "HdMensaje_conversacionId_createdAt_idx" ON "HdMensaje"("conversacionId", "createdAt");
CREATE INDEX "HdAccionRemota_conversacionId_idx" ON "HdAccionRemota"("conversacionId");
CREATE INDEX "HdAccionRemota_createdAt_idx" ON "HdAccionRemota"("createdAt");
CREATE INDEX "HdSugerenciaIa_conversacionId_createdAt_idx" ON "HdSugerenciaIa"("conversacionId", "createdAt");
CREATE INDEX "HdArticuloConocimiento_categoria_idx" ON "HdArticuloConocimiento"("categoria");
CREATE INDEX "HdArticuloConocimiento_marca_idx" ON "HdArticuloConocimiento"("marca");

ALTER TABLE "HdConversacion" ADD CONSTRAINT "HdConversacion_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "HdConversacion" ADD CONSTRAINT "HdConversacion_asignadoAId_fkey" FOREIGN KEY ("asignadoAId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "HdConversacion" ADD CONSTRAINT "HdConversacion_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "HdMensaje" ADD CONSTRAINT "HdMensaje_conversacionId_fkey" FOREIGN KEY ("conversacionId") REFERENCES "HdConversacion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "HdAccionRemota" ADD CONSTRAINT "HdAccionRemota_conversacionId_fkey" FOREIGN KEY ("conversacionId") REFERENCES "HdConversacion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "HdAccionRemota" ADD CONSTRAINT "HdAccionRemota_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "HdEscalamiento" ADD CONSTRAINT "HdEscalamiento_conversacionId_fkey" FOREIGN KEY ("conversacionId") REFERENCES "HdConversacion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "HdEscalamiento" ADD CONSTRAINT "HdEscalamiento_ticketEscaladoId_fkey" FOREIGN KEY ("ticketEscaladoId") REFERENCES "Ticket"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "HdSugerenciaIa" ADD CONSTRAINT "HdSugerenciaIa_conversacionId_fkey" FOREIGN KEY ("conversacionId") REFERENCES "HdConversacion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "HdSesionAgente" ADD CONSTRAINT "HdSesionAgente_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;
