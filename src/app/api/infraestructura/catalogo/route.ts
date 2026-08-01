import { NextResponse } from "next/server";
import { requireInfraSession } from "@/lib/infraestructura-red/auth";
import { listarInventarioConsumible } from "@/lib/infraestructura-red/inventario";
import { puedeGestionarInfraestructura } from "@/lib/infraestructura-red/labels";
import { prisma } from "@/lib/prisma";

/** Catálogo de técnicos, supervisores e inventario para formularios IR. */
export async function GET() {
  const auth = await requireInfraSession();
  if (!auth.ok) return auth.response;

  const [tecnicos, supervisores, inventario] = await Promise.all([
    prisma.tecnico.findMany({
      where: { usuario: { activo: true } },
      include: { usuario: { select: { id: true, nombre: true, email: true } } },
      orderBy: { usuario: { nombre: "asc" } },
    }),
    puedeGestionarInfraestructura(auth.session.rol)
      ? prisma.usuario.findMany({
          where: { activo: true, rol: { in: ["SUPERVISOR", "ADMIN"] } },
          select: { id: true, nombre: true, email: true, rol: true },
          orderBy: { nombre: "asc" },
        })
      : Promise.resolve([]),
    listarInventarioConsumible(),
  ]);

  return NextResponse.json({
    tecnicos: tecnicos.map((t) => ({
      id: t.id,
      nombre: t.usuario.nombre,
      email: t.usuario.email,
    })),
    supervisores,
    inventario,
  });
}
