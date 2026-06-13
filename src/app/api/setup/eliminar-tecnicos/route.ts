import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { eliminarTecnicosPrueba } from "@/lib/eliminar-tecnicos-db";

function getToken(request: Request): string | null {
  const header = request.headers.get("x-setup-token");
  if (header) return header;
  return new URL(request.url).searchParams.get("token");
}

export async function GET(request: Request) {
  return POST(request);
}

export async function POST(request: Request) {
  try {
    const setupToken = process.env.SETUP_TOKEN;
    const provided = getToken(request);

    if (!setupToken || !provided || provided !== setupToken) {
      return NextResponse.json(
        { error: "Token inválido o SETUP_TOKEN no configurado" },
        { status: 401 }
      );
    }

    const result = await eliminarTecnicosPrueba(prisma);

    return NextResponse.json({
      ok: true,
      message:
        result.total > 0
          ? "Técnicos Carlos Mendoza y/o Juan Pérez eliminados"
          : "No se encontraron esos técnicos",
      ...result,
    });
  } catch (err) {
    console.error("[Setup eliminar-tecnicos]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error al eliminar técnicos" },
      { status: 500 }
    );
  }
}
