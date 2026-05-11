import pandas as pd
import glob
from sklearn.model_selection import GroupShuffleSplit

def process_and_merge():
    # Pobieramy tym razem pliki *session_indexed.csv jako wejście i od razu złączamy
    files = [f for f in glob.glob('*_session_indexed.csv')]
    
    all_dfs = []
    global_max_id = 0
    target_column = 'Data Type' # Kolumna oznaczająca atak (domyślnie z EDA.py)
    
    print("--- Faza 1: Łączenie przeindeksowanych wcześniej plików ---")
    for f in sorted(files):
        try:
            df = pd.read_csv(f)
            if 'Measurement_ID' in df.columns:
                print(f" Przetwarzanie: {f}")
                
                # Przesuwamy ID o globalny_max, żeby w złączonym pliku IDs były zawsze unikalne
                # Trzeba sprawdzić z ilu ID składał się oryginalny plik. 
                # Poprawka: Odejmujemy jego minimalny 'Measurement_ID' i dopiero dodajemy global_max_id + 1
                min_id_local = df['Measurement_ID'].min()
                df['Measurement_ID'] = (df['Measurement_ID'] - min_id_local + 1) + global_max_id
                
                global_max_id = df['Measurement_ID'].max()
                
                # Dodajemy kolumnę z informacją o pliku źródłowym
                df.insert(1, 'Source_Dataset', f)
                all_dfs.append(df)
            else:
                print(f" [!] Brak kolumny 'Measurement_ID' w {f}. Pomijam.")
        except Exception as e:
            print(f" [!] Błąd z plikiem {f}: {e}")

            
    if not all_dfs:
        print("Brak danych do złączenia.")
        return None

    # Złączamy wszystko w jeden duży DataFrame
    merged_df = pd.concat(all_dfs, ignore_index=True)
    merged_df.to_csv("merged_dataset.csv", index=False)
    print(f"\n[+] Pomyślnie złączono dane w 'merged_dataset.csv'.")
    print(f"Liczba wierszy: {len(merged_df)}, Całkowita liczba pomiarów/sesji: {global_max_id}")
    return merged_df

def split_data(df):
    print("\n--- Faza 2: Podział (Train 70% / Test1 15% / Test2 15%) ---")
    
    # Kroki dla GroupShuffleSplit zapobiegający wyciekowi danych (Data Leakage)
    
    # 1. Dzielimy całość na: Trening (70%) i Tymczasowy do Podziału (30%)
    gss1 = GroupShuffleSplit(n_splits=1, train_size=0.70, random_state=42)
    train_idx, temp_idx = next(gss1.split(df, groups=df['Measurement_ID']))
    
    train_data = df.iloc[train_idx]
    temp_data = df.iloc[temp_idx]
    
    # 2. Dzielimy zbiór Tymczasowy (30%) ściśle na pół -> Test 1 (15%) i Test 2 (15%)
    # train_size=0.5 na 30% ułamku daje idealne 15% globalnych danych
    gss2 = GroupShuffleSplit(n_splits=1, train_size=0.50, random_state=42)
    test1_idx, test2_idx = next(gss2.split(temp_data, groups=temp_data['Measurement_ID']))
    
    test1_data = temp_data.iloc[test1_idx]
    test2_data = temp_data.iloc[test2_idx]
    
    # Zapis
    train_data.to_csv("train_data.csv", index=False)
    test1_data.to_csv("test1_data.csv", index=False)
    test2_data.to_csv("test2_data.csv", index=False)
    
    # Raport z podziału
    total_len = len(df)
    total_sessions = df['Measurement_ID'].nunique()
    
    print("\nGotowe. Podsumowanie rozmiarów (według liczby wierszy vs sesji):")
    print(f" Pełny zbiór  (100%): {total_len} wierszy | {total_sessions} sesji lotów")
    print(f" Train        (~70%): {len(train_data)} wierszy ({round(len(train_data)/total_len*100, 1)}%) | {train_data['Measurement_ID'].nunique()} sesji")
    print(f" Test 1       (~15%): {len(test1_data)} wierszy ({round(len(test1_data)/total_len*100, 1)}%) | {test1_data['Measurement_ID'].nunique()} sesji")
    print(f" Test 2       (~15%): {len(test2_data)} wierszy ({round(len(test2_data)/total_len*100, 1)}%) | {test2_data['Measurement_ID'].nunique()} sesji")

if __name__ == "__main__":
    merged = process_and_merge()
    if merged is not None:
        split_data(merged)
