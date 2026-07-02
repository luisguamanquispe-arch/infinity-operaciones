import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { HelpDeskAuthError, requireHelpDeskSession } from "@/lib/help-desk/auth";
import { contextoClienteHelpDesk } from "@/lib/help-desk/cliente-contexto";

function handleError(err: unknown) {
  if (err instanceof HelpDeskAuthError) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  return NextResponse.json({ error: "Error interno" }, { status: 500 });
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireHelpDeskSession();
    const { id } = await params;

    const conversacion = await prisma.hdConversacion.findUnique({
      where: { id },
      include: {
        cliente: true,
        asignadoA: { select: { id: true, nombre: true, email: true } },
        mensajes: { orderBy: { createdAt: "asc" } },
        acciones: { orderBy: { createdAt: "desc" }, take: 20 },
        sugerencias: { orderBy: { createdAt: "desc" }, take: 10, select: { contenido: true, tipo: true, metadataJson: true } },
        escalamiento: true,
        ticket: { select: { id: true, codigo: true, estado: true } },
      },
    });

    if (!conversacion) {
      return NextResponse.json({ error: "No encontrada" }, { status: 404 });
    }

    const contexto = await contextoClienteHelpDesk(
      conversacion.clienteId,
      conversacion.prospectoTelefono
    );

    return NextResponse.json({ conversacion, contexto });
  } catch (err) {
    return handleError(err);
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireHelpDeskSession();
    const { id } = await params;
    const body = await request.json();

    const data: Record<string, unknown> = {};
    if (body.estado) data.estado = body.estado;
    if (body.asignadoAId !== undefined) data.asignadoAId = body.asignadoAId;
    if (body.satisfaccion != null) data.satisfaccion = body.satisfaccion;
    if (body.estado === "RESUELTO" || body.estado === "CERRADO") {
      data.cerradoEn = new Date();
    }

    if (body.estado === "EN_ATENCION" && session.rol === "HELP_DESK") {
      data.asignadoAId = session.id;
    }

    const conversacion = await prisma.hdConversacion.update({
      where: { id },
      data,
    });

    return NextResponse.json({ conversacion });
  } catch (err) {
    return handleError(err);
  }
}
