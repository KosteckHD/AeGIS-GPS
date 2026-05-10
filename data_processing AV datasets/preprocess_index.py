import pandas as pd
import glob

def index_datasets():
    # Pobieramy wszystkie oryginalne pliki CSV
    files = [f for f in glob.glob('*.csv') if '_indexed' not in f]
    
    for f in files:
        print(f"Przetwarzanie {f}...")
        try:
            df = pd.read_csv(f)
            
            # Usunięcie wierszy, gdzie brakuje Run Time
            if 'Run Time' in df.columns:
                initial_len = len(df)
                df = df.dropna(subset=['Run Time'])
                if len(df) < initial_len:
                    print(f" - Usunięto {initial_len - len(df)} wierszy z brakującym Run Time.")
                
                # Dodatkowe usunięcie duplikatów (np. z AV-GPS-Dataset-1.csv)
                dupes = df.duplicated().sum()
                if dupes > 0:
                    df = df.drop_duplicates()
                    print(f" - Usunięto {dupes} duplikatów.")

                # Przekonwertowanie 'Run Time' na obiekt timedelta, aby zapewnić poprawne sortowanie numeryczne i czasowe
                # Formaty często to "0:00:00", to_timedelta poradzi sobie z tym idealnie
                df['Run_Time_TD'] = pd.to_timedelta(df['Run Time'])
                
                # Sortowanie po czasie trwania
                df = df.sort_values(by='Run_Time_TD')
                
                # Ustawienie Run Time jako nowy indeks
                df = df.set_index('Run Time')
                
                # Usunięcie kolumny pomocniczej
                df = df.drop(columns=['Run_Time_TD'])
                
                # Zapisanie do nowego pliku
                new_filename = f.replace('.csv', '_indexed.csv')
                df.to_csv(new_filename)
                print(f" [+] Zapisano posortowany i zaindeksowany zbiór do: {new_filename}\n")
            else:
                print(f" - Brak kolumny 'Run Time' w {f}. Pomijam.\n")
                
        except Exception as e:
            print(f" [!] Błąd podczas przetwarzania {f}: {e}\n")

if __name__ == "__main__":
    index_datasets()
