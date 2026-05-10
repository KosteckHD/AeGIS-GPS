import numpy as np
import pandas as pd
import joblib

from xgboost import XGBClassifier

from sklearn.impute import SimpleImputer
from sklearn.metrics import (
    confusion_matrix,
    classification_report,
    accuracy_score,
    precision_score,
    recall_score,
    f1_score
)


TRAIN_PATH = "train.csv"
VAL_PATH = "val.csv"
TEST_PATH = "test.csv"

MODEL_PATH = "xgboost_gps_spoofing_model_v2.joblib"

TARGET_COL = "Data Type"


# Kolumny, których NIE wolno dawać jako cech wejściowych
# albo są mało sensowne dla generalizacji.
DROP_LEAKAGE_OR_TEXT_COLS = [
    "Data Type",
    "Measurement_ID",
    "Run Time",
    "Hobbs",
    "Clock Time",
    "Clock Date",
    "GPS MGRS",



    "EKF Detector",
    "GPS Latitude",
    "GPS Longitude",
    "Longitudinal Position (m)",
    "Lateral Position (m)",
    "Vertical Position (m)",
    "Distance To Home (m)",
    "Mission Index",
    "Heading To Home (deg)",
    "Heading To Next WP (deg)",
]


# Kolumny usuwane przez korelację / redundancję.
# Zostawiamy jednego reprezentanta z grupy.
DROP_CORRELATED_COLS = [
    # GPS HDOP / VDOP — zostawiamy GPS HDOP
    "GPS VDOP",

    # Satellite Count / Satellite Locks — zostawiamy Satellite Count
    "Satellite Locks",

    # Prędkości — zostawiamy składowe podpisane
    "Velocity (m/s)",
    "Absolute Longitudinal Velocity (m/s)",
    "Absolute Lateral Velocity (m/s)",

    # Wibracje — zostawiamy Vertical Vibration jako reprezentanta
    "Longitudinal Vibration",
    "Lateral Vibration",

    # Pozycja / droga — zostawiamy Longitudinal Position i Lateral Position
    "Travelled Distance (m)",
]


DROP_COLS = DROP_LEAKAGE_OR_TEXT_COLS + DROP_CORRELATED_COLS


def load_dataset(path: str) -> pd.DataFrame:
    df = pd.read_csv(path)
    df.columns = df.columns.str.strip()
    return df


def prepare_xy(df: pd.DataFrame):
    existing_drop_cols = [c for c in DROP_COLS if c in df.columns]

    X = df.drop(columns=existing_drop_cols)
    y = df[TARGET_COL]

    # Jeżeli mimo wszystko zostały jakieś kolumny tekstowe, usuwamy je.
    object_cols = X.select_dtypes(include=["object"]).columns.tolist()

    if object_cols:
        print("\nUsuwam kolumny object:")
        print(object_cols)
        X = X.drop(columns=object_cols)

    return X, y


def print_metrics(name: str, y_true, y_pred):
    print(f"\n===== {name} =====")

    cm = confusion_matrix(y_true, y_pred)
    print("Confusion matrix:")
    print(cm)

    tn, fp, fn, tp = cm.ravel()

    fpr = fp / (fp + tn) if (fp + tn) > 0 else 0.0
    fnr = fn / (fn + tp) if (fn + tp) > 0 else 0.0

    print("\nBasic metrics:")
    print("Accuracy:", accuracy_score(y_true, y_pred))
    print("Precision attack:", precision_score(y_true, y_pred, pos_label=1, zero_division=0))
    print("Recall attack:", recall_score(y_true, y_pred, pos_label=1, zero_division=0))
    print("F1 attack:", f1_score(y_true, y_pred, pos_label=1, zero_division=0))
    print("FPR:", fpr)
    print("FNR:", fnr)

    print("\nClassification report:")
    print(classification_report(y_true, y_pred, zero_division=0))


