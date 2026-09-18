import { NextResponse } from "next/server";
import { getFullSession } from "@/lib/auth";
import { requireOpsInventarioView, requireTecnicoEnTicket } from "@/lib/inventario-campo/auth";
import { inventarioFail } from "@/lib/inventario-campo/http";
import {
  generarPdfConsumoMateriales,
  generarPdfEntregaMateriales,
} from "@/lib/inventario-campo/pdf";
import { prisma } from "@/lib/prisma";
import { puedeOperarBodega, puedeSolicitarMaterial } from "@/lib/inventario-campo/reglas";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const session = await getFullSession();
    if (!session) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const deliveryId = searchParams.get("deliveryId");
    const requestId = searchParams.get("requestId");

    if (deliveryId) {
      const del = await prisma.materialDelivery.findUnique({
        where: { id: deliveryId },
        select: { ticketId: true, tecnicoId: true },
      });
      if (!del) {
        return NextResponse.json({ error: "Entrega no encontrada." }, { status: 404 });
      }
      if (session.rol === "TECNICO") {
        const auth = await requireTecnicoEnTicket(del.ticketId);
        if (!auth.ok) return auth.response;
        if (auth.tecnicoId !== del.tecnicoId) {
          return NextResponse.json({ error: "No autorizado." }, { status: 403 });
        }
      } else if (
        !puedeSolicitarMaterial(session.rol) &&
        !puedeOperarBodega(session.rol)
      ) {
        return NextResponse.json({ error: "No autorizado" }, { status: 403 });
      }
      const { buffer, filename } = await generarPdfEntregaMateriales(deliveryId);
      return new NextResponse(new Uint8Array(buffer), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `inline; filename="${filename}"`,
        },
      });
    }

    if (requestId) {
      const req = await prisma.materialRequest.findUnique({
        where: { id: requestId },
        select: { ticketId: true, tecnicoId: true },
      });
      if (!req) {
        return NextResponse.json({ error: "Solicitud no encontrada." }, { status: 404 });
      }
      if (session.rol === "TECNICO") {
        const auth = await requireTecnicoEnTicket(req.ticketId);
        if (!auth.ok) return auth.response;
        if (auth.tecnicoId !== req.tecnicoId) {
          return NextResponse.json({ error: "No autorizado." }, { status: 403 });
        }
      } else {
        const ops = await requireOpsInventarioView();
        if (!ops.ok) return ops.response;
      }
      const { buffer, filename } = await generarPdfConsumoMateriales(requestId);
      return new NextResponse(new Uint8Array(buffer), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `inline; filename="${filename}"`,
        },
      });
    }

    return NextResponse.json(
      { error: "Indique deliveryId o requestId." },
      { status: 400 }
    );
  } catch (err) {
    return inventarioFail(err);
  }
}
