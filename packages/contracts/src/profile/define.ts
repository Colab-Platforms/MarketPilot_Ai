import type { QuestionOption } from '../onboarding/questions';
import type {
  FieldKind,
  FieldSource,
  FieldStorage,
  PolicyKindName,
  ProfileFieldDef,
  SectionId,
} from './types';
import type { SocialProviderName } from '../onboarding/scan';

type Extra = Partial<Pick<ProfileFieldDef, 'helper' | 'options' | 'maxLength' | 'tracks' | 'pack' | 'required' | 'hidden'>> & {
  sources?: readonly FieldSource[];
};

export const col = (column: string): FieldStorage => ({ type: 'column', column });
export const attr = (key: string): FieldStorage => ({ type: 'attribute', key });
export const brand = (column: 'name' | 'websiteUrl' | 'scale' | 'language' | 'secondaryLanguages'): FieldStorage => ({
  type: 'brand',
  column,
});
export const social = (provider: SocialProviderName): FieldStorage => ({ type: 'social', provider });
export const policy = (kind: PolicyKindName): FieldStorage => ({ type: 'policy', kind });
export const summary = (of: Extract<FieldStorage, { type: 'summary' }>['of']): FieldStorage => ({
  type: 'summary',
  of,
});
export const connection: FieldStorage = { type: 'connection' };
export const alias = (of: string): FieldStorage => ({ type: 'alias', of });

function keyOf(storage: FieldStorage, id: number | string): string {
  switch (storage.type) {
    case 'column':
      return storage.column;
    case 'attribute':
      return storage.key;
    case 'brand':
      return `brand.${storage.column}`;
    case 'social':
      return `social.${storage.provider}`;
    case 'policy':
      return `policy.${storage.kind}`;
    case 'summary':
      return `summary.${storage.of}`;
    case 'connection':
      return `connection.${id}`;
    case 'alias':
      return `alias.${id}`;
  }
}

export function field(
  id: number | string,
  section: SectionId,
  label: string,
  kind: FieldKind,
  storage: FieldStorage,
  extra: Extra = {},
): ProfileFieldDef {
  const { sources, ...rest } = extra;
  return {
    id,
    section,
    key: keyOf(storage, id),
    label,
    kind,
    storage,
    sources: sources ?? (storage.type === 'connection' ? ['connection'] : ['owner']),
    ...rest,
  };
}

export const hide = (def: ProfileFieldDef): ProfileFieldDef => ({ ...def, hidden: true });

export const options = (...pairs: [string, string][]): readonly QuestionOption[] =>
  pairs.map(([value, label]) => ({ value, label }));

export const SCALE_OPTIONS = options(
  ['solo', 'Just me'],
  ['small', 'Small team (2 to 10 people)'],
  ['mid', 'Mid-size (11 to 200 people)'],
  ['enterprise', 'Large (200+ people)'],
);
export const EMPLOYEE_OPTIONS = options(
  ['1', 'Just me'],
  ['2-10', '2 to 10'],
  ['11-50', '11 to 50'],
  ['51-200', '51 to 200'],
  ['201-1000', '201 to 1,000'],
  ['1000+', 'More than 1,000'],
);
export const MODEL_OPTIONS = options(
  ['b2c', 'Sell to individual customers'],
  ['b2b', 'Sell to other businesses'],
  ['d2c', 'Sell directly through our own online store'],
  ['marketplace', 'Marketplace'],
  ['mixed', 'A mix'],
);
export const INCOME_OPTIONS = options(
  ['budget', 'Budget conscious'],
  ['middle', 'Middle income'],
  ['upper_middle', 'Upper-middle income'],
  ['premium', 'Premium and luxury'],
  ['mixed', 'A mix'],
);
export const FREQUENCY_OPTIONS = options(
  ['daily', 'Every day'],
  ['few_per_week', 'A few times a week'],
  ['weekly', 'Once a week'],
  ['monthly', 'Once a month'],
  ['campaign', 'Only for campaigns'],
);
export const CONTENT_TYPE_OPTIONS = options(
  ['reels', 'Reels and short videos'],
  ['images', 'Single images'],
  ['carousels', 'Carousels'],
  ['stories', 'Stories'],
  ['text', 'Text posts'],
  ['long_video', 'Long videos'],
);
export const VIDEO_FORMAT_OPTIONS = options(
  ['vertical', 'Vertical (9:16)'],
  ['square', 'Square (1:1)'],
  ['landscape', 'Landscape (16:9)'],
);
export const IMAGE_FORMAT_OPTIONS = options(
  ['square', 'Square (1:1)'],
  ['portrait', 'Portrait (4:5)'],
  ['landscape', 'Landscape (1.91:1)'],
);
export const REEL_DURATION_OPTIONS = options(
  ['15', 'About 15 seconds'],
  ['30', 'About 30 seconds'],
  ['60', 'About 60 seconds'],
  ['90', 'Up to 90 seconds'],
);
export const CAPTION_LENGTH_OPTIONS = options(
  ['short', 'Short (one or two lines)'],
  ['medium', 'Medium'],
  ['long', 'Long and detailed'],
);
export const VOICEOVER_OPTIONS = options(
  ['none', 'No voiceover'],
  ['female', 'Female voice'],
  ['male', 'Male voice'],
  ['either', 'No preference'],
);
export const APPROVAL_OPTIONS = options(
  ['all', 'I approve everything before it goes out'],
  ['important', 'Only important posts need my approval'],
  ['none', 'Post automatically'],
);
export const SALES_CHANNEL_OPTIONS = options(
  ['website', 'Our own website'],
  ['marketplace', 'Online marketplaces'],
  ['instagram', 'Instagram'],
  ['whatsapp', 'WhatsApp'],
  ['store', 'Physical store'],
  ['phone', 'Phone or in person'],
);
export const STOCK_OPTIONS = options(
  ['in_stock', 'Usually in stock'],
  ['limited', 'Limited stock'],
  ['made_to_order', 'Made to order'],
  ['varies', 'Varies by product'],
);
