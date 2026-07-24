/**
 * Adapter Wispro — solo invocable desde el servidor (Infinity Soporte).
 * Sin credenciales: usa datos locales del CRM (stub).
 */

export type WisproServiceSnapshot = {
  plan: string;
  velocidadMbps: number | null;
  estadoServicio: "ACTIVO" | "SUSPENDIDO" | "PENDIENTE" | "DESCONOCIDO";
  estadoConexion: "ONLINE" | "OFFLINE" | "DESCONOCIDO";
  fechaCorte: string | null;
  saldoPendiente: number;
  ultimoPago: { monto: number; fecha: string; referencia: string | null } | null;
  ip: string | null;
  mac: string | null;
  router: string | null;
  onu: string | null;
  potenciaOptica: number | null;
  tiempoConectadoHoras: number | null;
  consumoGbMes: number | null;
  fuente: "wispro" | "local";
};

function parseVelocidadFromPlan(plan: string): number | null {
  const m = plan.match(/(\d+)\s*(mbps|mb)/i);
  return m ? parseInt(m[1], 10) : null;
}

export async function fetchWisproServiceByCliente(opts: {
  clienteId: string;
  cedula: string;
  plan: string;
  potencia: number | null;
  onuSerial: string | null;
  activo: boolean;
}): Promise<WisproServiceSnapshot> {
  const apiUrl = process.env.WISPRO_API_URL?.trim();
  const apiToken = process.env.WISPRO_API_TOKEN?.trim();

  if (apiUrl && apiToken) {
    try {
      // Contrato listo: cuando haya credenciales, implementar GET real aquí.
      // Por ahora no llamamos a endpoints no documentados.
      void opts.cedula;
    } catch (err) {
      console.warn("[wispro] fallback local", err);
    }
  }

  return {
    plan: opts.plan,
    velocidadMbps: parseVelocidadFromPlan(opts.plan),
    estadoServicio: opts.activo ? "ACTIVO" : "SUSPENDIDO",
    estadoConexion: opts.activo ? "ONLINE" : "OFFLINE",
    fechaCorte: null,
    saldoPendiente: 0,
    ultimoPago: null,
    ip: null,
    mac: null,
    router: null,
    onu: opts.onuSerial,
    potenciaOptica: opts.potencia,
    tiempoConectadoHoras: null,
    consumoGbMes: null,
    fuente: "local",
  };
}
