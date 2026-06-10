-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Rol" AS ENUM ('TECNICO', 'SUPERVISOR', 'ADMIN');

-- CreateEnum
CREATE TYPE "EstadoTecnico" AS ENUM ('DISPONIBLE', 'TRABAJANDO', 'DESCANSO', 'OFFLINE');

-- CreateEnum
CREATE TYPE "TipoTrabajo" AS ENUM ('INSTALACION', 'SOPORTE', 'MIGRACION', 'RECONEXION', 'RETIRO', 'CORTE');

-- CreateEnum
CREATE TYPE "Prioridad" AS ENUM ('ALTA', 'MEDIA', 'BAJA');

-- CreateEnum
CREATE TYPE "EstadoTicket" AS ENUM ('PENDIENTE', 'EN_PROCESO', 'FINALIZADO', 'CERRADO', 'CANCELADO');

-- CreateEnum
CREATE TYPE "TipoFoto" AS ENUM ('FACHADA', 'POSTE', 'NAP', 'TRABAJO', 'EMPALME', 'CAJA_TERMINAL', 'ONU', 'SPEEDTEST', 'CLIENTE_CONFORME');

-- CreateTable
CREATE TABLE "Usuario" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "rol" "Rol" NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tecnico" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "telefono" TEXT,
    "vehiculo" TEXT,
    "estadoActual" "EstadoTecnico" NOT NULL DEFAULT 'DISPONIBLE',
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tecnico_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cliente" (
    "id" TEXT NOT NULL,
    "cedula" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "telefono" TEXT NOT NULL,
    "plan" TEXT NOT NULL,
    "direccion" TEXT NOT NULL,
    "sector" TEXT NOT NULL,
    "referencia" TEXT,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "nodo" TEXT,
    "cajaNap" TEXT,
    "puerto" TEXT,
    "onuSerial" TEXT,
    "potencia" DOUBLE PRECISION,
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Cliente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Ticket" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "tecnicoId" TEXT,
    "tipo" "TipoTrabajo" NOT NULL,
    "prioridad" "Prioridad" NOT NULL DEFAULT 'MEDIA',
    "estado" "EstadoTicket" NOT NULL DEFAULT 'PENDIENTE',
    "motivo" TEXT,
    "descripcion" TEXT,
    "slaHoras" INTEGER NOT NULL DEFAULT 8,
    "slaVenceEn" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Ticket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrdenServicio" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "iniciadoEn" TIMESTAMP(3),
    "finalizadoEn" TIMESTAMP(3),
    "latInicio" DOUBLE PRECISION,
    "lngInicio" DOUBLE PRECISION,
    "latFin" DOUBLE PRECISION,
    "lngFin" DOUBLE PRECISION,
    "servicioOk" BOOLEAN NOT NULL DEFAULT false,
    "potenciaOk" BOOLEAN NOT NULL DEFAULT false,
    "fotosOk" BOOLEAN NOT NULL DEFAULT false,
    "clienteConforme" BOOLEAN NOT NULL DEFAULT false,
    "firmaOk" BOOLEAN NOT NULL DEFAULT false,
    "whatsappEnviado" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "OrdenServicio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cronometro" (
    "id" TEXT NOT NULL,
    "ordenId" TEXT NOT NULL,
    "inicio" TIMESTAMP(3),
    "fin" TIMESTAMP(3),
    "pausasJson" TEXT NOT NULL DEFAULT '[]',
    "duracionSegundos" INTEGER NOT NULL DEFAULT 0,
    "activo" BOOLEAN NOT NULL DEFAULT false,
    "pausado" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Cronometro_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UbicacionGps" (
    "id" TEXT NOT NULL,
    "tecnicoId" TEXT NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "precision" DOUBLE PRECISION,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UbicacionGps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Medicion" (
    "id" TEXT NOT NULL,
    "ordenId" TEXT NOT NULL,
    "rxDbm" DOUBLE PRECISION NOT NULL,
    "txDbm" DOUBLE PRECISION NOT NULL,
    "pingMs" DOUBLE PRECISION,
    "downloadMbps" DOUBLE PRECISION NOT NULL,
    "uploadMbps" DOUBLE PRECISION NOT NULL,
    "registradoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Medicion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Fotografia" (
    "id" TEXT NOT NULL,
    "ordenId" TEXT NOT NULL,
    "tipo" "TipoFoto" NOT NULL,
    "url" TEXT NOT NULL,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "tomadaEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Fotografia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Firma" (
    "id" TEXT NOT NULL,
    "ordenId" TEXT NOT NULL,
    "nombreCliente" TEXT NOT NULL,
    "cedula" TEXT NOT NULL,
    "imagenUrl" TEXT NOT NULL,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "firmadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Firma_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Inventario" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "unidad" TEXT NOT NULL DEFAULT 'unidad',
    "stock" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "stockMin" DOUBLE PRECISION NOT NULL DEFAULT 5,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Inventario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MaterialUtilizado" (
    "id" TEXT NOT NULL,
    "ordenId" TEXT NOT NULL,
    "inventarioId" TEXT NOT NULL,
    "cantidad" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "MaterialUtilizado_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EvaluacionCliente" (
    "id" TEXT NOT NULL,
    "ticketCodigo" TEXT NOT NULL,
    "calificacion" INTEGER NOT NULL,
    "comentario" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EvaluacionCliente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventoTicket" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "usuarioId" TEXT,
    "accion" TEXT NOT NULL,
    "metadata" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventoTicket_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_email_key" ON "Usuario"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Tecnico_usuarioId_key" ON "Tecnico"("usuarioId");

-- CreateIndex
CREATE UNIQUE INDEX "Cliente_cedula_key" ON "Cliente"("cedula");

-- CreateIndex
CREATE UNIQUE INDEX "Ticket_codigo_key" ON "Ticket"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "OrdenServicio_ticketId_key" ON "OrdenServicio"("ticketId");

-- CreateIndex
CREATE UNIQUE INDEX "Cronometro_ordenId_key" ON "Cronometro"("ordenId");

-- CreateIndex
CREATE UNIQUE INDEX "Medicion_ordenId_key" ON "Medicion"("ordenId");

-- CreateIndex
CREATE UNIQUE INDEX "Firma_ordenId_key" ON "Firma"("ordenId");

-- CreateIndex
CREATE UNIQUE INDEX "Inventario_nombre_key" ON "Inventario"("nombre");

-- AddForeignKey
ALTER TABLE "Tecnico" ADD CONSTRAINT "Tecnico_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_tecnicoId_fkey" FOREIGN KEY ("tecnicoId") REFERENCES "Tecnico"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrdenServicio" ADD CONSTRAINT "OrdenServicio_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cronometro" ADD CONSTRAINT "Cronometro_ordenId_fkey" FOREIGN KEY ("ordenId") REFERENCES "OrdenServicio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UbicacionGps" ADD CONSTRAINT "UbicacionGps_tecnicoId_fkey" FOREIGN KEY ("tecnicoId") REFERENCES "Tecnico"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Medicion" ADD CONSTRAINT "Medicion_ordenId_fkey" FOREIGN KEY ("ordenId") REFERENCES "OrdenServicio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Fotografia" ADD CONSTRAINT "Fotografia_ordenId_fkey" FOREIGN KEY ("ordenId") REFERENCES "OrdenServicio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Firma" ADD CONSTRAINT "Firma_ordenId_fkey" FOREIGN KEY ("ordenId") REFERENCES "OrdenServicio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialUtilizado" ADD CONSTRAINT "MaterialUtilizado_ordenId_fkey" FOREIGN KEY ("ordenId") REFERENCES "OrdenServicio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialUtilizado" ADD CONSTRAINT "MaterialUtilizado_inventarioId_fkey" FOREIGN KEY ("inventarioId") REFERENCES "Inventario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventoTicket" ADD CONSTRAINT "EventoTicket_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventoTicket" ADD CONSTRAINT "EventoTicket_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
