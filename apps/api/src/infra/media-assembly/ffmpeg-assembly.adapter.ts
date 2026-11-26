import { spawn } from 'node:child_process';
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  AssemblyPort,
  NO_SOUND,
  type AssembledVideo,
  type AssemblySound,
  type AssemblySpec,
} from './assembly.port';
import { FRAME, buildCaptions } from './ass-captions';
import { timeVoiceLines } from './voice-timing';

const FPS = 30;
const RUN_TIMEOUT_MS = 5 * 60_000;
const DOWNLOAD_TIMEOUT_MS = 120_000;
const MAX_CLIP_BYTES = 100 * 1024 * 1024;
const MAX_STDERR_CHARS = 2_000;
const AUDIO_FORMAT = 'aformat=sample_rates=44100:channel_layouts=stereo';
// Music sits well under speech when there is a voiceover, and carries the reel when there is not.
const MUSIC_UNDER_VOICE = 0.22;
const MUSIC_ALONE = 0.7;
const MUSIC_FADE_OUT_SECONDS = 1.5;

export interface SoundLayout {
  music: boolean;
  // Start time of each voice file, in file order.
  voiceStarts: number[];
}

const SILENT: SoundLayout = { music: false, voiceStarts: [] };

// Builds one reel with ffmpeg (ADR 0012). Everything happens in a private temporary folder that
// ffmpeg runs in, so filter arguments use plain relative names and never need path escaping.
export class FfmpegAssemblyAdapter extends AssemblyPort {
  readonly available = true;

  constructor(
    private readonly ffmpegPath: string,
    // The caption font file; its folder is handed to libass.
    private readonly fontFile: string,
  ) {
    super();
  }

