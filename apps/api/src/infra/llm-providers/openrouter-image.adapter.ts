import { ImagePort, type GeneratedImageBytes, type ImageRequest, type ImageResult } from './image.port';
import { LlmError } from './llm.port';
import { postToOpenRouter, privacyOf, toUsage, type OpenRouterSettings, type OpenRouterUsage } from './openrouter-http';

// Image models take far longer than text: 20 to 60 seconds is normal.
const IMAGE_TIMEOUT_MS = 120_000;
// About 1024 px on the long side: enough for a feed post, and the cheapest tier.
const RESOLUTION = '1K';
const MAX_IMAGE_BYTES = 20 * 1024 * 1024;
const ACCEPTED_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);

interface ImagesResponse {
  data?: { b64_json?: string; media_type?: string }[];
  usage?: OpenRouterUsage;
}

// OpenRouter's Image API (POST /images). Same key, privacy routing and error mapping as text.
export class OpenRouterImageAdapter extends ImagePort {
  readonly available = true;

  constructor(private readonly settings: OpenRouterSettings) {
    super();
  }

  async generate(request: ImageRequest): Promise<ImageResult> {
    const body = {
      model: request.model,
      prompt: request.prompt,
      aspect_ratio: request.aspectRatio,
      resolution: RESOLUTION,
      n: 1,
      response_format: 'b64_json',
      ...(request.references.length > 0 && {
        input_references: request.references.map((url) => ({ type: 'image_url', image_url: { url } })),
      }),
      provider: privacyOf(this.settings),
    };
    const json = (await postToOpenRouter(
      this.settings,
      '/images',
      body,
      request.timeoutMs ?? IMAGE_TIMEOUT_MS,
    )) as ImagesResponse;

    const images = (json.data ?? []).flatMap(toImage);
    // A model may answer with only text, for example when it declines the prompt.
    if (images.length === 0) throw new LlmError('invalid_output', 'The image model returned no image');
    return { images, usage: toUsage(request.model, json.usage) };
  }
}

function toImage(item: { b64_json?: string; media_type?: string }): GeneratedImageBytes[] {
  const mediaType = item.media_type ?? 'image/png';
  if (!item.b64_json || !ACCEPTED_TYPES.has(mediaType)) return [];
  const bytes = Buffer.from(item.b64_json, 'base64');
  if (bytes.length === 0 || bytes.length > MAX_IMAGE_BYTES) return [];
  return [{ bytes, mediaType }];
}
