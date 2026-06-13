import { fetchWithRetry } from "@/lib/compress-image";

export async function fetchJson<T>(
  url: string,
  init?: RequestInit,
  retries = 2
): Promise<{ data: T | null; error: string | null; status: number }> {
  try {
    const res = await fetchWithRetry(url, { cache: "no-store", ...init }, retries);
    let json: unknown;
    try {
      json = await res.json();
    } catch {
      return {
        data: null,
        error: res.ok ? "Respuesta inválida del servidor" : `Error ${res.status}`,
        status: res.status,
      };
    }
    if (!res.ok) {
      const msg =
        json &&
        typeof json === "object" &&
        "error" in json &&
        typeof (json as { error: unknown }).error === "string"
          ? (json as { error: string }).error
          : `Error ${res.status}`;
      return { data: null, error: msg, status: res.status };
    }
    return { data: json as T, error: null, status: res.status };
  } catch {
    return {
      data: null,
      error: "No se pudo conectar. El servidor puede estar iniciando — intente de nuevo.",
      status: 0,
    };
  }
}
