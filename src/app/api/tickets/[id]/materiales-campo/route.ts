import { NextResponse } from "next/server";
import { requireTecnicoEnTicket } from "@/lib/inventario-campo/auth";
import { inventarioFail } from "@/lib/inventario-campo/http";
import { materialesDeTicket, reportarDano, reportarUsoEntrega } from "@/lib/inventario-campo/servicio";
import { getFullSession } from "@/lib/auth";
import { puedeOperarBodega, puedeSolicitarMaterial } from "@/lib/inventario-campo/reglas";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await getFullSession();
    if (!session) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }
    if (session.rol === "TECNICO") {
      const auth = await requireTecnicoEnTicket(id);
      if (!auth.ok) return auth.response;
    } else if (
      !puedeSolicitarMaterial(session.rol) &&
      !puedeOperarBodega(session.rol)
    ) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }
    const data = await materialesDeTicket(id);
    return NextResponse.json(data);
  } catch (err) {
    return inventarioFail(err);
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const auth = await requireTecnicoEnTicket(id);
    if (!auth.ok) return auth.response;
    const body = await request.json();
    if (body.accion === "uso") {
      const delivery = await reportarUsoEntrega({
        deliveryId: body.deliveryId,
        tecnicoId: auth.tecnicoId,
        ticketId: id,
        items: body.items || [],
      });
      return NextResponse.json({ delivery });
    }
    if (body.accion === "dano") {
      const report = await reportarDano({
        ticketId: id,
        tecnicoId: auth.tecnicoId,
        inventarioId: body.inventarioId,
        quantity: Number(body.quantity),
        reason: body.reason || "Dañado en campo",
        description: body.description,
        deliveryId: body.deliveryId,
        deliveryItemId: body.deliveryItemId,
        photoData: body.photoData,
      });
      return NextResponse.json({ report }, { status: 201 });
    }
    return NextResponse.json({ error: "Acción inválida." }, { status: 400 });
  } catch (err) {
    return inventarioFail(err);
  }
}
