# MarketPilot AI Design System

Version 0.1, a proposed direction to react to. Brand colours are not final; every value below is a token so a re-skin changes one file (`packages/ui/src/tokens`).

## 1. Principles

1. **Calm and legible.** The users are owners with no marketing background. Fewer elements, clear hierarchy, generous space around decisions.
2. **Show the next action.** Home answers: what goes out next, what needs my approval, how are we doing.
3. **Honest AI.** Before any AI action runs, show what it will do, why, and what it costs (credits). After, show what changed and how to undo.
4. **Content is the hero.** UI chrome is quiet so posts, images and reels carry the colour.
5. **Dense where work happens, airy where decisions happen.** Calendar and tables are compact; approvals and onboarding are spacious.
6. **One way to do each thing.** Same pattern for the same job across the product.

## 2. Typography

- UI and body: **Geist Sans**. Numbers and metrics use `font-variant-numeric: tabular-nums`.
- Mono (IDs, code, API keys): **Geist Mono**.
- Indic scripts: Noto Sans Devanagari, Gujarati, Bengali, Tamil, Telugu, Kannada, Malayalam, Gurmukhi as fallbacks, loaded by script with `unicode-range`. Indic text gets +0.08 line-height automatically.
- No decorative or display font in the product UI. The marketing site may add one later.

| Token | Size / line | Weight | Use |
|---|---|---|---|
| `text-display` | 32 / 40 | 600 | Page hero, onboarding |
| `text-title` | 22 / 30 | 600 | Page titles |
| `text-heading` | 17 / 24 | 600 | Section and card titles |
| `text-body` | 14 / 22 | 400 | Default |
| `text-label` | 13 / 18 | 500 | Form labels, table headers, buttons |
| `text-caption` | 12 / 16 | 400 | Meta text, timestamps |
| `text-metric` | 28 / 32 | 600 | KPI numbers (tabular) |

Letter-spacing: -0.01em on 22px and above, 0 elsewhere. Maximum line length 68 characters for prose.

## 3. Colour

"Monsoon Calm": cool slate neutrals, a navy accent for actions, a monsoon-yellow highlight, separate semantic colours. No gradients in product UI. Contrast is verified against WCAG 2.2 AA. Source design: `docs/design/MarketPilot-landing-monsoon-calm (1).html`.

### Neutrals (slate)

| Token | Light | Dark |
|---|---|---|
| `bg-canvas` | #F2F4F5 | #121413 |
| `bg-surface` | #FFFFFF | #1A1D1C |
| `bg-subtle` | #E8ECEE | #232726 |
| `bg-muted` | #DDE3E6 | #2A2F2D |
| `border-default` | #D9DFE2 | #313635 |
| `border-strong` | #B6C0C6 | #454B49 |
| `text-primary` | #16222B | #EFF1EF |
| `text-secondary` | #36444E | #D3D8D6 |
| `text-tertiary` | #59666F | #A2AAA7 |

### Accent (navy; primary buttons, links, focus rings)

| Token | Light | Dark |
|---|---|---|
| `accent-solid` | #2F5873 | #EFF1EF |
| `accent-solid-hover` | #24465C | #D3D8D6 |
| `accent-subtle` | #E3ECF2 | #1E2B33 |
| `accent-border` | #A9C2D3 | #3A5568 |
| `on-accent` | #FFFFFF | #121413 |

### Highlight (monsoon yellow; badges, progress, selection marks)

| Token | Light | Dark |
|---|---|---|
| `highlight-solid` | #F5C432 | #F5C432 |
| `on-highlight` | #121413 | #121413 |
| `highlight-subtle` | #FFF4CC | #322D17 |
| `highlight-text` | #6A4D00 | #F5C432 |

Yellow is never used as text or as a focus ring on light surfaces (it fails contrast); focus rings use `accent-solid`.

### Semantic

| Role | Solid | Subtle bg |
|---|---|---|
| `success` | #2F7D4F | #E6F3EA |
| `warning` | #B7791F | #FBF1DC |
| `danger` | #B3372C | #FBE7E4 |
| `info` | #3B63B8 | #E7EEFA |

Dark variants are derived by the same roles (lighter solid, darker subtle); defined in the token file.

### Status mapping (calendar and jobs)

Draft = neutral, In review = info, Approved = accent, Scheduled = accent subtle with clock icon, Publishing = info with progress, Published = success, Failed = danger, Cancelled = neutral struck through. Status is never conveyed by colour alone: always an icon and a label.

### Channel colours

Platform brand colours appear only in small channel marks (16-20 px icon), never as backgrounds.

## 4. Spacing, radius, elevation, motion

- Spacing scale (px): 2, 4, 8, 12, 16, 20, 24, 32, 48, 64. Base grid 4. Page gutters: 16 mobile, 24 tablet, 32 desktop.
- Radius: `sm` 6 (inputs, chips), `md` 10 (buttons, cards), `lg` 14 (modals, sheets), `full` (avatars, pills).
- Elevation: borders first, shadow second.
  - `shadow-1`: 0 1px 2px rgba(28,26,23,.06) for cards on hover.
  - `shadow-2`: 0 8px 24px rgba(28,26,23,.10) for popovers and menus.
  - `shadow-3`: 0 16px 48px rgba(28,26,23,.16) for modals.
- Motion: 120 ms for hover and press, 200 ms for panels, 280 ms for page-level. Easing `cubic-bezier(0.2, 0, 0, 1)`. Respect `prefers-reduced-motion`: replace movement with fades.

