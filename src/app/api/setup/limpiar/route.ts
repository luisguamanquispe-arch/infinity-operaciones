import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const EMAILS_TECNICOS_ELIMINAR = ["juan@infinity.ec", "carlos@infinity.ec"];

function getToken(request: Request): string | null {
  const header = request.headers.get("x-setup-token");
  if (header) return header;
  return new URL(request.url).searchParams.get("token");
}

async function limpiarDatos() {
  await prisma.eventoTicket.deleteMany();
  await prisma.materialUtilizado.deleteMany();
  await prisma.fotografia.deleteMany();
  await prisma.firma.deleteMany();
  await prisma.medicion.deleteMany();
  await prisma.cronometro.deleteMany();
  await prisma.ordenServicio.deleteMany();
  await prisma.evaluacionCliente.deleteMany();
  const tickets = await prisma.ticket.deleteMany();

  const eliminados: string[] = [];
  for (const email of EMAILS_TECNICOS_ELIMINAR) {
    const u = await prisma.usuario.findUnique({ where: { email } });
    if (u) {
      await prisma.usuario.delete({ where: { id: u.id } });
      eliminados.push(email);
    }
  }

  return { ticketsEliminados: tickets.count, tecnicosEliminados: eliminados };
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

    const result = await limpiarDatos();

    return NextResponse.json({
      ok: true,
      message: "Tickets, reportes y técnicos de prueba eliminados",
      ...result,
    });
  } catch (err) {
    console.error("[Setup limpiar]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error al limpiar datos" },
      { status: 500 }
    );
  }
}
