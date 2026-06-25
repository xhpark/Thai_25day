# TTS Acoustic Review Protocol

Purpose: Establish a lightweight but real listening gate before Thai TTS audio is treated as production-ready.

## Status

Current status: pending spot check.

The MP3 files have been generated and verified as readable files, but they have not yet been approved by a native or near-native Thai listener.

## Minimum Spot Check Set

Review at least 15 audio files before public release:

- Greeting first impression:
  - `assets/audio/sentences/S1_male_normal.mp3`
  - `assets/audio/sentences/S1_female_normal.mp3`
  - `assets/audio/sentences/S2_1_male_normal.mp3`
  - `assets/audio/sentences/S2_1_female_normal.mp3`
- Question endings:
  - `assets/audio/sentences/S8_female_normal.mp3`
  - `assets/audio/sentences/S10_female_normal.mp3`
  - `assets/audio/sentences/S11_female_normal.mp3`
  - `assets/audio/sentences/S12_female_normal.mp3`
- Mission phrases:
  - `assets/audio/sentences/S17_male_normal.mp3`
  - `assets/audio/sentences/S18_female_normal.mp3`
  - `assets/audio/sentences/S19_male_normal.mp3`
  - `assets/audio/sentences/S20_female_normal.mp3`
  - `assets/audio/sentences/S21_male_normal.mp3`
  - `assets/audio/sentences/S23_female_normal.mp3`
  - `assets/audio/sentences/S24_male_normal.mp3`

## Listener Checklist

For each file, mark:

- `pass`: Natural enough for learner use.
- `watch`: Understandable but awkward or too robotic.
- `reject`: Needs regeneration, SSML tuning, or native recording.

Check these points:

- Thai words are pronounced correctly.
- Male/female final particles sound right.
- Question particles `คะ` and statement particles `ค่ะ` are distinguishable.
- Tones are acceptable enough for beginner repetition.
- Speed is usable for average-age Korean learners.
- Mission phrases sound respectful and warm, not harsh or unnatural.

## Reject Handling

If a file is rejected:

1. Record the path and reason.
2. Try SSML or text spacing adjustment first.
3. Regenerate that file only.
4. If TTS still fails, mark it for native recording replacement.

## Data Fields

Phrase review fields are stored in `data/thai_master_phrases.json`:

- `review.languageReviewStatus`
- `review.nativeReviewedBy`
- `review.nativeReviewDate`
- `review.ttsAcousticReviewStatus`
- `review.ttsAcousticReviewedBy`
- `review.ttsAcousticReviewDate`
- `review.notes`

