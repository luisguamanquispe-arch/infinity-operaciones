-- Tabla many-to-many: varios técnicos por ticket
CREATE TABLE "TicketTecnico" (
    "ticketId" TEXT NOT NULL,
    "tecnicoId" TEXT NOT NULL,
    "asignadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TicketTecnico_pkey" PRIMARY KEY ("ticketId","tecnicoId")
);

INSERT INTO "TicketTecnico" ("ticketId", "tecnicoId")
SELECT "id", "tecnicoId" FROM "Ticket" WHERE "tecnicoId" IS NOT NULL;

ALTER TABLE "TicketTecnico" ADD CONSTRAINT "TicketTecnico_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TicketTecnico" ADD CONSTRAINT "TicketTecnico_tecnicoId_fkey" FOREIGN KEY ("tecnicoId") REFERENCES "Tecnico"("id") ON DELETE CASCADE ON UPDATE CASCADE;
