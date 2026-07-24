import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireClienteSession } from "@/lib/cliente-app/auth";
import { serializeProfile } from "@/lib/cliente-app/service";

export async function GET(request: Request) {
  try {
    const session = await requireClienteSession(request);
    const cliente = await prisma.cliente.findUnique({ where: { id: session.clienteId } });
    if (!cliente) {
      return NextResponse.json({ error: "Cliente no encontrado" }, { status: 404 });
    }
    return NextResponse.json({ profile: serializeProfile(session, cliente) });
  } catch (err) {
    if (err instanceof Error && err.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }
    console.error("[cliente/profile]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
