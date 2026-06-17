/**
 * Elimina tickets por código (restaura inventario).
 * Uso: npx tsx scripts/eliminar-tickets-por-codigo.ts ST-1002 ST-1003
 */
import { PrismaClient } from "@prisma/client";
import { eliminarTicketPorId } from "../src/lib/eliminar-ticket";

const prisma = new PrismaClient();
const codigos = process.argv.slice(2);

async function main() {
  if (codigos.length === 0) {
    console.error("Indique al menos un código de ticket.");
    process.exit(1);
  }

  for (const codigo of codigos) {
    const ticket = await prisma.ticket.findFirst({ where: { codigo } });
    if (!ticket) {
      console.log(`No encontrado: ${codigo}`);
      continue;
    }
    const result = await eliminarTicketPorId(ticket.id);
    console.log(
      `Eliminado ${result.codigo} (materiales restaurados: ${result.materialesRestaurados})`
    );
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
