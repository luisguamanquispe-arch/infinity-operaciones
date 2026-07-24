import { NextResponse } from "next/server";
import { requireClienteSession } from "@/lib/cliente-app/auth";
import { getClienteWithService, serializeDashboard } from "@/lib/cliente-app/service";

export async function GET(request: Request) {
  try {
    const session = await requireClienteSession(request);
    const data = await getClienteWithService(session.clienteId);
    if (!data) {
      return NextResponse.json({ error: "Cliente no encontrado" }, { status: 404 });
    }
    return NextResponse.json({
      dashboard: await serializeDashboard(data.cliente, data.service),
    });
  } catch (err) {
    if (err instanceof Error && err.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }
    console.error("[cliente/dashboard]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
