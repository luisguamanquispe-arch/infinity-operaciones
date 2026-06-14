import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getFullSession } from "@/lib/auth";
import { getOrCreateOrden, calcularDuracionCronometro } from "@/lib/tickets";
import { iniciarCronometroTicket } from "@/lib/cronometro";
import { tecnicoAsignadoAlTicket } from "@/lib/ticket-tecnicos";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getFullSession();
  if (!session?.tecnicoId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await params;
  const { accion, lat, lng } = await request.json();

  const ticket = await prisma.ticket.findUnique({
    where: { id },
    include: { tecnicos: { select: { tecnicoId: true } } },
  });
  if (!ticket || !tecnicoAsignadoAlTicket(ticket, session.tecnicoId)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const orden = await getOrCreateOrden(id);
  const now = new Date();

  if (accion === "iniciar") {
    await iniciarCronometroTicket({
      ticketId: id,
      tecnicoId: session.tecnicoId,
      usuarioId: session.id,
      lat,
      lng,
    });
  } else if (accion === "pausar") {
    const cron = await prisma.cronometro.findUnique({ where: { ordenId: orden.id } });
    if (!cron?.activo) {
      return NextResponse.json({ error: "Cronómetro no activo" }, { status: 400 });
    }

    const pausas: { inicio: string; fin?: string }[] = JSON.parse(cron.pausasJson || "[]");
    pausas.push({ inicio: now.toISOString() });

    await prisma.cronometro.update({
      where: { ordenId: orden.id },
      data: { pausado: true, pausasJson: JSON.stringify(pausas) },
    });
  } else if (accion === "reanudar") {
    const cron = await prisma.cronometro.findUnique({ where: { ordenId: orden.id } });
    if (!cron?.pausado) {
      return NextResponse.json({ error: "Cronómetro no pausado" }, { status: 400 });
    }

    const pausas: { inicio: string; fin?: string }[] = JSON.parse(cron.pausasJson || "[]");
    const last = pausas[pausas.length - 1];
    if (last && !last.fin) last.fin = now.toISOString();

    await prisma.cronometro.update({
      where: { ordenId: orden.id },
      data: { pausado: false, pausasJson: JSON.stringify(pausas) },
    });
  } else if (accion === "finalizar") {
    const cron = await prisma.cronometro.findUnique({ where: { ordenId: orden.id } });
    if (!cron?.inicio) {
      return NextResponse.json({ error: "Cronómetro no iniciado" }, { status: 400 });
    }

    const duracion = calcularDuracionCronometro(cron.inicio, now, cron.pausasJson);

    await prisma.cronometro.update({
      where: { ordenId: orden.id },
      data: {
        fin: now,
        activo: false,
        pausado: false,
        duracionSegundos: duracion,
      },
    });

    await prisma.ordenServicio.update({
      where: { id: orden.id },
      data: { latFin: lat, lngFin: lng },
    });

    await prisma.eventoTicket.create({
      data: {
        ticketId: id,
        usuarioId: session.id,
        accion: "CRONOMETRO_FINALIZADO",
        metadata: JSON.stringify({ duracionSegundos: duracion }),
      },
    });
  } else {
    return NextResponse.json({ error: "Acción inválida" }, { status: 400 });
  }

  const updated = await getOrCreateOrden(id);
  const duracionSegundos = updated.cronometro
    ? calcularDuracionCronometro(
        updated.cronometro.inicio,
        updated.cronometro.fin,
        updated.cronometro.pausasJson
      )
    : 0;

  return NextResponse.json({ orden: updated, duracionSegundos });
}
