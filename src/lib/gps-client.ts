/** Lectura GPS del navegador sin coordenadas inventadas (antes Ambato). */

export type GpsCoords = { lat: number; lng: number; accuracy?: number };

export function leerGpsActual(opts?: {
  timeoutMs?: number;
  maximumAgeMs?: number;
  highAccuracy?: boolean;
}): Promise<GpsCoords | null> {
  if (typeof navigator === "undefined" || !navigator.geolocation) return Promise.resolve(null);

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        }),
      () => resolve(null),
      {
        enableHighAccuracy: opts?.highAccuracy ?? true,
        timeout: opts?.timeoutMs ?? 10000,
        maximumAge: opts?.maximumAgeMs ?? 15000,
      }
    );
  });
}

/** Envía ubicación al servidor (app técnico). */
export async function enviarUbicacionTecnico(coords: GpsCoords): Promise<boolean> {
  try {
    const res = await fetch("/api/tecnico/ubicacion", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        lat: coords.lat,
        lng: coords.lng,
        precision: coords.accuracy ?? null,
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
