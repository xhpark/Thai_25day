const fs = require("fs");
const path = require("path");
const os = require("os");
const { spawnSync } = require("child_process");

const repoRoot = path.resolve(__dirname, "..");
const specPath = path.join(repoRoot, "assets", "generated", "kakao", "w1d1.json");
const outputPath = path.join(repoRoot, "assets", "generated", "kakao", "w1d1_card.png");
const tempDir = path.join(repoRoot, "artifacts", "kakao-render");
const tempHtmlPath = path.join(tempDir, "w1d1_card.html");
const edgeProfilePath = path.join(tempDir, "edge-profile");

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function findEdge() {
  const candidates = [
    path.join(process.env["ProgramFiles(x86)"] || "", "Microsoft", "Edge", "Application", "msedge.exe"),
    path.join(process.env.ProgramFiles || "", "Microsoft", "Edge", "Application", "msedge.exe"),
    "msedge"
  ];

  for (const candidate of candidates) {
    if (candidate === "msedge") return candidate;
    if (candidate && fs.existsSync(candidate)) return candidate;
  }

  throw new Error("Microsoft Edge executable not found.");
}

function cardHtml(spec) {
  const phrase = (spec.mainPhrases || spec.newPhrases)[0];
  const female = phrase.speech.female;
  const male = phrase.speech.male;
  const keywords = spec.displayKeywords.slice(0, 3);
  const localImage = spec.primaryImage?.sourcePlan?.find(
    (item) => item.type === "local_preferred" && item.status === "ready"
  );
  const imagePath = localImage ? path.join(repoRoot, localImage.assetPath) : null;
  const imageUrl = imagePath && fs.existsSync(imagePath)
    ? `file:///${imagePath.replaceAll("\\", "/")}`
    : null;

  return `<!doctype html>
<html lang="ko">
  <head>
    <meta charset="utf-8" />
    <style>
      :root {
        --green: #2f7d5a;
        --green-dark: #173f31;
        --leaf: #dfeee5;
        --yellow: #f4c95d;
        --blue: #1769d2;
        --blue-soft: #eaf4ff;
        --ink: #1c241f;
        --muted: #5d6964;
        font-family: "Pretendard", "Noto Sans KR", "Malgun Gothic", "Leelawadee UI", "Tahoma", sans-serif;
      }

      * { box-sizing: border-box; }

      body {
        width: 1080px;
        height: 1350px;
        margin: 0;
        overflow: hidden;
        background: #fbfaf5;
        color: var(--ink);
      }

      .card {
        position: relative;
        width: 1080px;
        height: 1350px;
        padding: 34px 58px;
        background:
          linear-gradient(180deg, rgba(235, 247, 239, 0.95), rgba(255, 250, 238, 0.98)),
          #fbfaf5;
      }

      .top {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 28px;
        margin-bottom: 16px;
      }

      .brand {
        display: flex;
        align-items: center;
        gap: 22px;
        font-size: 36px;
        font-weight: 900;
      }

      .logo {
        display: grid;
        width: 64px;
        height: 64px;
        place-items: center;
        border-radius: 18px;
        background: var(--green);
        color: #fff;
        font-size: 32px;
      }

      .day-pill {
        padding: 14px 24px;
        border-radius: 999px;
        background: #fff;
        border: 2px solid #d7e5da;
        color: var(--green-dark);
        font-size: 30px;
        font-weight: 900;
      }

      .title-band {
        margin: 0 -58px 22px;
        padding: 20px 58px 23px;
        background: linear-gradient(135deg, #2f7d5a, #4f9b3e);
        color: #fff;
        text-align: center;
      }

      h1 {
        margin: 0;
        font-size: 54px;
        line-height: 1.08;
        letter-spacing: 0;
      }

      .theme-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 14px;
        color: var(--green-dark);
        font-size: 29px;
        font-weight: 900;
      }

      .hero {
        position: relative;
        height: 145px;
        overflow: hidden;
        border-radius: 18px;
        border: 2px solid #d9e3d8;
        background:
          linear-gradient(135deg, rgba(244, 201, 93, 0.32), rgba(47, 125, 90, 0.18)),
          #f4faf2;
      }

      .hero img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        object-position: center 38%;
        display: block;
      }

      .hero-copy {
        position: absolute;
        right: 0;
        bottom: 0;
        left: 0;
        padding: 16px 26px;
        background: rgba(23, 63, 49, 0.78);
        color: #fff;
        font-size: 25px;
        font-weight: 900;
      }

      .hero-label {
        position: absolute;
        left: 24px;
        top: 22px;
        padding: 10px 16px;
        border-radius: 999px;
        background: rgba(255,255,255,0.82);
        color: var(--green-dark);
        font-size: 21px;
        font-weight: 900;
      }

      .phrase {
        margin-top: 16px;
        padding: 20px 28px;
        border-radius: 18px;
        background: #fff;
        border: 2px solid #dfe5dc;
        box-shadow: 0 18px 36px rgba(31, 70, 55, 0.13);
      }

      .phrase-head {
        display: flex;
        justify-content: space-between;
        gap: 20px;
        align-items: center;
        margin-bottom: 12px;
      }

      .label {
        width: fit-content;
        padding: 10px 18px;
        border-radius: 999px;
        background: var(--green);
        color: #fff;
        font-size: 23px;
        font-weight: 900;
      }

      .speaker {
        color: var(--blue);
        font-size: 26px;
        font-weight: 900;
      }

      .thai {
        margin: 0 0 8px;
        color: #050505;
        font-family: "Leelawadee UI", "Tahoma", sans-serif;
        font-size: 62px;
        font-weight: 900;
        line-height: 1.08;
      }

      .pronunciation {
        width: fit-content;
        margin: 0 0 8px;
        padding: 10px 16px;
        border: 2px solid #acd1ff;
        border-radius: 14px;
        background: var(--blue-soft);
        color: var(--blue);
        font-size: 43px;
        line-height: 1.05;
        font-weight: 900;
      }

      .roman {
        margin: 0;
        color: var(--green-dark);
        font-size: 29px;
        font-weight: 900;
      }

      .male-line {
        margin-top: 14px;
        padding-top: 14px;
        border-top: 2px dashed #d7ded7;
        color: var(--muted);
        font-size: 24px;
        font-weight: 800;
      }

      .keywords {
        margin-top: 14px;
        padding: 16px 20px;
        border-radius: 18px;
        background: #f4fbf4;
        border: 2px solid #d7ead9;
      }

      .keywords-title {
        margin: 0 0 12px;
        color: var(--green-dark);
        font-size: 28px;
        font-weight: 900;
      }

      .chips {
        display: flex;
        gap: 14px;
      }

      .chip {
        flex: 1 1 0;
        min-width: 0;
        padding: 11px 10px;
        border-radius: 16px;
        background: #fff;
        border: 2px solid #c8dacb;
        text-align: center;
      }

      .chip-pronunciation {
        color: var(--blue);
        font-size: 29px;
        font-weight: 900;
        line-height: 1.1;
      }

      .chip-meaning {
        margin-top: 6px;
        color: #111;
        font-size: 20px;
        font-weight: 800;
      }

      .mission {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 12px;
        margin-top: 14px;
      }

      .box {
        padding: 16px 18px;
        border-radius: 18px;
        border: 2px solid #d9e3d8;
        background: #fff;
      }

      .box.guide {
        background: #edf7ff;
        border-color: #c9dff1;
      }

      .box.practice {
        background: #fff8df;
        border-color: #efd77b;
      }

      .box-title {
        margin: 0 0 8px;
        color: var(--green-dark);
        font-size: 25px;
        font-weight: 900;
      }

      .box.practice .box-title { color: #8a6614; }

      .box p {
        margin: 0;
        font-size: 21px;
        line-height: 1.3;
        font-weight: 700;
      }

      .footer {
        position: absolute;
        right: 58px;
        bottom: 24px;
        left: 58px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        color: var(--green-dark);
        font-size: 23px;
        font-weight: 900;
      }
    </style>
  </head>
  <body>
    <section class="card">
      <div class="top">
        <div class="brand"><div class="logo">✚</div><div>태국어 선교회화 25일</div></div>
        <div class="day-pill">${spec.day} / 25</div>
      </div>

      <div class="title-band">
        <h1>${escapeHtml(spec.day)}일차 ${escapeHtml(spec.title)}</h1>
      </div>

      <div class="theme-row">
        <div>태국 교회 첫 방문</div>
        <div>오늘의 문장 1</div>
      </div>

      <div class="hero" role="img" aria-label="${escapeHtml(spec.primaryImage.altTextKo)}">
        ${imageUrl ? `<img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(spec.primaryImage.altTextKo)}" />` : `<div class="hero-label">장면 이미지 준비 중</div>`}
        <div class="hero-copy">${escapeHtml(spec.primaryImage.altTextKo)}</div>
      </div>

      <article class="phrase">
        <div class="phrase-head">
          <div class="label">오늘의 문장</div>
          <div class="speaker">여성 발화 먼저 연습</div>
        </div>
        <p class="thai" lang="th">${escapeHtml(female.thai)}</p>
        <p class="pronunciation">${escapeHtml(female.korean_pronunciation)}</p>
        <p class="roman">${escapeHtml(female.romanization)}</p>
        <div class="male-line">남성: ${escapeHtml(male.korean_pronunciation)} · ${escapeHtml(male.romanization)}</div>
      </article>

      <section class="keywords">
        <h2 class="keywords-title">핵심 단어</h2>
        <div class="chips">
          ${keywords
            .map(
              (keyword) => `<div class="chip">
                <div class="chip-pronunciation">${escapeHtml(keyword.koreanPronunciation)}</div>
                <div class="chip-meaning">${escapeHtml(keyword.korean)}</div>
              </div>`
            )
            .join("")}
        </div>
      </section>

      <section class="mission">
        <div class="box guide">
          <h2 class="box-title">선교 가이드</h2>
          <p>${escapeHtml(spec.ministryGuide)}</p>
        </div>
        <div class="box practice">
          <h2 class="box-title">말하기 미션</h2>
          <p>${escapeHtml(spec.speakingMission)}</p>
        </div>
      </section>

      <div class="footer">
        <div>오디오: 보통 · 느리게 · 3회 반복</div>
        <div>ID ${escapeHtml(spec.id)}</div>
      </div>
    </section>
  </body>
</html>`;
}

function render() {
  const spec = JSON.parse(fs.readFileSync(specPath, "utf8"));
  fs.mkdirSync(tempDir, { recursive: true });
  fs.writeFileSync(tempHtmlPath, cardHtml(spec), "utf8");

  const edge = findEdge();
  const args = [
    "--headless",
    "--disable-gpu",
    "--hide-scrollbars",
    `--user-data-dir=${edgeProfilePath}`,
    "--window-size=1080,1350",
    "--virtual-time-budget=5000",
    `--screenshot=${outputPath}`,
    `file:///${tempHtmlPath.replaceAll("\\", "/")}`
  ];

  const result = spawnSync(edge, args, { encoding: "utf8" });
  if (result.error) throw result.error;
  if (!fs.existsSync(outputPath)) {
    throw new Error(`Screenshot not written. stderr=${result.stderr || ""}`);
  }

  fs.rmSync(edgeProfilePath, { recursive: true, force: true });
  console.log(outputPath);
}

render();
