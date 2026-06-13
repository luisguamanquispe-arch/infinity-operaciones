import type { PrismaClient } from "@prisma/client";

export const EMAILS_TECNICOS_PRUEBA = ["carlos@infinity.ec", "juan@infinity.ec"];
export const NOMBRES_TECNICOS_PRUEBA = ["CARLOS MENDOZA", "JUAN PEREZ"];

function nombreCoincide(nombre: string): boolean {
  const norm = nombre.trim().toLocaleUpperCase("es-EC");
  return NOMBRES_TECNICOS_PRUEBA.some((n) => norm === n || norm.includes(n));
}

export async function eliminarTecnicosPrueba(prisma: PrismaClient) {
  const encontrados = new Map<string, { id: string; label: string }>();

  for (const email of EMAILS_TECNICOS_PRUEBA) {
    const u = await prisma.usuario.findUnique({ where: { email } });
    if (u) {
      encontrados.set(u.id, { id: u.id, label: `${u.nombre} (${email})` });
    }
  }

  const tecnicos = await prisma.tecnico.findMany({
    include: { usuario: true },
  });

  for (const t of tecnicos) {
    if (nombreCoincide(t.usuario.nombre)) {
      encontrados.set(t.usuarioId, {
        id: t.usuarioId,
        label: `${t.usuario.nombre} (${t.usuario.email})`,
      });
    }
  }

  const eliminados: { label: string; ticketsDesvinculados: number }[] = [];

  for (const { id, label } of encontrados.values()) {
    const tecnico = await prisma.tecnico.findUnique({ where: { usuarioId: id } });
    let ticketsDesvinculados = 0;

    if (tecnico) {
      const r = await prisma.ticket.updateMany({
        where: { tecnicoId: tecnico.id },
        data: { tecnicoId: null },
      });
      ticketsDesvinculados = r.count;
    }

    await prisma.usuario.delete({ where: { id } });
    eliminados.push({ label, ticketsDesvinculados });
  }

  return { eliminados, total: eliminados.length };
}
