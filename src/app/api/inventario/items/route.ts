import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCatalogoAdmin, requireOpsInventarioView } from "@/lib/inventario-campo/auth";
import { inventarioFail } from "@/lib/inventario-campo/http";
import {
  asegurarBodegaCentral,
  sincronizarStockDesdeLegacy,
} from "@/lib/inventario-campo/servicio";

export async function GET() {
  const auth = await requireOpsInventarioView();
  if (!auth.ok) return auth.response;
  try {
    const items = await prisma.inventario.findMany({
      orderBy: { nombre: "asc" },
      include: { category: true },
    });
    return NextResponse.json({ items });
  } catch (err) {
    return inventarioFail(err);
  }
}

export async function POST(request: Request) {
  const auth = await requireCatalogoAdmin();
  if (!auth.ok) return auth.response;
  try {
    const body = await request.json();
    if (!body.nombre?.trim()) {
      return NextResponse.json({ error: "Nombre obligatorio." }, { status: 400 });
    }
    const item = await prisma.inventario.create({
      data: {
        nombre: String(body.nombre).trim(),
        unidad: body.unidad || "unidad",
        tipo: body.tipo || "CONSUMIBLE",
        stock: Number(body.stock ?? 0),
        stockMin: Number(body.stockMin ?? 5),
        code: body.code || null,
        unitCost: Number(body.unitCost ?? 0),
        isSerialized: Boolean(body.isSerialized),
        isActive: body.isActive !== false,
        categoryId: body.categoryId || null,
      },
    });
    const wh = await asegurarBodegaCentral();
    await prisma.warehouseStock.create({
      data: {
        warehouseId: wh.id,
        inventarioId: item.id,
        physicalQty: item.stock,
      },
    });
    return NextResponse.json({ item }, { status: 201 });
  } catch (err) {
    return inventarioFail(err);
  }
}

export async function PUT(request: Request) {
  const auth = await requireOpsInventarioView();
  if (!auth.ok) return auth.response;
  try {
    const wh = await asegurarBodegaCentral();
    await sincronizarStockDesdeLegacy(wh.id);
    return NextResponse.json({ ok: true, warehouseId: wh.id });
  } catch (err) {
    return inventarioFail(err);
  }
}
