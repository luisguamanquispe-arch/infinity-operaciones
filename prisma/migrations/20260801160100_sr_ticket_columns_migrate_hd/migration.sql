-- Paso 2: columnas SrTicket + migración datos HdConversacion → SrTicket

-- Renombrar solución → acciones realizadas
ALTER TABLE "SrTicket" RENAME COLUMN "solucionAplicada" TO "accionesRealizadas";

-- Prioridad y vínculo presencial
ALTER TABLE "SrTicket" ADD COLUMN IF NOT EXISTS "prioridad" "Prioridad" NOT NULL DEFAULT 'MEDIA';
ALTER TABLE "SrTicket" ADD COLUMN IF NOT EXISTS "ticketPresencialId" TEXT;
ALTER TABLE "SrTicket" ADD COLUMN IF NOT EXISTS "codigoOrigenHd" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "SrTicket_ticketPresencialId_key" ON "SrTicket"("ticketPresencialId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'SrTicket_ticketPresencialId_fkey'
  ) THEN
    ALTER TABLE "SrTicket"
      ADD CONSTRAINT "SrTicket_ticketPresencialId_fkey"
      FOREIGN KEY ("ticketPresencialId") REFERENCES "Ticket"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- Migrar conversaciones Help Desk → Soporte Remoto (sin pérdida)
