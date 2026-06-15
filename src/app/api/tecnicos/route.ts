import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { getFullSession } from "@/lib/auth";
import { enMayusculasGuardar } from "@/lib/mayusculas";

export async function GET() {
  const session = await getFullSession();
  if (!session || !["SUPERVISOR", "ADMIN"].includes(session.rol)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const tecnicos = await prisma.tecnico.findMany({
    include: { usuario: true },
    orderBy: { usuario: { nombre: "asc" } },
  });

  const isAdmin = session.rol === "ADMIN";

  return NextResponse.json({
    tecnicos: tecnicos.map((t) => ({
      id: t.id,
      nombre: t.usuario.nombre,
      email: isAdmin ? t.usuario.email : undefined,
      telefono: t.telefono,
      vehiculo: t.vehiculo,
      estado: t.estadoActual,
      activo: t.usuario.activo,
    })),
  });
}

export async function POST(request: Request) {
  const session = await getFullSession();
  if (!session || session.rol !== "ADMIN") {
    return NextResponse.json({ error: "Solo gerencia puede registrar técnicos" }, { status: 403 });
  }

  const body = await request.json();
  const { nombre, email, password, telefono, vehiculo } = body;

  if (!nombre?.trim() || !email?.trim() || !password?.trim()) {
    return NextResponse.json(
      { error: "Nombre, email y contraseña son obligatorios" },
      { status: 400 }
    );
  }

  if (password.length < 6) {
    return NextResponse.json(
      { error: "La contraseña debe tener al menos 6 caracteres" },
      { status: 400 }
    );
  }

  const emailNorm = email.trim().toLowerCase();

  const existente = await prisma.usuario.findUnique({ where: { email: emailNorm } });
  if (existente) {
    return NextResponse.json({ error: "Ya existe un usuario con ese email" }, { status: 409 });
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const usuario = await prisma.usuario.create({
    data: {
      email: emailNorm,
      passwordHash,
      nombre: enMayusculasGuardar(nombre),
      rol: "TECNICO",
      tecnico: {
        create: {
          telefono: telefono?.trim() || null,
          vehiculo: vehiculo ? enMayusculasGuardar(vehiculo) : null,
          estadoActual: "DISPONIBLE",
        },
      },
    },
    include: {
      tecnico: true,
    },
  });

  return NextResponse.json(
    {
      tecnico: {
        id: usuario.tecnico!.id,
        nombre: usuario.nombre,
        email: usuario.email,
        telefono: usuario.tecnico!.telefono,
        vehiculo: usuario.tecnico!.vehiculo,
      },
    },
    { status: 201 }
  );
}
