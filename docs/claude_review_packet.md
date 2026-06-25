# Claude Review Packet: Thai 25-Day Mission Learning Project

This packet summarizes the current project state for external critique. The project goal is to create a simple short-term system that automatically generates Thai mission-language learning materials, Kakao sharing cards, a PWA learning experience, and Saturday offline teaching materials.

## Review Request For Claude

Please review this work as a product/education/content-system critic. Focus on practical risks, missing foundations, data-model problems, automation gaps, language-learning quality, and whether this structure is sufficient before building the actual PWA/card/PPT renderers.

Important context:

- The learning goal is mission use, not general tourism Thai.
- The `ministryGuide` field must support wise and relational mission practice. It should not discourage or block mission activity.
- Thai text and romanization were checked carefully, but a native Thai review is still expected before public release.
- The project intentionally starts simple and file-based to finish quickly.
- Please give direct critique, but prioritize actionable fixes.
- Maximum feedback loop: 5 rounds. In each round, identify what must be fixed before continuing.

Please evaluate:

1. Whether the data model can support the planned outputs.
2. Whether the 25-day curriculum flow is coherent for older Korean learners.
3. Whether the image sourcing strategy is realistic and safe.
4. Whether the TTS/audio assets and indexing strategy are maintainable.
5. Whether the project is ready to move into PWA/card/PPT renderer implementation.
6. What should be simplified, removed, or redesigned before implementation.

## Project Artifacts

Core source data:

- `data/thai_master_phrases.json`
- `data/thai_learning_assets_index.json`
- `data/thai_curriculum_master.json`
- `data/thai_output_template_specs.json`
- `data/thai_image_source_manifest.json`

Generated data:

- `data/generated/thai_lesson_bundles.json`
- `data/generated/output_specs_manifest.json`

Generated output specs:

- `assets/generated/kakao/*.json`
- `assets/generated/pwa/*.json`
- `assets/generated/ppt/*.json`
- `assets/generated/print/*.json`

Generated audio assets:

- `assets/audio/sentences/*.mp3`
- `assets/audio/words/*.mp3`

Scripts:

- `scripts/generate_learning_assets.py`
- `scripts/generate_lesson_bundles.py`

## What Was Built Step By Step

### 1. Master Phrase Data

Created `data/thai_master_phrases.json` as the canonical phrase source.

It contains:

- 24 core learning phrase items.
- 26 actual sentence variants because `good morning/good evening` and `yes/no` are split for TTS.
- Korean meaning.
- English phrase.
- Thai original text.
- Romanization with tone marks.
- Korean-style pronunciation from the user's source material.
- Male and female Thai speech forms separated for TTS.

Key design decision:

- TTS must use `speech.male.thai` and `speech.female.thai`, not combined slash notation.

### 2. Audio Asset Generation

Created `scripts/generate_learning_assets.py`.

It generates:

- Sentence audio for each variant.
- Male/female voice.
- Normal speed.
- Slow speed.
- 3-repeat sentence files.
- Major keyword audio.
- Keyword normal and slow speed.
- `data/thai_learning_assets_index.json`.

Voice engines used:

- Male: `th-TH-NiwatNeural`
- Female: `th-TH-PremwadeeNeural`

Generated counts:

- Sentence MP3: 156
- Word MP3: 186
- Total indexed audio references: 342
- Missing audio references after validation: 0

### 3. Keyword Indexing

Major words were extracted and indexed in `data/thai_learning_assets_index.json`.

Current keyword count:

- 49 keyword/word items.

Each keyword includes:

- Korean meaning.
- English meaning.
- Thai.
- Romanization.
- Korean-style pronunciation.
- Related phrase IDs.
- Related learning days.
- Audio paths.

### 4. Curriculum Master

Created `data/thai_curriculum_master.json`.

It contains:

- 5 weeks.
- 25 weekday lessons.
- 5 Saturday offline lessons.
- 5 Sunday personal review entries.
- Total schedule entries: 35.

Each weekday lesson includes:

- `id`
- `week`
- `day`
- `dayType`
- `lessonType`
- `title`
- `hook`
- `story`
- `newPhraseVariantIds`
- `reviewVariantIds`
- `keyWordIds`
- `missionGoal`
- `ministryGuide`
- `speakingMission`
- `assets`

Each Saturday entry includes:

- Roleplay scene.
- Roleplay focus phrase IDs.
- Teacher flow.
- Mission goal.
- Ministry guide.
- PPT slide count target.

