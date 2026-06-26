#!/usr/bin/env python3
from __future__ import annotations

import argparse
import asyncio
import json
import pathlib
import re
import sys
import time
from typing import Any


ROOT = pathlib.Path(__file__).resolve().parents[1]
SPEC_PATH = ROOT / "assets/generated/pwa/aid1_numbers.json"
AUDIO_DIR = ROOT / "assets/audio/supplements/numbers"

MALE_VOICE = "th-TH-NiwatNeural"
FEMALE_VOICE = "th-TH-PremwadeeNeural"
SLOW_RATE = "-25%"


SECTIONS: list[dict[str, Any]] = [
    {
        "id": "cardinal_0_12",
        "title": "기본 숫자 0-12",
        "items": [
            {"id": "N000", "value": "0", "english": "Zero", "thai": "ศูนย์", "koreanPronunciation": "쑨", "romanization": "sǔun"},
            {"id": "N001", "value": "1", "english": "One", "thai": "หนึ่ง", "koreanPronunciation": "능", "romanization": "nʉ̀eng"},
            {"id": "N002", "value": "2", "english": "Two", "thai": "สอง", "koreanPronunciation": "썽", "romanization": "sǎawng"},
            {"id": "N003", "value": "3", "english": "Three", "thai": "สาม", "koreanPronunciation": "쌈", "romanization": "sǎam"},
            {"id": "N004", "value": "4", "english": "Four", "thai": "สี่", "koreanPronunciation": "씨", "romanization": "sìi"},
            {"id": "N005", "value": "5", "english": "Five", "thai": "ห้า", "koreanPronunciation": "하", "romanization": "hâa"},
            {"id": "N006", "value": "6", "english": "Six", "thai": "หก", "koreanPronunciation": "혹", "romanization": "hòk"},
            {"id": "N007", "value": "7", "english": "Seven", "thai": "เจ็ด", "koreanPronunciation": "쩻", "romanization": "jèt"},
            {"id": "N008", "value": "8", "english": "Eight", "thai": "แปด", "koreanPronunciation": "뺏", "romanization": "bpàet"},
            {"id": "N009", "value": "9", "english": "Nine", "thai": "เก้า", "koreanPronunciation": "까오", "romanization": "gâao"},
            {"id": "N010", "value": "10", "english": "Ten", "thai": "สิบ", "koreanPronunciation": "씹", "romanization": "sìp"},
            {"id": "N011", "value": "11", "english": "Eleven", "thai": "สิบเอ็ด", "koreanPronunciation": "씹엣", "romanization": "sìp-èt"},
            {"id": "N012", "value": "12", "english": "Twelve", "thai": "สิบสอง", "koreanPronunciation": "씹썽", "romanization": "sìp-sǎawng"},
        ],
    },
    {
        "id": "tens",
        "title": "십 단위",
        "items": [
            {"id": "N020", "value": "20", "english": "Twenty", "thai": "ยี่สิบ", "koreanPronunciation": "이씹", "romanization": "yîi-sìp"},
            {"id": "N030", "value": "30", "english": "Thirty", "thai": "สามสิบ", "koreanPronunciation": "쌈씹", "romanization": "sǎam-sìp"},
            {"id": "N040", "value": "40", "english": "Forty", "thai": "สี่สิบ", "koreanPronunciation": "씨씹", "romanization": "sìi-sìp"},
            {"id": "N050", "value": "50", "english": "Fifty", "thai": "ห้าสิบ", "koreanPronunciation": "하씹", "romanization": "hâa-sìp"},
            {"id": "N060", "value": "60", "english": "Sixty", "thai": "หกสิบ", "koreanPronunciation": "혹씹", "romanization": "hòk-sìp"},
            {"id": "N070", "value": "70", "english": "Seventy", "thai": "เจ็ดสิบ", "koreanPronunciation": "쩻씹", "romanization": "jèt-sìp"},
            {"id": "N080", "value": "80", "english": "Eighty", "thai": "แปดสิบ", "koreanPronunciation": "뺏씹", "romanization": "bpàet-sìp"},
            {"id": "N090", "value": "90", "english": "Ninety", "thai": "เก้าสิบ", "koreanPronunciation": "까오씹", "romanization": "gâao-sìp"},
        ],
    },
    {
        "id": "large_numbers",
        "title": "큰 수",
        "items": [
            {"id": "N100", "value": "100", "english": "One hundred", "thai": "หนึ่งร้อย", "koreanPronunciation": "능 러이", "romanization": "nʉ̀eng-róoi"},
            {"id": "N1000", "value": "1,000", "english": "One thousand", "thai": "หนึ่งพัน", "koreanPronunciation": "능 판", "romanization": "nʉ̀eng-phan"},
            {"id": "N10000", "value": "10,000", "english": "Ten thousand", "thai": "หนึ่งหมื่น", "koreanPronunciation": "능 믄", "romanization": "nʉ̀eng-mʉ̀uen"},
            {"id": "N1000000", "value": "1,000,000", "english": "One million", "thai": "หนึ่งล้าน", "koreanPronunciation": "능 란", "romanization": "nʉ̀eng-láan"},
        ],
    },
    {
        "id": "ordinals",
        "title": "서수: 티 + 숫자",
        "items": [
            {"id": "O001", "value": "첫째", "english": "First", "thai": "ที่หนึ่ง", "koreanPronunciation": "티능", "romanization": "thîi-nʉ̀eng"},
            {"id": "O002", "value": "둘째", "english": "Second", "thai": "ที่สอง", "koreanPronunciation": "티썽", "romanization": "thîi-sǎawng"},
            {"id": "O003", "value": "셋째", "english": "Third", "thai": "ที่สาม", "koreanPronunciation": "티쌈", "romanization": "thîi-sǎam"},
            {"id": "O004", "value": "넷째", "english": "Fourth", "thai": "ที่สี่", "koreanPronunciation": "티씨", "romanization": "thîi-sìi"},
            {"id": "O005", "value": "다섯째", "english": "Fifth", "thai": "ที่ห้า", "koreanPronunciation": "티하", "romanization": "thîi-hâa"},
        ],
    },
]


