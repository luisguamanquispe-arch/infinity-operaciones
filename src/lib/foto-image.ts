import { mediaApiUrlFromPath } from "@/lib/media-url";

type FotoRecord = {
  id: string;
  tipo: string;
  url: string;
  lat: number | null;
  lng: number | null;
  tomadaEn: Date;
};

export type FotoParaReporte = {
  id: string;
  tipo: string;
  url: string;
  lat: number | null;
  lng: number | null;
  tomadaEn: string;
  imagenSrc: string;
};

/** Enlace a imagen vía API — no incluye base64 (ahorra RAM en Render). */
export function fotoParaReporte(foto: FotoRecord): FotoParaReporte {
  return {
    id: foto.id,
    tipo: foto.tipo,
    url: foto.url,
    lat: foto.lat,
    lng: foto.lng,
    tomadaEn: foto.tomadaEn.toISOString(),
    imagenSrc: mediaApiUrlFromPath(foto.url) || foto.url,
  };
}

export function fotosParaReporte(fotos: FotoRecord[]): FotoParaReporte[] {
  return fotos.map(fotoParaReporte);
}

export function fotoImagenSrcRapida(foto: { url: string }): string {
  return mediaApiUrlFromPath(foto.url) || foto.url;
}
