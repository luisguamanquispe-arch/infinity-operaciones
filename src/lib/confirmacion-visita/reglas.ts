/**
 * Reglas puras de confirmación de disponibilidad del cliente antes del desplazamiento técnico.
 * Seguro para cliente y servidor (sin imports de Prisma ni crypto).
 */

export type EstadoConfirmacionVisitaVal =
  | "PENDIENTE_CONFIRMACION"
  | "CONFIRMADO"
  | "SOLICITA_REPROGRAMACION"
  | "NO_DISPONIBLE"
  | "SIN_RESPUESTA"
  | "CANCELADO"
  | "EXENTO";

export type EstadoConfirmacionEfectivo =
  | EstadoConfirmacionVisitaVal
  | "EXPIRADO"
  | "INVALIDADO_CAMBIO_HORARIO"
  | "HISTORICO_SIN_CONTROL";

/**
 * Marca interna utilizada al persistir `enCaminoEn` para tickets históricos legítimos
 * en `TicketConfirmacionVisita` sin alterar su clasificación histórica ni el estado del ticket.
 */
export const MARCA_HISTORICO_EN_CAMINO = "HISTORICO_SIN_CONTROL";

/**
 * Fecha de corte a partir de la cual todo ticket nuevo que requiera presencia
 * debe contar obligatoriamente con control de confirmación (fail-closed).
 * Puede sobreescribirse en servidor vía `CONFIRMACION_VISITA_ACTIVACION_ISO`.
 */
export const FECHA_ACTIVACION_CONFIRMACION_VISITA = new Date("2026-11-27T00:00:00.000Z");

export function obtenerFechaActivacionConfirmacion(): Date {
  const raw =
    typeof process !== "undefined"
      ? process.env?.CONFIRMACION_VISITA_ACTIVACION_ISO
      : undefined;
  if (raw) {
    const parsed = new Date(raw);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }
  return FECHA_ACTIVACION_CONFIRMACION_VISITA;
}

export const ESTADO_CONFIRMACION_LABELS: Record<EstadoConfirmacionEfectivo, string> = {
  PENDIENTE_CONFIRMACION: "Pendiente de confirmación",
  CONFIRMADO: "Visita confirmada",
  SOLICITA_REPROGRAMACION: "Reprogramación solicitada",
  NO_DISPONIBLE: "Cliente no disponible",
  SIN_RESPUESTA: "Sin respuesta",
  CANCELADO: "Confirmación cancelada",
  EXENTO: "No requiere presencia",
  EXPIRADO: "Confirmación expirada",
  INVALIDADO_CAMBIO_HORARIO: "Invalidada por cambio de horario",
  HISTORICO_SIN_CONTROL: "Sin control previo (histórico)",
};

/** Tipos que por definición de negocio NO requieren presencia del cliente en domicilio. */
export const TIPOS_SIN_PRESENCIA_POR_DEFECTO = new Set<string>(["INFRAESTRUCTURA"]);

/**
 * Tipos en los que el Supervisor puede marcar auditadamente que no se requiere presencia
 * del cliente (ej. cortes/reconexiones en caja NAP/poste o trabajos de red).
 */
export const TIPOS_EXENCION_PRESENCIA_PERMITIDA = new Set<string>([
  "INFRAESTRUCTURA",
  "CORTE",
  "RECONEXION",
]);

export const ESTADOS_TICKET_BLOQUEAN_RESPUESTA_PUBLICA = new Set<string>([
  "CERRADO",
  "FINALIZADO",
  "CANCELADO",
  "EN_PROCESO",
]);

export function ticketRequierePresenciaPorDefecto(tipo: string | null | undefined): boolean {
  if (!tipo) return true;
  return !TIPOS_SIN_PRESENCIA_POR_DEFECTO.has(tipo);
}

export function tipoPermiteExencionPresencia(tipo: string | null | undefined): boolean {
  if (!tipo) return false;
  return TIPOS_EXENCION_PRESENCIA_PERMITIDA.has(tipo);
}

