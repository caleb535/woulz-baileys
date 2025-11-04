export default function getVideoLength(buffer: Buffer<ArrayBuffer>) {
  const start = buffer.indexOf(Buffer.from("mvhd")) + 16;
  const timeScale = buffer.readUInt32BE(start);
  const duration = buffer.readUInt32BE(start + 4);
  const movieLength = Math.floor(duration / timeScale);

  return movieLength;
}
