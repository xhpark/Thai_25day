const TOTAL_DAYS = 25;
const STORAGE_KEYS = {
  schemaVersion: "thai25.schemaVersion",
  currentDay: "thai25.currentDay",
  completedLessonIds: "thai25.completedLessonIds",
  lastOpenedLessonId: "thai25.lastOpenedLessonId",
  speakerPreference: "thai25.speakerPreference",
  audioSpeedPreference: "thai25.audioSpeedPreference",
  showSupplementalKeywords: "thai25.showSupplementalKeywords",
  reviewAnonId: "thai25.reviewAnonId"
};

const REVIEW_VOICE_CONFIG = {
  apiBaseUrl: "https://thai25-voice-server-527401030399.asia-northeast3.run.app",
  websocketUrl: "wss://thai25-voice-server-527401030399.asia-northeast3.run.app/ws/stt",
  maxRecordingMs: 4000,
  resultTimeoutMs: 6500,
  recordStartLeadMs: 90
};

const state = {
  spec: null,
  speaker: "female",
  audioMode: "normal",
  completedIds: [],
  audio: null,
  storageAvailable: true,
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
  reviewSessionToken: null,
  recording: false,
  recordStartTimer: null,
  recordTickTimer: null,
  recordStopTimer: null,
  countdown: 4,
  practiceStatus: "idle",
  transcript: "",
  interimTranscript: "",
  score: null,
  sttError: "",
  attemptRecorded: false,
  practiceResults: {}
};

function requestedDay() {
  const params = new URLSearchParams(window.location.search);
  const day = Number(params.get("day") || 1);
  return Number.isInteger(day) && day >= 1 && day <= TOTAL_DAYS ? day : 1;
}

function requestedAid() {
  const params = new URLSearchParams(window.location.search);
  return params.get("aid");
}

function requestedPreview() {
  const params = new URLSearchParams(window.location.search);
  return params.get("preview");
}

function requestedDateReview() {
  const params = new URLSearchParams(window.location.search);
  return params.get("date");
}

function specUrlForDay(day) {
  const week = Math.ceil(day / 5);
  return `assets/generated/pwa/w${week}d${day}.json`;
}

function specUrlForDateReview(date) {
  return {
    "2026-07-04": "assets/generated/pwa/review_2026_07_04.json",
    "2026-07-05": "assets/generated/pwa/review_2026_07_05.json",
    "2026-07-11": "assets/generated/pwa/review_2026_07_11.json",
    "2026-07-12": "assets/generated/pwa/review_2026_07_12.json",
    "2026-07-18": "assets/generated/pwa/review_2026_07_18.json",
    "2026-07-19": "assets/generated/pwa/review_2026_07_19.json",
    "2026-07-25": "assets/generated/pwa/review_2026_07_25.json",
    "2026-07-26": "assets/generated/pwa/review_2026_07_26.json",
    "2026-08-01": "assets/generated/pwa/review_2026_08_01.json"
  }[date] || null;
}

function specUrlForPreview(preview) {
  return {
    "d-2": "assets/generated/pwa/preview_d_minus_2.json",
    "d-1": "assets/generated/pwa/preview_d_minus_1.json"
  }[preview] || null;
}

function specUrlForAid(aid) {
  return aid === "1" ? "assets/generated/pwa/aid1_numbers.json" : null;
}

function readStorage(key, fallback) {
  try {
    const value = window.localStorage.getItem(key);
    return value === null ? fallback : value;
  } catch {
    state.storageAvailable = false;
    return fallback;
  }
}

function writeStorage(key, value) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    state.storageAvailable = false;
  }
}

function parseJsonStorage(key, fallback) {
  try {
    return JSON.parse(readStorage(key, JSON.stringify(fallback)));
  } catch {
    return fallback;
  }
}

function initState(spec) {
  const savedSpeaker = readStorage(STORAGE_KEYS.speakerPreference, "female");
  const savedMode = readStorage(STORAGE_KEYS.audioSpeedPreference, "normal");

  state.spec = spec;
  state.speaker = ["male", "female"].includes(savedSpeaker) ? savedSpeaker : "female";
  state.audioMode = ["normal", "slow", "repeat3"].includes(savedMode) ? savedMode : "normal";
  state.completedIds = parseJsonStorage(STORAGE_KEYS.completedLessonIds, []);

  writeStorage(STORAGE_KEYS.schemaVersion, String(spec.statePolicy?.schemaVersion || 1));
  writeStorage(STORAGE_KEYS.currentDay, String(spec.day));
  writeStorage(STORAGE_KEYS.lastOpenedLessonId, spec.id);
}

