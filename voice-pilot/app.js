const CONFIG = window.VOICE_PILOT_CONFIG || {};
const DEMO_MODE = new URLSearchParams(window.location.search).get("demo") === "1";
const MAX_RECORDING_MS = Math.min(Number(CONFIG.stt?.maxRecordingMs || 4000), 4000);
const RECORD_START_LEAD_MS = 90;
const STORAGE_KEYS = {
  speaker: "thai25.voicePilot.speaker",
  day: "thai25.voicePilot.day",
  audioSpeedPreference: "thai25.audioSpeedPreference",
  completedLessonIds: "thai25.completedLessonIds",
  deviceSetupSkipped: "thai25.voicePilot.deviceSetupSkipped"
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
  audioMode: localStorage.getItem(STORAGE_KEYS.audioSpeedPreference) || "normal",
  completedIds: parseJsonStorage(STORAGE_KEYS.completedLessonIds, []),
  deviceSetupSkipped: localStorage.getItem(STORAGE_KEYS.deviceSetupSkipped) === "1",
  audio: null,
  lesson: null,
  target: null,
  mediaRecorder: null,
  mediaStream: null,
  audioContext: null,
  audioSource: null,
  audioProcessor: null,
  audioMuteGain: null,
  pcmSampleRate: 48000,
  chunks: [],
  recordedBlob: null,
  playbackUrl: null,
  websocket: null,
  sttReady: false,
  pendingSttChunks: [],
  sttEndPending: false,
  sttError: "",
  attemptRecorded: false,
  recording: false,
  recordStartTimer: null,
  recordTickTimer: null,
  recordStopTimer: null,
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

function parseJsonStorage(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback));
  } catch {
    return fallback;
  }
}

function setStatus(status, message = "") {
  state.status = status;
  if (message) state.auth.message = message;
  render();
}

function readLessonLabel() {
  return `${state.day}일차`;
}

function primaryPhrases() {
  return state.lesson?.newPhrases?.length ? state.lesson.newPhrases : state.lesson?.reviewPhrases || [];
}

function practicePhrases() {
  return state.lesson?.newPhrases?.length ? state.lesson.newPhrases : state.lesson?.reviewPhrases || [];
}

function effectiveDisplayKeywords() {
  if (state.lesson?.displayKeywords?.length) return state.lesson.displayKeywords;
  if (state.lesson?.keywordDisplayPolicy?.emptyCoreFallback === "show_first_three_keywords") {
    return (state.lesson.keywords || []).slice(0, 3);
  }
  return [];
}

function isCompleted() {
  return state.completedIds.includes(state.lesson?.id);
}

