import { NextResponse } from "next/server";
import { requireOpsVehiculo } from "@/lib/parque-automotor/auth";
import { parqueFail } from "@/lib/parque-automotor/http";
import { anularRegistro } from "@/lib/parque-automotor/servicio";

export async function POST(request: Request) {
  const auth = await requireOpsVehiculo();
  if (!auth.ok) return auth.response;
  try {
    const body = await request.json();
    const rec = await anularRegistro({
      entidad: body.entidad,
      id: body.id,
      usuarioId: auth.session.id,
      motivo: body.motivo ?? "",
    });
    return NextResponse.json({ registro: rec });
  } catch (err) {
    return parqueFail(err);
  }
}
