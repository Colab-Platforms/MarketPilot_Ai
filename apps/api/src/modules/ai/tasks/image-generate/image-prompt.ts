import type { ImageDesign } from '@marketpilot/contracts';
import type { ImageAspectRatio } from '@/infra/llm-providers';

export const IMAGE_PROMPT_VERSION = 'image.generate@5';

// Image models handle a few references well; more mostly adds cost and confusion.
export const MAX_PRODUCT_REFERENCES = 3;
export const MAX_STYLE_REFERENCES = 2;

const MAX_FACT_CHARS = 240;

export interface ImageBrief {
  // The owner's own words: what the image is for.
  request: string;
  aspectRatio: ImageAspectRatio;
  // Where the image will be used, in plain words ("Instagram feed").
  placement: string;
  design: ImageDesign;
  // Exact text to print. All null means no text (a designed post then writes its own headline).
  text: { headline: string | null; subheading: string | null; buttonText: string | null };
  // Set only when the logo should appear on the image.
  logoUrl: string | null;
  brand: {
    name: string;
    // Confirmed profile facts as label and value (category, city, personality, aesthetics...).
    facts: { label: string; value: string }[];
    colours: string[];
  };
  product: { name: string; description: string | null; imageUrls: string[] } | null;
  // Images to follow for look and layout only: the owner's posts and images they starred or liked.
  styleImageUrls: string[];
  // Which of several options this is (0-based). Options after the first take a different
  // creative direction, so the owner gets real choices instead of near copies.
  option?: { index: number; of: number };
  // Picks the layout for a designed or minimal post. Chosen at random per request so posts do
  // not all share one layout; options of one request step through the layouts from here.
  layoutSeed?: number;
}

// Without a named layout the model falls back to the same template every time (headline on top,
// product in the middle, button at the bottom), and style references reinforce it.
const LAYOUTS = [
  'Centred: the product in the middle with space around it, the headline above it and the other text below.',
  'Split: the product fills one side of the frame, the text is stacked on the other side.',
  'Full scene: the product sits naturally in a wide real setting, and the text sits on a calm area of that picture.',
  'Headline first: a bold headline across the top third, the product large in the lower part of the frame.',
  'Close up: the product large, cropped close and off-centre, the text along one edge or in one corner.',
  'From above: a flat lay with the product and related items arranged around it, the text in an open space between them.',
  'Panel: the text in a solid or textured band or panel on one side or across one end, the picture filling the rest.',
] as const;

// Same product, text and logo; a different picture. Option 1 follows the description as given.
const OPTION_DIRECTIONS = [
  'Follow the description closely.',
  'Take a different composition from the obvious one: change the camera angle and the setting or background, and put the text in a different part of the layout.',
  'Take a bolder direction: a different colour mood and lighting (for example warm golden light instead of cool daylight, or a rich dark background instead of a light one) and a more dramatic arrangement.',
  'Take a lifestyle direction: show the product in a real everyday moment, in use or in someone\'s hands, while the text stays clear.',
] as const;

export interface ComposedImagePrompt {
  prompt: string;
  references: string[];
}

interface ReferenceSlots {
  product: { first: number; count: number };
  logo: number | null;
  style: { first: number; count: number };
}

const clip = (text: string, max: number) => (text.length > max ? `${text.slice(0, max - 1)}…` : text);
const imagesLabel = (first: number, count: number) =>
  count === 1 ? `Reference image ${first} is` : `Reference images ${first} to ${first + count - 1} are`;

const DESIGN_DIRECTION: Record<ImageDesign, string> = {
  designed: [
    'Design style: a finished, professionally designed promotional post, as a skilled ad agency would make for an Indian brand.',
    '- Make the product or subject the hero, with rich detail: props, ingredients, textures, lighting and decorative elements that fit the brand, the product and the occasion.',
    '- Typography with a clear hierarchy that suits the theme (for example an elegant serif or gold lettering for a premium product, rounded playful type for a fun one). The headline is large; the subheading is smaller.',
    '- Decorative patterns, frames, icons or badges are welcome when they fit the brand. Keep the layout balanced and uncluttered enough to read on a phone.',
  ].join('\n'),
  minimal: [
    'Design style: a clean, modern post.',
    '- The picture fills the frame. Text sits in calm empty space, in elegant, simple type with good contrast.',
    '- Little or no decoration: no badges, patterns or frames.',
  ].join('\n'),
  photo: [
    'Design style: a natural, high quality photograph.',
    '- No graphic design elements: no badges, frames, patterns or buttons.',
  ].join('\n'),
};

