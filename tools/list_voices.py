from pathlib import Path
import getpass
import json
import os
import urllib.error
import urllib.parse
import urllib.request

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "data" / "google_fr_voices.json"

key = os.environ.get("GOOGLE_CLOUD_TTS_API_KEY", "").strip()
if not key:
    key = getpass.getpass("Google Cloud TTS API Key: ").strip()

url = (
    "https://texttospeech.googleapis.com/v1/voices"
    "?languageCode=fr-FR&key="
    + urllib.parse.quote(key, safe="")
)

try:
    with urllib.request.urlopen(url, timeout=45) as resp:
        payload = json.loads(resp.read().decode("utf-8"))
except urllib.error.HTTPError as e:
    print(e.read().decode("utf-8", errors="replace"))
    raise

voices = payload.get("voices", [])
OUT.write_text(json.dumps(voices, ensure_ascii=False, indent=2), encoding="utf-8")

print(f"[OK] 找到 {len(voices)} 个 fr-FR voices。")
for v in voices:
    print(f"{v.get('name','?'):38} {v.get('ssmlGender','?'):10} {','.join(v.get('languageCodes', []))}")
print(f"[OK] 已保存到 {OUT.relative_to(ROOT)}")
