import { Minus, Plus } from 'lucide-react';
import { Container, focusRing } from './section';

const questions = [
  {
    q: 'Will it post without asking me?',
    a: 'Not unless you choose that. Every account starts at Suggest, where each post waits for your approval. You can move to Autopilot later, inside limits you set.',
  },
  {
    q: 'Do I need marketing or design skills?',
    a: 'No. Share your website or Instagram page and MarketPilot learns your products, prices and tone from there. Your part is saying yes, or asking for a change.',
  },
  {
    q: 'Which platforms does it support?',
    a: 'Instagram and Facebook first. Google Business, LinkedIn, YouTube and WhatsApp are on the way and come with the plans that list them.',
  },
  {
    q: 'Does it write in Hindi?',
    a: 'Yes. Posts can be in Hindi, English or both, in the way your customers actually talk. More Indian languages are planned.',
  },
  {
    q: 'How does pricing work?',
    a: 'Each plan includes credits every month. Every action, like an image post or a reel, shows its credit cost before you confirm. You pay in rupees, with UPI, cards or net banking, and get a GST invoice.',
  },
];

export function Faq() {
  return (
    <section id="faq" aria-labelledby="faq-title" className="scroll-mt-4 bg-canvas pb-16 pt-6 md:pb-24">
      <Container className="flex max-w-content flex-col gap-6">
        <h2 id="faq-title" className="font-display text-section">
          Questions, answered.
        </h2>
        <div className="border-t border-line">
          {questions.map(({ q, a }, index) => (
            <details key={q} open={index === 0} className="group border-b border-line">
              <summary
                className={`flex min-h-touch cursor-pointer list-none items-center justify-between gap-4 rounded-sm py-5 text-lead-lg font-semibold [&::-webkit-details-marker]:hidden ${focusRing}`}
              >
                {q}
                <span
                  aria-hidden="true"
                  className="flex size-8 shrink-0 items-center justify-center rounded-full bg-subtle group-open:bg-highlight group-open:text-highlight-on"
                >
                  <Plus className="size-5 group-open:hidden" strokeWidth={2} />
                  <Minus className="hidden size-5 group-open:block" strokeWidth={2} />
                </span>
              </summary>
              <p className="pb-6 text-lead text-ink-secondary md:pr-12">{a}</p>
            </details>
          ))}
        </div>
      </Container>
    </section>
  );
}
