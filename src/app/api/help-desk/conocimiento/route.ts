import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { HelpDeskAuthError, requireHelpDeskSession } from "@/lib/help-desk/auth";
import { seedConocimientoHelpDesk } from "@/lib/help-desk/conocimiento-seed";

export async function GET(request: Request) {
  try {
    await requireHelpDeskSession();
    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q")?.trim();
    const marca = searchParams.get("marca");
    const categoria = searchParams.get("categoria");

    const items = await prisma.hdArticuloConocimiento.findMany({
      where: {
        activo: true,
        ...(marca ? { marca } : {}),
        ...(categoria ? { categoria } : {}),
        ...(q
          ? {
              OR: [
                { titulo: { contains: q, mode: "insensitive" } },
                { contenido: { contains: q, mode: "insensitive" } },
                { tags: { contains: q, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      orderBy: { titulo: "asc" },
      take: 50,
    });

    return NextResponse.json({ items });
  } catch (err) {
    if (err instanceof HelpDeskAuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function POST() {
  try {
    await requireHelpDeskSession();
    const result = await seedConocimientoHelpDesk();
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof HelpDeskAuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