def threshold_sweep(name, y_true, y_proba):
    print(f"\n===== THRESHOLD SWEEP: {name} =====")

    thresholds = [
        0.01, 0.02, 0.05, 0.10, 0.15, 0.20, 0.25,
        0.30, 0.35, 0.40, 0.45, 0.50, 0.60, 0.70
    ]

    for threshold in thresholds:
        y_pred = (y_proba >= threshold).astype(int)

        cm = confusion_matrix(y_true, y_pred)
        tn, fp, fn, tp = cm.ravel()

        precision = precision_score(y_true, y_pred, pos_label=1, zero_division=0)
        recall = recall_score(y_true, y_pred, pos_label=1, zero_division=0)
        f1 = f1_score(y_true, y_pred, pos_label=1, zero_division=0)

        fpr = fp / (fp + tn) if (fp + tn) > 0 else 0
        fnr = fn / (fn + tp) if (fn + tp) > 0 else 0

        print(
            f"threshold={threshold:.2f} | "
            f"precision={precision:.4f} | "
            f"recall={recall:.4f} | "
            f"f1={f1:.4f} | "
            f"FPR={fpr:.4f} | "
            f"FNR={fnr:.4f} | "
            f"FP={fp} | FN={fn}"
        )


def add_delta_features(df):
    df = df.copy()

    delta_cols = [
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

    for col in delta_cols:
        if col in df.columns:
            df[f"delta_{col}"] = (
                df.groupby("Measurement_ID")[col]
                  .diff()
                  .fillna(0)
            )

    return df

def find_best_threshold(y_true, y_proba):
    best_threshold = 0.5
    best_f1 = -1.0

    thresholds = np.arange(0.001, 0.501, 0.001)

    for threshold in thresholds:
        y_pred = (y_proba >= threshold).astype(int)
        score = f1_score(y_true, y_pred, pos_label=1, zero_division=0)

        if score > best_f1:
            best_f1 = score
            best_threshold = threshold

    return best_threshold, best_f1

def add_rolling_features(df):
    df = df.copy()

    rolling_cols = [
        "GPS HDOP",
        "GPS Course",
        "Satellite Count",
        "Longitudinal Velocity (m/s)",
        "Lateral Velocity (m/s)",
        "Vertical Velocity (m/s)",
        "X-Track Error (m)",
    ]

    windows = [3, 5, 10]

    for col in rolling_cols:
        if col in df.columns:
            grouped = df.groupby("Measurement_ID")[col]

            for w in windows:
                df[f"{col}_roll_mean_{w}"] = (
                    grouped.rolling(w, min_periods=1)
                    .mean()
                    .reset_index(level=0, drop=True)
                )

                df[f"{col}_roll_std_{w}"] = (
                    grouped.rolling(w, min_periods=1)
                    .std()
                    .reset_index(level=0, drop=True)
                    .fillna(0)
                )

    return df
train_df = load_dataset(TRAIN_PATH)
val_df = load_dataset(VAL_PATH)
test_df = load_dataset(TEST_PATH)


train_df = add_delta_features(train_df)
val_df = add_delta_features(val_df)
test_df = add_delta_features(test_df)


train_df = add_rolling_features(train_df)
val_df = add_rolling_features(val_df)
test_df = add_rolling_features(test_df)

print("Train shape:", train_df.shape)
print("Val shape:  ", val_df.shape)
print("Test shape: ", test_df.shape)

print("\nTrain class distribution:")
print(train_df[TARGET_COL].value_counts(normalize=True))

X_train, y_train = prepare_xy(train_df)
X_val, y_val = prepare_xy(val_df)
X_test, y_test = prepare_xy(test_df)

print("\nFinal feature columns:")
print(X_train.columns.tolist())
print("\nNumber of features:", X_train.shape[1])

# Imputacja braków danych — bez normalizacji
imputer = SimpleImputer(strategy="median")

X_train_imp = imputer.fit_transform(X_train)
X_val_imp = imputer.transform(X_val)
X_test_imp = imputer.transform(X_test)

# Mniejsza waga pozytywnej klasy niż pełne neg/pos,
# żeby ograniczyć false positive.
negative_count = (y_train == 0).sum()
positive_count = (y_train == 1).sum()

# scale_pos_weight = np.sqrt(negative_count / positive_count)
scale_pos_weight = negative_count / positive_count


print("\nscale_pos_weight:", scale_pos_weight)

model = XGBClassifier(
    n_estimators=3000,
    learning_rate=0.02,
    max_depth=6,
    min_child_weight=1,
    subsample=0.90,
    colsample_bytree=0.90,
    gamma=0.0,
    reg_alpha=0.0,
    reg_lambda=1.0,
    objective="binary:logistic",
    eval_metric="aucpr",
    scale_pos_weight=scale_pos_weight,
    random_state=42,
    n_jobs=-1,
    tree_method="hist",
    early_stopping_rounds=200,
)

print("\nTraining XGBoost v2...")

model.fit(
    X_train_imp,
    y_train,
    eval_set=[(X_val_imp, y_val)],
    verbose=100
)

print("\nBest iteration:", model.best_iteration)

# Predykcja prawdopodobieństw
y_val_proba = model.predict_proba(X_val_imp)[:, 1]
y_test_proba = model.predict_proba(X_test_imp)[:, 1]

# Domyślny próg 0.5
y_val_pred_05 = (y_val_proba >= 0.5).astype(int)
y_test_pred_05 = (y_test_proba >= 0.5).astype(int)

print_metrics("VALIDATION threshold=0.50", y_val, y_val_pred_05)
print_metrics("TEST threshold=0.50", y_test, y_test_pred_05)

# Dobór progu na validation
best_threshold, best_val_f1 = find_best_threshold(y_val, y_val_proba)

print("\nBest threshold from validation:", best_threshold)
print("Best validation F1 attack:", best_val_f1)

y_val_pred_best = (y_val_proba >= best_threshold).astype(int)
y_test_pred_best = (y_test_proba >= best_threshold).astype(int)

print_metrics(f"VALIDATION threshold={best_threshold:.2f}", y_val, y_val_pred_best)
print_metrics(f"TEST threshold={best_threshold:.2f}", y_test, y_test_pred_best)
threshold_sweep("VALIDATION", y_val, y_val_proba)
threshold_sweep("TEST", y_test, y_test_proba)
def proba_stats(name, y_true, y_proba):
    df_tmp = pd.DataFrame({
        "y_true": y_true.values,
        "proba": y_proba
    })

    print(f"\n===== PROBA STATS: {name} =====")

    for cls in [0, 1]:
        p = df_tmp[df_tmp["y_true"] == cls]["proba"]
        print(f"\nClass {cls}:")
        print(p.quantile([0.01, 0.05, 0.10, 0.25, 0.50, 0.75, 0.90, 0.95, 0.99]))


proba_stats("VALIDATION", y_val, y_val_proba)
proba_stats("TEST", y_test, y_test_proba)
def metrics_by_measurement(df_original, y_true, y_proba, threshold):
    tmp = df_original.copy()
    tmp["y_true"] = y_true.values
    tmp["proba_attack"] = y_proba
    tmp["y_pred"] = (y_proba >= threshold).astype(int)

    rows = []

    for measurement_id, g in tmp.groupby("Measurement_ID"):
        cm = confusion_matrix(g["y_true"], g["y_pred"], labels=[0, 1])
        tn, fp, fn, tp = cm.ravel()

        fpr = fp / (fp + tn) if (fp + tn) > 0 else 0
        fnr = fn / (fn + tp) if (fn + tp) > 0 else 0
        recall = tp / (tp + fn) if (tp + fn) > 0 else 0
        precision = tp / (tp + fp) if (tp + fp) > 0 else 0

        rows.append({
            "Measurement_ID": measurement_id,
            "rows": len(g),
            "class_0": int((g["y_true"] == 0).sum()),
            "class_1": int((g["y_true"] == 1).sum()),
            "TN": tn,
            "FP": fp,
            "FN": fn,
            "TP": tp,
            "FPR": fpr,
            "FNR": fnr,
            "precision_attack": precision,
            "recall_attack": recall,
            "mean_proba_attack": g["proba_attack"].mean(),
        })

    return pd.DataFrame(rows).sort_values("FNR", ascending=False)


result_per_measurement = metrics_by_measurement(
    test_df,
    y_test,
    y_test_proba,
    threshold=best_threshold
)

print(result_per_measurement)
# Zapisujemy cały pakiet
model_package = {
    "model": model,
    "imputer": imputer,
    "feature_columns": X_train.columns.tolist(),
    "drop_cols": DROP_COLS,
    "threshold": best_threshold,
}

joblib.dump(model_package, MODEL_PATH)

print(f"\nModel zapisany do pliku: {MODEL_PATH}")

print(f"probu:{y_test_proba}")