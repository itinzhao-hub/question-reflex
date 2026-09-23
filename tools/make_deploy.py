from pathlib import Path
import shutil
import sys

ROOT = Path(__file__).resolve().parent.parent
DIST = ROOT / "dist"

FILES = [
    "index.html",
    "styles.css",
    "app.js",
    "db.js",
    "pwa.js",
    "stimuli.js",
    "manifest.webmanifest",
    "service-worker.js",
]

DIRS = [
    "audio",
    "icons",
]

missing = []

for name in FILES:
    if not (ROOT / name).exists():
        missing.append(name)

for name in DIRS:
    if not (ROOT / name).exists():
        missing.append(name + "/")

if missing:
    print("[ERROR] 缺少运行文件：")
    for x in missing:
        print(" -", x)
    sys.exit(1)

if DIST.exists():
    shutil.rmtree(DIST)
DIST.mkdir(parents=True)

for name in FILES:
    shutil.copy2(ROOT / name, DIST / name)

for name in DIRS:
    shutil.copytree(ROOT / name, DIST / name)

# Cloudflare/GitHub static hosting does not need Python/tools/data/config.
print("[OK] 已生成干净部署目录：dist/")
print("[OK] 仅包含网页运行文件、icons 和 audio。")
print("[OK] 不包含 CSV、TTS 配置、Python 工具、API Key。")

audio_count = len(list((DIST / "audio").glob("*.mp3")))
print(f"[OK] dist/audio 中 MP3 数量：{audio_count}")

if audio_count == 0:
    print("[WARN] 当前没有 MP3。请先在本地生成固定音频。")