function initSupplementState(spec) {
  const savedSpeaker = readStorage(STORAGE_KEYS.speakerPreference, "female");
  const savedMode = readStorage(STORAGE_KEYS.audioSpeedPreference, "normal");

  state.spec = spec;
  state.speaker = ["male", "female"].includes(savedSpeaker) ? savedSpeaker : "female";
  state.audioMode = ["normal", "slow"].includes(savedMode) ? savedMode : "normal";
  state.completedIds = parseJsonStorage(STORAGE_KEYS.completedLessonIds, []);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function playIconSvg() {
  return `
    <svg class="play-icon" viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      <path d="M6 4.5v11l9-5.5-9-5.5z" fill="currentColor"></path>
    </svg>
  `;
}

function micIconSvg() {
  return `
    <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" focusable="false">
      <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"></path>
      <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
      <path d="M12 19v3"></path>
      <path d="M8 22h8"></path>
    </svg>
  `;
}

function modeLabel(mode) {
  return {
    normal: "보통",
    slow: "느리게",
    repeat3: "3회"
  }[mode] || mode;
}

function speakerLabel(speaker) {
  return speaker === "male" ? "남성" : "여성";
}

function primaryPhrases() {
  return state.spec.newPhrases?.length ? state.spec.newPhrases : state.spec.reviewPhrases || [];
}

function isReviewOnlyLesson() {
  return !state.spec.newPhrases?.length && Boolean(state.spec.reviewPhrases?.length);
}

function isPronunciationReviewLesson() {
  return Boolean(state.spec.pronunciationAssessment && state.spec.sentenceOnly && state.spec.reviewPhrases?.length);
}

function getSpeech(phrase) {
  return phrase.speech?.[state.speaker] || phrase.speech?.female || phrase.speech?.male || {};
}

function targetKey(phrase) {
  return String(phrase.variantId || phrase.phraseId || phrase.id || phrase.korean || phrase.english || "");
}

function groupedPhraseItems(phrases) {
  const pairIds = state.spec.phrasePairIds || [];
  if (!pairIds.length) return phrases.map((phrase) => ({ type: "single", phrases: [phrase] }));

  const groups = [];
  const consumed = new Set();
  for (let index = 0; index < phrases.length; index += 1) {
    const phrase = phrases[index];
    const key = targetKey(phrase);
    if (consumed.has(key)) continue;
    const pair = pairIds.find((ids) => ids[0] === key);
    if (pair) {
      const pairPhrases = pair.map((id) => phrases.find((candidate) => targetKey(candidate) === id)).filter(Boolean);
      pairPhrases.forEach((item) => consumed.add(targetKey(item)));
      groups.push({ type: "pair", pairIds: pair, phrases: pairPhrases });
      continue;
    }
    consumed.add(key);
    groups.push({ type: "single", phrases: [phrase] });
  }
  return groups;
}

function isCompleted() {
  return state.completedIds.includes(state.spec.id);
}

function lessonLabel(spec = state.spec) {
  return spec.displayDayLabel || `${spec.day}일차`;
}

function effectiveDisplayKeywords(spec) {
  if (spec.sentenceOnly) return [];
  if (spec.displayKeywords?.length) return spec.displayKeywords;
  if (spec.keywordDisplayPolicy?.emptyCoreFallback === "show_first_three_keywords") {
    return (spec.keywords || []).slice(0, 3);
  }
  return spec.displayKeywords || [];
}

function render() {
  const spec = state.spec;
  const completed = isCompleted();
  const phrases = primaryPhrases();
  const phraseGroups = groupedPhraseItems(phrases);
  const keywords = effectiveDisplayKeywords(spec);
  const sentenceHeading = isReviewOnlyLesson() ? "오늘의 복습 문장" : "오늘의 문장";
  document.title = `Thai 25 Day - ${lessonLabel(spec)}`;

  document.getElementById("app").innerHTML = `
    <header class="topbar">
      <div class="brand">
        <div class="brand-mark" aria-hidden="true">${escapeHtml(spec.displayDayLabel || spec.day)}</div>
        <div>
          <p class="brand-title">Thai 25 Day</p>
          <p class="brand-subtitle">${escapeHtml(spec.theme)}</p>
        </div>
      </div>
      <div class="status-pill">${completed ? "완료됨" : "진행 중"}</div>
    </header>

    ${renderDayNav(spec)}

    <main>
      <section class="hero" aria-labelledby="lesson-title">
        <div>
          <p class="eyebrow">${escapeHtml(lessonLabel(spec))}</p>
          <h1 id="lesson-title">${escapeHtml(lessonLabel(spec))} ${escapeHtml(spec.title)}</h1>
          <p class="hero-copy">${escapeHtml(spec.hook)} ${escapeHtml(spec.story)}</p>
        </div>
        ${renderScene(spec)}
      </section>

      <section class="section" aria-labelledby="sentence-heading">
        <div class="section-heading">
          <h2 id="sentence-heading">${sentenceHeading}</h2>
          <p class="section-note">${escapeHtml(speakerLabel(state.speaker))} 발화</p>
        </div>
        ${phraseGroups.map((group, index) => renderPhraseGroup(group, index)).join("")}
        <div id="audio-status" class="audio-status" role="status">오디오 버튼을 누르면 재생 상태가 여기에 표시됩니다.</div>
        ${renderReviewList()}
      </section>

      ${keywords.length ? `
        <section class="section" aria-labelledby="keyword-heading">
          <div class="section-heading">
            <h2 id="keyword-heading">주요 단어</h2>
            <p class="section-note">핵심 ${keywords.length}개</p>
          </div>
          <div class="keyword-list">
            ${keywords.map(renderKeyword).join("")}
          </div>
        </section>
      ` : ""}

      <section class="section" aria-labelledby="guide-heading">
        <div class="section-heading">
          <h2 id="guide-heading">선교 현장 가이드</h2>
        </div>
        <div class="guide-panel">
          <p>${escapeHtml(spec.ministryGuide)}</p>
        </div>
      </section>

      ${renderSupplementLinks(spec)}

      <section class="section" aria-labelledby="practice-heading">
        <div class="section-heading">
          <h2 id="practice-heading">말하기 미션</h2>
        </div>
        <div class="practice-panel">
          <p>${escapeHtml(spec.speakingMission)}</p>
        </div>
      </section>

      <section class="section progress-panel" aria-labelledby="progress-heading">
        <h2 id="progress-heading">오늘 학습 완료</h2>
        <p>${completed ? `<span class="done-message">${escapeHtml(lessonLabel(spec))}를 완료했습니다.</span>` : "문장 오디오를 듣고 직접 말한 뒤 완료를 눌러 주세요."}</p>
        <button class="complete-btn" data-action="complete">${completed ? "완료 상태 유지하기" : `${escapeHtml(lessonLabel(spec))} 완료하기`}</button>
        <button class="plain-btn" data-action="reset">진도 초기화</button>
      </section>
    </main>
  `;

  bindEvents();
}

function renderDayNav(spec) {
  if (spec.previewNavLinks?.length) {
    return `
      <nav class="day-nav preview-nav" aria-label="정식 학습 전 미리보기 선택">
        ${spec.previewNavLinks
          .map(
            (link) => `
              <a class="day-nav-link ${link.active ? "active" : ""}" href="${escapeHtml(link.href)}" ${link.active ? 'aria-current="page"' : ""}>
                ${escapeHtml(link.label)}
              </a>
            `
          )
          .join("")}
      </nav>
    `;
  }
  const startDay = (spec.week - 1) * 5 + 1;
  const days = Array.from({ length: 5 }, (_, index) => startDay + index);
  return `
    <nav class="day-nav" aria-label="${spec.week}주차 일차 선택">
      ${days
        .map((day) => `
          <a class="day-nav-link ${day === spec.day ? "active" : ""}" href="?day=${day}" ${day === spec.day ? 'aria-current="page"' : ""}>
            ${day}일
          </a>
        `)
        .join("")}
    </nav>
  `;
}

function renderPhraseGroup(group, index) {
  if (group.type === "pair") {
    return renderPhrasePairCard(group.phrases, index);
  }
  return renderPhraseCard(group.phrases[0], index);
}

function renderPhrasePairCard(phrases, index) {
  const label = `복습 문장 ${index + 1} · 질문/대답`;
  return `
    <article class="phrase-card phrase-pair-card">
      <div class="phrase-topline">
        <div>
          <p class="phrase-label">${label}</p>
          <p class="meaning">몇 살이니? / 저는 ~살입니다</p>
          <p class="english">How old are you? / I am ~ years old.</p>
        </div>
        ${index === 0 ? renderSpeakerToggle() : ""}
      </div>
      <div class="phrase-pair-grid">
        ${phrases
          .map((phrase, pairIndex) => `
            <div class="phrase-pair-item">
              <span class="pair-role">${pairIndex === 0 ? "질문" : "대답"}</span>
              ${renderPhraseBody(phrase)}
              ${renderSentenceAudio(phrase, `${index + 1}-${pairIndex + 1}`)}
              ${renderPronunciationPractice(phrase)}
            </div>
          `)
          .join("")}
      </div>
    </article>
  `;
}

function renderPhraseBody(phrase) {
  const speech = getSpeech(phrase);
  return `
    <p class="thai-text" lang="th">${escapeHtml(speech.thai)}</p>
    <p class="korean-pronunciation" aria-label="한국식 발음">${escapeHtml(speech.korean_pronunciation)}</p>
    <p class="romanization">${escapeHtml(speech.romanization)}</p>
    <p class="pair-meaning">${escapeHtml(phrase.korean || "")}</p>
  `;
}

function renderPhraseCard(phrase, index) {
  const label = isReviewOnlyLesson() ? `복습 문장 ${index + 1}` : `오늘의 문장 ${index + 1}`;
  return `
    <article class="phrase-card">
      <div class="phrase-topline">
        <div>
          <p class="phrase-label">${label}</p>
          <p class="meaning">${escapeHtml(phrase.korean)}</p>
          <p class="english">${escapeHtml(phrase.english)}</p>
        </div>
        ${index === 0 ? renderSpeakerToggle() : ""}
      </div>
      ${renderPhraseBody(phrase)}
      ${renderSentenceAudio(phrase, index + 1)}
      ${renderPronunciationPractice(phrase)}
    </article>
  `;
}

function renderReviewList() {
  if (isPronunciationReviewLesson()) return "";
  const phrases = isReviewOnlyLesson() ? primaryPhrases().slice(1) : state.spec.reviewPhrases || [];
  if (!phrases.length) return "";
  return `
    <div class="review-list" aria-label="복습 문장">
      <p class="review-list-title">복습 문장</p>
      ${phrases
        .map((phrase) => {
          const speech = phrase.speech[state.speaker] || phrase.speech.female || phrase.speech.male;
          return `
            <article class="review-item">
              <span class="review-meaning">${escapeHtml(phrase.korean)}</span>
              <span class="review-pronunciation">${escapeHtml(speech.korean_pronunciation)}</span>
            </article>
          `;
        })
        .join("")}
    </div>
  `;
}

function renderPronunciationPractice(phrase) {
  if (!isPronunciationReviewLesson()) return "";
  const key = targetKey(phrase);
  const active = state.target && targetKey(state.target) === key;
  const result = state.practiceResults[key];
  const status = active ? state.practiceStatus : result?.status || "idle";
  const transcript = active ? state.transcript || state.interimTranscript : result?.transcript || "";
  const score = active ? state.score : result?.score;
  const error = active ? state.sttError : result?.error || "";
  const disabled = state.recording || state.practiceStatus === "listening" || state.practiceStatus === "analyzing";
  return `
    <div class="pronunciation-practice" data-state="${escapeHtml(status)}">
      <button class="practice-start-btn" data-action="review-practice" data-target-key="${escapeHtml(key)}" ${disabled && !active ? "disabled" : ""}>
        <span class="practice-mic" aria-hidden="true">${micIconSvg()}</span>
        <span>
          <strong>${escapeHtml(practiceButtonLabel(active, status))}</strong>
          <small>${escapeHtml(practiceButtonCopy(active, status))}</small>
        </span>
      </button>
      <div class="record-meter" data-state="${escapeHtml(status)}">
        <span class="mic-icon" aria-hidden="true">${micIconSvg()}</span>
        <strong>${active && state.recording ? state.countdown : "4"}</strong>
        <small>${escapeHtml(recordHeading(active, status))}</small>
      </div>
      ${active && state.recordedBlob && !state.recording ? `<button class="replay-btn" data-action="review-replay">내 목소리 다시 듣기</button>` : ""}
      <div class="practice-result" data-state="${escapeHtml(status)}">
        <div class="result-head">
          <span>유사도</span>
          <strong>${Number.isFinite(score) ? `${score}점` : "--"}</strong>
        </div>
        <p class="transcript" lang="th">${escapeHtml(transcript || "아직 인식 결과가 없습니다.")}</p>
        <p class="result-note">${escapeHtml(error ? `인식 점검: ${error}` : resultNote(active, status))}</p>
      </div>
    </div>
  `;
}

function practiceButtonLabel(active, status) {
  if (active && status === "listening") return "재생 중 · 끝나면 자동 녹음";
  if (active && status === "recording") return "녹음 중 · 지금 따라 말하세요";
  if (active && status === "analyzing") return "분석 중";
  if (status === "done") return "다시 듣고 따라 말하기";
  if (status === "error") return "다시 시도하기";
  return "듣고 바로 따라 말하기";
}

function practiceButtonCopy(active, status) {
  if (active && status === "listening") return "오디오가 끝나기 직전 마이크를 준비합니다.";
  if (active && status === "recording") return "4초 안에 한 번만 또렷하게 말합니다.";
  if (active && status === "analyzing") return "내 목소리를 들으며 결과를 확인합니다.";
  return "문장 재생 후 자동으로 녹음합니다.";
}

function recordHeading(active, status) {
  if (active && status === "listening") return "문장 듣는 중";
  if (active && status === "recording") return "말씀해 주세요";
  if (active && status === "analyzing") return "분석 중";
  if (status === "done") return "완료";
  if (status === "error") return "오류";
  return "대기";
}

function resultNote(active, status) {
  if (active && status === "listening") return "재생이 끝나면 바로 말할 준비를 해 주세요.";
  if (active && status === "recording") return "마이크가 깜박이는 동안 태국어 문장을 말해 주세요.";
  if (active && status === "analyzing") return "점수와 transcript만 저장하고 오디오 원본은 저장하지 않습니다.";
  if (status === "done") return "점수와 transcript가 익명 저장되었습니다.";
  return "Google STT가 알아들은 태국어와 목표 문장의 유사도로 계산합니다.";
}

function renderSupplementLinks(spec) {
  const links = spec.supplementLinks || [];
  if (!links.length) return "";
  return `
    <section class="section" aria-labelledby="supplement-heading">
      <div class="section-heading">
        <h2 id="supplement-heading">보조 학습</h2>
      </div>
      <div class="supplement-panel">
        ${links
          .map(
            (link) => `
              <a class="supplement-link" href="${escapeHtml(link.href)}">
                <span class="supplement-link-title">${escapeHtml(link.title)}</span>
                <span class="supplement-link-copy">${escapeHtml(link.description)}</span>
              </a>
            `
          )
          .join("")}
      </div>
    </section>
  `;
}

function renderScene(spec) {
  const localPlan = spec.primaryImage?.sourcePlan?.find((item) => item.type === "local_preferred");
  const path = localPlan?.assetPath;

  if (path && localPlan.status === "ready") {
    return `
      <figure class="scene-frame has-image">
        <img src="${escapeHtml(path)}" alt="${escapeHtml(spec.primaryImage.altTextKo)}" />
      </figure>
    `;
  }

  return `
    <div class="scene-frame" role="img" aria-label="${escapeHtml(spec.primaryImage.altTextKo)}">
      <div class="scene-placeholder">
        <span class="scene-badge">장면 이미지 준비 중</span>
        <p class="scene-text">${escapeHtml(spec.primaryImage.altTextKo)}</p>
      </div>
    </div>
  `;
}

function renderSpeakerToggle() {
  return `
    <div class="speaker-toggle" aria-label="남녀 발화 선택">
      <button class="toggle-btn" data-speaker="female" aria-pressed="${state.speaker === "female"}">여성</button>
      <button class="toggle-btn" data-speaker="male" aria-pressed="${state.speaker === "male"}">남성</button>
    </div>
  `;
}

function renderSentenceAudio(phrase, phraseIndex = 1) {
  const available = phrase.audio[state.speaker] || {};
  return `
    <div class="audio-toolbar" aria-label="문장 오디오">
      ${["normal", "slow", "repeat3"]
        .map((mode) => {
          const path = available[mode];
          return `
            <button class="audio-btn ${mode === "repeat3" ? "secondary" : ""}"
              data-audio="${escapeHtml(path || "")}"
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

function renderKeyword(keyword) {
  const speakerAudio = keyword.audio?.[state.speaker] || keyword.audio?.female || keyword.audio?.male || {};
  return `
    <article class="keyword-item">
      <div class="keyword-main">
        <span class="keyword-pronunciation">${escapeHtml(keyword.koreanPronunciation)}</span>
        <span class="keyword-ko">${escapeHtml(keyword.korean)} · ${escapeHtml(keyword.english)}</span>
        <span class="keyword-meta">${escapeHtml(keyword.romanization)}</span>
      </div>
      <div class="keyword-audio" aria-label="${escapeHtml(keyword.korean)} 단어 오디오">
        ${["normal", "slow"]
          .map((mode) => {
            const path = speakerAudio[mode];
            return `
              <button class="audio-btn secondary"
                data-audio="${escapeHtml(path || "")}"
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

function renderSupplement() {
  const spec = state.spec;
  document.title = `Thai 25 Day - 학습보조${spec.aid}`;
  document.getElementById("app").innerHTML = `
    <header class="topbar">
      <div class="brand">
        <div class="brand-mark" aria-hidden="true">보조</div>
        <div>
          <p class="brand-title">Thai 25 Day</p>
          <p class="brand-subtitle">${escapeHtml(spec.subtitle)}</p>
        </div>
      </div>
      <div class="status-pill">숫자 연습</div>
    </header>

    <nav class="day-nav single-link" aria-label="학습 보조자료 이동">
      ${spec.backLinks
        .map(
          (link) => `
            <a class="day-nav-link active" href="${escapeHtml(link.href)}">${escapeHtml(link.label)}</a>
          `
        )
        .join("")}
    </nav>

    <main>
      <section class="hero supplement-hero" aria-labelledby="aid-title">
        <div>
          <p class="eyebrow">학습보조${spec.aid}</p>
          <h1 id="aid-title">${escapeHtml(spec.title)}</h1>
          <p class="hero-copy">${escapeHtml(spec.description)}</p>
        </div>
        <div class="supplement-summary" aria-label="학습보조1 요약">
          <span>0-12</span>
          <span>20-90</span>
          <span>100+</span>
          <span>서수</span>
        </div>
      </section>

      <section class="section" aria-labelledby="aid-control-heading">
        <div class="section-heading">
          <h2 id="aid-control-heading">음성 선택</h2>
          <p class="section-note">${escapeHtml(speakerLabel(state.speaker))} 음성</p>
        </div>
        <div class="supplement-control-panel">
          ${renderSpeakerToggle()}
          <div id="audio-status" class="audio-status" role="status">숫자 오디오 버튼을 누르면 재생 상태가 여기에 표시됩니다.</div>
        </div>
      </section>

      ${spec.sections.map(renderSupplementSection).join("")}
    </main>
  `;

  bindSupplementEvents();
}

function renderSupplementSection(section) {
  return `
    <section class="section" aria-labelledby="${escapeHtml(section.id)}-heading">
      <div class="section-heading">
        <h2 id="${escapeHtml(section.id)}-heading">${escapeHtml(section.title)}</h2>
        <p class="section-note">${section.items.length}개</p>
      </div>
      <div class="number-grid">
        ${section.items.map(renderNumberItem).join("")}
      </div>
    </section>
  `;
}

function renderNumberItem(item) {
  const speakerAudio = item.audio?.[state.speaker] || item.audio?.female || item.audio?.male || {};
  return `
    <article class="number-item">
      <div class="number-main">
        <span class="number-value">${escapeHtml(item.value)}</span>
        <span class="number-korean">${escapeHtml(item.koreanPronunciation)}</span>
        <span class="number-thai" lang="th">${escapeHtml(item.thai)}</span>
        <span class="number-meta">${escapeHtml(item.english)} · ${escapeHtml(item.romanization)}</span>
      </div>
      <div class="number-audio" aria-label="${escapeHtml(item.koreanPronunciation)} 숫자 오디오">
        ${["normal", "slow"]
          .map((mode) => {
            const path = speakerAudio[mode];
            return `
              <button class="audio-btn secondary"
                data-audio="${escapeHtml(path || "")}"
                data-mode="${mode}"
                data-audio-label="${escapeHtml(item.koreanPronunciation)} ${modeLabel(mode)}"
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

function bindEvents() {
  document.querySelectorAll("[data-speaker]").forEach((button) => {
    button.addEventListener("click", () => {
      state.speaker = button.dataset.speaker;
      writeStorage(STORAGE_KEYS.speakerPreference, state.speaker);
      render();
    });
  });

  document.querySelectorAll("[data-audio]").forEach((button) => {
    button.addEventListener("click", () => {
      const audioPath = button.dataset.audio;
      const mode = button.dataset.mode;
      const label = button.dataset.audioLabel || modeLabel(mode);
      if (!audioPath) return;
      state.audioMode = mode;
      writeStorage(STORAGE_KEYS.audioSpeedPreference, mode);
      playAudio(audioPath, label);
      renderAudioPressedState(mode, button);
    });
  });

  document.querySelectorAll('[data-action="review-practice"]').forEach((button) => {
    button.addEventListener("click", () => {
      const phrase = primaryPhrases().find((item) => targetKey(item) === button.dataset.targetKey);
      if (phrase) listenThenRecordReview(phrase);
    });
  });

  document.querySelectorAll('[data-action="review-replay"]').forEach((button) => {
    button.addEventListener("click", () => replayRecording());
  });

  document.querySelector('[data-action="complete"]').addEventListener("click", () => {
    if (!state.completedIds.includes(state.spec.id)) {
      state.completedIds = [...state.completedIds, state.spec.id];
      writeStorage(STORAGE_KEYS.completedLessonIds, JSON.stringify(state.completedIds));
    }
    showToast(`${lessonLabel(state.spec)} 학습 완료가 저장되었습니다.`);
    render();
  });

  document.querySelector('[data-action="reset"]').addEventListener("click", () => {
    state.completedIds = state.completedIds.filter((id) => id !== state.spec.id);
    writeStorage(STORAGE_KEYS.completedLessonIds, JSON.stringify(state.completedIds));
    showToast(`${lessonLabel(state.spec)} 진도를 초기화했습니다.`);
    render();
  });
}

function bindSupplementEvents() {
  document.querySelectorAll("[data-speaker]").forEach((button) => {
    button.addEventListener("click", () => {
      state.speaker = button.dataset.speaker;
      writeStorage(STORAGE_KEYS.speakerPreference, state.speaker);
      renderSupplement();
    });
  });

  document.querySelectorAll("[data-audio]").forEach((button) => {
    button.addEventListener("click", () => {
      const audioPath = button.dataset.audio;
      const mode = button.dataset.mode;
      const label = button.dataset.audioLabel || modeLabel(mode);
      if (!audioPath) return;
      state.audioMode = mode;
      writeStorage(STORAGE_KEYS.audioSpeedPreference, mode);
      playAudio(audioPath, label);
      renderAudioPressedState(mode, button);
    });
  });
}

function renderAudioPressedState(mode, activeButton = null) {
  document.querySelectorAll("[data-mode]").forEach((button) => {
    button.setAttribute("aria-pressed", "false");
  });
  if (activeButton) {
    activeButton.setAttribute("aria-pressed", "true");
    return;
  }
  document.querySelectorAll(`[data-mode="${mode}"]`).forEach((button) => {
    button.setAttribute("aria-pressed", "true");
  });
}

function setAudioStatus(message, tone = "neutral") {
  const status = document.getElementById("audio-status");
  if (!status) return;
  status.textContent = message;
  status.dataset.tone = tone;
}

function playAudio(src, label) {
  if (state.audio) {
    state.audio.pause();
    state.audio.currentTime = 0;
  }
  state.audio = new Audio(src);
  setAudioStatus(`${label} 오디오를 준비하고 있습니다.`, "neutral");
  state.audio.addEventListener("playing", () => {
    setAudioStatus(`${label} 오디오가 재생 중입니다. 폰 스피커나 이어폰을 확인해 주세요.`, "playing");
  });
  state.audio.addEventListener("ended", () => {
    setAudioStatus(`${label} 오디오 재생이 끝났습니다.`, "done");
  });
  state.audio.addEventListener("error", () => {
    setAudioStatus(`${label} 오디오를 불러오지 못했습니다.`, "error");
  });
  state.audio.play().catch(() => {
    setAudioStatus("브라우저가 오디오 재생을 막았습니다. 버튼을 다시 직접 눌러 주세요.", "error");
    showToast("오디오를 재생하지 못했습니다. 파일 경로를 확인해 주세요.");
  });
}

function reviewDemoMode() {
  const params = new URLSearchParams(window.location.search);
  return params.get("demo") === "1" || ["localhost", "127.0.0.1"].includes(window.location.hostname);
}

function currentTargetText() {
  return getSpeech(state.target)?.thai || "";
}

function currentTargetAudio(mode = "normal") {
  if (!state.target) return "";
  const available = state.target.audio?.[state.speaker] || {};
  return available[mode] || available.normal || "";
}

function assessmentDay() {
  return Number(state.spec.reviewSourceDay || state.spec.day || 0);
}

async function listenThenRecordReview(phrase) {
  if (!isPronunciationReviewLesson()) return;
  if (state.recording || state.practiceStatus === "listening" || state.practiceStatus === "analyzing") return;
  if (state.audio) {
    state.audio.pause();
    state.audio.currentTime = 0;
  }

  state.target = phrase;
  resetRecordingState({ keepResults: true });
  if (!(await prepareRecording())) return;

  const audioPath = currentTargetAudio("normal");
  if (!audioPath) {
    showToast("문장 오디오가 없어 바로 녹음을 시작합니다.");
    beginPreparedRecording();
    return;
  }

  state.practiceStatus = "listening";
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
    const delay = Math.max(0, state.audio.duration * 1000 - REVIEW_VOICE_CONFIG.recordStartLeadMs);
    state.recordStartTimer = window.setTimeout(startFromAudio, delay);
  }, { once: true });
  state.audio.addEventListener("timeupdate", () => {
    if (!state.audio || !Number.isFinite(state.audio.duration)) return;
    if ((state.audio.duration - state.audio.currentTime) * 1000 <= REVIEW_VOICE_CONFIG.recordStartLeadMs) startFromAudio();
  });
  state.audio.addEventListener("ended", () => {
    state.audio = null;
    startFromAudio();
  }, { once: true });
  state.audio.addEventListener("error", () => {
    clearRecordingTimers();
    stopTracks();
    failAttempt("문장 오디오를 불러오지 못했습니다.");
    render();
  }, { once: true });
  render();

  try {
    await state.audio.play();
  } catch (error) {
    clearRecordingTimers();
    stopTracks();
    failAttempt(`문장 오디오 재생 실패: ${error.message}`);
    render();
  }
}

async function prepareRecording() {
  if (!state.target) return false;
  if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder || !(window.AudioContext || window.webkitAudioContext)) {
    failAttempt("이 브라우저는 녹음 기능을 지원하지 않습니다.");
    render();
    return false;
  }

  try {
    state.reviewSessionToken = reviewDemoMode() ? "demo-review-session-token" : await requestReviewSessionToken(state.target);
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
    failAttempt(`마이크 또는 인식 서버를 준비하지 못했습니다: ${error.message}`);
    render();
    return false;
  }
}

async function requestReviewSessionToken(phrase) {
  const response = await fetch(`${REVIEW_VOICE_CONFIG.apiBaseUrl}/review/session`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      anonymousId: ensureReviewAnonId(),
      lessonId: state.spec.id,
      day: assessmentDay(),
      phraseId: targetKey(phrase),
      targetThai: getSpeech(phrase)?.thai || "",
      targetKorean: phrase.korean || phrase.koreanPronunciation || "",
      speaker: state.speaker
    })
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || `${response.status} ${response.statusText}`);
  return payload.sessionToken;
}

