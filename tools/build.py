from pathlib import Path
import csv, json, sys

ROOT = Path(__file__).resolve().parent.parent
CSV_PATH = ROOT / "data" / "stimuli.csv"
AUDIO_MANIFEST = ROOT / "data" / "audio_manifest.json"
OUT_JS = ROOT / "stimuli.js"
OUT_JSON = ROOT / "data" / "stimuli.generated.json"

REQUIRED = [
    "id","text","family","person","function","aux_or_verb","answer",
    "distractor_semantic","distractor_person","distractor_structure","active"
]

def split_pool(value):
    return [x.strip() for x in (value or "").split("|") if x.strip()]

def fail(msg):
    print(f"[ERROR] {msg}")
    sys.exit(1)

audio_manifest = {"items": {}}
if AUDIO_MANIFEST.exists():
    audio_manifest = json.loads(AUDIO_MANIFEST.read_text(encoding="utf-8"))
audio_items = audio_manifest.get("items", {})

with CSV_PATH.open("r", encoding="utf-8-sig", newline="") as f:
    reader = csv.DictReader(f)
    if not reader.fieldnames:
        fail("CSV 没有表头。")
    missing = [x for x in REQUIRED if x not in reader.fieldnames]
    if missing:
        fail("缺少字段: " + ", ".join(missing))
    source = list(reader)

seen = set()
items = []

for lineno, row in enumerate(source, start=2):
    sid = row["id"].strip()
    if not sid:
        fail(f"第 {lineno} 行没有 id。")
    if sid in seen:
        fail(f"重复 id: {sid}")
    seen.add(sid)

    if row["active"].strip() not in {"0","1"}:
        fail(f"{sid}: active 必须是 0 或 1。")
    if row["active"].strip() == "0":
        continue

    text = row["text"].strip()
    answer = row["answer"].strip()
    if not text or not answer:
        fail(f"{sid}: text / answer 不能为空。")

    pools = {
        "semantic": split_pool(row["distractor_semantic"]),
        "person": split_pool(row["distractor_person"]),
        "structure": split_pool(row["distractor_structure"]),
    }

    for name, vals in pools.items():
        if not vals:
            fail(f"{sid}: {name} 干扰项池为空。")
        if answer in vals:
            fail(f"{sid}: 正确答案出现在 {name} 干扰项池。")

    all_d = pools["semantic"] + pools["person"] + pools["structure"]
    if len(set(all_d)) != len(all_d):
        print(f"[WARN] {sid}: 某些干扰项重复。")

    variants = []
    manifest_item = audio_items.get(sid, {})
    for v in manifest_item.get("variants", {}).values():
        path = v.get("path")
        if path and (ROOT / path).exists():
            variants.append({
                "path": path,
                "profile": v.get("profile"),
                "voice": v.get("voice"),
                "gender": v.get("gender"),
                "speedClass": v.get("speedClass"),
                "speakingRate": v.get("speakingRate"),
                "pitch": v.get("pitch"),
            })

    item = {
        "id": sid,
        "text": text,
        "family": row["family"].strip(),
        "person": row["person"].strip(),
        "function": row["function"].strip(),
        "auxOrVerb": row["aux_or_verb"].strip(),
        "answer": answer,
        "distractorPools": pools,
        "audioVariants": variants,
    }

    if row.get("notes","").strip():
        item["notes"] = row["notes"].strip()

    items.append(item)

OUT_JSON.write_text(
    json.dumps(items, ensure_ascii=False, indent=2),
    encoding="utf-8"
)

OUT_JS.write_text(
    "// AUTO-GENERATED. DO NOT EDIT BY HAND.\n"
    "window.STIMULI = "
    + json.dumps(items, ensure_ascii=False, indent=2)
    + ";\n",
    encoding="utf-8"
)

n_with_audio = sum(bool(x["audioVariants"]) for x in items)
print(f"[OK] 读取 {len(source)} 行，生成 {len(items)} 条 active 刺激。")
print(f"[OK] 其中 {n_with_audio} 条已有固定音频变体。")
print(f"[OK] {OUT_JS.name}")
print(f"[OK] {OUT_JSON.relative_to(ROOT)}")
