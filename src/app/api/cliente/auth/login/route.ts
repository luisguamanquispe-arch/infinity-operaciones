import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import {
  checkLoginRateLimit,
  createClienteAccessToken,
  issueClienteRefreshToken,
  type ClienteSession,
  CLIENTE_AUD,
} from "@/lib/cliente-app/auth";

export async function POST(request: Request) {
  try {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    if (!checkLoginRateLimit(`cliente-login:${ip}`)) {
      return NextResponse.json(
        { error: "Demasiados intentos. Intente más tarde." },
        { status: 429 }
      );
    }

    const body = await request.json();
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body.password === "string" ? body.password : "";

    if (!email || !password) {
      return NextResponse.json({ error: "Email y contraseña requeridos" }, { status: 400 });
    }

    const usuario = await prisma.usuario.findUnique({
      where: { email },
      include: { cuentaCliente: true },
    });

    if (
      !usuario ||
      !usuario.activo ||
      usuario.rol !== "CLIENTE" ||
      !usuario.cuentaCliente
    ) {
      return NextResponse.json({ error: "Credenciales inválidas" }, { status: 401 });
    }

    const valid = await bcrypt.compare(password, usuario.passwordHash);
    if (!valid) {
      return NextResponse.json({ error: "Credenciales inválidas" }, { status: 401 });
    }

    const session: ClienteSession = {
      id: usuario.id,
      email: usuario.email,
      nombre: usuario.nombre,
      rol: "CLIENTE",
      clienteId: usuario.cuentaCliente.clienteId,
      aud: CLIENTE_AUD,
    };

    const [accessToken, refreshToken] = await Promise.all([
      createClienteAccessToken(session),
      issueClienteRefreshToken(usuario.id),
    ]);

    return NextResponse.json({
      accessToken,
      refreshToken,
      expiresIn: 3600,
      tokenType: "Bearer",
      user: {
        id: usuario.id,
        email: usuario.email,
        nombre: usuario.nombre,
        clienteId: usuario.cuentaCliente.clienteId,
      },
    });
  } catch (err) {
    console.error("[cliente/auth/login]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
