import { NextResponse } from "next/server";
import { requireAprobarMaterial } from "@/lib/inventario-campo/auth";
import { inventarioFail } from "@/lib/inventario-campo/http";
import { aprobarSolicitud } from "@/lib/inventario-campo/servicio";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAprobarMaterial();
  if (!auth.ok) return auth.response;
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const result = await aprobarSolicitud({
      requestId: id,
      approvedById: auth.session.id,
      items: body.items,
      reject: Boolean(body.reject),
      rejectionReason: body.rejectionReason,
    });
    return NextResponse.json({ request: result });
  } catch (err) {
    return inventarioFail(err);
  }
}