export function tokenConfirmacionValido(token: string | null | undefined): boolean {
  if (!token) return false;
  return /^[A-Za-z0-9_-]{43}$/.test(token);
}

/**
 * Ventana posterior a la hora programada en la que el enlace/confirmación sigue vigente
 * (para absorber tolerancias operativas de llegada del técnico).
 */
export const VENTANA_POST_CITA_MS = 2 * 60 * 60 * 1000;

/**
 * Vigencia del enlace y de la confirmación:
 * - Si hay `programadoEn` válido: vence exactamente 2 horas después de la cita (`programadoEn + 2h`).
 *   - Cita del mismo día (ej. 11:00): vence a las 13:00 del mismo día (no 24h después).
 *   - Cita futura (ej. mañana 15:00): vence mañana a las 17:00.
 *   - Cita vencida hace más de 2h: devuelve una fecha ya expirada (`programadoEn + 2h <= ahora`),
 *     evitando emitir enlaces vigentes para visitas pasadas.
 * - Si no hay `programadoEn`: vence en 24 horas desde emisión (referencial; los enlaces públicos
 *   exigen horario programado válido).
 */
export function calcularExpiracionConfirmacion(
  programadoEn: Date | string | null | undefined,
  ahora: Date = new Date()
): Date {
  if (programadoEn) {
    const progMs = (programadoEn instanceof Date ? programadoEn : new Date(programadoEn)).getTime();
    if (!Number.isNaN(progMs)) {
      return new Date(progMs + VENTANA_POST_CITA_MS);
    }
  }
  return new Date(ahora.getTime() + 24 * 60 * 60 * 1000);
}

export function mismoHorarioProgramado(
  a: Date | string | null | undefined,
  b: Date | string | null | undefined
): boolean {
  const msA = a ? (a instanceof Date ? a : new Date(a)).getTime() : null;
  const msB = b ? (b instanceof Date ? b : new Date(b)).getTime() : null;
  if (msA === null && msB === null) return true;
  if (msA === null || msB === null) return false;
  if (Number.isNaN(msA) || Number.isNaN(msB)) return false;
  // Tolerancia de 1 segundo por serialización
  return Math.abs(msA - msB) < 1000;
}

export function esTicketHistoricoSinControl(
  ticket: { createdAt?: Date | string | null },
  fechaActivacion: Date = obtenerFechaActivacionConfirmacion()
): boolean {
  if (!ticket.createdAt) return false;
  const createdMs = (
    ticket.createdAt instanceof Date ? ticket.createdAt : new Date(ticket.createdAt)
  ).getTime();
  if (Number.isNaN(createdMs)) return false;
  return createdMs < fechaActivacion.getTime();
}

export interface ConfirmacionVisitaRecordLike {
  estado: string;
  requierePresencia: boolean;
  exentoMotivo?: string | null;
  exentoEn?: Date | string | null;
  token?: string | null;
  tokenExpiraEn?: Date | string | null;
  tokenRevocadoEn?: Date | string | null;
  programadoEnConfirmado?: Date | string | null;
  confirmadoEn?: Date | string | null;
  confirmadoPorCanal?: string | null;
  confirmadoPorNombre?: string | null;
  personaRecibe?: string | null;
  horarioSolicitado?: string | null;
  observacionCliente?: string | null;
  respondidoEn?: Date | string | null;
  enCaminoEn?: Date | string | null;
  ultimoEnvioEn?: Date | string | null;
  ultimoEnvioCanal?: string | null;
  ultimoEnvioEstado?: string | null;
  enviosCount?: number;
}

export interface TicketConfirmacionEvalInput {
  tipo: string;
  estado?: string;
  programadoEn?: Date | string | null;
  createdAt?: Date | string | null;
}

