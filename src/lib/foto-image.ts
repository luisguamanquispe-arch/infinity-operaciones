import { readFile } from "fs/promises";
import path from "path";

type FotoRecord = {
  id: string;
  tipo: string;
  url: string;
  imagenData: string | null;
  lat: number | null;
  lng: number | null;
  tomadaEn: Date;
};

export type FotoParaReporte = Omit<FotoRecord, "tomadaEn"> & {
  tomadaEn: string;
  imagenSrc: string;
};

function mediaApiUrl(url: string): string | null {
  const match = url.match(/^\/uploads\/([^/]+)\/([^/?#]+)$/);
  if (!match) return null;
  return `/api/media/${match[1]}/${match[2]}`;
}

export async function fotoParaReporte(foto: FotoRecord): Promise<FotoParaReporte> {
  let imagenSrc = foto.imagenData || "";

  if (!imagenSrc && (foto.url.startsWith("data:") || foto.url.startsWith("http"))) {
    imagenSrc = foto.url;
  }

  if (!imagenSrc && foto.url.startsWith("/")) {
    try {
      const relative = foto.url.replace(/^\//, "");
      const filePath = path.join(process.cwd(), "public", relative);
      const buffer = await readFile(filePath);
      const ext = path.extname(foto.url).toLowerCase();
      const mime = ext === ".png" ? "image/png" : "image/jpeg";
      imagenSrc = `data:${mime};base64,${buffer.toString("base64")}`;
    } catch {
      imagenSrc = mediaApiUrl(foto.url) || foto.url;
    }
  }

  if (!imagenSrc) {
    imagenSrc = foto.url;
  }

  return {
    id: foto.id,
    tipo: foto.tipo,
    url: foto.url,
    imagenData: foto.imagenData,
    lat: foto.lat,
    lng: foto.lng,
    tomadaEn: foto.tomadaEn.toISOString(),
    imagenSrc,
  };
}

export async function fotosParaReporte(fotos: FotoRecord[]): Promise<FotoParaReporte[]> {
  return Promise.all(fotos.map(fotoParaReporte));
}

/** Resuelve src para listados sin leer disco. */
export function fotoImagenSrcRapida(
  foto: Pick<FotoRecord, "imagenData" | "url">
): string {
  if (foto.imagenData) return foto.imagenData;
  if (foto.url.startsWith("data:") || foto.url.startsWith("http")) return foto.url;
  return mediaApiUrl(foto.url) || foto.url;
}
