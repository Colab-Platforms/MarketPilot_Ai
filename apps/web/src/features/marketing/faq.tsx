import { Plus } from 'lucide-react';
import { Container, SectionHeading, focusRing } from './section';

const questions = [
  {
    q: 'What is MarketPilot?',
    a: 'A marketing assistant for local businesses. It plans, creates and publishes your social posts, and you approve what goes out.',
  },
  {
    q: 'Do I need marketing or design skills?',
    a: 'No. You share your website or Instagram page, and MarketPilot learns your products, tone and offers from there.',
  },
  {
    q: 'Will it post without asking me?',
    a: 'Not unless you choose that. Every workspace starts with you approving each post, and you can change this per channel.',
  },
  {
    q: 'Which platforms does it publish to?',
    a: 'Instagram and Facebook first. WhatsApp is planned for later.',
  },
  {
    q: 'Does it work in Hindi and other Indian languages?',
    a: 'It is designed for India, and Hindi and English come first. More Indian languages are planned.',
  },
  {
    q: 'How are my accounts and data kept safe?',
    a: 'Each business’s data is kept separate from every other. Connection tokens are encrypted and never sent to your browser.',
  },
  {
    q: 'What does it cost?',
    a: 'You pay with credits, and every action shows its cost before it runs. Plans and prices will be announced before launch.',
  },
];

export function Faq() {
  return (
    <section id="faq" aria-labelledby="faq-title" className="scroll-mt-16 py-12 md:py-16">
      <Container>
        <SectionHeading id="faq-title" eyebrow="Questions" title="Questions, answered." centered />
        <div className="mx-auto mt-8 max-w-content border-t border-line">
          {questions.map(({ q, a }) => (
            <details key={q} className="group border-b border-line">
              <summary
                className={`flex min-h-12 cursor-pointer list-none items-center justify-between gap-4 rounded-sm py-3 text-heading [&::-webkit-details-marker]:hidden ${focusRing}`}
              >
                {q}
                <Plus
                  className="size-5 shrink-0 text-ink-secondary transition-transform duration-base ease-standard group-open:rotate-45"
                  strokeWidth={1.5}
                  aria-hidden="true"
                />
              </summary>
              <p className="pb-4 text-body text-ink-secondary">{a}</p>
            </details>
          ))}
        </div>
      </Container>
    </section>
  );
}