export interface EvaluacionDesplazamiento {
  permitido: boolean;
  estadoEfectivo: EstadoConfirmacionEfectivo;
  esHistorico: boolean;
  requierePresencia: boolean;
  codigoBloqueo?:
    | "PENDIENTE_CONFIRMACION"
    | "SIN_SOLICITUD_CONFIRMACION"
    | "SIN_HORARIO_PROGRAMADO"
    | "EXENCION_NO_VALIDA_PARA_TIPO"
    | "CONFIRMACION_EXPIRADA"
    | "HORARIO_CAMBIADO"
    | "SOLICITA_REPROGRAMACION"
    | "NO_DISPONIBLE"
    | "SIN_RESPUESTA"
    | "CANCELADO"
    | "TOKEN_REVOCADO";
  motivoBloqueo?: string;
}

/**
 * Determina si un token de confirmación está realmente activo, vigente y listo para
 * compartirse al cliente (evita mostrar enlaces expirados, revocados o desincronizados).
 */
export function esTokenConfirmacionActivo(
  ticket: TicketConfirmacionEvalInput,
  confirmacion: ConfirmacionVisitaRecordLike | null | undefined,
  ahora: Date = new Date()
): boolean {
  if (!ticketRequierePresenciaPorDefecto(ticket.tipo)) return false;
  if (ticket.estado && ESTADOS_TICKET_BLOQUEAN_RESPUESTA_PUBLICA.has(ticket.estado)) {
    return false;
  }
  if (!confirmacion) return false;
  if (confirmacion.requierePresencia === false) return false;
  if (
    confirmacion.estado === "EXENTO" ||
    confirmacion.estado === "CANCELADO" ||
    confirmacion.estado === "CONFIRMADO"
  ) {
    return false;
  }
  if (confirmacion.enCaminoEn) return false;
  if (!tokenConfirmacionValido(confirmacion.token)) return false;
  if (confirmacion.tokenRevocadoEn) return false;

  if (!confirmacion.tokenExpiraEn) return false;
  const expMs = new Date(confirmacion.tokenExpiraEn).getTime();
  if (Number.isNaN(expMs) || ahora.getTime() > expMs) return false;

  if (!ticket.programadoEn || !confirmacion.programadoEnConfirmado) return false;
  if (!mismoHorarioProgramado(ticket.programadoEn, confirmacion.programadoEnConfirmado)) {
    return false;
  }

  return true;
}

/**
 * Regla central (backend y frontend) para decidir si un técnico puede iniciar
 * el desplazamiento (botón EN CAMINO) hacia el domicilio del cliente.
 */
