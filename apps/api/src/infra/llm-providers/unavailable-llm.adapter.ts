import { LlmError, LlmPort, type ConverseResult, type EmbedResult, type StructuredResult } from './llm.port';

// Wired when no provider key is configured, so AI steps are skipped cleanly.
export class UnavailableLlmAdapter extends LlmPort {
  readonly available = false;

  generateStructured(): Promise<StructuredResult> {
    return Promise.reject(new LlmError('unavailable', 'No model provider is configured'));
  }

  embed(): Promise<EmbedResult> {
    return Promise.reject(new LlmError('unavailable', 'No model provider is configured'));
  }

  converse(): Promise<ConverseResult> {
    return Promise.reject(new LlmError('unavailable', 'No model provider is configured'));
  }
}
