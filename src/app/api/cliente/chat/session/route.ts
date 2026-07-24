import { NextResponse } from "next/server";
import { requireClienteSession } from "@/lib/cliente-app/auth";
import {
  obtenerOCrearSesionChat,
  serializeConversacion,
  listarMensajesChat,
  serializeMensaje,
} from "@/lib/cliente-app/chat";

export async function GET(request: Request) {
  try {
    const session = await requireClienteSession(request);
    const conv = await obtenerOCrearSesionChat(session);
    const mensajes = await listarMensajesChat(session.clienteId, conv.id);
    return NextResponse.json({
      conversacion: serializeConversacion(conv),
      mensajes: (mensajes ?? []).map(serializeMensaje),
    });
  } catch (err) {
    if (err instanceof Error && err.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }
    console.error("[cliente/chat/session]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  return GET(request);
}
