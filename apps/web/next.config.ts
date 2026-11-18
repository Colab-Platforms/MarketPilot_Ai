import type { NextConfig } from 'next';

const config: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@marketpilot/ui'],
  poweredByHeader: false,
  // The default bottom-left badge covers the sidebar's Settings link in development.
  devIndicators: { position: 'bottom-right' },
  // Lets a verification build run beside a live dev server without sharing `.next`.
  distDir: process.env.NEXT_DIST_DIR ?? '.next',
};

export default config;
