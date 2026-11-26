# ADR 0010: Feedback on generated images, and style references chosen from it

Status: accepted (step 1 built), 2026-11-20. Owner-approved change to the memory data model.

## Context
Image generation (ADR 0008) followed only the first two "Your recent posts" from the profile, and nothing learned from what the owner thought of the results. ARCHITECTURE.md (L3 episodic) and BUSINESS_BRAIN.md section 6 already require that approvals and rejections of generated content be stored, and that AI output only teaches the system after a human approves it.

## Decision
- **Feedback.** Anyone in the workspace can like or dislike an image made with AI (`asset_feedback`: one row per person and asset, replaced when they change their mind). A dislike can carry quick reasons: text wrong, product wrong, logo wrong, too busy, too plain, not my style. `PUT /v1/assets/:id/feedback`, with a null rating to clear it.
- **Style references.** Owners, admins, managers and creators can star any library image (`asset.style_reference_at`; it keeps its first date). `PUT /v1/assets/:id/style-reference`.
- **Which images a new image follows** (`pickStyleReferences`, at most 2):
  - At most **one image made with AI**, next to a real post. Feeding AI images back on their own makes every image alike and copies their flaws (garbled small text, a distorted logo).
  - Real posts: starred uploads, then the newest "Your recent posts".
  - AI images: starred, then liked by someone and disliked by nobody. Those made with the same design style, then the same product, come first.
  - The chosen URLs are stored on each job (`studio_generation.style_reference_urls`), so outcomes can be traced back to what was followed.
- **Prompt `image.generate@4`** describes these as examples of the look the business likes (its own posts, or images it approved), to match in mood, lighting, typography and layout, never copying subjects or text.
- **Where the owner gives feedback.** On the Create page cards, in the copilot's image card and in the library preview, with markers on library tiles.

## Later steps (not built)
- **Step 2, learned guidance.** Reasons that repeat (for example "Too busy" 3 times in the last 20 ratings) become prompt lines, shown in the brand profile as "Learned from your feedback" with a remove button. They're stored as learned preferences with confidence (BUSINESS_BRAIN.md section 4), never applied silently.
- **Step 3, outcomes.** Once publishing is connected, published posts and their reach weigh more than likes.
- **Quality measure.** The like rate per model and per prompt version replaces the Phase 0 benchmark ADR 0008 skipped, and informs the model order.

## Consequences
- Feedback rows are mutable (latest opinion wins). The append-only event history L3 describes arrives with step 2, written to `memory_event` at the same time.
- A starred or liked image stays a candidate until it is unstarred, disliked or removed from the library.
- Video assets can't be rated or starred yet.
