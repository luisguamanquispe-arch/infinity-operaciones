import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { activarTecnicosRegistrados } from "@/lib/bootstrap-tecnico";
import { passwordHashLooksValid } from "@/lib/password";

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

    const reparacion = await activarTecnicosRegistrados(prisma);

    const tecnicos = await prisma.usuario.findMany({
      where: { rol: "TECNICO" },
      include: { tecnico: true },
      orderBy: { nombre: "asc" },
    });

    const resumen = tecnicos.map((u) => ({
      email: u.email,
      nombre: u.nombre,
      activo: u.activo,
      tienePerfilTecnico: !!u.tecnico,
      hashValido: passwordHashLooksValid(u.passwordHash),
      puedeIngresarApp: u.activo && !!u.tecnico && passwordHashLooksValid(u.passwordHash),
    }));

    const bloqueados = resumen.filter((t) => !t.puedeIngresarApp);

    return NextResponse.json({
      ok: true,
      message:
        bloqueados.length === 0
          ? "Todos los técnicos pueden ingresar a la app"
          : `${bloqueados.length} técnico(s) requieren restablecer clave o reparación en gerencia`,
      total: resumen.length,
      activados: reparacion.activados,
      perfilesReparados: reparacion.reparados,
      tecnicos: resumen,
      bloqueados,
      app: "https://infinity-operaciones-b3ij.onrender.com/login?app=tecnico",
      accionGerencia: "/gerencia/usuarios",
    });
  } catch (err) {
    console.error("[Setup reparar-tecnicos]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error al reparar técnicos" },
      { status: 500 }
    );
  }
}
