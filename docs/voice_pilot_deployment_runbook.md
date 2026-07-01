# iPhone Voice Pilot 배포 실행서

작성일: 2026-07-01

## 현재 상태

- `voice-pilot/`는 기존 학습 PWA와 분리된 iPhone 파일럿 화면이다.
- `voice-server/`는 Firebase ID token, 승인 UID, WebAuthn/passkey 세션 토큰을 검증한 뒤 Google Speech-to-Text로 연결하는 Cloud Run 서버다.
- 기존 루트 PWA에는 음성 기능 링크를 넣지 않는다.

## 배포 전 준비값

1. Firebase 프로젝트 ID
2. Firebase Web App 설정값
   - `apiKey`
   - `authDomain`
   - `projectId`
   - `appId`
3. 승인할 iPhone 학습자의 Firebase UID
4. 관리자 UID
5. Cloud Run region
   - 추천: `asia-northeast3`
6. Speech-to-Text v2 recognizer
   - 초기값: `SPEECH_LOCATION=global`, `SPEECH_RECOGNIZER=_`
7. WebAuthn 값
   - `RP_ID`: 호스트명만, 예: `example.web.app`
   - `EXPECTED_ORIGIN`: origin 전체, 예: `https://example.web.app`
8. `PILOT_SESSION_SECRET`
   - 최소 32바이트 이상 랜덤 문자열

## 1. Google Cloud 준비

Google Cloud 프로젝트에서 다음 API가 활성화되어 있어야 한다.

- Cloud Run
- Cloud Build
- Artifact Registry
- Firestore
- Firebase Authentication
- Speech-to-Text

Cloud Run 기본 서비스 계정에는 다음 권한이 필요하다.

- Firestore 읽기/쓰기
- Firebase Auth token 검증에 필요한 Firebase Admin 권한
- Speech-to-Text 호출 권한

## 2. Cloud Run 환경변수 파일 만들기

`voice-server/env.cloudrun.example.yaml`을 `voice-server/env.cloudrun.yaml`로 복사하고 실제 값을 채운다.

`env.cloudrun.yaml`은 `.gitignore`에 들어 있으므로 커밋하지 않는다.

## 3. Cloud Run 서버 배포

이 컴퓨터에는 현재 `gcloud` CLI가 설치되어 있지 않다. 설치 후 아래처럼 실행한다.

```powershell
cd C:\Users\xhpar\OneDrive\Documents\Thai_25day\voice-server
.\deploy.cloudrun.ps1 -ProjectId "YOUR_PROJECT_ID" -Region "asia-northeast3" -MinInstances 0
```

파일럿 1명 테스트에서는 `-MinInstances 0`으로 시작한다. STT 지연이 체감되면 `-MinInstances 1`로 올린다.

## 4. PWA 설정 연결

Cloud Run 배포 후 나온 서비스 URL을 `voice-pilot/config.js`의 `stt` 값에 넣는다.

```js
stt: {
  apiBaseUrl: "https://YOUR_CLOUD_RUN_URL",
  websocketUrl: "wss://YOUR_CLOUD_RUN_URL/ws/stt",
  maxRecordingMs: 4000,
  connectTimeoutMs: 2500
}
```

Firebase Web App 설정과 승인 UID도 같은 파일에 넣는다. 실제 보안은 서버가 다시 검증하지만, 클라이언트에서도 승인되지 않은 사용자는 화면을 열지 않는다.

## 5. iPhone 실기기 점검

1. Safari에서 파일럿 URL을 연다.
2. Firebase 계정으로 로그인한다.
3. `이 iPhone 등록하기`를 눌러 passkey를 등록한다.
4. `등록된 iPhone 확인`으로 세션 토큰이 발급되는지 확인한다.
5. `녹음 시작`을 누르고 4초 이내 녹음한다.
6. 녹음 종료 직후 자기 음성이 자동 재생되는지 확인한다.
7. 재생 중 transcript와 점수가 표시되는지 확인한다.
8. Firestore에 transcript와 score만 저장되고 오디오 원본이 없는지 확인한다.

## 6. 보안 확인

- 기존 루트 PWA에는 voice-pilot 링크를 넣지 않는다.
- Cloud Run은 브라우저 WebSocket 접근 때문에 public으로 배포한다.
- public URL이 알려져도 승인 UID와 WebAuthn 세션 토큰 없이는 STT WebSocket을 시작할 수 없다.
- WebAuthn passkey는 iCloud Keychain 동기화 가능성이 있으므로, 물리적 iPhone 한 대만 절대적으로 묶는 수준은 아니다. 그 수준이 필요하면 네이티브 iOS App Attest로 전환한다.

## 7. 운영 전 잔여 점검

- `npm audit --omit=dev`의 `firebase-admin` 하위 moderate 취약점은 추적한다.
- 실제 iPhone Safari의 MediaRecorder mime type과 Google STT 인식 가능 여부를 확인한다.
- Android 학습자에게 파일럿 URL이 공유되지 않도록 카카오 안내 문구와 관리자 공유 범위를 분리한다.
