import { NextResponse } from "next/server";
import { requireBodegaOrOps } from "@/lib/inventario-campo/auth";
import { inventarioFail } from "@/lib/inventario-campo/http";
import { entregarSolicitud } from "@/lib/inventario-campo/servicio";

export const maxDuration = 60;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireBodegaOrOps();
  if (!auth.ok) return auth.response;
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const delivery = await entregarSolicitud({
      requestId: id,
      deliveredById: auth.session.id,
      notes: body.notes,
      items: body.items,
    });
    return NextResponse.json({ delivery }, { status: 201 });
  } catch (err) {
    return inventarioFail(err);
  }
}