Each Sunday entry includes:

- Review phrase IDs.
- Key words.
- Personal mission.
- Ministry guide.

Important terminology decision:

- Replaced "culture warning" style with `ministryGuide`.
- `ministryGuide` is meant to guide relational, wise mission use without discouraging mission activity.

Validation:

- Weeks: 5
- Weekdays: 25
- Saturdays: 5
- Sundays: 5
- Total schedule entries: 35
- Missing phrase references: 0
- Missing keyword references: 0

### 5. Output Template Specs

Created `data/thai_output_template_specs.json`.

It defines the generator spec for:

- Kakao card.
- PWA lesson page.
- Saturday PPT.
- Teacher script.
- A4 review sheet.

It also defines:

- Brand direction.
- Image policy.
- Template sections.
- Required fields.
- Asset packaging paths.
- Image scene library.

Validation:

- Template types: 5
- Image scene library entries: 5
- Schedule references valid: yes

### 6. Image Source Manifest

Created `data/thai_image_source_manifest.json`.

Image strategy:

1. Local prepared photos first.
2. Free/licensed stock photos second.
3. AI-generated realistic image only as fallback.

It includes:

- Quality rules.
- Reject rules.
- Stock source candidates.
- Keyword image rules.
- Scene assets.
- Stock search queries.
- AI fallback prompts.
- Korean alt text.

Important image principle:

- Images are not decoration. They must support memory, context, speaking confidence, or scene recall.

### 7. Lesson Bundle Generator

Created and extended `scripts/generate_lesson_bundles.py`.

It now generates:

- Consolidated lesson bundle: `data/generated/thai_lesson_bundles.json`.
- Output specs manifest: `data/generated/output_specs_manifest.json`.
- Individual renderer specs:
  - `assets/generated/kakao/*.json`
  - `assets/generated/pwa/*.json`
  - `assets/generated/ppt/*.json`
  - `assets/generated/print/*.json`

Generated individual specs:

- Kakao card specs: 30
- PWA lesson specs: 25
- Saturday PPT specs: 5
- Teacher script specs: 5
- Review sheet specs: 5
- Total split specs: 70

Validation:

- Missing split spec files: 0
- Invalid split spec JSON: 0
- Kind mismatches: 0

## Current Counts

| Area | Count |
|---|---:|
| Core phrase items | 24 |
| Sentence variants | 26 |
| Keywords | 49 |
| Weekday lessons | 25 |
| Saturday lessons | 5 |
| Sunday reviews | 5 |
| Sentence MP3 files | 156 |
| Word MP3 files | 186 |
| Kakao specs | 30 |
| PWA specs | 25 |
| PPT/script specs | 10 |
| Review sheet specs | 5 |
| Total split output specs | 70 |

## Known Assumptions

- The system starts as local JSON plus generated assets, not a database.
- Kakao auto-send is intentionally deferred. The first version should generate share cards, copyable message text, and PWA links.
- Images are not downloaded yet. The system currently creates source plans, search queries, fallback AI prompts, and output spec placeholders.
- Thai native review is still required before public learner use.
- The current output specs are renderer inputs, not final PNG/PPT/PDF files yet.

## Known Risks To Review

- Whether `thai_master_phrases.json` should include stronger provenance and Thai-review status per phrase.
- Whether `ministryGuide` is too soft, too repetitive, or insufficiently practical.
- Whether 49 keywords is too many for the target learner group.
- Whether generated MP3 files should be checked acoustically beyond `ffprobe` duration/readability checks.
- Whether `assets/generated` should contain renderer input JSON or only final generated artifacts.
- Whether local JSON is still acceptable once Kakao/PWA user progress tracking begins.
- Whether image licensing metadata needs to be represented before image download begins.

## Specific Questions For Claude

1. What is the biggest structural risk in this architecture?
2. What should be changed before building the PWA?
3. Is the curriculum too dense for older Korean learners?
4. Are the image sourcing rules operational enough?
5. Are the output specs over-modeled or appropriately detailed?
6. Does the `ministryGuide` policy serve the mission goal well?
7. What should be added to make this easier for a human teacher to trust?
8. What should be removed or postponed to keep the project short-term and simple?

## Requested Feedback Format

Please respond in this structure:

```text
Round verdict:

Must fix before implementation:
- ...

Should improve soon:
- ...

Can keep as-is:
- ...

Questions for Codex/user:
- ...

Recommended next action:
...
```

