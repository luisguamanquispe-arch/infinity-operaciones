import { NextResponse } from "next/server";
import { getFullSession } from "@/lib/auth";
import { puedeGestionarClientes } from "@/lib/cliente-permisos";
import { obtenerHistorialSoportes } from "@/lib/historial-soportes-query";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getFullSession();
  if (!session || !puedeGestionarClientes(session.rol)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await params;
  const data = await obtenerHistorialSoportes(id, new URL(request.url).searchParams);
  if (!data) {
    return NextResponse.json({ error: "Cliente no encontrado" }, { status: 404 });
  }

  return NextResponse.json(data);
}
