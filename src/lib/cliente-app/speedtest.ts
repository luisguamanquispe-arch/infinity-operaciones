/**
 * Speed test INFINITY Connect — medición contra Infinity Soporte (no Wispro).
 */

export const SPEEDTEST_CHUNK_BYTES = 512 * 1024; // 512 KB
export const SPEEDTEST_MAX_BYTES = 2 * 1024 * 1024; // 2 MB cap por request
export const SPEEDTEST_DOWNLOAD_CHUNKS = 4;
export const SPEEDTEST_UPLOAD_BYTES = 512 * 1024;
export const SPEEDTEST_UPLOAD_ROUNDS = 2;
export const SPEEDTEST_PING_SAMPLES = 5;

export type SpeedTestCalidad = "BUENA" | "REGULAR" | "BAJA";

export function parseVelocidadMbpsFromPlan(plan: string): number | null {
  const m = plan.match(/(\d+)\s*(mbps|mb)?/i);
  return m ? parseInt(m[1], 10) : null;
}

export function clasificarCalidad(downloadMbps: number, planMbps: number | null): SpeedTestCalidad {
  if (!planMbps || planMbps <= 0) {
    if (downloadMbps >= 50) return "BUENA";
    if (downloadMbps >= 20) return "REGULAR";
    return "BAJA";
  }
  const ratio = downloadMbps / planMbps;
  if (ratio >= 0.7) return "BUENA";
  if (ratio >= 0.4) return "REGULAR";
  return "BAJA";
}

export function clampDownloadBytes(requested: number | null | undefined): number {
  const n = typeof requested === "number" && Number.isFinite(requested) ? requested : SPEEDTEST_CHUNK_BYTES;
  return Math.min(SPEEDTEST_MAX_BYTES, Math.max(64 * 1024, Math.floor(n)));
}

/** Buffer determinístico (evita compresión trivial de ceros). */
export function buildPayload(bytes: number): Buffer {
  const buf = Buffer.allocUnsafe(bytes);
  for (let i = 0; i < bytes; i++) {
    buf[i] = (i * 37 + 11) & 0xff;
  }
  return buf;
}

export function serializeSpeedResult(row: {
  id: string;
  pingMs: number | null;
  downloadMbps: number;
  uploadMbps: number;
  planMbps: number | null;
  calidad: string;
  servidor: string;
  plataforma: string | null;
  createdAt: Date;
}) {
  return {
    id: row.id,
    pingMs: row.pingMs,
    downloadMbps: row.downloadMbps,
    uploadMbps: row.uploadMbps,
    planMbps: row.planMbps,
    calidad: row.calidad,
    calidadLabel:
      row.calidad === "BUENA"
        ? "Buena"
        : row.calidad === "REGULAR"
          ? "Regular"
          : "Baja",
    servidor: row.servidor,
    plataforma: row.plataforma,
    createdAt: row.createdAt.toISOString(),
  };
}
