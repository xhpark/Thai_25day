#!/usr/bin/env python3
from __future__ import annotations

import argparse
import asyncio
import json
import pathlib
import subprocess
import sys
import time
from typing import Any


ROOT = pathlib.Path(__file__).resolve().parents[1]
MASTER_PATH = ROOT / "data/thai_master_phrases.json"
INDEX_PATH = ROOT / "data/thai_learning_assets_index.json"
SENTENCE_AUDIO_DIR = ROOT / "assets/audio/sentences"
WORD_AUDIO_DIR = ROOT / "assets/audio/words"
TMP_DIR = ROOT / ".tmp/audio"

MALE_VOICE = "th-TH-NiwatNeural"
FEMALE_VOICE = "th-TH-PremwadeeNeural"
SLOW_RATE = "-25%"
GAP_SECONDS = 0.35


DAY_PLAN: list[dict[str, Any]] = [
    {"day": 1, "type": "new", "variantIds": ["1"]},
    {"day": 2, "type": "new", "variantIds": ["2-1", "2-2"]},
    {"day": 3, "type": "new", "variantIds": ["3", "4"]},
    {"day": 4, "type": "new", "variantIds": ["5-1", "5-2"]},
    {"day": 5, "type": "review", "variantIds": ["1", "2-1", "2-2", "3", "4", "5-1", "5-2"]},
    {"day": 6, "type": "new", "variantIds": ["6", "7"]},
    {"day": 7, "type": "new", "variantIds": ["8"]},
    {"day": 8, "type": "new", "variantIds": ["9"]},
    {"day": 9, "type": "new", "variantIds": ["10"]},
    {"day": 10, "type": "review", "variantIds": ["1", "2-1", "2-2", "3", "4", "5-1", "5-2", "6", "7", "8", "9", "10"]},
    {"day": 11, "type": "new", "variantIds": ["11"]},
    {"day": 12, "type": "new", "variantIds": ["12", "13"]},
    {"day": 13, "type": "new", "variantIds": ["14"]},
    {"day": 14, "type": "new", "variantIds": ["15", "16"]},
    {"day": 15, "type": "review", "variantIds": ["1", "2-1", "2-2", "3", "4", "5-1", "5-2", "6", "7", "8", "9", "10", "11", "12", "13", "14", "15", "16"]},
    {"day": 16, "type": "new", "variantIds": ["17"]},
    {"day": 17, "type": "new", "variantIds": ["18"]},
    {"day": 18, "type": "new", "variantIds": ["19"]},
    {"day": 19, "type": "new", "variantIds": ["20"]},
    {"day": 20, "type": "review", "variantIds": ["1", "3", "14", "17", "18", "19", "20"]},
    {"day": 21, "type": "new", "variantIds": ["21"]},
    {"day": 22, "type": "new", "variantIds": ["22"]},
    {"day": 23, "type": "new", "variantIds": ["23"]},
    {"day": 24, "type": "new", "variantIds": ["24"]},
    {"day": 25, "type": "review", "variantIds": ["1", "2-1", "2-2", "3", "4", "5-1", "5-2", "6", "7", "8", "9", "10", "11", "12", "13", "14", "15", "16", "17", "18", "19", "20", "21", "22", "23", "24"]},
]


