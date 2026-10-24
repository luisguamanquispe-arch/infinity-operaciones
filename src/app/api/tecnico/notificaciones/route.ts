import { NextResponse } from "next/server";
import { getFullSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { obtenerConfigRecordatorio } from "@/lib/recordatorios/config";
import {
  clasificarTarea,
  fechaLimiteTicket,
  minutosDesdeVencimiento,
} from "@/lib/recordatorios/reglas";
import { whereTicketOperativamenteAbierto } from "@/lib/ticket-cerrado";
import { whereTecnicoAsignado } from "@/lib/ticket-tecnicos";

export const runtime = "nodejs";

async function requireTecnico() {
  const session = await getFullSession();
  if (!session || session.rol !== "TECNICO" || !session.tecnicoId) {
    return null;
  }
  return session;
}

export async function GET() {
  const session = await requireTecnico();
  if (!session?.tecnicoId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const tecnicoId = session.tecnicoId;
  const config = await obtenerConfigRecordatorio();
  const now = new Date();

  const [tickets, notificaciones, noLeidas] = await Promise.all([
    prisma.ticket.findMany({
      where: {
        AND: [whereTicketOperativamenteAbierto(), whereTecnicoAsignado(tecnicoId)],
      },
      select: {
        id: true,
        codigo: true,
        estado: true,
        estadoRevision: true,
        prioridad: true,
        descripcion: true,
        motivo: true,
        programadoEn: true,
        slaVenceEn: true,
        orden: { select: { finalizadoEn: true } },
      },
      orderBy: [{ prioridad: "asc" }, { createdAt: "asc" }],
    }),
    prisma.notificacionTecnico.findMany({
      where: { tecnicoId },
      orderBy: { createdAt: "desc" },
      take: 80,
      select: {
        id: true,
        tipo: true,
        titulo: true,
        cuerpo: true,
        leida: true,
        createdAt: true,
        codigoTicket: true,
        ticketId: true,
        prioridad: true,
        vencimientoEn: true,
      },
    }),
    prisma.notificacionTecnico.count({ where: { tecnicoId, leida: false } }),
  ]);

  const pendientes = [];
  const proximas = [];
  const vencidas = [];
  for (const t of tickets) {
    const fase = clasificarTarea(t, now, config.minutosAnticipacion);
    const due = fechaLimiteTicket(t);
    const item = {
      id: t.id,
      codigo: t.codigo,
      estado: t.estado,
      prioridad: t.prioridad,
      descripcion: t.motivo || t.descripcion || null,
      venceEn: due?.toISOString() ?? null,
      minutosVencida: minutosDesdeVencimiento(due, now),
      fase,
    };
    if (fase === "vencida") vencidas.push(item);
    else if (fase === "proxima") proximas.push(item);
    else pendientes.push(item);
  }

  return NextResponse.json({
    noLeidas,
    config: {
      minutosAnticipacion: config.minutosAnticipacion,
      pushHabilitado: config.pushHabilitado,
    },
    tareas: { pendientes, proximas, vencidas },
    notificaciones: notificaciones.map((n) => ({
      ...n,
      createdAt: n.createdAt.toISOString(),
      vencimientoEn: n.vencimientoEn?.toISOString() ?? null,
    })),
  });
}

export async function PATCH(request: Request) {
  const session = await requireTecnico();
  if (!session?.tecnicoId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const body = (await request.json().catch(() => ({}))) as {
    id?: string;
    todas?: boolean;
  };
  if (body.todas) {
    await prisma.notificacionTecnico.updateMany({
      where: { tecnicoId: session.tecnicoId, leida: false },
      data: { leida: true, leidaEn: new Date() },
    });
    return NextResponse.json({ ok: true });
  }
  const id = typeof body.id === "string" ? body.id : "";
  if (!id) {
    return NextResponse.json({ error: "Identificador requerido." }, { status: 400 });
  }
  const rec = await prisma.notificacionTecnico.findFirst({
    where: { id, tecnicoId: session.tecnicoId },
    select: { id: true },
  });
  if (!rec) {
    return NextResponse.json({ error: "Notificación no encontrada." }, { status: 404 });
  }
  await prisma.notificacionTecnico.update({
    where: { id: rec.id },
    data: { leida: true, leidaEn: new Date() },
  });
  return NextResponse.json({ ok: true });
}
