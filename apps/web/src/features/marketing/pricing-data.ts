export interface Plan {
  name: string;
  monthlyPrice: number;
  fromPrice?: boolean;
  credits: number;
  allowance: string;
  features: string[];
  cta: string;
  recommended?: boolean;
}

// Indicative launch pricing in rupees, GST included (as shown in the approved landing design).
export const plans: Plan[] = [
  {
    name: 'Starter',
    monthlyPrice: 1499,
    credits: 300,
    allowance: '1 brand · 1 seat · 300 credits',
    features: ['Instagram and Facebook', 'Content studio and calendar', 'Brand memory', 'Basic results'],
    cta: 'Get started',
  },
  {
    name: 'Growth',
    monthlyPrice: 3999,
    credits: 1200,
    allowance: '3 brands · 3 seats · 1,200 credits',
    features: ['Everything in Starter', 'Meta and Google ads', 'Team approvals', 'Google Business, LinkedIn, YouTube', 'Weekly AI note'],
    cta: 'Get started',
    recommended: true,
  },
  {
    name: 'Pro',
    monthlyPrice: 7999,
    credits: 3500,
    allowance: '10 brands · 8 seats · 3,500 credits',
    features: ['Everything in Growth', 'Autopilot', 'Inbox and AI replies', 'WhatsApp and email', 'Landing pages'],
    cta: 'Get started',
  },
  {
    name: 'Agency',
    monthlyPrice: 19999,
    fromPrice: true,
    credits: 10000,
    allowance: '25+ brands · 20 seats · 10,000 credits',
    features: ['Everything in Pro', 'Pooled credits', 'White-label reports', 'Client approvals'],
    cta: 'Talk to us',
  },
];

// Yearly billing gives two months free.
export const YEARLY_MONTHS_CHARGED = 10;

export const creditActions = [
  { id: 'image', label: 'Image posts', credits: 4, initial: 20 },
  { id: 'reel', label: 'Short reels', credits: 20, initial: 6 },
  { id: 'shoot', label: 'Photoshoots', credits: 15, initial: 2 },
] as const;

export type CreditActionId = (typeof creditActions)[number]['id'];

export const formatRupees = (amount: number) => `₹${amount.toLocaleString('en-IN')}`;
