import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { createToken, setSessionCookie, dashboardPath } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email y contraseña requeridos" },
        { status: 400 }
      );
    }

    const usuario = await prisma.usuario.findUnique({
      where: { email },
      include: { tecnico: true },
    });

    if (!usuario || !usuario.activo) {
      return NextResponse.json({ error: "Credenciales inválidas" }, { status: 401 });
    }

    if (usuario.rol === "CLIENTE") {
      return NextResponse.json(
        { error: "Use la app INFINITY Connect para iniciar sesión" },
        { status: 403 }
      );
    }

    const valid = await bcrypt.compare(password, usuario.passwordHash);
    if (!valid) {
      return NextResponse.json({ error: "Credenciales inválidas" }, { status: 401 });
    }

    const token = await createToken({
      id: usuario.id,
      email: usuario.email,
      nombre: usuario.nombre,
      rol: usuario.rol,
      tecnicoId: usuario.tecnico?.id,
    });

    await setSessionCookie(token);

    return NextResponse.json({
      user: {
        id: usuario.id,
        email: usuario.email,
        nombre: usuario.nombre,
        rol: usuario.rol,
      },
      redirect: dashboardPath(usuario.rol),
    });
  } catch (err) {
    console.error("[Login]", err);
    const message =
      process.env.NODE_ENV === "development" && err instanceof Error
        ? err.message
        : "Error interno";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
