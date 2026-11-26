// A line starts just after its scene's cut, or after the previous line has finished if that ran
// long, so two lines never talk over each other. A line with no room left before the end is dropped.
const LEAD_SECONDS = 0.2;
const GAP_SECONDS = 0.15;
const MIN_AUDIBLE_SECONDS = 0.5;

export interface VoiceSlot {
  sceneIndex: number;
  durationSeconds: number;
}

export interface TimedVoice {
  // Position in the input list.
  line: number;
  startSeconds: number;
}

export function timeVoiceLines(sceneSeconds: number[], lines: VoiceSlot[]): TimedVoice[] {
  const sceneStarts = sceneSeconds.map((_, i) => sceneSeconds.slice(0, i).reduce((a, b) => a + b, 0));
  const total = sceneSeconds.reduce((a, b) => a + b, 0);
  const order = lines.map((line, index) => ({ ...line, index })).sort((a, b) => a.sceneIndex - b.sceneIndex);
  const timed: TimedVoice[] = [];
  let previousEnd = 0;
  for (const line of order) {
    const sceneStart = sceneStarts[line.sceneIndex];
    if (sceneStart === undefined) continue;
    const start = Math.max(sceneStart + LEAD_SECONDS, timed.length > 0 ? previousEnd + GAP_SECONDS : 0);
    if (start + MIN_AUDIBLE_SECONDS > total) continue;
    timed.push({ line: line.index, startSeconds: start });
    previousEnd = start + line.durationSeconds;
  }
  return timed;
}