def _safe_id(value: str) -> str:
    return re.sub(r"[^A-Za-z0-9]+", "_", value).strip("_").lower()


def _relative(path: pathlib.Path) -> str:
    return path.relative_to(ROOT).as_posix()


def _audio_path(item_id: str, gender: str, mode: str) -> pathlib.Path:
    return AUDIO_DIR / f"aid1_{_safe_id(item_id)}_{gender}_{mode}.mp3"


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


def build_spec() -> dict[str, Any]:
    sections: list[dict[str, Any]] = []
    for section in SECTIONS:
        items: list[dict[str, Any]] = []
        for item in section["items"]:
            audio = {
                gender: {
                    "normal": _relative(_audio_path(item["id"], gender, "normal")),
                    "slow": _relative(_audio_path(item["id"], gender, "slow")),
                }
                for gender in ["male", "female"]
            }
            items.append({**item, "audio": audio})
        sections.append({**section, "items": items})

    return {
        "version": 1,
        "kind": "pwa_learning_aid_spec",
        "id": "AID1_NUMBERS",
        "aid": 1,
        "title": "학습보조1: 태국어 숫자",
        "subtitle": "9일차 나이 묻기에서 바로 쓰는 숫자 연습",
        "description": "나이를 묻고 대답할 때 필요한 기본 숫자, 십 단위, 큰 수, 서수를 한국식 발음과 TTS로 연습한다.",
        "sourceNote": "사용자 제공 숫자표 기준",
        "voices": {"male": MALE_VOICE, "female": FEMALE_VOICE},
        "audioModes": ["normal", "slow"],
        "backLinks": [{"label": "9일차 나이 묻기로 돌아가기", "href": "?day=9"}],
        "sections": sections,
    }


async def generate_audio(spec: dict[str, Any], execute: bool) -> tuple[int, int]:
    planned = 0
    created = 0
    for section in spec["sections"]:
        for item in section["items"]:
            for gender, voice in [("male", MALE_VOICE), ("female", FEMALE_VOICE)]:
                for mode, rate in [("normal", "+0%"), ("slow", SLOW_RATE)]:
                    planned += 1
                    if execute and await _synth(item["thai"], voice, _audio_path(item["id"], gender, mode), rate=rate):
                        created += 1
    return planned, created


def validate_spec(spec: dict[str, Any], require_audio: bool) -> list[str]:
    errors: list[str] = []
    seen_ids: set[str] = set()
    for section in spec["sections"]:
        if not section.get("items"):
            errors.append(f"{section['id']}: items missing")
        for item in section["items"]:
            item_id = item["id"]
            if item_id in seen_ids:
                errors.append(f"duplicate item id: {item_id}")
            seen_ids.add(item_id)
            for field in ("value", "english", "thai", "koreanPronunciation", "romanization"):
                if not item.get(field):
                    errors.append(f"{item_id}: missing {field}")
            for gender in ["male", "female"]:
                for mode in ["normal", "slow"]:
                    rel_path = item.get("audio", {}).get(gender, {}).get(mode)
                    if not rel_path:
                        errors.append(f"{item_id}: missing audio path {gender}/{mode}")
                    elif require_audio and not (ROOT / rel_path).exists():
                        errors.append(f"{item_id}: audio file missing {gender}/{mode}: {rel_path}")
    if len(seen_ids) != 30:
        errors.append(f"expected 30 number items, got {len(seen_ids)}")
    return errors


def write_spec(spec: dict[str, Any]) -> None:
    SPEC_PATH.parent.mkdir(parents=True, exist_ok=True)
    SPEC_PATH.write_text(json.dumps(spec, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def count_existing_audio(spec: dict[str, Any]) -> tuple[int, int]:
    paths: list[str] = []
    for section in spec["sections"]:
        for item in section["items"]:
            for modes in item["audio"].values():
                paths.extend(modes.values())
    existing = sum(1 for path in paths if (ROOT / path).exists() and (ROOT / path).stat().st_size > 0)
    return existing, len(paths)


def main() -> int:
    parser = argparse.ArgumentParser(description="Build the PWA number learning supplement and Thai TTS audio files.")
    parser.add_argument("--execute", action="store_true", help="Generate MP3 files. Without this, only writes the supplement spec.")
    args = parser.parse_args()

    spec = build_spec()
    errors = validate_spec(spec, require_audio=False)
    if errors:
        for error in errors:
            print(f"[ERROR] {error}")
        return 1

    write_spec(spec)
    existing_before, total = count_existing_audio(spec)
    print(f"[OK] wrote {SPEC_PATH.relative_to(ROOT)}")
    print(f"[INFO] audio files existing={existing_before}, total={total}, missing={total - existing_before}")

    if args.execute:
        try:
            planned, created = asyncio.run(generate_audio(spec, execute=True))
        except Exception as exc:
            print(f"[ERROR] audio generation failed: {exc}")
            return 1
        post_errors = validate_spec(spec, require_audio=True)
        existing_after, total_after = count_existing_audio(spec)
        print(f"[OK] audio generation complete: planned={planned}, created={created}, existing={existing_after}/{total_after}")
        if post_errors:
            for error in post_errors:
                print(f"[ERROR] {error}")
            return 2
    else:
        print("[INFO] dry-run only. Re-run with --execute to synthesize MP3 assets.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
