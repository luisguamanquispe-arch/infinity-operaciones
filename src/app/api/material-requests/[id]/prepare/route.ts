import { NextResponse } from "next/server";
import { requireBodegaOrOps } from "@/lib/inventario-campo/auth";
import { inventarioFail } from "@/lib/inventario-campo/http";
import { prepararSolicitud } from "@/lib/inventario-campo/servicio";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireBodegaOrOps();
  if (!auth.ok) return auth.response;
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const req = await prepararSolicitud({
      requestId: id,
      preparedById: auth.session.id,
      notes: body.notes ?? null,
    });
    return NextResponse.json({ request: req });
  } catch (err) {
    return inventarioFail(err);
  }
}
