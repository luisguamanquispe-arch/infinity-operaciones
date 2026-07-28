import bcrypt from "bcryptjs";
import type { PrismaClient } from "@prisma/client";
import { asegurarIdentidadTecnico } from "@/lib/tecnico-identidad-e1";

export const BOOTSTRAP_TECNICO = {
  email: "tecnico@infinity.ec",
  password: "tecnico123",
  nombre: "TECNICO DEMO",
} as const;

/** Activa usuarios TECNICO registrados y repara perfil tecnico faltante (F1/E1). */
export async function activarTecnicosRegistrados(prisma: PrismaClient) {
  const usuarios = await prisma.usuario.findMany({
    where: { rol: "TECNICO" },
    include: { tecnico: true },
  });

  const activados: string[] = [];
  const reparados: string[] = [];
  const conflictos: string[] = [];

  for (const u of usuarios) {
    if (!u.activo) {
      await prisma.usuario.update({
        where: { id: u.id },
        data: { activo: true },
      });
      activados.push(u.email);
    }
    if (!u.tecnico) {
      const identidad = await asegurarIdentidadTecnico(u.id, {
        db: prisma,
        dryRunRemap: true,
        aplicarRemap: false,
      });
      if (identidad.ok && identidad.created) {
        reparados.push(u.email);
      } else if (!identidad.ok) {
        conflictos.push(`${u.email}: ${identidad.detalle}`);
      }
    }
  }

  return {
    total: usuarios.length,
    activados,
    reparados,
    conflictos,
  };
}

export async function ensureBootstrapTecnico(prisma: PrismaClient) {
  const activacion = await activarTecnicosRegistrados(prisma);

  const activos = await prisma.tecnico.count({
    where: { usuario: { activo: true } },
  });
  if (activos > 0) {
    return {
      skipped: true as const,
      reason: "already_has_tecnicos" as const,
      count: activos,
      activacion,
    };
  }

  const totalTecnicos = await prisma.usuario.count({ where: { rol: "TECNICO" } });
  if (totalTecnicos > 0) {
    return {
      skipped: true as const,
      reason: "tecnicos_sin_perfil" as const,
      count: 0,
      activacion,
    };
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
      created: false as const,
      repaired: true as const,
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
    created: true as const,
    email,
    password: BOOTSTRAP_TECNICO.password,
  };
}
