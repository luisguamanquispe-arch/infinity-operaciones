import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getFullSession } from "@/lib/auth";
import { calcularDuracionCronometro } from "@/lib/tickets";
import { diaKey } from "@/lib/calendario";
import {
  diasDesdeReferencia,
  whereTicketActivoEnLista,
  whereTicketNoAtendido,
} from "@/lib/ticket-antiguedad";

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

export async function GET() {
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

  // F3/E6 + F4/E5: GET solo lectura (sin sync de asignaciones ni cierres en masa).

  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const finHoy = new Date(hoy);
  finHoy.setHours(23, 59, 59, 999);

  const tecnicoId = session.tecnicoId;

  const asignadoAMi = {
    OR: [{ tecnicoId }, { tecnicos: { some: { tecnicoId } } }],
  };

  const [tecnico, activos, noAtendidosDb, finalizadasHoy] = await Promise.all([
    prisma.tecnico.findUnique({
      where: { id: tecnicoId },
      select: {
        lat: true,
        lng: true,
        usuario: { select: { nombre: true, email: true } },
      },
    }),
    prisma.ticket.findMany({
      where: whereTicketActivoEnLista(asignadoAMi),
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
      take: 80,
    }),
    prisma.ticket.findMany({
      where: whereTicketNoAtendido(asignadoAMi),
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
      orderBy: [{ createdAt: "asc" }, { prioridad: "asc" }],
      take: 80,
    }),
    prisma.ticket.count({
      where: {
        AND: [
          { estado: { in: ["FINALIZADO", "CERRADO"] } },
          { updatedAt: { gte: hoy, lte: finHoy } },
          asignadoAMi,
        ],
      },
    }),
  ]);

  const programadasHoy = activos.filter(
    (t) => t.programadoEn && diaKey(t.programadoEn) === diaKey(new Date())
  ).length;

  const pendientes = activos.filter(
    (t) => t.estado === "PENDIENTE" || t.estado === "LEIDO"
  ).length;
  const enProceso = activos.filter((t) => t.estado === "EN_PROCESO").length;

  const agendaRaw = activos
    .filter((t) => t.programadoEn)
    .sort((a, b) => a.programadoEn!.getTime() - b.programadoEn!.getTime());

  const ahora = Date.now();
  const proxima =
    agendaRaw.find(
      (t) =>
        (t.estado === "PENDIENTE" || t.estado === "LEIDO") &&
        t.programadoEn!.getTime() >= ahora - 15 * 60 * 1000
    ) ??
    agendaRaw.find((t) => t.estado === "PENDIENTE" || t.estado === "LEIDO") ??
    agendaRaw.find((t) => t.estado === "EN_PROCESO") ??
    null;

  const serializeTicket = (t: (typeof activos)[0]) => ({
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

  const serializeActivoMapa = (t: (typeof activos)[0]) => ({
    id: t.id,
    codigo: t.codigo,
    tipo: t.tipo,
    prioridad: t.prioridad,
    estado: t.estado,
    programadoEn: t.programadoEn?.toISOString() ?? null,
    cliente: t.cliente,
  });

  const ordenes = activos.map(serializeTicket);
  // F7/E7: Mis órdenes = sin horario; Agenda = con programadoEn (sin duplicar).
  const ordenesSinProgramar = activos
    .filter((t) => !t.programadoEn)
    .map(serializeTicket);

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
        asignadas: activos.length,
      },
      /** Ayuda a verificar que la sesión del técnico coincide con las asignaciones. */
      debugAsignacion: {
        tecnicoId,
        email: tecnico?.usuario.email ?? null,
        ordenesActivas: activos.length,
        codigos: activos.map((t) => t.codigo),
        /** Señal E1: sesión válida pero 0 órdenes — revisar reconciliar-e1 */
        posibleE1: activos.length === 0 && noAtendidosDb.length === 0,
      },
      proximaOrden: proxima ? serializeAgenda(proxima) : null,
      agenda: agendaRaw.map(serializeAgenda),
      activosMapa: activos.map(serializeActivoMapa),
      /** Órdenes activas sin fecha programada (las programadas van en Agenda). */
      ordenesPendientes: ordenesSinProgramar,
      /** Asignados con ≥4 días sin atención. Siguen visibles para el técnico. */
      noAtendidos: noAtendidosDb.map((t) => ({
        ...serializeTicket(t),
        diasSinAtencion: Math.floor(diasDesdeReferencia(t)),
      })),
      /** Todas las activas (mapa / compat). */
      tickets: ordenes,
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

  const body = await request.json().catch(() => ({}));
  const lat = Number(body.lat);
  const lng = Number(body.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json({ error: "lat/lng inválidos" }, { status: 400 });
  }
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return NextResponse.json({ error: "Coordenadas fuera de rango" }, { status: 400 });
  }

  await prisma.tecnico.update({
    where: { id: session.tecnicoId },
    data: { lat, lng },
  });

  await prisma.ubicacionGps.create({
    data: { tecnicoId: session.tecnicoId, lat, lng },
  });

  return NextResponse.json({ ok: true });
}
