Round verdict:

No structural blocker remains. The three round 1 must-fix items are fully resolved. The three round 2 must-fix items are resolved at the spec level. The pilot renderer can start now. Three narrow spec-shape gaps should be resolved as the first task of the pilot build — not during or after — because each one forces a developer to invent behavior that will need to be undone.

---

Must fix before implementation:

- **Define the localStorage key schema explicitly.** The `statePolicy` field now states what to track (current day, completion, last opened lesson, speaker preference, audio speed), but not the exact key names, value types, or schema version. A developer writing the PWA pilot without a concrete schema will invent key names, making any future spec-driven regeneration or second-device sync harder to reason about. One short schema block in the PWA spec is sufficient — something like `thaiPWA_currentDay: number`, `thaiPWA_completedDays: number[]`, `thaiPWA_audioSpeed: "normal"|"slow"`. This is a five-minute addition that prevents a real maintenance problem.

- **State the image-missing fallback behavior in the PWA spec.** No images are downloaded yet. The pilot renderer will encounter empty image slots on every scene. Without a spec-level instruction (grey placeholder container, scene description text overlay, skip the image region entirely), the developer will invent one and it will conflict with the final visual design. One line in the PWA spec resolves this before the renderer touches it.

- **Confirm Sunday Kakao card content shape in one sentence.** The 30-card Kakao scope now correctly maps to 25 weekdays + 5 Sundays. But the Sunday card format is unspecified. If Sunday cards are the same layout as weekday cards, the renderer needs one template. If they are a review or recap format, the renderer needs two. This is a binary decision the data supports but the spec has not stated. Leaving it unstated means the developer will assume weekday format and the assumption may be wrong.

---

Should improve soon:

- **ministryGuide specificity for weeks 2–5.** Week 1 was improved before this round. Weeks 2–5 still carry generic entries. These will solidify into final teacher materials the moment the PPT renderer runs on them. Rewrite the remaining entries before the PPT renderer reaches week 2, not after week 2 materials are generated.

- **Name a human and a date for the acoustic spot-check.** The protocol exists. The placeholder result file exists. Who listens and when remains unnamed. Before the pilot is shown to any learner — even a single test listener — the protocol must produce actual results. The gap is not the protocol or the artifact; it is the unassigned human resource. A named person and a target date before first learner use converts this from a background intention to a tracked commitment.

- **Resolve the learner profile question.** Age range and smartphone literacy level have been asked twice and not answered. For the pilot renderer specifically, this determines minimum tap target size, whether audio auto-plays or requires explicit user action, and whether localStorage failure (private browsing, quota exceeded) should display an error or silently degrade. These are renderer-level decisions that cannot be punted. If the answer is "older Korean adults, moderate smartphone literacy," the renderer defaults should lean toward larger controls, manual audio trigger, and silent localStorage degradation with a reset fallback. The pilot will implement something regardless — better to implement the right thing.

---

Can keep as-is:

- All round 1 and round 2 keep-as-is items remain correct. No regression detected.
- `displayKeywords` / `supplementalKeywords` / `keywordDisplayPolicy` in both PWA and Kakao specs. The data model is correct.
- `statePolicy` embedded in every PWA split spec. Decision is made; implementation follows.
- Saturday clarification (PPT and teacher script pack, not Kakao). Correct and documented.
- Source hashes on lesson bundles. Staleness detection mechanism is in place.
- Teacher script `contextHeader` for Saturdays. In place.
- Acoustic review result placeholder as a tracked artifact. In place.
- Review status fields defaulting to `pending`. Right posture — flag exists, human review follows.
- Everything from rounds 1 and 2: JSON-only architecture, Korean 음독 alongside romanization, TTS voice selection and audio variant strategy, ministryGuide naming and non-blocking philosophy, Saturday offline structure, Kakao auto-send deferral, local → stock → AI image fallback hierarchy with explicit per-scene AI approval.

---

Questions for Codex/user:

- What are the exact localStorage key names and value types? A short schema block now (even draft) prevents key name divergence between the pilot and the full build.
- Are Sunday Kakao cards weekday-format or review/recap format? One sentence closes this.
- What is the learner age range and smartphone literacy level? This is the only round 1 question that directly blocks renderer implementation decisions.
- Who performs the acoustic spot-check, and by what date before first learner use?

---

Recommended next action:

Write the three spec additions — localStorage key schema, Sunday Kakao format confirmation, image-missing fallback instruction — as a single short amendment to the relevant spec files before writing any renderer code. Then build the Day 1 PWA pilot end-to-end: spec → HTML page with localStorage read/write, core keyword display, audio controls, and image placeholder handling. Build the Kakao Day 1 card in the same session as a second output from the same spec pipeline. The pilot will surface any remaining shape gaps under real rendering conditions before committing the full 25-day build structure.
