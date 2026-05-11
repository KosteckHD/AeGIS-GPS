import asyncio
import json
import time
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse


app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

BASE_DIR = Path(__file__).resolve().parent
CSV_PATH = BASE_DIR / "av datasets" / "final_test_data2.csv"
MODEL_PATH = BASE_DIR / "xgboost_gps_spoofing_model_v2.joblib"
GROUP_COL = "Measurement_ID"

print(f"Loading stream data: {CSV_PATH}")
df = pd.read_csv(CSV_PATH)
df.columns = df.columns.str.strip()

if "Measurement_ID" in df.columns and "Run Time" in df.columns:
    df = df.sort_values(by=["Run Time", "Measurement_ID"])
else:
    print("Warning: Missing Measurement_ID or Run Time. Stream data was not sorted.")

print(f"Loading model package: {MODEL_PATH}")
model_package = joblib.load(MODEL_PATH)
model = model_package["model"]
imputer = model_package["imputer"]
feature_columns = model_package["feature_columns"]
model_threshold = float(model_package.get("threshold", 0.5))
raw_records = df.to_dict(orient="records")

DELTA_COLS = [
    "Roll (deg)",
    "Pitch (deg)",
    "Heading (deg)",
    "Yaw (deg)",
    "Yaw Rate (deg/s)",
    "GPS Latitude",
    "GPS Longitude",
    "GPS HDOP",
    "GPS VDOP",
    "GPS Course",
    "Satellite Count",
    "Satellite Locks",
    "Longitudinal Position (m)",
    "Lateral Position (m)",
    "Vertical Position (m)",
    "Longitudinal Velocity (m/s)",
    "Lateral Velocity (m/s)",
    "Vertical Velocity (m/s)",
    "Distance To Home (m)",
    "Heading To Home (deg)",
    "X-Track Error (m)",
]

ROLLING_COLS = [
    "GPS HDOP",
    "GPS Course",
    "Satellite Count",
    "Longitudinal Velocity (m/s)",
    "Lateral Velocity (m/s)",
    "Vertical Velocity (m/s)",
    "X-Track Error (m)",
]
ROLLING_WINDOWS = [3, 5, 10]


class RealtimeFeatureState:
    def __init__(self):
        self.previous_by_group = {}
        self.history_by_group = {}
        self.scored_count = 0


def _numeric(value):
    if value is None or pd.isna(value):
        return np.nan
    try:
        return float(value)
    except (TypeError, ValueError):
        return np.nan


def score_record(record, state: RealtimeFeatureState):
    start = time.perf_counter()
    group_id = record.get(GROUP_COL, "GLOBAL")
    previous = state.previous_by_group.get(group_id, {})
    history = state.history_by_group.setdefault(group_id, {})
    features = dict(record)

    for col in DELTA_COLS:
        if col in record:
            current_value = _numeric(record.get(col))
            previous_value = _numeric(previous.get(col))
            features[f"delta_{col}"] = 0.0 if np.isnan(previous_value) or np.isnan(current_value) else current_value - previous_value

    for col in ROLLING_COLS:
        if col in record:
            values = history.setdefault(col, [])
            current_value = _numeric(record.get(col))
            if not np.isnan(current_value):
                values.append(current_value)
                del values[:-max(ROLLING_WINDOWS)]

            for window in ROLLING_WINDOWS:
                window_values = values[-window:]
                if window_values:
                    features[f"{col}_roll_mean_{window}"] = float(np.mean(window_values))
                    features[f"{col}_roll_std_{window}"] = float(np.std(window_values, ddof=1)) if len(window_values) > 1 else 0.0
                else:
                    features[f"{col}_roll_mean_{window}"] = np.nan
                    features[f"{col}_roll_std_{window}"] = 0.0

    X = pd.DataFrame([features]).reindex(columns=feature_columns, fill_value=np.nan)
    X_imp = imputer.transform(X)
    probability = float(model.predict_proba(X_imp)[0, 1])
    latency_ms = (time.perf_counter() - start) * 1000

    state.previous_by_group[group_id] = dict(record)
    state.scored_count += 1

    scored = dict(record)
    scored["Probability"] = probability
    scored["Model Prediction"] = int(probability >= model_threshold)
    scored["Model Threshold"] = model_threshold
    scored["Model Source"] = MODEL_PATH.name
    scored["Inference Mode"] = "realtime-single-row"
    scored["Inference Latency (ms)"] = round(latency_ms, 3)
    scored["Realtime Scored Count"] = state.scored_count
    return scored


def score_records_until(stop_index: int):
    state = RealtimeFeatureState()
    scored = []
    for record in raw_records[:stop_index]:
        scored.append(score_record(record, state))
    return scored


def clean_dict(record):
    return {
        key: None if pd.isna(value) or value in [float("inf"), float("-inf")] else value
        for key, value in record.items()
    }


@app.get("/")
def root():
    return {
        "message": "Live-time API is running",
        "total_records": len(raw_records),
        "model": MODEL_PATH.name,
        "threshold": model_threshold,
        "inference_mode": "realtime-single-row",
        "endpoints": [
            "/stream - Server-Sent Events live stream",
            "/data?skip=0&limit=100 - paginated data",
        ],
    }


@app.get("/stream")
async def stream_data():
    async def data_generator():
        state = RealtimeFeatureState()
        last_time = None
        for record in raw_records:
            scored = score_record(record, state)
            cleaned = clean_dict(scored)
            current_time = cleaned.get("Run Time")

            if last_time is not None and current_time != last_time:
                await asyncio.sleep(1.0)

            yield f"data: {json.dumps(cleaned)}\n\n"
            last_time = current_time

    return StreamingResponse(data_generator(), media_type="text/event-stream")


@app.get("/data")
def get_data_chunks(skip: int = 0, limit: int = 100):
    scored_records = score_records_until(skip + limit)
    chunk = scored_records[skip : skip + limit]
    cleaned_chunk = [clean_dict(record) for record in chunk]
    return {
        "skip": skip,
        "limit": limit,
        "model": MODEL_PATH.name,
        "threshold": model_threshold,
        "inference_mode": "realtime-single-row",
        "data": cleaned_chunk,
    }


if __name__ == "__main__":
    uvicorn.run("fastapi_server:app", host="0.0.0.0", port=8000, reload=True)
