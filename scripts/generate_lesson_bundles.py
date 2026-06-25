#!/usr/bin/env python3
from __future__ import annotations

import argparse
import hashlib
import json
import pathlib
import re
import sys
from typing import Any


ROOT = pathlib.Path(__file__).resolve().parents[1]
CURRICULUM_PATH = ROOT / "data/thai_curriculum_master.json"
ASSETS_PATH = ROOT / "data/thai_learning_assets_index.json"
SPECS_PATH = ROOT / "data/thai_output_template_specs.json"
IMAGE_MANIFEST_PATH = ROOT / "data/thai_image_source_manifest.json"
OUT_DIR = ROOT / "data/generated"
SPLIT_OUTPUT_DIRS = {
    "kakao": ROOT / "assets/generated/kakao",
    "pwa": ROOT / "assets/generated/pwa",
    "ppt": ROOT / "assets/generated/ppt",
    "print": ROOT / "assets/generated/print",
}


def _load_json(path: pathlib.Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def _file_sha256(path: pathlib.Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def _index_by(items: list[dict[str, Any]], key: str) -> dict[str, dict[str, Any]]:
    return {str(item[key]): item for item in items}


def _sanitize_slug(value: str) -> str:
    slug = re.sub(r"[^a-zA-Z0-9]+", "-", value).strip("-").lower()
    return slug or "item"


def _join_week_map(weeks: list[dict[str, Any]]) -> dict[int, dict[str, Any]]:
    return {int(item["week"]): item for item in weeks}


def _build_scene_lookup(image_manifest: dict[str, Any]) -> dict[str, dict[str, Any]]:
    lookup: dict[str, dict[str, Any]] = {}
    for scene in image_manifest.get("sceneAssets", []):
        for schedule_id in scene.get("useFor", []):
            lookup[schedule_id] = scene
    return lookup


def _relative(path: pathlib.Path) -> str:
    return path.relative_to(ROOT).as_posix()


def _write_json(path: pathlib.Path, data: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def _target_path(relative_path: str) -> pathlib.Path:
    return ROOT / relative_path


def _phrase_bundle(variant_ids: list[str], sentence_map: dict[str, dict[str, Any]]) -> list[dict[str, Any]]:
    return [sentence_map[variant_id] for variant_id in variant_ids if variant_id in sentence_map]


def _keyword_bundle(keyword_ids: list[str], keyword_map: dict[str, dict[str, Any]]) -> list[dict[str, Any]]:
    return [keyword_map[keyword_id] for keyword_id in keyword_ids if keyword_id in keyword_map]


def _image_plan_for_schedule(
    schedule_item: dict[str, Any],
    image_manifest: dict[str, Any],
    scene_lookup: dict[str, dict[str, Any]],
    keyword_items: list[dict[str, Any]],
) -> dict[str, Any]:
    scene = scene_lookup.get(schedule_item["id"])
    keyword_rules = image_manifest.get("keywordImageRules", {})
    prefer_ids = set(keyword_rules.get("preferImageForKeywordIds", []))
    optional_ids = set(keyword_rules.get("optionalImageForKeywordIds", []))
    skip_ids = set(keyword_rules.get("skipImageForKeywordIds", []))

    keyword_images = []
    for keyword in keyword_items:
        keyword_id = keyword["id"]
        if keyword_id in skip_ids:
            continue
        if keyword_id in prefer_ids or keyword_id in optional_ids:
            keyword_images.append(
                {
                    "keywordId": keyword_id,
                    "priority": "preferred" if keyword_id in prefer_ids else "optional",
                    "sourcePlan": [
                        {
                            "type": "local_preferred",
                            "assetPath": f"assets/images/keywords/{keyword_id}.jpg",
                            "status": "missing"
                        },
                        {
                            "type": "stock_preferred",
                            "queries": [
                                f"{keyword['english']} realistic photo",
                                f"{keyword['korean']} learning image"
                            ],
                            "status": "search_required"
                        },
                        {
                            "type": "ai_fallback",
                            "prompt": {
                                "scene": f"single concept image for {keyword['english']}",
                                "peopleAndAction": "show the concept clearly and simply",
                                "setting": "clean realistic learning image",
                                "mood": "warm and easy to recognize",
                                "cameraFraming": "close or medium crop",
                                "lighting": "bright neutral light",
                                "avoidList": image_manifest["qualityRules"]["rejectTraits"]
                            },
                            "status": "generate_if_needed"
                        }
                    ]
                }
            )

    if scene:
        scene_asset_path = pathlib.Path(f"assets/images/scenes/{scene['sceneId']}.jpg")
        primary_image = {
            "sceneId": scene["sceneId"],
            "altTextKo": scene["altTextKo"],
            "sourcePlan": [
                {
                    "type": "local_preferred",
                    "assetPath": str(scene_asset_path).replace("\\", "/"),
                    "status": "ready" if (ROOT / scene_asset_path).exists() else "missing"
                },
                {
                    "type": "stock_preferred",
                    "queries": scene["stockSearchQueries"],
                    "status": "search_required"
                },
                {
                    "type": "ai_fallback",
                    "prompt": scene["aiPrompt"],
                    "status": "generate_if_needed"
                }
            ]
        }
    else:
        primary_image = {
            "sceneId": None,
            "altTextKo": f"{schedule_item['title']} 학습 장면",
            "sourcePlan": [
                {
                    "type": "stock_preferred",
                    "queries": [schedule_item["title"], schedule_item.get("story", schedule_item.get("roleplayScene", ""))],
                    "status": "search_required"
                },
                {
                    "type": "ai_fallback",
                    "prompt": {
                        "scene": schedule_item["title"],
                        "peopleAndAction": schedule_item.get("story", schedule_item.get("roleplayScene", "")),
                        "setting": "Thai church or daily-life mission context",
                        "mood": "warm, respectful, practical",
                        "cameraFraming": "documentary style",
                        "lighting": "bright natural light",
                        "avoidList": image_manifest["qualityRules"]["rejectTraits"]
                    },
                    "status": "generate_if_needed"
                }
            ]
        }
    return {
        "primaryImage": primary_image,
        "keywordImages": keyword_images
    }


def _weekday_bundle(
    item: dict[str, Any],
    week_info: dict[str, Any],
    sentence_map: dict[str, dict[str, Any]],
    keyword_map: dict[str, dict[str, Any]],
    specs: dict[str, Any],
    image_manifest: dict[str, Any],
    scene_lookup: dict[str, dict[str, Any]],
) -> dict[str, Any]:
    new_phrases = _phrase_bundle(item.get("newPhraseVariantIds", []), sentence_map)
    review_phrases = _phrase_bundle(item.get("reviewVariantIds", []), sentence_map)
    keywords = _keyword_bundle(item.get("keyWordIds", []), keyword_map)
    image_plan = _image_plan_for_schedule(item, image_manifest, scene_lookup, keywords)
    day_number = item.get("day")
    slug = _sanitize_slug(item["id"])
    return {
        "id": item["id"],
        "dayType": item["dayType"],
        "week": item["week"],
        "day": day_number,
        "theme": week_info["theme"],
        "title": item["title"],
        "hook": item["hook"],
        "story": item["story"],
        "missionGoal": item["missionGoal"],
        "ministryGuide": item["ministryGuide"],
        "speakingMission": item["speakingMission"],
        "newPhrases": new_phrases,
        "reviewPhrases": review_phrases,
        "keywords": keywords,
        "images": image_plan,
        "delivery": {
            "kakaoCardTemplate": specs["templates"]["kakaoCard"],
            "pwaTemplate": specs["templates"]["pwaLesson"],
            "outputTargets": {
                "kakaoCardSpecPath": f"assets/generated/kakao/{slug}.json",
                "pwaLessonSpecPath": f"assets/generated/pwa/{slug}.json"
            }
        }
    }


def _weekend_bundle(
    item: dict[str, Any],
    week_info: dict[str, Any],
    sentence_map: dict[str, dict[str, Any]],
    keyword_map: dict[str, dict[str, Any]],
    specs: dict[str, Any],
    image_manifest: dict[str, Any],
    scene_lookup: dict[str, dict[str, Any]],
) -> dict[str, Any]:
    review_ids = item.get("reviewVariantIds", item.get("roleplayFocusVariantIds", []))
    phrases = _phrase_bundle(review_ids, sentence_map)
    keywords = _keyword_bundle(item.get("keyWordIds", []), keyword_map)
    image_plan = _image_plan_for_schedule(item, image_manifest, scene_lookup, keywords)
    slug = _sanitize_slug(item["id"])
    base = {
        "id": item["id"],
        "dayType": item["dayType"],
        "week": item["week"],
        "theme": week_info["theme"],
        "title": item["title"],
        "missionGoal": item["missionGoal"],
        "ministryGuide": item["ministryGuide"],
        "phrases": phrases,
        "keywords": keywords,
        "images": image_plan
    }
    if item["dayType"] == "saturday":
        context_header = {
            "lessonGoal": item["missionGoal"],
            "learnersHaveCovered": f"학습자는 {item['week']}주차 평일 표현과 이번 주 누적 복습을 마친 상태다.",
            "successLooksLike": "학습자가 남성형/여성형 어미를 구분하며 핵심 표현을 짝과 함께 소리 내어 말하고, 따뜻한 선교적 태도로 역할극에 참여하면 성공이다."
        }
        base.update(
            {
                "roleplayScene": item["roleplayScene"],
                "teacherFlow": item["teacherFlow"],
                "contextHeader": context_header,
                "delivery": {
                    "pptTemplate": specs["templates"]["saturdayPpt"],
                    "teacherScriptTemplate": specs["templates"]["teacherScript"],
                    "outputTargets": {
                        "pptSpecPath": f"assets/generated/ppt/{slug}.json",
                        "teacherScriptSpecPath": f"assets/generated/ppt/{slug}_script.json"
                    }
                }
            }
        )
    else:
        base.update(
            {
                "personalMission": item["personalMission"],
                "delivery": {
                    "kakaoCardTemplate": specs["templates"]["kakaoCard"],
                    "reviewSheetTemplate": specs["templates"]["reviewSheet"],
                    "outputTargets": {
                        "kakaoCardSpecPath": f"assets/generated/kakao/{slug}.json",
                        "reviewSheetSpecPath": f"assets/generated/print/{slug}.json"
                    }
                }
            }
        )
    return base


def generate_bundles() -> dict[str, Any]:
    curriculum = _load_json(CURRICULUM_PATH)
    assets = _load_json(ASSETS_PATH)
    specs = _load_json(SPECS_PATH)
    image_manifest = _load_json(IMAGE_MANIFEST_PATH)

    week_map = _join_week_map(curriculum["weeks"])
    sentence_map = _index_by(assets["sentences"], "variantId")
    keyword_map = _index_by(assets["keywords"], "id")
    scene_lookup = _build_scene_lookup(image_manifest)

    weekdays: list[dict[str, Any]] = []
    saturdays: list[dict[str, Any]] = []
    sundays: list[dict[str, Any]] = []

    for item in curriculum["schedule"]:
        week_info = week_map[int(item["week"])]
        if item["dayType"] == "weekday":
            weekdays.append(_weekday_bundle(item, week_info, sentence_map, keyword_map, specs, image_manifest, scene_lookup))
        else:
            bundle = _weekend_bundle(item, week_info, sentence_map, keyword_map, specs, image_manifest, scene_lookup)
            if item["dayType"] == "saturday":
                saturdays.append(bundle)
            else:
                sundays.append(bundle)

    return {
        "version": 1,
        "sourceFiles": {
            "curriculum": _relative(CURRICULUM_PATH),
            "assets": _relative(ASSETS_PATH),
            "templateSpecs": _relative(SPECS_PATH),
            "imageManifest": _relative(IMAGE_MANIFEST_PATH)
        },
        "sourceHashes": {
            "curriculum": _file_sha256(CURRICULUM_PATH),
            "assets": _file_sha256(ASSETS_PATH),
            "templateSpecs": _file_sha256(SPECS_PATH),
            "imageManifest": _file_sha256(IMAGE_MANIFEST_PATH)
        },
        "bundles": {
            "weekdayLessons": weekdays,
            "saturdayLessons": saturdays,
            "sundayReviews": sundays
        }
    }


def validate_bundle(bundle: dict[str, Any]) -> list[str]:
    errors: list[str] = []
    bundles = bundle["bundles"]
    if len(bundles["weekdayLessons"]) != 25:
        errors.append(f"weekday lesson count expected 25 got {len(bundles['weekdayLessons'])}")
    if len(bundles["saturdayLessons"]) != 5:
        errors.append(f"saturday lesson count expected 5 got {len(bundles['saturdayLessons'])}")
    if len(bundles["sundayReviews"]) != 5:
        errors.append(f"sunday review count expected 5 got {len(bundles['sundayReviews'])}")

    for group_name in ["weekdayLessons", "saturdayLessons", "sundayReviews"]:
        for item in bundles[group_name]:
            if not item["images"]["primaryImage"]["sourcePlan"]:
                errors.append(f"{item['id']} primary image plan missing")
            source_types = [entry["type"] for entry in item["images"]["primaryImage"]["sourcePlan"]]
            if source_types[0] not in {"local_preferred", "stock_preferred"}:
                errors.append(f"{item['id']} primary image priority invalid")
            if "ai_fallback" not in source_types:
                errors.append(f"{item['id']} missing ai fallback")
            if group_name == "weekdayLessons" and item["dayType"] != "weekday":
                errors.append(f"{item['id']} weekday group mismatch")
    return errors


def _kakao_spec(item: dict[str, Any]) -> dict[str, Any]:
    review = item.get("reviewPhrases", item.get("phrases", []))
    phrases = item.get("newPhrases") or review or item.get("phrases", [])
    core_keywords = [keyword for keyword in item["keywords"] if keyword.get("tier") == "core"]
    supplemental_keywords = [keyword for keyword in item["keywords"] if keyword.get("tier") == "supplemental"]
    kakao_template = item["delivery"]["kakaoCardTemplate"]
    content_mode = "review_recap" if item["dayType"] == "sunday" or not item.get("newPhrases") else "daily_lesson"
    return {
        "version": 1,
        "kind": "kakao_card_spec",
        "id": item["id"],
        "dayType": item["dayType"],
        "contentMode": content_mode,
        "sundayFormat": kakao_template.get("sundayFormat"),
        "contentSource": kakao_template.get("sundayFormat", {}).get("contentSource") if item["dayType"] == "sunday" else {
            "phrases": "Weekday lesson newPhrases rendered as mainPhrases; review-only weekdays fall back to reviewPhrases.",
            "keywords": "Weekday lesson keyWordIds filtered through displayKeywords.",
            "missionText": "Weekday speakingMission rendered as the main action box.",
            "ministryGuide": "Weekday ministryGuide rendered as the relational guide line."
        },
        "week": item["week"],
        "day": item.get("day"),
        "theme": item["theme"],
        "title": item["title"],
        "hook": item.get("hook", item.get("personalMission", "")),
        "missionGoal": item["missionGoal"],
        "ministryGuide": item["ministryGuide"],
        "speakingMission": item.get("speakingMission", item.get("personalMission", "")),
        "primaryImage": item["images"]["primaryImage"],
        "keywordImages": item["images"]["keywordImages"],
        "mainPhrases": phrases,
        "reviewPhrases": review[:4],
        "keywords": item["keywords"][:6],
        "displayKeywords": core_keywords[:4] or item["keywords"][:4],
        "supplementalKeywords": supplemental_keywords,
        "keywordDisplayPolicy": {
            "default": "core_only",
            "toggleSupplemental": False
        },
        "audioModes": ["normal", "slow", "repeat3"],
        "layout": {
            "canvas": {"width": 1080, "height": 1350},
            "sections": ["header", "heroImage", "mainPhrases", "reviewStrip", "keywordStrip", "missionBox", "footer"]
        }
    }


def _pwa_spec(item: dict[str, Any]) -> dict[str, Any]:
    core_keywords = [keyword for keyword in item["keywords"] if keyword.get("tier") == "core"]
    supplemental_keywords = [keyword for keyword in item["keywords"] if keyword.get("tier") == "supplemental"]
    pwa_template = item["delivery"]["pwaTemplate"]
    return {
        "version": 1,
        "kind": "pwa_lesson_spec",
        "id": item["id"],
        "week": item["week"],
        "day": item["day"],
        "theme": item["theme"],
        "title": item["title"],
        "hook": item["hook"],
        "story": item["story"],
        "missionGoal": item["missionGoal"],
        "ministryGuide": item["ministryGuide"],
        "speakingMission": item["speakingMission"],
        "primaryImage": item["images"]["primaryImage"],
        "keywordImages": item["images"]["keywordImages"],
        "newPhrases": item["newPhrases"],
        "reviewPhrases": item["reviewPhrases"],
        "keywords": item["keywords"],
        "displayKeywords": core_keywords,
        "supplementalKeywords": supplemental_keywords,
        "keywordDisplayPolicy": {
            "default": "core_only",
            "toggleSupplemental": True,
            "emptyCoreFallback": "show_first_three_keywords"
        },
        "learnerProfile": pwa_template["learnerProfile"],
        "statePolicy": pwa_template["statePolicy"],
        "imageMissingFallback": pwa_template["imageMissingFallback"],
        "controls": {
            "sentenceAudioModes": ["normal", "slow", "repeat3"],
            "wordAudioModes": ["normal", "slow"],
            "speakerModes": ["male", "female"],
            "audioSpeedControlPlacement": pwa_template.get("controls", {}).get("audioSpeedControlPlacement")
        },
        "completion": {
            "checkAction": "lesson_complete",
            "shareAction": "open_kakao_share_card",
            "nextAction": "next_day_or_review"
        }
    }


def _ppt_spec(item: dict[str, Any]) -> dict[str, Any]:
    return {
        "version": 1,
        "kind": "saturday_ppt_spec",
        "id": item["id"],
        "week": item["week"],
        "theme": item["theme"],
        "title": item["title"],
        "roleplayScene": item["roleplayScene"],
        "missionGoal": item["missionGoal"],
        "ministryGuide": item["ministryGuide"],
        "primaryImage": item["images"]["primaryImage"],
        "keywordImages": item["images"]["keywordImages"],
        "phrases": item["phrases"],
        "keywords": item["keywords"],
        "slides": [
            {"slide": 1, "type": "opening_scene"},
            {"slide": 2, "type": "core_phrases"},
            {"slide": 3, "type": "keywords_with_images"},
            {"slide": 4, "type": "male_female_practice"},
            {"slide": 5, "type": "roleplay_steps"},
            {"slide": 6, "type": "ministry_guide"},
            {"slide": 7, "type": "practice_round"},
            {"slide": 8, "type": "sendoff"}
        ]
    }


def _teacher_script_spec(item: dict[str, Any]) -> dict[str, Any]:
    return {
        "version": 1,
        "kind": "teacher_script_spec",
        "id": item["id"],
        "week": item["week"],
        "title": item["title"],
        "roleplayScene": item["roleplayScene"],
        "contextHeader": item["contextHeader"],
        "missionGoal": item["missionGoal"],
        "ministryGuide": item["ministryGuide"],
        "teacherFlow": item["teacherFlow"],
        "phrases": item["phrases"],
        "keywords": item["keywords"],
        "imageNotes": {
            "primaryImage": item["images"]["primaryImage"],
            "keywordImages": item["images"]["keywordImages"]
        },
        "scriptSections": [
            "lesson_objective",
            "opening_words",
            "phrase_coaching_notes",
            "male_female_ending_reminder",
            "image_cue_notes",
            "roleplay_instructions",
            "ministry_guide_summary",
            "closing_encouragement"
        ]
    }


def _review_sheet_spec(item: dict[str, Any]) -> dict[str, Any]:
    return {
        "version": 1,
        "kind": "review_sheet_spec",
        "id": item["id"],
        "week": item["week"],
        "theme": item["theme"],
        "title": item["title"],
        "missionGoal": item["missionGoal"],
        "ministryGuide": item["ministryGuide"],
        "personalMission": item["personalMission"],
        "primaryImage": item["images"]["primaryImage"],
        "keywordImages": item["images"]["keywordImages"],
        "phrases": item["phrases"],
        "keywords": item["keywords"],
        "print": {
            "pageSize": "A4",
            "orientation": "portrait",
            "sections": ["weekSummary", "corePhrases", "keywordBoxes", "writeAndSpeak", "prayerAndBlessing"]
        }
    }


def write_split_specs(bundle: dict[str, Any]) -> dict[str, Any]:
    manifest: dict[str, Any] = {
        "version": 1,
        "generatedFrom": "data/generated/thai_lesson_bundles.json",
        "sourceHashes": bundle.get("sourceHashes", {}),
        "files": []
    }

    for item in bundle["bundles"]["weekdayLessons"]:
        kakao_path = _target_path(item["delivery"]["outputTargets"]["kakaoCardSpecPath"])
        pwa_path = _target_path(item["delivery"]["outputTargets"]["pwaLessonSpecPath"])
        _write_json(kakao_path, _kakao_spec(item))
        _write_json(pwa_path, _pwa_spec(item))
        manifest["files"].append({"id": item["id"], "kind": "kakao_card_spec", "path": _relative(kakao_path)})
        manifest["files"].append({"id": item["id"], "kind": "pwa_lesson_spec", "path": _relative(pwa_path)})

    for item in bundle["bundles"]["saturdayLessons"]:
        ppt_path = _target_path(item["delivery"]["outputTargets"]["pptSpecPath"])
        script_path = _target_path(item["delivery"]["outputTargets"]["teacherScriptSpecPath"])
        _write_json(ppt_path, _ppt_spec(item))
        _write_json(script_path, _teacher_script_spec(item))
        manifest["files"].append({"id": item["id"], "kind": "saturday_ppt_spec", "path": _relative(ppt_path)})
        manifest["files"].append({"id": item["id"], "kind": "teacher_script_spec", "path": _relative(script_path)})

    for item in bundle["bundles"]["sundayReviews"]:
        kakao_path = _target_path(item["delivery"]["outputTargets"]["kakaoCardSpecPath"])
        print_path = _target_path(item["delivery"]["outputTargets"]["reviewSheetSpecPath"])
        _write_json(kakao_path, _kakao_spec(item))
        _write_json(print_path, _review_sheet_spec(item))
        manifest["files"].append({"id": item["id"], "kind": "kakao_card_spec", "path": _relative(kakao_path)})
        manifest["files"].append({"id": item["id"], "kind": "review_sheet_spec", "path": _relative(print_path)})

    manifest_path = OUT_DIR / "output_specs_manifest.json"
    _write_json(manifest_path, manifest)
    return manifest


def validate_split_specs(manifest: dict[str, Any]) -> list[str]:
    errors: list[str] = []
    expected_counts = {
        "kakao_card_spec": 30,
        "pwa_lesson_spec": 25,
        "saturday_ppt_spec": 5,
        "teacher_script_spec": 5,
        "review_sheet_spec": 5,
    }
    actual_counts: dict[str, int] = {}
    for entry in manifest["files"]:
        actual_counts[entry["kind"]] = actual_counts.get(entry["kind"], 0) + 1
        path = ROOT / entry["path"]
        if not path.exists():
            errors.append(f"split spec missing: {entry['path']}")
            continue
        try:
            data = _load_json(path)
        except Exception as exc:
            errors.append(f"split spec invalid json: {entry['path']} ({exc})")
            continue
        if data.get("kind") != entry["kind"]:
            errors.append(f"kind mismatch: {entry['path']}")
        if not data.get("primaryImage") and entry["kind"] != "teacher_script_spec":
            errors.append(f"primary image missing: {entry['path']}")
    for kind, expected in expected_counts.items():
        actual = actual_counts.get(kind, 0)
        if actual != expected:
            errors.append(f"{kind} expected {expected} got {actual}")
    return errors


def main() -> int:
    parser = argparse.ArgumentParser(description="Generate first-pass lesson bundles for Kakao cards, PWA lessons, Saturday teaching packs, and Sunday reviews.")
    parser.add_argument(
        "--out",
        type=pathlib.Path,
        default=OUT_DIR / "thai_lesson_bundles.json",
        help="Output bundle path"
    )
    parser.add_argument(
        "--no-split",
        action="store_true",
        help="Only write the consolidated bundle, without individual output spec files."
    )
    args = parser.parse_args()

    bundle = generate_bundles()
    errors = validate_bundle(bundle)
    if errors:
        for error in errors:
            print(f"[ERROR] {error}")
        return 1

    _write_json(args.out, bundle)
    print(f"[OK] wrote {args.out.relative_to(ROOT)}")
    split_count = 0
    if not args.no_split:
        manifest = write_split_specs(bundle)
        split_errors = validate_split_specs(manifest)
        if split_errors:
            for error in split_errors:
                print(f"[ERROR] {error}")
            return 1
        split_count = len(manifest["files"])
        print(f"[OK] wrote {split_count} split output specs")
    print(
        "[INFO] bundles: "
        f"weekday={len(bundle['bundles']['weekdayLessons'])}, "
        f"saturday={len(bundle['bundles']['saturdayLessons'])}, "
        f"sunday={len(bundle['bundles']['sundayReviews'])}, "
        f"splitSpecs={split_count}"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
