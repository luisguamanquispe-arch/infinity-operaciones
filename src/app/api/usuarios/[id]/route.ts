import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getFullSession } from "@/lib/auth";
import { hashPassword, normalizePassword } from "@/lib/password";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getFullSession();
  if (!session || session.rol !== "ADMIN") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json();

  const usuario = await prisma.usuario.findUnique({ where: { id } });
  if (!usuario) {
    return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
  }

  const updateData: Record<string, unknown> = {};

  if (body.nombre?.trim()) updateData.nombre = body.nombre.trim();

  if (body.password) {
    const passwordNorm = normalizePassword(body.password);
    if (passwordNorm.length < 6) {
      return NextResponse.json({ error: "Contraseña mínimo 6 caracteres" }, { status: 400 });
    }
    try {
      updateData.passwordHash = await hashPassword(passwordNorm);
    } catch {
      return NextResponse.json({ error: "Contraseña mínimo 6 caracteres" }, { status: 400 });
    }
  }

  if (body.activo !== undefined) {
    if (id === session.id && !body.activo) {
      return NextResponse.json({ error: "No puedes desactivar tu propia cuenta" }, { status: 400 });
    }
    updateData.activo = body.activo;
  }

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({ error: "Sin cambios" }, { status: 400 });
  }

  const updated = await prisma.usuario.update({
    where: { id },
    data: updateData,
    select: { id: true, email: true, nombre: true, rol: true, activo: true },
  });

  return NextResponse.json({ usuario: updated });
}
