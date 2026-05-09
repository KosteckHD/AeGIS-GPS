import pandas as pd
from fastapi import FastAPI
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
import asyncio
import json
import math
import uvicorn

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Ścieżka do pliku z danymi
CSV_PATH = "test2_data.csv"

# Wczytanie i posortowanie danych w pamięci przy starcie API
print("Wczytywanie i sortowanie test2_data.csv ...")
df = pd.read_csv(CSV_PATH)
df.columns = df.columns.str.strip() # Czyszczenie nazw kolumn

if "Measurement_ID" in df.columns and "Run Time" in df.columns:
    df = df.sort_values(by=["Run Time", "Measurement_ID"])
else:
    print("Ostrzeżenie: Brak kolumny 'Measurement_ID' lub 'Run Time'. Dane nie zostały posortowane.")

# Przekształcamy DataFrame na listę słowników do szybszego serwowania
records = df.to_dict(orient="records")

def clean_dict(record):
    """Zamienia NaN i nieskończoności na None dla poprawnej serializacji JSON."""
    return {k: (None if pd.isna(v) or v in [float('inf'), float('-inf')] else v) for k, v in record.items()}

@app.get("/")
def root():
    return {
        "message": "Live-time API is running",
        "total_records": len(records),
        "endpoints": [
            "/stream - ciągły strumień Server-Sent Events (SSE)",
            "/data?skip=0&limit=100 - zwykłe dane transzami"
        ]
    }

@app.get("/stream")
async def stream_data():
    """
    Endpoint symulujący napływ danych na żywo poprzez Server-Sent Events (SSE).
    Wysyła jeden wiersz co określony interwał z posortowanego zbioru test2_data.csv.
    """
    async def data_generator():
        for i, record in enumerate(records):
            cleaned = clean_dict(record)
            # Standard SSE: data: {"tu": "dane"}\n\n
            yield f"data: {json.dumps(cleaned)}\n\n"
            
            # Symulacja interwału co 200 milisekund miedzy zdarzeniami (dostosuj do swoich potrzeb)
            await asyncio.sleep(0.2)

    return StreamingResponse(data_generator(), media_type="text/event-stream")

@app.get("/data")
def get_data_chunks(skip: int = 0, limit: int = 100):
    """
    Tradycyjny endpoint REST pozwalający na pobieranie paczek (np. do zapytań 'polling').
    """
    chunk = records[skip : skip + limit]
    cleaned_chunk = [clean_dict(r) for r in chunk]
    return {
        "skip": skip,
        "limit": limit,
        "data": cleaned_chunk
    }

if __name__ == "__main__":
    uvicorn.run("fastapi_server:app", host="0.0.0.0", port=8000, reload=True)
