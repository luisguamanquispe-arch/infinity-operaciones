import { NextResponse } from "next/server";
import { requireOpsVehiculo } from "@/lib/parque-automotor/auth";
import { parqueFail } from "@/lib/parque-automotor/http";
import { crearVehiculo, listarVehiculos } from "@/lib/parque-automotor/servicio";
import type { EstadoVehiculo } from "@prisma/client";

export async function GET(request: Request) {
  const auth = await requireOpsVehiculo();
  if (!auth.ok) return auth.response;
  const { searchParams } = new URL(request.url);
  const estado = searchParams.get("estado") as EstadoVehiculo | null;
  const items = await listarVehiculos(estado ? { estado } : undefined);
  return NextResponse.json({ items });
}

export async function POST(request: Request) {
  const auth = await requireOpsVehiculo();
  if (!auth.ok) return auth.response;
  try {
    const body = await request.json();
    const vehiculo = await crearVehiculo(body, auth.session.id);
    return NextResponse.json({ vehiculo }, { status: 201 });
  } catch (err) {
    return parqueFail(err);
  }
}
