from pathlib import Path

raw = Path("raw")
features = Path("features")

print("RAW files:")
if not raw.exists():
    print("raw/ does not exist")
else:
    for p in sorted(raw.glob("*")):
        size_gb = p.stat().st_size / 1024**3
        print(f"{p.name:100s} {size_gb:8.2f} GB")

print("\nCompleted .bin:")
completed = []
if raw.exists():
    for p in sorted(raw.glob("*.bin")):
        if not Path(str(p) + ".aria2").exists():
            completed.append(p)
            print(" -", p.name)

print(f"\nCompleted count: {len(completed)}")

print("\nIncomplete downloads:")
if raw.exists():
    incomplete = sorted(raw.glob("*.aria2"))
    if incomplete:
        for p in incomplete:
            print(" -", p.name)
    else:
        print("brak")

print("\nFeatures:")
if not features.exists():
    print("features/ does not exist")
else:
    for p in sorted(features.glob("*.parquet")):
        size_mb = p.stat().st_size / 1024**2
        print(f"{p.name:100s} {size_mb:8.2f} MB")
