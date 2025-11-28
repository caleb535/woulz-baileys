export function bufferToBase64(buffer: Buffer | null, mimeType: string): string {
  if (!buffer) return "";
  return `data:${mimeType};base64,${buffer.toString("base64")}`;
}
