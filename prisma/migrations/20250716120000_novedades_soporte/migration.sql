-- CreateEnum
CREATE TYPE "TipoNovedadTicket" AS ENUM ('CLIENTE_AUSENTE', 'SOLICITA_REPROGRAMACION', 'OTRO');
CREATE TYPE "EstadoNovedadTicket" AS ENUM ('PENDIENTE', 'REPROGRAMADA', 'DESCARTADA');

-- CreateTable
CREATE TABLE "NovedadTicket" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "tecnicoId" TEXT NOT NULL,
    "tipo" "TipoNovedadTicket" NOT NULL,
    "comentario" TEXT,
    "fechaSolicitada" TIMESTAMP(3),
    "estado" "EstadoNovedadTicket" NOT NULL DEFAULT 'PENDIENTE',
    "programadoEnAnterior" TIMESTAMP(3),
    "programadoEnNuevo" TIMESTAMP(3),
    "resueltaPorId" TEXT,
    "resueltaEn" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NovedadTicket_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "NovedadTicket_estado_idx" ON "NovedadTicket"("estado");
CREATE INDEX "NovedadTicket_ticketId_idx" ON "NovedadTicket"("ticketId");
CREATE INDEX "NovedadTicket_createdAt_idx" ON "NovedadTicket"("createdAt");

ALTER TABLE "NovedadTicket" ADD CONSTRAINT "NovedadTicket_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "NovedadTicket" ADD CONSTRAINT "NovedadTicket_tecnicoId_fkey" FOREIGN KEY ("tecnicoId") REFERENCES "Tecnico"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "NovedadTicket" ADD CONSTRAINT "NovedadTicket_resueltaPorId_fkey" FOREIGN KEY ("resueltaPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
