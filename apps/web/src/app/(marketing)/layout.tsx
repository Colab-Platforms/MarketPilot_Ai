import { Fraunces } from 'next/font/google';

const displayFace = Fraunces({
  subsets: ['latin'],
  variable: '--font-display-face',
  display: 'swap',
});

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return <div className={displayFace.variable}>{children}</div>;
}
