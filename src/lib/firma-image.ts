import { readFile } from "fs/promises";
import path from "path";

type FirmaRecord = {
  nombreCliente: string;
  cedula: string;
  imagenUrl: string;
  imagenData: string | null;
  firmadoEn: Date;
  lat: number | null;
  lng: number | null;
};

export type FirmaParaReporte = Omit<FirmaRecord, "firmadoEn"> & {
  firmadoEn: string;
  imagenSrc: string;
};

type FirmaMin = Pick<FirmaRecord, "imagenData" | "imagenUrl">;

/** Resuelve src para listados (sin leer disco). */
export function firmaImagenSrcRapida(firma: FirmaMin | null): string | null {
  if (!firma) return null;
  if (firma.imagenData) return firma.imagenData;
  if (firma.imagenUrl.startsWith("data:") || firma.imagenUrl.startsWith("http")) {
    return firma.imagenUrl;
  }
  return firma.imagenUrl;
}

export async function firmaParaReporte(
  firma: FirmaRecord | null
): Promise<FirmaParaReporte | null> {
  if (!firma) return null;

  let imagenSrc = firma.imagenData || "";

  if (!imagenSrc && firma.imagenUrl.startsWith("data:")) {
    imagenSrc = firma.imagenUrl;
  }

  if (!imagenSrc && firma.imagenUrl.startsWith("http")) {
    imagenSrc = firma.imagenUrl;
  }

  if (!imagenSrc && firma.imagenUrl.startsWith("/")) {
    try {
      const relative = firma.imagenUrl.replace(/^\//, "");
      const filePath = path.join(process.cwd(), "public", relative);
      const buffer = await readFile(filePath);
      imagenSrc = `data:image/png;base64,${buffer.toString("base64")}`;
    } catch {
      imagenSrc = firma.imagenUrl;
    }
  }

  if (!imagenSrc) {
    imagenSrc = firma.imagenUrl;
  }

  return {
    nombreCliente: firma.nombreCliente,
    cedula: firma.cedula,
    imagenUrl: firma.imagenUrl,
    imagenData: firma.imagenData,
    firmadoEn: firma.firmadoEn.toISOString(),
    lat: firma.lat,
    lng: firma.lng,
    imagenSrc,
  };
}
