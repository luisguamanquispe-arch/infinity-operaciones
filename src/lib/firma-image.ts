import { mediaApiUrlFromPath } from "@/lib/media-url";

type FirmaRecord = {
  nombreCliente: string;
  cedula: string;
  imagenUrl: string;
  firmadoEn: Date;
  lat: number | null;
  lng: number | null;
  aceptacionCondiciones?: boolean;
  textoAceptacion?: string | null;
  aceptadoEn?: Date | null;
};

export type FirmaParaReporte = Omit<FirmaRecord, "firmadoEn" | "aceptadoEn"> & {
  firmadoEn: string;
  imagenSrc: string;
  aceptacionCondiciones: boolean;
  textoAceptacion: string | null;
  aceptadoEn: string | null;
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
    aceptacionCondiciones: !!firma.aceptacionCondiciones,
    textoAceptacion: firma.textoAceptacion ?? null,
    aceptadoEn: firma.aceptadoEn ? firma.aceptadoEn.toISOString() : null,
  };
}
