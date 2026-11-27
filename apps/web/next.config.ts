import type { NextConfig } from 'next';

// Serves the API under the web origin so the SameSite=Lax refresh cookie stays first-party
// when web and API are on unrelated hosts (vercel.app and onrender.com).
const apiProxyTarget = process.env.API_PROXY_TARGET;

const config: NextConfig = {
  async rewrites() {
    if (!apiProxyTarget) return [];
    return [{ source: '/v1/:path*', destination: `${apiProxyTarget}/v1/:path*` }];
  },
  reactStrictMode: true,
  transpilePackages: ['@marketpilot/ui'],
  poweredByHeader: false,
  // The default bottom-left badge covers the sidebar's Settings link in development.
  devIndicators: { position: 'bottom-right' },
  // Lets a verification build run beside a live dev server without sharing `.next`.
  distDir: process.env.NEXT_DIST_DIR ?? '.next',
};

export default config;
