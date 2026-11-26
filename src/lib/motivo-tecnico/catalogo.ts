/** Catálogos de motivo técnico estructurado (tickets de cliente). */

export const MOTIVO_CATEGORIAS = [
  { id: "INTERNET_SIN_SERVICIO", label: "Internet sin servicio" },
  { id: "LENTITUD", label: "Lentitud de Internet" },
  { id: "INTERMITENCIA", label: "Intermitencia o desconexiones" },
  { id: "WIFI", label: "Problema de WiFi" },
  { id: "ONU_ONT", label: "Problema de equipo ONU/ONT" },
  { id: "ROUTER", label: "Problema de router" },
  { id: "CABLEADO_FIBRA", label: "Cableado o fibra óptica" },
  { id: "TV_STREAMING", label: "Televisión/Streaming" },
  { id: "INSTALACION_CONFIG", label: "Instalación o configuración" },
  { id: "ATENCION_PENDIENTE", label: "Atención técnica pendiente" },
  { id: "SERVICIO", label: "Servicio" },
  { id: "OTRO", label: "Otro problema técnico" },
] as const;

export const MOTIVO_PROBLEMAS = [
  { id: "SIN_CONEXION", label: "Sin conexión" },
  { id: "INTERMITENTE", label: "Servicio intermitente" },
  { id: "VELOCIDAD_BAJA", label: "Velocidad inferior a la contratada" },
  { id: "EQUIPO_APAGADO", label: "Equipo sin encender" },
  { id: "SIN_SENAL_OPTICA", label: "Equipo sin señal óptica" },
  { id: "COBERTURA_WIFI", label: "Problema de cobertura WiFi" },
  { id: "DANO_CABLEADO", label: "Daño físico de cableado" },
  { id: "CAMBIO_DOMICILIO", label: "Cambio de domicilio" },
  { id: "MIGRACION_SERVICIO_FIBRA", label: "Migración de servicio a fibra" },
  { id: "OTRO", label: "Otro" },
] as const;

const PROBLEMAS_SERVICIO_IDS = new Set<string>([
  "CAMBIO_DOMICILIO",
  "MIGRACION_SERVICIO_FIBRA",
]);

/** Opciones de «Problema reportado» según la categoría seleccionada. */
export function problemasParaCategoria(categoria: string | null | undefined) {
  if (categoria === "SERVICIO") {
    return MOTIVO_PROBLEMAS.filter(
      (p) => PROBLEMAS_SERVICIO_IDS.has(p.id) || p.id === "OTRO"
    );
  }
  return MOTIVO_PROBLEMAS.filter((p) => !PROBLEMAS_SERVICIO_IDS.has(p.id));
}

export const MOTIVO_IMPACTOS = [
  { id: "SIN_IMPACTO_MAYOR", label: "Inconveniente menor sin interrupción significativa" },
  { id: "PARCIAL", label: "Afecta parcialmente el servicio" },
  { id: "TOTAL_DOMICILIO", label: "Interrupción total del servicio en el domicilio" },
  { id: "URGENTE_RIESGO", label: "Atención urgente o cliente en riesgo de baja" },
] as const;

export type MotivoCategoriaId = (typeof MOTIVO_CATEGORIAS)[number]["id"];
export type MotivoProblemaId = (typeof MOTIVO_PROBLEMAS)[number]["id"];
export type MotivoImpactoId = (typeof MOTIVO_IMPACTOS)[number]["id"];

export const CLIENTE_SITUACIONES = [
  { id: "CONFORME", label: "Cliente conforme" },
  { id: "INCONFORME", label: "Cliente inconforme" },
  { id: "MOLESTO_FALTA_ATENCION", label: "Cliente molesto por falta de atención técnica" },
  { id: "INTENCION_CANCELAR", label: "Cliente manifiesta intención de cancelar el servicio" },
] as const;

export type ClienteSituacionId = (typeof CLIENTE_SITUACIONES)[number]["id"];

export const RESULTADOS_GESTION_RIESGO = [
  { id: "CONTACTO_REALIZADO", label: "Contacto realizado" },
  { id: "RECUPERADO", label: "Cliente recuperado" },
  { id: "CONTINUA_RIESGO", label: "Continúa en riesgo" },
] as const;

export type ResultadoGestionRiesgoId = (typeof RESULTADOS_GESTION_RIESGO)[number]["id"];

const GENERICOS = [
  "internet",
  "revisar",
  "no funciona",
  "problema",
  "soporte",
  "falla",
  "malo",
  "mal",
  "ayuda",
  "urgente",
  "pendiente",
];

export function labelDeCatalogo(
  catalogo: readonly { id: string; label: string }[],
  id: string | null | undefined
): string {
  if (!id) return "";
  return catalogo.find((c) => c.id === id)?.label ?? id;
}

export function esTextoGenerico(texto: string): boolean {
  const t = texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (t.length < 12) return true;
  const palabras = t.split(" ");
  if (palabras.length <= 2 && GENERICOS.some((g) => t === g.trim().toLowerCase() || t.includes(g.trim().toLowerCase()))) {
    return true;
  }
  const soloGenericos = palabras.every((p) =>
    ["internet", "revisar", "problema", "soporte", "falla", "malo", "mal", "ayuda", "urgente", "servicio", "cliente", "el", "la", "de", "sin", "con", "no", "funciona", "pendiente"].includes(p)
  );
  return soloGenericos;
}
