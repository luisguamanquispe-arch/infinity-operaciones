import { NextResponse } from "next/server";
import type { Prioridad, Prisma, SrEstado, SrResultado, SrTipoSoporte } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { enMayusculasGuardar } from "@/lib/mayusculas";
import { requireSrSession } from "@/lib/soporte-remoto/auth";
import { parseDate, srTicketInclude } from "@/lib/soporte-remoto/include";
import {
  SR_ESTADOS,
  SR_PRIORIDADES,
  SR_RESULTADOS,
  SR_TIPOS_SOPORTE,
  calcTiempoMinutos,
} from "@/lib/soporte-remoto/labels";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireSrSession();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const ticket = await prisma.srTicket.findUnique({
    where: { id },
    include: srTicketInclude,
  });
  if (!ticket) {
    return NextResponse.json({ error: "Ticket no encontrado" }, { status: 404 });
  }
  return NextResponse.json({ ticket });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireSrSession();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const existente = await prisma.srTicket.findUnique({ where: { id } });
  if (!existente) {
    return NextResponse.json({ error: "Ticket no encontrado" }, { status: 404 });
  }

  try {
    const body = await request.json();
    const data: Prisma.SrTicketUpdateInput = {};
    let notaHistorial = "Ticket actualizado";

    if (body.fecha !== undefined) data.fecha = parseDate(body.fecha) || existente.fecha;
    if (body.horaInicio !== undefined) data.horaInicio = parseDate(body.horaInicio);
    if (body.horaFin !== undefined) data.horaFin = parseDate(body.horaFin);

    const horaInicio =
      body.horaInicio !== undefined ? parseDate(body.horaInicio) : existente.horaInicio;
    const horaFin = body.horaFin !== undefined ? parseDate(body.horaFin) : existente.horaFin;

    if (body.tiempoMinutos !== undefined) {
      data.tiempoMinutos =
        typeof body.tiempoMinutos === "number" ? body.tiempoMinutos : null;
    } else if (body.horaInicio !== undefined || body.horaFin !== undefined) {
      data.tiempoMinutos = calcTiempoMinutos(horaInicio, horaFin);
    }

    if (body.estado && SR_ESTADOS.includes(body.estado)) {
      data.estado = body.estado as SrEstado;
      notaHistorial =
        body.estado === "FINALIZADO"
          ? "Ticket finalizado"
          : body.estado === "ESCALADO"
            ? "Ticket escalado"
            : `Estado → ${body.estado}`;
    }
    if (body.prioridad && SR_PRIORIDADES.includes(body.prioridad)) {
      data.prioridad = body.prioridad as Prioridad;
    }
    if (body.tipoSoporte && SR_TIPOS_SOPORTE.includes(body.tipoSoporte)) {
      data.tipoSoporte = body.tipoSoporte as SrTipoSoporte;
      data.tipoSoporteOtro =
        body.tipoSoporte === "OTRO"
          ? enMayusculasGuardar(String(body.tipoSoporteOtro || "").trim()) || null
          : null;
    }
    if (typeof body.clienteNombre === "string") {
      data.clienteNombre = enMayusculasGuardar(body.clienteNombre.trim());
    }
    if (typeof body.clienteCodigo === "string") data.clienteCodigo = body.clienteCodigo.trim();
    if (typeof body.telefono === "string") data.telefono = body.telefono.trim();
    if (typeof body.descripcionProblema === "string") {
      data.descripcionProblema = body.descripcionProblema.trim();
    }
    const acciones =
      body.accionesRealizadas !== undefined
        ? body.accionesRealizadas
        : body.solucionAplicada !== undefined
          ? body.solucionAplicada
          : undefined;
    if (acciones !== undefined) {
      data.accionesRealizadas = acciones ? String(acciones).trim() : null;
    }
    if (body.observaciones !== undefined) {
      data.observaciones = body.observaciones ? String(body.observaciones).trim() : null;
    }
    if (body.resultado === null) {
      data.resultado = null;
    } else if (body.resultado && SR_RESULTADOS.includes(body.resultado)) {
      data.resultado = body.resultado as SrResultado;
    }
    if (body.clienteId !== undefined) {
      data.cliente = body.clienteId
        ? { connect: { id: body.clienteId } }
        : { disconnect: true };
    }
    if (
      (auth.session.rol === "ADMIN" || auth.session.rol === "SUPERVISOR") &&
      typeof body.operadorId === "string" &&
      body.operadorId
    ) {
      data.operador = { connect: { id: body.operadorId } };
    }

    const tiempoFinal =
      typeof data.tiempoMinutos === "number"
        ? data.tiempoMinutos
        : data.tiempoMinutos === null
          ? null
          : existente.tiempoMinutos;
    const estadoFinal = (
      typeof data.estado === "string" ? data.estado : existente.estado
    ) as SrEstado;

    const ticket = await prisma.srTicket.update({
      where: { id },
      data: {
        ...data,
        historial: {
          create: {
            usuarioId: auth.session.id,
            usuarioNombre: auth.session.nombre,
            tiempoMinutos: tiempoFinal,
            estado: estadoFinal,
            nota: typeof body.notaHistorial === "string" ? body.notaHistorial : notaHistorial,
          },
        },
      },
      include: srTicketInclude,
    });

    return NextResponse.json({ ticket });
  } catch (err) {
    console.error("[help-desk/tickets PATCH]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error al actualizar" },
      { status: 500 }
    );
  }
}
