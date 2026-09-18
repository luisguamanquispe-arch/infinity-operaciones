import { NextResponse } from "next/server";
import { requireTecnicoEnTicket } from "@/lib/inventario-campo/auth";
import { inventarioFail } from "@/lib/inventario-campo/http";
import { confirmarRecepcion } from "@/lib/inventario-campo/servicio";
import { prisma } from "@/lib/prisma";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const del = await prisma.materialDelivery.findUnique({
      where: { id },
      select: { ticketId: true },
    });
    if (!del) {
      return NextResponse.json({ error: "Entrega no encontrada." }, { status: 404 });
    }
    const auth = await requireTecnicoEnTicket(del.ticketId);
    if (!auth.ok) return auth.response;
    const body = await request.json().catch(() => ({}));
    const updated = await confirmarRecepcion({
      deliveryId: id,
      tecnicoId: auth.tecnicoId,
      notes: body.notes,
      differenceReported: Boolean(body.differenceReported),
    });
    return NextResponse.json({ delivery: updated });
  } catch (err) {
    return inventarioFail(err);
  }
}
