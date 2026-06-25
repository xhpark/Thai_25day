# Claude Handoff: PWA Week 1 Day 2-5

Date: 2026-06-25
Project: Thai 25-day missionary conversation PWA
Status: Waiting for user approval before Kakao card generation.

## Saved PWA Assets

The generated PWA lesson specs for Week 1 Day 2-5 are saved here:

- `assets/generated/pwa/w1d2.json`
- `assets/generated/pwa/w1d3.json`
- `assets/generated/pwa/w1d4.json`
- `assets/generated/pwa/w1d5.json`

Related Kakao JSON specs were also regenerated, but Kakao card PNG generation for Day 2-5 should wait until the user approves the PWA:

- `assets/generated/kakao/w1d2.json`
- `assets/generated/kakao/w1d3.json`
- `assets/generated/kakao/w1d4.json`
- `assets/generated/kakao/w1d5.json`

## Current PWA Links

Local desktop:

- Day 2: `http://127.0.0.1:5173/?day=2`
- Day 3: `http://127.0.0.1:5173/?day=3`
- Day 4: `http://127.0.0.1:5173/?day=4`
- Day 5: `http://127.0.0.1:5173/?day=5`

Tailscale phone access:

- Day 2: `http://100.108.82.28:5174/?day=2`
- Day 3: `http://100.108.82.28:5174/?day=3`
- Day 4: `http://100.108.82.28:5174/?day=4`
- Day 5: `http://100.108.82.28:5174/?day=5`

## Day Content

- Day 2: 좋은 아침 / 좋은 저녁
- Day 3: 정말 고마워요 / 천만에요
- Day 4: 예 / 아니오
- Day 5: 예수님 믿으세요

## Implementation Notes

- `app.js` now supports `?day=N` routing and renders all `newPhrases` for a day.
- Day 2-4 display two sentence cards each; Day 5 displays one sentence card.
- Male/female utterance switching is supported per phrase card.
- Korean pronunciation is visually emphasized for learners who cannot yet read Thai.
- Core words should favor Korean-style pronunciation in the visible learning UI.
- Scene image references for Day 2-5 are connected and validated.
- `service-worker.js` cache version was bumped to reduce stale cache issues.

## Verified

- `app.js` JavaScript syntax check passed.
- `service-worker.js` JavaScript syntax check passed.
- `scripts/validate_asset_links.py` passed after regeneration.
- Browser inspection confirmed Day 2-5 load with correct titles, phrase cards, images, review lists, and no console errors.

## Important Workflow Order

Do not generate the Day 2-5 Kakao card PNGs or the first Saturday PPTX until the user approves the PWA Day 2-5 pilot.

After approval:

1. Generate Kakao card PNGs for Day 2-5 from the approved PWA/spec content.
2. Ask for user confirmation if visual layout changes are substantial.
3. Generate the first Saturday PPTX review material.
