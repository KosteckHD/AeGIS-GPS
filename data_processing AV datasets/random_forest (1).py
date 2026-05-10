import numpy as np
import pandas as pd
import joblib

from sklearn.ensemble import RandomForestClassifier
from sklearn.impute import SimpleImputer
from sklearn.metrics import (
    accuracy_score,
    classification_report,
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score,
)


TRAIN_PATH = "train.csv"
VAL_PATH = "val.csv"
TEST_PATH = "test.csv"

MODEL_PATH = "random_forest_gps_spoofing_model.joblib"
IMPORTANCE_PATH = "random_forest_feature_importance.csv"

TARGET_COL = "Data Type"
GROUP_COL = "Measurement_ID"


DROP_LEAKAGE_OR_TEXT_COLS = [
    "Data Type",
    "Measurement_ID",
    "Source_Dataset",
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


DROP_CORRELATED_COLS = [
    "GPS VDOP",
    "Satellite Locks",
    "Velocity (m/s)",
    "Absolute Longitudinal Velocity (m/s)",
    "Absolute Lateral Velocity (m/s)",
    "Longitudinal Vibration",
    "Lateral Vibration",
    "Travelled Distance (m)",
]


DROP_COLS = DROP_LEAKAGE_OR_TEXT_COLS + DROP_CORRELATED_COLS


def load_dataset(path: str) -> pd.DataFrame:
    df = pd.read_csv(path)
    df.columns = df.columns.str.strip()
    return df


def add_delta_features(df: pd.DataFrame) -> pd.DataFrame:
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

    if GROUP_COL not in df.columns:
        return df

    for col in delta_cols:
        if col in df.columns:
            df[f"delta_{col}"] = df.groupby(GROUP_COL)[col].diff().fillna(0)

    return df


def add_rolling_features(df: pd.DataFrame) -> pd.DataFrame:
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

    if GROUP_COL not in df.columns:
        return df

    for col in rolling_cols:
        if col in df.columns:
            grouped = df.groupby(GROUP_COL)[col]

            for window in windows:
                df[f"{col}_roll_mean_{window}"] = (
                    grouped.rolling(window, min_periods=1)
                    .mean()
                    .reset_index(level=0, drop=True)
                )
                df[f"{col}_roll_std_{window}"] = (
                    grouped.rolling(window, min_periods=1)
                    .std()
                    .reset_index(level=0, drop=True)
                    .fillna(0)
                )

    return df


def prepare_xy(df: pd.DataFrame, feature_columns=None):
    existing_drop_cols = [col for col in DROP_COLS if col in df.columns]

    X = df.drop(columns=existing_drop_cols)
    y = df[TARGET_COL]

    object_cols = X.select_dtypes(include=["object"]).columns.tolist()
    if object_cols:
        print("\nUsuwam kolumny tekstowe:")
        print(object_cols)
        X = X.drop(columns=object_cols)

    if feature_columns is not None:
        X = X.reindex(columns=feature_columns, fill_value=np.nan)

    return X, y


def print_metrics(name: str, y_true, y_pred):
    print(f"\n===== {name} =====")

    cm = confusion_matrix(y_true, y_pred, labels=[0, 1])
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


def find_best_threshold(y_true, y_proba):
    best_threshold = 0.5
    best_f1 = -1.0

    for threshold in np.arange(0.05, 0.951, 0.005):
        y_pred = (y_proba >= threshold).astype(int)
        score = f1_score(y_true, y_pred, pos_label=1, zero_division=0)

        if score > best_f1:
            best_f1 = score
            best_threshold = threshold

    return best_threshold, best_f1


def threshold_sweep(name: str, y_true, y_proba):
    print(f"\n===== THRESHOLD SWEEP: {name} =====")

    for threshold in [0.10, 0.20, 0.30, 0.40, 0.50, 0.60, 0.70, 0.80, 0.90]:
        y_pred = (y_proba >= threshold).astype(int)
        cm = confusion_matrix(y_true, y_pred, labels=[0, 1])
        tn, fp, fn, tp = cm.ravel()

        precision = precision_score(y_true, y_pred, pos_label=1, zero_division=0)
        recall = recall_score(y_true, y_pred, pos_label=1, zero_division=0)
        f1 = f1_score(y_true, y_pred, pos_label=1, zero_division=0)
        fpr = fp / (fp + tn) if (fp + tn) > 0 else 0.0
        fnr = fn / (fn + tp) if (fn + tp) > 0 else 0.0

        print(
            f"threshold={threshold:.2f} | "
            f"precision={precision:.4f} | recall={recall:.4f} | "
            f"f1={f1:.4f} | FPR={fpr:.4f} | FNR={fnr:.4f} | "
            f"FP={fp} | FN={fn}"
        )


def metrics_by_measurement(df_original, y_true, y_proba, threshold):
    tmp = df_original.copy()
    tmp["y_true"] = y_true.values
    tmp["proba_attack"] = y_proba
    tmp["y_pred"] = (y_proba >= threshold).astype(int)

    rows = []

    for measurement_id, group in tmp.groupby(GROUP_COL):
        cm = confusion_matrix(group["y_true"], group["y_pred"], labels=[0, 1])
        tn, fp, fn, tp = cm.ravel()

        rows.append(
            {
                "Measurement_ID": measurement_id,
                "rows": len(group),
                "class_0": int((group["y_true"] == 0).sum()),
                "class_1": int((group["y_true"] == 1).sum()),
                "TN": tn,
                "FP": fp,
                "FN": fn,
                "TP": tp,
                "FPR": fp / (fp + tn) if (fp + tn) > 0 else 0.0,
                "FNR": fn / (fn + tp) if (fn + tp) > 0 else 0.0,
                "mean_proba_attack": group["proba_attack"].mean(),
            }
        )

    return pd.DataFrame(rows).sort_values(["FNR", "FPR"], ascending=[False, False])


def main():
    train_df = load_dataset(TRAIN_PATH)
    val_df = load_dataset(VAL_PATH)
    test_df = load_dataset(TEST_PATH)

    train_df = add_rolling_features(add_delta_features(train_df))
    val_df = add_rolling_features(add_delta_features(val_df))
    test_df = add_rolling_features(add_delta_features(test_df))

    print("Train shape:", train_df.shape)
    print("Validation shape:", val_df.shape)
    print("Test shape:", test_df.shape)

    print("\nTrain class distribution:")
    print(train_df[TARGET_COL].value_counts(normalize=True))

    X_train, y_train = prepare_xy(train_df)
    feature_columns = X_train.columns.tolist()
    X_val, y_val = prepare_xy(val_df, feature_columns=feature_columns)
    X_test, y_test = prepare_xy(test_df, feature_columns=feature_columns)

    print("\nNumber of features:", len(feature_columns))
    print("\nFeature columns:")
    print(feature_columns)

    imputer = SimpleImputer(strategy="median")
    X_train_imp = imputer.fit_transform(X_train)
    X_val_imp = imputer.transform(X_val)
    X_test_imp = imputer.transform(X_test)

    model = RandomForestClassifier(
        n_estimators=500,
        max_depth=None,
        min_samples_split=4,
        min_samples_leaf=2,
        max_features="sqrt",
        class_weight="balanced_subsample",
        bootstrap=True,
        random_state=42,
        n_jobs=-1,
        verbose=1,
    )

    print("\nTraining Random Forest...")
    model.fit(X_train_imp, y_train)

    y_val_proba = model.predict_proba(X_val_imp)[:, 1]
    y_test_proba = model.predict_proba(X_test_imp)[:, 1]

    y_val_pred_05 = (y_val_proba >= 0.5).astype(int)
    y_test_pred_05 = (y_test_proba >= 0.5).astype(int)

    print_metrics("VALIDATION threshold=0.50", y_val, y_val_pred_05)
    print_metrics("TEST threshold=0.50", y_test, y_test_pred_05)

    best_threshold, best_val_f1 = find_best_threshold(y_val, y_val_proba)
    print("\nBest threshold from validation:", best_threshold)
    print("Best validation F1 attack:", best_val_f1)

    y_val_pred_best = (y_val_proba >= best_threshold).astype(int)
    y_test_pred_best = (y_test_proba >= best_threshold).astype(int)

    print_metrics(f"VALIDATION threshold={best_threshold:.3f}", y_val, y_val_pred_best)
    print_metrics(f"TEST threshold={best_threshold:.3f}", y_test, y_test_pred_best)

    threshold_sweep("VALIDATION", y_val, y_val_proba)
    threshold_sweep("TEST", y_test, y_test_proba)

    print("\n===== TEST METRICS BY Measurement_ID =====")
    print(metrics_by_measurement(test_df, y_test, y_test_proba, best_threshold))

    feature_importance = pd.DataFrame(
        {
            "feature": feature_columns,
            "importance": model.feature_importances_,
        }
    ).sort_values("importance", ascending=False)
    feature_importance.to_csv(IMPORTANCE_PATH, index=False)

    model_package = {
        "model": model,
        "imputer": imputer,
        "feature_columns": feature_columns,
        "drop_cols": DROP_COLS,
        "threshold": best_threshold,
    }
    joblib.dump(model_package, MODEL_PATH)

    print(f"\nModel zapisany do pliku: {MODEL_PATH}")
    print(f"Waznosc cech zapisana do pliku: {IMPORTANCE_PATH}")


if __name__ == "__main__":
    main()