KEYWORDS: list[dict[str, Any]] = [
    {"id": "W001", "variantIds": ["1", "2-1", "2-2"], "korean": "안녕하세요", "english": "hello", "thai": "สวัสดี", "romanization": "sà-wàt-dii", "koreanPronunciation": "싸왓디"},
    {"id": "W002", "variantIds": ["1", "2-1", "2-2", "3", "4", "5-1", "5-2", "6", "7", "8", "9", "10", "11", "12", "13", "14", "15", "16", "17", "18", "19", "20", "21", "22", "23", "24"], "korean": "남성 존칭 어미", "english": "male polite particle", "thai": "ครับ", "romanization": "khráp", "koreanPronunciation": "크랍", "voices": ["male"], "tier": "core"},
    {"id": "W003", "variantIds": ["1", "2-1", "2-2", "3", "4", "5-1", "5-2", "6", "7", "9", "13", "14", "15", "16", "17", "18", "19", "20", "21", "22", "23", "24"], "korean": "여성 존칭 어미", "english": "female polite particle", "thai": "ค่ะ", "romanization": "khâ", "koreanPronunciation": "카", "voices": ["female"], "tier": "core"},
    {"id": "W004", "variantIds": ["8", "10", "11", "12"], "korean": "여성 질문/권유 어미", "english": "female question/request particle", "thai": "คะ", "romanization": "khá", "koreanPronunciation": "카", "voices": ["female"], "tier": "core"},
    {"id": "W005", "variantIds": ["2-1"], "korean": "아침", "english": "morning", "thai": "ตอนเช้า", "romanization": "dtaawn-cháao", "koreanPronunciation": "떤 차오"},
    {"id": "W006", "variantIds": ["2-2"], "korean": "저녁", "english": "evening", "thai": "ตอนเย็น", "romanization": "dtaawn-yen", "koreanPronunciation": "떤 옌"},
    {"id": "W007", "variantIds": ["3"], "korean": "감사합니다", "english": "thank you", "thai": "ขอบคุณ", "romanization": "khàawp-khun", "koreanPronunciation": "콥 쿤"},
    {"id": "W008", "variantIds": ["3", "13", "14"], "korean": "많이/매우", "english": "very/much", "thai": "มาก", "romanization": "mâak", "koreanPronunciation": "막"},
    {"id": "W009", "variantIds": ["4", "7"], "korean": "괜찮아요", "english": "never mind / it's okay", "thai": "ไม่เป็นไร", "romanization": "mâi-pen-rai", "koreanPronunciation": "마이 뻰 라이"},
    {"id": "W010", "variantIds": ["5-1"], "korean": "예", "english": "yes", "thai": "ใช่", "romanization": "châi", "koreanPronunciation": "차이"},
    {"id": "W011", "variantIds": ["5-2"], "korean": "아니오", "english": "no", "thai": "ไม่ใช่", "romanization": "mâi-châi", "koreanPronunciation": "마이 차이"},
    {"id": "W012", "variantIds": ["6"], "korean": "실례합니다/죄송합니다", "english": "excuse me / sorry", "thai": "ขอโทษ", "romanization": "khŏr-thôot", "koreanPronunciation": "커 톳"},
    {"id": "W013", "variantIds": ["8", "10", "11", "17", "18", "19", "22", "23"], "korean": "당신", "english": "you", "thai": "คุณ", "romanization": "khun", "koreanPronunciation": "쿤"},
    {"id": "W014", "variantIds": ["8", "9"], "korean": "이름", "english": "name", "thai": "ชื่อ", "romanization": "chûue", "koreanPronunciation": "츠"},
    {"id": "W015", "variantIds": ["8"], "korean": "무엇", "english": "what", "thai": "อะไร", "romanization": "à-rai", "koreanPronunciation": "아라이"},
    {"id": "W016", "variantIds": ["9", "23"], "korean": "나(남성)", "english": "I/me, male speaker", "thai": "ผม", "romanization": "phŏm", "koreanPronunciation": "폼", "voices": ["male"]},
    {"id": "W017", "variantIds": ["9", "23"], "korean": "나(여성)", "english": "I/me, female speaker", "thai": "ฉัน", "romanization": "chăn", "koreanPronunciation": "찬", "voices": ["female"]},
    {"id": "W018", "variantIds": ["10"], "korean": "나이", "english": "age", "thai": "อายุ", "romanization": "aa-yú", "koreanPronunciation": "아유"},
    {"id": "W019", "variantIds": ["10"], "korean": "얼마", "english": "how much/how many", "thai": "เท่าไหร่", "romanization": "thâo-rài", "koreanPronunciation": "타오 라이"},
    {"id": "W020", "variantIds": ["11"], "korean": "화장실", "english": "restroom", "thai": "ห้องน้ำ", "romanization": "hông-náam", "koreanPronunciation": "헝남"},
    {"id": "W021", "variantIds": ["11"], "korean": "~에 있다", "english": "to be located", "thai": "อยู่", "romanization": "yùu", "koreanPronunciation": "유"},
    {"id": "W022", "variantIds": ["11"], "korean": "어디", "english": "where", "thai": "ที่ไหน", "romanization": "thîi-năi", "koreanPronunciation": "티 나이"},
    {"id": "W023", "variantIds": ["12"], "korean": "드시다/먹다", "english": "eat", "thai": "ทาน", "romanization": "thaan", "koreanPronunciation": "탄"},
    {"id": "W024", "variantIds": ["12", "23"], "korean": "~에게/~하도록", "english": "give/to/let", "thai": "ให้", "romanization": "hâi", "koreanPronunciation": "하이"},
    {"id": "W025", "variantIds": ["12", "13"], "korean": "맛있다", "english": "delicious", "thai": "อร่อย", "romanization": "a-ròi", "koreanPronunciation": "아러이"},
    {"id": "W026", "variantIds": ["12"], "korean": "부드러운 권유 어미", "english": "softening particle", "thai": "นะ", "romanization": "ná", "koreanPronunciation": "나"},
    {"id": "W027", "variantIds": ["13"], "korean": "정말", "english": "really", "thai": "จริง ๆ", "romanization": "jing-jing", "koreanPronunciation": "찡찡"},
    {"id": "W028", "variantIds": ["14"], "korean": "잘하다/똑똑하다", "english": "good/skilled", "thai": "เก่ง", "romanization": "gèng", "koreanPronunciation": "깽"},
    {"id": "W029", "variantIds": ["15"], "korean": "안녕히 가세요", "english": "goodbye", "thai": "ลาก่อน", "romanization": "laa-gàawn", "koreanPronunciation": "라껀"},
    {"id": "W030", "variantIds": ["16"], "korean": "그리고/그 후", "english": "then/and then", "thai": "แล้ว", "romanization": "láew", "koreanPronunciation": "래우"},
    {"id": "W031", "variantIds": ["16"], "korean": "만나다", "english": "meet", "thai": "พบกัน", "romanization": "phóp-gan", "koreanPronunciation": "폽깐"},
    {"id": "W032", "variantIds": ["16"], "korean": "다시/새로", "english": "again/new", "thai": "ใหม่", "romanization": "mài", "koreanPronunciation": "마이"},
    {"id": "W033", "variantIds": ["17", "21"], "korean": "예수님", "english": "Jesus", "thai": "พระเยซู", "romanization": "Phrá-yeh-suu", "koreanPronunciation": "프라예쑤"},
    {"id": "W034", "variantIds": ["17", "18", "20"], "korean": "하시는/존칭 동사 표지", "english": "royal/respectful verb marker", "thai": "ทรง", "romanization": "song", "koreanPronunciation": "쏭"},
    {"id": "W035", "variantIds": ["17", "18", "22"], "korean": "사랑하다", "english": "love", "thai": "รัก", "romanization": "rák", "koreanPronunciation": "락"},
    {"id": "W036", "variantIds": ["18", "19", "20"], "korean": "하나님", "english": "God", "thai": "พระเจ้า", "romanization": "Phrá-jâo", "koreanPronunciation": "프라짜오"},
    {"id": "W037", "variantIds": ["19"], "korean": "청하다/바라다", "english": "ask/request", "thai": "ขอ", "romanization": "khŏr", "koreanPronunciation": "커"},
    {"id": "W038", "variantIds": ["19"], "korean": "축복하다", "english": "bless", "thai": "อวยพร", "romanization": "uay-phon", "koreanPronunciation": "우아이폰"},
    {"id": "W039", "variantIds": ["20"], "korean": "~이다", "english": "to be", "thai": "เป็น", "romanization": "pen", "koreanPronunciation": "뻰"},
    {"id": "W040", "variantIds": ["20"], "korean": "사랑", "english": "love", "thai": "ความรัก", "romanization": "khwaam-rák", "koreanPronunciation": "콰락"},
    {"id": "W041", "variantIds": ["21"], "korean": "믿다", "english": "believe", "thai": "เชื่อ", "romanization": "chûea", "koreanPronunciation": "츄아"},
    {"id": "W042", "variantIds": ["21"], "korean": "~안에/~을", "english": "in", "thai": "ใน", "romanization": "nai", "koreanPronunciation": "나이"},
    {"id": "W043", "variantIds": ["22"], "korean": "우리", "english": "we/us", "thai": "พวกเรา", "romanization": "phûak-rao", "koreanPronunciation": "푸악 라오"},
    {"id": "W044", "variantIds": ["23"], "korean": "~할 것이다", "english": "will", "thai": "จะ", "romanization": "jà", "koreanPronunciation": "짜"},
    {"id": "W045", "variantIds": ["23"], "korean": "기도하다", "english": "pray", "thai": "อธิษฐาน", "romanization": "à-thít-thăan", "koreanPronunciation": "아팃탄"},
    {"id": "W046", "variantIds": ["24"], "korean": "오다", "english": "come", "thai": "มา", "romanization": "maa", "koreanPronunciation": "마"},
    {"id": "W047", "variantIds": ["24"], "korean": "노래하다", "english": "sing", "thai": "ร้องเพลง", "romanization": "róng-phleeng", "koreanPronunciation": "롱 플렝"},
    {"id": "W048", "variantIds": ["24"], "korean": "찬양하다", "english": "praise", "thai": "สรรเสริญ", "romanization": "săn-sĕern", "koreanPronunciation": "싼쓴"},
    {"id": "W049", "variantIds": ["24"], "korean": "함께", "english": "together", "thai": "ด้วยกัน", "romanization": "dûuai-gan", "koreanPronunciation": "두아이깐"}
]

