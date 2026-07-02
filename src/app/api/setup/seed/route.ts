import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { Rol } from "@prisma/client";
import { prisma } from "@/lib/prisma";

async function createBootstrapUsers() {
  const hashSup = await bcrypt.hash("super123", 10);
  const hashAdmin = await bcrypt.hash("admin123", 10);
  const hashHd = await bcrypt.hash("helpdesk123", 10);

  await prisma.usuario.create({
    data: {
      email: "supervisor@infinity.ec",
      passwordHash: hashSup,
      nombre: "Ana Supervisor",
      rol: Rol.SUPERVISOR,
    },
  });

  await prisma.usuario.create({
    data: {
      email: "admin@infinity.ec",
      passwordHash: hashAdmin,
      nombre: "Gerencia Infinity",
      rol: Rol.ADMIN,
    },
  });

  await prisma.usuario.create({
    data: {
      email: "helpdesk@infinity.ec",
      passwordHash: hashHd,
      nombre: "Carlos Help Desk",
      rol: Rol.HELP_DESK,
    },
  });
}

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
      return NextResponse.json({ error: "Token inválido o SETUP_TOKEN no configurado" }, { status: 401 });
    }

    const count = await prisma.usuario.count();
    if (count > 0) {
      const users = await prisma.usuario.findMany({
        select: { email: true, rol: true },
        take: 10,
      });
      return NextResponse.json({
        ok: false,
        message: "La base de datos ya tiene usuarios",
        count,
        users,
      });
    }

    await createBootstrapUsers();

    return NextResponse.json({
      ok: true,
      message: "Usuarios creados. Cambia las contraseñas en /gerencia/usuarios",
      users: [
        { email: "supervisor@infinity.ec", password: "super123", rol: "SUPERVISOR" },
        { email: "admin@infinity.ec", password: "admin123", rol: "ADMIN" },
        { email: "helpdesk@infinity.ec", password: "helpdesk123", rol: "HELP_DESK" },
      ],
    });
  } catch (err) {
    console.error("[Setup seed]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error al crear usuarios" },
      { status: 500 }
    );
  }
}
