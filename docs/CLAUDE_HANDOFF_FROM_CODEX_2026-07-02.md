# Claude Handoff from Codex - 2026-07-02

## Current Objective

Continue development of the Thai 25-day learning project with two deployed learning surfaces:

1. General learner PWA/web app for the full class.
2. Separate iPhone-only voice pilot PWA for one approved learner, with device binding, recording playback, Google STT scoring, and no stored audio.

This document summarizes the current repo state, deployment state, and the next work Claude should pick up from.

## Repository

- Root: `C:\Users\xhpar\OneDrive\Documents\Thai_25day`
- GitHub remote: `https://github.com/xhpark/Thai_25day.git`
- Main branch: `master`
- Firebase project: `thai-mission-app-001`
- Public Hosting URL: `https://thai-mission-app-001.web.app`

## General PWA

- Entry files:
  - `index.html`
  - `app.js`
  - `styles.css`
  - `manifest.webmanifest`
  - `service-worker.js`
- Public URL:
  - `https://thai-mission-app-001.web.app/`
- Data and generated learning assets:
  - `data/thai_curriculum_master.json`
  - `data/thai_master_phrases.json`
  - `data/thai_learning_assets_index.json`
  - `assets/generated/pwa/`
  - `assets/generated/audio/`
  - `assets/generated/kakao/`
  - `assets/images/scenes/`
- Build/deploy bundle command:
  - `scripts\build_firebase_hosting.ps1`
  - `firebase deploy --only hosting --project thai-mission-app-001`

## iPhone Voice Pilot PWA

- Entry files:
  - `voice-pilot/index.html`
  - `voice-pilot/app.js`
  - `voice-pilot/styles.css`
  - `voice-pilot/sw.js`
  - `voice-pilot/config.js`
- Public URL:
  - `https://thai-mission-app-001.web.app/voice-pilot/`
- Important design decision:
  - The learner must sign in with Firebase Email/Password first.
  - After sign-in, the app checks server approval by Firebase UID.
  - If approved and no iPhone credential is registered, the app shows `iPhone 음성 연습 등록`.
  - Registration before login is intentionally not supported because the server needs the Firebase UID before binding a passkey credential to a learner.
- The correct learner guidance is:
  - Open the voice pilot URL in iPhone Safari.
  - Sign in with the provided email/password.
  - Register this iPhone when the registration panel appears.
  - Tap the daily target sentence to hear, record, replay, and receive STT scoring.
- Current cache version:
  - `thai25-voice-pilot-v12`
  - `app.js?v=12`

## Voice Server

- Server files:
  - `voice-server/src/server.js`
  - `voice-server/deploy.cloudrun.ps1`
  - `voice-server/env.cloudrun.example.yaml`
  - `voice-server/env.cloudrun.yaml` is local and ignored by Git. Do not commit it.
- Cloud Run service:
  - `thai25-voice-server`
  - Region: `asia-northeast3`
  - Current service URL in app config:
    - `https://thai25-voice-server-x6prnyl4ia-du.a.run.app`
  - Current WebSocket URL:
    - `wss://thai25-voice-server-x6prnyl4ia-du.a.run.app/ws/stt`
- Latest verified revision at handoff:
  - `thai25-voice-server-00008-9k5`
  - 100 percent traffic
- Health check:
  - `https://thai25-voice-server-x6prnyl4ia-du.a.run.app/healthz/`
  - Note: use trailing slash. `/healthz` may return a Google frontend 404 even though `/healthz/` works.

## Current Voice Pilot Auth State

- Firebase Email/Password provider is enabled.
- The server enforces UID allowlisting with `APPROVED_UIDS`.
- At handoff, Cloud Run has both the previous test UID and the real learner UID in `APPROVED_UIDS`.
- Do not place secrets from `voice-server/env.cloudrun.yaml` in docs or commits.
- If the user later asks to remove the test phone/account, remove the test UID from `APPROVED_UIDS` and redeploy Cloud Run.

## iPhone Voice Pilot Implementation Notes

- Phone binding uses WebAuthn/passkeys via `@simplewebauthn/server`.
- Credentials are stored in Firestore collection:
  - `voicePilotCredentials`
