# Codex Handoff, Lessons Learned, and Final Evaluation - 2026-07-10

## Purpose

This document is a durable handoff for Claude or another agent continuing the Thai 25-day learning project. It records:

- Problems encountered during development.
- Root causes and fixes that worked.
- Lessons to reuse in similar short-cycle PWA, audio, STT, and learning-content projects.
- Current final-product evaluation, including additions made in this later phase: day 11-19 learning images and week 5 review/pronunciation-assessment content.

Do not add secrets to this document. Cloud Run env values, Firebase credentials, and learner credentials must remain outside Git.

## Current Repository State

- Workspace: `C:\Users\xhpar\OneDrive\Documents\Thai_25day`
- Branch: `master`
- Remote: `https://github.com/xhpark/Thai_25day.git`
- Current status at writing: clean and in sync with `origin/master`
- Key recent commits:
  - `deba030 Reduce review STT audio payload`
  - `fbc437b Fix Android STT streaming audio`
  - `1a50923 Clarify microphone permission errors`
  - `da33f28 Add final review pronunciation assessment`
  - `5158dc7 Align weekend reviews and verify day 11-20 assets`
  - `7b5b78b Map day 11-20 lesson scene images`
  - `0582fff Add day 9 age response lesson and image`
  - `cdb40cd Separate dated weekend reviews from regular days`

## Public Entry Points

- General GitHub Pages PWA:
  - `https://xhpark.github.io/Thai_25day/`
  - Example final review link: `https://xhpark.github.io/Thai_25day/?date=2026-08-01`
- Firebase Hosting surface also exists from earlier work:
  - `https://thai-mission-app-001.web.app/`
- Voice server:
  - Cloud Run service: `thai25-voice-server`
  - Region: `asia-northeast3`
  - Stable app-config URL currently used by `app.js`:
    - `https://thai25-voice-server-527401030399.asia-northeast3.run.app`
    - `wss://thai25-voice-server-527401030399.asia-northeast3.run.app/ws/stt`
- Voice server operational check:
  - Use `/health` or `/status`.
  - Do not rely on `/healthz`; in the last check it returned a Google frontend 404 even though `/health` and `/status` returned 200.

## Verification Commands Used

```powershell
git status --branch --short
git log --oneline -12
python scripts/validate_asset_links.py
node --check app.js
node --check voice-server/src/server.js
gcloud run services describe thai25-voice-server --project thai-mission-app-001 --region asia-northeast3 --format="value(status.latestReadyRevisionName,status.traffic[0].percent,status.url)"
gcloud run services logs read thai25-voice-server --project thai-mission-app-001 --region asia-northeast3 --limit 30 --format="value(timestamp,severity,textPayload)"
```

Last validation results:

- `python scripts/validate_asset_links.py`: passed.
- `node --check app.js`: passed.
- `node --check voice-server/src/server.js`: passed.
- GitHub Pages served `app.js?v=22` after cache delay.
- Rendered 2026-08-01 review page displayed 19 review practice buttons with no console errors in the in-app browser.
- Cloud Run revision after latest voice-server deploy: `thai25-voice-server-00014-bx2`, 100 percent traffic.

## Curriculum And Content Decisions

### Final structure

- Days 1-20 are new sentence-learning days.
- Days 21-25 are final review days.
- Weekday new-content flow:
  - Days 1-15 cover daily/life conversation plus scheduled mission language.
  - Days 16-20 complete the remaining mission-language set.
- Weekend dated review pages are separate from numbered lesson days:
  - This is critical. Do not overwrite `w2d6.json` or `w2d7.json` when creating date-based Saturday/Sunday review pages.
  - Dated review pages live as `assets/generated/pwa/review_YYYY_MM_DD.json`.

### Important correction from development

The user explicitly corrected a confusion between "learning day number" and "calendar weekend review link." For example, 2026-07-04 and 2026-07-05 were weekend review links, not instructions to overwrite day 6 and day 7 lesson data. Future agents should preserve this distinction.

## Current PWA Content Summary

### Day 11-20 learning pages and scene images

Verified current mapping:

