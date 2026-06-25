Round verdict:

**No structural blocker remains. The project is clear to proceed to Day 1 PWA and Kakao card pilot renderer implementation.** All must-fix items from rounds 1 through 4 are resolved at the spec level. The pilot build can begin immediately.

---

Must fix before implementation:

- None. Every renderer-blocking gap from prior rounds has been addressed: localStorage key schema is explicit with names, types, defaults, schema version, and reset behavior; image-missing fallback is specified as a stable placeholder panel using `primaryImage.altTextKo`; Sunday Kakao content source is defined with `reviewVariantIds`, `keyWordIds`, `personalMission`, and `ministryGuide` field mappings; audio speed control is placed in `inline_sentence_audio_toolbar` with `normal`, `slow`, and `repeat3` options; learner profile UX defaults are set for age ~58, 48px tap targets, manual audio trigger, and silent localStorage degradation.

---

Should improve soon:

- **Name a listener and a date for the acoustic spot-check.** This has been flagged across rounds 2, 3, and 4 without a named person or date. The pilot will be runnable shortly. Once any audio plays for a test listener, this is no longer pre-learner-use — it is learner use. Assign before the pilot is shown to anyone outside the build team.

- **Name a person for Thai cross-cultural ministry review.** Three rounds have noted this gap. It does not block the renderer but it blocks release into any church or ministry context. The pipeline is nearly ready to produce final materials; the review assignment should not trail the build.

- **Sharpen ministryGuide entries for weeks 2–5 before the PPT renderer reaches them.** Week 1 was corrected. Weeks 2–5 remain generic and will solidify into final teacher materials the moment the renderer runs. This is a timed constraint, not a background nicety.

---

Can keep as-is:

- Everything from rounds 1 through 4: JSON-only architecture, Korean 음독 alongside romanization, TTS voice selection and audio variant strategy, localStorage key schema with explicit names and types, image fallback hierarchy (local → stock → AI with per-scene approval), image-missing placeholder using `altTextKo`, learner profile UX defaults, Saturday structure (PPT and teacher script, no Kakao), Kakao auto-send deferral, source hashes, acoustic review placeholder artifact, `statePolicy` in every PWA split spec, `displayKeywords`/`supplementalKeywords`/`keywordDisplayPolicy` in both PWA and Kakao specs, `contentMode: daily_lesson` for weekday Kakao cards, `contentMode: review_recap` for Sunday Kakao cards with explicit content source mapping, audio speed control at `inline_sentence_audio_toolbar`, review status fields defaulting to `pending`, week 1 ministryGuide entries, Saturday teacher script `contextHeader`.

---

Questions for Codex/user:

- None that block the pilot. The two outstanding human-assignment questions (acoustic spot-check listener, ministry reviewer) require user action, not spec edits. They do not affect renderer implementation.

---

Recommended next action:

Build the Day 1 PWA pilot end-to-end in a single session: localStorage read/write against the specified key schema, core keyword display with `displayKeywords`/`keywordDisplayPolicy`, manual audio trigger with `inline_sentence_audio_toolbar` speed controls, and image placeholder panel using `altTextKo`. Then build the Kakao Day 1 card as a second output from the same spec pipeline. The full spec is complete and renderer-ready. There is nothing left to resolve before writing code.
