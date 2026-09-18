import { NextResponse } from "next/server";
import { requireOpsInventarioView } from "@/lib/inventario-campo/auth";
import { inventarioFail } from "@/lib/inventario-campo/http";
import { listarMovimientos } from "@/lib/inventario-campo/servicio";

export async function GET(request: Request) {
  const auth = await requireOpsInventarioView();
  if (!auth.ok) return auth.response;
  try {
    const { searchParams } = new URL(request.url);
    const items = await listarMovimientos({
      inventarioId: searchParams.get("inventarioId") || undefined,
      warehouseId: searchParams.get("warehouseId") || undefined,
      ticketId: searchParams.get("ticketId") || undefined,
      take: Number(searchParams.get("take") || 100),
    });
    return NextResponse.json({ items });
  } catch (err) {
    return inventarioFail(err);
  }
}