| Day | JSON | Title | Primary image |
| --- | --- | --- | --- |
| 11 | `w3d11.json` | 화장실 묻기 | `assets/images/scenes/restroom_wayfinding.jpg` |
| 12 | `w3d12.json` | 식사 대화 | `assets/images/scenes/meal_table_fellowship.jpg` |
| 13 | `w3d13.json` | 격려하기 | `assets/images/scenes/encouraging_child_or_volunteer.jpg` |
| 14 | `w3d14.json` | 작별 인사 | `assets/images/scenes/warm_church_farewell.jpg` |
| 15 | `w3d15.json` | 기도해 드릴게요 | `assets/images/scenes/prayer_support.jpg` |
| 16 | `w4d16.json` | 예수님의 사랑 전하기 | `assets/images/scenes/jesus_loves_you.jpg` |
| 17 | `w4d17.json` | 하나님의 사랑 전하기 | `assets/images/scenes/god_loves_you.jpg` |
| 18 | `w4d18.json` | 축복하기 | `assets/images/scenes/god_bless_you.jpg` |
| 19 | `w4d19.json` | 하나님은 사랑이십니다 | `assets/images/scenes/god_is_love.jpg` |
| 20 | `w4d20.json` | 함께 찬양해요 | `assets/images/scenes/praise_invitation.jpg` |

Scene-image folder currently contains 20 image files. Day 11-20 image mapping is present and the referenced files exist.

### Week 5 review pages

Current numbered final review:

| Day | JSON | Title | Review count | Pronunciation assessment |
| --- | --- | --- | ---: | --- |
| 21 | `w5d21.json` | 선교언어 전체 문장 복습 | 8 | yes |
| 22 | `w5d22.json` | 생활회화 전체 문장 복습 | 19 | yes |
| 23 | `w5d23.json` | 선교언어 전체 문장 반복 복습 | 8 | yes |
| 24 | `w5d24.json` | 생활회화 전체 문장 반복 복습 | 19 | yes |
| 25 | `w5d25.json` | 선교언어 최종 반복 복습 | 8 | yes |

Current dated final review:

| Date | JSON | Source day | Title | Review count | Pronunciation assessment |
| --- | --- | --- | --- | ---: | --- |
| 2026-08-01 | `review_2026_08_01.json` | 22 | 토요일 생활회화 전체 문장 복습 | 19 | yes |

Week 5 review follows the user's decision:

- 21 and 23 and 25 repeat the 8 mission-language sentence review.
- 22 and 24 repeat the 19 daily-conversation sentence review.
- 2026-08-01 Saturday repeats the 22nd day daily-conversation review.
- Review practice stores score and transcript only; audio originals are not stored.
- Review mode is public-limited/anonymous rather than iPhone-only device-bound.

## Known Remaining Issue

### Closed: day 25 primary image

This issue is closed. The user decided that day 25 should reuse the same image as day 23 instead of creating a new image.

Day 25 now references:

```text
assets/images/scenes/prayer_support.jpg
```

The old missing `full_mission_roleplay_review.jpg` reference should not reappear in generated PWA/Kakao/PPT/print outputs. If regeneration brings it back, check `data/thai_image_source_manifest.json` first.

## Audio And STT State

### Sentence audio

- `assets/audio/sentences` currently has 162 MP3 files.
- No missing sentence audio references were found in the PWA JSON scan.
- Keyword-audio folder was not present in the last quick count. If future work reintroduces keyword audio, verify the expected path and index before claiming keyword audio is complete.

### Final-review pronunciation assessment

The final-review practice flow:

1. Learner taps "듣고 바로 따라 말하기."
2. App plays target sentence audio.
3. Recording starts at the end of playback, with a slight lead to avoid clipping the first syllable.
4. Learner's own voice is locally replayed.
5. PCM audio is sent to Cloud Run STT.
6. Google STT transcript is compared against the Thai target.
7. Score and transcript are stored anonymously; audio original is not stored.

## Problems Encountered And Lessons Learned

### 1. Learning day vs calendar date confusion

Problem:

- Dated weekend reviews were accidentally treated as day 6/day 7 lesson replacements.

Root cause:

- The curriculum has both numbered lesson days and calendar-specific review pages. They look similar in the UI but are different data surfaces.

Fix:

- Keep `wXdY.json` numbered lessons separate from `review_YYYY_MM_DD.json` dated reviews.
- Date links use `?date=YYYY-MM-DD`.
- Numbered lessons use `?day=N`.

Lesson:

- For curriculum apps, define "lesson id", "calendar date", and "review source day" as separate concepts early.

### 2. PWA/service-worker cache made fixes look absent

Problem:

- GitHub had new code, but users still saw old behavior.

Root cause:

