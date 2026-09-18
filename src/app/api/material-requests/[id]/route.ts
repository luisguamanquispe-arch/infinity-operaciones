import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOpsInventarioView } from "@/lib/inventario-campo/auth";
import { inventarioFail } from "@/lib/inventario-campo/http";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireOpsInventarioView();
  if (!auth.ok) return auth.response;
  try {
    const { id } = await params;
    const request = await prisma.materialRequest.findUnique({
      where: { id },
      include: {
        ticket: {
          include: {
            cliente: true,
          },
        },
        tecnico: { include: { usuario: true } },
        warehouse: true,
        items: { include: { inventario: true } },
        deliveries: {
          include: {
            items: { include: { inventario: true, serialAsset: true } },
            deliveredBy: { select: { nombre: true } },
          },
        },
        reconciliations: true,
      },
    });
    if (!request) {
      return NextResponse.json({ error: "No encontrada." }, { status: 404 });
    }
    return NextResponse.json({ request });
  } catch (err) {
    return inventarioFail(err);
  }
}
