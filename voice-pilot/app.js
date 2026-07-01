const CONFIG = window.VOICE_PILOT_CONFIG || {};
const DEMO_MODE = new URLSearchParams(window.location.search).get("demo") === "1";
const MAX_RECORDING_MS = Math.min(Number(CONFIG.stt?.maxRecordingMs || 4000), 4000);
const STORAGE_KEYS = {
  speaker: "thai25.voicePilot.speaker",
  day: "thai25.voicePilot.day"
};

const state = {
  auth: {
    ready: false,
    approved: false,
    admin: false,
    uid: null,
    email: null,
    idToken: null,
    message: ""
  },
  device: {
    registered: false,
    verified: false,
    sessionToken: null,
    busy: false,
    message: ""
  },
  day: Number(new URLSearchParams(window.location.search).get("day") || localStorage.getItem(STORAGE_KEYS.day) || 1),
  speaker: localStorage.getItem(STORAGE_KEYS.speaker) || "female",
  lesson: null,
  target: null,
  mediaRecorder: null,
  mediaStream: null,
  chunks: [],
  recordedBlob: null,
  playbackUrl: null,
  websocket: null,
  sttReady: false,
  pendingSttChunks: [],
  sttEndPending: false,
  recording: false,
  countdown: 4,
  status: "idle",
  transcript: "",
  interimTranscript: "",
  score: null,
  attempts: []
};

const app = document.getElementById("app");

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function setStatus(status, message = "") {
  state.status = status;
  if (message) state.auth.message = message;
  render();
}

function readLessonLabel() {
  return `${state.day}일차`;
}

function getSpeech(item) {
  if (item.speech) {
    return item.speech[state.speaker] || item.speech.female || item.speech.male;
  }
  return {
    thai: item.thai,
    romanization: item.romanization,
    korean_pronunciation: item.koreanPronunciation
  };
}

function currentTargetText() {
  const speech = getSpeech(state.target);
  return speech?.thai || "";
}

function scoreTranscript(targetThai, transcript) {
  const target = normalizeThai(targetThai);
  const heard = normalizeThai(transcript);
  if (!target || !heard) return 0;
  if (target === heard) return 100;

  const distance = levenshteinDistance(target, heard);
  const maxLen = Math.max(target.length, heard.length);
  return Math.max(0, Math.round((1 - distance / maxLen) * 100));
}

function normalizeThai(value) {
  return String(value || "").replace(/\s+/g, "").replace(/[.,!?ๆ]/g, "").trim();
}

