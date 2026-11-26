export interface AssemblyScene {
  // Public HTTPS URL of the scene's clip.
  clipUrl: string;
  // The clip is cut to this; clips are always rendered at least this long.
  durationSeconds: number;
  // Burned in over the scene, in any language or script. Null means no text.
  text: string | null;
}

export interface AssemblySpec {
  scenes: AssemblyScene[];
}

export interface AssemblyVoiceLine {
  sceneIndex: number;
  // WAV bytes.
  bytes: Buffer;
  durationSeconds: number;
}

// Generated sound for one assembly (ADR 0013). Either part may be missing; the reel is still made.
export interface AssemblySound {
  // MP3 bytes, cut to the reel's length.
  music: Buffer | null;
  voice: AssemblyVoiceLine[];
}

export const NO_SOUND: AssemblySound = { music: null, voice: [] };

export interface AssembledVideo {
  bytes: Buffer;
  mediaType: 'video/mp4';
  durationSeconds: number;
  width: number;
  height: number;
}

// Joins clips into one vertical reel with its captions (ADR 0012).
export abstract class AssemblyPort {
  abstract readonly available: boolean;
  abstract assemble(spec: AssemblySpec, sound?: AssemblySound): Promise<AssembledVideo>;
}
