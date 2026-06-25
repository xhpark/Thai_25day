Round verdict:

**No structural blocker remains for the Day 1 PWA and Kakao card pilot.** All three round 3 must-fix items are resolved at the spec level. The pilot build can start now. One narrow spec gap will block the renderer when it reaches Sunday cards — it does not block Day 1 itself, but it must be resolved within the pilot build session before Sunday card rendering is attempted.

---

Must fix before implementation:

- **Specify Sunday Kakao card content source.** `contentMode: review_recap` with "same canvas and renderer" tells the developer the template shape but not what data populates it. A weekday card draws from a single day's lesson phrase. A Sunday review card draws from — what? That week's five daily phrases in condensed form? A separately authored recap phrase? A static "well done this week" message? The split spec must state the content source explicitly. If Sunday cards pull from the preceding week's `displayKeywords` and `corePhrase` fields, say so. If they have unique authored content, that content must exist in the Sunday split specs. The developer will reach Sunday card generation during the pilot session. Without this, they will invent a content model that may contradict the intended learning design.

---

Should improve soon:

- **Name a human and a target date for the acoustic spot-check.** This has been flagged across rounds 2 and 3 without resolution. The protocol exists, the result artifact is tracked, and the item is correctly scoped as pre-learner-use rather than pre-renderer-build. But the pilot will move quickly, and "before first learner use" is no longer a far-off constraint once the pilot is running. Assign a named listener and a specific date now, before the pilot is shown to anyone.

- **ministryGuide weeks 2–5 specificity.** Week 1 was sharpened. Weeks 2–5 remain generic. The PPT renderer will reach week 2 material soon after the pilot proves the pipeline. Generic entries will solidify into final teacher materials at that point. Rewrite weeks 2–5 before the PPT renderer runs on them, not after.

- **Thai cross-cultural ministry review still unassigned.** Three rounds have noted this gap. Language review and missiological review are different tasks and the missiological side has no named person. This does not block renderer work, but it blocks release to learners in a church context.

---

Can keep as-is:

- localStorage key schema with explicit key names, value types, defaults, schema version, namespace, and reset behavior. Sufficient for the pilot renderer to implement without invention.
- Image-missing fallback (stable placeholder panel using `primaryImage.altTextKo`). Renderer has a concrete instruction.
- Learner profile UX defaults (age ~58 average, 48px tap targets, manual audio trigger, large text, silent localStorage degradation with reset option). Renderer has a concrete baseline.
- Sunday Kakao `contentMode: review_recap` field and weekday `contentMode: daily_lesson` field. The field exists and the renderer switch point is clear — the content source gap above is the only missing piece.
- All round 1–3 keep-as-is items: JSON-only architecture, Korean 음독 alongside romanization, TTS voice and audio variant strategy, Saturday offline structure (PPT/teacher script, no Kakao), Kakao auto-send deferral, image fallback hierarchy, source hashes, acoustic review placeholder artifact, Saturday teacher script `contextHeader`, `displayKeywords`/`supplementalKeywords`/`keywordDisplayPolicy` in both PWA and Kakao specs, review status fields defaulting to `pending`.

---

Questions for Codex/user:

- What content populates a Sunday Kakao review card? If it draws from that week's daily lesson data, specify which fields and how many phrases. If it has unique authored content, confirm that content exists in the Sunday split specs before renderer work touches Sunday cards.
- Is the audio speed toggle a visible UI element in the Day 1 PWA layout, or is it a settings-screen control? The `thaiPWA_audioSpeed` state key exists, but no UI element is specified for changing it. The developer will place it somewhere — a spec-level hint prevents a design that conflicts with the final layout intention.

---

Recommended next action:

Add one sentence to each Sunday Kakao split spec stating the content source, then begin the Day 1 pilot renderer immediately. Build the PWA Day 1 page end-to-end — localStorage read/write against the specified key schema, core keyword display, manual audio trigger with speed state, image placeholder panel — then build the Kakao Day 1 card as a second output in the same session. The Sunday card content source fix can be applied in parallel and does not delay the Day 1 pilot start.
