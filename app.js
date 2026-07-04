const TOTAL_DAYS = 25;
const STORAGE_KEYS = {
  schemaVersion: "thai25.schemaVersion",
  currentDay: "thai25.currentDay",
  completedLessonIds: "thai25.completedLessonIds",
  lastOpenedLessonId: "thai25.lastOpenedLessonId",
  speakerPreference: "thai25.speakerPreference",
  audioSpeedPreference: "thai25.audioSpeedPreference",
  showSupplementalKeywords: "thai25.showSupplementalKeywords"
};

const state = {
  spec: null,
  speaker: "female",
  audioMode: "normal",
  completedIds: [],
  audio: null,
  storageAvailable: true
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
    "2026-07-05": "assets/generated/pwa/review_2026_07_05.json"
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

function isCompleted() {
  return state.completedIds.includes(state.spec.id);
}

function lessonLabel(spec = state.spec) {
  return spec.displayDayLabel || `${spec.day}일차`;
}

function effectiveDisplayKeywords(spec) {
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
        ${phrases.map((phrase, index) => renderPhraseCard(phrase, index)).join("")}
        <div id="audio-status" class="audio-status" role="status">오디오 버튼을 누르면 재생 상태가 여기에 표시됩니다.</div>
        ${renderReviewList()}
      </section>

      <section class="section" aria-labelledby="keyword-heading">
        <div class="section-heading">
          <h2 id="keyword-heading">주요 단어</h2>
          <p class="section-note">핵심 ${effectiveDisplayKeywords(spec).length}개</p>
        </div>
        <div class="keyword-list">
          ${effectiveDisplayKeywords(spec).map(renderKeyword).join("")}
        </div>
      </section>

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

function renderPhraseCard(phrase, index) {
  const speech = phrase.speech[state.speaker] || phrase.speech.female || phrase.speech.male;
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
      <p class="thai-text" lang="th">${escapeHtml(speech.thai)}</p>
      <p class="korean-pronunciation" aria-label="한국식 발음">${escapeHtml(speech.korean_pronunciation)}</p>
      <p class="romanization">${escapeHtml(speech.romanization)}</p>
      ${renderSentenceAudio(phrase, index + 1)}
    </article>
  `;
}

function renderReviewList() {
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
