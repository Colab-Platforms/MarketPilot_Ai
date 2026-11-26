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
  // false marks new accounts verified at sign-up and sends no code. Refused in production.
  EMAIL_VERIFICATION_REQUIRED: z
    .enum(['true', 'false'])
    .default('true')
    .transform((v) => v === 'true'),
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
  // Image generation (ADR 0008): models tried in order, each next one only if the previous fails.
  OPENROUTER_MODEL_IMAGE: z
    .string()
    .default('google/gemini-nano-banana-2.1,google/gemini-3.1-flash-image,google/gemini-3-pro-image')
    .transform((v) => v.split(',').map((m) => m.trim()).filter(Boolean))
    .pipe(z.array(z.string().min(1)).min(1)),
  // Images one workspace may generate in 24 hours. A spend guard until credits (M13) exist.
  STUDIO_DAILY_IMAGE_LIMIT: z.coerce.number().int().min(0).default(40),
  // Reel portraits and keyframes one workspace may draw in 24 hours (docs/REEL_STUDIO.md).
  STUDIO_DAILY_REEL_IMAGE_LIMIT: z.coerce.number().int().min(0).default(60),
  // Seconds of reel video one workspace may render in 24 hours. A spend guard until credits exist.
  STUDIO_DAILY_REEL_VIDEO_SECONDS: z.coerce.number().int().min(0).default(120),
  // Video clips (ADR 0011): "route:model" entries tried in order, each next one only if the
  // previous refuses or fails the clip.
  VIDEO_MODELS: z
    .string()
    .default(
      'openrouter:kwaivgi/kling-v3.0-std,openrouter:alibaba/wan-3.0,higgsfield:kling-video/v3.0/std/image-to-video,higgsfield:bytedance/seedance-2.5/image-to-video',
    )
    .transform((v) =>
      v
        .split(',')
        .map((entry) => entry.trim())
        .filter(Boolean)
        .map((entry) => {
          const at = entry.indexOf(':');
          return { route: entry.slice(0, at), model: entry.slice(at + 1) };
        }),
    )
    .pipe(z.array(z.object({ route: z.string().min(1), model: z.string().min(1) })).min(1)),
  // Reel assembly (ADR 0012): where the caption font lives, relative to the API's folder, and
  // whether this instance assembles reels (turn off once a worker does it).
  REEL_FONT_DIR: z.string().min(1).default('assets/fonts'),
  REEL_ASSEMBLY_ENABLED: z
    .enum(['true', 'false'])
    .default('true')
    .transform((v) => v === 'true'),
  // Reel background music (ADR 0013), through OpenRouter.
  OPENROUTER_MODEL_MUSIC: z.string().min(1).default('google/lyria-3-clip-preview'),
  // Reel voiceover (ADR 0013). Without it, reels are assembled with music only.
  SARVAM_API_KEY: z.preprocess((v) => (v === '' ? undefined : v), z.string().min(1).optional()),
  // The fallback video route. The console copies it as "keyId:secret".
  HIGGSFIELD_API_KEY: z.string().min(1).optional(),
  HIGGSFIELD_KEY_ID: z.string().min(1).optional(),
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
  if (result.data.NODE_ENV === 'production' && !result.data.EMAIL_VERIFICATION_REQUIRED) {
    throw new Error('EMAIL_VERIFICATION_REQUIRED cannot be false in production');
  }
  return result.data;
}
