-- Parque automotor (no destructivo). Tipos y tablas nuevas; no ALTER de tickets/roles.

CREATE TYPE "EstadoVehiculo" AS ENUM ('DISPONIBLE', 'ASIGNADO', 'MANTENIMIENTO', 'FUERA_SERVICIO', 'INACTIVO');
CREATE TYPE "TipoVehiculo" AS ENUM ('CAMIONETA', 'AUTO', 'MOTO', 'FURGON', 'OTRO');
CREATE TYPE "TipoActaVehiculo" AS ENUM ('ENTREGA', 'RECEPCION');
CREATE TYPE "TipoFirmaActaVehiculo" AS ENUM ('TECNICO', 'ADMINISTRADOR');
CREATE TYPE "ResultadoInspeccionVehiculo" AS ENUM ('APROBADO', 'CON_NOVEDADES', 'NO_APTO');
CREATE TYPE "TipoMantenimientoVehiculo" AS ENUM ('ACEITE', 'FILTROS', 'FRENOS', 'LLANTAS', 'BATERIA', 'SUSPENSION', 'MOTOR', 'TRANSMISION', 'SISTEMA_ELECTRICO', 'AIRE_ACONDICIONADO', 'CORREA_DISTRIBUCION', 'REPARACION_GENERAL', 'OTRO');
CREATE TYPE "ClaseMantenimientoVehiculo" AS ENUM ('PREVENTIVO', 'CORRECTIVO');
CREATE TYPE "TipoNovedadVehiculo" AS ENUM ('MECANICA', 'ELECTRICA', 'CARROCERIA', 'NEUMATICOS', 'ACCIDENTE', 'ACCESORIOS', 'OTRO');
CREATE TYPE "EstadoNovedadVehiculo" AS ENUM ('REPORTADA', 'EN_REVISION', 'APROBADA', 'EN_REPARACION', 'RESUELTA', 'CANCELADA');
CREATE TYPE "GravedadNovedadVehiculo" AS ENUM ('BAJA', 'MEDIA', 'ALTA', 'CRITICA');
CREATE TYPE "TipoDocumentoVehiculo" AS ENUM ('MATRICULA', 'REVISION', 'SEGURO', 'PERMISO', 'OTRO');
CREATE TYPE "OrigenKmVehiculo" AS ENUM ('INSPECCION', 'COMBUSTIBLE', 'ASIGNACION', 'MANUAL', 'MANTENIMIENTO', 'NOVEDAD');
CREATE TYPE "EstadoRegistroVehiculo" AS ENUM ('ACTIVO', 'ANULADO', 'CORREGIDO');

