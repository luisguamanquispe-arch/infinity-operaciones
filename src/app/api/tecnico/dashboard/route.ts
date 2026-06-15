import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getFullSession } from "@/lib/auth";
import { calcularDuracionCronometro } from "@/lib/tickets";
import { diaKey } from "@/lib/calendario";
import { whereTecnicoAsignado } from "@/lib/ticket-tecnicos";
import type { Prisma, TipoTrabajo } from "@prisma/client";

export const runtime = "nodejs";

const clienteSelect = {
  select: {
    nombre: true,
    sector: true,
    direccion: true,
    lat: true,
    lng: true,
  },
} as const;

function buildTicketWhere(
  filtro: string,
  tecnicoId: string,
  hoy: Date
): Prisma.TicketWhereInput {
  const base: Prisma.TicketWhereInput = whereTecnicoAsignado(tecnicoId);

  if (filtro === "pendientes") return { ...base, estado: "PENDIENTE" };
  if (filtro === "en_proceso") return { ...base, estado: "EN_PROCESO" };
  if (filtro === "finalizadas") return { ...base, estado: { in: ["FINALIZADO", "CERRADO"] } };
  if (["INSTALACION", "SOPORTE", "INFRAESTRUCTURA", "CORTE", "RECONEXION", "RETIRO", "MIGRACION"].includes(filtro)) {
    return { ...base, tipo: filtro as TipoTrabajo };
  }

  const semana = new Date(hoy);
  semana.setDate(semana.getDate() - 14);

  return {
    ...base,
    OR: [
      { estado: { in: ["PENDIENTE", "EN_PROCESO"] } },
      {
        estado: { in: ["FINALIZADO", "CERRADO"] },
        updatedAt: { gte: semana },
      },
    ],
  };
}

export async function GET(request: Request) {
  const session = await getFullSession();
  if (!session || session.rol !== "TECNICO") {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if (!session.tecnicoId) {
    return NextResponse.json(
      { error: "Su usuario no tiene perfil de técnico. Contacte a gerencia." },
      { status: 403 }
    );
  }

  const { searchParams } = new URL(request.url);
  const filtro = searchParams.get("filtro") || "todos";

  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const finHoy = new Date(hoy);
  finHoy.setHours(23, 59, 59, 999);

  const ticketWhere = buildTicketWhere(filtro, session.tecnicoId, hoy);

  const [tecnico, activos, tickets, finalizadasHoy] = await Promise.all([
    prisma.tecnico.findUnique({
      where: { id: session.tecnicoId },
      select: {
        lat: true,
        lng: true,
        usuario: { select: { nombre: true } },
      },
    }),
    prisma.ticket.findMany({
      where: {
        ...whereTecnicoAsignado(session.tecnicoId),
        estado: { in: ["PENDIENTE", "EN_PROCESO"] },
      },
      include: { cliente: clienteSelect },
      orderBy: [{ programadoEn: "asc" }, { prioridad: "asc" }],
    }),
    prisma.ticket.findMany({
      where: ticketWhere,
      include: {
        cliente: clienteSelect,
        orden: {
          select: {
            cronometro: {
              select: { inicio: true, fin: true, pausasJson: true },
            },
          },
        },
      },
      orderBy: [{ programadoEn: "asc" }, { prioridad: "asc" }, { createdAt: "asc" }],
      take: 60,
    }),
    prisma.ticket.count({
      where: {
        ...whereTecnicoAsignado(session.tecnicoId),
        estado: { in: ["FINALIZADO", "CERRADO"] },
        updatedAt: { gte: hoy, lte: finHoy },
      },
    }),
  ]);

  const programadasHoy = activos.filter(
    (t) => t.programadoEn && diaKey(t.programadoEn) === diaKey(new Date())
  ).length;

  const pendientes = activos.filter((t) => t.estado === "PENDIENTE").length;
  const enProceso = activos.filter((t) => t.estado === "EN_PROCESO").length;

  const agendaRaw = activos
    .filter((t) => t.programadoEn)
    .sort((a, b) => a.programadoEn!.getTime() - b.programadoEn!.getTime());

  const ahora = Date.now();
  const proxima =
    agendaRaw.find(
      (t) => t.estado === "PENDIENTE" && t.programadoEn!.getTime() >= ahora - 15 * 60 * 1000
    ) ?? agendaRaw.find((t) => t.estado === "PENDIENTE") ?? null;

  const serializeTicket = (t: (typeof tickets)[0]) => ({
    id: t.id,
    codigo: t.codigo,
    tipo: t.tipo,
    prioridad: t.prioridad,
    estado: t.estado,
    motivo: t.motivo,
    programadoEn: t.programadoEn?.toISOString() ?? null,
    cliente: t.cliente,
    duracionSegundos: t.orden?.cronometro
      ? calcularDuracionCronometro(
          t.orden.cronometro.inicio,
          t.orden.cronometro.fin,
          t.orden.cronometro.pausasJson
        )
      : 0,
  });

  const serializeAgenda = (t: (typeof agendaRaw)[0]) => ({
    id: t.id,
    codigo: t.codigo,
    tipo: t.tipo,
    prioridad: t.prioridad,
    estado: t.estado,
    motivo: t.motivo,
    programadoEn: t.programadoEn!.toISOString(),
    cliente: {
      nombre: t.cliente.nombre,
      sector: t.cliente.sector,
      direccion: t.cliente.direccion,
    },
  });

  return NextResponse.json(
    {
      resumen: {
        fecha: new Date().toISOString(),
        tecnico: tecnico?.usuario.nombre,
        ubicacion:
          tecnico?.lat && tecnico?.lng ? { lat: tecnico.lat, lng: tecnico.lng } : null,
        programadasHoy,
        pendientes,
        enProceso,
        finalizadas: finalizadasHoy,
        tiempoPromedioMin: 0,
      },
      proximaOrden: proxima ? serializeAgenda(proxima) : null,
      agenda: agendaRaw.map(serializeAgenda),
      tickets: tickets.map(serializeTicket),
    },
    {
      headers: {
        "Cache-Control": "private, no-cache, max-age=0",
      },
    }
  );
}

export async function PATCH(request: Request) {
  const session = await getFullSession();
  if (!session || session.rol !== "TECNICO" || !session.tecnicoId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { lat, lng } = await request.json();

  await prisma.tecnico.update({
    where: { id: session.tecnicoId },
    data: { lat, lng },
  });

  await prisma.ubicacionGps.create({
    data: { tecnicoId: session.tecnicoId, lat, lng },
  });

  return NextResponse.json({ ok: true });
}
