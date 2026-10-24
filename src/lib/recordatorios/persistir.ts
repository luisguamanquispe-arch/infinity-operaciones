import type { PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { obtenerConfigRecordatorio } from "./config";
import {
  planificarRecordatorios,
  textoNotificacion,
  type PlanRecordatorio,
  type TicketParaRecordatorio,
} from "./reglas";

type DbNotificacion = {
  notificacionTecnico: PrismaClient["notificacionTecnico"];
};

export async function persistirSiNuevo(
  item: PlanRecordatorio,
  db: DbNotificacion = prisma
): Promise<{ id: string; titulo: string; cuerpo: string } | null> {
  const txt = textoNotificacion(item.tipo, item.codigoTicket, item.prioridad);
  try {
    const rec = await db.notificacionTecnico.create({
      data: {
        tecnicoId: item.tecnicoId,
        ticketId: item.ticketId,
        tipo: item.tipo,
        titulo: txt.titulo,
        cuerpo: txt.cuerpo,
        claveIdem: item.claveIdem,
        prioridad: item.prioridad as "ALTA" | "MEDIA" | "BAJA",
        codigoTicket: item.codigoTicket,
        vencimientoEn: item.vencimientoEn,
        entregas: {
          create: { canal: "INTERNO", estado: "ENVIADO", intentos: 1, enviadoEn: new Date() },
        },
      },
      select: { id: true, titulo: true, cuerpo: true },
    });
    return rec;
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code === "P2002") return null;
    if (esTablaAusente(err)) return null;
    throw err;
  }
}

export async function notificarAsignacionInmediata(opts: {
  ticketId: string;
  tecnicoIds: string[];
}): Promise<number> {
  if (opts.tecnicoIds.length === 0) return 0;
  try {
    return await notificarAsignacionInmediataInner(opts);
  } catch (err) {
    if (esTablaAusente(err)) return 0;
    console.error(
      "[recordatorios] asignacion",
      err instanceof Error ? err.message.slice(0, 180) : "error"
    );
    return 0;
  }
}

async function notificarAsignacionInmediataInner(opts: {
  ticketId: string;
  tecnicoIds: string[];
}): Promise<number> {
  const config = await obtenerConfigRecordatorio();
  if (!config.activo || !config.internoHabilitado) return 0;
  const ticket = await prisma.ticket.findUnique({
    where: { id: opts.ticketId },
    select: {
      id: true,
      codigo: true,
      estado: true,
      estadoRevision: true,
      prioridad: true,
      programadoEn: true,
      slaVenceEn: true,
      updatedAt: true,
      tecnicos: { select: { tecnicoId: true, asignadoEn: true } },
      orden: { select: { finalizadoEn: true } },
    },
  });
  if (!ticket) return 0;
  const asignaciones = ticket.tecnicos.filter((t) => opts.tecnicoIds.includes(t.tecnicoId));
  const mapped: TicketParaRecordatorio = {
    id: ticket.id,
    codigo: ticket.codigo,
    estado: ticket.estado,
    estadoRevision: ticket.estadoRevision,
    prioridad: ticket.prioridad,
    programadoEn: ticket.programadoEn,
    slaVenceEn: ticket.slaVenceEn,
    asignaciones,
    orden: ticket.orden,
    updatedAt: ticket.updatedAt,
  };
  const claves = await prisma.notificacionTecnico.findMany({
    where: { ticketId: ticket.id, tecnicoId: { in: opts.tecnicoIds } },
    select: { claveIdem: true },
  });
  const plan = planificarRecordatorios({
    now: new Date(),
    config: { ...config, respetarHorario: false },
    tickets: [mapped],
    clavesExistentes: new Set(claves.map((c) => c.claveIdem)),
  }).filter((p) => p.tipo === "ASIGNACION" && opts.tecnicoIds.includes(p.tecnicoId));

  let n = 0;
  for (const item of plan) {
    const rec = await persistirSiNuevo(item);
    if (rec) n += 1;
  }
  return n;
}

function esTablaAusente(err: unknown): boolean {
  const code = (err as { code?: string }).code;
  if (code === "P2021" || code === "P2010") return true;
  const msg = err instanceof Error ? err.message : String(err);
  return /does not exist|no such table|relation .* does not exist/i.test(msg);
}
