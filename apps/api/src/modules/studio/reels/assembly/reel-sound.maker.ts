import { Injectable, Logger } from '@nestjs/common';
import { NO_SOUND, type AssemblySound, type AssemblyVoiceLine } from '@/infra/media-assembly';
import { SoundService, type GeneratedAudio } from '@/modules/ai';
import type { RenderSound } from './assembly-inputs';

export interface MadeSound {
  sound: AssemblySound;
  costUsd: number;
}

// Generates a render's music and voice lines (ADR 0013). Sound makes a reel better but never
// blocks it: a part that fails is left out and logged, and the reel is assembled without it.
@Injectable()
export class ReelSoundMaker {
  private readonly logger = new Logger(ReelSoundMaker.name);

  constructor(private readonly sound: SoundService) {}

  // Renders queued before sound existed carry no plan and stay silent.
  async make(plan: RenderSound | undefined): Promise<MadeSound> {
    if (!plan) return { sound: NO_SOUND, costUsd: 0 };
    const [music, voice] = await Promise.all([this.music(plan), this.voice(plan)]);
    const costUsd =
      (music?.costUsd ?? 0) + voice.reduce((sum, line) => sum + (line.audio.costUsd ?? 0), 0);
    return {
      sound: {
        music: music?.bytes ?? null,
        voice: voice.map(
          (line): AssemblyVoiceLine => ({
            sceneIndex: line.sceneIndex,
            bytes: line.audio.bytes,
            durationSeconds: line.audio.durationSeconds ?? 0,
          }),
        ),
      },
      costUsd,
    };
  }

  private async music(plan: RenderSound): Promise<GeneratedAudio | null> {
    if (!plan.musicMood || !this.sound.musicAvailable) return null;
    try {
      return await this.sound.composeReelMusic({
        reelId: plan.reelId,
        mood: plan.musicMood,
        lengthSeconds: Math.round(plan.lengthSeconds),
      });
    } catch (error) {
      this.logger.warn(`Reel music skipped (${reason(error)})`);
      return null;
    }
  }

  private async voice(
    plan: RenderSound,
  ): Promise<{ sceneIndex: number; audio: GeneratedAudio }[]> {
    if (!this.sound.voiceAvailable) return [];
    const lines = plan.voiceovers.flatMap((text, sceneIndex) => (text ? [{ text, sceneIndex }] : []));
    const results = await Promise.allSettled(
      lines.map(async (line) => ({
        sceneIndex: line.sceneIndex,
        audio: await this.sound.speakReelLine(line.text, plan.language),
      })),
    );
    return results.flatMap((result) => {
      if (result.status === 'fulfilled') return [result.value];
      this.logger.warn(`A reel voiceover line was skipped (${reason(result.reason)})`);
      return [];
    });
  }
}

const reason = (error: unknown) => (error instanceof Error ? error.message : 'unknown');
