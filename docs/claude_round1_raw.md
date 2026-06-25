```text
Round verdict:

Structurally coherent and more carefully assembled than most projects at this stage. The
data cascade makes logical sense. However, three gaps make renderer implementation
premature. None are large; all are fixable before the next round.

---

Must fix before implementation:

- Add reviewStatus/nativeReviewedBy per phrase in thai_master_phrases.json. Right now
  there is no way for the system, the renderer, or a teacher to distinguish verified Thai
  from unreviewed Thai. Once the PWA and Kakao cards go live, learners will use this
  language in actual ministry conversations. Propagating unreviewed output is the single
  highest-risk action in the whole project. A simple boolean plus a reviewer name field
  per phrase entry is sufficient.

- Establish a minimum acoustic spot-check protocol before treating TTS as production-
  ready. ffprobe confirms a file is readable and has duration. It does not confirm that
  Thai tones are correct. Thai has five tones; Azure TTS handles them inconsistently for
  phrase-internal tone sandhi (especially falling and rising tones in mid-sentence
  position). A native or near-native listener needs to check at minimum: one file per
  tone class, the greeting phrases (highest risk for learner first impression), and any
  phrase where the romanization shows a marked tone (e.g., syllables marked with háa or
  lôw). This does not need to be exhaustive before implementation — it needs to establish
  a baseline and a reject list.

- Define the PWA scope explicitly to include localStorage day-tracking or explicitly
  exclude it. The current architecture implies a navigable multi-lesson PWA, but without
  any user state mechanism, older learners have no way to return to where they stopped.
  This is not a future problem — it is a day-one UX problem for the target audience. For
  a short-term project, localStorage is sufficient and requires no backend. The
  architectural decision needs to be made now because it affects the PWA spec shape, not
  after the renderer is built.

---

Should improve soon:

- ministryGuide content is currently described as a policy (relational, wise, non-
  blocking) but the actual per-lesson entries need per-day specificity to be actionable.
  If every lesson entry reads as a variant of "approach relationships with care and
  wisdom," teachers will stop reading it within the first week. Each day's ministryGuide
  should name something concrete: a specific situation that phrase creates, a relational
  posture for that vocabulary context, or a thing to avoid saying alongside that phrase.
  The policy direction is correct. The execution needs to be specific.

- Image licensing metadata must be added to thai_image_source_manifest.json before any
  image is downloaded, not after. The project already acknowledges this risk. The fix is
  small: require licenseType, sourceUrl, and attributionRequired as mandatory fields per
  scene entry in the manifest. Retroactive license verification is expensive and error-
  prone.

- 49 keywords alongside 24 phrases for older Korean learners is probably too many to
  surface all at once. This is not a data model problem — the keyword count may be
  appropriate for completeness. The fix is a tier tag (core vs. supplemental) per keyword
  entry, with the PWA defaulting to core-only display. Supplemental keywords stay indexed
  and available but do not appear in daily lesson cards unless the learner or teacher
  chooses to enable them.

- The 5-layer data cascade (master phrases → curriculum → lesson bundles → output specs
  → split specs) has no version consistency mechanism. If a phrase is corrected in
  thai_master_phrases.json after bundles are generated, nothing in the current structure
  warns that downstream specs are stale. Add a sourceHash or generatedFrom version stamp
  to thai_lesson_bundles.json so a changed upstream file triggers a visible re-generation
  warning rather than silent inconsistency.

---

Can keep as-is:

- File-based local JSON architecture. For a 25-day short-term project with one teacher
  and a small cohort, a database adds complexity with no return. The current structure is
  appropriate.

- Korean-style pronunciation (음독) alongside romanization. This is a well-reasoned
  accommodation. Older Korean learners process unfamiliar sound through Korean phoneme
  maps. Keeping both is correct.

- TTS voice selection (NiwatNeural / PremwadeeNeural) and audio variant strategy
  (normal / slow / 3-repeat). The variant set matches the learning audience's needs
  without over-generating.

- ministryGuide naming and non-blocking philosophy. Do not revert to "culture warning"
  framing. The current framing is better aligned with the mission goal.

- Saturday offline lesson structure (roleplay + teacher flow + PPT). This is the
  strongest part of the curriculum design for the target audience. The Saturday session
  gives embodied practice that the weekday PWA cannot.

- Kakao auto-send deferral. Correct call for version 1.

- Local → stock → AI fallback image hierarchy. The principle is sound. The AI fallback
  should stay last and require explicit per-scene approval before use, which the current
  policy implies but should state explicitly.

---

Questions for Codex/user:

- What is the target age range and tech literacy level of the learners? This determines
  how much self-navigation the PWA can assume and how large text and controls need to be.

- Who teaches the Saturday sessions, and does the teacher rotate? If it rotates, the
  teacher script format needs to be more self-explanatory than if one person teaches all
  five Saturdays.

- Is the 25-day window consecutive daily learning, or five weeks of weekdays only? The
  packet says both "25 weekday lessons" and "5 weeks" — if Saturday is an additional
  session on top of five weekdays, that is six learning events per week, which is dense
  for any learner.

- Has the ministryGuide content been reviewed by someone with actual Thai ministry or
  cross-cultural mission experience? Linguistically safe text can still carry
  missiologically poor guidance. This is a different review than Thai native language
  review.

- Will the PWA be publicly hosted or installed locally (e.g., shared as a link to a
  hosted page vs. a file the teacher distributes)? This affects what localStorage
  assumptions are safe and whether the image asset strategy needs to handle CDN vs.
  local paths.

---

Recommended next action:

Do two things in parallel before writing any renderer. First, add reviewStatus and
nativeReviewedBy fields to thai_master_phrases.json (even if all values are currently
"pending"), then run a focused acoustic listen-through of 10–15 audio files covering
each tone class and the greeting phrases — document any rejects. Second, write a single
paragraph spec decision for the PWA: either "PWA uses localStorage to track current day
and last-completed phrase" or "PWA is static day-by-day navigation with no state." That
decision fixes the PWA spec shape and unblocks renderer work without requiring any new
infrastructure.
```