CREATE TABLE "Vehiculo" (
    "id" TEXT NOT NULL,
    "placa" TEXT NOT NULL,
    "marca" TEXT NOT NULL,
    "modelo" TEXT NOT NULL,
    "anio" INTEGER NOT NULL,
    "color" TEXT,
    "tipo" "TipoVehiculo" NOT NULL DEFAULT 'CAMIONETA',
    "vin" TEXT,
    "numeroMotor" TEXT,
    "kilometrajeInicial" INTEGER NOT NULL DEFAULT 0,
    "kilometrajeActual" INTEGER NOT NULL DEFAULT 0,
    "fechaAdquisicion" TIMESTAMP(3),
    "estado" "EstadoVehiculo" NOT NULL DEFAULT 'DISPONIBLE',
    "observaciones" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Vehiculo_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Vehiculo_placa_key" ON "Vehiculo"("placa");
CREATE INDEX "Vehiculo_estado_idx" ON "Vehiculo"("estado");
CREATE INDEX "Vehiculo_kilometrajeActual_idx" ON "Vehiculo"("kilometrajeActual");

CREATE TABLE "AsignacionVehiculo" (
    "id" TEXT NOT NULL,
    "vehiculoId" TEXT NOT NULL,
    "tecnicoId" TEXT NOT NULL,
    "fechaInicio" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fechaFin" TIMESTAMP(3),
    "kilometrajeEntrega" INTEGER NOT NULL,
    "kilometrajeRecepcion" INTEGER,
    "combustibleEntrega" DOUBLE PRECISION NOT NULL,
    "combustibleRecepcion" DOUBLE PRECISION,
    "observaciones" TEXT,
    "usuarioId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AsignacionVehiculo_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AsignacionVehiculo_vehiculoId_fechaInicio_idx" ON "AsignacionVehiculo"("vehiculoId", "fechaInicio");
CREATE INDEX "AsignacionVehiculo_tecnicoId_fechaInicio_idx" ON "AsignacionVehiculo"("tecnicoId", "fechaInicio");
CREATE INDEX "AsignacionVehiculo_fechaFin_idx" ON "AsignacionVehiculo"("fechaFin");
CREATE UNIQUE INDEX "AsignacionVehiculo_abierta_uidx" ON "AsignacionVehiculo"("vehiculoId") WHERE "fechaFin" IS NULL;

CREATE TABLE "ActaVehiculo" (
    "id" TEXT NOT NULL,
    "vehiculoId" TEXT NOT NULL,
    "asignacionId" TEXT NOT NULL,
    "tipo" "TipoActaVehiculo" NOT NULL,
    "kilometraje" INTEGER NOT NULL,
    "combustible" DOUBLE PRECISION NOT NULL,
    "estadoExterior" BOOLEAN NOT NULL DEFAULT true,
    "estadoInterior" BOOLEAN NOT NULL DEFAULT true,
    "llantas" BOOLEAN NOT NULL DEFAULT true,
    "llantaEmergencia" BOOLEAN NOT NULL DEFAULT true,
    "gata" BOOLEAN NOT NULL DEFAULT true,
    "herramientas" BOOLEAN NOT NULL DEFAULT true,
    "extintor" BOOLEAN NOT NULL DEFAULT true,
    "botiquin" BOOLEAN NOT NULL DEFAULT true,
    "documentosOk" BOOLEAN NOT NULL DEFAULT true,
    "accesorios" BOOLEAN NOT NULL DEFAULT true,
    "observaciones" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActaVehiculo_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ActaVehiculo_vehiculoId_createdAt_idx" ON "ActaVehiculo"("vehiculoId", "createdAt");
CREATE INDEX "ActaVehiculo_asignacionId_tipo_idx" ON "ActaVehiculo"("asignacionId", "tipo");

CREATE TABLE "ActaVehiculoFoto" (
    "id" TEXT NOT NULL,
    "actaId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "imagenData" TEXT,
    "tomadaEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActaVehiculoFoto_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ActaVehiculoFoto_actaId_idx" ON "ActaVehiculoFoto"("actaId");

CREATE TABLE "ActaVehiculoFirma" (
    "id" TEXT NOT NULL,
    "actaId" TEXT NOT NULL,
    "tipo" "TipoFirmaActaVehiculo" NOT NULL,
    "nombre" TEXT NOT NULL,
    "imagenUrl" TEXT NOT NULL,
    "imagenData" TEXT,
    "usuarioId" TEXT,
    "firmadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActaVehiculoFirma_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ActaVehiculoFirma_actaId_tipo_key" ON "ActaVehiculoFirma"("actaId", "tipo");
CREATE INDEX "ActaVehiculoFirma_actaId_idx" ON "ActaVehiculoFirma"("actaId");

CREATE TABLE "FotoVehiculo" (
    "id" TEXT NOT NULL,
    "vehiculoId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "imagenData" TEXT,
    "tomadaEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FotoVehiculo_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "FotoVehiculo_vehiculoId_tomadaEn_idx" ON "FotoVehiculo"("vehiculoId", "tomadaEn");

CREATE TABLE "LecturaKilometraje" (
    "id" TEXT NOT NULL,
    "vehiculoId" TEXT NOT NULL,
    "tecnicoId" TEXT,
    "kilometraje" INTEGER NOT NULL,
    "origen" "OrigenKmVehiculo" NOT NULL,
    "observacion" TEXT,
    "estadoRegistro" "EstadoRegistroVehiculo" NOT NULL DEFAULT 'ACTIVO',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LecturaKilometraje_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "LecturaKilometraje_vehiculoId_createdAt_idx" ON "LecturaKilometraje"("vehiculoId", "createdAt");
CREATE INDEX "LecturaKilometraje_vehiculoId_kilometraje_idx" ON "LecturaKilometraje"("vehiculoId", "kilometraje");
CREATE INDEX "LecturaKilometraje_tecnicoId_idx" ON "LecturaKilometraje"("tecnicoId");
CREATE INDEX "LecturaKilometraje_estadoRegistro_idx" ON "LecturaKilometraje"("estadoRegistro");

CREATE TABLE "CargaCombustible" (
    "id" TEXT NOT NULL,
    "vehiculoId" TEXT NOT NULL,
    "tecnicoId" TEXT,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "estacion" TEXT NOT NULL,
    "kilometraje" INTEGER NOT NULL,
    "galones" DOUBLE PRECISION NOT NULL,
    "precioPorGalon" DOUBLE PRECISION NOT NULL,
    "total" DOUBLE PRECISION NOT NULL,
    "numeroFactura" TEXT,
    "comprobanteUrl" TEXT,
    "comprobanteData" TEXT,
    "observaciones" TEXT,
    "kmPorGalon" DOUBLE PRECISION,
    "kmRecorridos" INTEGER,
    "consumoFueraPromedio" BOOLEAN NOT NULL DEFAULT false,
    "estadoRegistro" "EstadoRegistroVehiculo" NOT NULL DEFAULT 'ACTIVO',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CargaCombustible_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CargaCombustible_vehiculoId_fecha_idx" ON "CargaCombustible"("vehiculoId", "fecha");
CREATE INDEX "CargaCombustible_tecnicoId_fecha_idx" ON "CargaCombustible"("tecnicoId", "fecha");
CREATE INDEX "CargaCombustible_estadoRegistro_idx" ON "CargaCombustible"("estadoRegistro");

CREATE TABLE "InspeccionVehiculo" (
    "id" TEXT NOT NULL,
    "vehiculoId" TEXT NOT NULL,
    "tecnicoId" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "kilometraje" INTEGER NOT NULL,
    "combustible" DOUBLE PRECISION NOT NULL,
    "aceite" BOOLEAN NOT NULL DEFAULT true,
    "refrigerante" BOOLEAN NOT NULL DEFAULT true,
    "frenos" BOOLEAN NOT NULL DEFAULT true,
    "luces" BOOLEAN NOT NULL DEFAULT true,
    "direccionales" BOOLEAN NOT NULL DEFAULT true,
    "llantas" BOOLEAN NOT NULL DEFAULT true,
    "llantaEmergencia" BOOLEAN NOT NULL DEFAULT true,
    "gata" BOOLEAN NOT NULL DEFAULT true,
    "extintor" BOOLEAN NOT NULL DEFAULT true,
    "botiquin" BOOLEAN NOT NULL DEFAULT true,
    "herramientas" BOOLEAN NOT NULL DEFAULT true,
    "carroceria" BOOLEAN NOT NULL DEFAULT true,
    "vidrios" BOOLEAN NOT NULL DEFAULT true,
    "espejos" BOOLEAN NOT NULL DEFAULT true,
    "documentosOk" BOOLEAN NOT NULL DEFAULT true,
    "resultado" "ResultadoInspeccionVehiculo" NOT NULL,
    "observaciones" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InspeccionVehiculo_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "InspeccionVehiculo_vehiculoId_fecha_idx" ON "InspeccionVehiculo"("vehiculoId", "fecha");
CREATE INDEX "InspeccionVehiculo_tecnicoId_fecha_idx" ON "InspeccionVehiculo"("tecnicoId", "fecha");
CREATE INDEX "InspeccionVehiculo_resultado_idx" ON "InspeccionVehiculo"("resultado");

CREATE TABLE "InspeccionVehiculoFoto" (
    "id" TEXT NOT NULL,
    "inspeccionId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "imagenData" TEXT,
    "tomadaEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InspeccionVehiculoFoto_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "InspeccionVehiculoFoto_inspeccionId_idx" ON "InspeccionVehiculoFoto"("inspeccionId");

CREATE TABLE "MantenimientoVehiculo" (
    "id" TEXT NOT NULL,
    "vehiculoId" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "kilometraje" INTEGER NOT NULL,
    "clase" "ClaseMantenimientoVehiculo" NOT NULL,
    "tipo" "TipoMantenimientoVehiculo" NOT NULL,
    "descripcion" TEXT NOT NULL,
    "proveedor" TEXT,
    "costo" DOUBLE PRECISION NOT NULL,
    "facturaUrl" TEXT,
    "facturaData" TEXT,
    "proximoFecha" TIMESTAMP(3),
    "proximoKm" INTEGER,
    "observaciones" TEXT,
    "estadoRegistro" "EstadoRegistroVehiculo" NOT NULL DEFAULT 'ACTIVO',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MantenimientoVehiculo_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "MantenimientoVehiculo_vehiculoId_fecha_idx" ON "MantenimientoVehiculo"("vehiculoId", "fecha");
CREATE INDEX "MantenimientoVehiculo_tipo_idx" ON "MantenimientoVehiculo"("tipo");

CREATE TABLE "MantenimientoVehiculoFoto" (
    "id" TEXT NOT NULL,
    "mantenimientoId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "imagenData" TEXT,
    "tomadaEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MantenimientoVehiculoFoto_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "MantenimientoVehiculoFoto_mantenimientoId_idx" ON "MantenimientoVehiculoFoto"("mantenimientoId");

CREATE TABLE "NovedadVehiculo" (
    "id" TEXT NOT NULL,
    "vehiculoId" TEXT NOT NULL,
    "tecnicoId" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "kilometraje" INTEGER NOT NULL,
    "tipo" "TipoNovedadVehiculo" NOT NULL,
    "descripcion" TEXT NOT NULL,
    "gravedad" "GravedadNovedadVehiculo" NOT NULL DEFAULT 'MEDIA',
    "puedeCircular" BOOLEAN NOT NULL DEFAULT true,
    "estado" "EstadoNovedadVehiculo" NOT NULL DEFAULT 'REPORTADA',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NovedadVehiculo_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "NovedadVehiculo_vehiculoId_fecha_idx" ON "NovedadVehiculo"("vehiculoId", "fecha");
CREATE INDEX "NovedadVehiculo_tecnicoId_fecha_idx" ON "NovedadVehiculo"("tecnicoId", "fecha");
CREATE INDEX "NovedadVehiculo_estado_idx" ON "NovedadVehiculo"("estado");

CREATE TABLE "NovedadVehiculoFoto" (
    "id" TEXT NOT NULL,
    "novedadId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "imagenData" TEXT,
    "tomadaEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NovedadVehiculoFoto_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "NovedadVehiculoFoto_novedadId_idx" ON "NovedadVehiculoFoto"("novedadId");

CREATE TABLE "DocumentoVehiculo" (
    "id" TEXT NOT NULL,
    "vehiculoId" TEXT NOT NULL,
    "tipo" "TipoDocumentoVehiculo" NOT NULL,
    "numero" TEXT,
    "fechaInicio" TIMESTAMP(3),
    "fechaVencimiento" TIMESTAMP(3),
    "archivoUrl" TEXT,
    "archivoData" TEXT,
    "observacion" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentoVehiculo_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "DocumentoVehiculo_vehiculoId_fechaVencimiento_idx" ON "DocumentoVehiculo"("vehiculoId", "fechaVencimiento");
CREATE INDEX "DocumentoVehiculo_tipo_idx" ON "DocumentoVehiculo"("tipo");

CREATE TABLE "VehiculoAuditoria" (
    "id" TEXT NOT NULL,
    "vehiculoId" TEXT,
    "entidad" TEXT NOT NULL,
    "registroId" TEXT NOT NULL,
    "usuarioId" TEXT,
    "accion" TEXT NOT NULL,
    "motivo" TEXT,
    "valorAnterior" TEXT,
    "valorNuevo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VehiculoAuditoria_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "VehiculoAuditoria_vehiculoId_createdAt_idx" ON "VehiculoAuditoria"("vehiculoId", "createdAt");
CREATE INDEX "VehiculoAuditoria_entidad_registroId_idx" ON "VehiculoAuditoria"("entidad", "registroId");

CREATE TABLE "UsoVehiculoTicket" (
    "id" TEXT NOT NULL,
    "vehiculoId" TEXT NOT NULL,
    "tecnicoId" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "kilometrajeInicio" INTEGER,
    "kilometrajeFin" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UsoVehiculoTicket_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "UsoVehiculoTicket_vehiculoId_createdAt_idx" ON "UsoVehiculoTicket"("vehiculoId", "createdAt");
CREATE INDEX "UsoVehiculoTicket_ticketId_idx" ON "UsoVehiculoTicket"("ticketId");
CREATE INDEX "UsoVehiculoTicket_tecnicoId_idx" ON "UsoVehiculoTicket"("tecnicoId");

ALTER TABLE "AsignacionVehiculo" ADD CONSTRAINT "AsignacionVehiculo_vehiculoId_fkey" FOREIGN KEY ("vehiculoId") REFERENCES "Vehiculo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AsignacionVehiculo" ADD CONSTRAINT "AsignacionVehiculo_tecnicoId_fkey" FOREIGN KEY ("tecnicoId") REFERENCES "Tecnico"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AsignacionVehiculo" ADD CONSTRAINT "AsignacionVehiculo_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ActaVehiculo" ADD CONSTRAINT "ActaVehiculo_vehiculoId_fkey" FOREIGN KEY ("vehiculoId") REFERENCES "Vehiculo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ActaVehiculo" ADD CONSTRAINT "ActaVehiculo_asignacionId_fkey" FOREIGN KEY ("asignacionId") REFERENCES "AsignacionVehiculo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ActaVehiculoFoto" ADD CONSTRAINT "ActaVehiculoFoto_actaId_fkey" FOREIGN KEY ("actaId") REFERENCES "ActaVehiculo"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ActaVehiculoFirma" ADD CONSTRAINT "ActaVehiculoFirma_actaId_fkey" FOREIGN KEY ("actaId") REFERENCES "ActaVehiculo"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ActaVehiculoFirma" ADD CONSTRAINT "ActaVehiculoFirma_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "FotoVehiculo" ADD CONSTRAINT "FotoVehiculo_vehiculoId_fkey" FOREIGN KEY ("vehiculoId") REFERENCES "Vehiculo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "LecturaKilometraje" ADD CONSTRAINT "LecturaKilometraje_vehiculoId_fkey" FOREIGN KEY ("vehiculoId") REFERENCES "Vehiculo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LecturaKilometraje" ADD CONSTRAINT "LecturaKilometraje_tecnicoId_fkey" FOREIGN KEY ("tecnicoId") REFERENCES "Tecnico"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CargaCombustible" ADD CONSTRAINT "CargaCombustible_vehiculoId_fkey" FOREIGN KEY ("vehiculoId") REFERENCES "Vehiculo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CargaCombustible" ADD CONSTRAINT "CargaCombustible_tecnicoId_fkey" FOREIGN KEY ("tecnicoId") REFERENCES "Tecnico"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "InspeccionVehiculo" ADD CONSTRAINT "InspeccionVehiculo_vehiculoId_fkey" FOREIGN KEY ("vehiculoId") REFERENCES "Vehiculo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InspeccionVehiculo" ADD CONSTRAINT "InspeccionVehiculo_tecnicoId_fkey" FOREIGN KEY ("tecnicoId") REFERENCES "Tecnico"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "InspeccionVehiculoFoto" ADD CONSTRAINT "InspeccionVehiculoFoto_inspeccionId_fkey" FOREIGN KEY ("inspeccionId") REFERENCES "InspeccionVehiculo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MantenimientoVehiculo" ADD CONSTRAINT "MantenimientoVehiculo_vehiculoId_fkey" FOREIGN KEY ("vehiculoId") REFERENCES "Vehiculo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MantenimientoVehiculoFoto" ADD CONSTRAINT "MantenimientoVehiculoFoto_mantenimientoId_fkey" FOREIGN KEY ("mantenimientoId") REFERENCES "MantenimientoVehiculo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "NovedadVehiculo" ADD CONSTRAINT "NovedadVehiculo_vehiculoId_fkey" FOREIGN KEY ("vehiculoId") REFERENCES "Vehiculo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "NovedadVehiculo" ADD CONSTRAINT "NovedadVehiculo_tecnicoId_fkey" FOREIGN KEY ("tecnicoId") REFERENCES "Tecnico"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "NovedadVehiculoFoto" ADD CONSTRAINT "NovedadVehiculoFoto_novedadId_fkey" FOREIGN KEY ("novedadId") REFERENCES "NovedadVehiculo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DocumentoVehiculo" ADD CONSTRAINT "DocumentoVehiculo_vehiculoId_fkey" FOREIGN KEY ("vehiculoId") REFERENCES "Vehiculo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "VehiculoAuditoria" ADD CONSTRAINT "VehiculoAuditoria_vehiculoId_fkey" FOREIGN KEY ("vehiculoId") REFERENCES "Vehiculo"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "VehiculoAuditoria" ADD CONSTRAINT "VehiculoAuditoria_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "UsoVehiculoTicket" ADD CONSTRAINT "UsoVehiculoTicket_vehiculoId_fkey" FOREIGN KEY ("vehiculoId") REFERENCES "Vehiculo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "UsoVehiculoTicket" ADD CONSTRAINT "UsoVehiculoTicket_tecnicoId_fkey" FOREIGN KEY ("tecnicoId") REFERENCES "Tecnico"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "UsoVehiculoTicket" ADD CONSTRAINT "UsoVehiculoTicket_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
