import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOpsVehiculo } from "@/lib/parque-automotor/auth";
import { parqueFail } from "@/lib/parque-automotor/http";
import { generarPdfActaVehiculo } from "@/lib/parque-automotor/pdf";

function htmlSinActa(vehiculoId: string) {
  return new NextResponse(
    `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"/><title>Sin acta</title></head><body style="font-family:sans-serif;padding:24px;line-height:1.5">
<p>Este vehículo no tiene acta de entrega ni de recepción.</p>
<p>El PDF se genera al <strong>entregar</strong> (asignar) o <strong>recibir</strong> el vehículo en la hoja de vida.</p>
<p><a href="/supervisor/parque-automotor/vehiculos/${vehiculoId}">Volver a la hoja de vida</a></p>
</body></html>`,
    {
      status: 404,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    }
  );
}

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
    const acta = await prisma.actaVehiculo.findFirst({
      where: actaId ? { id: actaId, vehiculoId: id } : { vehiculoId: id },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    });
    if (!acta) return htmlSinActa(id);
    const { buffer, filename } = await generarPdfActaVehiculo(acta.id);
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${filename}"`,
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (/acta/i.test(msg) && /no (hay|encontrad)/i.test(msg)) {
      return htmlSinActa(id);
    }
    return parqueFail(err);
  }
}
