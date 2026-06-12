import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getFullSession } from "@/lib/auth";
import { cuposDisponibles, diaKey, parseProgramadoEn } from "@/lib/calendario";
import { notificarTecnicoAsignacion } from "@/lib/notificaciones-tecnico";
import {
  startOfWeek,
  endOfWeek,
  addDays,
  parseISO,
  format,
} from "date-fns";
import { es } from "date-fns/locale";

const ESTADOS_ACTIVOS = ["PENDIENTE", "EN_PROCESO"] as const;

function ticketResumen(t: {
  id: string;
  codigo: string;
  tipo: string;
  prioridad: string;
  estado: string;
  motivo: string | null;
  programadoEn: Date | null;
  tecnicoId: string | null;
  cliente: { nombre: string; sector: string };
}) {
  return {
    id: t.id,
    codigo: t.codigo,
    tipo: t.tipo,
    prioridad: t.prioridad,
    estado: t.estado,
    motivo: t.motivo,
    programadoEn: t.programadoEn?.toISOString() ?? null,
    tecnicoId: t.tecnicoId,
    cliente: t.cliente,
  };
}

export async function GET(request: Request) {
  const session = await getFullSession();
  if (!session || !["SUPERVISOR", "ADMIN"].includes(session.rol)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const semanaParam = searchParams.get("semana");
  const base = semanaParam ? parseISO(semanaParam) : new Date();
  const inicio = startOfWeek(base, { weekStartsOn: 1 });
  const fin = endOfWeek(base, { weekStartsOn: 1 });
  fin.setHours(23, 59, 59, 999);

  const dias = Array.from({ length: 7 }, (_, i) => {
    const d = addDays(inicio, i);
    return {
      fecha: diaKey(d),
      label: format(d, "EEE d MMM", { locale: es }),
    };
  });
  const fechasSet = new Set(dias.map((d) => d.fecha));

  const [tecnicos, ticketsSemana, sinProgramar] = await Promise.all([
    prisma.tecnico.findMany({
      include: { usuario: true },
      orderBy: { usuario: { nombre: "asc" } },
    }),
    prisma.ticket.findMany({
      where: {
        estado: { in: [...ESTADOS_ACTIVOS] },
        programadoEn: { gte: inicio, lte: fin },
      },
      include: { cliente: true },
      orderBy: { programadoEn: "asc" },
    }),
    prisma.ticket.findMany({
      where: {
        estado: { in: [...ESTADOS_ACTIVOS] },
        programadoEn: null,
      },
      include: { cliente: true },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
  ]);

  const tecnicosGrid = tecnicos.map((tec) => {
    const diasMap: Record<
      string,
      { tickets: ReturnType<typeof ticketResumen>[]; cupos: number; disponible: boolean }
    > = {};

    for (const dia of dias) {
      const delDia = ticketsSemana.filter(
        (t) => t.tecnicoId === tec.id && t.programadoEn && diaKey(t.programadoEn) === dia.fecha
      );
      const cupos = cuposDisponibles(tec.estadoActual, delDia.length);
      diasMap[dia.fecha] = {
        tickets: delDia.map(ticketResumen),
        cupos,
        disponible: cupos > 0,
      };
    }

    return {
      id: tec.id,
      nombre: tec.usuario.nombre,
      estado: tec.estadoActual,
      dias: diasMap,
    };
  });

  const sinAsignarPorDia: Record<string, ReturnType<typeof ticketResumen>[]> = {};
  for (const f of fechasSet) sinAsignarPorDia[f] = [];

  for (const t of ticketsSemana.filter((t) => !t.tecnicoId && t.programadoEn)) {
    const f = diaKey(t.programadoEn!);
    if (fechasSet.has(f)) {
      sinAsignarPorDia[f].push(ticketResumen(t));
    }
  }

  return NextResponse.json({
    semanaInicio: diaKey(inicio),
    semanaFin: diaKey(fin),
    dias,
    tecnicos: tecnicosGrid,
    sinAsignarPorDia,
    sinProgramar: sinProgramar.map(ticketResumen),
  });
}

export async function PATCH(request: Request) {
  const session = await getFullSession();
  if (!session || !["SUPERVISOR", "ADMIN"].includes(session.rol)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const body = await request.json();
  const { ticketId, tecnicoId, programadoEn } = body;

  if (!ticketId) {
    return NextResponse.json({ error: "ticketId requerido" }, { status: 400 });
  }

  const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
  if (!ticket) {
    return NextResponse.json({ error: "Ticket no encontrado" }, { status: 404 });
  }

  const updateData: Record<string, unknown> = {};

  if (tecnicoId !== undefined) {
    if (tecnicoId) {
      const tecnico = await prisma.tecnico.findUnique({ where: { id: tecnicoId } });
      if (!tecnico) {
        return NextResponse.json({ error: "Técnico no encontrado" }, { status: 404 });
      }
    }
    updateData.tecnicoId = tecnicoId || null;
  }

  if (programadoEn !== undefined) {
    updateData.programadoEn = programadoEn ? parseProgramadoEn(programadoEn) : null;
  }

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({ error: "Sin cambios" }, { status: 400 });
  }

  const updated = await prisma.ticket.update({
    where: { id: ticketId },
    data: updateData,
    include: { cliente: true, tecnico: { include: { usuario: true } } },
  });

  await prisma.eventoTicket.create({
    data: {
      ticketId,
      usuarioId: session.id,
      accion: "TICKET_PROGRAMADO",
      metadata: JSON.stringify(updateData),
    },
  });

  if (updated.tecnicoId) {
    await notificarTecnicoAsignacion(updated);
  }

  return NextResponse.json({ ticket: updated });
}
