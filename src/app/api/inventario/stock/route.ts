import { NextResponse } from "next/server";
import { requireOpsInventarioView } from "@/lib/inventario-campo/auth";
import { inventarioFail } from "@/lib/inventario-campo/http";
import { listarStock } from "@/lib/inventario-campo/servicio";

export async function GET(request: Request) {
  const auth = await requireOpsInventarioView();
  if (!auth.ok) return auth.response;
  try {
    const { searchParams } = new URL(request.url);
    const data = await listarStock(searchParams.get("warehouseId") || undefined);
    return NextResponse.json(data);
  } catch (err) {
    return inventarioFail(err);
  }
}
