import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getFullSession } from "@/lib/auth";
import { calcularDuracionCronometro } from "@/lib/tickets";

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

  const todosHoy = await prisma.ticket.findMany({
    where: {
      tecnicoId: session.tecnicoId,
      createdAt: { gte: hoy },
    },
    include: { orden: { include: { cronometro: true } } },
  });

  const pendientes = todosHoy.filter((t) => t.estado === "PENDIENTE").length;
  const enProceso = todosHoy.filter((t) => t.estado === "EN_PROCESO").length;
  const finalizadas = todosHoy.filter((t) =>
    ["FINALIZADO", "CERRADO"].includes(t.estado)
  ).length;

  const duraciones = todosHoy
    .filter((t) => t.orden?.cronometro?.duracionSegundos)
    .map((t) => t.orden!.cronometro!.duracionSegundos);

  const tiempoPromedio =
    duraciones.length > 0
      ? Math.round(duraciones.reduce((a, b) => a + b, 0) / duraciones.length / 60)
      : 0;

  const tecnico = await prisma.tecnico.findUnique({
    where: { id: session.tecnicoId },
    include: { usuario: true },
  });

  return NextResponse.json({
    resumen: {
      fecha: new Date().toISOString(),
      tecnico: tecnico?.usuario.nombre,
      ubicacion: tecnico?.lat && tecnico?.lng
        ? { lat: tecnico.lat, lng: tecnico.lng }
        : null,
      asignadas: todosHoy.length,
      pendientes,
      enProceso,
      finalizadas,
      tiempoPromedioMin: tiempoPromedio,
    },
    tickets: tickets.map((t) => ({
      ...t,
      duracionSegundos: t.orden?.cronometro
        ? calcularDuracionCronometro(
            t.orden.cronometro.inicio,
            t.orden.cronometro.fin,
            t.orden.cronometro.pausasJson
          )
        : 0,
    })),
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
