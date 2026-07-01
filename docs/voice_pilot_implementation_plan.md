# Thai Voice Pilot 구현 계획

작성일: 2026-07-01

## 목표

기존 Android 학습자용 PWA에는 녹음/STT 기능을 노출하지 않고, 승인된 iPhone 학습자 1명만 사용할 별도 PWA를 제공한다. 사용자는 학습 문장 또는 단어를 4초 이내로 녹음하고, 녹음 종료 직후 자기 음성을 자동 재생하며, Google Speech-to-Text 인식 결과와 유사도 점수를 거의 지연 없이 확인한다.

## 분리 원칙

- 기존 루트 PWA(`index.html`, `app.js`)에는 voice 기능 링크를 추가하지 않는다.
- 파일럿 화면은 `voice-pilot/` 아래에 둔다.
- STT 서버는 `voice-server/` 아래 Cloud Run 서비스로 분리한다.
- 승인되지 않은 사용자는 녹음/STT 기능 설명이나 버튼을 보지 못한다.
- 실제 보안은 클라이언트 UI가 아니라 Cloud Run 서버의 Firebase ID token 검증, 승인 UID allowlist, WebAuthn/passkey 기기 확인으로 강제한다.

## 구현된 1차 골격

- `voice-pilot/index.html`: 별도 PWA 진입점
- `voice-pilot/app.js`: 승인 게이트, iPhone passkey 등록/확인, 일차 선택, 남녀 발화 선택, 4초 녹음, 자동 재생, WebSocket STT 전송, 로컬 데모 모드
- `voice-pilot/styles.css`: iPhone 세로 화면 중심 UI
- `voice-pilot/manifest.webmanifest`, `voice-pilot/sw.js`: 별도 PWA 설치/캐시
- `voice-server/src/server.js`: Cloud Run WebSocket 서버 골격, Firebase ID token 검증, WebAuthn 등록/확인 API, 짧은 수명 파일럿 세션 토큰, Google STT v2 streamingRecognize 연결, Firestore 결과 저장
- `voice-server/.env.example`: 운영 환경변수 예시

## 사용자 흐름

1. 승인된 학습자에게만 별도 URL을 전달한다.
2. 학습자가 Firebase 계정으로 로그인한다.
3. Cloud Run 서버가 승인 UID인지 확인한다. 공개 Hosting에서는 클라이언트에 승인 UID를 넣지 않는다.
4. 최초 1회 `이 iPhone 등록하기`로 WebAuthn/passkey credential을 서버에 저장한다.
5. 매 사용 전 `등록된 iPhone 확인`으로 passkey를 검증한다.
6. 검증 성공 시 서버가 5~10분짜리 `pilotSessionToken`을 발급한다.
7. 사용자가 `녹음 시작`을 누른다.
8. 앱은 최대 4초 동안 녹음하고, 녹음 조각을 WebSocket으로 보낸다.
9. WebSocket 시작 메시지에는 Firebase token이 아니라 `pilotSessionToken`을 보낸다.
10. Cloud Run은 세션 토큰을 검증한 뒤 Google STT gRPC streamingRecognize로 오디오를 전달한다.
11. 녹음 종료 직후 폰에서 자기 음성을 자동 재생한다.
12. 재생되는 동안 interim/final transcript와 점수를 화면에 표시한다.
13. 서버는 Firestore에 점수와 transcript만 저장한다.
14. 오디오 원본은 Storage, Firestore, 서버 파일 시스템에 저장하지 않는다.

## 저장 데이터

Firestore 컬렉션 기본값: `pronunciationAttempts`

저장 필드:

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

오디오 Blob, 원본 파일, 녹음 URL은 저장하지 않는다.

## 아직 필요한 정보

1. Firebase 프로젝트 ID
2. Firebase Web App 설정값
   - `apiKey`
   - `authDomain`
   - `projectId`
   - `appId`
