import subprocess
import sys
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

RAW_DIR = Path("raw")
FEATURE_DIR = Path("features")
LOG_DIR = Path("logs")

FEATURE_DIR.mkdir(exist_ok=True)
LOG_DIR.mkdir(exist_ok=True)

MAX_WORKERS = 4
WINDOW_MS = "10.0"
DTYPE = "int16"

raw_files = sorted(RAW_DIR.glob("*.bin"))
jobs = []

for p in raw_files:
    aria2_file = Path(str(p) + ".aria2")

    if aria2_file.exists():
        print(f"SKIP incomplete: {p.name}")
        continue

    out = FEATURE_DIR / f"{p.stem}.parquet"

    if out.exists():
        print(f"SKIP exists: {out.name}")
        continue

    jobs.append((p, out))

print(f"\nReady files to process: {len(jobs)}")
for p, out in jobs:
    print(f" - {p.name} -> {out.name}")


def run_job(job):
    p, out = job
    log = LOG_DIR / f"{p.stem}.preprocess.log"

    cmd = [
        sys.executable,
        "scripts/extract_iq_features_v2.py",
        "--input", str(p),
        "--output", str(out),
        "--window-ms", WINDOW_MS,
        "--dtype", DTYPE,
    ]

    with open(log, "w", encoding="utf-8") as f:
        f.write("COMMAND: " + " ".join(cmd) + "\n\n")
        f.flush()

        result = subprocess.run(
            cmd,
            stdout=f,
            stderr=subprocess.STDOUT,
            text=True,
        )

    if result.returncode != 0:
        raise RuntimeError(f"FAILED: {p.name}, check log: {log}")

    return out, log


if not jobs:
    print("Nothing to process.")
    raise SystemExit(0)

with ThreadPoolExecutor(max_workers=MAX_WORKERS) as ex:
    futures = [ex.submit(run_job, job) for job in jobs]

    for fut in as_completed(futures):
        out, log = fut.result()
        print(f"DONE: {out} | log: {log}")

print("\nAll completed.")
