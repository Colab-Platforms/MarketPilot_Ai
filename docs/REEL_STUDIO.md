# Reel Studio: product reel generation

Status: approved by the owner, 2026-11-20, including the override of the deferral below. ADR 0011 (video provider) follows the spike in section 9. ADR 0012 (assembly with ffmpeg, plus music) follows before phase 4.

ARCHITECTURE.md section 12 defers generative video from the MVP. This document pulls a scoped version forward at the owner's request. It reuses the image pipeline (ADR 0008), the asset library (ADR 0009) and the Business Brain. It adds one provider (Higgsfield) and the first real worker queue.

## 1. Goal

The owner picks a product. The studio proposes reel ideas grounded in the product, the audience, the brand and what is working in the market right now. The owner approves one idea. The studio breaks it into scenes, draws one keyframe per scene, animates each keyframe into a short clip, and assembles a 9:16 reel ready for Instagram and Facebook.

Main rule: **money is spent only after the owner approves, and only on what changed.** Text edits are free. Changing one scene re-renders that scene, not the reel.

## 2. Owner flow

| Step | Owner sees | Owner can do | Paid calls |
|---|---|---|---|
| 1. Brief | Product, goal (awareness, sale, launch), audience and language prefilled from the Brain, length 15 or 30 s, optional notes | Edit any field | none |
| 2. Ideas | 3 idea cards: title, hook (first 2 s), format, trend it rides and why, persona, story in 3-4 lines, CTA, music mood, scene count, estimated cost | Pick one, edit it, ask for 3 more | 1 LLM call |
| 3. Storyboard | Cast sheet (each character's look and wardrobe) and 4-8 scene cards | Edit text, reorder, add, delete, "rewrite this scene" | 1 LLM call; a rewrite is a small call per scene |
| 4. Cast | One portrait per character | Approve or redraw a face | 1 image per character |
| 5. Keyframes | One 9:16 image per scene and a free animatic (keyframes played with timing and text in the browser) | Redraw one keyframe, edit then redraw, go back to step 3 | 1 image per scene |
| 6. Render | Cost estimate, then per-scene clips as they finish | Re-render one clip, pick an older take | 1 video call per scene |
| 7. Final | Assembled reel with on-screen text and music | Change text or music (free re-assembly), save to library, schedule | none |

Every step can go back. Going back never deletes earlier work: each keyframe and clip attempt is kept as a **take**, and the owner can switch to an older take for free.

## 3. What invalidates what

Each scene's paid outputs are keyed by a hash of exactly the inputs that shaped them. An edit only invalidates outputs whose inputs changed.

| Owner changes | Keyframe | Clip | Assembly |
|---|---|---|---|
| On-screen text, music, scene order | kept | kept | redone (free) |
| Camera move, motion, duration | kept | redone | redone |
| Action, setting, framing, characters in scene | redone | redone | redone |
| A character's look | redone for scenes with that character | redone for those | redone |
| Product photo | redone for scenes showing the product | redone for those | redone |

`keyframeHash = hash(keyframe prompt inputs, cast portrait URLs in scene, product photo URLs, prompt version, model list)`.
`clipHash = hash(keyframe URL, motion prompt, duration, video model, prompt version)`.
A take whose hash matches is reused. Two scenes with identical inputs never pay twice.

## 4. AI tasks and token cost

All tasks live in `modules/ai` and are reached through `AiService` (rule 1). Output is validated with Zod schemas in `packages/contracts/src/studio/reel` (rule 8).

| Task | Tier | Input (approx. tokens) | Output | Notes |
|---|---|---|---|---|
| `reel.trends` | writing + web search | category, market | trend digest, at most 8 items | Cached per category and market for 7 days in a non-tenant table. Shared by all tenants, so one call serves many reels. Holds public facts only. |
| `reel.ideas` | writing | about 1,500: product facts, audience, voice, banned claims, trend digest, 3 recent post captions | 3 compact ideas, about 900 | Ideas are summaries, not storyboards. "3 more" sends the earlier titles so they are not repeated. |
| `reel.storyboard` | writing | about 1,200: the chosen idea, product facts, length | cast and scenes in structured fields, about 1,500 | Only for the approved idea. Fields, not prose (section 4.1). |
| `reel.scene.rewrite` | writing | about 500: idea summary, cast, the one scene, the instruction | one scene | Never resends the whole storyboard. |
| `image.generate` (existing) | image | composed prompt with references | portraits and keyframes | New `reel_keyframe` and `reel_portrait` formats in the existing prompt builder. |
| `video.generate` | video | keyframe URL and a motion prompt under 400 characters | clip | Composed deterministically. No LLM. |

### 4.1 Cost rules

- **Structured fields, deterministic prompts.** The storyboard returns fields (shot, camera, setting, action, characters, product visible, on-screen text, voiceover line, duration). Keyframe and motion prompts are composed from those fields in code, as `image.generate@2` does. The LLM never writes long image or video prompts, so output tokens stay low and prompts stay consistent and testable.
- **Stable prompt prefix.** The system prompt and brand block come first and unchanged, so gateway prompt caching applies on repeat calls.
- **Context by reference.** The cast is defined once with ids. Scenes refer to `c1` and `c2`, not to repeated descriptions.
- **The Brain bundle comes from `MemoryService`** (rule 2), with a hard token budget per task.
- **Cheap before expensive.** Text (fractions of a cent), then images (cents), then video (dollars). The animatic lets the owner judge the story before any video money is spent.
- **Recorded, not guessed.** Every call records tokens and USD on its take and its job, as images do today, so credits can be priced from real data.

### 4.2 Estimated cost per reel

This is for a 20 s reel with 5 scenes of 4 s each, at 720p with model sound off. Costs were measured in the spike (ADR 0011). Kling 3.0 Standard through OpenRouter cost $0.084 per second; the Higgsfield fallback costs about twice that.

| Item | Cost (USD) |
|---|---|
| Ideas, storyboard and rewrites | about 0.01-0.03 |
| 2 portraits and 5 keyframes | about 0.30 (measured at $0.04-0.046 per image) |
| Clips, 5 scenes | 2.10: each clip is billed as at least 5 s ($0.42), measured 2026-11-20 |
| Re-rendering one scene | 0.42 (against 2.10 for the whole reel) |
| Whole reel, first render | about 2.40 |

Because of the 5-second minimum, fewer and longer scenes cost less than many short ones. The storyboard prompt could prefer 4 to 6 scenes for a 30-second reel.

Higgsfield does not charge for failed or moderated (`nsfw`) requests.

## 5. Video provider

### 5.1 The face problem

Seedance on ByteDance's own API, and on routes that pass through it, rejects input images that look like a real person (`InputImageSensitiveContentDetected.PrivacyInformation`). It also flags photorealistic faces that were generated by AI. Our keyframes are photoreal people holding the product, so this filter would block the main use case.

Higgsfield's documentation lists no face or real-person rule. Its only moderation outcome is the `nsfw` status, and it says rules vary by model. It also hosts Kling 3.0, which generally accepts human-face images, alongside Seedance 2.5, Wan 3.0 and others behind one API and one bill. **We do not trust this until the spike in section 9 proves it on our own keyframes.**

### 5.2 Decision (proposed)

- **`VideoPort`** in `infra/llm-providers`. ARCHITECTURE.md section 5 already names it. The port is asynchronous: `submit(request, idempotencyKey) -> providerRequestId`, `status(id)`, `cancel(id)`. Failures are `LlmError`, so callers handle one error type.
- **`HiggsfieldVideoAdapter`** uses plain REST through `fetch`, with no SDK, like Cloudinary in ADR 0006.
  - Base URL `https://api.higgsfield.ai`, header `Authorization: Key <id>:<secret>`.
  - `POST /<model path>` with an `Idempotency-Key` header, and `?hf_webhook=<our URL>` when a public URL exists.
  - The response carries `request_id` and `status_url`.
  - Statuses are `queued`, `in_progress`, `completed`, `failed`, `nsfw` and `canceled`.
  - The video arrives at `video.url` and expires after 7 days, so we copy it to our storage at once.
- **Models are configuration.** `HIGGSFIELD_MODEL_VIDEO` is an ordered list. The proposed default is `kling-video/v3.0/std/image-to-video`, then `bytedance/seedance-2.5/image-to-video`, then a cheaper fallback; the spike sets the final order. On `nsfw` or a model-specific failure, the next model is tried. On auth or balance failures, every model is stopped (same policy as ADR 0008).
- **Sound off** (`sound: off`, `generate_audio: false`). Audio is added at assembly, so scenes do not each carry a different soundtrack.
- **OpenRouter video** (`/api/v1/videos`, which hosts Seedance and Veo) stays possible as a second adapter on the same port. It is not used in v1.
- **Secrets.** `HIGGSFIELD_API_KEY` (the `id:secret` pair as the console copies it) and `HIGGSFIELD_WEBHOOK_SECRET` live in the environment only and are never logged (rule 10).

### 5.3 Completion: webhook first, poll as backup

- `POST /v1/webhooks/higgsfield` checks the Standard Webhooks signature: HMAC-SHA256 over `id.timestamp.body` with the `whsec_` secret. It rejects timestamps more than 5 minutes off and dedupes by `webhook-id`. The handler only enqueues a `reel.clip.collect` job; it never downloads anything itself.
- A poller job runs for every open take, starting at 10 s with backoff up to 60 s and a 20-minute ceiling. It covers local development (no public URL), missed webhooks and restarts. Rule 7 applies: the provider's status is the truth, and we reconcile against it.

## 6. Assembly

Clips are joined in scene order, on-screen text is drawn, the music bed is mixed in, and the result is encoded as H.264 1080x1920 for Reels. This is a deterministic step with no AI. It goes behind an `AssemblyPort` so it can be swapped.

| Option | For | Against |
|---|---|---|
| **A. ffmpeg in the worker (chosen by the owner, 2026-11-20)** | Full control, Devanagari text through a bundled font file, free per render, testable | Large binary in the image (about 80 MB) |
| B. Cloudinary video transformations | No new infrastructure; already a subprocessor | Transformation quotas and cost, URL-length limits on many layers, awkward custom fonts for Hindi |

Sound is decided in ADR 0013. At assembly, a 30 s instrumental track is made from the idea's `musicMood` with Lyria through OpenRouter. Each scene's voiceover line is spoken by Sarvam Bulbul (Hindi, Hinglish or English) and placed after its scene's cut. Both are mixed with ffmpeg, and a failed part is left out rather than blocking the reel. Letting the owner hear or swap the track before assembling is still to come.

## 7. Data model (new `reel.prisma`; all tables have `workspace_id`, RLS and the composite tenant FK as in `studio.prisma`)

- `reel_project`: brand, product (and its name at the time of the request), `status`, `brief` JSON, `chosen_idea_id`, `cast` JSON, `music_track`, `final_asset_id`, `idempotency_key` (unique per workspace), and estimated and spent USD.
- `reel_idea`: project, `batch`, `content` JSON (validated), `prompt_version`, tokens and cost.
- `reel_scene`: project, `position`, `spec` JSON, `current_keyframe_take_id`, `current_clip_take_id`.
- `reel_take` (as built in phase 2):
  - Columns: `kind` (`portrait` or `keyframe`; `clip` is added in phase 3), `subject` (the cast id or the scene id), and `inputs`, the exact brief the picture was drawn from. Also `inputs_hash`, `selected`, `status`, `model`, `url`, `prompt`, `cost_usd`, `error_code` and timestamps.
  - A finished take is never changed except for `selected`.
  - Drawing again with a hash that matches a finished take reselects that take instead of paying again.
  - The reel also keeps a `product_image_urls` snapshot, refreshed on every keyframe draw, so a polled page can tell whether a keyframe is outdated without reading the Brain.
- `reel_render`: project, snapshot of the scene take ids and text, `status`, `url`, `asset_id`.
- `trend_digest` (no tenant): `category`, `market`, `items` JSON, `expires_at`.

Finished clips and reels are added to `asset` as `kind: video, source: generated` (ADR 0009). That needs a small change: either a nullable `reel_take_id` / `reel_render_id` next to `studio_output_id`, or a generic `source_ref`.

Project status: `ideating -> choosing_idea -> storyboarding -> editing -> keyframing -> reviewing -> rendering -> assembling -> ready`, with `failed` reachable from any step. Each scene and take carries its own status, so one failed clip does not fail the reel.

## 8. Jobs and scale

**As built in phase 3 (2026-11-20): a database scanner, not BullMQ.**

Redis is not provisioned (`REDIS_URL` is empty and only `docker-compose.yml` defines it). So clips follow the pattern section 7 of ARCHITECTURE.md uses for publishing: the database is the record of what is in progress, and a scanner works through it.

- **Where the state lives.** Each clip is a `reel_take` holding its provider job id, which `VIDEO_MODELS` entry it is on, and `poll_after`.
- **The scanner.** `ClipScanner` runs every 5 seconds in every API instance. It claims due takes with a conditional update on `lease_until` (90 seconds), then submits queued takes, polls running ones (every 10 seconds at first, then every 20), copies finished videos to storage, and selects them.
- **Fallback.** A refusal or failure moves the clip to the next entry.
- **Restarts.** A restart loses nothing: the provider keeps rendering and the next tick resumes the job.
- **Reading across workspaces.** The scan reads takes across workspaces with the connection role, which bypasses RLS. Every write goes through `withTenant`.
- **Pictures.** Portraits and keyframes still run in-process, as images do, because they finish in under a minute.
- **Webhooks are deferred.** They need a public API URL. Polling is cheap at this scale, and webhook delivery would only enqueue the same scanner work earlier.
- **When to move to BullMQ.** The bullets below were the original plan. Adopt them when Redis is provisioned for another reason. The take rows stay the same, and only the scanner would become a consumer.

The original plan:

- **First BullMQ consumers** run on the existing `generation` queue in `worker.ts`. Video takes minutes and cannot run inside the API process as images do (ADR 0008 already planned this move).
- Job types:
  - `reel.ideas` and `reel.storyboard`
  - `reel.keyframe` (one per scene)
  - `reel.clip.submit` and `reel.clip.collect`
  - `reel.assemble`
- The BullMQ `jobId` is the take id, so a retried enqueue is a no-op (rule 6). The provider `Idempotency-Key` is also the take id, so a retried submit never pays twice.
- **Concurrency.** Higgsfield gives 20 concurrent requests per account and queues the rest, returning 429 `account_queue_full` when its queue is full. A global Redis limiter keeps us under 20. Per workspace, one reel renders at a time and at most 3 clips run in parallel, which keeps things fair between tenants.
- **Spend guard until credits (M13) exist:**
  - `STUDIO_DAILY_REEL_LIMIT` (default 3 renders per workspace per day)
  - `STUDIO_MAX_REEL_SECONDS` (30)
  - A per-reel USD ceiling checked before submit. When credits land, the estimate becomes the reservation and recorded cost becomes the settlement (rule 9).
- **Progress.** The UI polls `GET /v1/studio/reels/:id`, as images do today. SSE (`/v1/jobs/{id}/events`) can come later without changing the contract.
- **Endpoints** (all mutating ones take an `Idempotency-Key`):
  - `POST /v1/studio/reels` (brief, which starts ideas)
  - `POST .../ideas` (3 more)
  - `POST .../ideas/:ideaId/choose`
  - `PATCH .../scenes/:sceneId`, `POST .../scenes` and `DELETE .../scenes/:sceneId` (text only, free)
  - `POST .../scenes/:sceneId/rewrite`
  - `POST .../cast/:characterId/portrait`
  - `POST .../keyframes` (all stale scenes) and `POST .../scenes/:sceneId/keyframe`
  - `POST .../render` (all stale clips, with the estimate echoed back for confirmation) and `POST .../scenes/:sceneId/clip`
  - `PUT .../scenes/:sceneId/takes/:takeId` (switch take)
  - `POST .../assemble`

## 9. Spike before building (done 2026-11-20; results in ADR 0011)

Result: every route accepted every photoreal AI face it processed. Kling 3.0 Standard through OpenRouter is primary: $0.42 per 5 s clip, finished in 78-110 s. Kling and then Seedance 2.5 through Higgsfield are the fallbacks; Higgsfield cost about twice as much and the test used its whole $10 balance. Hard cuts are used between scenes. Each clip needs owner review because the product is occasionally duplicated. Section 5.2 is superseded by ADR 0011.

The plan as run:

1. Make 6 keyframes with the existing image pipeline: Indian adults in close-up and medium shots, with the product in hand and in use, in a home, a shop and outdoors. All are fictional people.
2. Send each to Kling 3.0 Standard and Seedance 2.5 on Higgsfield: 5 s, 720p, sound off.
3. Record for each model:
   - acceptance rate (looking for no `nsfw` or face rejections)
   - face drift (does the person stay the same person)
   - product fidelity (label, shape, colour)
   - hand and motion artefacts
   - latency
   - actual charge
4. Also test Kling 3.0's `last_image_url` on one pair of scenes for continuity between shots.
5. Pick the model order. If both reject faces, fall back to faceless storytelling (hands, product, environment) and revisit.

This spends real money on the owner's Higgsfield account, so it runs only with the owner's go-ahead.

## 10. Guardrails and compliance

- **Actors are always generated, never real.** v1 accepts no uploaded photos of real people as actors. Prompts may not name or describe real people, including celebrities and lookalikes. This is screened at storyboard validation.
- **Claims and words.** Claim checks and banned words from the Brain apply to on-screen text and voiceover lines, as for captions.
- **AI labels.** Reels are marked as AI-generated when published (Meta's AI label). Before launch, confirm India's current IT Rules requirements for labelling synthetic media.
- **Public URLs.** Keyframes and clips are public URLs while drafts (same note as ADR 0008).

## 11. Build order

| Phase | Scope | Exit |
|---|---|---|
| 0 | Spike (section 9), then ADR 0011 | Model order chosen on real results |
| 1 (built 2026-11-20) | Contracts, `reel.prisma`, `reel.trends`, `reel.ideas`, `reel.storyboard`, `reel.scene.rewrite`, Reel tab on Create with brief, ideas and storyboard editor | Idea to an editable storyboard, with no paid media |
| 2 (built 2026-11-20) | Cast portraits, keyframes through the existing `ImagePort`, takes and hashes, animatic preview | Full visual storyboard for cents |
| 3 (built 2026-11-20) | `VideoPort` with OpenRouter and Higgsfield adapters and fixture tests, the clip scanner (section 8; webhooks deferred), Cloudinary video upload from a remote URL, per-scene re-render | Clips per scene, re-render one scene |
| 4 (built 2026-11-20, without music) | `AssemblyPort` with ffmpeg and libass captions (ADR 0012), `reel_render` claimed by `AssemblyScanner`, final render to the library | Reel ready to schedule. Music and the calendar hand-off are still open |
| 5 (built 2026-11-21) | Music (`MusicPort`, Lyria via OpenRouter) and voiceover (`SpeechPort`, Sarvam Bulbul) generated at assembly and mixed by ffmpeg (ADR 0013); livelier motion prompts and 4-6 s scenes | Reels with music and spoken lines |
| Later | Choosing or previewing the track and voice, lip-sync, copilot `propose_reel` tool, learning from approved and liked reels, template reels | |
