import type { ReelLanguage } from '@marketpilot/contracts';
import type { SpeechLanguage } from '@/infra/llm-providers';

export const REEL_MUSIC_PROMPT_VERSION = 'reel.music@1';
export const REEL_VOICE_VERSION = 'reel.voice@1';

const MOOD_MAX_CHARS = 200;

// The idea's music mood is model-written, so it is flattened and capped; the rest is fixed.
// Instrumental only: a sung lyric would fight the voiceover and could not be checked for claims.
export function composeMusicPrompt(mood: string, lengthSeconds: number): string {
  const flat = mood.replace(/\s+/g, ' ').trim().slice(0, MOOD_MAX_CHARS) || 'Warm, upbeat and modern';
  return [
    `Background music for a ${lengthSeconds}-second Instagram Reel.`,
    `Mood: ${flat}.`,
    'Instrumental only, no vocals, no lyrics. A clear beat from the first second and a clean ending.',
  ].join(' ');
}

// Bulbul v4 Flash personas made for ads. Hinglish uses the Hindi-English code-mixed persona.
const VOICES: Record<ReelLanguage, { language: SpeechLanguage; voice: string }> = {
  english: { language: 'en-IN', voice: 'simran_en_customer' },
  hindi: { language: 'hi-IN', voice: 'ishita_hi_ads' },
  hinglish: { language: 'hi-IN', voice: 'shubh_enhi_ads' },
};

export const voiceFor = (language: ReelLanguage) => VOICES[language];

// A stable seed per reel, so assembling the same reel again keeps the same track.
export function musicSeed(reelId: string): number {
  let hash = 0;
  for (const char of reelId) hash = (Math.imul(hash, 31) + char.charCodeAt(0)) | 0;
  return Math.abs(hash);
}
