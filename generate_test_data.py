import pandas as pd
import numpy as np
import datetime
from datetime import timedelta

# Base coordinates for 10 global drones
locations = [
    {"mId": 1, "lat": 52.2297, "lng": 21.0122},    # Warsaw
    {"mId": 2, "lat": 40.7128, "lng": -74.0060},   # New York
    {"mId": 3, "lat": 35.6762, "lng": 139.6503},   # Tokyo
    {"mId": 4, "lat": -33.8688, "lng": 151.2093},  # Sydney
    {"mId": 5, "lat": 51.5074, "lng": -0.1278},    # London
    {"mId": 6, "lat": -22.9068, "lng": -43.1729},  # Rio de Janeiro
    {"mId": 7, "lat": -33.9249, "lng": 18.4241},   # Cape Town
    {"mId": 8, "lat": 25.2048, "lng": 55.2708},    # Dubai
    {"mId": 9, "lat": 19.0760, "lng": 72.8777},    # Mumbai
    {"mId": 10, "lat": 34.0522, "lng": -118.2437}  # Los Angeles
]

total_seconds = 360 # 6 minut
data = []

base_time = datetime.datetime.strptime("12:00:00", "%H:%M:%S")

for t in range(total_seconds):
    current_time = base_time + timedelta(seconds=t)
    # Zgodnie z formatem zmerged_dataset.csv "0:03:25" itp. Zróbmy np. "0:0{M}:{S}"
    # Ale bezpieczniej i czytelniej dla sortowania bedzie H:MM:SS
    time_str = current_time.strftime("%H:%M:%S")
    
    for loc in locations:
        mId = loc["mId"]
        
        # Symulacja lotu (lekki ruch)
        lat = loc["lat"] + (t * 0.00001) + np.random.normal(0, 0.000002)
        lng = loc["lng"] + (t * 0.00001) + np.random.normal(0, 0.000002)
        
        # Wartości bazowe (normalne) dla 90% przebiegu
        altitude = 120.0 + np.random.normal(0, 0.5)
        alt_setpoint = 120.0
        x_track = np.random.uniform(0.1, 1.5)
        hdop = np.random.uniform(0.8, 1.2)
        sats = np.random.randint(12, 16)
        data_type = 0
        probability = np.random.uniform(0.01, 0.15)
        
        # Atak Spoofingowy! (Dron 8 jest atakowany po 3 minutach -> 180s)
        if mId == 8 and t > 20:
            data_type = 1
            probability = np.random.uniform(0.85, 0.99)
            sats = np.random.randint(2, 6) # Gwałtowny spadek widoczności satelitów
            hdop = np.random.uniform(4.5, 9.5) # Zakłócenia i szum (HDOP peak)
            x_track = np.random.uniform(15.0, 45.0) # Dron został wytrącony z kursu (X-track)
            altitude = max(10, 120.0 - ((t - 180) * 0.5) + np.random.normal(0, 1)) # Dron sztucznie zaczyna "nurkować" mimo setpointu 120m
            lat += ((t - 180) * 0.0001) # Dodatkowe agresywne dryfowanie GPS
            lng -= ((t - 180) * 0.0001)
        
        row = {
            "Measurement_ID": mId,
            "Run Time": time_str,
            "GPS Latitude": lat,
            "GPS Longitude": lng,
            "Vertical Position (m)": altitude,
            "Altitude Setpoint (m)": alt_setpoint,
            "X-Track Error (m)": x_track,
            "GPS HDOP": hdop,
            "Satellite Count": sats,
            "Data Type": data_type,
            "Probability": probability
        }
        data.append(row)

df = pd.DataFrame(data)
# Zapis z odpowiednim sortowaniem czasowym do symulacji Live SSE w aplikacji FastAPI
df = df.sort_values(by=["Run Time", "Measurement_ID"])
df.to_csv("final_test_data2.csv", index=False)
print("Pomyślnie wygenerowano plik: final_test_data2.csv!")