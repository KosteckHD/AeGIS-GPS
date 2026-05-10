# Wykrywanie Spoofingu w Sygnale GPS za Pomocą Uczenia Maszynowego

## Kosciuszkon 2026

**Autorzy:** Adam Rassem, Michał Kościanek

---

## 📋 Spis Treści

1. [Opis Projektu](#opis-projektu)
2. [Dane](#dane)
3. [Specyfikacja Sprzętu](#specyfikacja-sprzętu)
4. [Metodologia](#metodologia)
5. [Wyniki](#wyniki)
6. [Struktura Repo](#struktura-repo)
7. [Jak Zacząć](#jak-zacząć)
8. [Napotkane Problemy](#napotkane-problemy)

---

## 🎯 Opis Projektu

Projekt ma na celu opracowanie systemu do **automatycznego wykrywania spoofingu sygnałów GPS** przy użyciu technik uczenia maszynowego. Spoofing GPS to ataki polegające na wysyłaniu sfałszowanych sygnałów satelitarnych, które mogą zmylić odbiornik GPS i spowodować błędną determinację pozycji.

### Cel Badawczy

Sformułowanie problemu jako **klasyfikacji binarnej**:

- **Klasa clean**: autentyczne sygnały GPS bez ataku
- **Klasa spoof**: sygnały GPS z aktywnym atakiem spoofingowym

---

## 📊 Dane

Projekt wykorzystuje dwa publiczne zbiory danych:

### 1. **IEEE Tuni2025**

Publiczny zestaw danych zawierający surowe próbki sygnałów GNSS w postaci **I/Q**, przeznaczony do badań nad detekcją spoofingu.

**Charakterystyka:**

- 17 scenariuszy pomiarowych (8 dla Galileo E1, 9 dla GPS L1)
- W projekcie wykorzystano wyłącznie część **GPS L1**
- Każdy scenariusz trwa ~150 s, zapisany jako plik binarny `.bin`
- Próbkowanie: **50 MHz**
- Odbiornik: SDR USRP NI-2954
- Antena: NovAtel GNSS-703
- Generator sygnałów: Spectracom GSG-6

**Scenariusze GPS:**

- **Scenariusze czyste (C):** C-5, C-7 (sygnały bez ataku)
- **Scenariusze spoofingowe (SS):** SS-17, SS-18, SS-20, SS-27, SS-28, SS-29, SS-33
  - SS-33 to szczególny przypadek **delayed spoofing/meaconing** (spoofing pojawia się po ~70s)

**Rozmiar danych:** ~30 GB na scenariusz

**Dostęp:** https://ieeexplore.ieee.org/document/11222626

### 2. **AV-GPS-Dataset**

Publiczny zbiór danych przeznaczony do badań nad detekcją spoofingu GPS z platformy ACL-Rover (pojazd autonomiczny).

**Charakterystyka:**

- **Tabela z 44 cechami** nawigacyjnymi i telemetrycznymi
- Dane zbierane w warunkach normalnych i podczas ataku GPS spoofing
- Zawiera: parametry orientacji, pozycji, trajektorii, jakości sygnału GPS

**Grupy cech:**

1. Parametry ruchu: Roll, Pitch, Heading, Yaw, Velocity, Steering Angle
2. Cechy pozycyjne: GPS Latitude, GPS Longitude, Position, X-Track Error
3. Jakość sygnału: HDOP, VDOP, Course, Satellite Locks, Satellite Count
4. Vibracje pojazdu: Longitudinal, Lateral, Vertical Vibration

**Etykieta:** Data Type (0 = normal, 1 = spoofing)

---

## 💻 Specyfikacja Sprzętu

```
RTX 6000 PRO Blackwell        96 GB VRAM
Xeon® 6767P                   32/128 Cores
Pamięć RAM                    128 GB DDR5
Dysk NVMe                     600 GB
```

---

## 🔬 Metodologia

### Przygotowanie Danych

#### AV-GPS-Dataset:

1. **Analiza korelacji** - usunięcie redundantnych cech
2. **Redukcja wymiary** - pozostawienie reprezentantów z grup silnie skorelowanych:
   - GPS HDOP / GPS VDOP → GPS HDOP
   - Satellite Count / Satellite Locks → Satellite Count
3. **Cechy różnicowe** (delta\_\*): zmiany względem poprzedniej próbki
4. **Cechy kroczące**: średnia i odchylenie standardowe w oknach czasowych
5. **Podział danych** na poziomie `Measurement_ID` (70% / 15% / 15%)

#### Tuni2025:

1. **Podzielenie sygnału** na okna czasowe
2. **Ekstrakcja cech** z każdego okna:
   - Statystyki I/Q: średnia, odchylenie standardowe
   - Korelacja między kanałami I i Q
   - Moc: średnia, percentyle (P50, P90, P99)
   - Amplituda: średnia, odchylenie standardowe
   - Współczynnik PAPR
3. **Kontrola data leakage**:
   - Scenariusze C5 i C7 są bajtowo identyczne → podzielono czasowo
   - Scenariusz SS33 to delayed spoofing → zastosowano etykiety czasowe
4. **Podział po scenariuszach** (nie po pojedynczych oknach)

### Modele

#### 1. XGBoost

**Dla AV-GPS-Dataset:**
| Parametr | Wartość | Znaczenie |
|----------|---------|-----------|
| objective | binary:logistic | Klasyfikacja binarna |
| n_estimators | 2000 | Liczba drzew |
| learning_rate | 0.02 | Współczynnik uczenia |
| max_depth | 6 | Głębokość drzew |
| regularization | L2: 1.0 | Regularyzacja |

**Dla Tuni2025:**
| Parametr | Wartość |
|----------|---------|
| n_estimators | 1200 |
| learning_rate | 0.01 |
| max_depth | 3 |
| min_child_weight | 5 |
| subsample | 0.75 |
| colsample_bytree | 0.75 |
| reg_lambda | 10.0 |

#### 2. Random Forest

**Konfiguracja:**
| Parametr | Wartość |
|----------|---------|
| n_estimators | 900 |
| max_features | "sqrt" |
| class_weight | {0: 1.0, 1: 3.0} |
| bootstrap | True |

**Cechy interpretacyjne:**

- Analiza feature importance
- High-recall próg decyzyjny (≠ 0.5)
- Fokus na minimalizację FNR (false negative rate)

#### 3. CNN (Convolutional Neural Network)

**Dla surowych okien I/Q:**

- Wejście: okna o długości 131,072 próbek (≈ 2.62 ms)
- Bezpośrednia praca na surowych danych bez ekstrakcji cech
- Architektura konwolucyjna z warstwami FC

---

## 📈 Wyniki

### Tuni2025 - Scenariusz SS33 (held-out test)

#### CNN (Surowy I/Q)

```
Accuracy:           94.66%
Precision (spoof):  88.59%
Recall (spoof):     100.00%
F1 (spoof):         93.95%
FPR:                9.12%
FNR:                0.00%
ROC-AUC:            0.981
```

#### XGBoost (Cechy I/Q)

```
Accuracy:           98.16% ⭐ NAJLEPSZY
Precision (spoof):  96.99%
Recall (spoof):     99.79%
F1 (spoof):         98.37%
FPR:                3.86% ⭐ NAJNIŻSZY
FNR:                0.21%
ROC-AUC:            0.981
PR-AUC:             0.970
```

#### Random Forest (Cechy I/Q)

```
Accuracy:           94.88%
Precision (spoof):  89.01%
Recall (spoof):     100.00%
F1 (spoof):         94.18%
FPR:                8.74%
FNR:                0.00%
ROC-AUC:            0.956
PR-AUC:             0.890
```

### Wydajność Inferencji

| Model         | Input     | ms/okno | okna/sec  | Real-time factor |
| ------------- | --------- | ------- | --------- | ---------------- |
| XGBoost       | cechy I/Q | 0.0002  | 4,042,422 | 10597.0x         |
| Random Forest | cechy I/Q | 0.0638  | 15,669    | 41.1x            |
| CNN           | raw I/Q   | 0.3630  | 2,755     | 7.2x             |

**Notatka:** XGBoost i RF nie obejmują czasu ekstrakcji cech, CNN działa bezpośrednio na surowych danych.

### Ważność Cech (Top 20 - XGBoost)

1. q_abs_mean
2. power_std
3. power_p50
4. amp_mean
5. I_std
6. amp_p50

---

## 📁 Struktura Repo

```
Kosciuszkon-2026/
├── README.md                          # Ta dokumentacja
├── av datasets/                       # Dane AV-GPS
│   ├── AV-GPS-Dataset-1_session_indexed.csv
│   ├── AV-GPS-Dataset-1-Normal-Data_session_indexed.csv
│   ├── merged_dataset.csv
│   └── ...
├── jupyters/                          # Notebooki Jupyter
│   ├── CNN_ATTEMPT_rdy.ipynb
│   ├── RandomForestAppoach (1).ipynb
│   ├── Tuni2025_XGBoosting_Approach_FIXED (1).ipynb
│   └── models_inference_benchmark_WORKING_FIXED (2).ipynb
├── models/                            # Wytrenowane modele
│   ├── cnn_raw_iq_tuni2025_v6_clean_timesplit_torchscript.pt
│   ├── xgboost_tuni2025_iq_features.joblib
│   ├── random_forest_tuni2025_iq_features.joblib
│   └── ...
├── scripts/                           # Skrypty Python
│   ├── extract_iq_features_v2.py      # Ekstrakcja cech z surowych I/Q
│   ├── process_all_completed_safe.py
│   └── ...
├── frontend/                          # Aplikacja webowa
│   ├── src/
│   ├── package.json
│   └── ...
├── data_processing AV datasets/       # Przetwarzanie danych AV
│   ├── EDA.py
│   ├── model_fitting.py
│   └── ...
└── CNN_ATTEMPT.ipynb                  # Główne notebooki
```

---

## 🚀 Jak Zacząć

### 1. Przygotowanie Środowiska

```bash
# Zainstaluj zależności
pip install xgboost scikit-learn pandas numpy torch
pip install jupyter matplotlib seaborn
```

### 2. Ładowanie Danych

**AV-GPS-Dataset:**

```python
import pandas as pd
df = pd.read_csv('av datasets/merged_dataset.csv')
```

**Tuni2025:**

```python
# Surowe pliki .bin konwertują się na cechy .parquet
import pyarrow.parquet as pq
features_df = pq.read_table('processed_features.parquet').to_pandas()
```

### 3. Trening Modelu (XGBoost)

Przykład w: `jupyters/Tuni2025_XGBoosting_Approach_FIXED (1).ipynb`

```python
import xgboost as xgb

model = xgb.XGBClassifier(
    objective='binary:logistic',
    n_estimators=1200,
    learning_rate=0.01,
    max_depth=3,
    scale_pos_weight=ratio_clean_spoof
)

model.fit(X_train, y_train, eval_set=[(X_val, y_val)])
predictions = model.predict_proba(X_test)[:, 1]
```

### 4. Inferencja

```python
import joblib

model = joblib.load('models/xgboost_tuni2025_iq_features.joblib')
predictions = model.predict_proba(features)
threshold = 0.5
labels = (predictions >= threshold).astype(int)
```

---

## ⚠️ Napotkane Problemy

### 1. Duży Rozmiar Plików Binarnych

**Problem:** Każdy scenariusz Tuni2025 zajmuje ~30 GB.

**Rozwiązanie:**

- Próbkowanie okien z każdego scenariusza
- Równomierne rozłożenie w czasie (~1000 okien na scenariusz)
- Sąsiednie okna są silnie skorelowane

### 2. Identyczność Plików C5 i C7

**Problem:** Pliki clean C5.bin i C7.bin są bajtowo identyczne.

**Rozwiązanie:**

- Nie potraktowano jako osobne scenariusze
- Podzielono czasowo jedno nagranie na fragmenty train/val/test
- Dodano bufor czasowy między fragmentami

### 3. Błędne Etykietowanie SS33

**Problem:** SS33 to delayed spoofing, ale początkowo oznaczano cały plik jako spoof.

**Rzeczywistość:**

- Spoofing startuje ~70s po rozpoczęciu
- Trwa ~80s
- Kończy się ~150s

**Rozwiązanie:**

- Zastosowano etykiety czasowe (label_time)
- Fragmenty przed i po aktywacji → clean
- Aktywny przedział → spoof
- Pominięto niepewne przejścia czasowe

---

## 💡 Pomysły na Poprawę

1. **Rozszerzenie datasetu:** Więcej niezależnych scenariuszy clean
2. **Post-processing czasowy:** Wymóż kilka kolejnych pozytywnych okien przed alarmem
3. **Zaawansowane architektury CNN:**
   - Głębsze sieci wielowarstwowe
   - Bloki rezydualne (ResNet)
   - Konwolucje dylatacyjne
4. **Data augmentation:** Dodawanie szumu, przesunięcia fazowe
5. **Krótsze okna:** Badanie wpływu długości okna na wydajność

---

## 📚 Literatura i Porównanie

| Metoda               | Dataset              | Wynik             | Notatka                        |
| -------------------- | -------------------- | ----------------- | ------------------------------ |
| **Nasza: XGBoost**   | Tuni2025 GPS, SS33   | **98.16%**        | Najlepszy wynik, najniższy FPR |
| Nasza: CNN           | Tuni2025 GPS, SS33   | 94.66%            | Bezpośrednio na raw I/Q        |
| Nasza: Random Forest | Tuni2025 GPS, SS33   | 94.88%            | Interpretowalne, 100% recall   |
| Rahman, 2025         | Tuni2025 (post-corr) | 83.3%             | Inne poziom przetwarzania      |
| Babić et al., 2025   | Różne GNSS           | 99.99% (pre-corr) | Pre-correlation daje przewagę  |

---

## 📝 Podsumowanie

Projekt opracowuje system do wykrywania spoofingu GPS na dwóch poziomach:

- **AV-GPS-Dataset:** Detekcja na poziomie cech nawigacyjnych pojazdu
- **Tuni2025:** Detekcja bezpośrednio w surowym sygnale radiowym

**Kluczowe osiągnięcia:**

- ✅ **98.16% accuracy** z XGBoost
- ✅ **3.86% FPR** - niski poziom fałszywych alarmów
- ✅ **0.21% FNR** - praktycznie brak pominiętych ataków
- ✅ **Real-time capable** (CNN: 7.2x real-time factor)

---

## 👥 Autorzy

- **Adam Rassem**
- **Michał Kościanek**

**Projekt:** Kosciuszkon 2026