function levenshteinDistance(a, b) {
  const dp = Array.from({ length: a.length + 1 }, () => Array(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i += 1) dp[i][0] = i;
  for (let j = 0; j <= b.length; j += 1) dp[0][j] = j;
  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  return dp[a.length][b.length];
}

async function loadLesson(day) {
  const boundedDay = Number.isInteger(day) && day >= 1 && day <= 25 ? day : 1;
  const week = Math.ceil(boundedDay / 5);
  const response = await fetch(`../assets/generated/pwa/w${week}d${boundedDay}.json`, { cache: "no-cache" });
  if (!response.ok) throw new Error(`${boundedDay}일차 자료를 불러오지 못했습니다.`);
  state.day = boundedDay;
  state.lesson = await response.json();
  state.target = state.lesson.newPhrases?.[0] || state.lesson.reviewPhrases?.[0] || state.lesson.displayKeywords?.[0];
  localStorage.setItem(STORAGE_KEYS.day, String(boundedDay));
}

async function initAuth() {
  if (DEMO_MODE) {
    state.auth = {
      ready: true,
      approved: true,
      admin: true,
      uid: "demo-approved-user",
      email: "demo@local",
      idToken: "demo-token",
      message: "로컬 데모 모드입니다. 실제 배포에서는 Firebase 승인 사용자만 접근합니다."
    };
    state.device = {
      registered: true,
      verified: true,
      sessionToken: "demo-session-token",
      busy: false,
      message: "로컬 데모에서는 iPhone 등록 확인을 건너뜁니다."
    };
    return;
  }

  if (!CONFIG.firebase?.apiKey) {
    state.auth = {
      ready: true,
      approved: false,
      admin: false,
      uid: null,
      email: null,
      idToken: null,
      message: "아직 Firebase 설정이 연결되지 않았습니다."
    };
    return;
  }

  try {
    const [{ initializeApp }, authModule] = await Promise.all([
      import("https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js"),
      import("https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js")
    ]);
    const firebaseApp = initializeApp(CONFIG.firebase);
    const auth = authModule.getAuth(firebaseApp);
    authModule.onAuthStateChanged(auth, async (user) => {
      if (!user) {
        state.auth = { ready: true, approved: false, admin: false, uid: null, email: null, idToken: null, message: "" };
        state.device = { registered: false, verified: false, sessionToken: null, busy: false, message: "" };
        render();
        return;
      }
      const token = await user.getIdToken();
      const uid = user.uid;
      const clientApprovedUids = CONFIG.auth?.approvedUids || [];
      const clientAdminUids = CONFIG.auth?.adminUids || [];
      const useClientAllowlist = clientApprovedUids.length > 0;
      const approved = useClientAllowlist ? clientApprovedUids.includes(uid) : true;
      state.auth = {
        ready: true,
        approved,
        admin: clientAdminUids.includes(uid),
        uid,
        email: user.email,
        idToken: token,
        message: approved
          ? useClientAllowlist
            ? "승인된 파일럿 학습자입니다."
            : "서버에서 승인 여부를 확인합니다."
          : "이 계정은 파일럿 기능 승인을 받지 않았습니다."
      };
      state.device = { registered: false, verified: false, sessionToken: null, busy: false, message: "" };
      if (state.auth.approved) refreshDeviceStatus();
      render();
    });
    state.firebaseAuth = auth;
    state.firebaseAuthModule = authModule;
  } catch (error) {
    state.auth = {
      ready: true,
      approved: false,
      admin: false,
      uid: null,
      email: null,
      idToken: null,
      message: `인증 모듈을 준비하지 못했습니다: ${error.message}`
    };
  }
}

async function signIn(event) {
  event.preventDefault();
  if (!state.firebaseAuth || !state.firebaseAuthModule) return;
  const form = new FormData(event.currentTarget);
  const email = String(form.get("email") || "").trim();
  const password = String(form.get("password") || "");
  try {
    await state.firebaseAuthModule.signInWithEmailAndPassword(state.firebaseAuth, email, password);
  } catch (error) {
    state.auth.message = `로그인 실패: ${error.message}`;
    render();
  }
}

async function signOut() {
  if (state.firebaseAuth && state.firebaseAuthModule) await state.firebaseAuthModule.signOut(state.firebaseAuth);
}

function render() {
  if (!state.auth.ready || !state.lesson) {
    app.innerHTML = `
      <section class="loading-panel">
        <p>Voice Pilot</p>
        <h1>발음 연습 화면을 준비하고 있습니다</h1>
      </section>
    `;
    return;
  }

  if (!state.auth.approved) {
    app.innerHTML = renderAccessGate();
    bindGateEvents();
    return;
  }

  const speech = getSpeech(state.target);
  const canRecord = state.device.verified && !state.recording;
  app.innerHTML = `
    <header class="pilot-header">
      <div>
        <p class="header-kicker">승인 학습자 전용</p>
        <h1>발음 연습 파일럿</h1>
        <p>${escapeHtml(state.auth.email || state.auth.uid)} · ${escapeHtml(readLessonLabel())}</p>
      </div>
      <button class="ghost-btn" data-action="sign-out">나가기</button>
    </header>

    <main>
      ${renderDevicePanel()}

      <section class="target-panel" aria-labelledby="target-heading">
        <div class="target-toolbar">
          <label>
            일차
            <select data-action="select-day">
              ${Array.from({ length: 25 }, (_, index) => {
                const day = index + 1;
                return `<option value="${day}" ${day === state.day ? "selected" : ""}>${day}일차</option>`;
              }).join("")}
            </select>
          </label>
          <div class="speaker-toggle" aria-label="발화 선택">
            <button data-speaker="female" aria-pressed="${state.speaker === "female"}">여성</button>
            <button data-speaker="male" aria-pressed="${state.speaker === "male"}">남성</button>
          </div>
        </div>
        <p class="lesson-title">${escapeHtml(state.lesson.title)}</p>
        <h2 id="target-heading">${escapeHtml(state.target.korean || state.target.koreanPronunciation)}</h2>
        <p class="thai-text" lang="th">${escapeHtml(speech.thai)}</p>
        <p class="korean-pronunciation">${escapeHtml(speech.korean_pronunciation || speech.koreanPronunciation)}</p>
        <p class="romanization">${escapeHtml(speech.romanization)}</p>
      </section>

      <section class="record-panel" aria-labelledby="record-heading">
        <div>
          <p class="section-label">4초 녹음</p>
          <h2 id="record-heading">${recordHeading()}</h2>
          <p class="record-copy">${recordCopy()}</p>
        </div>
        <div class="record-meter" data-state="${state.status}">
          <span>${state.recording ? state.countdown : "4"}</span>
        </div>
        <button class="record-btn" data-action="record" ${state.recording || !canRecord ? "disabled" : ""}>
          ${state.recording ? "녹음 중" : canRecord ? "녹음 시작" : "iPhone 확인 필요"}
        </button>
        <button class="replay-btn" data-action="replay" ${state.recordedBlob && !state.recording ? "" : "disabled"}>
          다시 듣기
        </button>
      </section>

      <section class="result-panel" aria-labelledby="result-heading">
        <div class="result-head">
          <div>
            <p class="section-label">인식 결과</p>
            <h2 id="result-heading">${resultTitle()}</h2>
          </div>
          <strong>${state.score === null ? "--" : `${state.score}점`}</strong>
        </div>
        <p class="transcript" lang="th">${escapeHtml(state.transcript || state.interimTranscript || "아직 인식 결과가 없습니다.")}</p>
        <p class="result-note">${resultNote()}</p>
      </section>

      ${state.auth.admin ? renderAdminPanel() : ""}
    </main>
  `;
  bindPilotEvents();
}

function renderAccessGate() {
  const hasConfig = Boolean(CONFIG.firebase?.apiKey);
  return `
    <main class="gate-screen">
      <section class="gate-card">
        <p class="header-kicker">Private Pilot</p>
        <h1>승인된 학습자만 사용할 수 있습니다</h1>
        <p>${escapeHtml(state.auth.message || "파일럿 대상 계정으로 로그인해 주세요.")}</p>
        ${
          hasConfig
            ? `
              <form class="login-form" data-action="login">
                <label>이메일 <input name="email" type="email" autocomplete="email" required /></label>
                <label>비밀번호 <input name="password" type="password" autocomplete="current-password" required /></label>
                <button type="submit">로그인</button>
              </form>
            `
            : `
              <div class="setup-note">
                <strong>설정 필요</strong>
                <span>Firebase 설정이 연결되기 전에는 이 화면이 열리지 않습니다.</span>
              </div>
            `
        }
      </section>
    </main>
  `;
}

function renderDevicePanel() {
  const stateLabel = state.device.verified ? "확인 완료" : state.device.registered ? "등록됨" : "미등록";
  return `
    <section class="device-panel" aria-labelledby="device-heading">
      <div>
        <p class="section-label">iPhone 바인딩</p>
        <h2 id="device-heading">등록된 iPhone 확인</h2>
        <p class="device-copy">${deviceCopy()}</p>
        ${state.device.message ? `<p class="device-message">${escapeHtml(state.device.message)}</p>` : ""}
      </div>
      <strong class="device-state">${escapeHtml(stateLabel)}</strong>
      <div class="device-actions">
        <button class="device-btn" data-action="register-device" ${state.device.busy || state.device.registered ? "disabled" : ""}>
          이 iPhone 등록하기
        </button>
        <button class="device-btn primary" data-action="verify-device" ${state.device.busy || !state.device.registered ? "disabled" : ""}>
          등록된 iPhone 확인
        </button>
      </div>
    </section>
  `;
}

function deviceCopy() {
  if (state.device.verified) return "이 기기 확인이 완료되어 녹음과 STT 기능을 사용할 수 있습니다.";
  if (state.device.registered) return "녹음 전에 이 iPhone의 passkey를 한 번 더 확인합니다.";
  return "URL을 알아도 이 계정과 등록된 iPhone passkey가 없으면 녹음 기능이 열리지 않습니다.";
}

function recordHeading() {
  if (state.recording) return "말씀해 주세요";
  if (state.status === "analyzing") return "내 목소리를 들으며 분석 중";
  if (state.status === "done") return "녹음과 분석 완료";
  return "듣고 바로 따라 말하기";
}

function recordCopy() {
  if (state.recording) return "4초 안에 한 번만 또렷하게 말합니다.";
  if (state.status === "analyzing") return "녹음은 저장하지 않고 인식 결과만 확인합니다.";
  if (state.status === "done") return "필요하면 다시 듣고 한 번 더 연습하세요.";
  return "녹음이 끝나면 내 목소리가 자동으로 재생되고, 동시에 인식 결과가 표시됩니다.";
}

function resultTitle() {
  if (state.status === "analyzing") return "분석 중";
  if (state.status === "done") return "확인 완료";
  return "대기 중";
}

function resultNote() {
  if (state.status === "analyzing") return "서버가 연결되면 말하는 동안 받은 조각을 바로 분석합니다.";
  if (state.status === "done") return "점수와 transcript만 저장하고 오디오 원본은 저장하지 않습니다.";
  return "결과는 Google STT가 알아들은 태국어와 목표 문장의 유사도로 계산합니다.";
}

function renderAdminPanel() {
  return `
    <section class="admin-panel" aria-labelledby="admin-heading">
      <div class="result-head">
        <div>
          <p class="section-label">관리자</p>
          <h2 id="admin-heading">최근 시도</h2>
        </div>
        <span>${state.attempts.length}건</span>
      </div>
      <div class="attempt-list">
        ${
          state.attempts.length
            ? state.attempts.map((attempt) => `
                <article>
                  <strong>${attempt.score}점</strong>
                  <span>${escapeHtml(attempt.transcript || "인식 없음")}</span>
                  <small>${escapeHtml(attempt.targetKorean)} · ${new Date(attempt.createdAt).toLocaleTimeString("ko-KR")}</small>
                </article>
              `).join("")
            : "<p>아직 저장된 시도가 없습니다.</p>"
        }
      </div>
    </section>
  `;
}

function bindGateEvents() {
  const form = document.querySelector('[data-action="login"]');
  if (form) form.addEventListener("submit", signIn);
}

function bindPilotEvents() {
  document.querySelector('[data-action="sign-out"]')?.addEventListener("click", signOut);
  document.querySelector('[data-action="record"]')?.addEventListener("click", startRecording);
  document.querySelector('[data-action="replay"]')?.addEventListener("click", replayRecording);
  document.querySelector('[data-action="register-device"]')?.addEventListener("click", registerDevice);
  document.querySelector('[data-action="verify-device"]')?.addEventListener("click", verifyDevice);
  document.querySelector('[data-action="select-day"]')?.addEventListener("change", async (event) => {
    await loadLesson(Number(event.target.value));
    resetRecordingState();
    render();
  });
  document.querySelectorAll("[data-speaker]").forEach((button) => {
    button.addEventListener("click", () => {
      state.speaker = button.dataset.speaker;
      localStorage.setItem(STORAGE_KEYS.speaker, state.speaker);
      resetRecordingState();
      render();
    });
  });
}

function resetRecordingState() {
  if (state.playbackUrl) URL.revokeObjectURL(state.playbackUrl);
  state.recordedBlob = null;
  state.playbackUrl = null;
  state.transcript = "";
  state.interimTranscript = "";
  state.score = null;
  state.status = "idle";
}

async function startRecording() {
  if (!state.device.verified || !state.device.sessionToken) {
    state.device.message = "먼저 등록된 iPhone 확인을 완료해 주세요.";
    render();
    return;
  }

  if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
    state.auth.message = "이 브라우저는 녹음 기능을 지원하지 않습니다.";
    render();
    return;
  }

  resetRecordingState();
  state.chunks = [];
  state.recording = true;
  state.countdown = Math.ceil(MAX_RECORDING_MS / 1000);
  state.status = "recording";
  render();

  try {
    state.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mimeType = pickMimeType();
    state.mediaRecorder = new MediaRecorder(state.mediaStream, mimeType ? { mimeType } : undefined);
    openSttStream();
    state.mediaRecorder.addEventListener("dataavailable", handleAudioChunk);
    state.mediaRecorder.addEventListener("stop", finishRecording);
    state.mediaRecorder.start(400);

    const tick = window.setInterval(() => {
      state.countdown = Math.max(0, state.countdown - 1);
      render();
      if (!state.recording) window.clearInterval(tick);
    }, 1000);

    window.setTimeout(() => {
      if (state.mediaRecorder?.state === "recording") state.mediaRecorder.stop();
    }, MAX_RECORDING_MS);
  } catch (error) {
    stopTracks();
    state.recording = false;
    state.status = "idle";
    state.auth.message = `마이크를 사용할 수 없습니다: ${error.message}`;
    render();
  }
}

