import type { AccountType, OnboardingStep } from '@marketpilot/contracts';

// Wording from the approved setup design (docs/design/MarketPilot-onboarding-netlify/setup).

export function stepLabel(step: OnboardingStep, track: AccountType): string {
  switch (step) {
    case 'type':
      return 'Account';
    case 'basics':
      return track === 'creator' ? 'Your link' : 'Basics';
    case 'review':
      return 'Your brand';
    case 'about':
      return 'Your voice';
    case 'goals':
      return 'Goals';
  }
}

export type BuyOption = 'online' | 'shop' | 'whatsapp';

// Each answer maps onto the profile's sales channel options.
export const BUY_OPTIONS: { id: BuyOption; short: string; title: string; description: string; cta: string; channels: string[] }[] = [
  {
    id: 'online',
    short: 'Online',
    title: 'On my website or an online store',
    description: 'Your own website, or a store on Amazon, Flipkart or Meesho',
    cta: 'Shop on our website',
    channels: ['website', 'marketplace'],
  },
  {
    id: 'shop',
    short: 'At the shop',
    title: 'At my shop',
    description: 'People walk in and buy at the counter',
    cta: 'Visit us at the shop',
    channels: ['store'],
  },
  {
    id: 'whatsapp',
    short: 'WhatsApp',
    title: 'On WhatsApp, phone or delivery apps',
    description: 'Customers message or call, or order on Swiggy or Zomato',
    cta: 'Message us on WhatsApp',
    channels: ['whatsapp', 'phone'],
  },
];

export function channelsFor(buys: readonly BuyOption[]): string[] {
  return [...new Set(BUY_OPTIONS.filter((o) => buys.includes(o.id)).flatMap((o) => o.channels))];
}

export function buysFrom(channels: readonly string[] | undefined): BuyOption[] {
  if (!channels) return [];
  return BUY_OPTIONS.filter((o) => o.channels.some((c) => channels.includes(c))).map((o) => o.id);
}

// Tone values are the profile's TONES; the design shows four of them with an example line.
export const TONE_CARDS: Record<AccountType, { value: string; title: string; sample: string; headline: string; caption: string }[]> = {
  business: [
    {
      value: 'friendly',
      title: 'Warm and friendly',
      sample: '“New stock just came in. Come say hello at the shop!”',
      headline: 'New stock is here',
      caption: 'Our new range just came in, fresh and ready for the season. Come say hello and take a look!',
    },
    {
      value: 'professional',
      title: 'Expert and helpful',
      sample: '“How to pick the right one, and why it lasts longer.”',
      headline: 'How to pick the right one',
      caption: 'Three simple things to check before you buy, so it lasts for years. Ask us in the shop or on WhatsApp.',
    },
    {
      value: 'bold',
      title: 'Bold and festive',
      sample: '“Wedding season is here! Shop early for the best picks.”',
      headline: 'Wedding season is here!',
      caption: 'Our festive range is in. The best pieces go first, so come early or book on WhatsApp.',
    },
    {
      value: 'premium',
      title: 'Calm and premium',
      sample: '“Made slowly, with care. Built to last.”',
      headline: 'Made slowly, built to last',
      caption: 'Every piece is finished by hand. Quiet colours, made to be used for years.',
    },
  ],
  creator: [
    {
      value: 'friendly',
      title: 'Warm and chatty',
      sample: '“Made this for my family tonight, and it was gone in 10 minutes!”',
      headline: 'Tonight’s 15-minute favourite',
      caption: 'Made this for my family tonight and it was gone in 10 minutes! Full recipe in my stories.',
    },
    {
      value: 'professional',
      title: 'Tips and how-to',
      sample: '“3 mistakes beginners make, and how I fix them.”',
      headline: '3 mistakes beginners make',
      caption: 'These three trip up almost everyone. Here is how I fix each one, step by step.',
    },
    {
      value: 'bold',
      title: 'Fun and bold',
      sample: '“Festival season! Who is joining me this year?”',
      headline: 'Festival season is here!',
      caption: 'Who is joining me this year? I am trying three new ideas. Save this for later!',
    },
    {
      value: 'premium',
      title: 'Calm and simple',
      sample: '“One idea, five minutes, a quiet Sunday.”',
      headline: 'One idea, five minutes',
      caption: 'A quiet Sunday and one simple idea. Nothing fancy, and nothing to clean up after.',
    },
  ],
};

export const AVOID_SUGGESTIONS = ['Politics', 'Religion', 'Competitor names', 'Discounts'];

// Goal values are the profile's OBJECTIVES.
export const GOAL_CARDS: Record<AccountType, { value: string; title: string; description: string }[]> = {
  business: [
    { value: 'leads', title: 'Get more enquiries', description: 'Calls, WhatsApp messages and form fills' },
    { value: 'sales', title: 'Sell more online', description: 'Orders on your website or WhatsApp' },
    { value: 'footfall', title: 'Bring people to my shop', description: 'More walk-ins at your store' },
    { value: 'awareness', title: 'Get known in my area', description: 'More people who know your name' },
  ],
  creator: [
    { value: 'followers', title: 'Grow my followers', description: 'Reach new people who like what you post' },
    { value: 'engagement', title: 'More likes and comments', description: 'Build a closer community' },
    { value: 'sales', title: 'Sell my own product', description: 'Courses, e-books, classes or merch' },
    { value: 'awareness', title: 'Get known for what I do', description: 'Look ready for brand partnerships' },
  ],
};

export const REACH_HELP: Record<string, string> = {
  local: 'We focus on people near you, in your city.',
  state: 'We focus on people across your state.',
  india: 'We focus on people across India.',
  global: 'We also reach Indians living abroad.',
};

export const BUDGET_CHIPS = [
  { value: 'none', label: 'No ads for now', amount: 0 },
  { value: 'up5k', label: 'Up to ₹5,000', amount: 5000 },
  { value: 'up15k', label: '₹5,000 to ₹15,000', amount: 15000 },
  { value: 'custom', label: 'Custom amount', amount: null },
] as const;
