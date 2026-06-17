import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { eliminarTicketPorId } from "@/lib/eliminar-ticket";

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

    const body = await request.json().catch(() => ({}));
    const codigos = Array.isArray(body.codigos)
      ? body.codigos.filter((c): c is string => typeof c === "string" && c.trim().length > 0)
      : [];

    if (codigos.length === 0) {
      return NextResponse.json(
        { error: "Indique codigos: { \"codigos\": [\"ST-1002\"] }" },
        { status: 400 }
      );
    }

    const resultados: {
      codigo: string;
      ok: boolean;
      error?: string;
      materialesRestaurados?: number;
    }[] = [];

    for (const codigo of codigos) {
      const ticket = await prisma.ticket.findFirst({ where: { codigo } });
      if (!ticket) {
        resultados.push({ codigo, ok: false, error: "No encontrado" });
        continue;
      }
      try {
        const r = await eliminarTicketPorId(ticket.id);
        resultados.push({
          codigo: r.codigo,
          ok: true,
          materialesRestaurados: r.materialesRestaurados,
        });
      } catch (err) {
        resultados.push({
          codigo,
          ok: false,
          error: err instanceof Error ? err.message : "Error al eliminar",
        });
      }
    }

    return NextResponse.json({
      ok: resultados.every((r) => r.ok),
      resultados,
    });
  } catch (err) {
    console.error("[Setup eliminar-tickets]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error al eliminar tickets" },
      { status: 500 }
    );
  }
}
