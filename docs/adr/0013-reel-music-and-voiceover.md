# ADR 0013: Reel music with Lyria through OpenRouter, and voiceover with Sarvam Bulbul

Status: accepted, 2026-11-21. The owner chose both providers on 2026-11-21.

## Context
Assembled reels (ADR 0012) had a silent track. The storyboard already writes a music mood for each idea and a voiceover line for each scene, but nothing turned them into sound. ADR 0012 left the music source open, and `docs/REEL_STUDIO.md` deferred voiceover to a later phase.

- **Music.** OpenRouter, already our gateway (ADR 0004), offers Google Lyria 3. `google/lyria-3-clip-preview` makes a 30 s track for $0.04, and `google/lyria-3-pro-preview` makes a full song for $0.08. A stock library would need a signup and a licence that covers clients' posts.
- **Voice.** OpenRouter has no text-to-speech model. For Hindi and Hinglish, Sarvam's Bulbul is the cheapest option and ranked first on Hindi in a 2026 vendor benchmark; ElevenLabs and Google Cloud TTS were also considered. Sarvam is an Indian company, which suits our undecided data residency.

## Test call (2026-11-21)
One Lyria clip request cost $0.04 and took 14 s. It returned a 30.8 s stereo MP3 at 44.1 kHz and 192 kb/s. Findings:
- OpenRouter refuses audio output unless `stream: true` is set.
- The MP3 arrives base64-encoded in `choices[0].delta.audio.data`, split across chunks.
- The text part was `<instrumental>`.
- `usage.cost` arrives on the last chunk.

Sarvam has not been called yet. The adapter follows the official docs as of 2026-11-21 and is covered by fixture tests.

## Decision
- **Ports.** `MusicPort` and `SpeechPort` sit in `infra/llm-providers`, next to `VideoPort`, with `OpenRouterMusicAdapter` and `SarvamSpeechAdapter`. When a key is missing, an unavailable adapter takes their place.
- **One door.** `SoundService` in `modules/ai` is the only caller. It composes the music prompt from the idea's mood (capped, instrumental only, no lyrics) and picks the voice. Callers never name a model or a voice.
- **Music.**
  - Model: `OPENROUTER_MODEL_MUSIC`, default `google/lyria-3-clip-preview`. One 30 s track covers both reel lengths (15 s and 30 s).
  - The seed is derived from the reel id, so assembling the same reel again asks for the same track.
- **Voice.**
  - Model: Bulbul `bulbul:v4-flash`, WAV output at 24 kHz. The line's length is read from the WAV header so it can be timed.
  - Personas: Hindi `ishita_hi_ads`, Hinglish `shubh_enhi_ads` (code-mixed), English `simran_en_customer`, all with `hi-IN` or `en-IN`.
  - `SARVAM_API_KEY` turns it on.
- **Timing.** Each line starts 0.2 s after its scene cuts in, or 0.15 s after the previous line ends if that one ran long. Lines never overlap. A line with no room before the end of the reel is dropped.
- **Mix.** ffmpeg mixes music and voice onto the existing silent base track. Music plays at 0.22 under voice and 0.7 when nothing is spoken, cut to the reel and faded out over its last 1.5 s.
- **When.** Sound is generated when a render is assembled (`ReelSoundMaker`, called by `AssemblyScanner`).
  - Its cost is added to the reel's `cost_usd`.
  - Sound never blocks a reel: a part that fails is logged and left out, and the reel is assembled without it.
- **Render hash.** The hash covers the music mood, the voiceover lines, the language, the sound prompt versions, and which sound providers this server has. Editing a line, or adding the Sarvam key, marks the last render as outdated.

## Consequences
- **Cost per reel.** About $0.04 for music. Voiceover is ₹2 per 1,000 characters, a few paise per reel, recorded in USD at about ₹84 to the dollar. Sound is generated again on every new assembly, while an unchanged reel reuses its earlier video.
- **Licensing is not settled.** Every Lyria track carries Google's SynthID watermark. Google has not clearly published terms for commercial use of Lyria output. Read the Gemini API terms before launch, or switch the music adapter to a licensed library.
- **Hinglish quality is unproven.** The storyboard writes Hinglish in Latin script. Sarvam says romanised Indic text lowers quality, so check real Hinglish lines before relying on them.
- **Not built yet.** Ducking music under each line, a per-reel choice of music and voice, and lip-sync. The owner cannot yet hear or swap the track before assembling.
