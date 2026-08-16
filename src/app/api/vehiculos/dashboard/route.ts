import { NextResponse } from "next/server";
import { dashboardParque } from "@/lib/parque-automotor/servicio";
import { requireOpsVehiculo } from "@/lib/parque-automotor/auth";
import { parqueFail } from "@/lib/parque-automotor/http";

export async function GET() {
  const auth = await requireOpsVehiculo();
  if (!auth.ok) return auth.response;
  try {
    const data = await dashboardParque();
    return NextResponse.json(data);
  } catch (err) {
    return parqueFail(err);
  }
}