function assetUrl(path) {
  if (!path) return "";
  if (/^(https?:|data:|blob:|\/|\.\.\/)/.test(path)) return path;
  return `../${path}`;
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

function currentTargetAudio(mode = "normal") {
  if (!state.target) return "";
  const available = state.target.audio?.[state.speaker] || {};
  return assetUrl(available[mode] || available.normal || "");
}

function targetKey(item) {
  return `${item.phraseId || item.id || item.korean || item.koreanPronunciation}`;
}

function selectedTargetKey() {
  return targetKey(state.target || {});
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
  state.target = practicePhrases()[0] || null;
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

  document.title = `Thai Voice Pilot - ${readLessonLabel()} ${state.lesson.title}`;
  const phrases = primaryPhrases();
  const keywords = effectiveDisplayKeywords();
  app.innerHTML = `
    <header class="pilot-header">
      <div>
        <p class="header-kicker">승인 학습자 전용 · ${escapeHtml(readLessonLabel())}</p>
        <h1>${escapeHtml(state.lesson.title)}</h1>
        <p>${escapeHtml(state.auth.email || state.auth.uid)} · ${escapeHtml(readLessonLabel())}</p>
      </div>
      <button class="ghost-btn" data-action="sign-out">나가기</button>
    </header>

    <main>
      <section class="target-panel lesson-control-panel" aria-labelledby="control-heading">
        <div>
          <p class="section-label">학습 설정</p>
          <h2 id="control-heading">${escapeHtml(state.lesson.theme || state.lesson.title)}</h2>
          <p class="lesson-title">${escapeHtml(state.lesson.hook || "")} ${escapeHtml(state.lesson.story || "")}</p>
        </div>
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
          ${renderSpeakerToggle()}
        </div>
      </section>

      ${renderDeviceSetupPanel()}

      ${renderScene()}

      <section class="target-panel lesson-section" aria-labelledby="sentence-heading">
        <div class="section-heading">
          <div>
            <p class="section-label">오늘의 문장</p>
            <h2 id="sentence-heading">듣고 익히기</h2>
          </div>
          <span>${escapeHtml(state.speaker === "female" ? "여성 발화" : "남성 발화")}</span>
        </div>
        <div class="phrase-list">
          ${phrases.map((phrase, index) => renderPhraseCard(phrase, index)).join("")}
        </div>
        <div id="audio-status" class="audio-status" role="status">오디오 버튼을 누르면 재생 상태가 여기에 표시됩니다.</div>
      </section>

      ${renderReviewList()}

      <section class="target-panel lesson-section" aria-labelledby="keyword-heading">
        <div class="section-heading">
          <div>
            <p class="section-label">핵심 단어</p>
            <h2 id="keyword-heading">단어 듣기</h2>
          </div>
          <span>${keywords.length}개</span>
        </div>
        <div class="keyword-list">
          ${keywords.map(renderKeyword).join("")}
        </div>
      </section>

      <section class="target-panel guide-panel" aria-labelledby="guide-heading">
        <p class="section-label">선교 현장 가이드</p>
        <h2 id="guide-heading">현장 적용</h2>
        <p>${escapeHtml(state.lesson.ministryGuide || "")}</p>
      </section>

      ${renderSupplementLinks()}

      <section class="target-panel practice-mission-panel" aria-labelledby="mission-heading">
        <p class="section-label">말하기 미션</p>
        <h2 id="mission-heading">오늘의 실천</h2>
        <p>${escapeHtml(state.lesson.speakingMission || "")}</p>
      </section>

      ${renderPracticeTargetPanel()}

      ${state.auth.admin ? renderAdminPanel() : ""}

      <section class="target-panel progress-panel" aria-labelledby="progress-heading">
        <p class="section-label">오늘 학습 완료</p>
        <h2 id="progress-heading">${isCompleted() ? "완료됨" : "진행 중"}</h2>
        <p>${isCompleted() ? `${escapeHtml(readLessonLabel())} 학습 완료가 저장되었습니다.` : "문장 오디오를 듣고 바로 따라 말한 뒤 완료를 눌러 주세요."}</p>
        <button class="complete-btn" data-action="complete">${isCompleted() ? "완료 상태 유지하기" : `${escapeHtml(readLessonLabel())} 완료하기`}</button>
        <button class="plain-btn" data-action="reset-progress">진도 초기화</button>
      </section>
    </main>
  `;
  bindPilotEvents();
}

function renderSpeakerToggle() {
  return `
    <div class="speaker-toggle" aria-label="발화 선택">
      <button data-speaker="female" aria-pressed="${state.speaker === "female"}">여성</button>
      <button data-speaker="male" aria-pressed="${state.speaker === "male"}">남성</button>
    </div>
  `;
}

function renderScene() {
  const localPlan = state.lesson.primaryImage?.sourcePlan?.find((item) => item.type === "local_preferred");
  const path = localPlan?.status === "ready" ? assetUrl(localPlan.assetPath) : "";
  if (path) {
    return `
      <figure class="scene-frame has-image">
        <img src="${escapeHtml(path)}" alt="${escapeHtml(state.lesson.primaryImage?.altTextKo || state.lesson.title)}" />
      </figure>
    `;
  }
  return `
    <div class="scene-frame" role="img" aria-label="${escapeHtml(state.lesson.primaryImage?.altTextKo || state.lesson.title)}">
      <span>장면 이미지 준비 중</span>
      <p>${escapeHtml(state.lesson.primaryImage?.altTextKo || state.lesson.story || "")}</p>
    </div>
  `;
}

function renderPhraseCard(phrase, index) {
  const speech = getSpeech(phrase);
  return `
    <article class="phrase-card">
      <div class="phrase-heading">
        <span>${escapeHtml(`문장 ${index + 1}`)}</span>
      </div>
      <p class="thai-text" lang="th">${escapeHtml(speech.thai)}</p>
      <p class="korean-pronunciation">${escapeHtml(speech.korean_pronunciation || speech.koreanPronunciation)}</p>
      <p class="romanization">${escapeHtml(speech.romanization)}</p>
      <p class="korean-meaning">${escapeHtml(phrase.korean || "")}</p>
      ${renderSentenceAudio(phrase, index + 1)}
    </article>
  `;
}

function renderReviewList() {
  const reviews = state.lesson.reviewPhrases || [];
  if (!reviews.length || state.lesson.newPhrases?.length === 0) return "";
  return `
    <section class="target-panel lesson-section" aria-labelledby="review-heading">
      <div class="section-heading">
        <div>
          <p class="section-label">복습 문장</p>
          <h2 id="review-heading">다시 듣기</h2>
        </div>
        <span>${reviews.length}개</span>
      </div>
      <div class="phrase-list">
        ${reviews.map((phrase, index) => renderPhraseCard(phrase, index + 1)).join("")}
      </div>
    </section>
  `;
}

function renderSentenceAudio(phrase, phraseIndex = 1) {
  const available = phrase.audio?.[state.speaker] || {};
  return `
    <div class="audio-toolbar" aria-label="문장 오디오">
      ${["normal", "slow", "repeat3"]
        .map((mode) => {
          const path = assetUrl(available[mode]);
          return `
            <button class="audio-btn ${mode === "repeat3" ? "secondary" : ""}"
              data-audio="${escapeHtml(path)}"
              data-mode="${mode}"
              data-audio-label="문장 ${phraseIndex} ${modeLabel(mode)}"
              aria-pressed="${state.audioMode === mode}"
              ${path ? "" : "disabled"}>
              ${playIconSvg()} ${modeLabel(mode)}
            </button>
          `;
        })
        .join("")}
    </div>
  `;
}

function renderKeyword(keyword, index) {
  const speakerAudio = keyword.audio?.[state.speaker] || keyword.audio?.female || keyword.audio?.male || {};
  return `
    <article class="keyword-item">
      <div class="keyword-main">
        <span class="keyword-pronunciation">${escapeHtml(keyword.koreanPronunciation)}</span>
        <span class="keyword-meaning">${escapeHtml(keyword.korean)}</span>
        <span class="keyword-meta">${escapeHtml(keyword.romanization)}</span>
      </div>
      <div class="keyword-audio" aria-label="${escapeHtml(keyword.korean)} 단어 오디오">
        ${["normal", "slow"]
          .map((mode) => {
            const path = assetUrl(speakerAudio[mode]);
            return `
              <button class="audio-btn secondary"
                data-audio="${escapeHtml(path)}"
                data-mode="${mode}"
                data-audio-label="${escapeHtml(keyword.koreanPronunciation)} ${modeLabel(mode)}"
                ${path ? "" : "disabled"}>
                ${playIconSvg()} ${modeLabel(mode)}
              </button>
            `;
          })
          .join("")}
      </div>
    </article>
  `;
}

function renderSupplementLinks() {
  const links = state.lesson.supplementLinks || [];
  if (!links.length) return "";
  return `
    <section class="target-panel lesson-section" aria-labelledby="supplement-heading">
      <p class="section-label">보조 자료</p>
      <h2 id="supplement-heading">함께 보기</h2>
      <div class="supplement-links">
        ${links.map((link) => `<a href="../?aid=${escapeHtml(link.aid)}">${escapeHtml(link.label || link.title || "학습보조")}</a>`).join("")}
      </div>
    </section>
  `;
}

function renderPracticeTargetPanel() {
  if (!state.target) {
    return `
      <section class="target-panel current-practice-panel" aria-labelledby="target-heading">
        <p class="section-label">듣고 바로 따라하기 대상</p>
        <h2 id="target-heading">오늘 연습할 문장이 없습니다</h2>
      </section>
    `;
  }
  const speech = getSpeech(state.target);
  const targets = practicePhrases();
  const canStart = Boolean(state.target) && !state.recording && state.status !== "listening" && state.status !== "analyzing";
  return `
    <section class="target-panel current-practice-panel" aria-labelledby="target-heading">
      <p class="section-label">듣고 바로 따라하기 대상</p>
      <div class="practice-target-tabs" aria-label="따라 말하기 문장 선택">
        ${targets
          .map((phrase, index) => `
            <button class="practice-target-tab" data-action="select-target" data-target-type="phrase" data-target-index="${index}" aria-pressed="${selectedTargetKey() === targetKey(phrase)}">
              문장 ${index + 1}
            </button>
          `)
          .join("")}
      </div>
      <button class="practice-target-card" data-action="listen-practice" ${canStart ? "" : "disabled"}>
        <span class="practice-card-label">${escapeHtml(practiceCardLabel())}</span>
        <strong id="target-heading">${escapeHtml(state.target.korean || state.target.koreanPronunciation)}</strong>
        <span class="thai-text compact-thai" lang="th">${escapeHtml(speech.thai)}</span>
        <span class="korean-pronunciation">${escapeHtml(speech.korean_pronunciation || speech.koreanPronunciation)}</span>
        <span class="romanization">${escapeHtml(speech.romanization)}</span>
      </button>
      <p class="record-copy">${escapeHtml(recordCopy())}</p>
      <div class="record-meter" data-state="${state.status}">
        <span class="mic-icon" aria-hidden="true">${micIconSvg()}</span>
        <strong>${state.recording ? state.countdown : "4"}</strong>
        <small>${escapeHtml(recordHeading())}</small>
      </div>
      ${state.recordedBlob && !state.recording ? `<button class="replay-btn" data-action="replay">내 목소리 다시 듣기</button>` : ""}
      ${renderPracticeResult()}
    </section>
  `;
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

function renderDeviceSetupPanel() {
  if (DEMO_MODE || state.device.registered || state.deviceSetupSkipped) return "";
  return `
    <section class="device-panel" aria-labelledby="device-heading">
      <div>
        <p class="section-label">선택 설정</p>
        <h2 id="device-heading">iPhone 음성 연습 등록</h2>
        <p class="device-copy">녹음과 음성인식 연습을 사용할 학습자만 이 iPhone을 등록합니다. 일반 학습은 건너뛰어도 계속 볼 수 있습니다.</p>
        ${state.device.message ? `<p class="device-message">${escapeHtml(state.device.message)}</p>` : ""}
      </div>
      <div class="device-actions">
        <button class="device-btn primary" data-action="register-device" ${state.device.busy ? "disabled" : ""}>
          이 iPhone 등록하기
        </button>
        <button class="device-btn" data-action="skip-device-setup" ${state.device.busy ? "disabled" : ""}>
          건너뛰고 학습하기
        </button>
      </div>
    </section>
  `;
}

function recordHeading() {
  if (state.status === "listening") return "문장 듣는 중";
  if (state.recording) return "말씀해 주세요";
  if (state.status === "analyzing") return "내 목소리를 들으며 분석 중";
  if (state.status === "error") return "인식 오류";
  if (state.status === "done") return "녹음과 분석 완료";
  return "준비";
}

function recordCopy() {
  if (state.status === "listening") return "문장 오디오가 끝나면 자동으로 녹음이 시작됩니다. 준비하고 있다가 바로 따라 말하세요.";
  if (state.recording) return "4초 안에 한 번만 또렷하게 말합니다.";
  if (state.status === "analyzing") return "내 목소리를 자동으로 들려주는 동안 인식 결과를 확인합니다.";
  if (state.status === "error") return "서버 인식 오류입니다. 잠시 후 학습대상 문장을 다시 터치해 주세요.";
  if (state.status === "done") return "필요하면 내 목소리를 다시 듣고, 학습대상 문장을 터치해 한 번 더 연습하세요.";
  if (!state.device.registered) return "학습대상 문장을 듣는 것은 가능하지만, 녹음 평가는 iPhone 음성 연습 등록 후 사용할 수 있습니다.";
  if (!state.device.verified) return "학습대상 문장을 터치하면 필요한 iPhone 확인 후 듣고 바로 따라 말하기가 시작됩니다.";
  return "학습대상 문장을 터치하면 먼저 문장이 재생되고, 끝나자마자 4초 녹음이 자동으로 시작됩니다.";
}

function practiceCardLabel() {
  if (state.status === "listening") return "재생 중 · 끝나면 자동 녹음";
  if (state.recording) return "녹음 중 · 지금 따라 말하세요";
  if (state.status === "analyzing") return "분석 중";
  if (state.status === "error") return "인식 오류 · 다시 터치해서 재시도";
  if (state.status === "done") return "다시 연습하려면 문장을 터치";
  return "학습대상 문장 · 터치해서 듣고 바로 따라 말하기";
}

function renderPracticeResult() {
  return `
    <div class="practice-result" data-state="${state.status}">
      <div class="result-head">
        <div>
          <p class="section-label">인식 결과</p>
          <h2 id="result-heading">${resultTitle()}</h2>
        </div>
        <strong>${state.score === null ? "--" : `${state.score}점`}</strong>
      </div>
      <p class="transcript" lang="th">${escapeHtml(state.transcript || state.interimTranscript || "아직 인식 결과가 없습니다.")}</p>
      <p class="result-note">${escapeHtml(resultNote())}</p>
    </div>
  `;
}

function resultTitle() {
  if (state.status === "listening") return "듣는 중";
  if (state.status === "recording") return "녹음 중";
  if (state.status === "analyzing") return "분석 중";
  if (state.status === "error") return "오류";
  if (state.status === "done") return "확인 완료";
  return "대기 중";
}

function resultNote() {
  if (state.sttError) return `인식 점검: ${state.sttError}`;
  if (state.status === "listening") return "문장 재생이 끝나면 마이크가 켜지고 시간이 줄어듭니다.";
  if (state.status === "recording") return "마이크가 깜빡이는 동안 태국어 문장을 말해 주세요.";
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
  document.querySelector('[data-action="listen-practice"]')?.addEventListener("click", listenThenRecord);
  document.querySelector('[data-action="replay"]')?.addEventListener("click", replayRecording);
  document.querySelectorAll('[data-action="register-device"]').forEach((button) => {
    button.addEventListener("click", registerDevice);
  });
  document.querySelectorAll('[data-action="verify-device"]').forEach((button) => {
    button.addEventListener("click", () => verifyDevice());
  });
  document.querySelectorAll('[data-action="skip-device-setup"]').forEach((button) => {
    button.addEventListener("click", skipDeviceSetup);
  });
  document.querySelectorAll("[data-audio]").forEach((button) => {
    button.addEventListener("click", () => {
      const audioPath = button.dataset.audio;
      const mode = button.dataset.mode;
      const label = button.dataset.audioLabel || modeLabel(mode);
      if (!audioPath) return;
      state.audioMode = mode;
      localStorage.setItem(STORAGE_KEYS.audioSpeedPreference, mode);
      playAudio(audioPath, label);
      renderAudioPressedState(mode, button);
    });
  });
  document.querySelectorAll('[data-action="select-target"]').forEach((button) => {
    button.addEventListener("click", () => {
      const index = Number(button.dataset.targetIndex);
      const source = practicePhrases();
      const target = source[index];
      if (!target) return;
      state.target = target;
      resetRecordingState();
      render();
    });
  });
  document.querySelector('[data-action="complete"]')?.addEventListener("click", () => {
    if (!state.completedIds.includes(state.lesson.id)) {
      state.completedIds = [...state.completedIds, state.lesson.id];
      localStorage.setItem(STORAGE_KEYS.completedLessonIds, JSON.stringify(state.completedIds));
    }
    render();
  });
  document.querySelector('[data-action="reset-progress"]')?.addEventListener("click", () => {
    state.completedIds = state.completedIds.filter((id) => id !== state.lesson.id);
    localStorage.setItem(STORAGE_KEYS.completedLessonIds, JSON.stringify(state.completedIds));
    render();
  });
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

function modeLabel(mode) {
  if (mode === "slow") return "느린 속도";
  if (mode === "repeat3") return "3회 반복";
  return "정상 속도";
}

function playIconSvg() {
  return `<span aria-hidden="true">▶</span>`;
}

function micIconSvg() {
  return `
    <svg viewBox="0 0 24 24" width="34" height="34" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" focusable="false">
      <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"></path>
      <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
      <path d="M12 19v3"></path>
      <path d="M8 22h8"></path>
    </svg>
  `;
}

function renderAudioPressedState(mode, activeButton = null) {
  document.querySelectorAll("[data-mode]").forEach((button) => {
    button.setAttribute("aria-pressed", "false");
  });
  if (activeButton) activeButton.setAttribute("aria-pressed", "true");
  const status = document.getElementById("audio-status");
  if (status) status.dataset.mode = mode;
}

function setAudioStatus(message, tone = "neutral") {
  const status = document.getElementById("audio-status");
  if (!status) return;
  status.textContent = message;
  status.dataset.tone = tone;
}

async function listenThenRecord() {
  if (!state.target) {
    state.auth.message = "오늘 따라 말할 문장을 먼저 확인해 주세요.";
    render();
    return;
  }
  if (!(await ensureDeviceReadyForPractice())) {
    render();
    return;
  }
  if (state.recording || state.status === "listening" || state.status === "analyzing") return;

  if (state.audio) {
    state.audio.pause();
    state.audio.currentTime = 0;
  }
  resetRecordingState();
  if (!(await prepareRecording())) return;

  const audioPath = currentTargetAudio("normal");
  if (!audioPath) {
    state.auth.message = "학습대상 문장 오디오가 없어 바로 녹음을 시작합니다.";
    render();
    beginPreparedRecording();
    return;
  }

  state.status = "listening";
  state.interimTranscript = "문장 오디오가 끝나는 순간 바로 녹음이 시작됩니다.";
  state.audio = new Audio(audioPath);
  let recordingStartedFromAudio = false;
  const startFromAudio = () => {
    if (recordingStartedFromAudio) return;
    recordingStartedFromAudio = true;
    if (state.recordStartTimer) {
      window.clearTimeout(state.recordStartTimer);
      state.recordStartTimer = null;
    }
    beginPreparedRecording();
  };
  state.audio.addEventListener("loadedmetadata", () => {
    if (!Number.isFinite(state.audio.duration) || state.audio.duration <= 0) return;
    const delay = Math.max(0, state.audio.duration * 1000 - RECORD_START_LEAD_MS);
    state.recordStartTimer = window.setTimeout(startFromAudio, delay);
  }, { once: true });
  state.audio.addEventListener("timeupdate", () => {
    if (!state.audio || !Number.isFinite(state.audio.duration)) return;
    if ((state.audio.duration - state.audio.currentTime) * 1000 <= RECORD_START_LEAD_MS) startFromAudio();
  });
  state.audio.addEventListener("ended", () => {
    state.audio = null;
    startFromAudio();
  }, { once: true });
  state.audio.addEventListener("error", () => {
    clearRecordingTimers();
    stopTracks();
    state.status = "idle";
    state.sttError = "문장 오디오를 불러오지 못했습니다.";
    render();
  }, { once: true });
  render();

  try {
    await state.audio.play();
  } catch (error) {
    clearRecordingTimers();
    stopTracks();
    state.status = "idle";
    state.sttError = `문장 오디오 재생 실패: ${error.message}`;
    render();
  }
}

async function ensureDeviceReadyForPractice() {
  if (state.device.verified && state.device.sessionToken) return true;
  if (!state.device.registered) {
    state.device.message = "녹음 평가는 iPhone 음성 연습 등록 후 사용할 수 있습니다.";
    state.auth.message = "문장 듣기는 계속 사용할 수 있습니다. 녹음 평가는 iPhone 음성 연습 등록 후 가능합니다.";
    return false;
  }
  state.device.message = "음성 연습을 시작하기 위해 등록된 iPhone을 확인합니다.";
  return verifyDevice({ inline: true });
}

function playAudio(src, label) {
  if (state.audio) {
    state.audio.pause();
    state.audio.currentTime = 0;
  }
  state.audio = new Audio(src);
  setAudioStatus(`${label} 오디오를 준비하고 있습니다.`, "neutral");
  state.audio.addEventListener("playing", () => {
    setAudioStatus(`${label} 오디오가 재생 중입니다.`, "playing");
  });
  state.audio.addEventListener("ended", () => {
    setAudioStatus(`${label} 오디오 재생이 끝났습니다.`, "done");
  });
  state.audio.addEventListener("error", () => {
    setAudioStatus(`${label} 오디오를 불러오지 못했습니다.`, "error");
  });
  state.audio.play().catch(() => {
    setAudioStatus("브라우저가 오디오 재생을 막았습니다. 버튼을 다시 직접 눌러 주세요.", "error");
  });
}

function resetRecordingState() {
  clearRecordingTimers();
  if (state.playbackUrl) URL.revokeObjectURL(state.playbackUrl);
  state.recordedBlob = null;
  state.playbackUrl = null;
  state.transcript = "";
  state.interimTranscript = "";
  state.score = null;
  state.sttError = "";
  state.attemptRecorded = false;
  state.status = "idle";
}

function clearRecordingTimers() {
  if (state.recordStartTimer) window.clearTimeout(state.recordStartTimer);
  if (state.recordTickTimer) window.clearInterval(state.recordTickTimer);
  if (state.recordStopTimer) window.clearTimeout(state.recordStopTimer);
  state.recordStartTimer = null;
  state.recordTickTimer = null;
  state.recordStopTimer = null;
}

async function startRecording() {
  resetRecordingState();
  if (await prepareRecording()) beginPreparedRecording();
}

async function prepareRecording() {
  if (!state.target) {
    state.auth.message = "오늘 따라 말할 문장을 먼저 확인해 주세요.";
    render();
    return false;
  }

  if (!state.device.verified || !state.device.sessionToken) {
    state.device.message = "음성 평가를 시작하려면 iPhone 음성 연습 등록이 필요합니다.";
    render();
    return false;
  }

  if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder || !window.AudioContext && !window.webkitAudioContext) {
    state.auth.message = "이 브라우저는 녹음 기능을 지원하지 않습니다.";
    render();
    return false;
  }

  try {
    state.chunks = [];
    state.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mimeType = pickMimeType();
    state.mediaRecorder = new MediaRecorder(state.mediaStream, mimeType ? { mimeType } : undefined);
    preparePcmStream();
    await startPcmStream();
    openSttStream();
    state.mediaRecorder.addEventListener("dataavailable", handleAudioChunk);
    state.mediaRecorder.addEventListener("stop", finishRecording);
    return true;
  } catch (error) {
    stopTracks();
    state.recording = false;
    state.status = "idle";
    state.auth.message = `마이크를 사용할 수 없습니다: ${error.message}`;
    render();
    return false;
  }
}

function beginPreparedRecording() {
  if (state.recording || !state.mediaRecorder || state.mediaRecorder.state !== "inactive") return;
  state.recording = true;
  state.countdown = Math.ceil(MAX_RECORDING_MS / 1000);
  state.status = "recording";
  render();

  state.mediaRecorder.start(180);
  startPcmStream();

  clearRecordingTimers();
  state.recordTickTimer = window.setInterval(() => {
    state.countdown = Math.max(0, state.countdown - 1);
    render();
    if (!state.recording) clearRecordingTimers();
  }, 1000);

  state.recordStopTimer = window.setTimeout(() => {
    if (state.mediaRecorder?.state === "recording") state.mediaRecorder.stop();
  }, MAX_RECORDING_MS);
}

function preparePcmStream() {
  const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
  state.audioContext = new AudioContextCtor();
  state.pcmSampleRate = Math.round(state.audioContext.sampleRate || 48000);
  state.audioSource = state.audioContext.createMediaStreamSource(state.mediaStream);
  state.audioProcessor = state.audioContext.createScriptProcessor(1024, 1, 1);
  state.audioMuteGain = state.audioContext.createGain();
  state.audioMuteGain.gain.value = 0;
  state.audioProcessor.onaudioprocess = (event) => {
    if (!state.recording) return;
    const input = event.inputBuffer.getChannelData(0);
    sendSttAudio(floatTo16BitPcm(input));
  };
  state.audioSource.connect(state.audioProcessor);
  state.audioProcessor.connect(state.audioMuteGain);
  state.audioMuteGain.connect(state.audioContext.destination);
}

async function startPcmStream() {
  if (state.audioContext?.state === "suspended") {
    try {
      await state.audioContext.resume();
    } catch {
      state.sttError = "마이크 오디오 처리를 시작하지 못했습니다.";
    }
  }
}

function floatTo16BitPcm(float32Samples) {
  const buffer = new ArrayBuffer(float32Samples.length * 2);
  const view = new DataView(buffer);
  for (let i = 0; i < float32Samples.length; i += 1) {
    const sample = Math.max(-1, Math.min(1, float32Samples[i]));
    view.setInt16(i * 2, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
  }
  return buffer;
}

function pickMimeType() {
  const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/aac"];
  return candidates.find((type) => MediaRecorder.isTypeSupported(type)) || "";
}

function handleAudioChunk(event) {
  if (!event.data || event.data.size === 0) return;
  state.chunks.push(event.data);
}

function sendSttAudio(chunk) {
  if (!chunk || chunk.byteLength === 0) return;
  if (state.websocket?.readyState === WebSocket.OPEN) {
    if (state.sttReady) {
      state.websocket.send(chunk);
    } else {
      state.pendingSttChunks.push(chunk);
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
        mimeType: "audio/l16",
        audioEncoding: "LINEAR16",
        sampleRateHertz: state.pcmSampleRate
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
        completeAttempt(payload.transcript || "", payload.score);
      }
      if (payload.type === "saved") {
        completeAttempt(payload.transcript || state.transcript || state.interimTranscript || "", payload.score);
      }
      if (payload.type === "no_speech") {
        failAttempt("인식된 태국어가 없습니다. 마이크에 더 가까이 대고 첫 음절부터 또렷하게 말해 주세요.");
      }
      if (payload.type === "error") {
        failAttempt(payload.message || "STT 서버 오류");
      }
      render();
    });
    state.websocket.addEventListener("close", () => {
      if (state.status === "analyzing" && !state.transcript && !state.interimTranscript) {
        failAttempt("STT 연결이 결과 없이 종료되었습니다.");
        render();
      }
    });
  } catch {
    state.interimTranscript = "서버 연결을 준비하지 못했습니다.";
  }
}

async function finishRecording() {
  state.recording = false;
  state.status = "analyzing";
  clearRecordingTimers();
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
      completeAttempt(transcript, scoreTranscript(currentTargetText(), transcript));
      render();
    }, 700);
  } else {
    window.setTimeout(() => {
      if (state.status !== "analyzing") return;
      if (state.sttError) {
        failAttempt(state.sttError);
      } else {
        state.sttError = state.interimTranscript
          ? "최종 결과가 늦어 임시 인식 결과로 점수를 계산했습니다."
          : "정해진 시간 안에 인식 결과가 도착하지 않았습니다.";
        completeAttempt(state.interimTranscript || "", state.interimTranscript ? undefined : 0);
      }
      render();
    }, Number(CONFIG.stt?.resultTimeoutMs || 6500));
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

function completeAttempt(transcript, score) {
  const finalTranscript = transcript || "";
  const finalScore = Number.isFinite(score) ? score : scoreTranscript(currentTargetText(), finalTranscript);
  state.transcript = finalTranscript;
  state.interimTranscript = "";
  state.score = finalScore;
  state.status = "done";
  if (!state.attemptRecorded) {
    saveAttempt(finalTranscript, finalScore);
    state.attemptRecorded = true;
  }
}

function failAttempt(message) {
  state.sttError = message || "STT 서버 오류";
  state.transcript = "";
  state.interimTranscript = "";
  state.score = null;
  state.status = "error";
}

function stopTracks() {
  stopPcmStream();
  state.mediaStream?.getTracks().forEach((track) => track.stop());
  state.mediaStream = null;
}

function stopPcmStream() {
  if (state.audioProcessor) state.audioProcessor.onaudioprocess = null;
  state.audioSource?.disconnect();
  state.audioProcessor?.disconnect();
  state.audioMuteGain?.disconnect();
  if (state.audioContext && state.audioContext.state !== "closed") {
    state.audioContext.close().catch(() => {});
  }
  state.audioContext = null;
  state.audioSource = null;
  state.audioProcessor = null;
  state.audioMuteGain = null;
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
    state.deviceSetupSkipped = false;
    localStorage.removeItem(STORAGE_KEYS.deviceSetupSkipped);
    state.device.message = "이 iPhone이 등록되었습니다. 학습 문장을 터치하면 필요한 확인 후 녹음 평가가 시작됩니다.";
  } catch (error) {
    state.device.message = `iPhone 등록 실패: ${error.message}`;
  } finally {
    state.device.busy = false;
    render();
  }
}

