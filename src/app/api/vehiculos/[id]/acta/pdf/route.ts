import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOpsVehiculo } from "@/lib/parque-automotor/auth";
import { parqueFail } from "@/lib/parque-automotor/http";
import { generarPdfActaVehiculo } from "@/lib/parque-automotor/pdf";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireOpsVehiculo();
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const actaId = searchParams.get("actaId");
  try {
    let target = actaId;
    if (!target) {
      const last = await prisma.actaVehiculo.findFirst({
        where: { vehiculoId: id },
        orderBy: { createdAt: "desc" },
        select: { id: true },
      });
      target = last?.id ?? null;
    }
    if (!target) {
      return NextResponse.json({ error: "No hay acta." }, { status: 404 });
    }
    const { buffer, filename } = await generarPdfActaVehiculo(target);
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${filename}"`,
      },
    });
  } catch (err) {
    return parqueFail(err);
  }
}
