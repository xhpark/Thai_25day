Round verdict:

The three round 1 must-fix blockers are resolved at the data-model level. Review status fields exist, localStorage policy is decided, image licensing structure is in place, keyword tiers are added, and source hashes are present. The project can begin renderer implementation. However, two verification gaps must be resolved as part of the renderer build — not after — or the renderer will be built against the wrong spec shape.

---

Must fix before implementation:

- Verify that the split PWA specs (`assets/generated/pwa/*.json`) were regenerated after the localStorage policy was added. Codex added the localStorage decision to `thai_curriculum_master.json` and `thai_output_template_specs.json`, but the 25 individual PWA specs were generated before that decision existed. If they were not regenerated, the renderer will build against specs that still have no state shape, and the localStorage integration will have to be reverse-engineered into a renderer that was built without it. Confirm regeneration or regenerate now before writing any PWA renderer code.

- Verify that the PWA split specs reference keyword `tier` for display filtering. Tier tags were added to the keyword data model, but the architectural question is whether the split specs carry a `displayKeywords` or `coreKeywords` list derived from that tier, or whether the renderer is expected to filter at runtime from the full keyword set. Both approaches are valid but require different renderer logic. The spec shape must be explicit about this before the PWA renderer is written, not treated as an implementation detail.

- The TTS acoustic spot-check protocol now exists, but no review results are documented. Building the renderer before acoustic results exist is acceptable. Releasing audio to learners is not. Before the first learner test — not before renderer build — the protocol must produce a documented result set: files checked, any rejects, and who listened. Add a placeholder result file now (even empty) so this is a tracked artifact, not a background intention.

---

Should improve soon:

- ministryGuide per-day specificity is now urgent rather than deferred, because the renderer build is starting. Generic guidance solidifies into final teacher materials once the PPT renderer runs. Each lesson entry needs at least one concrete sentence — a specific situation the phrase creates, a relational posture for that context, or one thing to avoid saying alongside it. This does not require rewriting all 25 entries before implementation. It requires rewriting the entries for the first week before the PPT renderer runs on week 1 materials.

- The Kakao spec count (30) is five higher than the PWA spec count (25). This probably corresponds to one Kakao card per Saturday lesson. Confirm explicitly whether Saturday Kakao cards follow the same spec shape as weekday cards or require a distinct layout. If distinct, the renderer needs two Kakao spec paths, not one. If the same, document it so the renderer author does not have to infer it.

- Teacher script format for rotating teachers: the round 1 question about standalone usability was accepted but not acted on. If the Saturday teacher rotates, each teacher script must be interpretable without prior knowledge of the previous sessions. Add a one-paragraph context header to the Saturday teacher script spec — lesson goal, what learners have covered so far, what success looks like for this session. This is a spec change, not a content change.

---

Can keep as-is:

- Review status fields defaulting to "pending." The right posture — propagate the flag, perform the review by humans, not a blocker for renderer build itself.

- Image licensing placeholders per scene. Structure exists, download is deferred until the first visual renderer is ready. Correct sequencing.

- Source hashes on lesson bundles. Correct mechanism. The staleness detection is now possible.

- Keyword tier architecture (core / supplemental). The data model is correct regardless of how the renderer surfaces it.

- Everything from round 1 that was confirmed as keep as-is: JSON-only architecture, Korean 음독 alongside romanization, TTS voice selection and audio variant strategy, ministryGuide naming and philosophy, Saturday offline structure, Kakao auto-send deferral, local → stock → AI image fallback hierarchy.

---

Questions for Codex/user:

- Were the 25 PWA split specs and 30 Kakao split specs regenerated after the localStorage policy was added, or are the current files pre-decision? The answer determines whether renderer work can start immediately or needs a one-time regeneration pass first.

- Does the PWA renderer spec shape carry a pre-filtered `coreKeywords` list, or does it carry all keyword IDs and expect the renderer to filter by tier at runtime? This decision affects renderer complexity.

- Who is performing the acoustic spot-check, and is there a target date before first learner use? The protocol exists; the human resource for executing it is not yet named.

- Has any person with Thai cross-cultural ministry experience reviewed the ministryGuide entries, separate from the native Thai language review? These are different review types and the gap on the missiological side has not been addressed.

---

Recommended next action:

Run the lesson bundle and split spec generator once more to produce post-localStorage-policy PWA specs, then build a single pilot renderer end-to-end: one PWA day spec into a working HTML page, one Kakao spec into a card layout. The pilot build will surface any remaining spec shape gaps — keyword filtering logic, localStorage read/write points, image placeholder handling — before committing to the full renderer structure. During the pilot build, run the acoustic spot-check protocol in parallel so results exist before the pilot is shown to any learner.
