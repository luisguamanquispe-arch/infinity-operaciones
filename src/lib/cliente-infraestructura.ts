import { prisma } from "./prisma";
import { enMayusculas } from "./mayusculas";

/** Cliente interno para tickets de infraestructura de la empresa. */
export const CEDULA_CLIENTE_INFRA = "1790016919001";

export async function getOrCreateClienteInfraestructura() {
  return prisma.cliente.upsert({
    where: { cedula: CEDULA_CLIENTE_INFRA },
    create: {
      cedula: CEDULA_CLIENTE_INFRA,
      nombre: enMayusculas("INFINITY INTERNET - INFRAESTRUCTURA"),
      telefono: "0999999999",
      plan: "INTERNO",
      direccion: enMayusculas("VARIOS NODOS Y SECTORES"),
      sector: enMayusculas("INFRAESTRUCTURA"),
      referencia: enMayusculas("TICKETS INTERNOS DE RED, NODOS Y ENLACES"),
      nodo: enMayusculas("RED CORPORATIVA"),
      activo: true,
    },
    update: {},
  });
}

export function esClienteInfraestructura(cedula: string): boolean {
  return cedula === CEDULA_CLIENTE_INFRA;
}