- `index.html`, `app.js?v=N`, and `service-worker.js` cache names must be bumped together.

Fix:

- Bumped from v21 to v22 after STT payload changes.

Lesson:

- Every PWA behavior change should include a cache/version checklist:
  - `index.html` script query.
  - stylesheet query if CSS changed.
  - `service-worker.js` cache name.
  - service-worker asset list.
  - GitHub Pages propagation check.

### 3. Localhost behavior differed from deployed behavior

Problem:

- Local `127.0.0.1` tests did not exercise real Cloud Run STT.

Root cause:

- `reviewDemoMode()` intentionally simulates recognition on localhost/127.0.0.1.

Fix:

- Use local only for layout/microphone permission UX.
- Use GitHub Pages URL for real STT testing.

Lesson:

- When a local demo mode exists, always state which path is being tested: local demo, deployed public PWA, or device-bound pilot PWA.

### 4. Browser microphone permission errors were unclear

Problem:

- Learner saw a generic "permission denied" and could not tell whether the issue was phone permission, browser support, or server failure.

Root cause:

- Client grouped `getUserMedia` errors and STT session errors into one message.

Fix:

- Added clearer microphone permission handling and user-facing guidance.

Lesson:

- Audio apps should distinguish:
  - blocked microphone permission,
  - insecure context,
  - unsupported browser APIs,
  - missing microphone device,
  - STT server/session failure.

### 5. Google Speech v2 private streaming call was unstable

Problem:

- Real Android/GitHub Pages test produced STT errors such as internal server errors.

Root cause:

- Server used Google Speech v2 private/internal `_streamingRecognize()` behavior.

Fix:

- Switched to public `@google-cloud/speech` v1 `streamingRecognize()`.

Lesson:

- Avoid private SDK methods in production-like learning tools. Public stable APIs are easier to reason about and debug.

### 6. Wrong v1 audio stream shape caused "malordered data"

Problem:

- After switching to v1, streaming failed with a "Malordered Data Received" type error.

Root cause:

- v1 `streamingRecognize({ config, interimResults })` expects raw audio chunks after config, not v2-style control objects.

Fix:

- Send raw PCM Buffer chunks with `session.speechStream.write(chunk)`.

Lesson:

- When changing cloud SDK versions, verify wire/message shape with the official sample pattern rather than adapting old code by intuition.

### 7. Android STT payload could exceed server byte cap

Problem:

- Cloud Run logs showed repeated `speech_stream_error audio_too_large`.

Root cause:

- Client streamed raw PCM at the device's native audio context sample rate. Some devices can produce enough bytes in a short recording to hit a conservative byte cap.

Fix:

- Downsample STT PCM to 16 kHz in `app.js` before sending.

Lesson:

- For speech recognition, 16 kHz mono LINEAR16 is usually enough and much safer for mobile network/runtime limits than native 48 kHz or higher.

### 8. WebAuthn/device binding required a clear first-login story

Problem:

- A real learner could not understand how to register the iPhone if the first screen was login.

Root cause:

- The server needs Firebase UID before binding a passkey credential, so login must happen before device registration.

Fix:

- Earlier iPhone pilot copy and flow were clarified; the learner signs in first, then sees registration.

Lesson:

- When device binding is used, explain why login precedes registration. Otherwise learners interpret login as a dead end.

### 9. Expired session tokens caused false STT failures

Problem:

- Recording attempts failed with `expired_pilot__session_token`.

Root cause:

- Pilot session token could expire before the learner started recording.

Fix:

- Client refreshes verification/session before recording when needed.

Lesson:

- Short-lived auth tokens should be refreshed immediately before audio capture, not only at page load.

### 10. ADB real-device testing is valuable but fragile

Problem:

- Android real-device testing worked, then later `adb devices` showed no device.

Root cause:

- USB debugging sessions can disappear when the phone locks, authorization changes, cable mode changes, or ADB server state resets.

Fix:

- Use:

```powershell
$adb = "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe"
& $adb kill-server
& $adb start-server
& $adb devices -l
```

Lesson:

- Treat ADB availability as a testing condition, not a stable development assumption. Record whether the final verification was browser-only or device-confirmed.

### 11. Source images outside the repo must be copied into project assets

Problem:

- User placed images under `D:\문서\태국선교\image`, but those files could later be deleted.

Root cause:

- External image folders are not durable project dependencies.

Fix:

- Copy used images into `assets/images/scenes/` and reference project-relative paths.

Lesson:

