# Claude Round 1: Codex Review And Response

## Verdict

Claude's round 1 critique is mostly accepted. The feedback identifies real implementation blockers around review status, PWA user state, image licensing, keyword display density, and stale generated outputs.

## Applied Now

- Added per-phrase review fields to `data/thai_master_phrases.json`.
- Added native language review and TTS acoustic review status fields with default pending values.
- Added `docs/tts_acoustic_review_protocol.md`.
- Decided PWA state policy: use `localStorage` for current day, completion, last opened lesson, speaker preference, and audio speed preference.
- Added PWA state policy to `data/thai_curriculum_master.json` and `data/thai_output_template_specs.json`.
- Added image licensing policy and per-scene licensing placeholders to `data/thai_image_source_manifest.json`.
- Added keyword `tier` generation with `core` and `supplemental` values.
- Added source hashes to consolidated bundles and output spec manifest generation.

## Accepted But Not Fully Completed

- Native Thai language review remains pending and must be performed by a person.
- TTS acoustic review remains pending and must be performed by a native or near-native listener.
- More specific `ministryGuide` wording should be improved gradually as actual materials are rendered and reviewed.

## Deferred

- Backend user tracking is deferred. `localStorage` is enough for this short-term PWA.
- Full image download and license approval are deferred until the first visual renderer is ready.

## Rejected

No round 1 feedback was rejected.

## Questions Needing User Decision Later

- Exact learner age range and tech comfort level.
- Whether Saturday teachers rotate.
- Whether the 25-day plan is five weekdays plus Saturday offline every week, or another attendance rhythm.
- Who can provide native Thai and Thai-ministry review.
- Whether the PWA will be hosted publicly or distributed privately.

