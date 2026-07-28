import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { Rol } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { BOOTSTRAP_TECNICO, ensureBootstrapTecnico } from "@/lib/bootstrap-tecnico";

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
    const forceReset =
      new URL(request.url).searchParams.get("force") === "reset-passwords";
    const ensureTecnico =
      new URL(request.url).searchParams.get("ensure-tecnico") === "1" ||
      new URL(request.url).searchParams.get("ensure-tecnico") === "true";

    if (!setupToken || !provided || provided !== setupToken) {
      return NextResponse.json({ error: "Token inválido o SETUP_TOKEN no configurado" }, { status: 401 });
    }

    const count = await prisma.usuario.count();
    const tecnicosActivos = await prisma.tecnico.count({
      where: { usuario: { activo: true } },
    });

    if (forceReset) {
      const hashSup = await bcrypt.hash("super123", 10);
      const hashAdmin = await bcrypt.hash("admin123", 10);
      const hashHd = await bcrypt.hash("helpdesk123", 10);
      const updates = [
        { email: "admin@infinity.ec", passwordHash: hashAdmin, nombre: "Gerencia Infinity", rol: Rol.ADMIN },
        { email: "supervisor@infinity.ec", passwordHash: hashSup, nombre: "Ana Supervisor", rol: Rol.SUPERVISOR },
        { email: "helpdesk@infinity.ec", passwordHash: hashHd, nombre: "Carlos Help Desk", rol: Rol.HELP_DESK },
      ];
      const result: string[] = [];
      for (const u of updates) {
        await prisma.usuario.upsert({
          where: { email: u.email },
          create: {
            email: u.email,
            passwordHash: u.passwordHash,
            nombre: u.nombre,
            rol: u.rol,
            activo: true,
          },
          update: {
            passwordHash: u.passwordHash,
            activo: true,
            rol: u.rol,
          },
        });
        result.push(u.email);
      }
      const tecnico =
        tecnicosActivos === 0 ? await ensureBootstrapTecnico(prisma) : { skipped: true as const };
      return NextResponse.json({
        ok: true,
        message: "Contraseñas bootstrap restablecidas",
        users: result,
        passwords: {
          "admin@infinity.ec": "admin123",
          "supervisor@infinity.ec": "super123",
          "helpdesk@infinity.ec": "helpdesk123",
        },
        tecnicoDemo:
          tecnico.skipped || !("email" in tecnico)
            ? undefined
            : { email: tecnico.email, password: tecnico.password },
      });
    }

    if (ensureTecnico || tecnicosActivos === 0) {
      const tecnico = await ensureBootstrapTecnico(prisma);
      if (tecnico.skipped) {
        return NextResponse.json({
          ok: true,
          message: "Ya hay técnicos activos en la base",
          tecnicosActivos: tecnico.count,
        });
      }
      return NextResponse.json({
        ok: true,
        message: tecnico.created
          ? "Técnico demo creado para la app de campo"
          : "Técnico demo reparado (perfil + contraseña)",
        tecnico: {
          email: tecnico.email,
          password: tecnico.password,
          app: `${process.env.NEXT_PUBLIC_APP_ORIGIN || "https://infinity-operaciones-b3ij.onrender.com"}/login?app=tecnico`,
        },
        nota: "Registre técnicos reales en /gerencia/tecnicos/nuevo y cambie esta clave en /gerencia/usuarios",
      });
    }

    if (count > 0 && !forceReset) {
      const users = await prisma.usuario.findMany({
        select: { email: true, rol: true, activo: true },
        take: 20,
      });
      const bootstrap = ["admin@infinity.ec", "supervisor@infinity.ec", "helpdesk@infinity.ec"];
      const missing = bootstrap.filter((e) => !users.some((u) => u.email === e));
      if (missing.length === 0) {
        return NextResponse.json({
          ok: false,
          message:
            "La base ya tiene usuarios. Si no puede entrar, use ?force=reset-passwords con el mismo token para restablecer claves de admin/supervisor/helpdesk. Si la app de técnicos falla, use ?ensure-tecnico=1 para crear/reparar el técnico demo.",
          count,
          tecnicosActivos,
          users,
          bootstrapTecnico: BOOTSTRAP_TECNICO.email,
        });
      }
      // Crear solo los bootstrap faltantes
      const hashSup = await bcrypt.hash("super123", 10);
      const hashAdmin = await bcrypt.hash("admin123", 10);
      const hashHd = await bcrypt.hash("helpdesk123", 10);
      const created: string[] = [];
      if (missing.includes("admin@infinity.ec")) {
        await prisma.usuario.create({
          data: {
            email: "admin@infinity.ec",
            passwordHash: hashAdmin,
            nombre: "Gerencia Infinity",
            rol: Rol.ADMIN,
          },
        });
        created.push("admin@infinity.ec");
      }
      if (missing.includes("supervisor@infinity.ec")) {
        await prisma.usuario.create({
          data: {
            email: "supervisor@infinity.ec",
            passwordHash: hashSup,
            nombre: "Ana Supervisor",
            rol: Rol.SUPERVISOR,
          },
        });
        created.push("supervisor@infinity.ec");
      }
      if (missing.includes("helpdesk@infinity.ec")) {
        await prisma.usuario.create({
          data: {
            email: "helpdesk@infinity.ec",
            passwordHash: hashHd,
            nombre: "Carlos Help Desk",
            rol: Rol.HELP_DESK,
          },
        });
        created.push("helpdesk@infinity.ec");
      }
      return NextResponse.json({
        ok: true,
        message: "Usuarios bootstrap faltantes creados",
        created,
        passwords: {
          "admin@infinity.ec": "admin123",
          "supervisor@infinity.ec": "super123",
          "helpdesk@infinity.ec": "helpdesk123",
        },
      });
    }

    await createBootstrapUsers();
    const tecnico = await ensureBootstrapTecnico(prisma);

    return NextResponse.json({
      ok: true,
      message: "Usuarios creados. Cambia las contraseñas en /gerencia/usuarios",
      users: [
        { email: "supervisor@infinity.ec", password: "super123", rol: "SUPERVISOR" },
        { email: "admin@infinity.ec", password: "admin123", rol: "ADMIN" },
        { email: "helpdesk@infinity.ec", password: "helpdesk123", rol: "HELP_DESK" },
      ],
      tecnicoDemo: tecnico.skipped
        ? undefined
        : { email: tecnico.email, password: tecnico.password, rol: "TECNICO" },
    });
  } catch (err) {
    console.error("[Setup seed]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error al crear usuarios" },
      { status: 500 }
    );
  }
}