## 5. Layout

- App shell: left rail 232 px (collapses to 64 px icon rail below 1280 px, to a bottom tab bar below 768 px), top bar 56 px with brand switcher, credits meter, notifications, profile.
- Content max width 1200 px for dashboards, full width for calendar and library. Settings pages 720 px.
- Grid: 12 columns desktop, 8 tablet, 4 mobile.
- Breakpoints: 360, 768, 1024, 1280, 1536.
- Primary navigation: Home, Create, Calendar, Library, Analytics, Settings. The AI copilot opens as a right panel (desktop) or bottom sheet (mobile), reachable from every screen.

## 6. Components

All built on Radix primitives, styled only with tokens, documented in Storybook with every state.

**Button.** Variants: `primary` (accent solid), `secondary` (surface + border), `ghost`, `danger`. Sizes: `sm` 32, `md` 40, `lg` 48 px height. One primary per view region. Icon-only buttons need a tooltip and an accessible name. Loading state keeps width and shows a spinner; disabled uses `text-tertiary`, not reduced opacity alone.

**Input, select, textarea.** 40 px height, `sm` radius, 1 px `border-default`, focus ring 2 px `accent-solid` with 2 px offset. Label above, helper text below, error text replaces helper in `danger`. Never use placeholder as label.

**Card.** `bg-surface`, 1 px border, `md` radius, 16-24 px padding. No nested cards.

**Table.** 44 px rows (36 compact), sticky header, `text-label` headers in `text-secondary`, numeric columns right-aligned and tabular, row hover `bg-subtle`.

**Chip and badge.** 24 px height, `full` radius for status, `sm` for tags.

**Credit cost chip.** Appears on every AI action button: "Generate - 4 credits". The confirm dialog repeats the cost and the remaining balance.

**Approval card.** Preview of the post as it will appear on its platform, caption, channel, scheduled time, safety result, actions: Approve, Edit, Reject. Keyboard shortcuts A, E, R. Batch approve with multi-select.

**Calendar item.** Thumbnail, channel mark, time, status chip. Drag handle visible on hover and focus. Conflict warnings use `warning` with text.

**Empty states.** One sentence, one action, a simple line illustration in neutral tones. **Loading** uses skeletons shaped like the final content, never a bare spinner for page content. **Errors** say what happened and the next step, with a retry.

**Toasts** appear bottom-left, auto-dismiss at 5 s, persistent for errors with actions.

**Icons.** Lucide, 16 / 20 px, 1.5 px stroke, `currentColor`.

## 7. Content and tone

- Plain language, no marketing jargon in UI copy. Say "people reached", not "impressions" in the owner view; the term appears in the detailed view.
- Sentence case everywhere. Buttons start with a verb.
- Hindi UI strings are translated for meaning, not word for word, and reviewed by a native speaker.
- AI-generated text is labelled with a small "AI draft" chip until a human approves it.

## 8. Accessibility

WCAG 2.2 AA minimum: 4.5:1 text contrast, 3:1 for UI boundaries, visible focus on every interactive element, full keyboard operation of calendar and editors, 44 px minimum touch targets on mobile, labelled form controls, live regions for job progress, reduced-motion support, no colour-only meaning.

## 9. Implementation rules

- Tokens are defined once in `packages/ui/src/tokens` as CSS variables, exposed through the Tailwind preset. Components and pages may not use raw colour, spacing or font values.
- Light and dark themes via `data-theme`, defaulting to system preference. White-label themes later override the accent and neutral roles only.
- Every component ships with: all states, dark mode, 360 px layout, keyboard behaviour and a Storybook story.
- Visual regression via Storybook snapshots in CI once the primitives stabilise.
- Open items to confirm with you: final brand colour, logo and wordmark, tone of illustration, and whether to keep dark mode in the first release.

## 10. Marketing site

The public landing page may use a display face and larger type. These are marketing-only and never used in the product UI.

- Faces: **Bricolage Grotesque** for display (`font-display`) and **Noto Sans** + Noto Sans Devanagari for body, loaded only by the `(marketing)` route group, which sets `data-surface="marketing"`. The product UI keeps Geist.
- Extra sizes (fluid, so phones need no override): `text-hero` clamp(40-80px), `text-section` clamp(36-68px), `text-banner` clamp(44-112px), weight 700; `text-lead` 17 / 27, `text-lead-lg` 19 / 30, `text-stat` 40 / 44 weight 800.
- Extra tokens: radius `xl` 20 and `2xl` 28, shadows `card` and `window`, spacing `24` (96 px) for section rhythm, `control-xl` 56 px CTA buttons (`Button size="xl"`), sample tile colours `tile-ink`, `tile-sky`, `tile-navy`, `tile-white`, the closing `band` and `glass`. Pattern fills (dots, stripes, marker underline) live in `features/marketing/marketing.css` and reference tokens only.
- Theme: every section follows the global light or dark theme, except the closing band and sample tiles, which keep fixed colours. Never hardcode `data-theme` on a section.
- Sample content (posts, numbers, businesses) is always labelled as a sample. No invented testimonials or customer counts. Prices shown are the indicative launch prices approved with the landing design and must be labelled as indicative.
- Ambient motion must be pausable and is disabled under `prefers-reduced-motion`. The design's flying-plane animation is not implemented for this reason.
