import { BUSINESS_CATEGORIES, TONES } from '../onboarding/questions';
import {
  EMPLOYEE_OPTIONS,
  INCOME_OPTIONS,
  MODEL_OPTIONS,
  SCALE_OPTIONS,
  STOCK_OPTIONS,
  alias,
  attr,
  brand,
  col,
  field,
  hide,
  summary,
} from './define';
import type { ProfileFieldDef } from './types';

const business = ['business'] as const;
const creator = ['creator'] as const;
const website = ['website', 'owner'] as const;
const ai = ['ai', 'owner'] as const;

// Categories 1 to 4. Ids are the numbers in the original information checklist.
export const IDENTITY_FIELDS: readonly ProfileFieldDef[] = [
  // 1. Basic business profile
  field(1, 'basics', 'Business name', 'text', brand('name'), { required: true, maxLength: 120 }),
  field(2, 'basics', 'Legal business name', 'text', col('legalName'), {
    tracks: business,
    maxLength: 160,
    hidden: true,
  }),
  field(3, 'basics', 'Business category', 'select', col('category'), {
    options: BUSINESS_CATEGORIES,
    sources: ai,
  }),
  field(4, 'basics', 'Business subcategory', 'text', col('subcategory'), {
    maxLength: 120,
    sources: ai,
  }),
  field(5, 'basics', 'Business description', 'textarea', col('description'), {
    maxLength: 600,
    sources: website,
  }),
  field(6, 'basics', 'Year established', 'year', col('yearEstablished'), {
    sources: website,
    hidden: true,
  }),
  field(7, 'basics', 'Business size', 'select', brand('scale'), {
    options: SCALE_OPTIONS,
    tracks: business,
    hidden: true,
  }),
  field(8, 'basics', 'Number of employees', 'select', col('employeeRange'), {
    options: EMPLOYEE_OPTIONS,
    tracks: business,
    hidden: true,
  }),
  field(9, 'basics', 'Operating model', 'select', col('operatingModel'), {
    options: MODEL_OPTIONS,
    hidden: true,
  }),
  field(10, 'basics', 'Registration country', 'text', col('country'), {
    maxLength: 60,
    hidden: true,
  }),
  field(11, 'basics', 'Primary business location', 'text', col('city'), {
    helper: 'The city you operate from.',
    maxLength: 80,
    sources: website,
  }),
  field(12, 'basics', 'Other branches or locations', 'tags', col('branches'), {
    tracks: business,
    sources: website,
    hidden: true,
  }),
  field(13, 'basics', 'Website', 'url', brand('websiteUrl'), {
    helper: 'Changing this lets us read your new website.',
  }),
  field(14, 'basics', 'Business email', 'email', col('contactEmail'), { sources: website }),
  field(15, 'basics', 'Contact number', 'phone', col('contactPhone'), { sources: website }),
  field(16, 'basics', 'Business address', 'text', col('addressLine'), {
    maxLength: 200,
    sources: website,
  }),
  field(17, 'basics', 'Operating hours', 'hours', col('operatingHours'), {
    helper: 'For example: Mon to Sat, 10am to 7pm.',
    maxLength: 200,
    sources: website,
  }),
  field(18, 'basics', 'Service or delivery areas', 'tags', col('serviceAreas'), {
    sources: website,
  }),
  field(177, 'basics', 'State', 'text', col('state'), {
    maxLength: 80,
    sources: website,
    hidden: true,
  }),
  field(178, 'basics', 'PIN code', 'text', col('postalCode'), {
    maxLength: 12,
    sources: website,
    hidden: true,
  }),
  field(179, 'basics', 'What you create content about', 'text', col('niche'), {
    tracks: creator,
    maxLength: 120,
  }),
  field(180, 'basics', 'How you describe yourself', 'select', attr('creatorType'), {
    tracks: creator,
    options: [
      { value: 'influencer', label: 'Influencer or content creator' },
      { value: 'personal_brand', label: 'Personal brand' },
      { value: 'coach', label: 'Coach, consultant or expert' },
      { value: 'other', label: 'Something else' },
    ],
  }),

  // 2. Products and services. The owner manages these through the catalogue editor; the
  // fields stay for the scan and as AI context.
  ...[
    field(19, 'products', 'Product names', 'text', summary('names'), { sources: website }),
    field(20, 'products', 'Product categories', 'text', summary('categories'), {
      sources: website,
    }),
    field(21, 'products', 'Product descriptions', 'text', summary('descriptions'), {
      sources: website,
    }),
    field(22, 'products', 'Product images', 'text', summary('images'), { sources: website }),
    field(23, 'products', 'Product videos', 'tags', attr('productVideos'), {
      helper: 'Links to videos.',
    }),
    field(24, 'products', 'Product pricing', 'text', summary('pricing'), { sources: website }),
    field(25, 'products', 'Product variants', 'textarea', attr('productVariants')),
    field(26, 'products', 'Available sizes', 'tags', attr('availableSizes')),
    field(27, 'products', 'Available colours', 'tags', attr('availableColours')),
    field(28, 'products', 'Product specifications', 'textarea', attr('productSpecifications')),
    field(29, 'products', 'Product features', 'tags', attr('productFeatures')),
    field(30, 'products', 'Product benefits', 'tags', attr('productBenefits')),
    field(31, 'products', 'Ingredients or materials', 'tags', attr('productMaterials')),
    field(32, 'products', 'Product availability', 'text', summary('availability'), {
      sources: website,
    }),
    field(33, 'products', 'Stock status', 'select', attr('stockStatus'), {
      options: STOCK_OPTIONS,
    }),
    field(34, 'products', 'Product discounts', 'textarea', attr('productDiscounts')),
    field(35, 'products', 'Active offers', 'textarea', attr('activeOffers')),
    field(36, 'products', 'Product bundles', 'textarea', attr('productBundles')),
    field(37, 'products', 'Best-selling products', 'tags', attr('bestSellers')),
    field(38, 'products', 'New arrivals', 'tags', attr('newArrivals')),
    field(39, 'products', 'Seasonal products', 'tags', attr('seasonalProducts')),
    field(40, 'products', 'Customer reviews for products', 'textarea', attr('productReviews'), {
      sources: website,
    }),
    field(41, 'products', 'Services offered', 'tags', attr('servicesOffered'), {
      sources: website,
    }),
    field(42, 'products', 'Service pricing', 'textarea', attr('servicePricing'), {
      sources: website,
    }),
    field(43, 'products', 'Service duration', 'text', attr('serviceDuration'), { maxLength: 120 }),
    field(44, 'products', 'Service benefits', 'tags', attr('serviceBenefits')),
    field(45, 'products', 'Service booking process', 'textarea', attr('serviceBookingProcess')),
  ].map(hide),

  // 3. Target audience and customer demographics
  field(46, 'audience', 'Primary target audience', 'textarea', attr('audienceSummary'), {
    sources: ai,
  }),
  field(47, 'audience', 'Secondary target audience', 'textarea', attr('secondaryAudience'), {
    sources: ai,
  }),
  field(48, 'audience', 'Customer age groups', 'tags', attr('audienceAgeGroups')),
  field(49, 'audience', 'Customer locations', 'tags', attr('audienceLocations')),
  field(50, 'audience', 'Customer interests', 'tags', attr('audienceInterests'), { sources: ai }),
  field(51, 'audience', 'Customer preferences', 'textarea', attr('audiencePreferences')),
  field(
    52,
    'audience',
    'Customer purchasing behaviour',
    'textarea',
    attr('audienceBuyingBehaviour'),
  ),
  field(53, 'audience', 'Customer income segment', 'select', attr('audienceIncomeSegment'), {
    options: INCOME_OPTIONS,
  }),
  field(
    54,
    'audience',
    'Customer problems and pain points',
    'textarea',
    attr('audiencePainPoints'),
    { sources: ai },
  ),
  field(55, 'audience', 'Customer expectations', 'textarea', attr('audienceExpectations')),
  field(56, 'audience', 'Why customers choose you', 'textarea', attr('reasonsToChoose')),
  field(57, 'audience', 'Why customers might not buy', 'textarea', attr('reasonsNotToBuy')),
  field(58, 'audience', 'Ideal customer profile', 'textarea', attr('idealCustomer'), {
    sources: ai,
  }),
  field(59, 'audience', 'Customer personas', 'textarea', attr('customerPersonas'), { sources: ai }),

  // 4. Brand identity
  hide(
    field(60, 'brand', 'Brand name', 'text', alias('brand.name'), {
      helper: 'Edit this under Basic business profile.',
    }),
  ),
  field(61, 'brand', 'Brand logo', 'url', col('logoUrl'), { sources: website }),
  hide(
    field(62, 'brand', 'Logo variations', 'tags', attr('logoVariations'), {
      helper: 'Links to other versions of your logo.',
    }),
  ),
  field(63, 'brand', 'Primary brand colours', 'tags', col('primaryColors'), {
    helper: 'For example: #0f6b62.',
    sources: website,
  }),
  hide(
    field(64, 'brand', 'Secondary brand colours', 'tags', col('secondaryColors'), {
      sources: website,
    }),
  ),
  hide(field(65, 'brand', 'Brand typography', 'tags', col('fonts'), { sources: website })),
  field(66, 'brand', 'Tagline or slogan', 'text', col('tagline'), {
    maxLength: 160,
    sources: website,
  }),
  field(67, 'brand', 'Brand mission', 'textarea', col('mission'), { sources: website }),
  hide(field(68, 'brand', 'Brand vision', 'textarea', col('vision'), { sources: website })),
  hide(field(69, 'brand', 'Brand values', 'tags', col('values'), { sources: website })),
  field(70, 'brand', 'Brand personality', 'tags', col('personality'), { sources: ai }),
  hide(field(71, 'brand', 'Brand positioning', 'textarea', col('positioning'), { sources: ai })),
  hide(field(72, 'brand', 'Brand story', 'textarea', col('story'), { sources: website })),
  hide(
    field(73, 'brand', 'Brand communication style', 'textarea', attr('communicationStyle'), {
      sources: ai,
    }),
  ),
  field(74, 'brand', 'Preferred writing tone', 'select', col('toneOfVoice'), { options: TONES }),
  hide(
    field(75, 'brand', 'Words the brand often uses', 'tags', col('wordsToUse'), { sources: ai }),
  ),
  field(76, 'brand', 'Words and phrases to avoid', 'tags', col('wordsToAvoid')),
  hide(
    field(77, 'brand', 'Brand guidelines', 'url', attr('brandGuidelines'), {
      helper: 'A link to your brand guidelines document.',
    }),
  ),
  field(78, 'brand', 'Preferred visual aesthetics', 'textarea', attr('visualAesthetics')),
];
