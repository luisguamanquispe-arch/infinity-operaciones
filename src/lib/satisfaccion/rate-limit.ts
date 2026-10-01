const hits = new Map<string, number[]>();

export function limitarTasa(clave: string, max: number, ventanaMs: number): boolean {
  const ahora = Date.now();
  const prev = (hits.get(clave) || []).filter((t) => ahora - t < ventanaMs);
  if (prev.length >= max) {
    hits.set(clave, prev);
    return false;
  }
  prev.push(ahora);
  hits.set(clave, prev);
  if (hits.size > 5000) {
    const primero = hits.keys().next().value;
    if (primero) hits.delete(primero);
  }
  return true;
}

export function ipDeRequest(request: Request): string {
  const fwd = request.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]?.trim() || "desconocida";
  return request.headers.get("x-real-ip") || "desconocida";
}
