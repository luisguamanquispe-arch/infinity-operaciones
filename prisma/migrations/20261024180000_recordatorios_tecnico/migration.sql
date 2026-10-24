-- Recordatorios persistentes de órdenes para técnicos.
-- Additive. No altera estados ni fechas de Ticket.

CREATE TYPE "TipoNotificacionTecnico" AS ENUM (
  'ASIGNACION',
  'PREVIO_VENCIMIENTO',
  'VENCIMIENTO',
  'VENCIDO_REPETICION'
);

CREATE TYPE "CanalNotificacionTecnico" AS ENUM ('INTERNO', 'PUSH');

CREATE TYPE "EstadoEntregaNotificacion" AS ENUM (
  'PENDIENTE',
  'ENVIADO',
  'FALLIDO',
  'OMITIDO'
);

CREATE TABLE "RecordatorioTareaConfig" (
  "id" TEXT NOT NULL DEFAULT 'default',
  "activo" BOOLEAN NOT NULL DEFAULT true,
  "minutosAnticipacion" INTEGER NOT NULL DEFAULT 30,
  "minutosRepeticion" INTEGER NOT NULL DEFAULT 60,
  "maxRepeticiones" INTEGER NOT NULL DEFAULT 8,
  "internoHabilitado" BOOLEAN NOT NULL DEFAULT true,
  "pushHabilitado" BOOLEAN NOT NULL DEFAULT true,
  "respetarHorario" BOOLEAN NOT NULL DEFAULT true,
  "horaInicio" INTEGER NOT NULL DEFAULT 7,
  "horaFin" INTEGER NOT NULL DEFAULT 21,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "RecordatorioTareaConfig_pkey" PRIMARY KEY ("id")
);

INSERT INTO "RecordatorioTareaConfig" ("id") VALUES ('default');

CREATE TABLE "NotificacionTecnico" (
  "id" TEXT NOT NULL,
  "tecnicoId" TEXT NOT NULL,
  "ticketId" TEXT,
  "tipo" "TipoNotificacionTecnico" NOT NULL,
  "titulo" TEXT NOT NULL,
  "cuerpo" TEXT NOT NULL,
  "claveIdem" TEXT NOT NULL,
  "leida" BOOLEAN NOT NULL DEFAULT false,
  "leidaEn" TIMESTAMP(3),
  "prioridad" "Prioridad",
  "codigoTicket" TEXT,
  "vencimientoEn" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "NotificacionTecnico_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "NotificacionTecnico_claveIdem_key" ON "NotificacionTecnico"("claveIdem");
CREATE INDEX "NotificacionTecnico_tecnicoId_leida_createdAt_idx"
  ON "NotificacionTecnico"("tecnicoId", "leida", "createdAt");
CREATE INDEX "NotificacionTecnico_ticketId_createdAt_idx"
  ON "NotificacionTecnico"("ticketId", "createdAt");
CREATE INDEX "NotificacionTecnico_tipo_createdAt_idx"
  ON "NotificacionTecnico"("tipo", "createdAt");

ALTER TABLE "NotificacionTecnico"
  ADD CONSTRAINT "NotificacionTecnico_tecnicoId_fkey"
  FOREIGN KEY ("tecnicoId") REFERENCES "Tecnico"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "NotificacionTecnico"
  ADD CONSTRAINT "NotificacionTecnico_ticketId_fkey"
  FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "NotificacionTecnicoEntrega" (
  "id" TEXT NOT NULL,
  "notificacionId" TEXT NOT NULL,
  "canal" "CanalNotificacionTecnico" NOT NULL,
  "estado" "EstadoEntregaNotificacion" NOT NULL,
  "intentos" INTEGER NOT NULL DEFAULT 0,
  "ultimoError" TEXT,
  "enviadoEn" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "NotificacionTecnicoEntrega_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "NotificacionTecnicoEntrega_notificacionId_canal_idx"
  ON "NotificacionTecnicoEntrega"("notificacionId", "canal");
CREATE INDEX "NotificacionTecnicoEntrega_estado_createdAt_idx"
  ON "NotificacionTecnicoEntrega"("estado", "createdAt");

ALTER TABLE "NotificacionTecnicoEntrega"
  ADD CONSTRAINT "NotificacionTecnicoEntrega_notificacionId_fkey"
  FOREIGN KEY ("notificacionId") REFERENCES "NotificacionTecnico"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "TecnicoPushSubscription" (
  "id" TEXT NOT NULL,
  "tecnicoId" TEXT NOT NULL,
  "endpoint" TEXT NOT NULL,
  "p256dh" TEXT NOT NULL,
  "auth" TEXT NOT NULL,
  "userAgent" TEXT,
  "activo" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "TecnicoPushSubscription_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TecnicoPushSubscription_endpoint_key" ON "TecnicoPushSubscription"("endpoint");
CREATE INDEX "TecnicoPushSubscription_tecnicoId_activo_idx"
  ON "TecnicoPushSubscription"("tecnicoId", "activo");

ALTER TABLE "TecnicoPushSubscription"
  ADD CONSTRAINT "TecnicoPushSubscription_tecnicoId_fkey"
  FOREIGN KEY ("tecnicoId") REFERENCES "Tecnico"("id") ON DELETE CASCADE ON UPDATE CASCADE;
