import { NextResponse } from "next/server";
import { requireConciliar } from "@/lib/inventario-campo/auth";
import { inventarioFail } from "@/lib/inventario-campo/http";
import { conciliarSolicitud } from "@/lib/inventario-campo/servicio";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireConciliar();
  if (!auth.ok) return auth.response;
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const rec = await conciliarSolicitud({
      requestId: id,
      reconciledById: auth.session.id,
      exceptionAuthorized: Boolean(body.exceptionAuthorized),
      exceptionReason: body.exceptionReason,
      notes: body.notes,
    });
    return NextResponse.json({ reconciliation: rec }, { status: 201 });
  } catch (err) {
    return inventarioFail(err);
  }
}
