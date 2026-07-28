import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword, normalizeEmail, normalizePassword } from "@/lib/password";
import { enMayusculasGuardar } from "@/lib/mayusculas";

function getToken(request: Request): string | null {
  const header = request.headers.get("x-setup-token");
  if (header) return header;
  return new URL(request.url).searchParams.get("token");
}

type TecnicoClave = {
  email: string;
  password: string;
  nombre?: string;
};

/** Lista operativa Infinity — acceso app técnicos. */
const TECNICOS_OPERATIVOS: TecnicoClave[] = [
  { email: "david@infinity.ec", password: "David2026@", nombre: "DAVID" },
  { email: "johan@infinity.ec", password: "Johan2026@", nombre: "JOHAN" },
  { email: "kevin@infinity.ec", password: "Kevin2026@", nombre: "KEVIN" },
  { email: "dario@infinity.ec", password: "Dario2026@", nombre: "DARIO" },
  { email: "sergio@infinity.ec", password: "Sergio2026@", nombre: "SERGIO" },
];

async function upsertTecnicoClave(item: TecnicoClave) {
  const email = normalizeEmail(item.email);
  const password = normalizePassword(item.password);
  const nombre = enMayusculasGuardar(item.nombre || email.split("@")[0] || "TECNICO");
  const passwordHash = await hashPassword(password);

  const existente = await prisma.usuario.findUnique({
    where: { email },
    include: { tecnico: true },
  });

  if (existente) {
    await prisma.usuario.update({
      where: { id: existente.id },
      data: {
        passwordHash,
        activo: true,
        rol: "TECNICO",
        nombre: existente.nombre?.trim() ? existente.nombre : nombre,
      },
    });
    if (!existente.tecnico) {
      await prisma.tecnico.create({
        data: { usuarioId: existente.id, estadoActual: "DISPONIBLE" },
      });
    }
    return { email, action: "updated" as const };
  }

  await prisma.usuario.create({
    data: {
      email,
      passwordHash,
      nombre,
      rol: "TECNICO",
      activo: true,
      tecnico: { create: { estadoActual: "DISPONIBLE" } },
    },
  });
  return { email, action: "created" as const };
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

    let lista = TECNICOS_OPERATIVOS;
    try {
      const body = await request.json();
      if (Array.isArray(body?.tecnicos) && body.tecnicos.length > 0) {
        lista = body.tecnicos;
      }
    } catch {
      /* body vacío: usa lista operativa */
    }

    const results = [];
    for (const item of lista) {
      if (!item?.email || !item?.password) continue;
      results.push(await upsertTecnicoClave(item));
    }

    return NextResponse.json({
      ok: true,
      message: "Claves de técnicos aplicadas. Ya pueden entrar a la app de campo.",
      results,
      app: "https://infinity-operaciones-b3ij.onrender.com/login?app=tecnico",
    });
  } catch (err) {
    console.error("[Setup tecnicos-claves]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error al aplicar claves" },
      { status: 500 }
    );
  }
}
