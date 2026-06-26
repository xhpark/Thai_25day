#!/usr/bin/env python3
from __future__ import annotations

import hashlib
import json
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]


def load_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def file_hash(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def check_audio(owner: str, item: dict[str, Any], errors: list[str]) -> None:
    item_id = item.get("variantId") or item.get("id") or "unknown"
    for gender, modes in item.get("audio", {}).items():
        for mode, rel_path in modes.items():
            if not (ROOT / rel_path).exists():
                errors.append(f"{owner}: missing audio for {item_id} {gender}/{mode}: {rel_path}")


def check_learning_aid(errors: list[str]) -> None:
    aid_path = ROOT / "assets/generated/pwa/aid1_numbers.json"
    if not aid_path.exists():
        errors.append("missing learning aid spec: assets/generated/pwa/aid1_numbers.json")
        return
    aid = load_json(aid_path)
    if aid.get("kind") != "pwa_learning_aid_spec":
        errors.append(f"{aid_path.relative_to(ROOT)}: invalid kind {aid.get('kind')}")
    item_count = 0
    for section in aid.get("sections", []):
        for item in section.get("items", []):
            item_count += 1
            check_audio(aid["id"], item, errors)
    if item_count != 30:
        errors.append(f"{aid['id']}: expected 30 number items, got {item_count}")


def main() -> int:
    errors: list[str] = []

    curriculum = load_json(ROOT / "data/thai_curriculum_master.json")
    phrases = load_json(ROOT / "data/thai_master_phrases.json")
    assets = load_json(ROOT / "data/thai_learning_assets_index.json")
    image_manifest = load_json(ROOT / "data/thai_image_source_manifest.json")
    bundles = load_json(ROOT / "data/generated/thai_lesson_bundles.json")
    output_manifest = load_json(ROOT / "data/generated/output_specs_manifest.json")

    expected_hashes = {
        "curriculum": file_hash(ROOT / "data/thai_curriculum_master.json"),
        "assets": file_hash(ROOT / "data/thai_learning_assets_index.json"),
        "templateSpecs": file_hash(ROOT / "data/thai_output_template_specs.json"),
        "imageManifest": file_hash(ROOT / "data/thai_image_source_manifest.json"),
    }
    for key, expected in expected_hashes.items():
        if bundles["sourceHashes"].get(key) != expected:
            errors.append(f"bundle source hash stale: {key}")
        if output_manifest["sourceHashes"].get(key) != expected:
            errors.append(f"output manifest source hash stale: {key}")

    variant_ids = {str(variant["id"]) for phrase in phrases["phrases"] for variant in phrase["variants"]}
    keyword_ids = {str(keyword["id"]) for keyword in assets["keywords"]}
    schedule_ids = {item["id"] for item in curriculum["schedule"]}

    for item in curriculum["schedule"]:
        for field in ("newPhraseVariantIds", "reviewVariantIds", "roleplayFocusVariantIds"):
            for variant_id in item.get(field, []):
                if str(variant_id) not in variant_ids:
                    errors.append(f"{item['id']}: unknown phrase variant in {field}: {variant_id}")
        for keyword_id in item.get("keyWordIds", []):
            if str(keyword_id) not in keyword_ids:
                errors.append(f"{item['id']}: unknown keyword: {keyword_id}")

    weekday_lessons = bundles["bundles"]["weekdayLessons"]
    new_days = [item["day"] for item in weekday_lessons if item.get("newPhrases")]
    review_days = [item["day"] for item in weekday_lessons if not item.get("newPhrases") and item.get("reviewPhrases")]
    if new_days != list(range(1, 21)):
        errors.append(f"new sentence days expected 1-20, got {new_days}")
    if review_days != list(range(21, 26)):
        errors.append(f"review-only days expected 21-25, got {review_days}")

    for entry in output_manifest["files"]:
        path = ROOT / entry["path"]
        if not path.exists():
            errors.append(f"missing split spec file: {entry['path']}")
            continue
        data = load_json(path)
        if data.get("id") != entry["id"]:
            errors.append(f"{entry['path']}: id mismatch expected {entry['id']} got {data.get('id')}")
        if entry["kind"] == "kakao_card_spec" and not data.get("mainPhrases"):
            errors.append(f"{entry['id']}: kakao mainPhrases is empty")

    for group in ("weekdayLessons", "saturdayPacks", "sundayReviews"):
        for bundle in bundles["bundles"].get(group, []):
            for collection in ("newPhrases", "reviewPhrases", "roleplayFocusPhrases", "keywords"):
                for item in bundle.get(collection, []):
                    check_audio(bundle["id"], item, errors)

    for scene in image_manifest.get("sceneAssets", []):
        for schedule_id in scene.get("useFor", []):
            if schedule_id not in schedule_ids:
                errors.append(f"{scene['sceneId']}: unknown useFor schedule id {schedule_id}")
        local_asset = scene.get("localAsset")
        if local_asset and not (ROOT / local_asset).exists():
            errors.append(f"{scene['sceneId']}: missing local image {local_asset}")

    check_learning_aid(errors)

    if errors:
        print("[FAIL] asset link validation failed")
        for error in errors:
            print(f"- {error}")
        return 1

    print("[OK] asset links valid")
    print("[OK] weekday new sentence days: 1-20")
    print("[OK] weekday review-only days: 21-25")
    print("[OK] split specs, audio files, and image schedule references are consistent")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
