import { wavDurationSeconds } from './wav';
import { wavOf } from './wav.fixture';

describe('wavDurationSeconds', () => {
  it('reads the length from the byte rate and data size', () => {
    expect(wavDurationSeconds(wavOf(2.5))).toBeCloseTo(2.5, 3);
  });

  it('skips chunks it does not need, including odd-sized ones', () => {
    expect(wavDurationSeconds(wavOf(1.2, 22_050, true))).toBeCloseTo(1.2, 3);
  });

  it('trusts the bytes present over a placeholder data size', () => {
    const wav = wavOf(1);
    wav.writeUInt32LE(0xffffffff, wav.indexOf('data') + 4);
    expect(wavDurationSeconds(wav)).toBeCloseTo(1, 3);
  });

  it('rejects anything that is not a WAV', () => {
    expect(wavDurationSeconds(Buffer.from('ID3 not a wav at all'))).toBeNull();
    expect(wavDurationSeconds(Buffer.alloc(0))).toBeNull();
  });
});
