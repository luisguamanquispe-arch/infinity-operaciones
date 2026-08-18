import { prisma } from "@/lib/prisma";
import { getEnv } from "@/lib/env";
import { saveUpload } from "@/lib/storage";
import { parseMediaVehiculoFilename } from "./media-urls";

export {
  parseMediaVehiculoFilename,
  urlCargaFactura,
  urlFotoInspeccion,
  urlFotoMantenimiento,
  urlFotoNovedad,
  urlFotoVehiculo,
} from "./media-urls";
export type { MediaVehiculoKind } from "./media-urls";

export const MAX_IMAGE_CHARS = 900_000;
export const MAX_FOTOS_NOVEDAD = 6;
export const MAX_FOTOS_REGISTRO = 6;

export function normalizarDataUrl(image: string): string {
  if (image.startsWith("data:image")) return image;
  return `data:image/jpeg;base64,${image.replace(/^data:image\/\w+;base64,/, "")}`;
}

export function validarImagenDataUrl(image: string): { ok: true; dataUrl: string } | { ok: false; error: string; status: number } {
  if (!image || typeof image !== "string") {
    return { ok: false, error: "Imagen inválida.", status: 400 };
  }
  const dataUrl = normalizarDataUrl(image);
  if (!dataUrl.startsWith("data:image")) {
    return { ok: false, error: "Imagen inválida.", status: 400 };
  }
  if (dataUrl.length > MAX_IMAGE_CHARS) {
    return {
      ok: false,
      error: "Imagen muy grande. Acérquese más o use menos zoom.",
      status: 413,
    };
  }
  return { ok: true, dataUrl };
}

/** Guarda JPEG de parque: S3 si está configurado; si no, data URL para /api/media/vehiculos. No toca tickets. */
export async function persistVehiculoImage(
  vehiculoId: string,
  filename: string,
  image: string
): Promise<{ url: string; imagenData: string | null }> {
  const v = validarImagenDataUrl(image);
  if (!v.ok) {
    const err = new Error(v.error) as Error & { status: number };
    err.status = v.status;
    throw err;
  }
  const env = getEnv();
  const base64 = v.dataUrl.replace(/^data:image\/\w+;base64,/, "");
  const buffer = Buffer.from(base64, "base64");
  if (env.UPLOAD_STORAGE === "s3") {
    const url = await saveUpload(buffer, `vehiculos/${vehiculoId}`, filename);
    return { url, imagenData: null };
  }
  return {
    url: `/api/media/vehiculos/${vehiculoId}/${filename}`,
    imagenData: v.dataUrl,
  };
}

function dataUrlFromCampo(data: string | null | undefined, fallbackUrl?: string | null) {
  if (data?.startsWith("data:image")) return { dataUrl: data } as const;
  if (fallbackUrl && /^https?:\/\//i.test(fallbackUrl)) {
    return { redirect: fallbackUrl } as const;
  }
  return null;
}

export async function leerImagenParque(
  vehiculoId: string,
  filename: string
): Promise<{ dataUrl: string } | { redirect: string } | null> {
  const parsed = parseMediaVehiculoFilename(filename);
  if (parsed?.kind === "carga") {
    const row = await prisma.cargaCombustible.findFirst({
      where: { id: parsed.id, vehiculoId },
      select: { comprobanteData: true, comprobanteUrl: true },
    });
    return row ? dataUrlFromCampo(row.comprobanteData, row.comprobanteUrl) : null;
  }
  if (parsed?.kind === "novfoto") {
    const row = await prisma.novedadVehiculoFoto.findFirst({
      where: { id: parsed.id, novedad: { vehiculoId } },
      select: { imagenData: true, url: true },
    });
    return row ? dataUrlFromCampo(row.imagenData, row.url) : null;
  }
  if (parsed?.kind === "inspfoto") {
    const row = await prisma.inspeccionVehiculoFoto.findFirst({
      where: { id: parsed.id, inspeccion: { vehiculoId } },
      select: { imagenData: true, url: true },
    });
    return row ? dataUrlFromCampo(row.imagenData, row.url) : null;
  }
  if (parsed?.kind === "mantfoto") {
    const row = await prisma.mantenimientoVehiculoFoto.findFirst({
      where: { id: parsed.id, mantenimiento: { vehiculoId } },
      select: { imagenData: true, url: true },
    });
    return row ? dataUrlFromCampo(row.imagenData, row.url) : null;
  }
  if (parsed?.kind === "fotoveh") {
    const row = await prisma.fotoVehiculo.findFirst({
      where: { id: parsed.id, vehiculoId },
      select: { imagenData: true, url: true },
    });
    return row ? dataUrlFromCampo(row.imagenData, row.url) : null;
  }

  const suff = `/${filename}`;
  const uniques: Array<{ data: string | null; url: string | null }> = [];

  const foto = await prisma.fotoVehiculo.findFirst({
    where: { vehiculoId, url: { endsWith: suff } },
    select: { imagenData: true, url: true },
  });
  if (foto) uniques.push({ data: foto.imagenData, url: foto.url });

  const cargas = await prisma.cargaCombustible.findMany({
    where: { vehiculoId, comprobanteUrl: { endsWith: suff } },
    select: { comprobanteData: true, comprobanteUrl: true },
    take: 2,
  });
  for (const c of cargas) uniques.push({ data: c.comprobanteData, url: c.comprobanteUrl });

  const nov = await prisma.novedadVehiculoFoto.findMany({
    where: { url: { endsWith: suff }, novedad: { vehiculoId } },
    select: { imagenData: true, url: true },
    take: 2,
  });
  for (const n of nov) uniques.push({ data: n.imagenData, url: n.url });

  const insp = await prisma.inspeccionVehiculoFoto.findMany({
    where: { url: { endsWith: suff }, inspeccion: { vehiculoId } },
    select: { imagenData: true, url: true },
    take: 2,
  });
  for (const i of insp) uniques.push({ data: i.imagenData, url: i.url });

  const mant = await prisma.mantenimientoVehiculoFoto.findMany({
    where: { url: { endsWith: suff }, mantenimiento: { vehiculoId } },
    select: { imagenData: true, url: true },
    take: 2,
  });
  for (const m of mant) uniques.push({ data: m.imagenData, url: m.url });

  if (uniques.length !== 1) return null;
  return dataUrlFromCampo(uniques[0].data, uniques[0].url);
}
