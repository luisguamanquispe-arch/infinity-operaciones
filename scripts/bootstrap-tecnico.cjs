/**
 * Garantiza al menos un técnico de campo en la base (app móvil).
 * Idempotente: no duplica si ya hay técnicos activos.
 */
const bcrypt = require("bcryptjs");

const BOOTSTRAP_TECNICO = {
  email: "tecnico@infinity.ec",
  password: "tecnico123",
  nombre: "TECNICO DEMO",
};

async function ensureBootstrapTecnico(prisma) {
  const activos = await prisma.tecnico.count({
    where: { usuario: { activo: true } },
  });
  if (activos > 0) {
    return { skipped: true, reason: "already_has_tecnicos", count: activos };
  }

  const email = BOOTSTRAP_TECNICO.email;
  const existente = await prisma.usuario.findUnique({
    where: { email },
    include: { tecnico: true },
  });

  if (existente) {
    if (!existente.activo) {
      await prisma.usuario.update({
        where: { id: existente.id },
        data: { activo: true, rol: "TECNICO" },
      });
    }
    if (!existente.tecnico) {
      await prisma.tecnico.create({
        data: {
          usuarioId: existente.id,
          estadoActual: "DISPONIBLE",
        },
      });
    }
    const passwordHash = await bcrypt.hash(BOOTSTRAP_TECNICO.password, 10);
    await prisma.usuario.update({
      where: { id: existente.id },
      data: { passwordHash },
    });
    return {
      created: false,
      repaired: true,
      email,
      password: BOOTSTRAP_TECNICO.password,
    };
  }

  const passwordHash = await bcrypt.hash(BOOTSTRAP_TECNICO.password, 10);
  await prisma.usuario.create({
    data: {
      email,
      passwordHash,
      nombre: BOOTSTRAP_TECNICO.nombre,
      rol: "TECNICO",
      tecnico: {
        create: { estadoActual: "DISPONIBLE" },
      },
    },
  });

  return {
    created: true,
    email,
    password: BOOTSTRAP_TECNICO.password,
  };
}

module.exports = { BOOTSTRAP_TECNICO, ensureBootstrapTecnico };
