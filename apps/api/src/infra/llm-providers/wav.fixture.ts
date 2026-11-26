// Test helper: a silent mono 16-bit PCM WAV of the given length, optionally with an odd-sized
// chunk before `data` as some encoders write.
export function wavOf(seconds: number, sampleRate = 24_000, extraChunk = false): Buffer {
  const dataBytes = Math.round(seconds * sampleRate) * 2;
  const fmt = Buffer.alloc(24);
  fmt.write('fmt ', 0, 'ascii');
  fmt.writeUInt32LE(16, 4);
  fmt.writeUInt16LE(1, 8);
  fmt.writeUInt16LE(1, 10);
  fmt.writeUInt32LE(sampleRate, 12);
  fmt.writeUInt32LE(sampleRate * 2, 16);
  fmt.writeUInt16LE(2, 20);
  fmt.writeUInt16LE(16, 22);
  const list = Buffer.from('LIST\u0003\u0000\u0000\u0000abc\u0000', 'latin1');
  const dataHeader = Buffer.alloc(8);
  dataHeader.write('data', 0, 'ascii');
  dataHeader.writeUInt32LE(dataBytes, 4);
  const body = Buffer.concat([fmt, ...(extraChunk ? [list] : []), dataHeader, Buffer.alloc(dataBytes)]);
  const riff = Buffer.alloc(12);
  riff.write('RIFF', 0, 'ascii');
  riff.writeUInt32LE(body.length + 4, 4);
  riff.write('WAVE', 8, 'ascii');
  return Buffer.concat([riff, body]);
}