function pickMimeType() {
  const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/aac"];
  return candidates.find((type) => MediaRecorder.isTypeSupported(type)) || "";
}

function handleAudioChunk(event) {
  if (!event.data || event.data.size === 0) return;
  state.chunks.push(event.data);
  if (state.websocket?.readyState === WebSocket.OPEN) {
    if (state.sttReady) {
      state.websocket.send(event.data);
    } else {
      state.pendingSttChunks.push(event.data);
    }
  }
}

function openSttStream() {
  if (DEMO_MODE || !CONFIG.stt?.websocketUrl || !state.device.sessionToken) {
    state.interimTranscript = "로컬 데모: 서버 연결 전에는 샘플 인식으로 표시됩니다.";
    return;
  }

  try {
    const url = new URL(CONFIG.stt.websocketUrl);
    url.searchParams.set("day", String(state.day));
    url.searchParams.set("speaker", state.speaker);
    url.searchParams.set("target", currentTargetText());
    state.websocket = new WebSocket(url);
    state.websocket.binaryType = "arraybuffer";
    state.sttReady = false;
    state.pendingSttChunks = [];
    state.sttEndPending = false;
    state.websocket.addEventListener("open", () => {
      state.websocket.send(JSON.stringify({
        type: "start",
        sessionToken: state.device.sessionToken,
        targetThai: currentTargetText(),
        targetKorean: state.target.korean,
        day: state.day,
        phraseId: state.target.phraseId || state.target.id,
        mimeType: state.mediaRecorder?.mimeType || ""
      }));
    });
    state.websocket.addEventListener("message", (event) => {
      const payload = JSON.parse(event.data);
      if (payload.type === "ready") {
        state.sttReady = true;
        state.pendingSttChunks.forEach((chunk) => state.websocket.send(chunk));
        state.pendingSttChunks = [];
        if (state.sttEndPending) state.websocket.send(JSON.stringify({ type: "end" }));
      }
      if (payload.type === "interim") state.interimTranscript = payload.transcript || "";
      if (payload.type === "final") {
        state.transcript = payload.transcript || "";
        state.score = Number.isFinite(payload.score) ? payload.score : scoreTranscript(currentTargetText(), state.transcript);
        saveAttempt(state.transcript, state.score);
        state.status = "done";
      }
      render();
    });
  } catch {
    state.interimTranscript = "서버 연결을 준비하지 못했습니다.";
  }
}

