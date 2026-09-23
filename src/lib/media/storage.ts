import crypto from "node:crypto";
import { put } from "@vercel/blob";

const maxBytes = 10 * 1024 * 1024;
const allowed: Record<string, string[]> = {
  image: ["image/jpeg", "image/png", "image/gif", "image/webp"],
  video: ["video/mp4", "video/quicktime", "video/webm"],
  audio: ["audio/mpeg", "audio/mp4", "audio/wav", "audio/ogg"],
  file: ["application/pdf", "text/plain", "text/csv", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
};
const extensions: Record<string, string> = {
  "image/jpeg": "jpg", "image/png": "png", "image/gif": "gif", "image/webp": "webp",
  "video/mp4": "mp4", "video/quicktime": "mov", "video/webm": "webm",
  "audio/mpeg": "mp3", "audio/mp4": "m4a", "audio/wav": "wav", "audio/ogg": "ogg",
  "application/pdf": "pdf", "text/plain": "txt", "text/csv": "csv",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
};

export async function storeLineMedia(messageId: string, type: string, response: Response) {
  if ((process.env.MEDIA_STORAGE_PROVIDER ?? "none") !== "vercel-blob" || !process.env.BLOB_READ_WRITE_TOKEN) return { stored: false as const, reason: "STORAGE_NOT_CONFIGURED" };
  const mimeType = (response.headers.get("content-type") ?? "application/octet-stream").split(";")[0].toLowerCase();
  if (!(allowed[type] ?? []).includes(mimeType)) return { stored: false as const, reason: "UNSAFE_MEDIA_TYPE", mimeType };
  const declaredSize = Number(response.headers.get("content-length") ?? 0);
  if (declaredSize > maxBytes) return { stored: false as const, reason: "MEDIA_TOO_LARGE", mimeType };
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength > maxBytes) return { stored: false as const, reason: "MEDIA_TOO_LARGE", mimeType };
  const key = `line-media/${new Date().toISOString().slice(0, 10)}/${crypto.createHash("sha256").update(messageId).digest("hex")}.${extensions[mimeType] ?? "bin"}`;
  const blob = await put(key, Buffer.from(bytes), { access: "private", addRandomSuffix: false, allowOverwrite: false, contentType: mimeType, token: process.env.BLOB_READ_WRITE_TOKEN });
  return { stored: true as const, key: blob.pathname, mimeType, size: bytes.byteLength };
}
