const { PrismaClient } = require("@prisma/client");

async function main() {
  const prisma = new PrismaClient();
  try {
    const count = await prisma.usuario.count();
    console.log("Usuarios en la base de datos:", count);
    if (count === 0) {
      console.log("VACIA — debes ejecutar el seed.");
      return;
    }
    const users = await prisma.usuario.findMany({
      select: { email: true, rol: true, activo: true },
    });
    users.forEach((u) => console.log(`  - ${u.email} (${u.rol}) activo=${u.activo}`));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
