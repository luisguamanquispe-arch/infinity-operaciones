import { NextResponse } from "next/server";
import type { Prioridad, Prisma, SrEstado, SrResultado, SrTipoSoporte } from "@prisma/client";
import { enMayusculasGuardar } from "@/lib/mayusculas";
import { requireSrSession } from "@/lib/soporte-remoto/auth";
import { generarCodigoSrTicket } from "@/lib/soporte-remoto/codigo";
import { parseDate, srTicketInclude } from "@/lib/soporte-remoto/include";
import {
  SR_ESTADOS,
  SR_PRIORIDADES,
  SR_RESULTADOS,
  SR_TIPOS_SOPORTE,
  calcTiempoMinutos,
} from "@/lib/soporte-remoto/labels";
import { obtenerKpisDashboardSr } from "@/lib/soporte-remoto/stats";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const auth = await requireSrSession();
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(request.url);
  if (searchParams.get("kpis") === "1") {
    const kpis = await obtenerKpisDashboardSr();
    return NextResponse.json({ kpis });
  }

  const q = searchParams.get("q")?.trim();
  const estado = searchParams.get("estado") as SrEstado | null;
  const operadorId = searchParams.get("operadorId")?.trim();
  const tipoSoporte = searchParams.get("tipoSoporte") as SrTipoSoporte | null;
  const desde = parseDate(searchParams.get("desde"));
  const hasta = parseDate(searchParams.get("hasta"));
  const take = Math.min(100, Math.max(1, parseInt(searchParams.get("take") || "50", 10)));

  const where: Prisma.SrTicketWhereInput = {
    ...(estado && SR_ESTADOS.includes(estado) ? { estado } : {}),
    ...(operadorId ? { operadorId } : {}),
    ...(tipoSoporte && SR_TIPOS_SOPORTE.includes(tipoSoporte) ? { tipoSoporte } : {}),
    ...(desde || hasta
      ? {
          fecha: {
            ...(desde ? { gte: desde } : {}),
            ...(hasta ? { lte: hasta } : {}),
          },
        }
      : {}),
    ...(q
      ? {
          OR: [
            { codigo: { contains: q, mode: "insensitive" } },
            { clienteNombre: { contains: q, mode: "insensitive" } },
            { clienteCodigo: { contains: q, mode: "insensitive" } },
            { telefono: { contains: q } },
            { codigoOrigenHd: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const tickets = await prisma.srTicket.findMany({
    where,
    orderBy: { fecha: "desc" },
    take,
    include: {
      operador: { select: { id: true, nombre: true } },
      ticketPresencial: { select: { codigo: true } },
      _count: { select: { adjuntos: true, historial: true } },
    },
  });

  return NextResponse.json({ tickets });
}

export async function POST(request: Request) {
  const auth = await requireSrSession();
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json();
    const tipoSoporte = body.tipoSoporte as SrTipoSoporte;
    if (!tipoSoporte || !SR_TIPOS_SOPORTE.includes(tipoSoporte)) {
      return NextResponse.json({ error: "Motivo de soporte inválido" }, { status: 400 });
    }

    const clienteNombre = enMayusculasGuardar(String(body.clienteNombre || "").trim());
    const clienteCodigo = String(body.clienteCodigo || "").trim();
    const telefono = String(body.telefono || "").trim();
    const descripcionProblema = String(body.descripcionProblema || "").trim();

    if (!clienteNombre || !clienteCodigo || !telefono || descripcionProblema.length < 5) {
      return NextResponse.json(
        {
          error:
            "Complete cliente, código, teléfono y descripción del problema (mín. 5 caracteres)",
        },
        { status: 400 }
      );
    }

    let operadorId = auth.session.id;
    if (
      (auth.session.rol === "ADMIN" || auth.session.rol === "SUPERVISOR") &&
      typeof body.operadorId === "string" &&
      body.operadorId
    ) {
      operadorId = body.operadorId;
    }

    const horaInicio = parseDate(body.horaInicio);
    const horaFin = parseDate(body.horaFin);
    const tiempoMinutos =
      typeof body.tiempoMinutos === "number"
        ? body.tiempoMinutos
        : calcTiempoMinutos(horaInicio, horaFin);

    const estado = (SR_ESTADOS.includes(body.estado) ? body.estado : "PENDIENTE") as SrEstado;
    const prioridad = (
      SR_PRIORIDADES.includes(body.prioridad) ? body.prioridad : "MEDIA"
    ) as Prioridad;
    const resultado =
      body.resultado && SR_RESULTADOS.includes(body.resultado)
        ? (body.resultado as SrResultado)
        : null;

    const codigo = await generarCodigoSrTicket();

    const ticket = await prisma.srTicket.create({
      data: {
        codigo,
        fecha: parseDate(body.fecha) || new Date(),
        horaInicio,
        horaFin,
        tiempoMinutos,
        operadorId,
        clienteId: typeof body.clienteId === "string" && body.clienteId ? body.clienteId : null,
        clienteNombre,
        clienteCodigo,
        telefono,
        estado,
        prioridad,
        tipoSoporte,
        tipoSoporteOtro:
          tipoSoporte === "OTRO"
            ? enMayusculasGuardar(String(body.tipoSoporteOtro || "").trim()) || null
            : null,
        descripcionProblema,
        accionesRealizadas: body.accionesRealizadas
          ? String(body.accionesRealizadas).trim() || null
          : body.solucionAplicada
            ? String(body.solucionAplicada).trim() || null
            : null,
        resultado,
        observaciones: body.observaciones
          ? String(body.observaciones).trim() || null
          : null,
        historial: {
          create: {
            usuarioId: auth.session.id,
            usuarioNombre: auth.session.nombre,
            tiempoMinutos,
            estado,
            nota: "Ticket creado",
          },
        },
      },
      include: srTicketInclude,
    });

    return NextResponse.json({ ticket }, { status: 201 });
  } catch (err) {
    console.error("[help-desk/tickets POST]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error al crear ticket" },
      { status: 500 }
    );
  }
}
