import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { Rol } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireSetupToken } from "@/lib/setup-token";

const DEFAULT_EMAIL = "helpdesk@infinity.ec";
const DEFAULT_NOMBRE = "Carlos Help Desk";
const DEFAULT_PASSWORD = "helpdesk123";

/**
 * Crea o restablece el usuario Help Desk en producción (idempotente).
 * GET/POST con ?token=SETUP_TOKEN o header x-setup-token
 */
export async function GET(request: Request) {
  return POST(request);
}

export async function POST(request: Request) {
  try {
    const auth = requireSetupToken(request);
    if (!auth.ok) {
      return NextResponse.json(
        {
          error: auth.error,
          receivedLength: auth.receivedLength,
          configuredLength: auth.configuredLength,
        },
        { status: auth.status }
      );
    }

    const body = await request.json().catch(() => ({}));
    const email = (body.email || DEFAULT_EMAIL).trim().toLowerCase();
    const nombre = (body.nombre || DEFAULT_NOMBRE).trim();
    const password = body.password || DEFAULT_PASSWORD;

    if (password.length < 6) {
      return NextResponse.json({ error: "Contraseña mínimo 6 caracteres" }, { status: 400 });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const existente = await prisma.usuario.findUnique({ where: { email } });

    if (existente) {
      const usuario = await prisma.usuario.update({
        where: { email },
        data: {
          passwordHash,
          nombre,
          rol: Rol.HELP_DESK,
          activo: true,
        },
      });
      return NextResponse.json({
        ok: true,
        action: "updated",
        message: "Usuario Help Desk actualizado",
        usuario: { email: usuario.email, nombre: usuario.nombre, rol: usuario.rol },
      });
    }

    const usuario = await prisma.usuario.create({
      data: {
        email,
        nombre,
        passwordHash,
        rol: Rol.HELP_DESK,
      },
    });

    return NextResponse.json({
      ok: true,
      action: "created",
      message: "Usuario Help Desk creado",
      usuario: { email: usuario.email, nombre: usuario.nombre, rol: usuario.rol },
      login: { email, password },
    });
  } catch (err) {
    console.error("[Setup help-desk-usuario]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error al crear usuario Help Desk" },
      { status: 500 }
    );
  }
}
