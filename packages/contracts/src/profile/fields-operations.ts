import { SALES_CHANNEL_OPTIONS, attr, connection, field, hide, policy } from './define';
import type { ProfileFieldDef } from './types';

const website = ['website', 'owner'] as const;

// Categories 9 to 11.
export const OPERATIONS_FIELDS: readonly ProfileFieldDef[] = [
  // 9. Sales and customer journey
  field(139, 'sales', 'Sales channels', 'multiselect', attr('salesChannels'), { options: SALES_CHANNEL_OPTIONS }),
  field(140, 'sales', 'Online store link', 'url', attr('onlineStoreUrl'), { sources: website }),
  field(141, 'sales', 'Physical store available', 'yesno', attr('hasPhysicalStore')),
  field(142, 'sales', 'Payment methods', 'tags', attr('paymentMethods'), { sources: website }),
  // Hidden fields in this section are filled by the scan, kept per service, internal process,
  // or covered by Offers and campaigns; they stay stored for the AI.
  hide(field(143, 'sales', 'Shipping methods', 'tags', attr('shippingMethods'), { sources: website })),
  field(144, 'sales', 'Return and refund policy', 'textarea', policy('return_policy'), { sources: website }),
  hide(field(145, 'sales', 'Cancellation policy', 'textarea', policy('cancellation'), { sources: website })),
  hide(field(146, 'sales', 'Warranty information', 'textarea', policy('warranty'), { sources: website })),
  hide(field(147, 'sales', 'Booking process', 'textarea', attr('bookingProcess'))),
  field(148, 'sales', 'Enquiry process', 'textarea', attr('enquiryProcess')),
  hide(field(149, 'sales', 'Customer support channels', 'tags', attr('supportChannels'), { sources: website })),
  field(150, 'sales', 'Frequently asked questions', 'textarea', attr('faqs'), { helper: 'Questions customers ask, with your answers.', sources: website }),
  hide(field(151, 'sales', 'Customer onboarding process', 'textarea', attr('onboardingProcess'))),
  hide(field(152, 'sales', 'Customer follow-up process', 'textarea', attr('followUpProcess'))),
  hide(field(153, 'sales', 'Loyalty programmes', 'textarea', attr('loyaltyProgramme'))),
  hide(field(154, 'sales', 'Referral programmes', 'textarea', attr('referralProgramme'))),

  // 10. Offers and campaigns
  field(155, 'offers', 'Current promotions', 'textarea', attr('currentPromotions'), { sources: website }),
  field(156, 'offers', 'Discount codes', 'tags', attr('discountCodes')),
  // Per-campaign details belong on each campaign in the planner (M5), not on the profile;
  // the rest overlap the visible fields. All stay stored for the AI.
  hide(field(157, 'offers', 'Seasonal offers', 'textarea', attr('seasonalOffers'))),
  field(158, 'offers', 'Upcoming launches', 'textarea', attr('upcomingLaunches')),
  field(159, 'offers', 'Festival campaigns', 'textarea', attr('festivalCampaigns')),
  hide(field(160, 'offers', 'Special events', 'textarea', attr('specialEvents'))),
  hide(field(161, 'offers', 'Limited-time offers', 'textarea', attr('limitedTimeOffers'))),
  hide(field(162, 'offers', 'Campaign start date', 'date', attr('campaignStartDate'))),
  hide(field(163, 'offers', 'Campaign end date', 'date', attr('campaignEndDate'))),
  hide(field(164, 'offers', 'Campaign target audience', 'text', attr('campaignAudience'), { maxLength: 200 })),
  hide(field(165, 'offers', 'Campaign objectives', 'text', attr('campaignObjectives'), { maxLength: 200 })),
  hide(field(166, 'offers', 'Previous campaign performance', 'textarea', attr('previousCampaignPerformance'))),

  // 11. Online reputation
  field(167, 'reputation', 'Google Business Profile', 'url', attr('googleBusinessUrl'), { sources: website }),
  field(168, 'reputation', 'Google ratings', 'text', connection),
  field(169, 'reputation', 'Google customer reviews', 'text', connection),
  field(170, 'reputation', 'Website testimonials', 'textarea', attr('testimonials'), { sources: website }),
  field(171, 'reputation', 'Social media comments', 'text', connection),
  // Hidden: overlaps testimonials and the two themes, repeats the FAQs in Sales, or is too
  // vague for an owner to fill. Stored for the AI.
  hide(field(172, 'reputation', 'Customer feedback', 'textarea', attr('customerFeedback'))),
  field(173, 'reputation', 'Common customer complaints', 'textarea', attr('commonComplaints')),
  field(174, 'reputation', 'Positive feedback themes', 'textarea', attr('positiveThemes')),
  hide(field(175, 'reputation', 'Frequently asked customer questions', 'textarea', attr('customerQuestions'))),
  hide(field(176, 'reputation', 'Brand reputation', 'textarea', attr('brandReputation'))),
];
