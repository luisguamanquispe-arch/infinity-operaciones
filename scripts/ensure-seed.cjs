const { PrismaClient } = require("@prisma/client");
const { execSync } = require("child_process");

async function main() {
  const prisma = new PrismaClient();
  try {
    const count = await prisma.usuario.count();
    if (count === 0) {
      console.log("[Seed] Base de datos vacía — creando usuarios de prueba...");
      execSync("npx tsx prisma/seed.ts", { stdio: "inherit", env: process.env });
      console.log("[Seed] Usuarios creados correctamente.");
    } else {
      console.log(`[Seed] ${count} usuario(s) existentes — seed omitido.`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("[Seed] Error (no bloquea el arranque):", err.message || err);
  process.exit(0);
});
