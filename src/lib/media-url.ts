/** Resuelve URL de imagen servida por /api/media (sin cargar base64 en memoria). */
export function mediaApiUrlFromPath(url: string): string | null {
  if (url.startsWith("/api/media/")) return url;
  const match = url.match(/^\/uploads\/([^/]+)\/([^/?#]+)$/);
  if (!match) return null;
  return `/api/media/${match[1]}/${match[2]}`;
}
