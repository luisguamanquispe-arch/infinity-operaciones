import { NextResponse } from "next/server";
import { getFullSession } from "@/lib/auth";
import { puedeGestionarClientes } from "@/lib/cliente-permisos";
import { obtenerDetalleSoporteCliente } from "@/lib/historial-soportes-query";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; ticketId: string }> }
) {
  const session = await getFullSession();
  if (!session || !puedeGestionarClientes(session.rol)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id, ticketId } = await params;
  const data = await obtenerDetalleSoporteCliente(id, ticketId);
  if ("error" in data) {
    return NextResponse.json({ error: data.error }, { status: data.status });
  }

  return NextResponse.json(data);
}
