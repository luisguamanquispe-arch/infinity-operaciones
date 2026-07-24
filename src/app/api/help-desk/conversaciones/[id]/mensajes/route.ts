import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { HelpDeskAuthError, requireHelpDeskSession } from "@/lib/help-desk/auth";
import { generarSugerenciasIa } from "@/lib/help-desk/ia-copiloto";
import { onMensajeAgenteParaCliente } from "@/lib/cliente-app/chat";

function handleError(err: unknown) {
  if (err instanceof HelpDeskAuthError) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  return NextResponse.json({ error: "Error interno" }, { status: 500 });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireHelpDeskSession();
    const { id } = await params;
    const { contenido, autor } = await request.json();

    if (!contenido?.trim()) {
      return NextResponse.json({ error: "Mensaje vacío" }, { status: 400 });
    }

    const esCliente = autor === "CLIENTE";
    const mensaje = await prisma.hdMensaje.create({
      data: {
        conversacionId: id,
        autor: esCliente ? "CLIENTE" : "AGENTE",
        usuarioId: esCliente ? null : session.id,
        contenido: contenido.trim(),
      },
    });

    await prisma.hdConversacion.update({
      where: { id },
      data: {
        updatedAt: new Date(),
        ...(esCliente
          ? {}
          : { estado: "EN_ESPERA_CLIENTE" as const, asignadoAId: session.id }),
      },
    });

    if (!esCliente) {
      void onMensajeAgenteParaCliente(id, contenido.trim());
    }

    const mensajes = await prisma.hdMensaje.findMany({
      where: { conversacionId: id },
      orderBy: { createdAt: "asc" },
      select: { autor: true, contenido: true },
    });

    const sugerencias = await generarSugerenciasIa(id, mensajes);

    return NextResponse.json({ mensaje, sugerencias });
  } catch (err) {
    return handleError(err);
  }
}