- Challenges are stored in:
  - `voicePilotChallenges`
- Pronunciation scoring results are stored in:
  - `pronunciationAttempts`
- Audio originals are not stored.
- Stored attempt fields include:
  - `uid`
  - `email`
  - `day`
  - `phraseId`
  - `targetThai`
  - `targetKorean`
  - `transcript`
  - `score`
  - `audioStored: false`
  - `createdAt`
- Pilot session token TTL is currently 600 seconds.
- The v12 client decodes the token expiration time and refreshes the iPhone verification before recording when the token is expired or within 60 seconds of expiry.

## Recent Fixes Already Done

- STT 0-score issue fixed:
  - iPhone/Safari `MediaRecorder` output was not reliable for Google streaming STT.
  - The client now streams Web Audio `LINEAR16` PCM to the server.
  - `MediaRecorder` remains only for local playback of the learner's own voice.
  - Empty STT results now return `no_speech` instead of saving a 0 score.
- STT stream destroyed/write-after-destroyed handling was hardened.
- The voice practice target was made visually clear and recording starts closer to the end of the prompt audio.
- Device registration panel was moved out of the daily learning body after registration, and expired pilot tokens now trigger re-verification.

## Current Documentation Work Included in This Handoff Commit

- `docs/thai_25day_image_sourcing_request.md`
  - Week 2 scene needs were refined.
  - Several W2 assets are now marked ready.
- `docs/thai_25day_image_sourcing_request.docx`
  - Regenerated counterpart of the image sourcing request.
- `scripts/build_daily_weekly_plan_doc.py`
  - Added 핵심 단어 column to the daily/weekly plan document.
  - Pulls keywords from `data/thai_learning_assets_index.json`.
- `docs/태국어_25일_일별_주차별_학습계획.docx`
  - Regenerated daily/weekly plan document with 핵심 단어 information.

## Known UX Issue to Consider Next

The real learner may misunderstand the first screen. The current behavior is technically correct:

1. Login first.
2. Then register iPhone.

However, the login screen should be clearer. Recommended text change:

> 제공받은 학습자 이메일과 비밀번호로 먼저 로그인하세요. 로그인 후 이 iPhone 등록 화면이 나타납니다.

The registration panel should also clarify:

> 이 단계는 이 계정과 현재 iPhone을 연결하는 과정입니다.

This is a good next small UX patch before more learner testing.

## Recommended Next Steps

1. Improve the voice pilot login/register explanatory copy.
2. Test real learner login on iPhone Safari with the exact URL:
   - `https://thai-mission-app-001.web.app/voice-pilot/`
3. Confirm the first passkey registration succeeds.
4. Confirm a sentence can be played, recorded, replayed, transcribed, and scored.
5. After the real learner is stable, ask the user whether to remove the test UID from Cloud Run `APPROVED_UIDS`.
6. Continue with general PWA content/image completion and Saturday PPT generation.

## Useful Commands

```powershell
# Build Firebase Hosting bundle
scripts\build_firebase_hosting.ps1

# Deploy Firebase Hosting
firebase deploy --only hosting --project thai-mission-app-001

# Deploy voice server to Cloud Run
voice-server\deploy.cloudrun.ps1 -ProjectId thai-mission-app-001 -Region asia-northeast3

# Check voice server revision
& "$env:LOCALAPPDATA\Google\Cloud SDK\google-cloud-sdk\bin\gcloud.cmd" run services describe thai25-voice-server --region asia-northeast3 --project thai-mission-app-001 --format="value(status.latestReadyRevisionName,status.traffic[0].percent,status.url)"

# Health check
curl.exe -i -s https://thai25-voice-server-x6prnyl4ia-du.a.run.app/healthz/

# Syntax checks
node --check voice-pilot\app.js
node --check voice-pilot\sw.js
node --check voice-server\src\server.js
```

## Safety Notes

- Never commit `voice-server/env.cloudrun.yaml`.
- Do not print or copy Cloud Run secrets into handoff docs.
- If modifying approval, update `APPROVED_UIDS` in the local env file and redeploy Cloud Run.
- Do not use localhost or Tailscale URLs for iPhone passkey registration. The WebAuthn RP is `thai-mission-app-001.web.app`.
