import { NextResponse } from "next/server";
import type { SiResultado } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getFullSession } from "@/lib/auth";
import { getOrCreateOrden, validarCierreOrden } from "@/lib/tickets";
import { tecnicoAsignadoAlTicket } from "@/lib/ticket-tecnicos";
import {
  esTicketInfraestructura,
  puedeCerrarSoporteInfra,
  SI_RESULTADOS,
} from "@/lib/ticket-infraestructura";
import { esTicketInstalacion } from "@/lib/ticket-instalacion";
import { esSoporteExpress } from "@/lib/soporte-express";
import { registrarRevisionHistorial } from "@/lib/revision-reporte";
import { notificarSupervisorCorreccion } from "@/lib/notificaciones-revision";
import { registrarSiHistorial } from "@/lib/soporte-infraestructura/historial";
import { enMayusculasGuardar } from "@/lib/mayusculas";

/** Técnico: reenvía reporte corregido → CORREGIDO. */
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
    include: { tecnicos: { select: { tecnicoId: true } }, orden: true },
  });

  if (!ticket || !tecnicoAsignadoAlTicket(ticket, session.tecnicoId)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  if (ticket.estadoRevision !== "DEVUELTO_CORRECCION") {
    return NextResponse.json(
      { error: "Solo se puede reenviar un reporte devuelto para corrección" },
      { status: 409 }
    );
  }

  if (
    esTicketInfraestructura(ticket.tipo) &&
    !puedeCerrarSoporteInfra(ticket, session.tecnicoId)
  ) {
    return NextResponse.json(
      { error: "Solo el Técnico Responsable puede enviar la corrección" },
      { status: 403 }
    );
  }

  const body = await request.json().catch(() => ({}));

  if (esTicketInfraestructura(ticket.tipo)) {
    const diagnostico = String(
      body.diagnosticoInfra ?? ticket.diagnosticoInfra ?? ""
    ).trim();
    const trabajo = String(
      body.trabajoRealizadoInfra ?? ticket.trabajoRealizadoInfra ?? ""
    ).trim();
    const resultado = (body.resultadoInfra ??
      ticket.resultadoInfra) as SiResultado | null;
    const observaciones = body.observacionesInfra ?? ticket.observacionesInfra;

    if (diagnostico.length < 10 || trabajo.length < 10) {
      return NextResponse.json(
        { error: "Complete diagnóstico y trabajo realizado (mín. 10 caracteres)" },
        { status: 400 }
      );
    }
    if (!resultado || !SI_RESULTADOS.includes(resultado)) {
      return NextResponse.json({ error: "Seleccione el resultado" }, { status: 400 });
    }

    await prisma.ticket.update({
      where: { id },
      data: {
        diagnosticoInfra: diagnostico,
        trabajoRealizadoInfra: trabajo,
        resultadoInfra: resultado,
        observacionesInfra: observaciones ? String(observaciones).trim() : null,
      },
    });

    const orden = await getOrCreateOrden(id);
    await prisma.ordenServicio.update({
      where: { id: orden.id },
      data: { resumenTrabajo: trabajo },
    });
  } else {
    if (body.descripcion != null) {
      await prisma.ticket.update({
        where: { id },
        data: {
          descripcion: enMayusculasGuardar(String(body.descripcion).trim()) || null,
        },
      });
    }
    if (body.resumenTrabajo != null && String(body.resumenTrabajo).trim().length >= 10) {
      const orden = await getOrCreateOrden(id);
      await prisma.ordenServicio.update({
        where: { id: orden.id },
        data: { resumenTrabajo: String(body.resumenTrabajo).trim() },
      });
    }
  }

  const ordenFresh = await getOrCreateOrden(id);
  const validacion = validarCierreOrden(ordenFresh, {
    esInfraestructura: esTicketInfraestructura(ticket.tipo),
    esInstalacion: esTicketInstalacion(ticket.tipo),
    esExpress: esSoporteExpress(ticket),
  });
  if (!validacion.valido) {
    return NextResponse.json(
      { error: "Validación fallida", errores: validacion.errores },
      { status: 400 }
    );
  }

  const now = new Date();
  await prisma.$transaction(async (tx) => {
    await tx.ordenServicio.update({
      where: { id: ordenFresh.id },
      data: { finalizadoEn: now },
    });
    await tx.ticket.update({
      where: { id },
      data: { estado: "FINALIZADO", estadoRevision: "CORREGIDO" },
    });
    await registrarRevisionHistorial(tx, {
      ticketId: id,
      accion: "CORRECCION_ENVIADA",
      estadoAnterior: "DEVUELTO_CORRECCION",
      estadoNuevo: "CORREGIDO",
      usuarioId: session.id,
      usuarioNombre: session.nombre,
      tecnicoId: session.tecnicoId,
    });
  });

  if (esTicketInfraestructura(ticket.tipo)) {
    await registrarSiHistorial(prisma, {
      ticketId: id,
      usuarioId: session.id,
      usuarioNombre: session.nombre,
      accion: "CORRECCION_ENVIADA",
      detalle: "Técnico reenvió el reporte corregido",
    });
  }

  await prisma.eventoTicket.create({
    data: {
      ticketId: id,
      usuarioId: session.id,
      accion: "REPORTE_CORREGIDO",
      metadata: JSON.stringify({ tecnicoId: session.tecnicoId }),
    },
  });

  await notificarSupervisorCorreccion({
    codigo: ticket.codigo,
    tecnicoNombre: session.nombre,
  });

  return NextResponse.json({
    ok: true,
    estadoRevision: "CORREGIDO",
    codigo: ticket.codigo,
  });
}
