import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getFullSession } from "@/lib/auth";
import { cuposDisponibles, diaKey, parseProgramadoEn } from "@/lib/calendario";
import {
  asignarTecnicosTicket,
  notificarTecnicosNuevos,
  tecnicoIdsFromTicket,
  ticketIncludeTecnicos,
  validarTecnicoIds,
} from "@/lib/ticket-tecnicos";
import {
  startOfWeek,
  endOfWeek,
  addDays,
  parseISO,
  format,
} from "date-fns";
import { es } from "date-fns/locale";
import { mensajeErrorPrisma } from "@/lib/prisma-errors";

const ESTADOS_ACTIVOS = ["PENDIENTE", "EN_PROCESO"] as const;

function ticketEnTecnico(
  t: { tecnicoId: string | null; tecnicos: { tecnicoId: string }[] },
  tecnicoId: string
) {
  return tecnicoIdsFromTicket(t).includes(tecnicoId);
}

function ticketResumen(t: {
  id: string;
  codigo: string;
  tipo: string;
  prioridad: string;
  estado: string;
  motivo: string | null;
  programadoEn: Date | null;
  tecnicoId: string | null;
  tecnicos: { tecnicoId: string }[];
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
    tecnicoIds: tecnicoIdsFromTicket(t),
    cliente: t.cliente,
  };
}

export async function GET(request: Request) {
  try {
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

  const ticketInclude = {
    cliente: true,
    tecnicos: { select: { tecnicoId: true } },
  };

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
      include: ticketInclude,
      orderBy: { programadoEn: "asc" },
    }),
    prisma.ticket.findMany({
      where: {
        estado: { in: [...ESTADOS_ACTIVOS] },
        programadoEn: null,
      },
      include: ticketInclude,
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
        (t) =>
          t.programadoEn &&
          diaKey(t.programadoEn) === dia.fecha &&
          ticketEnTecnico(t, tec.id)
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

  for (const t of ticketsSemana.filter(
    (t) => tecnicoIdsFromTicket(t).length === 0 && t.programadoEn
  )) {
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
  } catch (err) {
    console.error("[GET calendario]", err);
    return NextResponse.json(
      { error: mensajeErrorPrisma(err) },
      { status: 500 }
    );
  }
}

function parseTecnicoIds(body: {
  tecnicoIds?: string[];
  tecnicoId?: string | null;
}): string[] | undefined {
  if (body.tecnicoIds !== undefined) {
    return Array.isArray(body.tecnicoIds) ? body.tecnicoIds.filter(Boolean) : [];
  }
  if (body.tecnicoId !== undefined) {
    return body.tecnicoId ? [body.tecnicoId] : [];
  }
  return undefined;
}

export async function PATCH(request: Request) {
  const session = await getFullSession();
  if (!session || !["SUPERVISOR", "ADMIN"].includes(session.rol)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const body = await request.json();
  const { ticketId, programadoEn } = body;
  const tecnicoIdsInput = parseTecnicoIds(body);

  if (!ticketId) {
    return NextResponse.json({ error: "ticketId requerido" }, { status: 400 });
  }

  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    include: { tecnicos: true },
  });
  if (!ticket) {
    return NextResponse.json({ error: "Ticket no encontrado" }, { status: 404 });
  }

  const idsAnteriores = tecnicoIdsFromTicket(ticket);
  const updateData: Record<string, unknown> = {};

  if (programadoEn !== undefined) {
    updateData.programadoEn = programadoEn ? parseProgramadoEn(programadoEn) : null;
  }

  if (tecnicoIdsInput !== undefined) {
    const errTecnicos = await validarTecnicoIds(tecnicoIdsInput);
    if (errTecnicos) {
      return NextResponse.json({ error: errTecnicos }, { status: 404 });
    }
  }

  if (Object.keys(updateData).length === 0 && tecnicoIdsInput === undefined) {
    return NextResponse.json({ error: "Sin cambios" }, { status: 400 });
  }

  if (Object.keys(updateData).length > 0) {
    await prisma.ticket.update({ where: { id: ticketId }, data: updateData });
  }

  let idsNuevos = idsAnteriores;
  if (tecnicoIdsInput !== undefined) {
    idsNuevos = await asignarTecnicosTicket(ticketId, tecnicoIdsInput);
  }

  const updated = await prisma.ticket.findUnique({
    where: { id: ticketId },
    include: ticketIncludeTecnicos,
  });

  if (!updated) {
    return NextResponse.json({ error: "Ticket no encontrado" }, { status: 404 });
  }

  await prisma.eventoTicket.create({
    data: {
      ticketId,
      usuarioId: session.id,
      accion: "TICKET_PROGRAMADO",
      metadata: JSON.stringify({ ...updateData, tecnicoIds: idsNuevos }),
    },
  });

  if (idsNuevos.length) {
    await notificarTecnicosNuevos(updated, idsAnteriores, idsNuevos);
  }

  return NextResponse.json({
    ticket: { ...updated, tecnicoIds: idsNuevos },
  });
}
