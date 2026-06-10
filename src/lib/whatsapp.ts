/**
 * Integración WhatsApp Business — Meta Cloud API
 * Docs: https://developers.facebook.com/docs/whatsapp/cloud-api
 */

import { getEnv, isWhatsAppEnabled } from "./env";

/** Convierte teléfono ecuatoriano a formato internacional: 0995870168 → 593995870168 */
export function formatPhoneEcuador(telefono: string): string {
  const digits = telefono.replace(/\D/g, "");
  if (digits.startsWith("593")) return digits;
  if (digits.startsWith("0")) return `593${digits.slice(1)}`;
  if (digits.length === 9) return `593${digits}`;
  return digits;
}

export interface WhatsAppResult {
  enviado: boolean;
  mensaje: string;
  messageId?: string;
  error?: string;
  simulado?: boolean;
}

export async function enviarWhatsAppTicketCerrado(
  ticketCodigo: string,
  telefonoCliente: string
): Promise<WhatsAppResult> {
  const env = getEnv();
  const telefonoSoporte = env.WHATSAPP_PHONE || "0995870168";
  const mensaje = `Infinity Internet informa que su ticket ${ticketCodigo} ha sido solucionado exitosamente.\n\nSi presenta novedades contáctenos al ${telefonoSoporte}.`;

  if (!isWhatsAppEnabled()) {
    console.log(`[WhatsApp SIMULADO] ${telefonoCliente}: ${mensaje}`);
    return { enviado: true, mensaje, simulado: true };
  }

  const token = env.WHATSAPP_API_TOKEN;
  const phoneNumberId = env.WHATSAPP_PHONE_NUMBER_ID;

  if (!token || !phoneNumberId) {
    console.error("[WhatsApp] Faltan WHATSAPP_API_TOKEN o WHATSAPP_PHONE_NUMBER_ID");
    return {
      enviado: false,
      mensaje,
      error: "Configuración WhatsApp incompleta",
    };
  }

  const to = formatPhoneEcuador(telefonoCliente);
  const apiVersion = env.WHATSAPP_API_VERSION;
  const url = `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`;

  try {
    let body: Record<string, unknown>;

    if (env.WHATSAPP_TEMPLATE_NAME) {
      // Mensaje con plantilla aprobada por Meta (recomendado para notificaciones proactivas)
      body = {
        messaging_product: "whatsapp",
        to,
        type: "template",
        template: {
          name: env.WHATSAPP_TEMPLATE_NAME,
          language: { code: "es" },
          components: [
            {
              type: "body",
              parameters: [
                { type: "text", text: ticketCodigo },
                { type: "text", text: telefonoSoporte },
              ],
            },
          ],
        },
      };
    } else {
      // Mensaje de texto (solo válido dentro de ventana de 24h con el cliente)
      body = {
        messaging_product: "whatsapp",
        to,
        type: "text",
        text: { body: mensaje },
      };
    }

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("[WhatsApp] Error Meta API:", data);
      return {
        enviado: false,
        mensaje,
        error: data?.error?.message || `HTTP ${response.status}`,
      };
    }

    console.log(`[WhatsApp] Enviado a ${to}, ticket ${ticketCodigo}`);
    return {
      enviado: true,
      mensaje,
      messageId: data?.messages?.[0]?.id,
    };
  } catch (err) {
    const error = err instanceof Error ? err.message : "Error desconocido";
    console.error("[WhatsApp] Excepción:", error);
    return { enviado: false, mensaje, error };
  }
}
