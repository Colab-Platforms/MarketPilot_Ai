# ADR 0011: Reel clips with Kling 3.0, through OpenRouter first and Higgsfield as fallback

Status: accepted, 2026-11-20. Amended 2026-11-21: OpenRouter has no providers serving Kling (it returns 404), so `openrouter:alibaba/wan-3.0` follows it in the chain. Wan is the only OpenRouter image-to-video model that renders 3 s clips at 9:16 (2-30 s, $0.10 per second at 720p). Seedance 2.5 and Veo 3.1 on OpenRouter start at 4 s. Wan was not part of the face spike below.

## Context
Reel Studio (`docs/REEL_STUDIO.md`) turns one keyframe per scene into a short clip. Our keyframes are photoreal people holding the owner's product. Seedance on ByteDance's own API rejects images that look like real people (`InputImageSensitiveContentDetected.PrivacyInformation`), and that includes AI-generated faces. ARCHITECTURE.md deferred generative video. The owner overrode that deferral on 2026-11-20. OpenRouter is already our gateway (ADR 0004), and the owner also holds a Higgsfield API account.

## Spike (2026-11-20)
Six fictional Indian adults were drawn with `google/gemini-nano-banana-2.1`, the production image model, at 9:16 and 1K, for about $0.04 each. The shots covered close-up and medium framing in a home, a shop, a campus, a balcony and a market, all holding an unbranded bottle. Each keyframe was animated for 5 s with sound off.

| | Kling 3.0 Std via OpenRouter (`kwaivgi/kling-v3.0-std`) | Kling 3.0 Std via Higgsfield (`kling-video/v3.0/std/image-to-video`) | Seedance 2.5 via Higgsfield (720p) |
|---|---|---|---|
| Faces accepted | 6 of 6 | 7 of 7 | 5 of 5 processed. Three first attempts returned HTTP 500 and two of those succeeded on retry. The third failed because the balance ran out. |
| Identity across the clip | stable | stable | stable |
| Product | stable in all 6 | a duplicated bottle in the last second of 1 clip | a second bottle edge in 1 clip; the camera drifted the product out of frame in 1 clip |
| Time to finish | 78-110 s | 106-478 s | 189-1,039 s |
| Real cost per 5 s clip | $0.42, reported in `usage.cost` | about $0.80 on average across the run | (included in the Higgsfield average) |
| Output | 716x1284, 24 fps, H.264 | same | same |

- **Rates.** The OpenRouter price matched its listed $0.084 per second exactly. On Higgsfield, 12 clips used up the $10 balance, about twice its published starting rates.
- **Continuity.** Kling's last-frame option between two different people produced a morph from one person into the other. It is only usable between two shots of the same character in the same setting.
- **Product duplication.** This appeared on one route and not the other for the same keyframe, so it is random per generation and not tied to the route.

## Decision
- **`VideoPort`** in `infra/llm-providers` is asynchronous: `submit(request, idempotencyKey) -> job`, `status(job)`, `cancel(job)`. Failures are `LlmError`.
- **Routes are configuration.** `VIDEO_MODELS` is an ordered list of `route:model` entries, tried in order. Default: `openrouter:kwaivgi/kling-v3.0-std`, then `openrouter:alibaba/wan-3.0`, then `higgsfield:kling-video/v3.0/std/image-to-video`, then `higgsfield:bytedance/seedance-2.5/image-to-video`.
  - Move to the next entry on a moderation rejection, a model or provider failure, HTTP 5xx after one retry, or a timeout.
  - Stop on auth or balance failures for that route only. Higgsfield reports a low balance as `failed` with a message, which the adapter maps to `insufficient_credits`.
- **`OpenRouterVideoAdapter`** is the primary route.
  - Calls `POST /api/v1/videos` with `frame_images: [{ type: "image_url", image_url: { url }, frame_type: "first_frame" }]`, `resolution: "720p"`, `aspect_ratio: "9:16"` and `generate_audio: false`.
  - Polls `GET /api/v1/videos/{id}` and downloads from `/api/v1/videos/{id}/content`.
  - Cost comes from `usage.cost`.
  - Completion arrives by `callback_url`, verified with `X-OpenRouter-Signature` (HMAC-SHA256 over `t,body`) and deduped by `X-OpenRouter-Idempotency-Key`. A poller is the fallback.
- **`HiggsfieldVideoAdapter`** is the fallback route.
  - Auth: `Authorization: Key <id:secret>` from `HIGGSFIELD_API_KEY`, the pair as the console copies it.
  - Each submit carries an `Idempotency-Key`. Completion arrives by `hf_webhook` with Standard Webhooks verification, and a poller is the fallback.
- **Privacy exception for video only.** No OpenRouter video endpoint offers zero data retention, and a request with `zdr: true` is rejected. Video requests therefore send `data_collection: "deny"` without `zdr`. Text and image calls keep strict mode. Keyframes contain only generated people and the owner's public product photos, never owner-uploaded photos of people (REEL_STUDIO.md section 10).
- **Outputs are copied to our media storage** as soon as a clip finishes. Neither route keeps them for long.
- **Completion by polling for now (2026-11-20).**
  - Clips are driven by a database scanner with leases (`docs/REEL_STUDIO.md` section 8), not BullMQ, because Redis is not provisioned.
  - Webhooks (`callback_url` and `hf_webhook`) are deferred until the API has a public URL.
- **Minimum billing.** OpenRouter bills a Kling clip as at least 5 seconds: a 3-second clip cost $0.42, the same as 5 seconds (measured 2026-11-20). Estimates use the billed seconds.
- **Shortest clip.** Kling renders 3 to 15 seconds and Seedance 4 to 30. A shorter scene is rendered at the model's minimum and cut at assembly. The daily spend guard counts the rendered seconds.
- **Sound off** on every clip. Audio is added at assembly.
- **Hard cuts** between scenes. The last-frame option is used only when two adjacent scenes share their characters and setting.
- **Every clip is reviewed by the owner** and can be re-rendered on its own. An automatic check on the last frames (a vision call that counts the product) is a later improvement.

## Consequences
- Kling on OpenRouter has a single upstream provider, AtlasCloud. Higgsfield is the fallback for its outages, so the Higgsfield balance must be topped up before launch.
- New subprocessors for keyframe URLs: AtlasCloud and Kuaishou through OpenRouter, and Higgsfield with Kuaishou or ByteDance on fallback. Neither route offers zero data retention, so this needs review before enterprise customers.
- Credits can be priced from `usage.cost`. On the primary route a 20 s reel costs about $1.70 in video, and one 4 s scene costs about $0.34.
- Clips take about 1.5-2 minutes on the primary route and longer on fallback. Rendering is always a background job with per-scene progress.
- Neither route documents a face rule. Acceptance can change without notice, so a face rejection must fall back cleanly and be visible in monitoring.
