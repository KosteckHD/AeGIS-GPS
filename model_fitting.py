import pandas as pd
import numpy as np
import matplotlib.pyplot as plt

from sklearn.model_selection import train_test_split
DATA_PATH = "AV-GPS-Dataset-1_session_indexed.csv"
TARGET_COL = "Data Type"  
VAL_PATH = "val.csv"
TRAIN_PATH = "train.csv"
TEST_PATH = "test.csv"

GROUP_COL = "Measurement_ID"

def load_data(path: str) -> pd.DataFrame:
    df = pd.read_csv(path)
    print("Shape:", df.shape)
    print("\nColumns:")
    print(df.columns.tolist())
    print("\nInfo:")
    print(df.info())
    return df



df = load_data(DATA_PATH)


df = df.drop('Distance To GCS (m)', axis=1)


def split_by_measurement_id(df: pd.DataFrame):
    # jedna linia = jeden Measurement_ID
    # etykieta grupy = dominująca klasa w danym pomiarze
    groups = (
        df.groupby(GROUP_COL)[TARGET_COL]
        .agg(lambda x: x.mode().iloc[0])
        .reset_index()
    )

    measurement_ids = groups[GROUP_COL]
    group_labels = groups[TARGET_COL]

    # 70% train, 30% temp
    train_ids, temp_ids, train_labels, temp_labels = train_test_split(
        measurement_ids,
        group_labels,
        test_size=0.30,
        random_state=42,
        stratify=group_labels
    )

    # z 30% robimy 15% validation i 15% test
    val_ids, test_ids = train_test_split(
        temp_ids,
        test_size=0.50,
        random_state=42,
        stratify=temp_labels
    )

    train_df = df[df[GROUP_COL].isin(train_ids)].copy()
    val_df = df[df[GROUP_COL].isin(val_ids)].copy()
    test_df = df[df[GROUP_COL].isin(test_ids)].copy()

    return train_df, val_df, test_df

def check_split(train_df, val_df, test_df):
    print("\nRozmiary:")
    print("Train:", train_df.shape)
    print("Val:  ", val_df.shape)
    print("Test: ", test_df.shape)

    print("\nProporcje klas:")
    print("Train:")
    print(train_df[TARGET_COL].value_counts(normalize=True))

    print("\nVal:")
    print(val_df[TARGET_COL].value_counts(normalize=True))

    print("\nTest:")
    print(test_df[TARGET_COL].value_counts(normalize=True))

    train_ids = set(train_df[GROUP_COL].unique())
    val_ids = set(val_df[GROUP_COL].unique())
    test_ids = set(test_df[GROUP_COL].unique())

    print("\nLiczba Measurement_ID:")
    print("Train:", len(train_ids))
    print("Val:  ", len(val_ids))
    print("Test: ", len(test_ids))

    print("\nSprawdzenie przecieków Measurement_ID:")
    print("Train ∩ Val: ", len(train_ids & val_ids))
    print("Train ∩ Test:", len(train_ids & test_ids))
    print("Val ∩ Test:  ", len(val_ids & test_ids))



print(df.head(10))

train_df, val_df, test_df = split_by_measurement_id(df)

check_split(train_df, val_df, test_df)

train_df.to_csv(TRAIN_PATH, index=False)
val_df.to_csv(VAL_PATH, index=False)
test_df.to_csv(TEST_PATH, index=False)

print("\nZapisano pliki:")
print(TRAIN_PATH)
print(VAL_PATH)
print(TEST_PATH)



