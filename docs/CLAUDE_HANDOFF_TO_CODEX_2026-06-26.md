# Claude → Codex Handoff (2026-06-26)

## Project

Thai 25-day missionary/daily-conversation PWA. Korean learners (avg. age ~58)
learn one Thai sentence/day for 25 weekdays, with a Saturday 10-min offline
class and a Sunday personal-review mission each week. Delivery channels:
PWA (web), KakaoTalk card images, Saturday PPTX + teacher script, Sunday
print sheet.

- Live site: **https://xhpark.github.io/Thai_25day/?day=1** (GitHub Pages,
  deploys automatically on every push to `master`, usually live in 1-3 min)
- Repo: **https://github.com/xhpark/Thai_25day** (public — see "Repo is
  public" note below)
- Local working copy: `C:\Users\xhpar\OneDrive\Documents\Thai_25day`
  (this is the **real** project; `D:\proj\Thai_25day` is an unrelated
  decoy folder containing only a planning `.docx`, not code)
- Latest commit at handoff time: `380985e` ("fix(content): correct Korean
  pronunciation hint 츄아 -> 츠아 for 믿다/เชื่อ")

## How the operator actually uses this

The user is not a developer. Each day they manually send learners:
1. A PWA link (`https://xhpark.github.io/Thai_25day/?day=N`)
2. A KakaoTalk card image (`assets/generated/kakao/w{week}d{day}_card.png`)

Both need to exist and be correct *before* that day arrives. Saturdays also
need a PPTX deck + teacher script docx.

## Architecture (read this before changing anything)

Static site, **no build step, no backend, no database**. Everything is
plain files served as-is:

```
index.html, app.js, styles.css, service-worker.js, manifest.webmanifest   ← PWA shell
assets/audio/{sentences,words}/*.mp3                                      ← TTS audio (already generated, complete for all 25 days)
assets/images/scenes/*.jpg, assets/images/keywords/*.jpg                  ← photos (mostly missing past day5, see TODO)
assets/generated/{pwa,kakao,ppt,print}/*.json                             ← per-lesson rendering specs (generated, do not hand-edit)
assets/generated/kakao/*_card.png                                         ← rendered Kakao card images
assets/generated/ppt/*.pptx, *_script.docx                                ← rendered Saturday deck + teacher script
data/thai_master_phrases.json                                             ← SOURCE OF TRUTH: Thai text, romanization, Korean pronunciation per sentence variant
data/thai_curriculum_master.json                                          ← SOURCE OF TRUTH: day-by-day schedule, which variant/keywords are new each day
data/thai_image_source_manifest.json                                     ← SOURCE OF TRUTH: which scene image is used by which day, stock/AI fallback prompts
data/thai_learning_assets_index.json                                      ← generated from master_phrases + KEYWORDS list, do not hand-edit
data/generated/thai_lesson_bundles.json                                   ← generated, do not hand-edit
scripts/*.py, scripts/*.js                                                ← the only things that should write into assets/generated/ and data/generated/
```

**Golden rule:** never hand-edit a file under `assets/generated/` or
`data/generated/`, or `data/thai_learning_assets_index.json`. Edit the
source files (`data/thai_master_phrases.json`,
`data/thai_curriculum_master.json`, `data/thai_image_source_manifest.json`,
or the `KEYWORDS`/`DAY_PLAN` constants in
`scripts/generate_learning_assets.py`), then re-run the generator chain
below. Otherwise your fix gets silently overwritten next regeneration and
the live site drifts from source.

## Regeneration order (run after any content/curriculum/image edit)

```bash
python scripts/generate_learning_assets.py --index-only   # rebuild data/thai_learning_assets_index.json (add --execute to also synthesize any new/missing audio via edge-tts)
python scripts/generate_lesson_bundles.py                  # rebuild data/generated/thai_lesson_bundles.json + all assets/generated/{pwa,kakao,ppt,print}/*.json
python scripts/validate_asset_links.py                     # must print "[OK] asset links valid" — do not commit if it errors
node scripts/render_kakao_card.js w1d2                     # re-render one Kakao card PNG (repeat per lesson id that changed)
python scripts/build_saturday_ppt.py w1sat                 # rebuild one Saturday PPTX (repeat per week)
python scripts/build_teacher_script_doc.py w1sat           # rebuild one Saturday teacher script docx (repeat per week)
python scripts/build_image_sourcing_doc.py                 # regenerate docs/thai_25day_image_sourcing_request.{md,docx}
python scripts/build_daily_weekly_plan_doc.py               # regenerate docs/태국어_25일_일별_주차별_학습계획.docx
```

Then `git add -A && git commit -m "..." && git push`. GitHub Pages picks it
up automatically — no manual deploy step.

Python deps needed: `edge_tts`, `python-pptx`, `python-docx`, `Pillow`
(install with `pip install <name>` if missing — none are vendored).
`node scripts/render_kakao_card.js` shells out to local Microsoft Edge
headless (`--headless --screenshot`), so it only works on a machine with
Edge installed (this is currently run on the user's Windows PC, not CI).

## What I (Claude) did this session, in order

1. **Found the real project.** The user had been describing work done in
   `D:\proj\Thai_25day`, which turned out to be a decoy with only a
   planning `.docx`. The actual app lives at
   `C:\Users\xhpar\OneDrive\Documents\Thai_25day` (found via a
   filesystem-wide search for `manifest.json`/PWA artifacts).

2. **Fixed a curriculum-wide keyword-duplication bug.** `keyWordIds` per
   weekday in `data/thai_curriculum_master.json` were supposed to be "the
   vocabulary newly introduced in that day's new sentences," but 12 of the
   25 weekdays (`W1D2, W1D4, W2D6, W2D8, W2D9, W2D10, W3D11, W3D12, W3D13,
   W3D15, W4D16, W4D17, W4D18, W4D19`) re-listed words already taught on an
   earlier day. I wrote a script that walks the schedule in actual day
   order, computes each keyword's true first-appearance day, and rewrote
   `keyWordIds` to only the genuinely-new set per day. Re-run that audit
   (logic is in the conversation, not saved as a script — see "Things I'd
   do differently" below) if the curriculum changes again.

3. **Fixed an empty-keyword-list rendering bug in `app.js`.** Some days'
   only-new keyword is tagged `tier: "supplemental"` globally, so
   `displayKeywords` (core-only) came back empty. The spec already
   declared a `keywordDisplayPolicy.emptyCoreFallback:
   "show_first_three_keywords"` contract that `app.js` never implemented.
   Added `effectiveDisplayKeywords()` in `app.js` to honor it.

4. **Initial git commit + GitHub repo + GitHub Pages.** Repo had no commits
   at all before this session. Created `xhpark/Thai_25day` (public),
   pushed, enabled Pages (`gh api repos/xhpark/Thai_25day/pages -X POST`).

5. **Converted every absolute root path (`/app.js`, `/styles.css`,
   `/assets/...`, manifest `start_url`/`scope`, service worker
   `register("/service-worker.js")`, audio `playAudio(`/${path}`)`) to
   repo-relative paths.** GitHub Pages project sites serve at
   `/Thai_25day/`, not domain root, so absolute paths 404'd. This was the
   single biggest "why doesn't it work on Pages" trap — check for any new
   leading-`/` path before every deploy.

6. **Day2-5 content pass**, prompted by the user noticing day2 reused
   day1's keywords:
   - Sourced 4 user-generated images from
     `D:\문서\태국선교\image\{Goodmorning_Goodevening,ThanksNoratall,
     YesorNo,BeleiveinJesus}.png`, converted to JPG, registered as new
     per-day scenes in `data/thai_image_source_manifest.json` (previously
     day1-5 all shared one generic "church gate" photo).
   - Generalized `scripts/render_kakao_card.js` to take a lesson-id CLI
     arg (was hardcoded to `w1d1`) and added a "compact" two-phrase layout
     (days with 2 new sentences were overflowing the card before the fix).
   - Built `scripts/build_saturday_ppt.py` (python-pptx, 8 slides matching
     `data/thai_output_template_specs.json`'s `saturdayPpt` spec) and
     `scripts/build_teacher_script_doc.py` (python-docx, 8 sections
     matching the `teacherScript` spec). Generated `w1sat.pptx` +
     `w1sat_script.docx`. Verified visually via PowerPoint/Word COM
     automation (`New-Object -ComObject PowerPoint.Application` /
     `Word.Application`) since no Linux-side renderer (LibreOffice) is
     installed — re-use that approach if you need to eyeball a deck again.

7. **Two targeted content fixes**, each propagated through the full
   generation chain (not just the one obviously-affected file):
   - Day2 `hook`/`story` text rewritten per user request to explain *why*
     day2 teaches morning/evening greetings (day1's plain greeting already
     "works," day2 adds nuance) — also required re-running
     `build_image_sourcing_doc.py`, which had gone stale.
   - Korean pronunciation hint for 믿다/เชื่อ (`W041`, sentence variant
     `21`) corrected `츄아 → 츠아` in `data/thai_master_phrases.json` and
     `scripts/generate_learning_assets.py`, then regenerated the index,
     all bundles/split specs, the Day5 Kakao PNG, and
     `태국어_25일_일별_주차별_학습계획.docx` (which also had it baked in).
     **Lesson:** always `grep -r` the target string across the whole repo,
     including inside `.docx`/`.pptx` (they're zip+XML —
     `zipfile.ZipFile(path).read('word/document.xml')`), not just the
     JSON you assume is canonical.

## Current state per day

| Days | PWA spec | Kakao JSON | Kakao PNG | Scene image | Sat PPTX/script |
|---|---|---|---|---|---|
| 1 | ✅ | ✅ | ✅ | ✅ (shared `greeting_church_gate`) | — (W1SAT done, see below) |
| 2-5 | ✅ | ✅ | ✅ | ✅ (per-day, user-provided photos) | — |
| W1SAT (1st Saturday) | n/a | n/a | n/a | ✅ shared | ✅ `w1sat.pptx` + `w1sat_script.docx` |
| 6-25 | ✅ (curriculum-correct, keyword bug already fixed) | ✅ | ❌ not rendered | ❌ mostly missing (see below) | ❌ not built |
| W2-5 SAT/SUN | n/a | ✅ JSON | ❌ | ❌ mostly missing | ❌ |

All audio (`assets/audio/sentences`, `assets/audio/words`) is **already
fully generated for all 25 days** — 342/342 files present, confirmed by
`generate_learning_assets.py --index-only`. Don't regenerate audio unless
you actually change Thai text/wording.

## TODO for Codex, roughly in delivery order

1. **Three more user-provided images are sitting unused** at
   `D:\문서\태국선교\image\{Excuseme,Whatsyourname_Mynameis,
   Howoldareyou}.png`. By filename these map to day6 (실례합니다/괜찮아요),
   day7-8 (이름이 무엇인가요/제 이름은), day9 (몇 살이니). Same process as
   step 6 above: verify each image actually matches its day's content
   (the user caught one mismatch last time — `ThanksNoratall.png` — and
   approved using it anyway; don't assume filename = content), convert to
   JPG, register as a new scene in `thai_image_source_manifest.json`
   scoped to that one day's id, regenerate, re-render the Kakao PNG.

2. **Scene images for everything else are missing**: `name_intro_
   conversation` (W2D7,W2D8,W5D22,W2SAT), `restroom_wayfinding` (W3D11),
   `meal_table_fellowship` (W3D12,W3D15,W3SAT,W3SUN), `encouragement_and_
   blessing` (W2D10,W4D16-19,W4SAT,W4SUN), `prayer_support` (W5D23),
   `praise_invitation` (W4D20,W5D24), `full_mission_roleplay_review`
   (W5D25,W5SAT,W5SUN). Each entry in `thai_image_source_manifest.json`
   already has `stockSearchQueries` and an `aiPrompt` block ready to use
   for sourcing/generating these — ask the user first whether more
   user-generated images are coming before generating placeholders.

3. **Kakao card PNGs for day6-25 + all Sat/Sun weeks 2-5** haven't been
   rendered yet (`node scripts/render_kakao_card.js <id>` per lesson, once
   images exist — the renderer falls back to a "이미지 준비 중" label if
   the scene is missing, so you *can* render before images land, just
   expect to re-render after).

4. **Saturday PPTX + teacher script for weeks 2-5** — `python scripts/
   build_saturday_ppt.py w2sat` etc. The scripts are generalized and
   already pull `teacherFlow` from the existing `*_script.json` specs, so
   this should be a pure "run it and eyeball the output" task, not new
   code, *unless* a week's `ministryGuide`/`teacherFlow` text still reads
   thin — `docs/claude_round5_final_verdict.md` (an older review, predates
   this session) flagged weeks 2-5 `ministryGuide` as needing a sharpen
   pass before rendering. Worth a quick re-read before generating.

5. **`service-worker.js`'s `SHELL_ASSETS` only precaches day1-5's spec
   JSON.** It's not broken for other days (the fetch handler is
   network-first with cache fallback for *any* request, precaching is
   just an offline-readiness nice-to-have), but bump the list and the
   `CACHE_NAME` version as more days go live, or learners' offline/repeat
   visits won't have those days cached.

6. **Repo is public.** GitHub Pages' free tier needs that to serve the
   PWA without paying for Pro; the user explicitly approved this. It means
   all Thai text, curriculum structure, and images are publicly visible at
   the repo URL (not just the Pages URL). If that becomes a concern later,
   the fallback is Cloudflare Pages (supports private repos free) — would
   need re-pointing the deploy, not a code change.

## Known gotchas (save yourself a debugging loop)

- **Console encoding.** Printing Korean text via `python -c "print(...)"`
  on this Windows box mangles to cp949/mojibake in the terminal even
  though the file itself is correct UTF-8. Always write to a file and use
  the `Read` tool (or just trust `json.dump(..., ensure_ascii=False)` is
  fine on disk) instead of trusting terminal output when verifying Korean
  text.
- **`paragraph_format.element` in python-docx** returns the `<w:p>`
  element, not `<w:pPr>` — call `.get_or_add_pPr()` on it, it works, just
  don't be confused by the property name.
- **PPTX/DOCX visual QA**: no LibreOffice on this box. Use PowerPoint/Word
  COM automation from PowerShell (`New-Object -ComObject
  PowerPoint.Application`, `.Slides.Item(n).Export(path, "PNG", w, h)`; for
  Word, `Documents.Open` then `SaveAs(path, [ref]17)` for PDF) to actually
  look at rendered output before calling a layout "done." I caught a
  bottom-text-clipping bug this way on the first Kakao "compact" layout
  pass that would've otherwise shipped broken.
- **`MSO_SHAPE`/autoshape type ints**: `add_shape(1, ...)` = rectangle,
  `add_shape(5, ...)` = rounded rectangle, used as raw ints in
  `build_saturday_ppt.py`'s `add_rect()` instead of importing
  `MSO_SHAPE` — works but isn't self-documenting if you extend it.

## Things I'd do differently / leave noted for Codex

- The keyword-duplication audit (item 2 above) was a one-off inline
  script in the conversation, not saved to `scripts/`. If you add new
  weekdays or reorder the curriculum again, that "is this keyword
  genuinely new today" check should probably become a permanent
  `scripts/audit_keyword_duplication.py` that `validate_asset_links.py`
  calls, instead of relying on a human (or agent) remembering to re-run an
  ad hoc check.
