import { mediaApiUrlFromPath } from "@/lib/media-url";

type FirmaRecord = {
  nombreCliente: string;
  cedula: string;
  imagenUrl: string;
  firmadoEn: Date;
  lat: number | null;
  lng: number | null;
};

export type FirmaParaReporte = Omit<FirmaRecord, "firmadoEn"> & {
  firmadoEn: string;
  imagenSrc: string;
};

export function firmaImagenSrcRapida(firma: { imagenUrl: string } | null): string | null {
  if (!firma) return null;
  return mediaApiUrlFromPath(firma.imagenUrl) || firma.imagenUrl;
}

export function firmaParaReporte(firma: FirmaRecord | null): FirmaParaReporte | null {
  if (!firma) return null;
  return {
    nombreCliente: firma.nombreCliente,
    cedula: firma.cedula,
    imagenUrl: firma.imagenUrl,
    firmadoEn: firma.firmadoEn.toISOString(),
    lat: firma.lat,
    lng: firma.lng,
    imagenSrc: mediaApiUrlFromPath(firma.imagenUrl) || firma.imagenUrl,
  };
}
