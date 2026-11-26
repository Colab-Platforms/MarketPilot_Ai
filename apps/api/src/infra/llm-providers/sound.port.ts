import { LlmError } from './llm.port';

export interface GeneratedAudio {
  bytes: Buffer;
  mediaType: 'audio/mpeg' | 'audio/wav';
  // Known for speech, which is timed against scenes; music is simply cut to the reel.
  durationSeconds: number | null;
  costUsd: number | null;
}

export interface MusicRequest {
  // For logs only; never sent to the provider.
  task: string;
  model: string;
  prompt: string;
  // The same seed and prompt give the same track, so re-assembling a reel keeps its music.
  seed: number;
}

export type SpeechLanguage = 'en-IN' | 'hi-IN';

export interface SpeechRequest {
  task: string;
  text: string;
  language: SpeechLanguage;
  voice: string;
}

// Background music for reels (ADR 0013). Reached only through modules/ai.
export abstract class MusicPort {
  abstract readonly available: boolean;
  abstract compose(request: MusicRequest): Promise<GeneratedAudio>;
}

// Spoken voiceover for reels (ADR 0013). Reached only through modules/ai.
export abstract class SpeechPort {
  abstract readonly available: boolean;
  abstract speak(request: SpeechRequest): Promise<GeneratedAudio>;
}

export class UnavailableMusicAdapter extends MusicPort {
  readonly available = false;
  compose(): Promise<GeneratedAudio> {
    return Promise.reject(new LlmError('unavailable', 'Music generation is not configured'));
  }
}

export class UnavailableSpeechAdapter extends SpeechPort {
  readonly available = false;
  speak(): Promise<GeneratedAudio> {
    return Promise.reject(new LlmError('unavailable', 'Voiceover is not configured'));
  }
}
