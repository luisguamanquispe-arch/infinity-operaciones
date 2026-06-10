import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { getFullSession } from "@/lib/auth";

const ROL_LABELS: Record<string, string> = {
  TECNICO: "Técnico",
  SUPERVISOR: "Supervisor",
  ADMIN: "Administrador",
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

  if (!email || !nombre || !password || !rol) {
    return NextResponse.json({ error: "Todos los campos son obligatorios" }, { status: 400 });
  }

  if (!["TECNICO", "SUPERVISOR", "ADMIN"].includes(rol)) {
    return NextResponse.json({ error: "Rol inválido" }, { status: 400 });
  }

  if (password.length < 6) {
    return NextResponse.json({ error: "Contraseña mínimo 6 caracteres" }, { status: 400 });
  }

  const existente = await prisma.usuario.findUnique({
    where: { email: email.trim().toLowerCase() },
  });
  if (existente) {
    return NextResponse.json({ error: "Email ya registrado" }, { status: 409 });
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const usuario = await prisma.usuario.create({
    data: {
      email: email.trim().toLowerCase(),
      nombre: nombre.trim(),
      passwordHash,
      rol,
      ...(rol === "TECNICO" ? { tecnico: { create: {} } } : {}),
    },
  });

  return NextResponse.json({ usuario: { id: usuario.id, email: usuario.email, nombre: usuario.nombre, rol: usuario.rol } }, { status: 201 });
}
