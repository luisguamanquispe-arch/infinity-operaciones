import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireInfraSession } from "@/lib/infraestructura-red/auth";
import { esClienteInfraestructura } from "@/lib/cliente-infraestructura";

/** Búsqueda de clientes afectados (accesible a roles IR). */
export async function GET(request: Request) {
  const auth = await requireInfraSession();
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim();
  if (!q || q.length < 2) {
    return NextResponse.json({ clientes: [] });
  }

  const clientes = await prisma.cliente.findMany({
    where: {
      activo: true,
      OR: [
        { cedula: { contains: q } },
        { nombre: { contains: q, mode: "insensitive" } },
        { telefono: { contains: q } },
        { sector: { contains: q, mode: "insensitive" } },
      ],
    },
    take: 20,
    orderBy: { nombre: "asc" },
    select: {
      id: true,
      nombre: true,
      cedula: true,
      telefono: true,
      sector: true,
    },
  });

  return NextResponse.json({
    clientes: clientes.filter((c) => !esClienteInfraestructura(c.cedula)),
  });
}
