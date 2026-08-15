/**
 * Historial de soportes por cliente: se deriva de Ticket + OrdenServicio.
 * No usa HistorialCliente (eso es auditoría de ficha CRM).
 *
 * Umbrales configurables para semáforo y reincidencia.
 */
export const HISTORIAL_SOPORTES_CONFIG = {
  /** Ventana para “atención frecuente” y volumen reciente. */
  diasVentanaReciente: 30,
  diasVentana90: 90,
  /** Tickets en 30 días → semáforo amarillo (atención frecuente). */
  umbralAtencionFrecuente: 3,
  /** Tickets en 30 días para evaluar volumen alto (junto con motivo repetido). */
  umbralVolumenAlto: 4,
  /** Mismo motivo (normalizado) cuenta como problema recurrente. */
  umbralMotivoRecurrente: 3,
  /** En ventana de 30 días, repeticiones del mismo motivo para reincidencia. */
  umbralMotivoEnVentana: 2,
} as const;

export type AlertaHistorialNivel = "verde" | "amarillo" | "rojo";

export type TicketHistorialLite = {
  id: string;
  codigo: string;
  tipo: string;
  estado: string;
  motivo: string | null;
  createdAt: Date | string;
  duracionSegundos?: number | null;
  creadoMs?: number;
  cerradoMs?: number | null;
  tecnicos: string[];
};

