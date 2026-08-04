import { NextResponse } from "next/server";
import type { MotivoJustificacionTecnica } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getFullSession } from "@/lib/auth";
import { getOrCreateOrden } from "@/lib/tickets";
import { tecnicoAsignadoAlTicket, tecnicoIdsFromTicket } from "@/lib/ticket-tecnicos";
import { ordenServicioCerrada } from "@/lib/ticket-cerrado";
import { registrarRevisionHistorial } from "@/lib/revision-reporte";
import {
  MOTIVOS_JUSTIFICACION,
  puedeCerrarConJustificacion,
  motivoJustificacionTexto,
} from "@/lib/justificacion-tecnica";
import { esTicketInfraestructura } from "@/lib/ticket-infraestructura";
import { registrarSiHistorial } from "@/lib/soporte-infraestructura/historial";
import { enMayusculasGuardar } from "@/lib/mayusculas";

/**
 * Cierre por justificación técnica: no exige checklist/fotos/firma.
 * Deja el ticket en FINALIZADO + PENDIENTE_REVISION para el supervisor.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getFullSession();
  if (!session?.tecnicoId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await params;
  const ticket = await prisma.ticket.findUnique({
    where: { id },
    include: { tecnicos: { select: { tecnicoId: true } } },
  });

  if (!ticket || !tecnicoAsignadoAlTicket(ticket, session.tecnicoId)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  if (!puedeCerrarConJustificacion(ticket, session.tecnicoId)) {
    return NextResponse.json(
      {
        error:
          "Solo el Técnico Responsable puede cerrar con justificación técnica",
      },
      { status: 403 }
    );
  }

  const orden = await getOrCreateOrden(id);
  if (ordenServicioCerrada(orden) && ticket.estadoRevision !== "DEVUELTO_CORRECCION") {
    return NextResponse.json(
      { error: "La orden ya fue enviada a revisión" },
      { status: 409 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const motivo = body.motivo as MotivoJustificacionTecnica | undefined;
  const motivoOtro = String(body.motivoOtro || "").trim();
  const justificacion = String(body.justificacion || "").trim();
  const observaciones = String(body.observaciones || "").trim() || null;
  const fotoUrl = String(body.fotoUrl || "").trim() || null;

  if (!motivo || !MOTIVOS_JUSTIFICACION.includes(motivo)) {
    return NextResponse.json({ error: "Seleccione el motivo" }, { status: 400 });
  }
  if (motivo === "OTRO" && motivoOtro.length < 3) {
    return NextResponse.json(
      { error: "Indique el detalle del motivo (Otro)" },
      { status: 400 }
    );
  }
  if (justificacion.length < 15) {
    return NextResponse.json(
      { error: "La justificación técnica es obligatoria (mín. 15 caracteres)" },
      { status: 400 }
    );
  }

  const now = new Date();
  const motivoLabel = motivoJustificacionTexto(motivo, motivoOtro);

  await prisma.$transaction(async (tx) => {
    await tx.justificacionTecnica.create({
      data: {
        ticketId: id,
        tecnicoId: session.tecnicoId!,
        motivo,
        motivoOtro:
          motivo === "OTRO"
            ? enMayusculasGuardar(motivoOtro) || motivoOtro
            : null,
        justificacion: enMayusculasGuardar(justificacion) || justificacion,
        observaciones: observaciones
          ? enMayusculasGuardar(observaciones) || observaciones
          : null,
        fotoUrl,
      },
    });

    await tx.ordenServicio.update({
      where: { id: orden.id },
      data: {
        finalizadoEn: now,
        reportadoPorTecnicoId: orden.reportadoPorTecnicoId ?? session.tecnicoId,
        reportadoEn: orden.reportadoEn ?? now,
        resumenTrabajo:
          orden.resumenTrabajo ||
          `JUSTIFICACIÓN TÉCNICA: ${motivoLabel}. ${justificacion}`.slice(0, 2000),
      },
    });

    await tx.ticket.update({
      where: { id },
      data: {
        estado: "FINALIZADO",
        estadoRevision: "PENDIENTE_REVISION",
        cierrePorJustificacion: true,
      },
    });

    await tx.tecnico.updateMany({
      where: { id: { in: tecnicoIdsFromTicket(ticket) } },
      data: { estadoActual: "DISPONIBLE" },
    });

    await registrarRevisionHistorial(tx, {
      ticketId: id,
      accion: "JUSTIFICACION_TECNICA",
      estadoAnterior: ticket.estadoRevision,
      estadoNuevo: "PENDIENTE_REVISION",
      motivo: motivoLabel,
      observaciones: justificacion,
      usuarioId: session.id,
      usuarioNombre: session.nombre,
      tecnicoId: session.tecnicoId,
    });
  });

  await prisma.eventoTicket.create({
    data: {
      ticketId: id,
      usuarioId: session.id,
      accion: "CIERRE_JUSTIFICACION_TECNICA",
      metadata: JSON.stringify({ motivo, motivoOtro, justificacion }),
    },
  });

  if (esTicketInfraestructura(ticket.tipo)) {
    await registrarSiHistorial(prisma, {
      ticketId: id,
      usuarioId: session.id,
      usuarioNombre: session.nombre,
      accion: "JUSTIFICACION_TECNICA",
      detalle: `${motivoLabel}: ${justificacion}`,
    });
  }

  return NextResponse.json({
    ok: true,
    codigo: ticket.codigo,
    estadoRevision: "PENDIENTE_REVISION",
    cierrePorJustificacion: true,
  });
}
