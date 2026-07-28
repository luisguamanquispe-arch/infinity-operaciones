/**
 * Si no hay usuarios, crea admin / supervisor / helpdesk.
 * Usa bcryptjs (disponible en producción; no depende de tsx).
 * Nunca bloquea el arranque si falla.
 */
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");
const { ensureBootstrapTecnico } = require("./bootstrap-tecnico.cjs");

const BOOTSTRAP = [
  {
    email: "admin@infinity.ec",
    password: "admin123",
    nombre: "Gerencia Infinity",
    rol: "ADMIN",
  },
  {
    email: "supervisor@infinity.ec",
    password: "super123",
    nombre: "Ana Supervisor",
    rol: "SUPERVISOR",
  },
  {
    email: "helpdesk@infinity.ec",
    password: "helpdesk123",
    nombre: "Carlos Help Desk",
    rol: "HELP_DESK",
  },
];

async function main() {
  if (!process.env.DATABASE_URL) {
    console.warn("[Seed] DATABASE_URL ausente — omitiendo.");
    return;
  }

  const prisma = new PrismaClient();
  try {
    const count = await prisma.usuario.count();
    if (count > 0) {
      console.log(`[Seed] ${count} usuario(s) existentes — seed omitido.`);
    } else {
      console.log("[Seed] Base vacía — creando usuarios de acceso...");
      for (const u of BOOTSTRAP) {
        const passwordHash = await bcrypt.hash(u.password, 10);
        await prisma.usuario.create({
          data: {
            email: u.email,
            passwordHash,
            nombre: u.nombre,
            rol: u.rol,
          },
        });
        console.log(`[Seed]   + ${u.email} / ${u.password}`);
      }
    }

    const tecnico = await ensureBootstrapTecnico(prisma);
    if (tecnico.activacion?.activados?.length) {
      console.log(`[Seed] Técnicos activados: ${tecnico.activacion.activados.join(", ")}`);
    }
    if (tecnico.activacion?.reparados?.length) {
      console.log(`[Seed] Perfiles técnico reparados: ${tecnico.activacion.reparados.join(", ")}`);
    }
    if (tecnico.skipped) {
      console.log(`[Seed] ${tecnico.count} técnico(s) activo(s) — bootstrap técnico omitido.`);
    } else if (tecnico.repaired) {
      console.log(
        `[Seed] Técnico reparado: ${tecnico.email} / ${tecnico.password} (cámbielo en gerencia)`
      );
    } else if (tecnico.created) {
      console.log(
        `[Seed] Técnico demo creado: ${tecnico.email} / ${tecnico.password} (cámbielo en gerencia)`
      );
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("[Seed] Error (no bloquea el arranque):", err.message || err);
  process.exit(0);
});
