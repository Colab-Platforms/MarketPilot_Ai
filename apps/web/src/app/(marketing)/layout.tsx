import { marketingFontVariables } from '@/features/marketing/fonts';
import '@/features/marketing/marketing.css';

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div data-surface="marketing" className={`${marketingFontVariables} bg-canvas font-sans text-ink`}>
      {children}
    </div>
  );
}