3. 승인할 iPhone 학습자의 Firebase UID
   - 공개 Hosting에 올릴 때는 `voice-pilot/config.js`가 아니라 Cloud Run `APPROVED_UIDS` 환경변수에만 넣는 것을 권장
4. 관리자 UID
5. 로그인 방식
   - 추천: email/password 또는 Google 로그인 중 하나
6. Cloud Run 배포 region
   - 추천: `asia-northeast3` 또는 프로젝트 운영 위치에 맞춤
7. Google Speech-to-Text v2 recognizer
   - 초기 추천: `projects/{project}/locations/global/recognizers/_`
8. WebAuthn RP 설정
   - `RP_ID`: 호스트 이름만 입력, 예: `voice-pilot.example.com`
   - `EXPECTED_ORIGIN`: 전체 origin, 예: `https://voice-pilot.example.com`
9. `PILOT_SESSION_SECRET`
   - 최소 32바이트 이상의 랜덤 문자열

## 주요 리스크와 대응

### iPhone 자동 재생

iOS Safari/PWA는 자동 재생 정책이 엄격하다. `녹음 시작` 터치 이후 이어지는 자동 재생은 동작할 가능성이 있지만 100% 보장할 수 없다. 실패 시 `다시 듣기` 버튼을 활성화한다.

### STT 지연

Cloud Run cold start, 네트워크 지연, STT 처리 상태에 따라 결과가 4초 재생 중에 항상 도착한다고 보장할 수 없다. 지연을 줄이기 위해 다음을 권장한다.

- Cloud Run minimum instances 1 검토
- WebSocket 연결 후 ready 신호가 오기 전까지 오디오 chunk를 클라이언트에서 버퍼링
- `latest_short`, `th-TH`, 짧은 4초 발화 유지

### 오디오 인코딩

iPhone Safari MediaRecorder가 생성하는 mime type은 기기/브라우저 버전에 따라 달라질 수 있다. 현재 클라이언트는 `audio/webm`, `audio/mp4`, `audio/aac`를 순서대로 시도한다. 실제 iPhone에서 STT 인식 실패가 있으면 AudioWorklet 기반 PCM 전송 또는 서버 측 변환이 필요하다.

### 기능 노출

기존 앱에는 링크를 넣지 않았지만 같은 공개 저장소와 같은 호스팅에 올리면 URL을 아는 사람은 파일 존재를 알 수 있다. 기능 존재 자체를 더 엄격히 감추려면 별도 비공개 저장소 또는 별도 Firebase Hosting/Cloud Run 도메인으로 배포하는 것을 권장한다.

### URL 노출과 iPhone 바인딩

URL이 노출되더라도 승인 UID와 등록된 iPhone passkey 검증을 통과하지 못하면 녹음/STT 기능은 사용할 수 없다. 단, PWA의 WebAuthn/passkey는 네이티브 iOS App Attest처럼 물리적 기기 한 대를 절대적으로 증명하는 방식은 아니다. iCloud Keychain 동기화 설정에 따라 같은 Apple 계정의 다른 기기에서 passkey가 동기화될 수 있다. 현재 파일럿 규모에서는 충분히 강한 보호책이지만, 물리적 iPhone 한 대만 엄격히 허용해야 한다면 네이티브 iOS 앱과 App Attest를 검토해야 한다.

## 다음 단계

세부 배포 절차는 `docs/voice_pilot_deployment_runbook.md`를 기준으로 진행한다.

1. 실제 Firebase 프로젝트의 Web App 설정으로 `voice-pilot/config.js`를 채운다.
2. Cloud Run에 `voice-server`를 배포한다.
3. Speech-to-Text API를 활성화하고 Cloud Run 서비스 계정 권한을 부여한다.
4. iPhone 실제 기기에서 마이크 권한, 자동 재생, STT 지연, transcript 정확도를 측정한다.
5. iPhone 실제 기기에서 WebAuthn 등록/확인과 iCloud Keychain 동기화 동작을 확인한다.
6. 파일럿 1명 운영 후 40명 확장 여부를 결정한다.
