import { ticketEstaCerrado } from "@/lib/ticket-cerrado";

export const TZ_ECUADOR = "America/Guayaquil";

export const TIPOS_NOTIFICACION_TAREA = [
  "ASIGNACION",
  "PREVIO_VENCIMIENTO",
  "VENCIMIENTO",
  "VENCIDO_REPETICION",
] as const;

export type TipoNotificacionTarea = (typeof TIPOS_NOTIFICACION_TAREA)[number];

export type FaseTareaRecordatorio =
  | "pendiente"
  | "proxima"
  | "vencida"
  | "sin_limite"
  | "cerrada";

export type ConfigRecordatorio = {
  activo: boolean;
  minutosAnticipacion: number;
  minutosRepeticion: number;
  maxRepeticiones: number;
  internoHabilitado: boolean;
  pushHabilitado: boolean;
  respetarHorario: boolean;
  horaInicio: number;
  horaFin: number;
};

export const CONFIG_RECORDATORIO_DEFAULT: ConfigRecordatorio = {
  activo: true,
  minutosAnticipacion: 30,
  minutosRepeticion: 60,
  maxRepeticiones: 8,
  internoHabilitado: true,
  pushHabilitado: true,
  respetarHorario: true,
  horaInicio: 7,
  horaFin: 21,
};

export type TicketParaRecordatorio = {
  id: string;
  codigo: string;
  estado: string;
  estadoRevision?: string | null;
  prioridad: string;
  programadoEn: Date | null;
  slaVenceEn: Date | null;
  asignaciones: Array<{ tecnicoId: string; asignadoEn: Date }>;
  orden?: { finalizadoEn: Date | null } | null;
  updatedAt?: Date | null;
};

export type PlanRecordatorio = {
  tipo: TipoNotificacionTarea;
  ticketId: string;
  tecnicoId: string;
  codigoTicket: string;
  prioridad: string;
  vencimientoEn: Date | null;
  claveIdem: string;
};

export function fechaLimiteTicket(ticket: {
  programadoEn: Date | null;
  slaVenceEn: Date | null;
}): Date | null {
  if (ticket.programadoEn) return ticket.programadoEn;
  if (ticket.slaVenceEn) return ticket.slaVenceEn;
  return null;
}

export function tareaSigueAbierta(ticket: {
  estado: string;
  estadoRevision?: string | null;
  orden?: { finalizadoEn: Date | null } | null;
}): boolean {
  return !ticketEstaCerrado(ticket, ticket.orden);
}

export function clasificarTarea(
  ticket: {
    estado: string;
    estadoRevision?: string | null;
    programadoEn: Date | null;
    slaVenceEn: Date | null;
    orden?: { finalizadoEn: Date | null } | null;
  },
  now: Date,
  minutosAnticipacion: number
): FaseTareaRecordatorio {
  if (!tareaSigueAbierta(ticket)) return "cerrada";
  const due = fechaLimiteTicket(ticket);
  if (!due) return "sin_limite";
  if (now.getTime() >= due.getTime()) return "vencida";
  const ventana = Math.max(1, minutosAnticipacion) * 60_000;
  if (due.getTime() - now.getTime() <= ventana) return "proxima";
  return "pendiente";
}

export function horaEnGuayaquil(now: Date): number {
  const raw = new Intl.DateTimeFormat("en-GB", {
    timeZone: TZ_ECUADOR,
    hour: "2-digit",
    hourCycle: "h23",
  }).format(now);
  const n = Number(String(raw).trim());
  return Number.isFinite(n) ? n : 0;
}

export function dentroDeHorarioOperativo(
  now: Date,
  config: Pick<ConfigRecordatorio, "respetarHorario" | "horaInicio" | "horaFin">
): boolean {
  if (!config.respetarHorario) return true;
  const h = horaEnGuayaquil(now);
  const inicio = clampHora(config.horaInicio);
  const fin = clampHora(config.horaFin);
  if (inicio === fin) return true;
  if (inicio < fin) return h >= inicio && h < fin;
  return h >= inicio || h < fin;
}

export function normalizarConfig(
  raw: Partial<ConfigRecordatorio> | null | undefined
): ConfigRecordatorio {
  const base = { ...CONFIG_RECORDATORIO_DEFAULT, ...(raw ?? {}) };
  return {
    activo: !!base.activo,
    minutosAnticipacion: clampInt(base.minutosAnticipacion, 5, 24 * 60, 30),
    minutosRepeticion: clampInt(base.minutosRepeticion, 15, 24 * 60, 60),
    maxRepeticiones: clampInt(base.maxRepeticiones, 0, 48, 8),
    internoHabilitado: base.internoHabilitado !== false,
    pushHabilitado: !!base.pushHabilitado,
    respetarHorario: base.respetarHorario !== false,
    horaInicio: clampHora(base.horaInicio),
    horaFin: clampHora(base.horaFin),
  };
}

export function claveAsignacion(ticketId: string, tecnicoId: string, asignadoEn: Date): string {
  return `ASIGNACION:${ticketId}:${tecnicoId}:${asignadoEn.getTime()}`;
}