async function verifyDevice(options = {}) {
  if (!window.PublicKeyCredential) {
    state.device.message = "이 브라우저는 passkey/WebAuthn을 지원하지 않습니다.";
    if (!options.inline) render();
    return false;
  }
  state.device.busy = true;
  state.device.message = "등록된 iPhone인지 확인하고 있습니다.";
  if (!options.inline) render();
  try {
    const authOptions = await apiRequest("/webauthn/auth/options");
    const credential = await navigator.credentials.get({ publicKey: publicKeyRequestOptions(authOptions) });
    const result = await apiRequest("/webauthn/auth/verify", {
      credential: publicKeyCredentialToJSON(credential)
    });
    state.device.verified = Boolean(result.verified);
    state.device.sessionToken = result.pilotSessionToken || null;
    state.device.message = state.device.verified ? "확인 완료. 이제 녹음할 수 있습니다." : "iPhone 확인에 실패했습니다.";
    return state.device.verified && Boolean(state.device.sessionToken);
  } catch (error) {
    state.device.verified = false;
    state.device.sessionToken = null;
    state.device.message = `iPhone 확인 실패: ${error.message}`;
    return false;
  } finally {
    state.device.busy = false;
    if (!options.inline) render();
  }
}

function skipDeviceSetup() {
  state.deviceSetupSkipped = true;
  localStorage.setItem(STORAGE_KEYS.deviceSetupSkipped, "1");
  state.device.message = "";
  render();
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
