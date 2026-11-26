import { clsx, type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

// The preset names its own sizes (text-label, h-control...). tailwind-merge only knows Tailwind's
// defaults, so without these lists it reads text-label as a colour, and cannot tell that h-auto
// should replace h-control: it would keep both and let stylesheet order decide.
const fontSizes = [
  'display', 'title', 'heading', 'body', 'label', 'caption', 'metric',
  'lead', 'lead-lg', 'stat', 'section', 'hero', 'banner',
];
const heights = [
  'control', 'control-sm', 'control-lg', 'control-xl', 'topbar', 'tile', 'chart', 'chart-sm', 'thumb', 'sheet', 'preview',
];
const widths = ['tile', 'sidebar', 'rail', 'menu', 'panel', 'control-sm', 'control', 'thumb', 'aside', 'phone'];

const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': [{ text: fontSizes }],
      h: [{ h: heights }],
      w: [{ w: widths }],
      'min-h': [{ 'min-h': ['touch'] }],
    },
  },
});

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
