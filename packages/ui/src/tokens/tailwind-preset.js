/** @type {import('tailwindcss').Config} */
module.exports = {
  theme: {
    colors: {
      transparent: 'transparent',
      current: 'currentColor',
      canvas: 'var(--bg-canvas)',
      surface: 'var(--bg-surface)',
      subtle: 'var(--bg-subtle)',
      muted: 'var(--bg-muted)',
      line: 'var(--border-default)',
      'line-strong': 'var(--border-strong)',
      ink: {
        DEFAULT: 'var(--text-primary)',
        secondary: 'var(--text-secondary)',
        tertiary: 'var(--text-tertiary)',
      },
      accent: {
        DEFAULT: 'var(--accent-solid)',
        hover: 'var(--accent-solid-hover)',
        subtle: 'var(--accent-subtle)',
        line: 'var(--accent-border)',
        on: 'var(--on-accent)',
      },
      highlight: {
        DEFAULT: 'var(--highlight-solid)',
        on: 'var(--on-highlight)',
        subtle: 'var(--highlight-subtle)',
        text: 'var(--highlight-text)',
        marker: 'var(--highlight-marker)',
      },
      tile: {
        ink: 'var(--tile-ink)',
        sky: 'var(--tile-sky)',
        navy: 'var(--tile-navy)',
        white: 'var(--tile-white)',
        mist: 'var(--tile-mist)',
        mute: 'var(--tile-mute)',
      },
      band: 'var(--band)',
      glass: 'var(--glass)',
      success: { DEFAULT: 'var(--success-solid)', subtle: 'var(--success-subtle)' },
      warning: { DEFAULT: 'var(--warning-solid)', subtle: 'var(--warning-subtle)' },
      danger: { DEFAULT: 'var(--danger-solid)', subtle: 'var(--danger-subtle)' },
      info: { DEFAULT: 'var(--info-solid)', subtle: 'var(--info-subtle)' },
    },
    spacing: {
      0: '0',
      px: '1px',
      0.5: '2px',
      1: '4px',
      2: '8px',
      3: '12px',
      4: '16px',
      5: '20px',
      6: '24px',
      8: '32px',
      12: '48px',
      16: '64px',
      // Marketing section rhythm only.
      24: '96px',
    },
    borderRadius: {
      none: '0',
      sm: 'var(--radius-sm)',
      md: 'var(--radius-md)',
      lg: 'var(--radius-lg)',
      xl: 'var(--radius-xl)',
      '2xl': 'var(--radius-2xl)',
      full: '9999px',
    },
    boxShadow: {
      none: 'none',
      1: 'var(--shadow-1)',
      2: 'var(--shadow-2)',
      3: 'var(--shadow-3)',
      card: 'var(--shadow-card)',
      window: 'var(--shadow-window)',
    },
    fontFamily: {
      sans: 'var(--font-sans)',
      mono: 'var(--font-mono)',
      display: 'var(--font-display)',
    },
    fontSize: {
      display: ['32px', { lineHeight: '40px', fontWeight: '600', letterSpacing: '-0.01em' }],
      title: ['22px', { lineHeight: '30px', fontWeight: '600', letterSpacing: '-0.01em' }],
      heading: ['17px', { lineHeight: '24px', fontWeight: '600' }],
      body: ['14px', { lineHeight: '22px', fontWeight: '400' }],
      label: ['13px', { lineHeight: '18px', fontWeight: '500' }],
      caption: ['12px', { lineHeight: '16px', fontWeight: '400' }],
      metric: ['28px', { lineHeight: '32px', fontWeight: '600' }],
      // Marketing only (DESIGN.md section 10). Fluid sizes so phones fall back without extra classes.
      lead: ['17px', { lineHeight: '27px', fontWeight: '400' }],
      'lead-lg': ['19px', { lineHeight: '30px', fontWeight: '400' }],
      stat: ['40px', { lineHeight: '44px', fontWeight: '800', letterSpacing: '-0.03em' }],
      section: ['clamp(36px, 5vw, 68px)', { lineHeight: '0.98', fontWeight: '700', letterSpacing: '-0.022em' }],
      hero: ['clamp(40px, 5.6vw, 80px)', { lineHeight: '1', fontWeight: '700', letterSpacing: '-0.022em' }],
      banner: ['clamp(44px, 7.4vw, 112px)', { lineHeight: '0.92', fontWeight: '700', letterSpacing: '-0.022em' }],
    },
    screens: {
      sm: '360px',
      md: '768px',
      lg: '1024px',
      xl: '1280px',
      '2xl': '1536px',
    },
    extend: {
      transitionTimingFunction: { standard: 'var(--ease-standard)' },
      transitionDuration: {
        fast: 'var(--duration-fast)',
        base: 'var(--duration-base)',
        slow: 'var(--duration-slow)',
      },
      height: {
        control: '40px',
        'control-sm': '32px',
        'control-lg': '48px',
        topbar: '56px',
        // Marketing call-to-action buttons.
        'control-xl': '56px',
        tile: '240px',
        chart: '220px',
        'chart-sm': '160px',
        // Image thumbnails, such as product photos in the catalogue editor.
        thumb: '96px',
        // Copilot bottom sheet on mobile (DESIGN.md section 5).
        sheet: '85dvh',
        // A vertical video player sized by height, so a 9:16 frame fits any screen.
        preview: '60dvh',
      },
      // tour: the product tour panel beside sign-in and setup.
      maxWidth: { page: '1200px', content: '720px', form: '400px', prose: '68ch', tour: '760px' },
      // A full-size image or video in a dialog, leaving room for its details below.
      maxHeight: { preview: '60dvh' },
      width: {
        tile: '168px',
        sidebar: '232px',
        rail: '64px',
        menu: '320px',
        // Copilot right panel on desktop.
        panel: '400px',
        'control-sm': '32px',
        control: '40px',
        thumb: '96px',
        // Narrow side cards in marketing mock-ups.
        aside: '240px',
        // The phone frame in the landing hero.
        phone: '208px',
      },
      // Square sizes: the page-level completeness ring.
      size: { ring: '80px' },
      minWidth: { menu: '240px', table: '560px' },
      minHeight: { touch: '44px' },
    },
  },
};