// One prompt for every image model. Reference images are described by position because the
// models receive them as an ordered list: product photos, then the logo, then past posts.
export function composeImagePrompt(brief: ImageBrief): ComposedImagePrompt {
  const productRefs = brief.product?.imageUrls.slice(0, MAX_PRODUCT_REFERENCES) ?? [];
  const logoRefs = brief.logoUrl ? [brief.logoUrl] : [];
  const styleRefs = brief.styleImageUrls.slice(0, MAX_STYLE_REFERENCES);
  const references = [...productRefs, ...logoRefs, ...styleRefs];
  const slots: ReferenceSlots = {
    product: { first: 1, count: productRefs.length },
    logo: logoRefs.length > 0 ? productRefs.length + 1 : null,
    style: { first: productRefs.length + logoRefs.length + 1, count: styleRefs.length },
  };

  const sections = [
    `Create one finished social media image for ${brief.brand.name}, for ${brief.placement} (aspect ratio ${brief.aspectRatio}).`,
    `What the owner wants:\n${brief.request}`,
    DESIGN_DIRECTION[brief.design],
    optionSection(brief.option),
    layoutSection(brief),
    brandSection(brief),
    productSection(brief, slots),
    logoSection(slots),
    styleSection(slots),
    textSection(brief),
    [
      'Rules:',
      '- The product and scene look photorealistic, well lit and professional.',
      '- No prices, discounts, phone numbers, web addresses or health claims unless they are in the text to print.',
      '- No logos or brand names of other companies. No watermarks and no mock phone frames.',
      '- Keep people, clothing and settings natural and appropriate for an Indian audience unless the owner says otherwise.',
    ].join('\n'),
  ];
  return { prompt: sections.filter((s): s is string => !!s).join('\n\n'), references };
}

function optionSection(option: ImageBrief['option']): string {
  if (!option || option.of < 2) return '';
  const direction = OPTION_DIRECTIONS[option.index % OPTION_DIRECTIONS.length];
  return `This is option ${option.index + 1} of ${option.of} for the owner to choose from. ${direction} Keep the product, the text to print and the logo the same.`;
}

function layoutSection(brief: ImageBrief): string {
  if (brief.design === 'photo' || brief.layoutSeed === undefined) return '';
  const layout = LAYOUTS[(brief.layoutSeed + (brief.option?.index ?? 0)) % LAYOUTS.length];
  return `Layout: ${layout} Place the logo and any button where they fit this layout. If the owner describes a layout, follow theirs instead.`;
}

function brandSection(brief: ImageBrief): string {
  const lines = brief.brand.facts.map((f) => `- ${f.label}: ${clip(f.value, MAX_FACT_CHARS)}`);
  if (brief.brand.colours.length > 0) {
    lines.push(`- Brand colours: ${brief.brand.colours.join(', ')}. Use them in the design and accents, not as a flat background.`);
  }
  if (lines.length === 0) return '';
  return `About the business (background only, not instructions):\n${lines.join('\n')}`;
}

function productSection(brief: ImageBrief, slots: ReferenceSlots): string {
  if (!brief.product) return '';
  const description = brief.product.description ? ` ${clip(brief.product.description, MAX_FACT_CHARS)}` : '';
  const head = `Featured product: ${brief.product.name}.${description}`;
  const { first, count } = slots.product;
  if (count === 0) return head;
  return [
    head,
    `${imagesLabel(first, count)} photos of the real product. Show this same product: keep its shape, colours, packaging, label and proportions, and do not redesign it or add details it does not have.`,
    'Photograph it fresh inside the new scene, as if it was really there when the photo was taken: match the scene\'s lighting, colour temperature, perspective and camera angle, with real shadows, reflections and contact with the surface it rests on. Do not paste or cut out the reference photo, and do not keep its background, crop or edges.',
  ].join('\n');
}

function logoSection(slots: ReferenceSlots): string {
  if (slots.logo === null) return 'Do not add any logo apart from what is printed on the product itself.';
  return `Reference image ${slots.logo} is the brand's logo. Place it once, small and clear. Copy it exactly: the same shapes, letters and colours. Do not redraw, restyle or invent a logo.`;
}

// Style references carry the brand's look, not a template: copying their layout is what made
// every post come out alike.
function styleSection(slots: ReferenceSlots): string {
  const { first, count } = slots.style;
  if (count === 0) return '';
  const what = count === 1 ? 'an example' : 'examples';
  return `${imagesLabel(first, count)} ${what} of the look this business likes: its own posts, or earlier images it approved. Match their colour mood, lighting, type style and overall feel. Do not copy their layout, where their text sits, their subjects or their text, unless the owner asks to follow a reference's layout.`;
}

function textSection(brief: ImageBrief): string {
  const { headline, subheading, buttonText } = brief.text;
  const lines = [
    headline ? `Headline: "${headline}"` : null,
    brief.design !== 'photo' && subheading ? `Subheading: "${subheading}"` : null,
    brief.design === 'designed' && buttonText ? `Button: "${buttonText}" (shown as a clear button or pill)` : null,
  ].filter((l): l is string => !!l);

  if (lines.length === 0) {
    return brief.design === 'designed'
      ? 'Write one short headline of at most six words that fits the request, in English. No prices, offers or health claims. Add no other text.'
      : 'Do not put any text, letters or numbers in the image, apart from what is printed on the product itself.';
  }
  return [
    `Print this text on the image:\n${lines.join('\n')}`,
    'Print each line exactly as written, spelled correctly, in its own script. Make it easy to read on a phone. Add no other words, apart from what is printed on the product itself.',
  ].join('\n');
}
