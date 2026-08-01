import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSrSession } from "@/lib/soporte-remoto/auth";
import { esClienteInfraestructura } from "@/lib/cliente-infraestructura";

/** Catálogo operadores + búsqueda de clientes CRM para Soporte Remoto. */
export async function GET(request: Request) {
  const auth = await requireSrSession();
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim();
  const takeClientes = Math.min(40, Math.max(1, parseInt(searchParams.get("take") || "20", 10)));

  const operadores = await prisma.usuario.findMany({
    where: {
      activo: true,
      rol: { in: ["HELP_DESK", "SUPERVISOR", "ADMIN"] },
    },
    select: { id: true, nombre: true, email: true, rol: true },
    orderBy: { nombre: "asc" },
  });

  let clientes: {
    id: string;
    nombre: string;
    cedula: string;
    telefono: string;
  }[] = [];

  if (q && q.length >= 2) {
    const rows = await prisma.cliente.findMany({
      where: {
        activo: true,
        OR: [
          { cedula: { contains: q } },
          { nombre: { contains: q, mode: "insensitive" } },
          { telefono: { contains: q } },
        ],
      },
      select: { id: true, nombre: true, cedula: true, telefono: true },
      take: takeClientes,
      orderBy: { nombre: "asc" },
    });
    clientes = rows.filter((c) => !esClienteInfraestructura(c.cedula));
  }

  return NextResponse.json({
    operadores,
    clientes,
    session: {
      id: auth.session.id,
      nombre: auth.session.nombre,
      rol: auth.session.rol,
    },
  });
}
