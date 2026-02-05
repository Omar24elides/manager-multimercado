import json
import requests
import yfinance as yf
from datetime import datetime

def obtener_datos():
    print("🚀 Sincronizando mercados...")
    
    # 1. Obtener BCV desde TU API
    try:
        res = requests.get("http://127.0.0.1:5000/precio", timeout=5)
        tasa_bcv = res.json()["usd"]
    except:
        tasa_bcv = 47.50 # Fallback

    # 2. Obtener Wall Street y Cripto Real
    tickers = ["AAPL", "TSLA", "NVDA", "BTC-USD"]
    precios = {}
    for t in tickers:
        try:
            data = yf.Ticker(t).fast_info
            precios[t] = data['last_price']
        except:
            precios[t] = 0

    dashboard = {
        "last_update": datetime.now().strftime("%d/%m/%Y %H:%M:%S"),
        "tasa_cambio": {
            "USD_VES": tasa_bcv,
            "USDT_BINANCE": round(tasa_bcv * 1.04, 2)
        },
        "cripto": {"BTC_USDT": precios.get("BTC-USD", 0)},
        "wall_street": {
            "AAPL": precios.get("AAPL", 0),
            "TSLA": precios.get("TSLA", 0),
            "NVDA": precios.get("NVDA", 0)
        },
        "acciones_bvc": {"RST": 6.15, "MVZ.A": 46.50, "BPV": 1.55}
    }

    with open('dashboard.json', 'w') as f:
        json.dump(dashboard, f, indent=4)
    print("✅ Dashboard actualizado con éxito.")

if __name__ == "__main__":
    obtener_datos()