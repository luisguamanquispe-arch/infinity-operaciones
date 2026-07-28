-- Fase 1 (E1) — SELECTs de auditoría (solo lectura)
-- NO ejecutar UPDATEs desde este archivo.

-- Totales
SELECT 'Usuario' AS t, COUNT(*)::int AS n FROM "Usuario"
UNION ALL SELECT 'Tecnico', COUNT(*)::int FROM "Tecnico"
UNION ALL SELECT 'Ticket', COUNT(*)::int FROM "Ticket"
UNION ALL SELECT 'TicketTecnico', COUNT(*)::int FROM "TicketTecnico"
UNION ALL SELECT 'OrdenServicio', COUNT(*)::int FROM "OrdenServicio"
UNION ALL SELECT 'Cronometro', COUNT(*)::int FROM "Cronometro"
UNION ALL SELECT 'EventoTicket', COUNT(*)::int FROM "EventoTicket";

-- A) Usuario TECNICO sin Tecnico
SELECT u.id, u.email, u.nombre
FROM "Usuario" u
LEFT JOIN "Tecnico" t ON t."usuarioId" = u.id
WHERE u.rol = 'TECNICO' AND t.id IS NULL;

-- B) Tecnico sin Usuario
SELECT t.id, t."usuarioId"
FROM "Tecnico" t
LEFT JOIN "Usuario" u ON u.id = t."usuarioId"
WHERE u.id IS NULL;

-- C) Ticket.tecnicoId huérfano
SELECT tk.id, tk.codigo, tk."tecnicoId"
FROM "Ticket" tk
LEFT JOIN "Tecnico" t ON t.id = tk."tecnicoId"
WHERE tk."tecnicoId" IS NOT NULL AND t.id IS NULL;

-- D) TicketTecnico.tecnicoId huérfano
SELECT tt."ticketId", tt."tecnicoId"
FROM "TicketTecnico" tt
LEFT JOIN "Tecnico" t ON t.id = tt."tecnicoId"
WHERE t.id IS NULL;

-- E) Usuario con más de un Tecnico
SELECT t."usuarioId", COUNT(*) AS n
FROM "Tecnico" t
GROUP BY t."usuarioId"
HAVING COUNT(*) > 1;

-- F) Homónimos (mismo nombre, distinto email)
SELECT UPPER(TRIM(u.nombre)) AS nombre_norm,
       COUNT(DISTINCT u.email) AS n_emails,
       ARRAY_AGG(DISTINCT u.email) AS emails,
       ARRAY_AGG(DISTINCT t.id) AS tecnico_ids
FROM "Tecnico" t
JOIN "Usuario" u ON u.id = t."usuarioId"
GROUP BY UPPER(TRIM(u.nombre))
HAVING COUNT(DISTINCT u.email) > 1;
