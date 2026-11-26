import type { ReelCharacter, ReelSceneSpec } from '@marketpilot/contracts';
import { keyframeBrief, keyframeHash, portraitBrief, portraitHash } from './take-briefs';

const asha: ReelCharacter = {
  id: 'c1',
  name: 'Asha',
  ageRange: 'about 30',
  look: 'Long black hair',
  wardrobe: 'Teal kurta',
};
const scene: ReelSceneSpec = {
  durationSeconds: 3,
  shot: 'close_up',
  camera: 'push_in',
  setting: 'A sunlit bathroom',
  action: 'She lifts the bottle',
  characterIds: ['c1'],
  showsProduct: true,
  onScreenText: 'Try it',
  voiceover: null,
};
const product = { name: 'Hair oil', imageUrls: ['https://img.example/p1.jpg'] };
const portraits = new Map([['c1', 'https://img.example/c1.png']]);

const hashFor = (s: ReelSceneSpec, cast = [asha], urls = portraits) =>
  keyframeHash(keyframeBrief(s, cast, urls, product)!);

describe('keyframe hash', () => {
  it('ignores what the picture does not show: text, voiceover, length, camera move', () => {
    const base = hashFor(scene);
    expect(
      hashFor({
        ...scene,
        onScreenText: 'Other text',
        voiceover: 'Hello',
        durationSeconds: 5,
        camera: 'pan',
      }),
    ).toBe(base);
  });

  it('changes with what the picture shows', () => {
    const base = hashFor(scene);
    expect(hashFor({ ...scene, action: 'She smiles' })).not.toBe(base);
    expect(hashFor({ ...scene, shot: 'wide' })).not.toBe(base);
    expect(hashFor({ ...scene, showsProduct: false })).not.toBe(base);
    expect(hashFor(scene, [{ ...asha, wardrobe: 'Red saree' }])).not.toBe(base);
    expect(hashFor(scene, [asha], new Map([['c1', 'https://img.example/c1-v2.png']]))).not.toBe(
      base,
    );
  });

  it('cannot be drawn until everyone in the scene has a portrait', () => {
    expect(keyframeBrief(scene, [asha], new Map(), product)).toBeNull();
  });
});

describe('portrait hash', () => {
  it('ignores the name but not the look', () => {
    const base = portraitHash(portraitBrief(asha));
    expect(portraitHash(portraitBrief({ ...asha, name: 'Meera' }))).toBe(base);
    expect(portraitHash(portraitBrief({ ...asha, look: 'Short curly hair' }))).not.toBe(base);
  });
});
