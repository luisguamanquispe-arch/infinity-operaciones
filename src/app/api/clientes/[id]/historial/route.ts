import { NextResponse } from "next/server";
import { getFullSession } from "@/lib/auth";
import { CAMPOS_CLIENTE_LABELS, obtenerHistorialCliente } from "@/lib/cliente-crud";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getFullSession();
  if (!session || !["SUPERVISOR", "ADMIN"].includes(session.rol)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await params;
  const items = await obtenerHistorialCliente(id);

  return NextResponse.json({
    historial: items.map((h) => ({
      id: h.id,
      accion: h.accion,
      createdAt: h.createdAt,
      usuario: h.usuario,
      cambios: JSON.parse(h.cambiosJson) as Array<{
        campo: string;
        anterior: string | null;
        nuevo: string | null;
      }>,
      labels: CAMPOS_CLIENTE_LABELS,
    })),
  });
}
