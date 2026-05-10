import argparse
from pathlib import Path

import numpy as np
import pandas as pd
from tqdm import tqdm


def label_from_name(name: str) -> int:
    lower = name.lower()
    if "clean" in lower or lower.startswith("c5") or lower.startswith("c7"):
        return 0
    return 1


def scenario_from_path(path: Path) -> str:
    return path.stem.split("__")[0]


def get_dtype(dtype_name: str):
    mapping = {
        "int8": np.int8,
        "uint8": np.uint8,
        "int16": np.int16,
        "float32": np.float32,
    }
    return mapping[dtype_name]


def normalize_iq(i, q, dtype_name: str, normalize: bool):
    i = i.astype(np.float64, copy=False)
    q = q.astype(np.float64, copy=False)

    if not normalize:
        return i, q

    if dtype_name == "int8":
        return i / 128.0, q / 128.0

    if dtype_name == "uint8":
        return (i - 127.5) / 127.5, (q - 127.5) / 127.5

    if dtype_name == "int16":
        return i / 32768.0, q / 32768.0

    return i, q


def extract_features(
    input_path: Path,
    output_path: Path,
    sample_rate: float,
    window_ms: float,
    max_windows: int | None,
    stride_windows: int,
    dtype_name: str,
    normalize: bool,
):
    input_path = Path(input_path)
    output_path = Path(output_path)

    if not input_path.exists():
        raise FileNotFoundError(input_path)

    if Path(str(input_path) + ".aria2").exists():
        raise RuntimeError(f"File still downloading: {input_path}.aria2 exists")

    output_path.parent.mkdir(parents=True, exist_ok=True)

    dtype = get_dtype(dtype_name)
    bytes_per_value = np.dtype(dtype).itemsize

    label = label_from_name(input_path.name)
    scenario = scenario_from_path(input_path)

    file_size = input_path.stat().st_size
    value_count = file_size // bytes_per_value
    complex_count = value_count // 2

    win_complex = int(sample_rate * window_ms / 1000.0)
    total_windows = complex_count // win_complex

    if max_windows is not None:
        total_windows = min(total_windows, max_windows)

    window_indices = range(0, total_windows, stride_windows)
    processed_windows = len(range(0, total_windows, stride_windows))

    print(f"Input: {input_path}")
    print(f"Output: {output_path}")
    print(f"Scenario: {scenario}")
    print(f"Label: {label}")
    print(f"Dtype: {dtype_name}")
    print(f"Normalize: {normalize}")
    print(f"Size GB: {file_size / 1024**3:.2f}")
    print(f"Complex samples: {complex_count:,}")
    print(f"Window: {window_ms} ms = {win_complex:,} complex samples")
    print(f"Windows available: {total_windows:,}")
    print(f"Stride windows: {stride_windows}")
    print(f"Windows processed: {processed_windows:,}")

    mm = np.memmap(input_path, dtype=dtype, mode="r")

    rows = []

    for w in tqdm(window_indices, desc=f"features {scenario}"):
        start = w * win_complex * 2
        end = start + win_complex * 2

        raw = mm[start:end]
        if raw.size < win_complex * 2:
            continue

        iq = raw.reshape(-1, 2)

        i, q = normalize_iq(iq[:, 0], iq[:, 1], dtype_name, normalize)

        amp2 = i * i + q * q
        amp = np.sqrt(amp2)

        i_mean = float(np.mean(i))
        q_mean = float(np.mean(q))
        i_std = float(np.std(i))
        q_std = float(np.std(q))

        if i_std > 1e-12 and q_std > 1e-12:
            iq_corr = float(np.mean((i - i_mean) * (q - q_mean)) / (i_std * q_std))
        else:
            iq_corr = 0.0

        power_mean = float(np.mean(amp2))

        rows.append({
            "file": input_path.name,
            "scenario": scenario,
            "window_idx": int(w),
            "time_s": float(w * window_ms / 1000.0),
            "label": int(label),

            "i_mean": i_mean,
            "q_mean": q_mean,
            "i_std": i_std,
            "q_std": q_std,
            "i_abs_mean": float(np.mean(np.abs(i))),
            "q_abs_mean": float(np.mean(np.abs(q))),
            "iq_corr": iq_corr,

            "power_mean": power_mean,
            "power_std": float(np.std(amp2)),
            "power_min": float(np.min(amp2)),
            "power_max": float(np.max(amp2)),
            "power_p50": float(np.percentile(amp2, 50)),
            "power_p90": float(np.percentile(amp2, 90)),
            "power_p99": float(np.percentile(amp2, 99)),

            "amp_mean": float(np.mean(amp)),
            "amp_std": float(np.std(amp)),
            "amp_min": float(np.min(amp)),
            "amp_max": float(np.max(amp)),
            "amp_p50": float(np.percentile(amp, 50)),
            "amp_p90": float(np.percentile(amp, 90)),
            "amp_p99": float(np.percentile(amp, 99)),

            "dc_offset": float(np.sqrt(i_mean * i_mean + q_mean * q_mean)),
            "iq_std_ratio": float(i_std / (q_std + 1e-12)),
            "papr": float(np.max(amp2) / (power_mean + 1e-12)),
        })

    df = pd.DataFrame(rows)
    df.to_parquet(output_path, index=False)

    print(f"Saved: {output_path}")
    print(f"Rows: {len(df):,}")

    if len(df) > 0:
        print(df.groupby(["scenario", "label"]).size())


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--sample-rate", type=float, default=50_000_000)
    parser.add_argument("--window-ms", type=float, default=10.0)
    parser.add_argument("--max-windows", type=int, default=None)
    parser.add_argument("--stride-windows", type=int, default=1)
    parser.add_argument("--dtype", default="int8", choices=["int8", "uint8", "int16", "float32"])
    parser.add_argument("--no-normalize", action="store_true")
    args = parser.parse_args()

    extract_features(
        input_path=Path(args.input),
        output_path=Path(args.output),
        sample_rate=args.sample_rate,
        window_ms=args.window_ms,
        max_windows=args.max_windows,
        stride_windows=args.stride_windows,
        dtype_name=args.dtype,
        normalize=not args.no_normalize,
    )


if __name__ == "__main__":
    main()
