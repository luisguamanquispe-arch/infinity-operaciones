import { prisma } from "@/lib/prisma";

const ARTICULOS = [
  {
    titulo: "Reinicio remoto de router Huawei HG8245",
    categoria: "Router",
    marca: "Huawei",
    tags: "huawei,reinicio,router,gpon",
    contenido:
      "1. Acceder al ACS/TR-069 o interfaz remota.\n2. Confirmar que la ONU está online.\n3. Ejecutar reboot del CPE.\n4. Esperar 3-5 min para reconexión PPPoE.\n5. Validar velocidad y potencia óptica.",
  },
  {
    titulo: "Cambio de SSID y clave WiFi en Mikrotik",
    categoria: "WiFi",
    marca: "Mikrotik",
    tags: "mikrotik,wifi,ssid,password",
    contenido:
      "Desde Winbox/API: /interface wireless security-profile y /interface wireless. Actualizar SSID y WPA2. Registrar cambio en auditoría Help Desk.",
  },
  {
    titulo: "Diagnóstico LOS roja en ONU ZTE",
    categoria: "GPON",
    marca: "ZTE",
    tags: "zte,gpon,los,onu",
    contenido:
      "LOS roja indica pérdida de señal óptica. Verificar conector SC/APC, curvatura de fibra, potencia en OLT. Si RX < -27 dBm escalar a campo.",
  },
  {
    titulo: "Optimización de canal WiFi 2.4 GHz",
    categoria: "WiFi",
    marca: "TP-Link",
    tags: "tp-link,wifi,canal,2.4ghz",
    contenido:
      "Usar canales 1, 6 u 11 sin solapamiento. Evitar ancho 40 MHz en 2.4 GHz si hay interferencia. Separar bandas 2.4 y 5 GHz para clientes exigentes.",
  },
  {
    titulo: "Procedimiento Speed Test estándar ISP",
    categoria: "Diagnóstico",
    marca: null,
    tags: "speedtest,diagnostico,velocidad",
    contenido:
      "Cable Ethernet directo al router cuando sea posible. Cerrar descargas activas. Comparar con 80% del plan contratado. Documentar resultado en ticket.",
  },
  {
    titulo: "GPON: rangos de potencia óptica",
    categoria: "GPON",
    marca: null,
    tags: "gpon,potencia,rx,tx",
    contenido:
      "RX típico: -8 a -27 dBm. Fuera de rango: revisar empalmes, conectores y splitter. Incidente masivo si múltiples ONUs en mismo PON reportan falla.",
  },
  {
    titulo: "EPON vs GPON — referencia rápida",
    categoria: "Fibra",
    marca: null,
    tags: "epon,gpon,fibra",
    contenido:
      "GPON: estándar ITU-T G.984, downstream 2.5 Gbps. EPON: IEEE 802.3ah. Verificar tipo de OLT antes de provisionar ONU.",
  },
  {
    titulo: "WiFi 6 (802.11ax) — buenas prácticas",
    categoria: "WiFi",
    marca: null,
    tags: "wifi6,802.11ax",
    contenido:
      "Habilitar OFDMA y BSS Color si el CPE lo soporta. Preferir 5 GHz para streaming. Actualizar firmware del router periódicamente.",
  },
  {
    titulo: "Escalamiento a campo — criterios internos",
    categoria: "Procedimiento",
    marca: null,
    tags: "escalamiento,campo,procedimiento",
    contenido:
      "Escalar cuando: fibra rota, NAP dañada, ONU/router físicamente dañado, sin potencia en domicilio tras remoto, o cliente requiere mudanza/instalación.",
  },
  {
    titulo: "Ubiquiti UFiber — estado PON",
    categoria: "GPON",
    marca: "Ubiquiti",
    tags: "ubiquiti,ufiber,pon",
    contenido:
      "Verificar en OLT: estado online, distancia, temperatura. En cliente validar LED PON verde fijo. Parpadeo: sincronización o falla.",
  },
];

export async function seedConocimientoHelpDesk() {
  const count = await prisma.hdArticuloConocimiento.count();
  if (count > 0) return { creados: 0, existentes: count };

  await prisma.hdArticuloConocimiento.createMany({ data: ARTICULOS });
  return { creados: ARTICULOS.length, existentes: 0 };
}
