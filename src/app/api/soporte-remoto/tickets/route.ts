import { NextResponse } from "next/server";
import type { Prisma, SrEstado, SrResultado, SrTipoSoporte } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { enMayusculasGuardar } from "@/lib/mayusculas";
import { requireSrSession } from "@/lib/soporte-remoto/auth";
import { generarCodigoSrTicket } from "@/lib/soporte-remoto/codigo";
import {
  SR_ESTADOS,
  SR_RESULTADOS,
  SR_TIPOS_SOPORTE,
  calcTiempoMinutos,
} from "@/lib/soporte-remoto/labels";

const ticketInclude = {
  operador: { select: { id: true, nombre: true, email: true } },
  cliente: { select: { id: true, nombre: true, cedula: true, telefono: true } },
  adjuntos: { orderBy: { createdAt: "asc" as const } },
  historial: {
    orderBy: { fecha: "desc" as const },
    take: 50,
  },
} satisfies Prisma.SrTicketInclude;

function parseDate(v: unknown): Date | null {
  if (!v || typeof v !== "string") return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function GET(request: Request) {
  const auth = await requireSrSession();
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(request.url);
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
          ],
        }
      : {}),
  };

  // HELP_DESK ve todos; filtro por operador opcional
  const tickets = await prisma.srTicket.findMany({
    where,
    orderBy: { fecha: "desc" },
    take,
    include: {
      operador: { select: { id: true, nombre: true } },
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
      return NextResponse.json({ error: "Tipo de soporte inválido" }, { status: 400 });
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
        tipoSoporte,
        tipoSoporteOtro:
          tipoSoporte === "OTRO"
            ? enMayusculasGuardar(String(body.tipoSoporteOtro || "").trim()) || null
            : null,
        descripcionProblema,
        solucionAplicada: body.solucionAplicada
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
      include: ticketInclude,
    });

    return NextResponse.json({ ticket }, { status: 201 });
  } catch (err) {
    console.error("[soporte-remoto POST]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error al crear ticket" },
      { status: 500 }
    );
  }
}
