import { NextResponse } from "next/server";
import { requireOpsVehiculo } from "@/lib/parque-automotor/auth";
import { parqueFail } from "@/lib/parque-automotor/http";
import { actualizarVehiculo, hojaDeVida, ticketsDeAsignacion } from "@/lib/parque-automotor/servicio";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireOpsVehiculo();
  if (!auth.ok) return auth.response;
  try {
    const { id } = await params;
    const [ficha, tickets] = await Promise.all([hojaDeVida(id), ticketsDeAsignacion(id)]);
    return NextResponse.json({ ...ficha, ticketsAtendidos: tickets.tickets });
  } catch (err) {
    return parqueFail(err);
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireOpsVehiculo();
  if (!auth.ok) return auth.response;
  try {
    const { id } = await params;
    const body = await request.json();
    const vehiculo = await actualizarVehiculo(id, body, auth.session.id);
    return NextResponse.json({ vehiculo });
  } catch (err) {
    return parqueFail(err);
  }
}