  async assemble(spec: AssemblySpec, sound: AssemblySound = NO_SOUND): Promise<AssembledVideo> {
    if (spec.scenes.length === 0) throw new Error('A reel needs at least one scene');
    const dir = await mkdtemp(join(tmpdir(), 'reel-'));
    try {
      await Promise.all(
        spec.scenes.map((scene, i) => download(scene.clipUrl, join(dir, `clip${i}.mp4`))),
      );
      await writeFile(join(dir, 'captions.ass'), buildCaptions(spec.scenes), 'utf8');
      await mkdir(join(dir, 'fonts'));
      await copyFile(this.fontFile, join(dir, 'fonts', 'caption.ttf'));
      const total = spec.scenes.reduce((sum, s) => sum + s.durationSeconds, 0);
      const layout = await writeSound(dir, spec, sound);
      await this.run(dir, argsFor(spec, total, layout));
      const bytes = await readFile(join(dir, 'reel.mp4'));
      return { bytes, mediaType: 'video/mp4', durationSeconds: total, ...FRAME };
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  }

  private run(cwd: string, args: string[]): Promise<void> {
    return new Promise((resolve, reject) => {
      const child = spawn(this.ffmpegPath, args, { cwd, windowsHide: true });
      let stderr = '';
      child.stderr.on('data', (chunk: Buffer) => {
        stderr = (stderr + chunk.toString()).slice(-MAX_STDERR_CHARS);
      });
      const timer = setTimeout(() => child.kill('SIGKILL'), RUN_TIMEOUT_MS);
      child.on('error', (error) => {
        clearTimeout(timer);
        reject(error);
      });
      child.on('close', (code) => {
        clearTimeout(timer);
        if (code === 0) resolve();
        else
          reject(
            new Error(
              `ffmpeg exited with ${code}: ${stderr.trim().split('\n').slice(-3).join(' | ')}`,
            ),
          );
      });
    });
  }
}

// Writes the music and the voice lines that fit, and says where each line starts.
async function writeSound(dir: string, spec: AssemblySpec, sound: AssemblySound): Promise<SoundLayout> {
  const timed = timeVoiceLines(
    spec.scenes.map((s) => s.durationSeconds),
    sound.voice,
  );
  if (sound.music) await writeFile(join(dir, 'music.mp3'), sound.music);
  await Promise.all(
    timed.map((t, k) => writeFile(join(dir, `voice${k}.wav`), sound.voice[t.line]!.bytes)),
  );
  return { music: sound.music !== null, voiceStarts: timed.map((t) => t.startSeconds) };
}

// Each clip is cut to its scene, scaled to fill 9:16 and normalised so they join cleanly;
// captions go on after the join so their times are reel times. A silent track as long as the
// reel is always the base, because some players and upload APIs reject video without audio;
// music and voice lines are mixed onto it.
export function argsFor(
  spec: AssemblySpec,
  totalSeconds: number,
  sound: SoundLayout = SILENT,
): string[] {
  const n = spec.scenes.length;
  const musicInput = n + 1;
  const firstVoiceInput = sound.music ? n + 2 : n + 1;
  const inputs = [
    ...spec.scenes.flatMap((_, i) => ['-i', `clip${i}.mp4`]),
    '-f',
    'lavfi',
    '-t',
    totalSeconds.toFixed(3),
    '-i',
    'anullsrc=channel_layout=stereo:sample_rate=44100',
    ...(sound.music ? ['-i', 'music.mp3'] : []),
    ...sound.voiceStarts.flatMap((_, k) => ['-i', `voice${k}.wav`]),
  ];
  const audio = audioFilters(n, musicInput, firstVoiceInput, totalSeconds, sound);
  const prepared = spec.scenes.map(
    (scene, i) =>
      `[${i}:v]trim=duration=${scene.durationSeconds.toFixed(3)},setpts=PTS-STARTPTS,` +
      `scale=${FRAME.width}:${FRAME.height}:force_original_aspect_ratio=increase,` +
      `crop=${FRAME.width}:${FRAME.height},fps=${FPS},setsar=1[v${i}]`,
  );
  const joined = `${spec.scenes.map((_, i) => `[v${i}]`).join('')}concat=n=${n}:v=1:a=0[cat]`;
  const filter = [
    ...(audio ? audio.filters : []),
    ...prepared,
    joined,
    '[cat]ass=captions.ass:fontsdir=fonts[out]',
  ].join(';');
  return [
    '-hide_banner',
    '-y',
    ...inputs,
    '-filter_complex',
    filter,
    '-map',
    '[out]',
    '-map',
    audio ? audio.output : `${n}:a`,
    '-c:v',
    'libx264',
    '-preset',
    'veryfast',
    '-crf',
    '20',
    '-pix_fmt',
    'yuv420p',
    '-r',
    String(FPS),
    '-c:a',
    'aac',
    '-b:a',
    '128k',
    '-shortest',
    '-movflags',
    '+faststart',
    'reel.mp4',
  ];
}

// Null when there is nothing to mix, so a silent reel keeps the plain silent track.
function audioFilters(
  silenceInput: number,
  musicInput: number,
  firstVoiceInput: number,
  totalSeconds: number,
  sound: SoundLayout,
): { filters: string[]; output: string } | null {
  if (!sound.music && sound.voiceStarts.length === 0) return null;
  const total = totalSeconds.toFixed(3);
  const filters = [`[${silenceInput}:a]${AUDIO_FORMAT}[a_base]`];
  const labels = ['[a_base]'];
  if (sound.music) {
    const volume = sound.voiceStarts.length > 0 ? MUSIC_UNDER_VOICE : MUSIC_ALONE;
    const fadeStart = Math.max(0, totalSeconds - MUSIC_FADE_OUT_SECONDS).toFixed(3);
    filters.push(
      `[${musicInput}:a]atrim=0:${total},asetpts=PTS-STARTPTS,${AUDIO_FORMAT},volume=${volume},` +
        `afade=t=out:st=${fadeStart}:d=${MUSIC_FADE_OUT_SECONDS}[a_music]`,
    );
    labels.push('[a_music]');
  }
  sound.voiceStarts.forEach((start, k) => {
    const delayMs = Math.round(start * 1000);
    filters.push(`[${firstVoiceInput + k}:a]${AUDIO_FORMAT},adelay=delays=${delayMs}:all=1[a_v${k}]`);
    labels.push(`[a_v${k}]`);
  });
  filters.push(`${labels.join('')}amix=inputs=${labels.length}:normalize=0:duration=first[aout]`);
  return { filters, output: '[aout]' };
}

async function download(url: string, to: string): Promise<void> {
  let response: Response;
  try {
    response = await fetch(url, { signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS) });
  } catch {
    throw new Error('Could not download a clip for assembly');
  }
  if (!response.ok) throw new Error(`A clip download answered ${response.status}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length > MAX_CLIP_BYTES) throw new Error('A clip is larger than a reel clip can be');
  await writeFile(to, bytes);
}
