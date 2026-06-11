import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getFullSession } from "@/lib/auth";
import { calcularDuracionCronometro } from "@/lib/tickets";
import { diaKey } from "@/lib/calendario";

export async function GET(request: Request) {
  const session = await getFullSession();
  if (!session?.tecnicoId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const filtro = searchParams.get("filtro") || "todos";

  const where: Record<string, unknown> = { tecnicoId: session.tecnicoId };

  if (filtro === "pendientes") where.estado = "PENDIENTE";
  else if (filtro === "en_proceso") where.estado = "EN_PROCESO";
  else if (filtro === "finalizadas") where.estado = { in: ["FINALIZADO", "CERRADO"] };
  else if (["INSTALACION", "SOPORTE", "CORTE", "RECONEXION", "RETIRO", "MIGRACION"].includes(filtro)) {
    where.tipo = filtro;
  }

  const tickets = await prisma.ticket.findMany({
    where,
    include: {
      cliente: true,
      orden: { include: { cronometro: true } },
    },
    orderBy: [{ programadoEn: "asc" }, { prioridad: "asc" }, { createdAt: "asc" }],
  });

  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const finHoy = new Date(hoy);
  finHoy.setHours(23, 59, 59, 999);

  const activos = await prisma.ticket.findMany({
    where: {
      tecnicoId: session.tecnicoId,
      estado: { in: ["PENDIENTE", "EN_PROCESO"] },
    },
    include: {
      cliente: true,
      orden: { include: { cronometro: true } },
    },
  });

  const programadasHoy = activos.filter(
    (t) => t.programadoEn && diaKey(t.programadoEn) === diaKey(new Date())
  ).length;

  const pendientes = activos.filter((t) => t.estado === "PENDIENTE").length;
  const enProceso = activos.filter((t) => t.estado === "EN_PROCESO").length;

  const finalizadasHoy = await prisma.ticket.count({
    where: {
      tecnicoId: session.tecnicoId,
      estado: { in: ["FINALIZADO", "CERRADO"] },
      updatedAt: { gte: hoy, lte: finHoy },
    },
  });

  const finalizadosRecientes = await prisma.ticket.findMany({
    where: {
      tecnicoId: session.tecnicoId,
      estado: { in: ["FINALIZADO", "CERRADO"] },
    },
    include: { orden: { include: { cronometro: true } } },
    orderBy: { updatedAt: "desc" },
    take: 20,
  });

  const duraciones = finalizadosRecientes
    .map((t) => t.orden?.cronometro?.duracionSegundos)
    .filter((d): d is number => !!d && d > 0);

  const tiempoPromedio =
    duraciones.length > 0
      ? Math.round(duraciones.reduce((a, b) => a + b, 0) / duraciones.length / 60)
      : 0;

  const agendaRaw = activos
    .filter((t) => t.programadoEn)
    .sort((a, b) => a.programadoEn!.getTime() - b.programadoEn!.getTime());

  const ahora = Date.now();
  const proxima = agendaRaw.find(
    (t) => t.estado === "PENDIENTE" && t.programadoEn!.getTime() >= ahora - 15 * 60 * 1000
  ) ?? agendaRaw.find((t) => t.estado === "PENDIENTE") ?? null;

  const tecnico = await prisma.tecnico.findUnique({
    where: { id: session.tecnicoId },
    include: { usuario: true },
  });

  const serializeTicket = (t: (typeof tickets)[0]) => ({
    ...t,
    programadoEn: t.programadoEn?.toISOString() ?? null,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
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

  return NextResponse.json({
    resumen: {
      fecha: new Date().toISOString(),
      tecnico: tecnico?.usuario.nombre,
      ubicacion: tecnico?.lat && tecnico?.lng
        ? { lat: tecnico.lat, lng: tecnico.lng }
        : null,
      programadasHoy,
      pendientes,
      enProceso,
      finalizadas: finalizadasHoy,
      tiempoPromedioMin: tiempoPromedio,
    },
    proximaOrden: proxima ? serializeAgenda(proxima) : null,
    agenda: agendaRaw.map(serializeAgenda),
    tickets: tickets.map(serializeTicket),
  });
}

export async function PATCH(request: Request) {
  const session = await getFullSession();
  if (!session?.tecnicoId) {
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
