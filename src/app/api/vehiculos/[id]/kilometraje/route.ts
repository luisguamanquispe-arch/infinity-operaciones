import { NextResponse } from "next/server";
import { requireOpsVehiculo } from "@/lib/parque-automotor/auth";
import { parqueFail } from "@/lib/parque-automotor/http";
import { consultarRegularizacionKm, registrarKm } from "@/lib/parque-automotor/servicio";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireOpsVehiculo();
  if (!auth.ok) return auth.response;
  try {
    const { id } = await params;
    const url = new URL(request.url);
    const data = await consultarRegularizacionKm({
      vehiculoId: id,
      desde: url.searchParams.get("desde") || "",
      hasta: url.searchParams.get("hasta") || "",
    });
    return NextResponse.json(data);
  } catch (err) {
    return parqueFail(err);
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireOpsVehiculo();
  if (!auth.ok) return auth.response;
  try {
    const { id } = await params;
    const body = await request.json();
    const lectura = await registrarKm({
      vehiculoId: id,
      usuarioId: auth.session.id,
      kilometraje: Number(body.kilometraje),
      origen: body.origen ?? "MANUAL",
      observacion: body.observacion,
    });
    return NextResponse.json({ lectura }, { status: 201 });
  } catch (err) {
    return parqueFail(err);
  }
}
