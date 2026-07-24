import { NextResponse } from "next/server";
import { requireClienteSession } from "@/lib/cliente-app/auth";
import {
  enviarMensajeCliente,
  listarMensajesChat,
  serializeMensaje,
} from "@/lib/cliente-app/chat";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireClienteSession(request);
    const { id } = await params;
    const url = new URL(request.url);
    const after = url.searchParams.get("after");
    const mensajes = await listarMensajesChat(session.clienteId, id, after);
    if (!mensajes) {
      return NextResponse.json({ error: "Conversación no encontrada" }, { status: 404 });
    }
    return NextResponse.json({ mensajes: mensajes.map(serializeMensaje) });
  } catch (err) {
    if (err instanceof Error && err.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }
    console.error("[cliente/chat/messages GET]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireClienteSession(request);
    const { id } = await params;
    const body = await request.json();
    const contenido = typeof body.contenido === "string" ? body.contenido : "";

    const result = await enviarMensajeCliente({
      session,
      conversacionId: id,
      contenido,
    });

    return NextResponse.json(
      { mensajes: result.mensajes.map(serializeMensaje) },
      { status: 201 }
    );
  } catch (err) {
    if (err instanceof Error && err.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }
    const msg = err instanceof Error ? err.message : "Error al enviar";
    console.error("[cliente/chat/messages POST]", err);
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
