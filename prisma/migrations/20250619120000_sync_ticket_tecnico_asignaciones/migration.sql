-- Reparar asignaciones: Ticket.tecnicoId y TicketTecnico deben coincidir

INSERT INTO "TicketTecnico" ("ticketId", "tecnicoId")
SELECT t."id", t."tecnicoId"
FROM "Ticket" t
WHERE t."tecnicoId" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM "TicketTecnico" tt
    WHERE tt."ticketId" = t."id" AND tt."tecnicoId" = t."tecnicoId"
  );

UPDATE "Ticket" t
SET "tecnicoId" = sub."tecnicoId"
FROM (
  SELECT DISTINCT ON (tt."ticketId") tt."ticketId", tt."tecnicoId"
  FROM "TicketTecnico" tt
  ORDER BY tt."ticketId", tt."asignadoEn" ASC
) sub
WHERE t."id" = sub."ticketId"
  AND t."tecnicoId" IS NULL;
