/** Comprime fotos de cámara móvil antes de subir (evita timeout/503 en Render). */
export async function compressImageFile(
  file: File,
  maxWidth = 1280,
  quality = 0.72
): Promise<string> {
  if (typeof createImageBitmap !== "undefined") {
    try {
      const bitmap = await createImageBitmap(file);
      const scale = Math.min(1, maxWidth / Math.max(bitmap.width, bitmap.height));
      const w = Math.max(1, Math.round(bitmap.width * scale));
      const h = Math.max(1, Math.round(bitmap.height * scale));
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("canvas");
      ctx.drawImage(bitmap, 0, 0, w, h);
      bitmap.close();
      return canvas.toDataURL("image/jpeg", quality);
    } catch {
      /* fallback abajo */
    }
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const scale = Math.min(1, maxWidth / Math.max(img.width, img.height));
      const w = Math.max(1, Math.round(img.width * scale));
      const h = Math.max(1, Math.round(img.height * scale));
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("canvas"));
        return;
      }
      ctx.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("No se pudo leer la imagen"));
    };
    img.src = objectUrl;
  });
}

export async function fetchWithRetry(
  input: RequestInfo,
  init: RequestInit,
  retries = 2
): Promise<Response> {
  let last: Response | null = null;
  for (let i = 0; i <= retries; i++) {
    const res = await fetch(input, init);
    last = res;
    if (res.ok) return res;
    if (![502, 503, 504].includes(res.status) || i === retries) return res;
    await new Promise((r) => setTimeout(r, 1500 * (i + 1)));
  }
  return last!;
}
