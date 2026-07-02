import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { HelpDeskAuthError, requireHelpDeskSession } from "@/lib/help-desk/auth";
import { generarCodigoHelpDesk } from "@/lib/help-desk/codigo";
import { buscarClientePorTelefono } from "@/lib/help-desk/cliente-contexto";
import { slaHorasPorPrioridad } from "@/lib/tickets";

function handleError(err: unknown) {
  if (err instanceof HelpDeskAuthError) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  const msg = err instanceof Error ? err.message : "Error interno";
  return NextResponse.json({ error: msg }, { status: 400 });
}

export async function GET(request: Request) {
  try {
    const session = await requireHelpDeskSession();
    const { searchParams } = new URL(request.url);
    const estado = searchParams.get("estado");

    const where =
      estado && estado !== "todos"
        ? { estado: estado as never }
        : session.rol === "HELP_DESK"
          ? {
              OR: [
                { estado: "EN_COLA" as const },
                { asignadoAId: session.id },
              ],
            }
          : {};

    const items = await prisma.hdConversacion.findMany({
      where,
      include: {
        cliente: { select: { nombre: true, telefono: true, plan: true, sector: true } },
        asignadoA: { select: { nombre: true } },
        mensajes: { orderBy: { createdAt: "desc" }, take: 1 },
      },
      orderBy: [{ estado: "asc" }, { createdAt: "asc" }],
      take: 80,
    });

    return NextResponse.json({ items });
  } catch (err) {
    return handleError(err);
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireHelpDeskSession();
    const body = await request.json();
    const telefono = body.telefono?.trim();
    const motivo = body.motivo?.trim() || "Consulta de soporte";

    let cliente = telefono ? await buscarClientePorTelefono(telefono) : null;
    const codigo = await generarCodigoHelpDesk();
    const prioridad = body.prioridad || "MEDIA";
    const slaHoras = slaHorasPorPrioridad(prioridad);

    const conv = await prisma.hdConversacion.create({
      data: {
        codigo,
        canal: body.canal || "CHAT",
        motivo,
        prioridad,
        slaVenceEn: new Date(Date.now() + slaHoras * 60 * 60 * 1000),
        clienteId: cliente?.id,
        tipoCliente: cliente ? "EXISTENTE" : "PROSPECTO",
        prospectoTelefono: cliente ? null : telefono,
        prospectoNombre: body.nombre || null,
        asignadoAId: session.rol === "HELP_DESK" ? session.id : null,
        estado: session.rol === "HELP_DESK" ? "EN_ATENCION" : "EN_COLA",
        mensajes: {
          create: body.mensajeInicial
            ? { autor: "CLIENTE", contenido: body.mensajeInicial }
            : undefined,
        },
      },
      include: {
        cliente: true,
        mensajes: true,
      },
    });

    return NextResponse.json({ conversacion: conv }, { status: 201 });
  } catch (err) {
    return handleError(err);
  }
}
