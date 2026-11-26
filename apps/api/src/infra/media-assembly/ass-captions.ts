import type { AssemblyScene } from './assembly.port';

export const FRAME = { width: 1080, height: 1920 } as const;
export const CAPTION_FONT = 'Poppins SemiBold';

// Instagram covers roughly the bottom fifth (caption, audio, username) and a strip down the
// right edge (like, comment, share). Captions sit above the first and clear of the second.
const SAFE = { bottom: 560, left: 110, right: 170 } as const;

const STYLE = [
  'Caption',
  CAPTION_FONT,
  72, // size
  '&H00FFFFFF', // white text
  '&H00FFFFFF',
  '&H66000000', // box colour: black at 60%
  '&H66000000',
  0,
  0,
  0,
  0,
  100,
  100,
  0,
  0,
  3, // BorderStyle 3: an opaque box behind the text
  24, // box padding
  0,
  2, // bottom centre, raised by MarginV
  SAFE.left,
  SAFE.right,
  SAFE.bottom,
  1,
].join(',');

// Two decimals of a second, the precision ASS times take.
function timestamp(seconds: number): string {
  const centis = Math.round(seconds * 100);
  const h = Math.floor(centis / 360_000);
  const m = Math.floor((centis % 360_000) / 6_000);
  const s = Math.floor((centis % 6_000) / 100);
  const cs = centis % 100;
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(cs).padStart(2, '0')}`;
}

// Owner text is data: braces would open override blocks and a backslash would start a code.
export function escapeCaption(text: string): string {
  return text
    .replace(/[{}]/g, '')
    .replace(/\\/g, '/')
    .replace(/\r?\n/g, '\\N')
    .replace(/\s+/g, ' ')
    .trim();
}

// One subtitle event per scene that has text, timed to where the scene sits in the reel.
// libass wraps long lines and shapes Devanagari correctly (ADR 0012).
export function buildCaptions(scenes: readonly AssemblyScene[]): string {
  let at = 0;
  const events: string[] = [];
  for (const scene of scenes) {
    const text = scene.text ? escapeCaption(scene.text) : '';
    if (text)
      events.push(
        `Dialogue: 0,${timestamp(at)},${timestamp(at + scene.durationSeconds)},Caption,,0,0,0,,${text}`,
      );
    at += scene.durationSeconds;
  }
  return [
    '[Script Info]',
    'ScriptType: v4.00+',
    `PlayResX: ${FRAME.width}`,
    `PlayResY: ${FRAME.height}`,
    'WrapStyle: 0',
    'ScaledBorderAndShadow: yes',
    '',
    '[V4+ Styles]',
    'Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding',
    `Style: ${STYLE}`,
    '',
    '[Events]',
    'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text',
    ...events,
    '',
  ].join('\n');
}