export function normalizarMotivoHistorial(motivo: string | null | undefined): string {
  return (motivo ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

export function rangoFechaPreset(
  preset: string | null | undefined,
  now: Date = new Date()
): { desde: Date; hasta: Date } | null {
  const hasta = now;
  if (preset === "7d") {
    return { desde: new Date(now.getTime() - 7 * 86400000), hasta };
  }
  if (preset === "30d") {
    return {
      desde: new Date(now.getTime() - HISTORIAL_SOPORTES_CONFIG.diasVentanaReciente * 86400000),
      hasta,
    };
  }
  if (preset === "90d") {
    return {
      desde: new Date(now.getTime() - HISTORIAL_SOPORTES_CONFIG.diasVentana90 * 86400000),
      hasta,
    };
  }
  if (preset === "anio") {
    return { desde: new Date(now.getFullYear(), 0, 1), hasta };
  }
  return null;
}

export function contarEnVentana(
  tickets: { createdAt: Date | string }[],
  dias: number,
  now: Date = new Date()
): number {
  const desde = now.getTime() - dias * 86400000;
  return tickets.filter((t) => new Date(t.createdAt).getTime() >= desde).length;
}

function frecuenciaMotivos(
  tickets: { motivo: string | null }[]
): { motivo: string; cantidad: number }[] {
  const map = new Map<string, number>();
  for (const t of tickets) {
    const key = normalizarMotivoHistorial(t.motivo);
    if (!key) continue;
    map.set(key, (map.get(key) ?? 0) + 1);
  }
  return [...map.entries()]
    .map(([motivo, cantidad]) => ({ motivo, cantidad }))
    .sort((a, b) => b.cantidad - a.cantidad || a.motivo.localeCompare(b.motivo));
}

export function motivosRecurrentes(
  tickets: { motivo: string | null }[],
  umbral: number = HISTORIAL_SOPORTES_CONFIG.umbralMotivoRecurrente
): { motivo: string; cantidad: number }[] {
  return frecuenciaMotivos(tickets).filter((m) => m.cantidad >= umbral);
}

export function tecnicoMasFrecuente(tickets: TicketHistorialLite[]): {
  nombre: string;
  cantidad: number;
} | null {
  const map = new Map<string, number>();
  for (const t of tickets) {
    for (const n of t.tecnicos) {
      const nombre = n.trim();
      if (!nombre || nombre.toLowerCase() === "sin asignar") continue;
      map.set(nombre, (map.get(nombre) ?? 0) + 1);
    }
  }
  const ranked = [...map.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  if (!ranked.length) return null;
  return { nombre: ranked[0][0], cantidad: ranked[0][1] };
}

export function rankingTecnicos(tickets: TicketHistorialLite[]): { nombre: string; cantidad: number }[] {
  const map = new Map<string, number>();
  for (const t of tickets) {
    const names = t.tecnicos.length ? t.tecnicos : [];
    for (const n of names) {
      const nombre = n.trim();
      if (!nombre || nombre.toLowerCase() === "sin asignar") continue;
      map.set(nombre, (map.get(nombre) ?? 0) + 1);
    }
  }
  return [...map.entries()]
    .map(([nombre, cantidad]) => ({ nombre, cantidad }))
    .sort((a, b) => b.cantidad - a.cantidad || a.nombre.localeCompare(b.nombre));
}

export function promedioMinutosAtencion(tickets: TicketHistorialLite[]): number | null {
  const vals = tickets
    .map((t) => t.duracionSegundos)
    .filter((s): s is number => typeof s === "number" && s > 0);
  if (!vals.length) return null;
  return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length / 60);
}

export function promedioMinutosResolucion(tickets: TicketHistorialLite[]): number | null {
  const vals: number[] = [];
  for (const t of tickets) {
    if (t.creadoMs == null || t.cerradoMs == null) continue;
    const d = t.cerradoMs - t.creadoMs;
    if (d > 0) vals.push(d);
  }
  if (!vals.length) return null;
  return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length / 60000);
}

/**
 * Reincidencia = mismo problema repetido, no solo volumen con motivos distintos.
 * Volumen alto (4+ en 30d) solo es rojo si además hay motivo repetido en esa ventana.
 */
export function evaluarAlertaHistorial(
  tickets: TicketHistorialLite[],
  now: Date = new Date(),
  cfg = HISTORIAL_SOPORTES_CONFIG
): {
  nivel: AlertaHistorialNivel;
  label: string;
  detalle: string;
  tickets30: number;
  cantidadesMotivoVentana: { motivo: string; cantidad: number }[];
  motivosRecurrentes: { motivo: string; cantidad: number }[];
  reincidencia: boolean;
} {
  const desde30 = now.getTime() - cfg.diasVentanaReciente * 86400000;
  const en30 = tickets.filter((t) => new Date(t.createdAt).getTime() >= desde30);
  const tickets30 = en30.length;
  const motivosAll = motivosRecurrentes(tickets, cfg.umbralMotivoRecurrente);
  const motivos30 = frecuenciaMotivos(en30).filter((m) => m.cantidad >= cfg.umbralMotivoEnVentana);
  const hayMotivoVentana = motivos30.length > 0;
  const volumenAlto = tickets30 >= cfg.umbralVolumenAlto;
  const reincidencia = hayMotivoVentana || motivosAll.length > 0;

  if (reincidencia && (volumenAlto || motivosAll.length > 0)) {
    const top = motivos30[0] ?? motivosAll[0];
    return {
      nivel: "rojo",
      label: "Reincidencia / múltiples soportes",
      detalle: top
        ? `Problema recurrente detectado: ${top.motivo} — ${top.cantidad} casos.`
        : `Este cliente ha registrado ${tickets30} soportes en los últimos ${cfg.diasVentanaReciente} días.`,
      tickets30,
      cantidadesMotivoVentana: motivos30,
      motivosRecurrentes: motivosAll,
      reincidencia: true,
    };
  }

  if (tickets30 >= cfg.umbralAtencionFrecuente) {
    return {
      nivel: "amarillo",
      label: "Atención frecuente",
      detalle: `Este cliente ha registrado ${tickets30} soportes en los últimos ${cfg.diasVentanaReciente} días (motivos distintos; no se marca reincidencia).`,
      tickets30,
      cantidadesMotivoVentana: motivos30,
      motivosRecurrentes: motivosAll,
      reincidencia: false,
    };
  }

  return {
    nivel: "verde",
    label: "Sin incidencias recientes",
    detalle: "No hay acumulación reciente de soportes ni problemas repetidos.",
    tickets30,
    cantidadesMotivoVentana: motivos30,
    motivosRecurrentes: motivosAll,
    reincidencia: false,
  };
}

export function construirResumenHistorial(
  tickets: TicketHistorialLite[],
  now: Date = new Date()
) {
  const alerta = evaluarAlertaHistorial(tickets, now);
  const ordenados = [...tickets].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
  const ultimo = ordenados[0] ?? null;
  const frecuentes = frecuenciaMotivos(tickets).slice(0, 5);
  const tecnicos = rankingTecnicos(tickets);

  return {
    total: tickets.length,
    ultimos30: contarEnVentana(tickets, HISTORIAL_SOPORTES_CONFIG.diasVentanaReciente, now),
    ultimos90: contarEnVentana(tickets, HISTORIAL_SOPORTES_CONFIG.diasVentana90, now),
    anio: tickets.filter((t) => new Date(t.createdAt).getFullYear() === now.getFullYear()).length,
    ultimoSoporte: ultimo
      ? {
          id: ultimo.id,
          codigo: ultimo.codigo,
          fecha: new Date(ultimo.createdAt).toISOString(),
          motivo: ultimo.motivo,
        }
      : null,
    tiempoPromedioMin: promedioMinutosAtencion(tickets),
    tiempoResolucionPromedioMin: promedioMinutosResolucion(tickets),
    problemaFrecuente: frecuentes[0]?.motivo ?? null,
    problemasFrecuentes: frecuentes,
    tecnicoMasFrecuente: tecnicoMasFrecuente(tickets),
    tecnicos,
    reincidencias: tickets.filter((t) => {
      const key = normalizarMotivoHistorial(t.motivo);
      if (!key) return false;
      return (
        alerta.motivosRecurrentes.some((m) => m.motivo === key) ||
        alerta.cantidadesMotivoVentana.some((m) => m.motivo === key)
      );
    }).length,
    alerta,
    config: {
      diasVentanaReciente: HISTORIAL_SOPORTES_CONFIG.diasVentanaReciente,
      umbralAtencionFrecuente: HISTORIAL_SOPORTES_CONFIG.umbralAtencionFrecuente,
      umbralVolumenAlto: HISTORIAL_SOPORTES_CONFIG.umbralVolumenAlto,
      umbralMotivoRecurrente: HISTORIAL_SOPORTES_CONFIG.umbralMotivoRecurrente,
    },
  };
}

export function paginarLista<T>(
  items: T[],
  page: number,
  limit: number
): { items: T[]; total: number; page: number; limit: number; pages: number } {
  const p = Math.max(1, Math.floor(page) || 1);
  const l = Math.min(50, Math.max(1, Math.floor(limit) || 20));
  const total = items.length;
  const start = (p - 1) * l;
  return {
    items: items.slice(start, start + l),
    total,
    page: p,
    limit: l,
    pages: Math.max(1, Math.ceil(total / l) || 1),
  };
}

/** Tickets de campo del cliente; no incluye INFRAESTRUCTURA (cliente sintético interno). */
export function esTipoHistorialCliente(tipo: string): boolean {
  return tipo !== "INFRAESTRUCTURA";
}

export function parseLimitPage(search: URLSearchParams): { page: number; limit: number } {
  const page = Math.max(1, parseInt(search.get("page") || "1", 10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(search.get("limit") || "20", 10) || 20));
  return { page, limit };
}

export function resultadoSoporteLabel(ticket: {
  estado: string;
  estadoRevision?: string | null;
  resultadoInfra?: string | null;
  cierrePorJustificacion?: boolean;
  servicioOk?: boolean | null;
}): string {
  if (ticket.cierrePorJustificacion) return "Cierre por justificación técnica";
  if (ticket.resultadoInfra === "RESUELTO") return "Resuelto";
  if (ticket.resultadoInfra === "PENDIENTE_ESCALAMIENTO") return "Pendiente de escalamiento";
  if (ticket.estadoRevision === "PENDIENTE_REVISION") return "Enviado a revisión";
  if (ticket.estadoRevision === "DEVUELTO_CORRECCION") return "Devuelto a corrección";
  if (ticket.estadoRevision === "CORREGIDO") return "Corrección enviada";
  if (ticket.estadoRevision === "APROBADO") return "Aprobado";
  if (ticket.estado === "CANCELADO") return "Cancelado";
  if (ticket.estado === "CERRADO") return "Cerrado";
  if (ticket.estado === "FINALIZADO") return "Finalizado";
  if (ticket.servicioOk) return "Servicio restablecido";
  if (ticket.estado === "EN_PROCESO") return "En atención";
  if (ticket.estado === "LEIDO") return "Leído por técnico";
  return "Pendiente";
}
