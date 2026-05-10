import subprocess
from pathlib import Path

RAW_DIR = Path("raw")
FEATURE_DIR = Path("features")
FEATURE_DIR.mkdir(exist_ok=True)

raw_files = sorted(RAW_DIR.glob("*.bin"))

ready = []

for p in raw_files:
    aria2_file = Path(str(p) + ".aria2")
    if aria2_file.exists():
        print(f"SKIP incomplete: {p.name}")
        continue
    ready.append(p)

print(f"Ready complete .bin files: {len(ready)}")

for p in ready:
    out = FEATURE_DIR / f"{p.stem}.parquet"

    if out.exists():
        print(f"SKIP exists: {out}")
        continue

    cmd = [
        "python",
        "scripts/extract_iq_features_v2.py",
        "--input", str(p),
        "--output", str(out),
        "--window-ms", "10.0",
    ]

    print("\nRUN:", " ".join(cmd))
    subprocess.run(cmd, check=True)
