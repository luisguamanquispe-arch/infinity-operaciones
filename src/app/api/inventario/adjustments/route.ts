import { NextResponse } from "next/server";
import { requireAjusteAdmin } from "@/lib/inventario-campo/auth";
import { inventarioFail } from "@/lib/inventario-campo/http";
import { ajustarStock } from "@/lib/inventario-campo/servicio";

export async function POST(request: Request) {
  const auth = await requireAjusteAdmin();
  if (!auth.ok) return auth.response;
  try {
    const body = await request.json();
    const mov = await ajustarStock({
      warehouseId: body.warehouseId,
      inventarioId: body.inventarioId,
      quantity: Number(body.quantity),
      tipo: body.tipo === "ADJUSTMENT_OUT" ? "ADJUSTMENT_OUT" : "ADJUSTMENT_IN",
      performedById: auth.session.id,
      notes: body.notes,
    });
    return NextResponse.json({ movement: mov }, { status: 201 });
  } catch (err) {
    return inventarioFail(err);
  }
}
