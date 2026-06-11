import { formatDateTime } from "@/lib/utils";
import { enviarWhatsAppTexto } from "@/lib/whatsapp";

type TicketAsignado = {
  codigo: string;
  motivo: string | null;
  programadoEn: Date | null;
  tecnico: { telefono: string | null; usuario: { nombre: string } } | null;
  cliente: { nombre: string; direccion: string; sector: string };
};

export async function notificarTecnicoAsignacion(ticket: TicketAsignado) {
  if (!ticket.tecnico?.telefono || !ticket.programadoEn) return;

  const fecha = formatDateTime(ticket.programadoEn);
  const lineas = [
    `Infinity Operaciones — Ticket ${ticket.codigo}`,
    `Programado: ${fecha}`,
    `Cliente: ${ticket.cliente.nombre}`,
    `Sector: ${ticket.cliente.sector}`,
    `Dirección: ${ticket.cliente.direccion}`,
  ];
  if (ticket.motivo) lineas.push(`Motivo: ${ticket.motivo}`);
  lineas.push("", "Ingrese a la app para ver el detalle e iniciar la reparación.");

  await enviarWhatsAppTexto(ticket.tecnico.telefono, lineas.join("\n"));
}
