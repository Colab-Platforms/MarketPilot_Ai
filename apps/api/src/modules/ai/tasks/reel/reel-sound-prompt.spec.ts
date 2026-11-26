import { composeMusicPrompt, musicSeed, voiceFor } from './reel-sound-prompt';

describe('composeMusicPrompt', () => {
  it('asks for instrumental music for the reel length and mood', () => {
    const prompt = composeMusicPrompt('Energetic\n  desi pop with tabla', 15);
    expect(prompt).toContain('15-second Instagram Reel');
    expect(prompt).toContain('Mood: Energetic desi pop with tabla.');
    expect(prompt).toContain('no vocals, no lyrics');
  });

  it('caps a runaway mood and fills in an empty one', () => {
    expect(composeMusicPrompt('x'.repeat(1_000), 30).length).toBeLessThan(400);
    expect(composeMusicPrompt('   ', 30)).toContain('Mood: Warm, upbeat and modern.');
  });
});

describe('musicSeed', () => {
  it('is the same for a reel every time and differs between reels', () => {
    const id = '01a1fcb3-0000-7000-8000-000000000001';
    expect(musicSeed(id)).toBe(musicSeed(id));
    expect(musicSeed(id)).not.toBe(musicSeed('01a1fcb3-0000-7000-8000-000000000002'));
    expect(musicSeed(id)).toBeGreaterThanOrEqual(0);
  });
});

describe('voiceFor', () => {
  it('speaks Hinglish with the code-mixed persona and Hindi with a Hindi ad voice', () => {
    expect(voiceFor('hinglish')).toEqual({ language: 'hi-IN', voice: 'shubh_enhi_ads' });
    expect(voiceFor('hindi').language).toBe('hi-IN');
    expect(voiceFor('english').language).toBe('en-IN');
  });
});
