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

/** Opciones de la app del técnico. `ui` se mapea al enum existente (sin migración). */
export const NOVEDAD_REPORTE_OPCIONES: {
  ui: string;
  value: TipoNovedadVehiculo;
  label: string;
}[] = [
  { ui: "GOLPE", value: "CARROCERIA", label: "Golpe" },
  { ui: "RAYON", value: "CARROCERIA", label: "Rayón" },
  { ui: "ABOLLADURA", value: "CARROCERIA", label: "Abolladura" },
  { ui: "CARROCERIA", value: "CARROCERIA", label: "Carrocería" },
  { ui: "VIDRIO", value: "CARROCERIA", label: "Vidrio roto" },
  { ui: "LLANTA", value: "NEUMATICOS", label: "Llanta" },
  { ui: "LUCES", value: "ELECTRICA", label: "Luces" },
  { ui: "ESPEJO", value: "ACCESORIOS", label: "Espejo" },
  { ui: "INTERIOR", value: "ACCESORIOS", label: "Interior" },
  { ui: "MECANICA", value: "MECANICA", label: "Mecánica" },
  { ui: "OTRO", value: "OTRO", label: "Otro" },
];

export function mapTipoNovedadReporte(raw: string | null | undefined): TipoNovedadVehiculo {
  const v = (raw ?? "").toUpperCase();
  if (v === "NEUMATICOS" || v === "LLANTA") return "NEUMATICOS";
  if (v === "ELECTRICA" || v === "LUCES") return "ELECTRICA";
  if (v === "ACCESORIOS" || v === "ESPEJO" || v === "INTERIOR") return "ACCESORIOS";
  if (v === "MECANICA") return "MECANICA";
  if (v === "ACCIDENTE") return "ACCIDENTE";
  if (
    v === "CARROCERIA" ||
    v === "GOLPE" ||
    v === "RAYON" ||
    v === "RAYÓN" ||
    v === "ABOLLADURA" ||
    v === "VIDRIO"
  ) {
    return "CARROCERIA";
  }
  if (v === "OTRO") return "OTRO";
  const allowed: TipoNovedadVehiculo[] = [
    "MECANICA",
    "ELECTRICA",
    "CARROCERIA",
    "NEUMATICOS",
    "ACCIDENTE",
    "ACCESORIOS",
    "OTRO",
  ];
  return allowed.includes(v as TipoNovedadVehiculo) ? (v as TipoNovedadVehiculo) : "OTRO";
}

export function estadoVehiculoVisible(
  estado: string
): { clave: "operativo" | "mantenimiento" | "fuera"; label: string } {
  if (estado === "MANTENIMIENTO") return { clave: "mantenimiento", label: "En mantenimiento" };
  if (estado === "FUERA_SERVICIO" || estado === "INACTIVO") {
    return { clave: "fuera", label: "Fuera de servicio" };
  }
  return { clave: "operativo", label: "Operativo" };
}

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
