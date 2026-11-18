import { attr, field } from './define';
import type { FieldKind, ProfileFieldDef } from './types';

// Category 12: questions that depend on the kind of business. Only the pack
// matching the brand's category is shown, never every pack to everyone.
const PACKS: Record<string, [key: string, label: string, kind: FieldKind][]> = {
  fashion: [
    ['fabrics', 'Fabrics and materials', 'tags'],
    ['sizes', 'Sizes offered', 'tags'],
    ['collections', 'Collections', 'tags'],
    ['styling', 'Styling guidance', 'textarea'],
    ['seasonalTrends', 'Seasonal trends', 'textarea'],
  ],
  restaurant: [
    ['menu', 'Menu highlights', 'textarea'],
    ['ingredients', 'Key ingredients', 'tags'],
    ['cuisines', 'Cuisines', 'tags'],
    ['priceRange', 'Typical price per person', 'text'],
    ['reservations', 'Reservations and ordering', 'textarea'],
  ],
  real_estate: [
    ['listings', 'Property listings', 'textarea'],
    ['locations', 'Locations and micro-markets', 'tags'],
    ['areas', 'Property sizes', 'text'],
    ['amenities', 'Amenities', 'tags'],
    ['priceRange', 'Price range', 'text'],
  ],
  healthcare: [
    ['services', 'Services and specialities', 'tags'],
    ['departments', 'Departments', 'tags'],
    ['appointments', 'Appointment information', 'textarea'],
    ['credentials', 'Doctors and credentials', 'textarea'],
  ],
  education: [
    ['courses', 'Courses', 'tags'],
    ['curriculum', 'Curriculum', 'textarea'],
    ['duration', 'Course duration', 'text'],
    ['fees', 'Fees', 'text'],
    ['eligibility', 'Eligibility', 'text'],
  ],
  fitness: [
    ['plans', 'Membership plans', 'textarea'],
    ['trainers', 'Trainers', 'tags'],
    ['programmes', 'Programmes and classes', 'tags'],
    ['facilities', 'Facilities', 'tags'],
  ],
  beauty: [
    ['treatments', 'Treatments', 'tags'],
    ['pricing', 'Pricing', 'textarea'],
    ['packages', 'Packages', 'textarea'],
    ['slots', 'Appointment slots', 'text'],
  ],
  ecommerce: [
    ['skus', 'SKU approach', 'text'],
    ['variants', 'Variants', 'text'],
    ['inventory', 'Inventory', 'text'],
    ['shipping', 'Shipping details', 'textarea'],
    ['catalogue', 'Catalogue link', 'url'],
  ],
  travel: [
    ['destinations', 'Destinations', 'tags'],
    ['packages', 'Packages', 'textarea'],
    ['itineraries', 'Itineraries', 'textarea'],
    ['inclusions', 'Inclusions', 'tags'],
  ],
};

export const PACK_NAMES = Object.keys(PACKS);

export const PACK_FIELDS: readonly ProfileFieldDef[] = Object.entries(PACKS).flatMap(([pack, entries]) =>
  entries.map(([key, label, kind]) =>
    field(`${pack}.${key}`, 'specific', label, kind, attr(`pack_${pack}_${key}`), { pack }),
  ),
);
