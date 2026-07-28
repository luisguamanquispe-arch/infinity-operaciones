import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { activarTecnicosRegistrados } from "@/lib/bootstrap-tecnico";

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

    const result = await activarTecnicosRegistrados(prisma);
    const activos = await prisma.tecnico.count({
      where: { usuario: { activo: true } },
    });

    const tecnicos = await prisma.tecnico.findMany({
      where: { usuario: { activo: true } },
      include: { usuario: { select: { email: true, nombre: true, activo: true } } },
      orderBy: { usuario: { nombre: "asc" } },
    });

    return NextResponse.json({
      ok: true,
      message:
        result.total === 0
          ? "No hay técnicos registrados. Créelos en /gerencia/tecnicos/nuevo"
          : "Técnicos activados para la app de campo",
      activos,
      activados: result.activados,
      perfilesReparados: result.reparados,
      tecnicos: tecnicos.map((t) => ({
        nombre: t.usuario.nombre,
        email: t.usuario.email,
        estado: t.estadoActual,
      })),
      app: "https://infinity-operaciones-b3ij.onrender.com/login?app=tecnico",
    });
  } catch (err) {
    console.error("[Setup activar-tecnicos]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error al activar técnicos" },
      { status: 500 }
    );
  }
}