async function finishRecording() {
  state.recording = false;
  state.status = "analyzing";
  stopTracks();
  if (state.websocket?.readyState === WebSocket.OPEN) {
    if (state.sttReady) {
      state.websocket.send(JSON.stringify({ type: "end" }));
    } else {
      state.sttEndPending = true;
    }
  }

  state.recordedBlob = new Blob(state.chunks, { type: state.mediaRecorder?.mimeType || "audio/webm" });
  state.playbackUrl = URL.createObjectURL(state.recordedBlob);
  render();
  await replayRecording(true);

  if (DEMO_MODE || !CONFIG.stt?.websocketUrl) {
    window.setTimeout(() => {
      const transcript = currentTargetText();
      const score = scoreTranscript(currentTargetText(), transcript);
      state.transcript = transcript;
      state.interimTranscript = "";
      state.score = score;
      state.status = "done";
      saveAttempt(transcript, score);
      render();
    }, 700);
  }
}

async function replayRecording(isAuto = false) {
  if (!state.playbackUrl) return;
  const audio = new Audio(state.playbackUrl);
  try {
    await audio.play();
  } catch {
    if (isAuto) {
      state.auth.message = "자동 재생이 막혔습니다. 다시 듣기를 눌러 확인해 주세요.";
      render();
    }
  }
}

