import type { ReelShot } from '@marketpilot/contracts';
import type { ComposedImageRequest } from '../image-generate/image-generate.task';

export const REEL_PORTRAIT_PROMPT_VERSION = 'reel.portrait@1';
export const REEL_KEYFRAME_PROMPT_VERSION = 'reel.keyframe@1';

// Image models follow a few references well; more mostly adds cost and confusion.
const MAX_PEOPLE_REFERENCES = 2;
const MAX_PRODUCT_REFERENCES = 2;

// A brief holds exactly what shapes the picture, nothing else, so its hash says when a
// picture is outdated. Names, on-screen text, timing and camera moves are left out on purpose.
export interface ReelPortraitBrief {
  ageRange: string;
  look: string;
  wardrobe: string;
}

export interface ReelKeyframeBrief {
  shot: ReelShot;
  setting: string;
  action: string;
  people: { look: string; wardrobe: string; portraitUrl: string }[];
  product: { name: string; imageUrls: string[] } | null;
}

const SHOTS: Record<ReelShot, string> = {
  close_up: 'Close-up: the face and hands fill most of the frame',
  medium: 'Medium shot: the person from the waist up, with some of the place around them',
  wide: 'Wide shot: the whole person and the place around them',
  detail: 'Product detail shot: the product fills most of the frame, sharply in focus',
};

const REALISM =
  'Photorealistic, like a frame from a well-shot smartphone video on Instagram Reels: natural light, real skin texture, believable Indian setting, not a 3D render or a studio advert.';

const NO_OVERLAYS =
  'Do not put any text, captions, subtitles, logos, watermarks or graphics on the picture; text is added later.';

export function composePortraitPrompt(brief: ReelPortraitBrief): ComposedImageRequest {
  const prompt = [
    'A casting reference photo of a fictional person who will appear in a short video. They must not resemble any real or famous person.',
    `Person: ${brief.ageRange}. ${brief.look}`,
    `Wearing: ${brief.wardrobe}`,
    'Head and shoulders, facing the camera, relaxed natural expression with a slight smile, soft even daylight, plain light background.',
    REALISM,
    NO_OVERLAYS,
  ].join('\n\n');
  return {
    task: 'reel.portrait',
    prompt,
    references: [],
    aspectRatio: '4:5',
    promptVersion: REEL_PORTRAIT_PROMPT_VERSION,
  };
}

// The first frame of a scene's clip: the moment the movement begins, so the video model has
// a clear start to animate. People and product follow their reference images.
export function composeKeyframePrompt(brief: ReelKeyframeBrief): ComposedImageRequest {
  const people = brief.people.slice(0, MAX_PEOPLE_REFERENCES);
  const productImages = brief.product?.imageUrls.slice(0, MAX_PRODUCT_REFERENCES) ?? [];
  const references = [...people.map((p) => p.portraitUrl), ...productImages];

  const peopleLines = people.map(
    (p, i) =>
      `Person ${i + 1} must be the same person as reference image ${i + 1}: same face, hair and skin tone. Wearing: ${p.wardrobe}.`,
  );
  const productLines: string[] = [];
  if (brief.product) {
    const first = people.length + 1;
    const source =
      productImages.length === 0
        ? ''
        : productImages.length === 1
          ? ` It must look exactly like reference image ${first}: same shape, colour, label and cap.`
          : ` It must look exactly like reference images ${first} to ${first + productImages.length - 1}: same shape, colour, label and cap.`;
    productLines.push(
      `The product, ${brief.product.name}, is clearly visible with its label facing the camera and undistorted.${source}`,
      'Show exactly one of the product. Never duplicate it or add similar-looking items.',
    );
  }

  const prompt = [
    'A single vertical 9:16 frame: the opening moment of one scene in a short product video.',
    SHOTS[brief.shot],
    `Where: ${brief.setting}`,
    `What is about to happen: ${brief.action} Show the moment just as it begins, with a natural pose that can flow into that movement.`,
    people.length === 0
      ? 'No people appear, except hands if the action needs them.'
      : 'Only the people described appear, no one else in focus.',
    ...peopleLines,
    ...productLines,
    'Hands look natural with five fingers.',
    REALISM,
    NO_OVERLAYS,
  ].join('\n\n');
  return {
    task: 'reel.keyframe',
    prompt,
    references,
    aspectRatio: '9:16',
    promptVersion: REEL_KEYFRAME_PROMPT_VERSION,
  };
}
