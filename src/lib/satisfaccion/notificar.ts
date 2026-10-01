import { isWhatsAppEnabled } from "@/lib/env";
import { enviarWhatsAppTexto } from "@/lib/whatsapp";
import { mensajeWhatsappSatisfaccion } from "./reglas";

export type CanalEnvio = "WHATSAPP" | "SMS" | "EMAIL";

export interface ResultadoEnvioEncuesta {
  canal: CanalEnvio | null;
  enviado: boolean;
  deliveryStatus: "SENT" | "FAILED" | "NOT_CONFIGURED";
  error?: string;
}

export interface DestinoEncuesta {
  nombre: string;
  telefono: string | null;
  url: string;
}

/**
 * Capa desacoplada. WhatsApp reutiliza el cliente Meta ya existente.
 * SMS y correo quedan como adaptadores sin proveedor inventado.
 * No registra el enlace ni el token.
 */
export async function sendSatisfactionSurvey(destino: DestinoEncuesta): Promise<ResultadoEnvioEncuesta> {
  const whatsapp = await enviarPorWhatsapp(destino);
  if (whatsapp.enviado || whatsapp.deliveryStatus === "FAILED") return whatsapp;
  const sms = await enviarPorSms();
  if (sms.deliveryStatus !== "NOT_CONFIGURED") return sms;
  return enviarPorEmail();
}

async function enviarPorWhatsapp(destino: DestinoEncuesta): Promise<ResultadoEnvioEncuesta> {
  if (!destino.telefono) {
    return { canal: "WHATSAPP", enviado: false, deliveryStatus: "NOT_CONFIGURED" };
  }
  if (!isWhatsAppEnabled()) {
    return { canal: "WHATSAPP", enviado: false, deliveryStatus: "NOT_CONFIGURED" };
  }
  const texto = mensajeWhatsappSatisfaccion(destino.nombre, destino.url);
  const result = await enviarWhatsAppTexto(destino.telefono, texto);
  if (result.simulado) {
    return { canal: "WHATSAPP", enviado: false, deliveryStatus: "NOT_CONFIGURED" };
  }
  if (!result.enviado) {
    return {
      canal: "WHATSAPP",
      enviado: false,
      deliveryStatus: "FAILED",
      error: result.error || "envio_fallido",
    };
  }
  return { canal: "WHATSAPP", enviado: true, deliveryStatus: "SENT" };
}

async function enviarPorSms(): Promise<ResultadoEnvioEncuesta> {
  return { canal: "SMS", enviado: false, deliveryStatus: "NOT_CONFIGURED" };
}

async function enviarPorEmail(): Promise<ResultadoEnvioEncuesta> {
  return { canal: "EMAIL", enviado: false, deliveryStatus: "NOT_CONFIGURED" };
}
