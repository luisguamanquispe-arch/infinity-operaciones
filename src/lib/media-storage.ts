import { getEnv } from "./env";
import { saveUpload } from "./storage";

/** URL lógica servida por /api/media cuando la imagen vive en BD. */
export function logicalMediaUrl(ticketId: string, filename: string): string {
  return `/api/media/${ticketId}/${filename}`;
}

/** En Render/local efímero solo BD; en S3 también sube al bucket. */
export async function persistTicketImage(
  ticketId: string,
  filename: string,
  buffer: Buffer
): Promise<string> {
  const env = getEnv();
  if (env.UPLOAD_STORAGE === "s3") {
    return saveUpload(buffer, ticketId, filename);
  }
  return logicalMediaUrl(ticketId, filename);
}