export function evaluarDesplazamientoTicket(
  ticket: TicketConfirmacionEvalInput,
  confirmacion: ConfirmacionVisitaRecordLike | null | undefined,
  ahora: Date = new Date(),
  opts?: { fechaActivacion?: Date }
): EvaluacionDesplazamiento {
  const fechaActivacion = opts?.fechaActivacion ?? obtenerFechaActivacionConfirmacion();

  // 1. Tipos que no requieren presencia por definición (ej. INFRAESTRUCTURA)
  if (!ticketRequierePresenciaPorDefecto(ticket.tipo)) {
    return {
      permitido: true,
      estadoEfectivo: "EXENTO",
      esHistorico: false,
      requierePresencia: false,
    };
  }

  // 2. Sin fila TicketConfirmacionVisita:
  //    Solo es histórico si existe evidencia confiable de creación anterior a la activación.
  //    Para cualquier ticket nuevo (o sin createdAt verificable), FAIL-CLOSED.
  if (!confirmacion) {
    if (esTicketHistoricoSinControl(ticket, fechaActivacion)) {
      return {
        permitido: true,
        estadoEfectivo: "HISTORICO_SIN_CONTROL",
        esHistorico: true,
        requierePresencia: true,
      };
    }
    return {
      permitido: false,
      estadoEfectivo: "PENDIENTE_CONFIRMACION",
      esHistorico: false,
      requierePresencia: true,
      codigoBloqueo: "SIN_SOLICITUD_CONFIRMACION",
      motivoBloqueo:
        "El ticket no cuenta con solicitud de confirmación registrada. No iniciar desplazamiento hasta confirmar con el cliente.",
    };
  }

  // 2b. Ticket histórico legítimo al que ya se le persistió EN CAMINO sin romper su condición histórica
  if (
    confirmacion.exentoMotivo === MARCA_HISTORICO_EN_CAMINO &&
    confirmacion.estado === "EXENTO" &&
    esTicketHistoricoSinControl(ticket, fechaActivacion)
  ) {
    return {
      permitido: true,
      estadoEfectivo: "HISTORICO_SIN_CONTROL",
      esHistorico: true,
      requierePresencia: true,
    };
  }

  // 3. Exención explícita y auditada por Supervisor:
  //    Revalida SIEMPRE contra el tipo actual del ticket (evita bypass tras cambio de tipo).
  if (confirmacion.requierePresencia === false || confirmacion.estado === "EXENTO") {
    if (tipoPermiteExencionPresencia(ticket.tipo)) {
      return {
        permitido: true,
        estadoEfectivo: "EXENTO",
        esHistorico: false,
        requierePresencia: false,
      };
    }
    return {
      permitido: false,
      estadoEfectivo: "PENDIENTE_CONFIRMACION",
      esHistorico: false,
      requierePresencia: true,
      codigoBloqueo: "EXENCION_NO_VALIDA_PARA_TIPO",
      motivoBloqueo:
        "El tipo de trabajo actual requiere confirmación de presencia del cliente.",
    };
  }

  // 4. Estados explícitos de bloqueo
  if (confirmacion.estado === "SOLICITA_REPROGRAMACION") {
    return {
      permitido: false,
      estadoEfectivo: "SOLICITA_REPROGRAMACION",
      esHistorico: false,
      requierePresencia: true,
      codigoBloqueo: "SOLICITA_REPROGRAMACION",
      motivoBloqueo: "El cliente solicitó reprogramar la visita.",
    };
  }

  if (confirmacion.estado === "NO_DISPONIBLE") {
    return {
      permitido: false,
      estadoEfectivo: "NO_DISPONIBLE",
      esHistorico: false,
      requierePresencia: true,
      codigoBloqueo: "NO_DISPONIBLE",
      motivoBloqueo: "El cliente indicó que no estará disponible en el domicilio.",
    };
  }

  if (confirmacion.estado === "CANCELADO") {
    return {
      permitido: false,
      estadoEfectivo: "CANCELADO",
      esHistorico: false,
      requierePresencia: true,
      codigoBloqueo: "CANCELADO",
      motivoBloqueo: "La confirmación de la visita fue cancelada o invalidada.",
    };
  }

  if (confirmacion.estado === "SIN_RESPUESTA") {
    return {
      permitido: false,
      estadoEfectivo: "SIN_RESPUESTA",
      esHistorico: false,
      requierePresencia: true,
      codigoBloqueo: "SIN_RESPUESTA",
      motivoBloqueo: "El cliente aún no ha respondido a la solicitud de confirmación.",
    };
  }

  if (confirmacion.estado === "PENDIENTE_CONFIRMACION") {
    if (!ticket.programadoEn) {
      return {
        permitido: false,
        estadoEfectivo: "PENDIENTE_CONFIRMACION",
        esHistorico: false,
        requierePresencia: true,
        codigoBloqueo: "SIN_HORARIO_PROGRAMADO",
        motivoBloqueo:
          "Visita pendiente de programación y confirmación de disponibilidad del cliente.",
      };
    }
    const expMs = confirmacion.tokenExpiraEn
      ? new Date(confirmacion.tokenExpiraEn).getTime()
      : null;
    if (expMs !== null && !Number.isNaN(expMs) && ahora.getTime() > expMs) {
      return {
        permitido: false,
        estadoEfectivo: "SIN_RESPUESTA",
        esHistorico: false,
        requierePresencia: true,
        codigoBloqueo: "SIN_RESPUESTA",
        motivoBloqueo: "La solicitud de confirmación venció sin respuesta del cliente.",
      };
    }
    return {
      permitido: false,
      estadoEfectivo: "PENDIENTE_CONFIRMACION",
      esHistorico: false,
      requierePresencia: true,
      codigoBloqueo: "PENDIENTE_CONFIRMACION",
      motivoBloqueo: "Pendiente de confirmación de disponibilidad del cliente.",
    };
  }

  // 5. Estado CONFIRMADO: verificar vigencia, revocación, horario obligatorio y coincidencia
  if (confirmacion.estado === "CONFIRMADO") {
    if (!confirmacion.confirmadoEn) {
      return {
        permitido: false,
        estadoEfectivo: "PENDIENTE_CONFIRMACION",
        esHistorico: false,
        requierePresencia: true,
        codigoBloqueo: "PENDIENTE_CONFIRMACION",
        motivoBloqueo: "No existe fecha de confirmación registrada.",
      };
    }

    if (
      confirmacion.tokenRevocadoEn &&
      confirmacion.confirmadoPorCanal !== "TELEFONICA_SUPERVISOR"
    ) {
      return {
        permitido: false,
        estadoEfectivo: "CANCELADO",
        esHistorico: false,
        requierePresencia: true,
        codigoBloqueo: "TOKEN_REVOCADO",
        motivoBloqueo: "El enlace de confirmación fue revocado.",
      };
    }

    if (!ticket.programadoEn || !confirmacion.programadoEnConfirmado) {
      return {
        permitido: false,
        estadoEfectivo: "PENDIENTE_CONFIRMACION",
        esHistorico: false,
        requierePresencia: true,
        codigoBloqueo: "SIN_HORARIO_PROGRAMADO",
        motivoBloqueo:
          "La visita no tiene un horario programado válido asociado a la confirmación.",
      };
    }

    if (
      !mismoHorarioProgramado(ticket.programadoEn, confirmacion.programadoEnConfirmado)
    ) {
      return {
        permitido: false,
        estadoEfectivo: "INVALIDADO_CAMBIO_HORARIO",
        esHistorico: false,
        requierePresencia: true,
        codigoBloqueo: "HORARIO_CAMBIADO",
        motivoBloqueo:
          "El horario de la visita cambió después de la confirmación. Se requiere nueva confirmación.",
      };
    }

    const expMs = confirmacion.tokenExpiraEn
      ? new Date(confirmacion.tokenExpiraEn).getTime()
      : null;
    if (expMs !== null && !Number.isNaN(expMs) && ahora.getTime() > expMs) {
      return {
        permitido: false,
        estadoEfectivo: "EXPIRADO",
        esHistorico: false,
        requierePresencia: true,
        codigoBloqueo: "CONFIRMACION_EXPIRADA",
        motivoBloqueo: "La confirmación de la visita expiró. Solicite una nueva confirmación.",
      };
    }

    return {
      permitido: true,
      estadoEfectivo: "CONFIRMADO",
      esHistorico: false,
      requierePresencia: true,
    };
  }

  return {
    permitido: false,
    estadoEfectivo: "PENDIENTE_CONFIRMACION",
    esHistorico: false,
    requierePresencia: true,
    codigoBloqueo: "PENDIENTE_CONFIRMACION",
    motivoBloqueo: "Estado de confirmación no habilitado para desplazamiento.",
  };
}

