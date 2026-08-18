import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOpsVehiculo } from "@/lib/parque-automotor/auth";
import { parqueFail } from "@/lib/parque-automotor/http";
import { persistVehiculoImage, urlFotoVehiculo } from "@/lib/parque-automotor/media";
import { ParqueError } from "@/lib/parque-automotor/servicio";

export const maxDuration = 60;

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
      data: { vehiculoId: id, url: "pending" },
    });
    let stored;
    try {
      stored = await persistVehiculoImage(id, `fotoveh-${foto.id}.jpg`, body.image);
    } catch (err) {
      await prisma.fotoVehiculo.delete({ where: { id: foto.id } }).catch(() => undefined);
      if (err instanceof Error && "status" in err) {
        throw new ParqueError(err.message, Number((err as { status?: number }).status) || 400);
      }
      throw err;
    }
    const actualizada = await prisma.fotoVehiculo.update({
      where: { id: foto.id },
      data: { url: stored.url, imagenData: stored.imagenData },
    });
    return NextResponse.json(
      {
        foto: {
          id: actualizada.id,
          url: urlFotoVehiculo(id, actualizada.id),
          tomadaEn: actualizada.tomadaEn,
        },
      },
      { status: 201 }
    );
  } catch (err) {
    return parqueFail(err);
  }
}