function saveAttempt(transcript, score) {
  const attempt = {
    uid: state.auth.uid,
    day: state.day,
    phraseId: state.target.phraseId || state.target.id,
    targetThai: currentTargetText(),
    targetKorean: state.target.korean || state.target.koreanPronunciation,
    transcript,
    score,
    createdAt: new Date().toISOString()
  };
  state.attempts = [attempt, ...state.attempts].slice(0, 10);
}

function stopTracks() {
  state.mediaStream?.getTracks().forEach((track) => track.stop());
  state.mediaStream = null;
}

async function refreshDeviceStatus() {
  if (DEMO_MODE || !CONFIG.stt?.apiBaseUrl || !state.auth.idToken) return;
  try {
    const status = await apiRequest("/webauthn/status");
    state.device.registered = Boolean(status.registered);
    state.device.verified = false;
    state.device.sessionToken = null;
    state.device.message = status.registered ? "등록된 iPhone이 있습니다. 사용 전 확인해 주세요." : "아직 등록된 iPhone이 없습니다.";
    render();
  } catch (error) {
    if (String(error.message || "").includes("not_approved") || String(error.message || "").includes("403")) {
      state.auth.approved = false;
      state.auth.message = "이 계정은 파일럿 기능 승인을 받지 않았습니다.";
      state.device = { registered: false, verified: false, sessionToken: null, busy: false, message: "" };
      render();
      return;
    }
    state.device.message = `기기 상태 확인 실패: ${error.message}`;
    render();
  }
}