export interface ConfirmacionVisitaView {
  estado: EstadoConfirmacionEfectivo;
  estadoLabel: string;
  requierePresencia: boolean;
  esHistorico: boolean;
  puedeIniciarDesplazamiento: boolean;
  motivoBloqueo: string | null;
  confirmadoEn: string | null;
  confirmadoPorCanal: string | null;
  confirmadoPorNombre: string | null;
  personaRecibe: string | null;
  horarioSolicitado: string | null;
  observacionCliente: string | null;
  exentoMotivo: string | null;
  tokenExpiraEn: string | null;
  enCaminoEn: string | null;
  ultimoEnvioEn: string | null;
  ultimoEnvioEstado: string | null;
  enviosCount: number;
}

function iso(v: Date | string | null | undefined): string | null {
  if (!v) return null;
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export function derivarVistaConfirmacionVisita(
  ticket: TicketConfirmacionEvalInput,
  confirmacion: ConfirmacionVisitaRecordLike | null | undefined,
  ahora: Date = new Date(),
  opts?: { fechaActivacion?: Date }
): ConfirmacionVisitaView {
  const evalRes = evaluarDesplazamientoTicket(ticket, confirmacion, ahora, opts);
  return {
    estado: evalRes.estadoEfectivo,
    estadoLabel: ESTADO_CONFIRMACION_LABELS[evalRes.estadoEfectivo],
    requierePresencia: evalRes.requierePresencia,
    esHistorico: evalRes.esHistorico,
    puedeIniciarDesplazamiento: evalRes.permitido,
    motivoBloqueo: evalRes.motivoBloqueo ?? null,
    confirmadoEn: iso(confirmacion?.confirmadoEn),
    confirmadoPorCanal: confirmacion?.confirmadoPorCanal ?? null,
    confirmadoPorNombre: confirmacion?.confirmadoPorNombre ?? null,
    personaRecibe: confirmacion?.personaRecibe ?? null,
    horarioSolicitado: confirmacion?.horarioSolicitado ?? null,
    observacionCliente: confirmacion?.observacionCliente ?? null,
    exentoMotivo:
      confirmacion?.exentoMotivo === MARCA_HISTORICO_EN_CAMINO
        ? null
        : (confirmacion?.exentoMotivo ?? null),
    tokenExpiraEn: iso(confirmacion?.tokenExpiraEn),
    enCaminoEn: iso(confirmacion?.enCaminoEn),
    ultimoEnvioEn: iso(confirmacion?.ultimoEnvioEn),
    ultimoEnvioEstado: confirmacion?.ultimoEnvioEstado ?? null,
    enviosCount: confirmacion?.enviosCount ?? 0,
  };
}

function separarFechaHoraProgramada(
  programado: Date | string | null | undefined
): { fecha: string; hora: string | null } | null {
  if (!programado) return null;
  if (programado instanceof Date) {
    if (Number.isNaN(programado.getTime())) return null;
    const fecha = new Intl.DateTimeFormat("es-EC", {
      timeZone: "America/Guayaquil",
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(programado);
    const hora = new Intl.DateTimeFormat("es-EC", {
      timeZone: "America/Guayaquil",
      hour: "2-digit",
      minute: "2-digit",
    }).format(programado);
    return { fecha, hora };
  }
  const texto = programado.trim();
  if (!texto) return null;
  const idxComa = texto.lastIndexOf(",");
  if (idxComa > 0) {
    const fecha = texto.slice(0, idxComa).trim();
    const hora = texto.slice(idxComa + 1).trim();
    if (fecha && hora) return { fecha, hora };
  }
  return { fecha: texto, hora: null };
}

export function mensajeWhatsappConfirmacion(
  url: string,
  programadoTexto?: Date | string | null
): string {
  const horario = separarFechaHoraProgramada(programadoTexto);
  const bloqueHorario = horario
    ? horario.hora
      ? `📅 *Fecha:* ${horario.fecha}\n🕒 *Hora:* ${horario.hora}\n\n`
      : `📅 *Fecha:* ${horario.fecha}\n\n`
    : "";

  return (
    `🔔 *INFINITY INTERNET | CONFIRMACIÓN DE VISITA TÉCNICA*\n\n` +
    `Estimado cliente:\n\n` +
    `Tenemos programada una visita técnica para atender su solicitud.\n\n` +
    `Para evitar que nuestro técnico llegue y no encuentre a nadie en casa, le solicitamos confirmar su disponibilidad mediante el siguiente enlace:\n\n` +
    `🟦 *CONFIRME AQUÍ SU VISITA* 👇\n\n` +
    `${url}\n\n` +
    bloqueHorario +
    `Agradecemos su colaboración para brindarle una atención oportuna.\n\n` +
    `*INFINITY INTERNET*\n` +
    `Conectamos lo que más importa.`
  );
}
