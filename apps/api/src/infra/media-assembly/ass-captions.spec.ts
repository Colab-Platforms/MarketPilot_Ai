import { buildCaptions, escapeCaption } from './ass-captions';

const clip = 'https://cdn.example/c.mp4';

describe('buildCaptions', () => {
  it('times each caption to where its scene sits in the reel and skips scenes without text', () => {
    const ass = buildCaptions([
      { clipUrl: clip, durationSeconds: 3, text: 'MYTH: Sirf meetha chhodo' },
      { clipUrl: clip, durationSeconds: 2.5, text: null },
      { clipUrl: clip, durationSeconds: 4, text: 'सिर्फ़ मीठा छोड़ना काफ़ी नहीं' },
    ]);
    expect(ass).toContain(
      'Dialogue: 0,0:00:00.00,0:00:03.00,Caption,,0,0,0,,MYTH: Sirf meetha chhodo',
    );
    expect(ass).toContain(
      'Dialogue: 0,0:00:05.50,0:00:09.50,Caption,,0,0,0,,सिर्फ़ मीठा छोड़ना काफ़ी नहीं',
    );
    expect(ass.match(/^Dialogue:/gm)).toHaveLength(2);
    expect(ass).toContain('PlayResY: 1920');
  });
});

describe('escapeCaption', () => {
  it('stops owner text from opening override blocks or codes', () => {
    expect(escapeCaption('Save {\\b1}50%\\N now')).toBe('Save /b150%/N now');
  });

  it('keeps line breaks the owner typed', () => {
    expect(escapeCaption('Line one\nLine two')).toBe('Line one\\NLine two');
  });
});
