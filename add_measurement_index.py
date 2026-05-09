import pandas as pd
import glob

def add_measurement_id():
    # Pobieramy oryginalne pliki (pomijamy te które utworzyliśmy wcześniej)
    files = [f for f in glob.glob('*.csv') if '_indexed' not in f and '_session' not in f]
    
    for f in files:
        print(f"Przetwarzanie {f}...")
        try:
            df = pd.read_csv(f)
            
            if 'Run Time' in df.columns:
                # Wypełniamy braki i konwertujemy do timedelta dla bezpiecznego porównania
                df['Run_Time_Temp'] = df['Run Time'].fillna('0:00:00')
                runtime_td = pd.to_timedelta(df['Run_Time_Temp'].str.strip())
                
                # Nowy pomiar zaczyna się, gdy obecny Run Time jest mniejszy od poprzedniego (czas "spada")
                is_start = runtime_td < runtime_td.shift(1)
                
                # Zabezpieczenie: pierwszy wiersz zawsze musi zaczynać pierwszy pomiar
                if len(df) > 0:
                    is_start.iloc[0] = True
                    
                # Kolumna Measurement_ID powstaje jako skumulowana suma flagi 'is_start'
                df.insert(0, 'Measurement_ID', is_start.cumsum())
                df = df.drop(columns=['Run_Time_Temp'])
                
                new_filename = f.replace('.csv', '_session_indexed.csv')
                df.to_csv(new_filename, index=False)
                
                num_sessions = df['Measurement_ID'].max()
                print(f" [+] Wykryto {num_sessions} oddzielnych pomiarów.")
                print(f" [+] Zapisano plik do: {new_filename}\n")
            else:
                print(f" - Brak kolumny 'Run Time' w {f}. Pomijam.\n")
                
        except Exception as e:
            print(f" [!] Błąd podczas przetwarzania {f}: {e}\n")

if __name__ == "__main__":
    add_measurement_id()
