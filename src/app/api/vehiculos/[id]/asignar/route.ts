import { NextResponse } from "next/server";
import { requireOpsVehiculo } from "@/lib/parque-automotor/auth";
import { parqueFail } from "@/lib/parque-automotor/http";
import { asignarVehiculo } from "@/lib/parque-automotor/servicio";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireOpsVehiculo();
  if (!auth.ok) return auth.response;
  try {
    const { id } = await params;
    const body = await request.json();
    if (!body.tecnicoId) {
      return NextResponse.json({ error: "Técnico obligatorio." }, { status: 400 });
    }
    const result = await asignarVehiculo({
      vehiculoId: id,
      tecnicoId: body.tecnicoId,
      usuarioId: auth.session.id,
      kilometrajeEntrega: Number(body.kilometrajeEntrega),
      combustibleEntrega: Number(body.combustibleEntrega ?? 0),
      observaciones: body.observaciones,
      checklist: body.checklist,
      firmaTecnico: body.firmaTecnico,
      firmaAdmin: body.firmaAdmin,
    });
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    return parqueFail(err);
  }
}
