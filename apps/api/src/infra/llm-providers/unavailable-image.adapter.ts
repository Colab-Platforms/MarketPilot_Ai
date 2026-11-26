import { ImagePort, type ImageResult } from './image.port';
import { LlmError } from './llm.port';

// Used when no gateway key is configured: image generation is switched off.
export class UnavailableImageAdapter extends ImagePort {
  readonly available = false;

  generate(): Promise<ImageResult> {
    return Promise.reject(new LlmError('unavailable', 'No image model is configured'));
  }
}