export function clavePrevio(ticketId: string, tecnicoId: string, due: Date): string {
  return `PREVIO:${ticketId}:${tecnicoId}:${due.getTime()}`;
}

export function claveVencimiento(ticketId: string, tecnicoId: string, due: Date): string {
  return `VENCIMIENTO:${ticketId}:${tecnicoId}:${due.getTime()}`;
}

export function claveRepeticion(
  ticketId: string,
  tecnicoId: string,
  due: Date,
  slot: number
): string {
  return `VENCIDO_REPETICION:${ticketId}:${tecnicoId}:${due.getTime()}:${slot}`;
}

export function slotRepeticionVencida(
  now: Date,
  due: Date,
  minutosRepeticion: number
): number {
  const paso = Math.max(15, minutosRepeticion) * 60_000;
  return Math.floor((now.getTime() - due.getTime()) / paso);
}

export function destinatariosActuales(ticket: TicketParaRecordatorio): string[] {
  return [...new Set(ticket.asignaciones.map((a) => a.tecnicoId).filter(Boolean))];
}

/**
 * Calcula avisos a crear ahora. No persiste. Idempotencia vía clavesExistentes.
 */
export function planificarRecordatorios(opts: {
  now: Date;
  config: ConfigRecordatorio;
  tickets: TicketParaRecordatorio[];
  clavesExistentes: Set<string>;
}): PlanRecordatorio[] {
  const config = normalizarConfig(opts.config);
  if (!config.activo || !config.internoHabilitado) return [];
  const enHorario = dentroDeHorarioOperativo(opts.now, config);
  const out: PlanRecordatorio[] = [];
  const vistas = new Set(opts.clavesExistentes);

  const push = (item: PlanRecordatorio) => {
    if (vistas.has(item.claveIdem)) return;
    vistas.add(item.claveIdem);
    out.push(item);
  };

  for (const ticket of opts.tickets) {
    if (!tareaSigueAbierta(ticket)) continue;
    const due = fechaLimiteTicket(ticket);
    const fase = clasificarTarea(ticket, opts.now, config.minutosAnticipacion);

    for (const asig of ticket.asignaciones) {
      if (!asig.tecnicoId) continue;
      const base = {
        ticketId: ticket.id,
        tecnicoId: asig.tecnicoId,
        codigoTicket: ticket.codigo,
        prioridad: ticket.prioridad,
        vencimientoEn: due,
      };

      push({
        ...base,
        tipo: "ASIGNACION",
        claveIdem: claveAsignacion(ticket.id, asig.tecnicoId, asig.asignadoEn),
      });

      if (!due || !enHorario) continue;

      if (fase === "proxima") {
        push({
          ...base,
          tipo: "PREVIO_VENCIMIENTO",
          claveIdem: clavePrevio(ticket.id, asig.tecnicoId, due),
        });
      }

      if (fase === "vencida") {
        push({
          ...base,
          tipo: "VENCIMIENTO",
          claveIdem: claveVencimiento(ticket.id, asig.tecnicoId, due),
        });
        if (config.maxRepeticiones > 0) {
          const slot = slotRepeticionVencida(opts.now, due, config.minutosRepeticion);
          if (slot >= 1 && slot <= config.maxRepeticiones) {
            push({
              ...base,
              tipo: "VENCIDO_REPETICION",
              claveIdem: claveRepeticion(ticket.id, asig.tecnicoId, due, slot),
            });
          }
        }
      }
    }
  }

  return out;
}

export function textoNotificacion(
  tipo: TipoNotificacionTarea,
  codigo: string,
  prioridad: string
): { titulo: string; cuerpo: string } {
  const prio = prioridad.toLowerCase();
  switch (tipo) {
    case "ASIGNACION":
      return {
        titulo: "Nueva orden asignada",
        cuerpo: `Orden ${codigo} · prioridad ${prio}`,
      };
    case "PREVIO_VENCIMIENTO":
      return {
        titulo: "Orden próxima a vencer",
        cuerpo: `Orden ${codigo} vence pronto · prioridad ${prio}`,
      };
    case "VENCIMIENTO":
      return {
        titulo: "Orden vencida",
        cuerpo: `Orden ${codigo} superó el límite · prioridad ${prio}`,
      };
    case "VENCIDO_REPETICION":
      return {
        titulo: "Orden vencida pendiente",
        cuerpo: `Orden ${codigo} sigue sin atender · prioridad ${prio}`,
      };
  }
}

export function clasificarFalloPush(status: number): "invalidar" | "reintentar" {
  if (status === 404 || status === 410) return "invalidar";
  return "reintentar";
}

export function minutosDesdeVencimiento(due: Date | null, now: Date): number | null {
  if (!due) return null;
  return Math.max(0, Math.round((now.getTime() - due.getTime()) / 60_000));
}

function clampInt(n: number, min: number, max: number, fallback: number): number {
  const v = Number(n);
  if (!Number.isFinite(v)) return fallback;
  return Math.min(max, Math.max(min, Math.round(v)));
}

function clampHora(n: number): number {
  const v = Number(n);
  if (!Number.isFinite(v)) return 0;
  return Math.min(23, Math.max(0, Math.round(v)));
}
