import { timeVoiceLines } from './voice-timing';

describe('timeVoiceLines', () => {
  const scenes = [4, 5, 6];

  it('starts each line just after its scene cuts in', () => {
    expect(
      timeVoiceLines(scenes, [
        { sceneIndex: 0, durationSeconds: 2 },
        { sceneIndex: 2, durationSeconds: 2 },
      ]),
    ).toEqual([
      { line: 0, startSeconds: 0.2 },
      { line: 1, startSeconds: 9.2 },
    ]);
  });

  it('waits for a long line to finish so two lines never overlap', () => {
    const timed = timeVoiceLines(scenes, [
      { sceneIndex: 0, durationSeconds: 5 },
      { sceneIndex: 1, durationSeconds: 2 },
    ]);
    expect(timed[1]!.startSeconds).toBeCloseTo(0.2 + 5 + 0.15, 5);
  });

  it('keeps input positions when lines arrive out of scene order', () => {
    const timed = timeVoiceLines(scenes, [
      { sceneIndex: 2, durationSeconds: 1 },
      { sceneIndex: 0, durationSeconds: 1 },
    ]);
    expect(timed.map((t) => t.line)).toEqual([1, 0]);
  });

  it('drops a line pushed past the end of the reel, and one for a scene that does not exist', () => {
    const timed = timeVoiceLines([3, 2], [
      { sceneIndex: 0, durationSeconds: 4.8 },
      { sceneIndex: 1, durationSeconds: 1 },
      { sceneIndex: 7, durationSeconds: 1 },
    ]);
    expect(timed).toEqual([{ line: 0, startSeconds: 0.2 }]);
  });
});
