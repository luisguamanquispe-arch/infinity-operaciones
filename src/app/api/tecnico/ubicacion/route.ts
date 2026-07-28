import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getFullSession } from "@/lib/auth";

export const runtime = "nodejs";

const MIN_INTERVAL_MS = 8_000;
const MIN_MOVE_METERS = 15;

function haversineM(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Actualiza GPS en vivo del técnico (mapa supervisor). */
export async function PATCH(request: Request) {
  const session = await getFullSession();
  if (!session || session.rol !== "TECNICO" || !session.tecnicoId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  let body: { lat?: unknown; lng?: unknown; precision?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const lat = Number(body.lat);
  const lng = Number(body.lng);
  const precision =
    body.precision == null || body.precision === ""
      ? null
      : Number(body.precision);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json({ error: "lat/lng inválidos" }, { status: 400 });
  }
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return NextResponse.json({ error: "Coordenadas fuera de rango" }, { status: 400 });
  }

  const tecnicoId = session.tecnicoId;
  const actual = await prisma.tecnico.findUnique({
    where: { id: tecnicoId },
    select: { lat: true, lng: true },
  });

  const last = await prisma.ubicacionGps.findFirst({
    where: { tecnicoId },
    orderBy: { timestamp: "desc" },
    select: { timestamp: true, lat: true, lng: true },
  });

  const ahora = Date.now();
  if (last && ahora - last.timestamp.getTime() < MIN_INTERVAL_MS) {
    // Aun así actualiza lat/lng en Tecnico si se movió bastante
    const moved =
      actual?.lat != null && actual?.lng != null
        ? haversineM({ lat: actual.lat, lng: actual.lng }, { lat, lng })
        : Infinity;
    if (moved < MIN_MOVE_METERS) {
      return NextResponse.json({ ok: true, skipped: true, reason: "throttle" });
    }
  }

  await prisma.tecnico.update({
    where: { id: tecnicoId },
    data: { lat, lng },
  });

  await prisma.ubicacionGps.create({
    data: {
      tecnicoId,
      lat,
      lng,
      precision: Number.isFinite(precision as number) ? (precision as number) : null,
    },
  });

  // Limpieza ligera: conservar últimas ~200 lecturas por técnico
  const viejas = await prisma.ubicacionGps.findMany({
    where: { tecnicoId },
    orderBy: { timestamp: "desc" },
    skip: 200,
    select: { id: true },
    take: 50,
  });
  if (viejas.length > 0) {
    await prisma.ubicacionGps.deleteMany({
      where: { id: { in: viejas.map((v) => v.id) } },
    });
  }

  return NextResponse.json({ ok: true, lat, lng, ts: ahora });
}
