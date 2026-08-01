import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireInfraSession } from "@/lib/infraestructura-red/auth";
import { puedeGestionarInfraestructura } from "@/lib/infraestructura-red/labels";

/** Catálogo de técnicos y supervisores para formularios IR. */
export async function GET() {
  const auth = await requireInfraSession();
  if (!auth.ok) return auth.response;

  const tecnicos = await prisma.tecnico.findMany({
    where: { usuario: { activo: true } },
    include: { usuario: { select: { id: true, nombre: true, email: true } } },
    orderBy: { usuario: { nombre: "asc" } },
  });

  const supervisores = puedeGestionarInfraestructura(auth.session.rol)
    ? await prisma.usuario.findMany({
        where: { activo: true, rol: { in: ["SUPERVISOR", "ADMIN"] } },
        select: { id: true, nombre: true, email: true, rol: true },
        orderBy: { nombre: "asc" },
      })
    : [];

  return NextResponse.json({
    tecnicos: tecnicos.map((t) => ({
      id: t.id,
      nombre: t.usuario.nombre,
      email: t.usuario.email,
    })),
    supervisores,
  });
}
