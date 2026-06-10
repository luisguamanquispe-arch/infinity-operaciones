import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const u = await prisma.usuario.findUnique({ where: { email: "juan@infinity.ec" } });
  console.log(u ? `OK: ${u.email} (${u.nombre})` : "NOT FOUND - run npm run db:seed");
}

main()
  .catch((e) => console.error("ERR:", e.message))
  .finally(() => prisma.$disconnect());
