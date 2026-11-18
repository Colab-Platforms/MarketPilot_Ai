# ADR 0007: Competitor discovery with OpenRouter web search, once per workspace

Status: accepted, 2026-11-18.

## Context
Owners rarely fill in competitor details, but the strategist, planner and copilot need at least three real competitors to position content. Asking a model from memory invents businesses, especially small Indian ones. We need live search, and per CLAUDE.md, the fewest new moving parts. Full competitor research (crawling their sites in depth, social profiles) stays deferred (ONBOARDING.md).

## Decision
- **Search goes through OpenRouter's web plugin** (`plugins: [{ id: "web", engine: "exa" }]`), on the gateway and key we already use (ADR 0004). No new vendor, SDK or key. `LlmPort.generateStructured` gained an optional `webSearch` setting and now returns the URLs the search cited (`sources`).
- **Exa is pinned, not the model's native search**, so the search runs at OpenRouter and the model call keeps strict privacy routing (`zdr: true`, `data_collection: "deny"`). This was checked with a live request on 2026-11-18: strict privacy, strict JSON schema and web search work together.
- **Only public business details go in:** name, website, category, description, product names, city, service areas, audience summary and competitors the owner already named. Never owner contact details or anything private.
- **Four steps, so results match what shoppers compare** (revised 2026-11-18, after a single broad search returned small, obscure sellers):
  1. *Plan:* a fast model writes 3–4 short queries: the category's leading brands, "brands like X", and the main product lines by customer need (never exact product names). Plain fallback queries are used if this fails.
  2. *Search:* each query is its own web search (`OPENROUTER_MODEL_SEARCH`, default the fast model), run in parallel. The short query leads the message, because with Exa the message is the search text. Candidates are merged by domain and counted by how many searches found them.
  3. *Recall:* alongside the searches, the reasoning model names the leading brands shoppers compare against, from its own knowledge. Search alone missed obvious leaders (Kapiva, Himalaya) because Exa favours small sellers' product pages.
  4. *Rank:* the reasoning model picks the most relevant 4–6 from the merged candidates. It prefers brands that compete across several product lines over single-product sellers, and does not prefer small companies.
- **Market scope comes from the profile, not the city alone** (`market.ts`): online sales channels, a D2C or marketplace model, an online store, or pan-India service areas or audience mean national. Otherwise the business is local to its city.
- **Code verifies every suggestion** (`verify-competitors.ts`):
  - A competitor is kept only if its website's domain is among the URLs the searches returned, or it was named in the recall step. The ranking step cannot introduce anyone new.
  - A recalled brand that no search returned must have a homepage whose title or site name carries its distinctive name (generic words like "health" or "naturals" don't count), so a wrong or guessed website is dropped.
  - Marketplaces, directories, review, social and news sites are dropped, along with the business's own domain, competitors already listed and duplicates.
  - The competitor's homepage must then open, with robots.txt respected. It also supplies a logo and, when the search said nothing, a one-line summary.
- **Once per workspace.** `competitor_discovery` has a unique `workspace_id`, and starting takes an advisory lock. A finished run is final, even if it found fewer than three; the owner then adds, edits or removes competitors by hand. A run that failed before finding anything (gateway error, or lost to a restart after 4 minutes) may be retried.
- **Suggestions, not facts** (CLAUDE.md rule 3). Found competitors are `candidate` rows in `brand_competitor`. Only competitors the owner keeps, edits or adds become `verified`, and only verified ones are indexed into the Brand Brain.
- **The run happens in the API process**, like the website scan, until queues ship. The model comes from the reasoning tier (`OPENROUTER_MODEL_REASONING`). Tokens and cost are stored on the run.

## Alternatives tested (2026-11-18)
- **Native search (Claude's own, or OpenAI's through `openai/gpt-5.2`)** was refused: our OpenRouter account enforces zero data retention ("ZDR violation (account settings)"), and no native-search endpoint offers it. Adopting it would mean relaxing the account setting and ADR 0004. The search engine stays configurable (`OPENROUTER_SEARCH_ENGINE=exa|native`) in case that decision changes.
- On the Aayush Wellness profile, the revised Exa pipeline returned Kapiva, Himalaya Wellness, Dabur, HealthKart, Organic India and Fast&Up. A single search had returned Raskam Healthcare, RediClinic and Livestamin.

## Consequences
- **Cost:** about $0.06 per workspace (plan, 3–4 searches, recall and rank; measured at $0.060), paid once. Not charged as credits yet; it arrives with billing (M13).
- **Coverage:** web search finds businesses with websites. Shops that only have a Google Maps listing are missed; a Google Places step is the planned addition for local categories.
- **Quality depends on the profile:** a brand with no category, description or products gets weak results. The owner can always add competitors by hand.
- **Exa and OpenRouter see the search query:** public business details only. Exa's retention terms are not covered by our ZDR routing, which only applies to the model provider. List Exa as a subprocessor.
- **Replaceable:** switching to another search provider means changing the adapter and this ADR; callers only see `webSearch` and `sources`.
