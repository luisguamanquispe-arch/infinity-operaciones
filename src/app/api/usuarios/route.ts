import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getFullSession } from "@/lib/auth";
import { hashPassword, normalizeEmail, normalizePassword } from "@/lib/password";

const ROL_LABELS: Record<string, string> = {
  TECNICO: "Técnico",
  SUPERVISOR: "Supervisor",
  ADMIN: "Administrador",
  HELP_DESK: "Help Desk N1",
};

export async function GET() {
  const session = await getFullSession();
  if (!session || session.rol !== "ADMIN") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const usuarios = await prisma.usuario.findMany({
    orderBy: [{ rol: "asc" }, { nombre: "asc" }],
    include: { tecnico: true },
  });

  return NextResponse.json({
    usuarios: usuarios.map((u) => ({
      id: u.id,
      email: u.email,
      nombre: u.nombre,
      rol: u.rol,
      rolLabel: ROL_LABELS[u.rol] || u.rol,
      activo: u.activo,
      createdAt: u.createdAt,
      tecnicoId: u.tecnico?.id || null,
    })),
  });
}

export async function POST(request: Request) {
  const session = await getFullSession();
  if (!session || session.rol !== "ADMIN") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const { email, nombre, password, rol } = await request.json();

  const emailNorm = normalizeEmail(email);
  const passwordNorm = normalizePassword(password);

  if (!emailNorm || !String(nombre).trim() || !passwordNorm) {
    return NextResponse.json({ error: "Todos los campos son obligatorios" }, { status: 400 });
  }

  if (!["TECNICO", "SUPERVISOR", "ADMIN", "HELP_DESK"].includes(rol)) {
    return NextResponse.json({ error: "Rol inválido" }, { status: 400 });
  }

  if (passwordNorm.length < 6) {
    return NextResponse.json({ error: "Contraseña mínimo 6 caracteres" }, { status: 400 });
  }

  const existente = await prisma.usuario.findUnique({
    where: { email: emailNorm },
  });
  if (existente) {
    return NextResponse.json({ error: "Email ya registrado" }, { status: 409 });
  }

  let passwordHash: string;
  try {
    passwordHash = await hashPassword(passwordNorm);
  } catch {
    return NextResponse.json({ error: "Contraseña mínimo 6 caracteres" }, { status: 400 });
  }

  const usuario = await prisma.usuario.create({
    data: {
      email: emailNorm,
      nombre: String(nombre).trim(),
      passwordHash,
      rol,
      activo: true,
      ...(rol === "TECNICO"
        ? { tecnico: { create: { estadoActual: "DISPONIBLE" } } }
        : {}),
    },
  });

  return NextResponse.json({ usuario: { id: usuario.id, email: usuario.email, nombre: usuario.nombre, rol: usuario.rol } }, { status: 201 });
}