- For generated/static learning apps, the repo asset folder must be the source of truth. External folders are intake folders only.

### 12. Thai language source data needs repeated validation

Problem:

- Several pronunciation/romanization/korean-pronunciation mismatches were found earlier, including female question endings and specific phrase variants.

Root cause:

- Thai gendered endings, question endings, romanization tone marks, and Korean-style pronunciation are easy to mismatch when data is copied across multiple generated outputs.

Fix:

- Use the master phrase data as the source of truth and regenerate outputs.
- Review male and female forms separately.

Lesson:

- For tonal/gendered language learning, never treat "one phrase" as one audio or one text row. Male/female utterances and TTS assets need independent validation.

## Final Product Evaluation

### Strengths

- The project now has a usable end-to-end PWA learning surface for all 25 days.
- Days 1-20 provide new sentence learning; days 21-25 provide final review.
- Day 11-20 scene-image mapping is largely complete and contextually aligned.
- Week 5 review is pedagogically coherent:
  - Mission-language review is repeated across days 21, 23, and 25.
  - Daily-conversation review is repeated across days 22, 24, and 2026-08-01.
  - Review focuses on sentences, not keywords, matching the user's final-week intent.
- Final-review pronunciation assessment is available to broader learners with anonymous score/transcript storage and no audio storage.
- Cloud Run STT was tested and hardened through real Android/GitHub Pages failures.
- GitHub Pages PWA deployment is straightforward for learners:
  - `https://xhpark.github.io/Thai_25day/?day=N`
  - `https://xhpark.github.io/Thai_25day/?date=YYYY-MM-DD`

### Weaknesses / risks

- Day 25 previously referenced a missing primary image, but the issue was closed by reusing day 23's `prayer_support.jpg`.
- `scripts/validate_asset_links.py` previously passed even though the day 25 primary image file was missing; this is now fixed so generated `local_preferred` image paths are checked.
- Some old handoff docs still mention earlier Firebase Hosting or Cloud Run URLs/revisions. Treat older handoffs as historical unless verified against current code and `gcloud run services describe`.
- The public final-review STT flow depends on browser microphone permission, Cloud Run availability, Google STT, and network stability.
- Mobile live testing after v22 was browser/deployment verified, but the very last USB ADB check did not see the device. Re-run physical-device testing when the phone is connected and authorized.
- Keyword audio status should be re-audited if future content depends on keyword-level playback. Sentence audio references currently have no missing paths.

### Recommended next actions

1. Re-run Android real-device test using the deployed URL after the phone appears in `adb devices -l`.
2. Review week 5 scoring UX with an older learner:
   - Is "듣고 바로 따라 말하기" obvious?
   - Does the 4-second window feel too short for long mission-language phrases?
   - Is score feedback encouraging rather than discouraging?
3. Consider adding a visible "마이크 권한 안내" help panel only on final-review pages.

## Quick Links For Claude

```text
Day 11: https://xhpark.github.io/Thai_25day/?day=11
Day 12: https://xhpark.github.io/Thai_25day/?day=12
Day 13: https://xhpark.github.io/Thai_25day/?day=13
Day 14: https://xhpark.github.io/Thai_25day/?day=14
Day 15: https://xhpark.github.io/Thai_25day/?day=15
Day 16: https://xhpark.github.io/Thai_25day/?day=16
Day 17: https://xhpark.github.io/Thai_25day/?day=17
Day 18: https://xhpark.github.io/Thai_25day/?day=18
Day 19: https://xhpark.github.io/Thai_25day/?day=19
Day 20: https://xhpark.github.io/Thai_25day/?day=20
Day 21: https://xhpark.github.io/Thai_25day/?day=21
Day 22: https://xhpark.github.io/Thai_25day/?day=22
Day 23: https://xhpark.github.io/Thai_25day/?day=23
Day 24: https://xhpark.github.io/Thai_25day/?day=24
Day 25: https://xhpark.github.io/Thai_25day/?day=25
2026-08-01 review: https://xhpark.github.io/Thai_25day/?date=2026-08-01
```

## Safe Operational Notes

- Do not commit `voice-server/env.cloudrun.yaml`.
- Do not paste learner emails, passwords, UIDs, or Cloud Run secrets into docs.
- Use `/health` or `/status` for the voice server operational check.
- Use deployed GitHub Pages for real STT testing; localhost is demo mode.
- When touching PWA runtime files, bump cache/script versions together.
