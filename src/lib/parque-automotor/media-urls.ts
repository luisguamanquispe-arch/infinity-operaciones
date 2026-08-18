export type MediaVehiculoKind =
  | "carga"
  | "novfoto"
  | "inspfoto"
  | "mantfoto"
  | "fotoveh";

export function parseMediaVehiculoFilename(
  filename: string
): { kind: MediaVehiculoKind; id: string } | null {
  if (!filename || filename.includes("..") || filename.includes("/") || filename.includes("\\")) {
    return null;
  }
  const m = filename.match(
    /^(carga|novfoto|inspfoto|mantfoto|fotoveh)-([a-z0-9]+)\.(jpe?g|png|webp)$/i
  );
  if (!m) return null;
  return { kind: m[1].toLowerCase() as MediaVehiculoKind, id: m[2] };
}

export function urlCargaFactura(vehiculoId: string, cargaId: string) {
  return `/api/media/vehiculos/${vehiculoId}/carga-${cargaId}.jpg`;
}

export function urlFotoNovedad(vehiculoId: string, fotoId: string) {
  return `/api/media/vehiculos/${vehiculoId}/novfoto-${fotoId}.jpg`;
}

export function urlFotoInspeccion(vehiculoId: string, fotoId: string) {
  return `/api/media/vehiculos/${vehiculoId}/inspfoto-${fotoId}.jpg`;
}

export function urlFotoMantenimiento(vehiculoId: string, fotoId: string) {
  return `/api/media/vehiculos/${vehiculoId}/mantfoto-${fotoId}.jpg`;
}

export function urlFotoVehiculo(vehiculoId: string, fotoId: string) {
  return `/api/media/vehiculos/${vehiculoId}/fotoveh-${fotoId}.jpg`;
}
