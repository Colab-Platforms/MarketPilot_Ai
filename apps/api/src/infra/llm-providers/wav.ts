// Reads a RIFF/WAVE file's length from its `fmt ` byte rate and `data` size. Returns null for
// anything that is not a well-formed WAV, so a bad answer is caught before ffmpeg sees it.
export function wavDurationSeconds(bytes: Buffer): number | null {
  if (bytes.length < 12 || bytes.toString('ascii', 0, 4) !== 'RIFF' || bytes.toString('ascii', 8, 12) !== 'WAVE') {
    return null;
  }
  let byteRate: number | null = null;
  let offset = 12;
  while (offset + 8 <= bytes.length) {
    const id = bytes.toString('ascii', offset, offset + 4);
    const size = bytes.readUInt32LE(offset + 4);
    const body = offset + 8;
    if (id === 'fmt ' && body + 12 <= bytes.length) byteRate = bytes.readUInt32LE(body + 8);
    if (id === 'data') {
      if (!byteRate) return null;
      // Streamed WAVs may carry a placeholder size; the bytes actually present are the truth.
      const dataBytes = Math.min(size, bytes.length - body);
      return dataBytes / byteRate;
    }
    offset = body + size + (size % 2);
  }
  return null;
}
