import { NextResponse } from "next/server";
import type { SiResultado } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getFullSession } from "@/lib/auth";
import { getOrCreateOrden, validarCierreOrden } from "@/lib/tickets";
import { tecnicoAsignadoAlTicket, tecnicoIdsFromTicket } from "@/lib/ticket-tecnicos";
import {
  esTicketInfraestructura,
  puedeCerrarSoporteInfra,
  SI_RESULTADOS,
} from "@/lib/ticket-infraestructura";
import { esTicketInstalacion } from "@/lib/ticket-instalacion";
import { esSoporteExpress } from "@/lib/soporte-express";
import { asegurarColaboracionOrden } from "@/lib/ticket-reporte";
import { ordenServicioCerrada } from "@/lib/ticket-cerrado";
import { registrarSiHistorial } from "@/lib/soporte-infraestructura/historial";
import { registrarRevisionHistorial } from "@/lib/revision-reporte";
import { FLUJO_TICKET, logFlujoTicket } from "@/lib/ticket-flujo-log";

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
    include: { cliente: true, tecnicos: { select: { tecnicoId: true } } },
  });

  if (!ticket || !tecnicoAsignadoAlTicket(ticket, session.tecnicoId)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  if (esTicketInfraestructura(ticket.tipo) && !puedeCerrarSoporteInfra(ticket, session.tecnicoId)) {
    return NextResponse.json(
      {
        error:
          "Solo el Técnico Responsable puede finalizar esta orden de Soporte de Infraestructura",
      },
      { status: 403 }
    );
  }

  const permiso = await asegurarColaboracionOrden(id, session.tecnicoId);
  if (!permiso.ok) {
    return NextResponse.json(
      { error: permiso.error, reportadoPor: permiso.reportadoPorNombre },
      { status: permiso.status }
    );
  }

  const orden = await getOrCreateOrden(id);

  if (ordenServicioCerrada(orden)) {
    return NextResponse.json({ ok: true, yaCerrado: true });
  }

  let body: {
    diagnosticoInfra?: string;
    trabajoRealizadoInfra?: string;
    resultadoInfra?: string;
    observacionesInfra?: string;
  } = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  if (esTicketInfraestructura(ticket.tipo)) {
    const diagnostico = String(body.diagnosticoInfra || ticket.diagnosticoInfra || "").trim();
    const trabajo = String(
      body.trabajoRealizadoInfra || ticket.trabajoRealizadoInfra || ""
    ).trim();
    const resultado = (body.resultadoInfra || ticket.resultadoInfra) as SiResultado | null;
    const observaciones = body.observacionesInfra ?? ticket.observacionesInfra;

    if (diagnostico.length < 10) {
      return NextResponse.json(
        { error: "Ingrese el diagnóstico (mín. 10 caracteres)" },
        { status: 400 }
      );
    }
    if (trabajo.length < 10) {
      return NextResponse.json(
        { error: "Ingrese el trabajo realizado (mín. 10 caracteres)" },
        { status: 400 }
      );
    }
    if (!resultado || !SI_RESULTADOS.includes(resultado)) {
      return NextResponse.json({ error: "Seleccione el resultado del soporte" }, { status: 400 });
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

    // Asegura resumen en orden para validarCierreOrden
    if (!orden.resumenTrabajo || orden.resumenTrabajo.trim().length < 10) {
      await prisma.ordenServicio.update({
        where: { id: orden.id },
        data: { resumenTrabajo: trabajo },
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

  await prisma.$transaction([
    prisma.ordenServicio.update({
      where: { id: ordenFresh.id },
      data: {
        finalizadoEn: now,
        reportadoPorTecnicoId: ordenFresh.reportadoPorTecnicoId ?? session.tecnicoId,
        reportadoEn: ordenFresh.reportadoEn ?? now,
      },
    }),
    prisma.ticket.update({
      where: { id },
      data: {
        estado: "FINALIZADO",
        estadoRevision: "PENDIENTE_REVISION",
      },
    }),
    prisma.tecnico.updateMany({
      where: { id: { in: tecnicoIdsFromTicket(ticket) } },
      data: { estadoActual: "DISPONIBLE" },
    }),
  ]);

  // WhatsApp al cliente solo cuando el supervisor apruebe el reporte.

  await prisma.eventoTicket.create({
    data: {
      ticketId: id,
      usuarioId: session.id,
      accion: "REPORTE_ENVIADO_REVISION",
      metadata: JSON.stringify({ tecnicoId: session.tecnicoId }),
    },
  });

  await registrarRevisionHistorial(prisma, {
    ticketId: id,
    accion: "ENVIADO_REVISION",
    estadoAnterior: null,
    estadoNuevo: "PENDIENTE_REVISION",
    usuarioId: session.id,
    usuarioNombre: session.nombre,
    tecnicoId: session.tecnicoId,
  });

  if (esTicketInfraestructura(ticket.tipo)) {
    await registrarSiHistorial(prisma, {
      ticketId: id,
      usuarioId: session.id,
      usuarioNombre: session.nombre,
      accion: "ORDEN_ENVIADA_REVISION",
      detalle: `Enviada a revisión por técnico responsable`,
    });
  }

  logFlujoTicket(FLUJO_TICKET.REPORT_SUBMITTED, {
    ticketId: id,
    codigo: ticket.codigo,
    clienteId: ticket.clienteId,
    tecnicoId: session.tecnicoId,
    resultado: "enviado_revision",
  });
  logFlujoTicket(FLUJO_TICKET.REPORT_RECEIVED, {
    ticketId: id,
    codigo: ticket.codigo,
    clienteId: ticket.clienteId,
    tecnicoId: session.tecnicoId,
    estado: "FINALIZADO",
    resultado: "recibido",
  });
  logFlujoTicket(FLUJO_TICKET.TICKET_CLOSED, {
    ticketId: id,
    codigo: ticket.codigo,
    clienteId: ticket.clienteId,
    tecnicoId: session.tecnicoId,
    estado: "FINALIZADO",
    resultado: "finalizado",
  });
  logFlujoTicket(FLUJO_TICKET.HISTORY_UPDATED, {
    ticketId: id,
    codigo: ticket.codigo,
    clienteId: ticket.clienteId,
    tecnicoId: session.tecnicoId,
    resultado: "historial_ok",
  });

  return NextResponse.json({
    ok: true,
    codigo: ticket.codigo,
    estadoRevision: "PENDIENTE_REVISION",
  });
}
