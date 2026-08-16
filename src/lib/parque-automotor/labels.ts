import type {
  ClaseMantenimientoVehiculo,
  EstadoNovedadVehiculo,
  EstadoVehiculo,
  GravedadNovedadVehiculo,
  ResultadoInspeccionVehiculo,
  TipoDocumentoVehiculo,
  TipoMantenimientoVehiculo,
  TipoNovedadVehiculo,
  TipoVehiculo,
} from "@prisma/client";

export const ESTADO_VEHICULO_LABELS: Record<EstadoVehiculo, string> = {
  DISPONIBLE: "Disponible",
  ASIGNADO: "Asignado",
  MANTENIMIENTO: "Mantenimiento",
  FUERA_SERVICIO: "Fuera de servicio",
  INACTIVO: "Inactivo",
};

export const TIPO_VEHICULO_LABELS: Record<TipoVehiculo, string> = {
  CAMIONETA: "Camioneta",
  AUTO: "Auto",
  MOTO: "Moto",
  FURGON: "Furgón",
  OTRO: "Otro",
};

export const RESULTADO_INSPECCION_LABELS: Record<ResultadoInspeccionVehiculo, string> = {
  APROBADO: "Aprobado",
  CON_NOVEDADES: "Con novedades",
  NO_APTO: "No apto",
};

export const CLASE_MANT_LABELS: Record<ClaseMantenimientoVehiculo, string> = {
  PREVENTIVO: "Preventivo",
  CORRECTIVO: "Correctivo",
};

export const TIPO_MANT_LABELS: Record<TipoMantenimientoVehiculo, string> = {
  ACEITE: "Aceite",
  FILTROS: "Filtros",
  FRENOS: "Frenos",
  LLANTAS: "Llantas",
  BATERIA: "Batería",
  SUSPENSION: "Suspensión",
  MOTOR: "Motor",
  TRANSMISION: "Transmisión",
  SISTEMA_ELECTRICO: "Sistema eléctrico",
  AIRE_ACONDICIONADO: "Aire acondicionado",
  CORREA_DISTRIBUCION: "Correa de distribución",
  REPARACION_GENERAL: "Reparación general",
  OTRO: "Otros",
};

export const TIPO_NOVEDAD_VEH_LABELS: Record<TipoNovedadVehiculo, string> = {
  MECANICA: "Mecánica",
  ELECTRICA: "Eléctrica",
  CARROCERIA: "Carrocería",
  NEUMATICOS: "Neumáticos",
  ACCIDENTE: "Accidente",
  ACCESORIOS: "Accesorios",
  OTRO: "Otro",
};

export const ESTADO_NOVEDAD_VEH_LABELS: Record<EstadoNovedadVehiculo, string> = {
  REPORTADA: "Reportada",
  EN_REVISION: "En revisión",
  APROBADA: "Aprobada",
  EN_REPARACION: "En reparación",
  RESUELTA: "Resuelta",
  CANCELADA: "Cancelada",
};

export const GRAVEDAD_LABELS: Record<GravedadNovedadVehiculo, string> = {
  BAJA: "Baja",
  MEDIA: "Media",
  ALTA: "Alta",
  CRITICA: "Crítica",
};

export const TIPO_DOC_LABELS: Record<TipoDocumentoVehiculo, string> = {
  MATRICULA: "Matrícula",
  REVISION: "Revisión",
  SEGURO: "Seguro",
  PERMISO: "Permiso",
  OTRO: "Otro",
};

export const INSPECCION_ITEMS: { key: string; label: string }[] = [
  { key: "aceite", label: "Aceite" },
  { key: "refrigerante", label: "Refrigerante" },
  { key: "frenos", label: "Frenos" },
  { key: "luces", label: "Luces" },
  { key: "direccionales", label: "Direccionales" },
  { key: "llantas", label: "Llantas" },
  { key: "llantaEmergencia", label: "Llanta de emergencia" },
  { key: "gata", label: "Gata" },
  { key: "extintor", label: "Extintor" },
  { key: "botiquin", label: "Botiquín" },
  { key: "herramientas", label: "Herramientas" },
  { key: "carroceria", label: "Carrocería" },
  { key: "vidrios", label: "Vidrios" },
  { key: "espejos", label: "Espejos" },
  { key: "documentosOk", label: "Documentos" },
];

export const ACTA_ITEMS: { key: string; label: string }[] = [
  { key: "estadoExterior", label: "Estado exterior" },
  { key: "estadoInterior", label: "Estado interior" },
  { key: "llantas", label: "Llantas" },
  { key: "llantaEmergencia", label: "Llanta de emergencia" },
  { key: "gata", label: "Gata" },
  { key: "herramientas", label: "Herramientas" },
  { key: "extintor", label: "Extintor" },
  { key: "botiquin", label: "Botiquín" },
  { key: "documentosOk", label: "Documentos" },
  { key: "accesorios", label: "Accesorios" },
];
