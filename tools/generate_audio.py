from pathlib import Path
import argparse
import base64
import csv
import getpass
import hashlib
import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

ROOT = Path(__file__).resolve().parent.parent
CSV_PATH = ROOT / "data" / "stimuli.csv"
CONFIG_PATH = ROOT / "config" / "tts_config.json"
MANIFEST_PATH = ROOT / "data" / "audio_manifest.json"
AUDIO_DIR = ROOT / "audio"

API_URL = "https://texttospeech.googleapis.com/v1/text:synthesize"

def load_json(path, default):
    if path.exists():
        return json.loads(path.read_text(encoding="utf-8"))
    return default

def save_json(path, value):
    path.write_text(
        json.dumps(value, ensure_ascii=False, indent=2),
        encoding="utf-8"
    )

def get_api_key():
    key = os.environ.get("GOOGLE_CLOUD_TTS_API_KEY", "").strip()
    if key:
        return key
    print("未检测到环境变量 GOOGLE_CLOUD_TTS_API_KEY。")
    print("你可以现在输入；本程序不会把 Key 写入项目文件。")
    return getpass.getpass("Google Cloud TTS API Key: ").strip()

def fingerprint(text, language_code, encoding, profile):
    payload = {
        "text": text,
        "languageCode": language_code,
        "audioEncoding": encoding,
        "voice": profile["voice"],
        "speakingRate": profile["speakingRate"],
        "pitch": profile["pitch"],
    }
    raw = json.dumps(payload, ensure_ascii=False, sort_keys=True).encode("utf-8")
    return hashlib.sha256(raw).hexdigest()

def synthesize(api_key, text, language_code, encoding, profile):
    body = {
        "input": {"text": text},
        "voice": {
            "languageCode": language_code,
            "name": profile["voice"]
        },
        "audioConfig": {
            "audioEncoding": encoding,
            "speakingRate": profile["speakingRate"],
            "pitch": profile["pitch"]
        }
    }

    url = API_URL + "?key=" + urllib.parse.quote(api_key, safe="")
    req = urllib.request.Request(
        url,
        data=json.dumps(body).encode("utf-8"),
        headers={"Content-Type": "application/json; charset=utf-8"},
        method="POST"
    )

    try:
        with urllib.request.urlopen(req, timeout=45) as resp:
            payload = json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        body_text = e.read().decode("utf-8", errors="replace")
        raise RuntimeError(
            f"Google Cloud TTS 返回 HTTP {e.code}。\n{body_text}\n"
            "请确认：Cloud Text-to-Speech API 已启用、Billing 正常、"
            "API Key 对该 API 有权限/限制配置正确。"
        )
    except urllib.error.URLError as e:
        raise RuntimeError(f"网络请求失败: {e}")

    audio_content = payload.get("audioContent")
    if not audio_content:
        raise RuntimeError("API 返回中没有 audioContent。")

    return base64.b64decode(audio_content)

def main():
    parser = argparse.ArgumentParser(
        description="Generate fixed Google Cloud TTS variants for the French reflex trainer."
    )
    parser.add_argument(
        "--limit", type=int, default=None,
        help="只处理前 N 条 active 刺激；适合第一次测试，例如 --limit 4"
    )
    parser.add_argument(
        "--profiles", default="",
        help="只生成指定 profile，逗号分隔，例如 female_normal,male_normal"
    )
    parser.add_argument(
        "--force", action="store_true",
        help="忽略 fingerprint，强制重生成匹配的音频"
    )
    parser.add_argument(
        "--pause-ms", type=int, default=40,
        help="请求之间暂停的毫秒数，默认 40"
    )
    args = parser.parse_args()

    config = load_json(CONFIG_PATH, {})
    language_code = config.get("languageCode", "fr-FR")
    encoding = config.get("audioEncoding", "MP3")
    profiles = [p for p in config.get("profiles", []) if p.get("enabled", True)]

    wanted = {x.strip() for x in args.profiles.split(",") if x.strip()}
    if wanted:
        profiles = [p for p in profiles if p["id"] in wanted]
        missing = wanted - {p["id"] for p in profiles}
        if missing:
            print("[ERROR] 未找到 profile:", ", ".join(sorted(missing)))
            sys.exit(1)

    if not profiles:
        print("[ERROR] 没有启用的 TTS profile。")
        sys.exit(1)

    with CSV_PATH.open("r", encoding="utf-8-sig", newline="") as f:
        rows = [
            r for r in csv.DictReader(f)
            if r.get("active", "1").strip() == "1"
        ]

    if args.limit is not None:
        rows = rows[:args.limit]

    api_key = get_api_key()
    if not api_key:
        print("[ERROR] API Key 为空。")
        sys.exit(1)

    manifest = load_json(MANIFEST_PATH, {"version": 1, "items": {}})
    manifest.setdefault("version", 1)
    manifest.setdefault("items", {})
    AUDIO_DIR.mkdir(parents=True, exist_ok=True)

    total = len(rows) * len(profiles)
    done = 0
    generated = 0
    skipped = 0

    print(f"准备处理 {len(rows)} 条刺激 × {len(profiles)} 个 profile = {total} 个音频变体。")

    for row in rows:
        sid = row["id"].strip()
        text = row["text"].strip()
        item = manifest["items"].setdefault(sid, {
            "text": text,
            "variants": {}
        })
        item["text"] = text
        item.setdefault("variants", {})

        for profile in profiles:
            pid = profile["id"]
            done += 1

            ext = "mp3" if encoding.upper() == "MP3" else encoding.lower()
            filename = f"{sid.lower()}__{pid}.{ext}"
            rel_path = f"audio/{filename}"
            out_path = ROOT / rel_path
            fp = fingerprint(text, language_code, encoding, profile)

            old = item["variants"].get(pid)
            up_to_date = (
                old
                and old.get("fingerprint") == fp
                and out_path.exists()
            )

            if up_to_date and not args.force:
                skipped += 1
                print(f"[{done}/{total}] SKIP {sid} / {pid}")
                continue

            print(
                f"[{done}/{total}] GEN  {sid} / {pid} "
                f"({profile['voice']}, rate={profile['speakingRate']}, pitch={profile['pitch']})"
            )

            try:
                audio_bytes = synthesize(
                    api_key, text, language_code, encoding, profile
                )
            except Exception as e:
                print("\n[ERROR]", e)
                print("已成功生成的文件和 manifest 会保留；修复后重新运行即可断点续做。")
                save_json(MANIFEST_PATH, manifest)
                sys.exit(1)

            out_path.write_bytes(audio_bytes)

            item["variants"][pid] = {
                "path": rel_path,
                "profile": pid,
                "voice": profile["voice"],
                "gender": profile["gender"],
                "speedClass": profile["speedClass"],
                "speakingRate": profile["speakingRate"],
                "pitch": profile["pitch"],
                "fingerprint": fp
            }

            generated += 1
            save_json(MANIFEST_PATH, manifest)

            if args.pause_ms > 0:
                time.sleep(args.pause_ms / 1000)

    save_json(MANIFEST_PATH, manifest)

    print()
    print(f"[OK] 新生成/更新: {generated}")
    print(f"[OK] 已存在且未变化: {skipped}")
    print(f"[OK] manifest: {MANIFEST_PATH.relative_to(ROOT)}")
    print("接下来运行 build.py，把 audioVariants 写进网页题库。")

if __name__ == "__main__":
    main()
