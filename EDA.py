import pandas as pd
import numpy as np
import matplotlib.pyplot as plt


DATA_PATH = "AV-GPS-Dataset-1.csv"
TARGET_COL = "Data Type"  # zmień po sprawdzeniu nazw kolumn


def load_data(path: str) -> pd.DataFrame:
    df = pd.read_csv(path)
    print("Shape:", df.shape)
    print("\nColumns:")
    print(df.columns.tolist())
    print("\nInfo:")
    print(df.info())
    return df


def basic_quality_report(df: pd.DataFrame, target_col: str) -> None:
    print("\nFirst rows:")
    print(df.head())

    print("\nDuplicates:")
    print(df.duplicated().sum())

    print("\nMissing values:")
    missing = pd.DataFrame({
        "missing_count": df.isna().sum(),
        "missing_percent": df.isna().mean() * 100
    }).sort_values("missing_count", ascending=False)
    print(missing[missing["missing_count"] > 0])

    print("\nClass distribution:")
    print(df[target_col].value_counts())
    print("\nClass distribution [%]:")
    print(df[target_col].value_counts(normalize=True) * 100)

    print("\nBasic statistics:")
    print(df.describe().T)


def plot_class_distribution(df: pd.DataFrame, target_col: str) -> None:
    counts = df[target_col].value_counts().sort_index()

    plt.figure(figsize=(6, 4))
    plt.bar(counts.index.astype(str), counts.values)
    plt.xlabel("Class")
    plt.ylabel("Number of samples")
    plt.title("Class distribution")
    plt.tight_layout()
    plt.show()


def plot_hist_by_class(df: pd.DataFrame, feature: str, target_col: str) -> None:
    if feature not in df.columns:
        print(f"Feature {feature} not found.")
        return

    plt.figure(figsize=(8, 4))

    for cls in sorted(df[target_col].dropna().unique()):
        values = df[df[target_col] == cls][feature].dropna()
        plt.hist(values, bins=50, alpha=0.5, label=f"class {cls}")

    plt.xlabel(feature)
    plt.ylabel("Count")
    plt.title(f"Distribution of {feature}")
    plt.legend()
    plt.tight_layout()
    plt.show()


def plot_time_series_with_attack(df: pd.DataFrame, feature: str, target_col: str) -> None:
    if feature not in df.columns:
        print(f"Feature {feature} not found.")
        return

    plt.figure(figsize=(12, 4))
    plt.plot(df.index, df[feature], label=feature)

    attack_idx = df[df[target_col] == 1].index
    if len(attack_idx) > 0:
        plt.scatter(attack_idx, df.loc[attack_idx, feature], s=8, label="attack")

    plt.xlabel("Sample index")
    plt.ylabel(feature)
    plt.title(f"{feature} over time")
    plt.legend()
    plt.tight_layout()
    plt.show()


def plot_correlation_matrix(df: pd.DataFrame, target_col: str) -> None:
    numeric_df = df.select_dtypes(include=[np.number])

    corr = numeric_df.corr()

    print("\nCorrelation with target:")
    if target_col in corr.columns:
        print(corr[target_col].sort_values(key=abs, ascending=False))

    plt.figure(figsize=(12, 10))
    plt.imshow(corr, aspect="auto")
    plt.colorbar()
    plt.xticks(range(len(corr.columns)), corr.columns, rotation=90)
    plt.yticks(range(len(corr.columns)), corr.columns)
    plt.title("Correlation matrix")
    plt.tight_layout()
    plt.show()


def main():
    df = load_data(DATA_PATH)

    # Dopasuj target, jeżeli nazwa jest inna
    if TARGET_COL not in df.columns:
        raise ValueError(f"Target column '{TARGET_COL}' not found. Available columns: {df.columns.tolist()}")

    basic_quality_report(df, TARGET_COL)
    plot_class_distribution(df, TARGET_COL)

    candidate_features = [
        "velocity", "Velocity",
        "yaw", "Yaw",
        "yaw_rate", "Yaw Rate",
        "x_track_error", "X-Track Error",
        "hdop", "HDOP",
        "vdop", "VDOP",
        "satellite_count", "Satellite Count",
        "satlock", "Satellite Lock"
    ]

    existing_features = [c for c in candidate_features if c in df.columns]
    print("\nExisting selected features:")
    print(existing_features)

    for feature in existing_features:
        plot_hist_by_class(df, feature, TARGET_COL)
        plot_time_series_with_attack(df, feature, TARGET_COL)

    plot_correlation_matrix(df, TARGET_COL)


if __name__ == "__main__":
    main()