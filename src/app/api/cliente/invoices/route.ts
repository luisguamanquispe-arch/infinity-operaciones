import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireClienteSession } from "@/lib/cliente-app/auth";
import { fetchWisproBilling } from "@/lib/wispro/billing";

export async function GET(request: Request) {
  try {
    const session = await requireClienteSession(request);
    const cliente = await prisma.cliente.findUnique({ where: { id: session.clienteId } });
    if (!cliente) {
      return NextResponse.json({ error: "Cliente no encontrado" }, { status: 404 });
    }

    const billing = await fetchWisproBilling({
      clienteId: cliente.id,
      cedula: cliente.cedula,
      plan: cliente.plan,
    });

    return NextResponse.json({
      saldoPendiente: billing.saldoPendiente,
      invoices: billing.invoices,
      fuente: billing.fuente,
    });
  } catch (err) {
    if (err instanceof Error && err.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }
    console.error("[cliente/invoices]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