async function registerDevice() {
  if (!window.PublicKeyCredential) {
    state.device.message = "이 브라우저는 passkey/WebAuthn을 지원하지 않습니다.";
    render();
    return;
  }
  state.device.busy = true;
  state.device.message = "iPhone passkey 등록을 준비하고 있습니다.";
  render();
  try {
    const options = await apiRequest("/webauthn/register/options");
    const credential = await navigator.credentials.create({ publicKey: publicKeyCreationOptions(options) });
    const result = await apiRequest("/webauthn/register/verify", {
      credential: publicKeyCredentialToJSON(credential)
    });
    state.device.registered = Boolean(result.verified);
    state.device.verified = false;
    state.device.sessionToken = null;
    state.device.message = "이 iPhone이 등록되었습니다. 이제 확인을 눌러 주세요.";
  } catch (error) {
    state.device.message = `iPhone 등록 실패: ${error.message}`;
  } finally {
    state.device.busy = false;
    render();
  }
}

async function verifyDevice() {
  if (!window.PublicKeyCredential) {
    state.device.message = "이 브라우저는 passkey/WebAuthn을 지원하지 않습니다.";
    render();
    return;
  }
  state.device.busy = true;
  state.device.message = "등록된 iPhone인지 확인하고 있습니다.";
  render();
  try {
    const options = await apiRequest("/webauthn/auth/options");
    const credential = await navigator.credentials.get({ publicKey: publicKeyRequestOptions(options) });
    const result = await apiRequest("/webauthn/auth/verify", {
      credential: publicKeyCredentialToJSON(credential)
    });
    state.device.verified = Boolean(result.verified);
    state.device.sessionToken = result.pilotSessionToken || null;
    state.device.message = state.device.verified ? "확인 완료. 이제 녹음할 수 있습니다." : "iPhone 확인에 실패했습니다.";
  } catch (error) {
    state.device.verified = false;
    state.device.sessionToken = null;
    state.device.message = `iPhone 확인 실패: ${error.message}`;
  } finally {
    state.device.busy = false;
    render();
  }
}

async function apiRequest(path, body = null) {
  const baseUrl = CONFIG.stt?.apiBaseUrl;
  if (!baseUrl) throw new Error("서버 주소가 설정되지 않았습니다.");
  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${state.auth.idToken}`,
      "content-type": "application/json"
    },
    body: body ? JSON.stringify(body) : "{}"
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || `${response.status} ${response.statusText}`);
  return payload;
}

function publicKeyCreationOptions(options) {
  return {
    ...options,
    challenge: base64UrlToBuffer(options.challenge),
    user: {
      ...options.user,
      id: base64UrlToBuffer(options.user.id)
    },
    excludeCredentials: (options.excludeCredentials || []).map((credential) => ({
      ...credential,
      id: base64UrlToBuffer(credential.id)
    }))
  };
}

function publicKeyRequestOptions(options) {
  return {
    ...options,
    challenge: base64UrlToBuffer(options.challenge),
    allowCredentials: (options.allowCredentials || []).map((credential) => ({
      ...credential,
      id: base64UrlToBuffer(credential.id)
    }))
  };
}

function publicKeyCredentialToJSON(credential) {
  const response = {};
  ["attestationObject", "authenticatorData", "clientDataJSON", "signature", "userHandle"].forEach((key) => {
    if (credential.response[key]) response[key] = bufferToBase64Url(credential.response[key]);
  });
  return {
    id: credential.id,
    rawId: bufferToBase64Url(credential.rawId),
    type: credential.type,
    authenticatorAttachment: credential.authenticatorAttachment,
    clientExtensionResults: credential.getClientExtensionResults(),
    response
  };
}

function base64UrlToBuffer(value) {
  const base64 = String(value).replaceAll("-", "+").replaceAll("_", "/");
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes.buffer;
}

function bufferToBase64Url(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

async function boot() {
  try {
    await Promise.all([initAuth(), loadLesson(state.day)]);
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
    render();
  } catch (error) {
    app.innerHTML = `
      <section class="loading-panel">
        <p>오류</p>
        <h1>파일럿 화면을 열 수 없습니다</h1>
        <span>${escapeHtml(error.message)}</span>
      </section>
    `;
  }
}

boot();