CORE_KEYWORD_IDS = {
    "W001", "W002", "W003", "W004", "W007", "W009", "W010", "W011",
    "W012", "W014", "W016", "W017", "W020", "W025", "W028", "W029",
    "W033", "W035", "W036", "W038", "W040", "W041", "W045", "W047",
    "W048", "W049",
}


def _load_master() -> dict[str, Any]:
    return json.loads(MASTER_PATH.read_text(encoding="utf-8"))


def _safe_variant_id(variant_id: str) -> str:
    return variant_id.replace("-", "_")


def _sentence_audio_path(variant_id: str, gender: str, mode: str) -> pathlib.Path:
    return SENTENCE_AUDIO_DIR / f"S{_safe_variant_id(variant_id)}_{gender}_{mode}.mp3"


def _word_audio_path(word_id: str, gender: str, mode: str) -> pathlib.Path:
    return WORD_AUDIO_DIR / f"{word_id}_{gender}_{mode}.mp3"


def _relative(path: pathlib.Path) -> str:
    return path.relative_to(ROOT).as_posix()


async def _synth(text: str, voice: str, out_path: pathlib.Path, rate: str = "+0%") -> bool:
    import edge_tts  # type: ignore

    out_path.parent.mkdir(parents=True, exist_ok=True)
    if out_path.exists() and out_path.stat().st_size > 0:
        return False
    for attempt in range(1, 4):
        try:
            await edge_tts.Communicate(text=text, voice=voice, rate=rate).save(str(out_path))
            return True
        except Exception:
            if attempt == 3:
                raise
            time.sleep(attempt * 0.8)
    return False


