/**
 * Bot de triaje para clientes en INFINITY Connect.
 * Usa OpenAI si hay key; si no, respuestas por reglas.
 */

export type BotReply = {
  texto: string;
  pedirHumano: boolean;
};

const QUIERE_HUMANO =
  /\b(agente|asesor|humano|persona|operador|hablar con alguien|ayuda humana)\b/i;

const FAQ: { patron: RegExp; texto: string }[] = [
  {
    patron: /sin internet|no hay servicio|ca[ií]do|offline/i,
    texto:
      "Entiendo que no tiene internet. Pruebe: 1) Reiniciar el router 30 segundos. 2) Revisar luces de la ONU (PON/LOS). Si LOS está roja, puede ser falla de fibra y necesitará un técnico. ¿Quiere que lo derive a un agente?",
  },
  {
    patron: /lento|lentitud|velocidad|mbps/i,
    texto:
      "Para lentitud: use cable si puede, reinicie el router y corra el Speed test en la app. Compare con su plan contratado. Si sigue bajo, un agente puede revisar la potencia óptica. ¿Desea hablar con un asesor?",
  },
  {
    patron: /factura|pago|saldo|deuda|corte/i,
    texto:
      "Puede ver saldo y facturas en la sección Facturación de la app. Si ya pagó y el servicio no se restablece, indíquelo y lo paso con un agente de facturación.",
  },
  {
    patron: /wifi|clave|contraseña|ssid/i,
    texto:
      "Para WiFi: verifique que esté conectado a su red (no de vecinos) y reinicie el router. Un agente puede ayudarle a cambiar SSID o clave de forma remota. ¿Quiere asistencia humana?",
  },
  {
    patron: /hola|buenas|buen d[ií]a|saludos/i,
    texto:
      "¡Hola! Soy el asistente de Infinity Internet. Puedo orientarle con internet, WiFi, velocidad o facturación. Escriba su consulta o diga «agente» para hablar con una persona.",
  },
];

function replyLocal(texto: string): BotReply {
  if (QUIERE_HUMANO.test(texto)) {
    return {
      texto:
        "Perfecto. Lo estoy pasando a la cola de atención. Un agente de Infinity le responderá en breve.",
      pedirHumano: true,
    };
  }
  for (const f of FAQ) {
    if (f.patron.test(texto)) {
      return { texto: f.texto, pedirHumano: false };
    }
  }
  return {
    texto:
      "Gracias por su mensaje. Mientras revisamos: ¿puede indicar si el problema es sin internet, lentitud, WiFi o facturación? También puede escribir «agente» para atención humana.",
    pedirHumano: false,
  };
}

export async function generarRespuestaBotCliente(
  historial: { autor: string; contenido: string }[],
  mensajeActual: string
): Promise<BotReply> {
  if (QUIERE_HUMANO.test(mensajeActual)) {
    return replyLocal(mensajeActual);
  }

  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return replyLocal(mensajeActual);

  try {
    const ultimos = [...historial.slice(-10), { autor: "CLIENTE", contenido: mensajeActual }];
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-4o-mini",
        temperature: 0.4,
        messages: [
          {
            role: "system",
            content:
              "Eres el asistente de Infinity Internet (ISP fibra en Ecuador). Responde en español, breve (máx 3 frases), útil y empático. Si el cliente pide un humano o el caso requiere visita técnica, termina con la palabra EXACTA [[HUMANO]]. No inventes datos de facturación ni potencias.",
          },
          {
            role: "user",
            content: ultimos.map((m) => `${m.autor}: ${m.contenido}`).join("\n"),
          },
        ],
      }),
    });
    if (!res.ok) return replyLocal(mensajeActual);
    const data = await res.json();
    let texto = String(data.choices?.[0]?.message?.content ?? "").trim();
    if (!texto) return replyLocal(mensajeActual);
    const pedirHumano = /\[\[HUMANO\]\]/i.test(texto);
    texto = texto.replace(/\[\[HUMANO\]\]/gi, "").trim();
    return { texto, pedirHumano };
  } catch {
    return replyLocal(mensajeActual);
  }
}