function ensureReviewAnonId() {
  const existing = readStorage(STORAGE_KEYS.reviewAnonId, "");
  if (existing) return existing;
  const bytes = new Uint8Array(16);
  if (window.crypto?.getRandomValues) {
    window.crypto.getRandomValues(bytes);
  } else {
    for (let index = 0; index < bytes.length; index += 1) bytes[index] = Math.floor(Math.random() * 256);
  }
  const value = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  writeStorage(STORAGE_KEYS.reviewAnonId, value);
  return value;
}

function beginPreparedRecording() {
  if (state.recording || !state.mediaRecorder || state.mediaRecorder.state !== "inactive") return;
  state.recording = true;
  state.countdown = Math.ceil(REVIEW_VOICE_CONFIG.maxRecordingMs / 1000);
  state.practiceStatus = "recording";
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
  }, REVIEW_VOICE_CONFIG.maxRecordingMs);
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
  for (let index = 0; index < float32Samples.length; index += 1) {
    const sample = Math.max(-1, Math.min(1, float32Samples[index]));
    view.setInt16(index * 2, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
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
  if (reviewDemoMode() || !REVIEW_VOICE_CONFIG.websocketUrl || !state.reviewSessionToken) {
    state.interimTranscript = "로컬 미리보기: 배포 링크에서는 실제 인식 결과가 표시됩니다.";
    return;
  }

  try {
    const url = new URL(REVIEW_VOICE_CONFIG.websocketUrl);
    url.searchParams.set("day", String(assessmentDay()));
    url.searchParams.set("speaker", state.speaker);
    state.websocket = new WebSocket(url);
    state.websocket.binaryType = "arraybuffer";
    state.sttReady = false;
    state.pendingSttChunks = [];
    state.sttEndPending = false;
    state.websocket.addEventListener("open", () => {
      state.websocket.send(JSON.stringify({
        type: "start",
        sessionToken: state.reviewSessionToken,
        targetThai: currentTargetText(),
        targetKorean: state.target.korean || state.target.koreanPronunciation || "",
        day: assessmentDay(),
        phraseId: targetKey(state.target),
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
      if (payload.type === "final") completeAttempt(payload.transcript || "", payload.score);
      if (payload.type === "saved") completeAttempt(payload.transcript || state.transcript || state.interimTranscript || "", payload.score);
      if (payload.type === "no_speech") failAttempt("인식된 태국어가 없습니다. 첫 음절부터 또렷하게 말해 주세요.");
      if (payload.type === "error") failAttempt(payload.message || "STT 서버 오류");
      render();
    });
    state.websocket.addEventListener("close", () => {
      if (state.practiceStatus === "analyzing" && !state.transcript && !state.interimTranscript) {
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
  state.practiceStatus = "analyzing";
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

  if (reviewDemoMode() || !REVIEW_VOICE_CONFIG.websocketUrl) {
    window.setTimeout(() => {
      const transcript = currentTargetText();
      completeAttempt(transcript, scoreTranscript(currentTargetText(), transcript));
      render();
    }, 700);
    return;
  }

  window.setTimeout(() => {
    if (state.practiceStatus !== "analyzing") return;
    const fallbackTranscript = state.interimTranscript || "";
    if (fallbackTranscript) {
      state.sttError = "최종 결과가 늦어 임시 인식 결과로 점수를 계산했습니다.";
      completeAttempt(fallbackTranscript);
    } else {
      failAttempt("정해진 시간 안에 인식 결과가 도착하지 않았습니다.");
    }
    render();
  }, REVIEW_VOICE_CONFIG.resultTimeoutMs);
}

async function replayRecording(isAuto = false) {
  if (!state.playbackUrl) return;
  const audio = new Audio(state.playbackUrl);
  try {
    await audio.play();
  } catch {
    if (isAuto) showToast("자동 재생이 막혔습니다. 다시 듣기를 눌러 확인해 주세요.");
  }
}

function completeAttempt(transcript, score) {
  const key = targetKey(state.target);
  const finalTranscript = transcript || "";
  const finalScore = Number.isFinite(score) ? score : scoreTranscript(currentTargetText(), finalTranscript);
  state.transcript = finalTranscript;
  state.interimTranscript = "";
  state.score = finalScore;
  state.practiceStatus = "done";
  if (!state.attemptRecorded) {
    state.practiceResults[key] = {
      status: "done",
      transcript: finalTranscript,
      score: finalScore,
      error: state.sttError,
      updatedAt: new Date().toISOString()
    };
    state.attemptRecorded = true;
  }
}

function failAttempt(message) {
  const key = state.target ? targetKey(state.target) : "";
  state.sttError = message || "STT 서버 오류";
  state.transcript = "";
  state.interimTranscript = "";
  state.score = null;
  state.practiceStatus = "error";
  if (key) {
    state.practiceResults[key] = {
      status: "error",
      transcript: "",
      score: null,
      error: state.sttError,
      updatedAt: new Date().toISOString()
    };
  }
}

function resetRecordingState(options = {}) {
  clearRecordingTimers();
  if (state.playbackUrl) URL.revokeObjectURL(state.playbackUrl);
  state.recordedBlob = null;
  state.playbackUrl = null;
  state.transcript = "";
  state.interimTranscript = "";
  state.score = null;
  state.sttError = "";
  state.attemptRecorded = false;
  state.practiceStatus = "idle";
  state.reviewSessionToken = null;
  state.sttReady = false;
  state.pendingSttChunks = [];
  state.sttEndPending = false;
  if (!options.keepResults) state.practiceResults = {};
}

function clearRecordingTimers() {
  if (state.recordStartTimer) window.clearTimeout(state.recordStartTimer);
  if (state.recordTickTimer) window.clearInterval(state.recordTickTimer);
  if (state.recordStopTimer) window.clearTimeout(state.recordStopTimer);
  state.recordStartTimer = null;
  state.recordTickTimer = null;
  state.recordStopTimer = null;
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

function scoreTranscript(targetThai, transcript) {
  const target = normalizeThai(targetThai);
  const heard = normalizeThai(transcript);
  if (!target || !heard) return 0;
  if (target === heard) return 100;
  const distance = levenshteinDistance(target, heard);
  const maxLength = Math.max(target.length, heard.length);
  return Math.max(0, Math.round((1 - distance / maxLength) * 100));
}

function normalizeThai(value) {
  return String(value || "").replace(/\s+/g, "").replace(/[.,!?ๆ]/g, "").trim();
}

function levenshteinDistance(a, b) {
  const dp = Array.from({ length: a.length + 1 }, () => Array(b.length + 1).fill(0));
  for (let index = 0; index <= a.length; index += 1) dp[index][0] = index;
  for (let index = 0; index <= b.length; index += 1) dp[0][index] = index;
  for (let row = 1; row <= a.length; row += 1) {
    for (let col = 1; col <= b.length; col += 1) {
      const cost = a[row - 1] === b[col - 1] ? 0 : 1;
      dp[row][col] = Math.min(dp[row - 1][col] + 1, dp[row][col - 1] + 1, dp[row - 1][col - 1] + cost);
    }
  }
  return dp[a.length][b.length];
}

let toastTimer = null;
function showToast(message) {
  const old = document.querySelector(".toast");
  if (old) old.remove();

  const toast = document.createElement("div");
  toast.className = "toast";
  toast.setAttribute("role", "status");
  toast.textContent = message;
  document.body.appendChild(toast);

  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toast.remove(), 2600);
}

function renderError(error) {
  const aid = requestedAid();
  const preview = requestedPreview();
  const dateReview = requestedDateReview();
  const label = aid ? `학습보조${escapeHtml(aid)}` : preview ? `미리보기 ${escapeHtml(preview)}` : dateReview ? `${escapeHtml(dateReview)} 복습` : `${requestedDay()}일차`;
  document.getElementById("app").innerHTML = `
    <div class="error-panel">
      <p class="eyebrow">불러오기 실패</p>
      <h1>${label} 자료를 열 수 없습니다</h1>
      <p>${escapeHtml(error.message)}</p>
    </div>
  `;
}

async function boot() {
  try {
    const aid = requestedAid();
    const preview = requestedPreview();
    const dateReview = requestedDateReview();
    const specUrl = aid ? specUrlForAid(aid) : preview ? specUrlForPreview(preview) : dateReview ? specUrlForDateReview(dateReview) : specUrlForDay(requestedDay());
    if (!specUrl) throw new Error(dateReview ? `지원하지 않는 날짜 복습 자료입니다: ${dateReview}` : `지원하지 않는 보조자료 번호입니다: ${aid}`);
    const response = await fetch(specUrl, { cache: "no-cache" });
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    const spec = await response.json();
    if (spec.kind === "pwa_learning_aid_spec") {
      initSupplementState(spec);
      renderSupplement();
    } else {
      initState(spec);
      render();
    }

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("service-worker.js").catch(() => {});
    }
  } catch (error) {
    renderError(error);
  }
}

boot();
