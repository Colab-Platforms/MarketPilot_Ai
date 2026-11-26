# ADR 0012: Reel assembly with ffmpeg in our own process

Status: accepted, 2026-11-20. The owner chose ffmpeg over Cloudinary video transformations on 2026-11-20.

## Context
A reel's clips (ADR 0011) must become one vertical video. Each clip is cut to its scene's length, joined with hard cuts, and given the scene's on-screen text, which may be English, Hinglish or Hindi in Devanagari. The result is stored and added to the library. Cloudinary transformations could join clips, but they have quotas, limits on URL length when there are many layers, and poor custom-font support for Devanagari.

## Decision
- **Binary.** `ffmpeg-static` 5.2.0 (ffmpeg 6.0) is a dependency of `apps/api`, so no system install is needed. Its build includes `libx264`, `libass`, `libfreetype` and `libfribidi`.
- **Captions.**
  - Text is burned in with an ASS subtitle file through `libass`, which shapes complex scripts. On 2026-11-20, Devanagari conjuncts, matras and nukta were checked visually and render correctly.
  - The ASS file also handles wrapping, a semi-transparent box and margins.
  - Captions sit inside Instagram's safe area: above the bottom quarter and clear of the right-hand buttons.
- **Font.** Poppins SemiBold covers Latin and Devanagari. It is in `apps/api/assets/fonts` with its SIL Open Font License, and `REEL_FONT_DIR` points to the folder.
- **Output.**
  - Format: 1080x1920, 30 fps, H.264 (`yuv420p`, CRF 20, `+faststart`), with a silent AAC track so every player and the Meta API accept it.
  - Clips are scaled and cropped to fill the frame. Each is cut to its scene's length; clips are rendered at least as long as their scene.
- **Port.** `AssemblyPort` sits in `infra/media-assembly` with `FfmpegAssemblyAdapter`. Clips are downloaded to a private temporary folder, which is always removed afterwards.
- **Running it.**
  - Renders are `reel_render` rows, claimed with a lease by `AssemblyScanner`, following the same pattern as clips (`docs/REEL_STUDIO.md` section 8).
  - Each API instance assembles one reel at a time.
  - `REEL_ASSEMBLY_ENABLED=false` keeps an instance out of assembly, for when a worker takes it over.
- **Reuse.** A render is keyed by a hash of the selected clips, scene lengths, texts and the caption style version. Assembling an unchanged reel again reuses the earlier video.
- **Music.** Superseded by ADR 0013 (Lyria music and Sarvam voiceover, mixed onto the silent track). Originally none in v1: the reel has a silent track. The owner has no licensed library. Choosing between a stock library, an AI music API, or adding music in Instagram itself is open. The render hash and the assembly spec already take an optional music track, so adding one does not change the data.

## Consequences
- About 80 MB is added to the API image, as the owner accepted.
- Assembly uses CPU in the API process: roughly 10 to 30 seconds for a 15 to 30 second reel. Move it to a worker once reels are frequent.
- Captions are styled the same for every brand in v1. Brand colours and fonts per brand can come later; the style version in the hash outdates old renders when that changes.
