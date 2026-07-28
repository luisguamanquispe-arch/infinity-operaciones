/**
 * Auditoría F1/E1 vía Prisma (solo lectura).
 * Uso: DATABASE_URL=... npx tsx scripts/audit-e1.ts
 */
import { PrismaClient } from "@prisma/client";
import { auditarIntegridadE1 } from "../src/lib/tecnico-identidad-e1";

async function main() {
  const prisma = new PrismaClient();
  try {
    const auditoria = await auditarIntegridadE1(prisma);
    console.log(JSON.stringify(auditoria, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
