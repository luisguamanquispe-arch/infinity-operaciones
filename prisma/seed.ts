import {
  PrismaClient,
  Rol,
} from "@prisma/client";
import bcrypt from "bcryptjs";
import { CATALOGO_INVENTARIO } from "../src/lib/inventario-catalog";

const prisma = new PrismaClient();

async function main() {
  await prisma.eventoTicket.deleteMany();
  await prisma.materialUtilizado.deleteMany();
  await prisma.fotografia.deleteMany();
  await prisma.firma.deleteMany();
  await prisma.medicion.deleteMany();
  await prisma.cronometro.deleteMany();
  await prisma.ordenServicio.deleteMany();
  await prisma.ubicacionGps.deleteMany();
  await prisma.ticket.deleteMany();
  await prisma.evaluacionCliente.deleteMany();
  await prisma.tecnico.deleteMany();
  await prisma.usuario.deleteMany();

  const hashSup = await bcrypt.hash("super123", 10);
  const hashAdmin = await bcrypt.hash("admin123", 10);

  await prisma.usuario.create({
    data: {
      email: "supervisor@infinity.ec",
      passwordHash: hashSup,
      nombre: "Ana Supervisor",
      rol: Rol.SUPERVISOR,
    },
  });

  await prisma.usuario.create({
    data: {
      email: "admin@infinity.ec",
      passwordHash: hashAdmin,
      nombre: "Gerencia Infinity",
      rol: Rol.ADMIN,
    },
  });

  await prisma.inventario.createMany({
    data: CATALOGO_INVENTARIO,
  });

  console.log("Seed completado (sin técnicos ni tickets de prueba)");
  console.log("   Supervisor: supervisor@infinity.ec / super123");
  console.log("   Admin:      admin@infinity.ec / admin123");
  console.log("   Cree técnicos en /gerencia/tecnicos/nuevo");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
