import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { ReelLanguage } from '@marketpilot/contracts';
import type { Env } from '@/config';
import { MusicPort, SpeechPort, type GeneratedAudio } from '@/infra/llm-providers';
import { composeMusicPrompt, musicSeed, voiceFor } from './tasks/reel/reel-sound-prompt';

export interface ReelMusicBrief {
  reelId: string;
  mood: string;
  lengthSeconds: number;
}

// The door to reel sound (ADR 0013): callers hand over a mood or a line, never a model or voice.
@Injectable()
export class SoundService {
  private readonly logger = new Logger(SoundService.name);
  private readonly musicModel: string;

  constructor(
    private readonly music: MusicPort,
    private readonly speech: SpeechPort,
    config: ConfigService<Env, true>,
  ) {
    this.musicModel = config.get('OPENROUTER_MODEL_MUSIC', { infer: true });
  }

  get musicAvailable(): boolean {
    return this.music.available;
  }

  get voiceAvailable(): boolean {
    return this.speech.available;
  }

  async composeReelMusic(brief: ReelMusicBrief): Promise<GeneratedAudio> {
    const started = Date.now();
    const track = await this.music.compose({
      task: 'reel.music',
      model: this.musicModel,
      prompt: composeMusicPrompt(brief.mood, brief.lengthSeconds),
      seed: musicSeed(brief.reelId),
    });
    this.logger.log(
      `reel.music model=${this.musicModel} bytes=${track.bytes.length} cost=${track.costUsd ?? 'unknown'} latency=${Date.now() - started}ms`,
    );
    return track;
  }

  async speakReelLine(text: string, language: ReelLanguage): Promise<GeneratedAudio> {
    const started = Date.now();
    const line = await this.speech.speak({ task: 'reel.voiceover', text, ...voiceFor(language) });
    this.logger.log(
      `reel.voiceover chars=${text.length} seconds=${line.durationSeconds?.toFixed(2)} latency=${Date.now() - started}ms`,
    );
    return line;
  }
}