def _make_silence(path: pathlib.Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    if path.exists() and path.stat().st_size > 0:
        return
    subprocess.run(
        [
            "ffmpeg",
            "-y",
            "-f",
            "lavfi",
            "-i",
            f"anullsrc=r=24000:cl=mono:d={GAP_SECONDS}",
            "-q:a",
            "9",
            str(path),
        ],
        check=True,
        capture_output=True,
    )


def _concat_repeat(src: pathlib.Path, out_path: pathlib.Path, repeat: int = 3) -> bool:
    out_path.parent.mkdir(parents=True, exist_ok=True)
    if out_path.exists() and out_path.stat().st_size > 0:
        return False
    TMP_DIR.mkdir(parents=True, exist_ok=True)
    silence = TMP_DIR / "silence_350ms.mp3"
    _make_silence(silence)
    pieces: list[pathlib.Path] = []
    for index in range(repeat):
        pieces.append(src)
        if index < repeat - 1:
            pieces.append(silence)
    list_file = TMP_DIR / f"{out_path.stem}_concat.txt"
    list_file.write_text(
        "\n".join(f"file '{piece.resolve().as_posix()}'" for piece in pieces),
        encoding="utf-8",
    )
    subprocess.run(
        ["ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", str(list_file), "-c", "copy", str(out_path)],
        check=True,
        capture_output=True,
    )
    list_file.unlink(missing_ok=True)
    return True


def _variant_map(master: dict[str, Any]) -> dict[str, dict[str, Any]]:
    out: dict[str, dict[str, Any]] = {}
    for phrase in master["phrases"]:
        for variant in phrase["variants"]:
            item = dict(variant)
            item["phraseId"] = phrase["id"]
            item["category"] = phrase["category"]
            item["sourceKoreanPronunciation"] = phrase.get("source_korean_pronunciation", "")
            out[variant["id"]] = item
    return out


def _keyword_days() -> dict[str, list[int]]:
    keyword_days: dict[str, set[int]] = {item["id"]: set() for item in KEYWORDS}
    for day in DAY_PLAN:
        day_variants = set(day["variantIds"])
        for item in KEYWORDS:
            if day_variants.intersection(item["variantIds"]):
                keyword_days[item["id"]].add(day["day"])
    return {key: sorted(value) for key, value in keyword_days.items()}


def _build_index(master: dict[str, Any]) -> dict[str, Any]:
    variants = _variant_map(master)
    keyword_days = _keyword_days()
    sentence_items: list[dict[str, Any]] = []
    for variant_id, variant in sorted(variants.items(), key=lambda kv: [int(part) for part in kv[0].split("-")]):
        audio: dict[str, dict[str, str]] = {}
        for gender in ["male", "female"]:
            audio[gender] = {
                "normal": _relative(_sentence_audio_path(variant_id, gender, "normal")),
                "slow": _relative(_sentence_audio_path(variant_id, gender, "slow")),
                "repeat3": _relative(_sentence_audio_path(variant_id, gender, "repeat3")),
            }
        sentence_items.append(
            {
                "variantId": variant_id,
                "phraseId": variant["phraseId"],
                "category": variant["category"],
                "korean": variant["korean"],
                "english": variant["english"],
                "speech": variant["speech"],
                "audio": audio,
            }
        )

    word_items: list[dict[str, Any]] = []
    for item in KEYWORDS:
        voices = item.get("voices") or ["male", "female"]
        audio = {
            gender: {
                "normal": _relative(_word_audio_path(item["id"], gender, "normal")),
                "slow": _relative(_word_audio_path(item["id"], gender, "slow")),
            }
            for gender in voices
        }
        tier = item.get("tier") or ("core" if item["id"] in CORE_KEYWORD_IDS else "supplemental")
        word_items.append({**item, "tier": tier, "days": keyword_days[item["id"]], "audio": audio})

    return {
        "version": 1,
        "source": _relative(MASTER_PATH),
        "voices": {"male": MALE_VOICE, "female": FEMALE_VOICE},
        "sentenceAudioModes": ["normal", "slow", "repeat3"],
        "wordAudioModes": ["normal", "slow"],
        "days": DAY_PLAN,
        "sentences": sentence_items,
        "keywords": word_items,
    }


async def _generate_sentence_audio(variants: dict[str, dict[str, Any]], execute: bool) -> tuple[int, int]:
    planned = 0
    created = 0
    for variant_id, variant in variants.items():
        for gender, voice in [("male", MALE_VOICE), ("female", FEMALE_VOICE)]:
            text = variant["speech"][gender]["thai"]
            normal = _sentence_audio_path(variant_id, gender, "normal")
            slow = _sentence_audio_path(variant_id, gender, "slow")
            repeat3 = _sentence_audio_path(variant_id, gender, "repeat3")
            planned += 3
            if execute:
                if await _synth(text, voice, normal):
                    created += 1
                if await _synth(text, voice, slow, rate=SLOW_RATE):
                    created += 1
                if _concat_repeat(normal, repeat3):
                    created += 1
    return planned, created


async def _generate_word_audio(execute: bool) -> tuple[int, int]:
    planned = 0
    created = 0
    for item in KEYWORDS:
        for gender in item.get("voices") or ["male", "female"]:
            voice = MALE_VOICE if gender == "male" else FEMALE_VOICE
            text = item["thai"]
            normal = _word_audio_path(item["id"], gender, "normal")
            slow = _word_audio_path(item["id"], gender, "slow")
            planned += 2
            if execute:
                if await _synth(text, voice, normal):
                    created += 1
                if await _synth(text, voice, slow, rate=SLOW_RATE):
                    created += 1
    return planned, created


def _validate_index(index: dict[str, Any]) -> list[str]:
    errors: list[str] = []
    if len(index["days"]) != 25:
        errors.append(f"expected 25 days, got {len(index['days'])}")
    if len(index["sentences"]) != 26:
        errors.append(f"expected 26 sentence variants, got {len(index['sentences'])}")
    if len(index["keywords"]) != len(KEYWORDS):
        errors.append(f"expected {len(KEYWORDS)} keywords, got {len(index['keywords'])}")
    for keyword in index["keywords"]:
        if keyword.get("tier") not in {"core", "supplemental"}:
            errors.append(f"{keyword['id']}: missing or invalid tier")
    for sentence in index["sentences"]:
        for gender in ["male", "female"]:
            thai = sentence["speech"][gender]["thai"]
            romanization = sentence["speech"][gender]["romanization"]
            if thai.endswith("ครับ") and not romanization.endswith("khráp"):
                errors.append(f"{sentence['variantId']} {gender}: ครับ/khráp mismatch")
            if thai.endswith("ค่ะ") and not romanization.endswith("khâ"):
                errors.append(f"{sentence['variantId']} {gender}: ค่ะ/khâ mismatch")
            if thai.endswith("คะ") and not romanization.endswith("khá"):
                errors.append(f"{sentence['variantId']} {gender}: คะ/khá mismatch")
    return errors


def _count_existing_audio(index: dict[str, Any]) -> tuple[int, int]:
    paths: list[str] = []
    for sentence in index["sentences"]:
        for gender_audio in sentence["audio"].values():
            paths.extend(gender_audio.values())
    for keyword in index["keywords"]:
        for gender_audio in keyword["audio"].values():
            paths.extend(gender_audio.values())
    existing = sum(1 for path in paths if (ROOT / path).exists() and (ROOT / path).stat().st_size > 0)
    return existing, len(paths)


def main() -> int:
    parser = argparse.ArgumentParser(description="Generate Thai learning audio assets and index files.")
    parser.add_argument("--execute", action="store_true", help="Generate MP3 files. Without this, only writes the index and reports missing files.")
    parser.add_argument("--index-only", action="store_true", help="Write and validate the index without generating audio.")
    args = parser.parse_args()

    master = _load_master()
    variants = _variant_map(master)
    index = _build_index(master)
    errors = _validate_index(index)
    if errors:
        for error in errors:
            print(f"[ERROR] {error}")
        return 1

    INDEX_PATH.parent.mkdir(parents=True, exist_ok=True)
    INDEX_PATH.write_text(json.dumps(index, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    existing, total = _count_existing_audio(index)
    print(f"[OK] wrote {INDEX_PATH.relative_to(ROOT)}")
    print(f"[INFO] audio files existing={existing}, total={total}, missing={total - existing}")
    if args.index_only:
        return 0

    if not args.execute:
        print("[INFO] dry-run only. Re-run with --execute to synthesize MP3 assets.")
        return 0

    try:
        sentence_planned, sentence_created = asyncio.run(_generate_sentence_audio(variants, execute=True))
        word_planned, word_created = asyncio.run(_generate_word_audio(execute=True))
    except Exception as exc:
        print(f"[ERROR] audio generation failed: {exc}")
        return 1

    existing_after, total_after = _count_existing_audio(index)
    print(
        "[OK] audio generation complete: "
        f"sentences planned={sentence_planned}, created={sentence_created}; "
        f"words planned={word_planned}, created={word_created}; "
        f"existing={existing_after}/{total_after}"
    )
    return 0 if existing_after == total_after else 2


if __name__ == "__main__":
    sys.exit(main())