-- Solo si existe la tabla HdConversacion y aún no migradas
DO $$
DECLARE
  op_id TEXT;
  max_n INT := 1000;
  r RECORD;
  new_codigo TEXT;
  new_id TEXT;
  est "SrEstado";
  res "SrResultado";
  problema TEXT;
  acciones TEXT;
  nom TEXT;
  cod TEXT;
  tel TEXT;
  mins INT;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'HdConversacion'
  ) THEN
    RETURN;
  END IF;

  SELECT id INTO op_id FROM "Usuario"
  WHERE activo = true AND rol IN ('HELP_DESK', 'SUPERVISOR', 'ADMIN')
  ORDER BY CASE rol WHEN 'ADMIN' THEN 0 WHEN 'SUPERVISOR' THEN 1 ELSE 2 END
  LIMIT 1;

  IF op_id IS NULL THEN
    SELECT id INTO op_id FROM "Usuario" LIMIT 1;
  END IF;

  IF op_id IS NULL THEN
    RETURN;
  END IF;

  SELECT COALESCE(MAX(CAST(SUBSTRING(codigo FROM 4) AS INT)), 1000)
  INTO max_n
  FROM "SrTicket"
  WHERE codigo ~ '^SR-[0-9]+$';

  FOR r IN
    SELECT c.*,
      cl.nombre AS cl_nombre,
      cl.cedula AS cl_cedula,
      cl.telefono AS cl_tel,
      u.nombre AS op_nombre
    FROM "HdConversacion" c
    LEFT JOIN "Cliente" cl ON cl.id = c."clienteId"
    LEFT JOIN "Usuario" u ON u.id = c."asignadoAId"
    WHERE NOT EXISTS (
      SELECT 1 FROM "SrTicket" s WHERE s."codigoOrigenHd" = c.codigo
    )
    ORDER BY c."createdAt" ASC
  LOOP
    max_n := max_n + 1;
    new_codigo := 'SR-' || max_n::TEXT;
    new_id := 'sr_mig_' || replace(r.id, '-', '');

    est := CASE r.estado::TEXT
      WHEN 'EN_COLA' THEN 'PENDIENTE'::"SrEstado"
      WHEN 'EN_ATENCION' THEN 'EN_PROCESO'::"SrEstado"
      WHEN 'EN_ESPERA_CLIENTE' THEN 'EN_PROCESO'::"SrEstado"
      WHEN 'RESUELTO' THEN 'FINALIZADO'::"SrEstado"
      WHEN 'CERRADO' THEN 'FINALIZADO'::"SrEstado"
      WHEN 'ESCALADO' THEN 'ESCALADO'::"SrEstado"
      ELSE 'PENDIENTE'::"SrEstado"
    END;

    res := CASE r.estado::TEXT
      WHEN 'RESUELTO' THEN 'SOLUCIONADO'::"SrResultado"
      WHEN 'CERRADO' THEN 'SOLUCIONADO'::"SrResultado"
      WHEN 'ESCALADO' THEN 'ESCALADO_SOPORTE_TECNICO'::"SrResultado"
      ELSE NULL
    END;

    SELECT string_agg(
      '[' || m.autor::TEXT || '] ' || left(m.contenido, 2000),
      E'\n'
      ORDER BY m."createdAt"
    )
    INTO problema
    FROM "HdMensaje" m
    WHERE m."conversacionId" = r.id
      AND m.autor IN ('CLIENTE', 'SISTEMA');

    SELECT string_agg(
      '[' || m.autor::TEXT || '] ' || left(m.contenido, 2000),
      E'\n'
      ORDER BY m."createdAt"
    )
    INTO acciones
    FROM "HdMensaje" m
    WHERE m."conversacionId" = r.id
      AND m.autor IN ('AGENTE', 'IA');

    IF problema IS NULL OR length(trim(problema)) < 3 THEN
      problema := COALESCE(NULLIF(trim(r.motivo), ''), NULLIF(trim(r."resumenIa"), ''), 'Migrado desde Help Desk ' || r.codigo);
    END IF;

    IF acciones IS NULL THEN
      acciones := COALESCE(r."diagnosticoIa", r."resumenIa");
    END IF;

    nom := COALESCE(NULLIF(r.cl_nombre, ''), NULLIF(r."prospectoNombre", ''), 'PROSPECTO / SIN NOMBRE');
    cod := COALESCE(NULLIF(r.cl_cedula, ''), 'HD-' || r.codigo);
    tel := COALESCE(NULLIF(r.cl_tel, ''), NULLIF(r."prospectoTelefono", ''), '0000000000');

    mins := NULL;
    IF r."cerradoEn" IS NOT NULL THEN
      mins := GREATEST(0, ROUND(EXTRACT(EPOCH FROM (r."cerradoEn" - r."createdAt")) / 60.0)::INT);
    END IF;

    INSERT INTO "SrTicket" (
      id, codigo, fecha, "horaInicio", "horaFin", "tiempoMinutos",
      "operadorId", "clienteId", "clienteNombre", "clienteCodigo", telefono,
      estado, prioridad, "tipoSoporte", "descripcionProblema", "accionesRealizadas",
      resultado, observaciones, "ticketPresencialId", "codigoOrigenHd",
      "createdAt", "updatedAt"
    ) VALUES (
      new_id,
      new_codigo,
      r."createdAt",
      r."createdAt",
      r."cerradoEn",
      mins,
      COALESCE(r."asignadoAId", op_id),
      r."clienteId",
      upper(nom),
      cod,
      tel,
      est,
      COALESCE(r.prioridad, 'MEDIA'::"Prioridad"),
      'ASESORIA_TELEFONICA'::"SrTipoSoporte",
      problema,
      acciones,
      res,
      'Migrado desde Help Desk ' || r.codigo ||
        CASE WHEN r.canal IS NOT NULL THEN ' · Canal: ' || r.canal::TEXT ELSE '' END ||
        CASE WHEN r.motivo IS NOT NULL AND r.motivo <> '' THEN E'\nMotivo HD: ' || r.motivo ELSE '' END,
      r."ticketId",
      r.codigo,
      r."createdAt",
      NOW()
    );

    INSERT INTO "SrHistorial" (
      id, "ticketId", fecha, "usuarioId", "usuarioNombre",
      "tiempoMinutos", estado, nota
    ) VALUES (
      'srh_mig_' || replace(r.id, '-', ''),
      new_id,
      r."createdAt",
      COALESCE(r."asignadoAId", op_id),
      COALESCE(r.op_nombre, 'SISTEMA'),
      mins,
      est,
      'Migrado desde conversación Help Desk ' || r.codigo
    );
  END LOOP;
END $$;
