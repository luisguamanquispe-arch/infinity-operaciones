import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { whereTicketOperativamenteAbierto } from "@/lib/ticket-cerrado";
import { obtenerConfigRecordatorio } from "./config";
import { withRecordatorioLock } from "./lock";
import { persistirSiNuevo } from "./persistir";
import { enviarPushTecnico, pushConfigurado } from "./push";
import {
  planificarRecordatorios,
  type TicketParaRecordatorio,
} from "./reglas";

type Persistido = {
  id: string;
  titulo: string;
  cuerpo: string;
  tecnicoId: string;
  ticketId: string;
};

export async function evaluarRecordatorios(now = new Date()): Promise<{
  evaluados: number;
  creados: number;
  omitidos: number;
  pushEnviados: number;
  pushFallidos: number;
}> {
  const config = await obtenerConfigRecordatorio();
  if (!config.activo || !config.internoHabilitado) {
    return { evaluados: 0, creados: 0, omitidos: 0, pushEnviados: 0, pushFallidos: 0 };
  }

  const locked = await withRecordatorioLock(prisma, async (tx) => {
    const tickets = await cargarTicketsAbiertos(tx);
    if (tickets.length === 0) {
      return { evaluados: 0, persistidos: [] as Persistido[] };
    }
    const claves = await tx.notificacionTecnico.findMany({
      where: { ticketId: { in: tickets.map((t) => t.id) } },
      select: { claveIdem: true },
    });
    const plan = planificarRecordatorios({
      now,
      config,
      tickets,
      clavesExistentes: new Set(claves.map((c) => c.claveIdem)),
    });

    const persistidos: Persistido[] = [];
    for (const item of plan) {
      const rec = await persistirSiNuevo(item, tx);
      if (!rec) continue;
      persistidos.push({
        id: rec.id,
        titulo: rec.titulo,
        cuerpo: rec.cuerpo,
        tecnicoId: item.tecnicoId,
        ticketId: item.ticketId,
      });
    }
    return { evaluados: tickets.length, persistidos };
  });

  if (!locked.acquired) {
    return { evaluados: 0, creados: 0, omitidos: 1, pushEnviados: 0, pushFallidos: 0 };
  }

  const { evaluados, persistidos } = locked.value;
  let pushEnviados = 0;
  let pushFallidos = 0;
  const recien = persistidos.map((p) => p.id);

  for (const item of persistidos) {
    const push = await entregarPush({
      notificacionId: item.id,
      tecnicoId: item.tecnicoId,
      titulo: item.titulo,
      cuerpo: item.cuerpo,
      ticketId: item.ticketId,
      habilitado: config.pushHabilitado,
    });
    pushEnviados += push.enviados;
    pushFallidos += push.fallidos;
  }

  const reintento = await reintentarPushPendientes(config.pushHabilitado, recien);
  pushEnviados += reintento.enviados;
  pushFallidos += reintento.fallidos;

  return {
    evaluados,
    creados: persistidos.length,
    omitidos: 0,
    pushEnviados,
    pushFallidos,
  };
}

async function cargarTicketsAbiertos(
  db: Prisma.TransactionClient
): Promise<TicketParaRecordatorio[]> {
  const rows = await db.ticket.findMany({
    where: whereTicketOperativamenteAbierto(),
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
  return rows
    .filter((t) => t.tecnicos.length > 0)
    .map((t) => ({
      id: t.id,
      codigo: t.codigo,
      estado: t.estado,
      estadoRevision: t.estadoRevision,
      prioridad: t.prioridad,
      programadoEn: t.programadoEn,
      slaVenceEn: t.slaVenceEn,
      asignaciones: t.tecnicos,
      orden: t.orden,
      updatedAt: t.updatedAt,
    }));
}

async function entregarPush(opts: {
  notificacionId: string;
  tecnicoId: string;
  titulo: string;
  cuerpo: string;
  ticketId: string | null;
  habilitado: boolean;
  entregaId?: string;
  intentosPrevios?: number;
}): Promise<{ enviados: number; fallidos: number }> {
  if (!opts.habilitado || !pushConfigurado()) {
    await upsertEntregaPush({
      notificacionId: opts.notificacionId,
      entregaId: opts.entregaId,
      estado: "OMITIDO",
      intentos: opts.intentosPrevios ?? 0,
      error: null,
      enviadoEn: null,
    });
    return { enviados: 0, fallidos: 0 };
  }
  const push = await enviarPushTecnico({
    tecnicoId: opts.tecnicoId,
    title: opts.titulo,
    body: opts.cuerpo,
    url: opts.ticketId ? `/tecnico/orden/${opts.ticketId}` : "/tecnico/notificaciones",
  });
  await upsertEntregaPush({
    notificacionId: opts.notificacionId,
    entregaId: opts.entregaId,
    estado: push.enviados > 0 ? "ENVIADO" : push.omitidos ? "OMITIDO" : "FALLIDO",
    intentos: (opts.intentosPrevios ?? 0) + 1,
    error: push.errores[0]?.slice(0, 180) ?? null,
    enviadoEn: push.enviados > 0 ? new Date() : null,
  });
  return { enviados: push.enviados, fallidos: push.fallidos };
}

async function upsertEntregaPush(opts: {
  notificacionId: string;
  entregaId?: string;
  estado: "ENVIADO" | "FALLIDO" | "OMITIDO";
  intentos: number;
  error: string | null;
  enviadoEn: Date | null;
}) {
  if (opts.entregaId) {
    await prisma.notificacionTecnicoEntrega.update({
      where: { id: opts.entregaId },
      data: {
        estado: opts.estado,
        intentos: opts.intentos,
        ultimoError: opts.error,
        enviadoEn: opts.enviadoEn,
      },
    });
    return;
  }
  await prisma.notificacionTecnicoEntrega.create({
    data: {
      notificacionId: opts.notificacionId,
      canal: "PUSH",
      estado: opts.estado,
      intentos: opts.intentos,
      ultimoError: opts.error,
      enviadoEn: opts.enviadoEn,
    },
  });
}

async function reintentarPushPendientes(
  habilitado: boolean,
  excluirIds: string[]
): Promise<{ enviados: number; fallidos: number }> {
  const desde = new Date(Date.now() - 48 * 60 * 60 * 1000);
  const pendientes = await prisma.notificacionTecnico.findMany({
    where: {
      createdAt: { gte: desde },
      id: excluirIds.length ? { notIn: excluirIds } : undefined,
      entregas: { none: { canal: "PUSH", estado: "ENVIADO" } },
    },
    select: {
      id: true,
      tecnicoId: true,
      titulo: true,
      cuerpo: true,
      ticketId: true,
      entregas: {
        where: { canal: "PUSH" },
        select: { id: true, intentos: true },
        take: 1,
      },
    },
    take: 80,
  });
  let enviados = 0;
  let fallidos = 0;
  for (const n of pendientes) {
    const previa = n.entregas[0];
    if (previa && previa.intentos >= 8) continue;
    const r = await entregarPush({
      notificacionId: n.id,
      tecnicoId: n.tecnicoId,
      titulo: n.titulo,
      cuerpo: n.cuerpo,
      ticketId: n.ticketId,
      habilitado,
      entregaId: previa?.id,
      intentosPrevios: previa?.intentos ?? 0,
    });
    enviados += r.enviados;
    fallidos += r.fallidos;
  }
  return { enviados, fallidos };
}
