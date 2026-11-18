import { z } from 'zod';
import { accountTypeSchema } from '../identity/auth';
import { MAX_PRODUCT_IMAGES } from './media';
import { fieldValueSchema } from './values';

export const fieldStatusSchema = z.enum([
  'missing',
  // Entered or confirmed by the owner.
  'owner',
  // Read from the owner's website and approved.
  'website',
  'ai',
  'connected',
  // Computed from other data, for example from the catalogue.
  'derived',
  // Filled once an account is connected.
  'needs_connection',
]);
export type FieldStatus = z.infer<typeof fieldStatusSchema>;

export const profileFieldStateSchema = z.object({
  id: z.union([z.number(), z.string()]),
  key: z.string(),
  label: z.string(),
  kind: z.string(),
  helper: z.string().optional(),
  options: z.array(z.object({ value: z.string(), label: z.string() })).optional(),
  maxLength: z.number().optional(),
  required: z.boolean().optional(),
  hidden: z.boolean().optional(),
  editable: z.boolean(),
  sources: z.array(z.string()),
  value: fieldValueSchema,
  // For read-only summaries: a sentence such as "24 products".
  display: z.string().nullable(),
  status: fieldStatusSchema,
  sourceUrl: z.string().nullable(),
  updatedAt: z.string().nullable(),
});
export type ProfileFieldState = z.infer<typeof profileFieldStateSchema>;

export const profileSectionStateSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  filled: z.number().int(),
  total: z.number().int(),
  // The owner switched this section off as not relevant; it leaves overall completeness.
  skipped: z.boolean(),
  canSkip: z.boolean(),
  fields: z.array(profileFieldStateSchema),
});
export type ProfileSectionState = z.infer<typeof profileSectionStateSchema>;

export const updateSectionSchema = z.object({ skipped: z.boolean() }).strict();
export type UpdateSectionInput = z.infer<typeof updateSectionSchema>;

export const profileResponseSchema = z.object({
  brand: z.object({
    id: z.string().uuid(),
    name: z.string(),
    websiteUrl: z.string().nullable(),
    accountType: accountTypeSchema,
    category: z.string().nullable(),
  }),
  completeness: z.object({ filled: z.number().int(), total: z.number().int() }),
  sections: z.array(profileSectionStateSchema),
});
export type ProfileResponse = z.infer<typeof profileResponseSchema>;

const availabilitySchema = z.enum(['in_stock', 'out_of_stock', 'preorder', 'unknown']);

export const productSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  description: z.string().nullable(),
  category: z.string().nullable(),
  priceMinor: z.number().int().nullable(),
  currency: z.string(),
  availability: availabilitySchema,
  url: z.string().nullable(),
  imageUrl: z.string().nullable(),
  imageUrls: z.array(z.string()),
  // The owner's pick for "our most popular": what posts and answers lead with.
  featured: z.boolean(),
  source: z.enum(['website', 'owner']),
});
export type ProductItem = z.infer<typeof productSchema>;

export const productListSchema = z.object({ products: z.array(productSchema) });
export type ProductList = z.infer<typeof productListSchema>;

export const serviceSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  description: z.string().nullable(),
  priceMinor: z.number().int().nullable(),
  currency: z.string(),
  durationMinutes: z.number().int().nullable(),
  benefits: z.array(z.string()),
  bookingProcess: z.string().nullable(),
  featured: z.boolean(),
  source: z.enum(['website', 'owner']),
});
export type ServiceItem = z.infer<typeof serviceSchema>;

export const serviceListSchema = z.object({ services: z.array(serviceSchema) });
export type ServiceList = z.infer<typeof serviceListSchema>;

// One entry in the catalogue part of a profile update. No `id` creates, an `id` edits only
// the fields sent, and `remove` deletes. A name is required to create.
export const productChangeSchema = z
  .object({
    id: z.string().uuid(),
    remove: z.boolean(),
    name: z.string().trim().min(1, 'Enter a name').max(200),
    description: z.string().trim().max(1000).nullable(),
    category: z.string().trim().max(120).nullable(),
    // Rupees, up to two decimals.
    price: z.number().min(0).max(100_000_000).nullable(),
    availability: availabilitySchema,
    url: z.string().trim().max(500).nullable(),
    // The full list, in display order. Each must already be on the product or uploaded
    // through a ticket from POST /brand/media/upload-ticket.
    imageUrls: z.array(z.string().url().max(500)).max(MAX_PRODUCT_IMAGES),
    featured: z.boolean(),
  })
  .partial()
  .strict();
export type ProductChange = z.infer<typeof productChangeSchema>;

export const serviceChangeSchema = z
  .object({
    id: z.string().uuid(),
    remove: z.boolean(),
    name: z.string().trim().min(1, 'Enter a name').max(200),
    description: z.string().trim().max(1000).nullable(),
    price: z.number().min(0).max(100_000_000).nullable(),
    durationMinutes: z.number().int().min(1).max(1_440).nullable(),
    benefits: z.array(z.string().trim().min(1).max(200)).max(20),
    bookingProcess: z.string().trim().max(500).nullable(),
    featured: z.boolean(),
  })
  .partial()
  .strict();
export type ServiceChange = z.infer<typeof serviceChangeSchema>;

// The single write path for everything about the business: profile fields, products
// and services together, saved as one change.
export const updateProfileSchema = z
  .object({
    // Only the fields that changed. A null value clears the field.
    values: z
      .record(z.string().max(80), z.unknown())
      .refine((v) => Object.keys(v).length <= 200, 'Too many fields')
      .default({}),
    products: z.array(productChangeSchema).max(200).default([]),
    services: z.array(serviceChangeSchema).max(200).default([]),
  })
  .refine((v) => Object.keys(v.values).length + v.products.length + v.services.length > 0, 'Nothing to save');
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
