import { prisma } from "@/lib/prisma";
import type { HdMensaje } from "@prisma/client";

export type SugerenciaIa = {
  tipo: "diagnostico" | "accion" | "respuesta" | "articulo";
  titulo: string;
  contenido: string;
};

const REGLAS_KEYWORDS: { patron: RegExp; sugerencias: SugerenciaIa[] }[] = [
  {
    patron: /lento|lentitud|velocidad|mbps/i,
    sugerencias: [
      { tipo: "accion", titulo: "Verificar plan", contenido: "Confirmar velocidad contratada vs. medida." },
      { tipo: "accion", titulo: "Speed test", contenido: "Ejecutar prueba de velocidad al router." },
      { tipo: "accion", titulo: "Potencia óptica", contenido: "Revisar RX/TX en ONU." },
      { tipo: "accion", titulo: "WiFi", contenido: "Revisar canal, dispositivos y banda 2.4/5 GHz." },
      { tipo: "accion", titulo: "Reinicio", contenido: "Reiniciar router de forma remota." },
    ],
  },
  {
    patron: /sin internet|no hay|no funciona|ca[ií]do|offline/i,
    sugerencias: [
      { tipo: "accion", titulo: "Estado ONU", contenido: "Verificar LOS/PON/POWER en ONU." },
      { tipo: "accion", titulo: "Potencia", contenido: "Consultar potencia óptica." },
      { tipo: "accion", titulo: "PPPoE", contenido: "Validar sesión PPPoE / enlace WAN." },
      { tipo: "accion", titulo: "Reinicio router", contenido: "Reinicio remoto del CPE." },
    ],
  },
  {
    patron: /wifi|clave|contraseña|ssid|red/i,
    sugerencias: [
      { tipo: "accion", titulo: "SSID", contenido: "Cambiar nombre de red WiFi." },
      { tipo: "accion", titulo: "Contraseña", contenido: "Actualizar clave WiFi." },
      { tipo: "accion", titulo: "Canal", contenido: "Optimizar canal WiFi." },
      { tipo: "articulo", titulo: "Guía WiFi", contenido: "Ver artículo: separación 2.4/5 GHz y Smart Connect." },
    ],
  },
  {
    patron: /los|luz roja|pon|fibra|potencia/i,
    sugerencias: [
      { tipo: "diagnostico", titulo: "Fibra", contenido: "Posible falla física o potencia fuera de rango." },
      { tipo: "accion", titulo: "Medición", contenido: "Consultar potencia óptica en OLT/ONU." },
      { tipo: "accion", titulo: "Escalamiento", contenido: "Evaluar visita si persiste LOS roja." },
    ],
  },
];

function sugerenciasPorReglas(texto: string): SugerenciaIa[] {
  const out: SugerenciaIa[] = [];
  for (const regla of REGLAS_KEYWORDS) {
    if (regla.patron.test(texto)) {
      out.push(...regla.sugerencias);
    }
  }
  if (out.length === 0) {
    out.push({
      tipo: "respuesta",
      titulo: "Saludo profesional",
      contenido:
        "Gracias por contactarnos. Voy a revisar su servicio y en un momento le indico los pasos a seguir.",
    });
  }
  return out.slice(0, 8);
}

/** Copiloto IA: OpenAI si hay API key; si no, reglas locales. */
export async function generarSugerenciasIa(
  conversacionId: string,
  mensajes: Pick<HdMensaje, "autor" | "contenido">[]
): Promise<SugerenciaIa[]> {
  const ultimos = mensajes.slice(-12);
  const textoCliente = ultimos
    .filter((m) => m.autor === "CLIENTE")
    .map((m) => m.contenido)
    .join("\n");

  const apiKey = process.env.OPENAI_API_KEY;
  let sugerencias: SugerenciaIa[];

  if (apiKey && textoCliente.trim()) {
    try {
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
                "Eres copiloto de un Help Desk ISP por fibra. Responde JSON array con objetos {tipo, titulo, contenido}. Tipos: diagnostico, accion, respuesta, articulo. Máximo 6 sugerencias prácticas en español.",
            },
            {
              role: "user",
              content: `Conversación:\n${ultimos.map((m) => `${m.autor}: ${m.contenido}`).join("\n")}`,
            },
          ],
        }),
      });
      if (res.ok) {
        const data = await res.json();
        const raw = data.choices?.[0]?.message?.content ?? "[]";
        const jsonMatch = raw.match(/\[[\s\S]*\]/);
        sugerencias = jsonMatch ? JSON.parse(jsonMatch[0]) : sugerenciasPorReglas(textoCliente);
      } else {
        sugerencias = sugerenciasPorReglas(textoCliente);
      }
    } catch {
      sugerencias = sugerenciasPorReglas(textoCliente);
    }
  } else {
    sugerencias = sugerenciasPorReglas(textoCliente);
  }

  await prisma.hdSugerenciaIa.createMany({
    data: sugerencias.map((s) => ({
      conversacionId,
      tipo: s.tipo,
      contenido: `${s.titulo}: ${s.contenido}`,
      metadataJson: JSON.stringify(s),
    })),
  });

  return sugerencias;
}

export async function generarResumenConversacion(
  mensajes: Pick<HdMensaje, "autor" | "contenido">[]
): Promise<string> {
  const lineas = mensajes.map((m) => `${m.autor}: ${m.contenido}`).join("\n");
  return `Resumen Help Desk:\n${lineas.slice(0, 2000)}`;
}
