import type { Response } from 'express';
import type { CopilotEvent } from '@marketpilot/contracts';

const HEARTBEAT_MS = 15_000;

export interface SseChannel {
  send(event: CopilotEvent): void;
  // Aborts when the client disconnects or presses Stop.
  signal: AbortSignal;
  close(): void;
}

// Opens a server-sent event stream. Comment heartbeats keep proxies from closing a quiet
// connection while a tool or the model is working.
export function openSse(response: Response): SseChannel {
  const disconnect = new AbortController();
  response.status(200);
  response.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  response.setHeader('Cache-Control', 'no-cache, no-transform');
  response.setHeader('Connection', 'keep-alive');
  response.setHeader('X-Accel-Buffering', 'no');
  response.flushHeaders();

  const heartbeat = setInterval(() => response.write(': keep-alive\n\n'), HEARTBEAT_MS);
  let closed = false;
  const finish = () => {
    if (closed) return;
    closed = true;
    clearInterval(heartbeat);
  };
  // On the response, not the request: a request emits 'close' once its body has been read.
  response.on('close', () => {
    if (!response.writableEnded) disconnect.abort();
    finish();
  });

  return {
    signal: disconnect.signal,
    send(event) {
      if (!closed) response.write(`data: ${JSON.stringify(event)}\n\n`);
    },
    close() {
      finish();
      response.end();
    },
  };
}
