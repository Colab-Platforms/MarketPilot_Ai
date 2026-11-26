import { Anek_Latin, Bricolage_Grotesque, Noto_Sans, Noto_Sans_Devanagari } from 'next/font/google';

const displayFace = Bricolage_Grotesque({
  subsets: ['latin'],
  weight: ['500', '600', '700', '800'],
  variable: '--font-display-face',
  display: 'swap',
});

const bodyFace = Noto_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-marketing-sans',
  display: 'swap',
});

const devanagariFace = Noto_Sans_Devanagari({
  subsets: ['devanagari'],
  weight: ['400', '600', '700'],
  variable: '--font-devanagari-face',
  display: 'swap',
});

// Sign-in and setup use Anek Latin for headings (approved onboarding design) on the same body face.
const entryDisplayFace = Anek_Latin({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-display-face',
  display: 'swap',
});

// Pair either set with data-surface="marketing" on the same element (see tokens.css).
export const marketingFontVariables = `${displayFace.variable} ${bodyFace.variable} ${devanagariFace.variable}`;
export const entryFontVariables = `${entryDisplayFace.variable} ${bodyFace.variable} ${devanagariFace.variable}`;
