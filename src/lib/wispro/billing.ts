/**
 * Facturación vía Wispro (solo servidor).
 * Sin credenciales: genera facturas/pagos demo determinísticos por cédula.
 */

export type ClienteInvoice = {
  id: string;
  numero: string;
  periodo: string;
  emision: string;
  vencimiento: string;
  monto: number;
  saldo: number;
  estado: "PENDIENTE" | "PAGADA" | "VENCIDA" | "PARCIAL";
  pdfUrl: string | null;
  fuente: "wispro" | "local";
};

export type ClientePayment = {
  id: string;
  fecha: string;
  monto: number;
  metodo: string;
  referencia: string | null;
  facturaNumero: string | null;
  fuente: "wispro" | "local";
};

function hashSeed(input: string): number {
  let h = 0;
  for (let i = 0; i < input.length; i++) h = (h * 31 + input.charCodeAt(i)) >>> 0;
  return h || 1;
}

function monthLabel(d: Date): string {
  return d.toLocaleDateString("es-EC", { month: "long", year: "numeric" });
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Stub local: 3 facturas + pagos recientes. */
export async function fetchWisproBilling(opts: {
  clienteId: string;
  cedula: string;
  plan: string;
}): Promise<{
  saldoPendiente: number;
  invoices: ClienteInvoice[];
  payments: ClientePayment[];
  fuente: "wispro" | "local";
}> {
  const apiUrl = process.env.WISPRO_API_URL?.trim();
  const apiToken = process.env.WISPRO_API_TOKEN?.trim();

  if (apiUrl && apiToken) {
    try {
      void opts.cedula;
      // Contrato: implementar listado real cuando existan endpoints Wispro documentados.
    } catch (err) {
      console.warn("[wispro billing] fallback local", err);
    }
  }

  const seed = hashSeed(opts.cedula || opts.clienteId);
  const planFee = (() => {
    const m = opts.plan.match(/(\d+)/);
    const mbps = m ? parseInt(m[1], 10) : 50;
    return Math.max(18, Math.round(mbps * 0.35));
  })();

  const now = new Date();
  const invoices: ClienteInvoice[] = [];
  const payments: ClientePayment[] = [];

  for (let i = 0; i < 3; i++) {
    const emision = new Date(now.getFullYear(), now.getMonth() - i, 5);
    const vencimiento = new Date(now.getFullYear(), now.getMonth() - i, 15);
    const numero = `FAC-${emision.getFullYear()}${String(emision.getMonth() + 1).padStart(2, "0")}-${String(
      (seed + i) % 9000 + 1000
    )}`;
    const monto = planFee + (i === 0 ? (seed % 5) : 0);
    let estado: ClienteInvoice["estado"] = "PAGADA";
    let saldo = 0;
    if (i === 0) {
      estado = vencimiento < now ? "VENCIDA" : "PENDIENTE";
      saldo = monto;
    } else if (i === 1 && seed % 3 === 0) {
      estado = "PARCIAL";
      saldo = Math.round(monto * 0.4);
    }

    invoices.push({
      id: `inv_${opts.clienteId}_${i}`,
      numero,
      periodo: monthLabel(emision),
      emision: isoDate(emision),
      vencimiento: isoDate(vencimiento),
      monto,
      saldo,
      estado,
      pdfUrl: null,
      fuente: "local",
    });

    if (estado === "PAGADA" || estado === "PARCIAL") {
      const pagoFecha = new Date(emision);
      pagoFecha.setDate(pagoFecha.getDate() + 8);
      payments.push({
        id: `pay_${opts.clienteId}_${i}`,
        fecha: isoDate(pagoFecha),
        monto: estado === "PARCIAL" ? monto - saldo : monto,
        metodo: seed % 2 === 0 ? "Transferencia" : "Efectivo / caja",
        referencia: `TRX-${(seed + i * 17) % 99999}`,
        facturaNumero: numero,
        fuente: "local",
      });
    }
  }

  const saldoPendiente = invoices.reduce((a, inv) => a + inv.saldo, 0);

  return {
    saldoPendiente,
    invoices,
    payments: payments.sort((a, b) => (a.fecha < b.fecha ? 1 : -1)),
    fuente: "local",
  };
}
