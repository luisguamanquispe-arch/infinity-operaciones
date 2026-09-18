import { NextResponse } from "next/server";
import { requireOpsInventarioView } from "@/lib/inventario-campo/auth";
import { inventarioFail } from "@/lib/inventario-campo/http";
import { dashboardInventario } from "@/lib/inventario-campo/servicio";

export async function GET() {
  const auth = await requireOpsInventarioView();
  if (!auth.ok) return auth.response;
  try {
    const data = await dashboardInventario();
    return NextResponse.json(data);
  } catch (err) {
    return inventarioFail(err);
  }
}
