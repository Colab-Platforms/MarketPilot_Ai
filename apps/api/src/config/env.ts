import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  API_PORT: z.coerce.number().int().default(4000),
  WEB_ORIGIN: z.string().url(),
  DATABASE_URL: z.string().url(),
  // Optional until queues and caching ship; without it no Redis connection is attempted.
  REDIS_URL: z.string().url().optional(),
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  // Email via Resend. Without a key, non-production logs messages instead of sending.
  RESEND_API_KEY: z.string().min(1).optional(),
  EMAIL_FROM: z.string().min(3).default('MarketPilot <onboarding@resend.dev>'),
  // LLM gateway (ADR 0004). Without a key the AI steps are skipped.
  OPENROUTER_API_KEY: z.string().min(1).optional(),
  OPENROUTER_BASE_URL: z.string().url().default('https://openrouter.ai/api/v1'),
  OPENROUTER_MODEL_EXTRACT: z.string().min(1).default('anthropic/claude-haiku-5.5'),
  OPENROUTER_MODEL_EMBED: z.string().min(1).default('openai/text-embedding-3-large'),
  // Copilot tiers: the tool-calling agent, and the cheap screening, suggestion and summary calls.
  OPENROUTER_MODEL_REASONING: z.string().min(1).default('anthropic/claude-sonnet-5.5'),
  OPENROUTER_MODEL_FAST: z.string().min(1).default('anthropic/claude-haiku-5.5'),
  // Competitor discovery (ADR 0007): the model that reads each web search, and which search runs.
  OPENROUTER_MODEL_SEARCH: z.string().min(1).default('anthropic/claude-haiku-5.5'),
  OPENROUTER_SEARCH_ENGINE: z.enum(['exa', 'native']).default('exa'),
  // strict = zero-data-retention providers only. Never relax this in production.
  OPENROUTER_PRIVACY: z.enum(['strict', 'standard']).default('strict'),
  // Google sign-in is off until both are set.
  GOOGLE_CLIENT_ID: z.string().min(1).optional(),
  GOOGLE_CLIENT_SECRET: z.string().min(1).optional(),
  // Must exactly match an "Authorized redirect URI" in Google Cloud.
  GOOGLE_REDIRECT_URI: z.string().url().default('http://localhost:4000/v1/auth/google/callback'),
  // Owner-uploaded images (ADR 0006): cloudinary://<api_key>:<api_secret>@<cloud_name>.
  // Without it, image upload is turned off.
  CLOUDINARY_URL: z.preprocess(
    (v) => (v === '' ? undefined : v),
    z.string().regex(/^cloudinary:\/\/[^:]+:[^@]+@[\w-]+$/).optional(),
  ),
});

export type Env = z.infer<typeof envSchema>;

export function parseEnv(source: NodeJS.ProcessEnv): Env {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    const fields = result.error.issues.map((i) => i.path.join('.')).join(', ');
    throw new Error(`Invalid environment configuration: ${fields}`);
  }
  return result.data;
}
