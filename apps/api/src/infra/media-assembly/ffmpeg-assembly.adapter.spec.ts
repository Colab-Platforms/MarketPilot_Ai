import { argsFor } from './ffmpeg-assembly.adapter';

const spec = {
  scenes: [
    { clipUrl: 'https://cdn.example/a.mp4', durationSeconds: 2, text: 'Hook' },
    { clipUrl: 'https://cdn.example/b.mp4', durationSeconds: 3.5, text: null },
  ],
};

describe('argsFor', () => {
  const args = argsFor(spec, 5.5);
  const filter = args[args.indexOf('-filter_complex') + 1]!;

  it('cuts each clip to its scene and fills a 1080x1920 frame', () => {
    expect(filter).toContain(
      '[0:v]trim=duration=2.000,setpts=PTS-STARTPTS,scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920',
    );
    expect(filter).toContain('[1:v]trim=duration=3.500');
  });

  it('joins the clips, then burns in captions so their times are reel times', () => {
    expect(filter).toContain('[v0][v1]concat=n=2:v=1:a=0[cat]');
    expect(filter.endsWith('[cat]ass=captions.ass:fontsdir=fonts[out]')).toBe(true);
  });

  it('adds a silent track as long as the reel and encodes for Instagram', () => {
    expect(args).toEqual(
      expect.arrayContaining(['-t', '5.500', 'anullsrc=channel_layout=stereo:sample_rate=44100']),
    );
    expect(args.join(' ')).toContain('-map [out] -map 2:a');
    expect(args.join(' ')).toContain(
      '-c:v libx264 -preset veryfast -crf 20 -pix_fmt yuv420p -r 30',
    );
    expect(args.join(' ')).toContain('-movflags +faststart reel.mp4');
  });

  it('only ever names files inside its own working folder', () => {
    expect(args.filter((a) => a.includes('/') || a.includes('\\'))).toEqual([]);
  });
});

describe('argsFor with sound', () => {
  const filterOf = (a: string[]) => a[a.indexOf('-filter_complex') + 1]!;

  it('mixes music under the voice lines, each delayed to its start, onto the silent base', () => {
    const args = argsFor(spec, 5.5, { music: true, voiceStarts: [0.2, 2.35] });
    const filter = filterOf(args);
    expect(args.join(' ')).toContain('-i music.mp3 -i voice0.wav -i voice1.wav');
    expect(filter).toContain('[3:a]atrim=0:5.500,asetpts=PTS-STARTPTS');
    expect(filter).toContain('volume=0.22,afade=t=out:st=4.000:d=1.5[a_music]');
    expect(filter).toContain('[4:a]aformat=sample_rates=44100:channel_layouts=stereo,adelay=delays=200:all=1[a_v0]');
    expect(filter).toContain('[5:a]aformat=sample_rates=44100:channel_layouts=stereo,adelay=delays=2350:all=1[a_v1]');
    expect(filter).toContain('[a_base][a_music][a_v0][a_v1]amix=inputs=4:normalize=0:duration=first[aout]');
    expect(filter.endsWith('[cat]ass=captions.ass:fontsdir=fonts[out]')).toBe(true);
    expect(args.join(' ')).toContain('-map [out] -map [aout]');
  });

  it('plays music louder when nothing is spoken', () => {
    const filter = filterOf(argsFor(spec, 5.5, { music: true, voiceStarts: [] }));
    expect(filter).toContain('volume=0.7');
    expect(filter).toContain('[a_base][a_music]amix=inputs=2');
  });

  it('numbers voice inputs straight after the silence when there is no music', () => {
    const args = argsFor(spec, 5.5, { music: false, voiceStarts: [1] });
    expect(args).not.toContain('music.mp3');
    expect(filterOf(args)).toContain('[3:a]aformat=sample_rates=44100:channel_layouts=stereo,adelay=delays=1000');
  });
});
