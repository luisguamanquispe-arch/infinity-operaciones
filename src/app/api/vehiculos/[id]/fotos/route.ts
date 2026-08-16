import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOpsVehiculo } from "@/lib/parque-automotor/auth";
import { parqueFail } from "@/lib/parque-automotor/http";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireOpsVehiculo();
  if (!auth.ok) return auth.response;
  try {
    const { id } = await params;
    const body = await request.json();
    if (!body.image) {
      return NextResponse.json({ error: "Imagen requerida." }, { status: 400 });
    }
    const foto = await prisma.fotoVehiculo.create({
      data: {
        vehiculoId: id,
        url: `/api/media/vehiculos/${id}/${Date.now()}.jpg`,
        imagenData: body.image,
      },
    });
    return NextResponse.json({ foto }, { status: 201 });
  } catch (err) {
    return parqueFail(err);
  }
}
