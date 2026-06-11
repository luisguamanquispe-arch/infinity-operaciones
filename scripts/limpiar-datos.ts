/**
 * Elimina tickets (activos y finalizados/reportes), técnicos Juan Pérez y Carlos Mendoza.
 * Conserva supervisor, admin, clientes e inventario.
 *
 * Uso local o Render:
 *   npx tsx scripts/limpiar-datos.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const EMAILS_TECNICOS_ELIMINAR = ["juan@infinity.ec", "carlos@infinity.ec"];

async function main() {
  console.log("Limpiando tickets y órdenes...");
  await prisma.eventoTicket.deleteMany();
  await prisma.materialUtilizado.deleteMany();
  await prisma.fotografia.deleteMany();
  await prisma.firma.deleteMany();
  await prisma.medicion.deleteMany();
  await prisma.cronometro.deleteMany();
  await prisma.ordenServicio.deleteMany();
  await prisma.evaluacionCliente.deleteMany();
  const tickets = await prisma.ticket.deleteMany();
  console.log(`  ${tickets.count} ticket(s) eliminado(s)`);

  console.log("Eliminando técnicos de prueba...");
  for (const email of EMAILS_TECNICOS_ELIMINAR) {
    const u = await prisma.usuario.findUnique({ where: { email } });
    if (u) {
      await prisma.usuario.delete({ where: { id: u.id } });
      console.log(`  Eliminado: ${email}`);
    } else {
      console.log(`  No encontrado: ${email}`);
    }
  }

  console.log("");
  console.log("Listo. Conservados: supervisor, admin, clientes, inventario.");
  console.log("Crea técnicos reales en /gerencia/tecnicos/nuevo");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
