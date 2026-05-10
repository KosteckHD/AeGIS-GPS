import json
import re
import urllib.request
from pathlib import Path

OUT_DIR = Path("/workspace/gps-spoofing/raw")
OUT_DIR.mkdir(parents=True, exist_ok=True)

# 9 scenariuszy GPS z TUNI2025
RECORDS = [
    ("C5_clean_no_multipath", "15572976"),
    ("SS17_no_multipath_1_spoofer", "15623217"),
    ("SS18_no_multipath_2_spoofers", "15623318"),
    ("SS20_no_multipath_4_spoofers", "15623460"),
    ("C7_clean_multipath", "17413258"),
    ("SS27_multipath_1_spoofer", "15623799"),
    ("SS28_multipath_2_spoofers", "15623920"),
    ("SS29_multipath_4_spoofers", "15624001"),
    ("SS33_delayed_all_prns_spoofed", "17249727"),
]

def safe_name(s: str) -> str:
    s = s.replace("–", "-").replace("—", "-")
    s = re.sub(r"[^\w.\-]+", "_", s, flags=re.UNICODE)
    s = re.sub(r"_+", "_", s)
    return s.strip("_")

aria2_lines = []
manifest = []

for scenario, record_id in RECORDS:
    api_url = f"https://zenodo.org/api/records/{record_id}"
    print(f"Reading {api_url}")

    with urllib.request.urlopen(api_url, timeout=60) as r:
        data = json.load(r)

    for f in data["files"]:
        key = f["key"]
        if not key.lower().endswith(".bin"):
            continue

        url = f["links"].get("content") or f["links"].get("self")
        if not url:
            raise RuntimeError(f"No download URL for {key}")

        out_name = f"{scenario}__{safe_name(key)}"
        size_gb = f.get("size", 0) / 1024**3
        checksum = f.get("checksum", "")

        aria2_lines.append(url)
        aria2_lines.append(f"  dir={OUT_DIR}")
        aria2_lines.append(f"  out={out_name}")

        manifest.append({
            "scenario": scenario,
            "record_id": record_id,
            "original_key": key,
            "out": out_name,
            "size_gb": round(size_gb, 3),
            "checksum": checksum,
            "url": url,
        })

Path("scripts/gps_download_aria2.txt").write_text("\n".join(aria2_lines) + "\n")
Path("scripts/gps_manifest.json").write_text(json.dumps(manifest, indent=2, ensure_ascii=False))

print("\nCreated:")
print("  scripts/gps_download_aria2.txt")
print("  scripts/gps_manifest.json")
print("\nFiles:")
for m in manifest:
    print(f"{m['out']} | {m['size_gb']} GB | {m['checksum']}")
