-- Encuesta de satisfacción por OT cerrada. Migración aditiva.
-- No elimina ni trunca tablas existentes.

CREATE TYPE "EstadoEncuestaSatisfaccion" AS ENUM ('PENDING', 'SENT', 'OPENED', 'ANSWERED', 'EXPIRED', 'CANCELLED');
CREATE TYPE "SolucionEncuesta" AS ENUM ('COMPLETAMENTE', 'PARCIALMENTE', 'NO');
CREATE TYPE "CanalEncuesta" AS ENUM ('WHATSAPP', 'SMS', 'EMAIL');
CREATE TYPE "EstadoSeguimientoSatisfaccion" AS ENUM ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CANCELLED');
CREATE TYPE "CategoriaComentarioSatisfaccion" AS ENUM ('ATENCION', 'TIEMPO_ESPERA', 'SOLUCION', 'TECNICO', 'INSTALACION', 'EQUIPAMIENTO', 'COMUNICACION', 'OTRO');

CREATE TABLE "CustomerSatisfactionSurvey" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "tecnicoId" TEXT,
    "token" TEXT NOT NULL,
    "tipoServicio" TEXT NOT NULL,
    "zona" TEXT,
    "ratingGeneral" INTEGER,
    "ratingTecnico" INTEGER,
    "solucionado" "SolucionEncuesta",
    "comentario" VARCHAR(1000),
    "categoria" "CategoriaComentarioSatisfaccion",
    "status" "EstadoEncuestaSatisfaccion" NOT NULL DEFAULT 'PENDING',
    "channel" "CanalEncuesta",
    "deliveryStatus" TEXT,
    "sentAt" TIMESTAMP(3),
    "openedAt" TIMESTAMP(3),
    "answeredAt" TIMESTAMP(3),
    "ipHash" TEXT,
    "userAgent" VARCHAR(180),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomerSatisfactionSurvey_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SatisfactionFollowUp" (
    "id" TEXT NOT NULL,
    "surveyId" TEXT NOT NULL,
    "responsableId" TEXT,
    "motivo" VARCHAR(500) NOT NULL,
    "accion" VARCHAR(1000),
    "contacto" VARCHAR(300),
    "resultado" VARCHAR(1000),
    "observaciones" VARCHAR(1000),
    "status" "EstadoSeguimientoSatisfaccion" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "SatisfactionFollowUp_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CustomerSatisfactionSurvey_ticketId_key" ON "CustomerSatisfactionSurvey"("ticketId");
CREATE UNIQUE INDEX "CustomerSatisfactionSurvey_token_key" ON "CustomerSatisfactionSurvey"("token");
CREATE INDEX "CustomerSatisfactionSurvey_clienteId_idx" ON "CustomerSatisfactionSurvey"("clienteId");
CREATE INDEX "CustomerSatisfactionSurvey_tecnicoId_idx" ON "CustomerSatisfactionSurvey"("tecnicoId");
CREATE INDEX "CustomerSatisfactionSurvey_status_idx" ON "CustomerSatisfactionSurvey"("status");
CREATE INDEX "CustomerSatisfactionSurvey_createdAt_idx" ON "CustomerSatisfactionSurvey"("createdAt");
CREATE INDEX "CustomerSatisfactionSurvey_answeredAt_idx" ON "CustomerSatisfactionSurvey"("answeredAt");
CREATE INDEX "CustomerSatisfactionSurvey_tipoServicio_idx" ON "CustomerSatisfactionSurvey"("tipoServicio");
CREATE INDEX "CustomerSatisfactionSurvey_zona_idx" ON "CustomerSatisfactionSurvey"("zona");
CREATE INDEX "SatisfactionFollowUp_surveyId_idx" ON "SatisfactionFollowUp"("surveyId");
CREATE INDEX "SatisfactionFollowUp_status_idx" ON "SatisfactionFollowUp"("status");
CREATE INDEX "SatisfactionFollowUp_createdAt_idx" ON "SatisfactionFollowUp"("createdAt");

ALTER TABLE "CustomerSatisfactionSurvey" ADD CONSTRAINT "CustomerSatisfactionSurvey_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CustomerSatisfactionSurvey" ADD CONSTRAINT "CustomerSatisfactionSurvey_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CustomerSatisfactionSurvey" ADD CONSTRAINT "CustomerSatisfactionSurvey_tecnicoId_fkey" FOREIGN KEY ("tecnicoId") REFERENCES "Tecnico"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SatisfactionFollowUp" ADD CONSTRAINT "SatisfactionFollowUp_surveyId_fkey" FOREIGN KEY ("surveyId") REFERENCES "CustomerSatisfactionSurvey"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SatisfactionFollowUp" ADD CONSTRAINT "SatisfactionFollowUp_responsableId_fkey" FOREIGN KEY ("responsableId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
