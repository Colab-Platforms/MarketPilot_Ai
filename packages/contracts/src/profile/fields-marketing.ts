import { CHANNELS, OBJECTIVES } from '../onboarding/questions';
import { LANGUAGES } from '../onboarding/steps';
import {
  APPROVAL_OPTIONS,
  CAPTION_LENGTH_OPTIONS,
  CONTENT_TYPE_OPTIONS,
  FREQUENCY_OPTIONS,
  IMAGE_FORMAT_OPTIONS,
  REEL_DURATION_OPTIONS,
  VIDEO_FORMAT_OPTIONS,
  VOICEOVER_OPTIONS,
  attr,
  brand,
  col,
  connection,
  field,
  hide,
  social,
} from './define';
import type { ProfileFieldDef } from './types';

const website = ['website', 'owner'] as const;
const ai = ['ai', 'owner'] as const;
const languageOptions = LANGUAGES.map(({ value, label }) => ({ value, label }));

// Categories 5 to 8.
export const MARKETING_FIELDS: readonly ProfileFieldDef[] = [
  // 5. Marketing objectives
  field(79, 'goals', 'Primary marketing objective', 'select', col('primaryObjective'), { options: OBJECTIVES }),
  field(80, 'goals', 'Secondary marketing objectives', 'multiselect', col('secondaryObjectives'), { options: OBJECTIVES }),
  field(81, 'goals', 'Brand awareness goals', 'textarea', attr('goalAwareness')),
  field(82, 'goals', 'Lead generation goals', 'textarea', attr('goalLeads')),
  field(83, 'goals', 'Sales conversion goals', 'textarea', attr('goalSales')),
  field(84, 'goals', 'Website traffic goals', 'textarea', attr('goalTraffic')),
  field(85, 'goals', 'Social media growth goals', 'textarea', attr('goalSocialGrowth')),
  field(86, 'goals', 'Customer retention goals', 'textarea', attr('goalRetention')),
  field(87, 'goals', 'Monthly marketing budget', 'money', col('monthlyBudgetMinor'), { helper: 'In rupees.' }),
  field(88, 'goals', 'Advertising budget', 'money', attr('adBudgetMinor'), { helper: 'In rupees, per month.' }),
  field(89, 'goals', 'Marketing campaign frequency', 'select', attr('campaignFrequency'), { options: FREQUENCY_OPTIONS }),
  field(90, 'goals', 'Preferred marketing channels', 'multiselect', col('preferredChannels'), { options: CHANNELS }),
  field(91, 'goals', 'Expected marketing outcomes', 'textarea', attr('expectedOutcomes')),
  field(92, 'goals', 'Current marketing challenges', 'textarea', attr('marketingChallenges')),

  // 6. Social media presence. Profile links are stored here; connecting an account
  // for publishing and analytics is a separate, explicit OAuth step.
  field(93, 'social', 'Instagram profile', 'url', social('instagram'), { sources: website }),
  field(94, 'social', 'Facebook page', 'url', social('facebook'), { sources: website }),
  field(95, 'social', 'TikTok profile', 'url', social('tiktok'), { sources: website }),
  field(96, 'social', 'YouTube channel', 'url', social('youtube'), { sources: website }),
  field(97, 'social', 'LinkedIn company page', 'url', social('linkedin'), { sources: website }),
  field(98, 'social', 'Pinterest profile', 'url', social('pinterest'), { sources: website }),
  field(99, 'social', 'X profile', 'url', social('x'), { sources: website }),
  field(181, 'social', 'WhatsApp business link', 'url', social('whatsapp'), { sources: website }),
  // The owner's own posts, uploaded by hand until an account is connected. New image posts
  // use them as the reference for layout, format and visual style.
  field(182, 'social', 'Your recent posts', 'images', attr('recentPostImages'), {
    helper: 'Add a few of your recent posts so new posts match your look and format.',
  }),
  field(100, 'social', 'Existing social media content', 'text', connection),
  field(101, 'social', 'Existing post captions', 'text', connection),
  field(102, 'social', 'Existing hashtags', 'text', connection),
  field(103, 'social', 'Content publishing frequency', 'text', connection),
  field(104, 'social', 'Most successful posts', 'text', connection),
  field(105, 'social', 'Engagement metrics', 'text', connection),
  field(106, 'social', 'Follower counts', 'text', connection),
  field(107, 'social', 'Audience demographics', 'text', connection),
  field(108, 'social', 'Competitor social media accounts', 'tags', attr('competitorSocialAccounts'), { sources: ai }),

  // 7. Competitor information
  // The competitor list (brand_competitor, ADR 0007) replaces these text fields on screen.
  // They stay stored: older owner-typed names and websites still steer discovery.
  ...[
    field(109, 'competitors', 'Main competitors', 'tags', attr('competitors'), { sources: ai }),
    field(110, 'competitors', 'Competitor websites', 'tags', attr('competitorWebsites'), { sources: ai }),
    field(111, 'competitors', 'Competitor products', 'textarea', attr('competitorProducts'), { sources: ai }),
    field(112, 'competitors', 'Competitor pricing', 'textarea', attr('competitorPricing'), { sources: ai }),
    field(113, 'competitors', 'Competitor positioning', 'textarea', attr('competitorPositioning'), { sources: ai }),
    field(114, 'competitors', 'Competitor social profiles', 'tags', attr('competitorSocialProfiles'), { sources: ai }),
    field(115, 'competitors', 'Competitor content strategies', 'textarea', attr('competitorContent'), { sources: ai }),
    field(116, 'competitors', 'Competitor promotional offers', 'textarea', attr('competitorOffers'), { sources: ai }),
    field(117, 'competitors', 'Competitor strengths', 'textarea', attr('competitorStrengths'), { sources: ai }),
    field(118, 'competitors', 'Competitor weaknesses', 'textarea', attr('competitorWeaknesses'), { sources: ai }),
    field(119, 'competitors', 'Market differentiation', 'textarea', attr('differentiation'), { sources: ai }),
  ].map(hide),
  field(120, 'competitors', 'Unique selling proposition', 'textarea', attr('usp'), { sources: ai }),

  // 8. Content preferences
  field(121, 'content', 'Preferred content types', 'multiselect', attr('contentTypes'), { options: CONTENT_TYPE_OPTIONS }),
  // Hidden fields in this section wait for real video generation, repeat another section,
  // or are better defaulted; they stay stored for the AI.
  hide(field(122, 'content', 'Preferred video formats', 'multiselect', attr('videoFormats'), { options: VIDEO_FORMAT_OPTIONS })),
  field(123, 'content', 'Preferred image formats', 'multiselect', attr('imageFormats'), { options: IMAGE_FORMAT_OPTIONS }),
  hide(field(124, 'content', 'Preferred reel duration', 'select', attr('reelDuration'), { options: REEL_DURATION_OPTIONS })),
  field(125, 'content', 'Preferred content language', 'select', brand('language'), { options: languageOptions }),
  field(126, 'content', 'Secondary languages', 'multiselect', brand('secondaryLanguages'), { options: languageOptions }),
  field(127, 'content', 'Preferred caption length', 'select', attr('captionLength'), { options: CAPTION_LENGTH_OPTIONS }),
  field(128, 'content', 'Preferred hashtags', 'tags', attr('preferredHashtags')),
  hide(field(129, 'content', 'Preferred visual style', 'textarea', attr('visualStyle'))),
  hide(field(130, 'content', 'Preferred video style', 'textarea', attr('videoStyle'))),
  hide(field(131, 'content', 'Preferred background music style', 'text', attr('musicStyle'), { maxLength: 200 })),
  hide(field(132, 'content', 'Preferred voiceover style', 'select', attr('voiceoverStyle'), { options: VOICEOVER_OPTIONS })),
  hide(field(133, 'content', 'Preferred AI actors or presenters', 'text', attr('presenters'), { maxLength: 200 })),
  field(134, 'content', 'Preferred content themes', 'tags', attr('contentThemes')),
  field(135, 'content', 'Topics to avoid', 'tags', col('topicsToAvoid')),
  field(136, 'content', 'Content approval requirements', 'select', attr('approvalPreference'), { options: APPROVAL_OPTIONS }),
  hide(field(137, 'content', 'Competitor-inspired content preferences', 'textarea', attr('competitorInspired'))),
  hide(field(138, 'content', 'Seasonal campaign preferences', 'textarea', attr('seasonalPreferences'))),
];
