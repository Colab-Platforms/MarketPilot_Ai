import { Gem, GraduationCap, Scissors, Stethoscope, Store, Utensils } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Container, SectionHeading } from './section';

const audiences: { icon: LucideIcon; name: string; body: string }[] = [
  { icon: Utensils, name: 'Food and bakeries', body: 'Daily specials, festival menus and order reminders.' },
  { icon: Scissors, name: 'Salons and wellness', body: 'New services, seasonal offers and booking nudges.' },
  { icon: Stethoscope, name: 'Clinics and dentists', body: 'Helpful tips, written with claim checks built in.' },
  { icon: Gem, name: 'Jewellery and fashion', body: 'Collection launches and festive looks, ready to post.' },
  { icon: GraduationCap, name: 'Coaching and education', body: 'Batch announcements, demo classes and results.' },
  { icon: Store, name: 'Local shops and services', body: 'Offers, opening hours and updates your area cares about.' },
];

export function Audiences() {
  return (
    <section aria-labelledby="audiences-title" className="py-12 md:py-16">
      <Container>
        <SectionHeading
          id="audiences-title"
          eyebrow="Who it is for"
          title="Built for businesses that do everything themselves."
          description="If you are the owner, the cashier and the marketing team, this is for you."
        />
        <ul className="mt-8 grid list-none gap-4 p-0 md:grid-cols-2 lg:grid-cols-3">
          {audiences.map(({ icon: Icon, name, body }) => (
            <li key={name} className="rounded-md border border-line bg-surface p-4 md:p-6">
              <Icon className="size-5 text-accent" strokeWidth={1.5} aria-hidden="true" />
              <h3 className="mt-3 text-heading">{name}</h3>
              <p className="mt-2 text-body text-ink-secondary">{body}</p>
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}
