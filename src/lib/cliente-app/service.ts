import { prisma } from "@/lib/prisma";
import { fetchWisproBilling } from "@/lib/wispro/billing";
import { fetchWisproServiceByCliente } from "@/lib/wispro/client";
import type { ClienteSession } from "./auth";

export async function getClienteWithService(clienteId: string) {
  const cliente = await prisma.cliente.findUnique({ where: { id: clienteId } });
  if (!cliente) return null;

  const service = await fetchWisproServiceByCliente({
    clienteId: cliente.id,
    cedula: cliente.cedula,
    plan: cliente.plan,
    potencia: cliente.potencia,
    onuSerial: cliente.onuSerial,
    activo: cliente.activo,
  });

  return { cliente, service };
}

export function serializeProfile(session: ClienteSession, cliente: {
  id: string;
  cedula: string;
  nombre: string;
  telefono: string;
  plan: string;
  direccion: string;
  sector: string;
  activo: boolean;
}) {
  return {
    id: session.id,
    email: session.email,
    nombre: session.nombre,
    cliente: {
      id: cliente.id,
      cedula: cliente.cedula,
      nombre: cliente.nombre,
      telefono: cliente.telefono,
      plan: cliente.plan,
      direccion: cliente.direccion,
      sector: cliente.sector,
      activo: cliente.activo,
    },
  };
}

export async function serializeDashboard(
  cliente: {
    id: string;
    cedula: string;
    nombre: string;
    plan: string;
    sector: string;
    direccion: string;
  },
  service: Awaited<ReturnType<typeof fetchWisproServiceByCliente>>
) {
  const billing = await fetchWisproBilling({
    clienteId: cliente.id,
    cedula: cliente.cedula,
    plan: cliente.plan,
  });
  const pendiente = billing.invoices.find((i) => i.saldo > 0);
  const ultimo = billing.payments[0];

  return {
    nombre: cliente.nombre,
    plan: service.plan,
    velocidadMbps: service.velocidadMbps,
    estadoServicio: service.estadoServicio,
    estadoConexion: service.estadoConexion,
    fechaCorte: pendiente?.vencimiento ?? service.fechaCorte,
    saldoPendiente: billing.saldoPendiente,
    ultimoPago: ultimo
      ? { monto: ultimo.monto, fecha: ultimo.fecha, referencia: ultimo.referencia }
      : service.ultimoPago,
    sector: cliente.sector,
    direccion: cliente.direccion,
    accesosRapidos: [
      { id: "servicio", label: "Mi servicio", ruta: "/servicio" },
      { id: "perfil", label: "Mi perfil", ruta: "/perfil" },
      { id: "facturacion", label: "Facturación", ruta: "/facturacion" },
      { id: "soporte", label: "Soporte", ruta: "/soporte" },
      { id: "chat", label: "Chat / IA", ruta: "/chat" },
      { id: "speedtest", label: "Speed test", ruta: "/speedtest" },
    ],
  };
}

export function serializeService(
  cliente: {
    plan: string;
    nodo: string | null;
    cajaNap: string | null;
    puerto: string | null;
    onuSerial: string | null;
    potencia: number | null;
  },
  service: Awaited<ReturnType<typeof fetchWisproServiceByCliente>>
) {
  return {
    plan: service.plan,
    velocidadMbps: service.velocidadMbps,
    estadoServicio: service.estadoServicio,
    estadoConexion: service.estadoConexion,
    ip: service.ip,
    mac: service.mac,
    router: service.router,
    onu: service.onu ?? cliente.onuSerial,
    potenciaOptica: service.potenciaOptica ?? cliente.potencia,
    tiempoConectadoHoras: service.tiempoConectadoHoras,
    consumoGbMes: service.consumoGbMes,
    infraestructura: {
      nodo: cliente.nodo,
      cajaNap: cliente.cajaNap,
      puerto: cliente.puerto,
    },
    fuente: service.fuente,
  };
}
