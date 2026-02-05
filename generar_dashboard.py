import json
import requests
import yfinance as yf
from bs4 import BeautifulSoup
import urllib3

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

def obtener_datos():
    print("🚀 Actualizando Portafolio Global...")
    
    # 1. Tasa BCV
    tasa_bcv = 37.50
    try:
        res = requests.get("https://www.bcv.org.ve/", verify=False, timeout=5)
        soup = BeautifulSoup(res.text, 'html.parser')
        tasa_bcv = float(soup.find('div', id='dolar').find('strong').text.strip().replace(',', '.'))
    except: pass

    # 2. Wall Street & ETFs (AAPL, MSFT, NVDA, O, TSM, EXSA.DE, etc.)
    # Agregamos los tickers de tu lista
    tickers_internacionales = ["MSFT", "NVDA", "JPM", "O", "CAT", "PEP", "TSM", "EXSA.DE", "AMZN", "COST"]
    data_ws = {}
    try:
        for t in tickers_internacionales:
            ticker = yf.Ticker(t)
            data_ws[t] = round(ticker.fast_info['last_price'], 2)
        print("✅ Precios Internacionales actualizados")
    except Exception as e:
        print(f"⚠️ Error en Wall Street: {e}")

    # 3. Bolsa de Valores de Caracas (Valores manuales o Scraper)
    # Aquí pondremos los que mencionaste
    data_bvc = {
        "MVZ.A": 42.00,
        "BPV": 1.35,
        "BNC": 0.05,
        "RST": 5.50,
        "TDV.D": 1.15,
        "FVI.B": 2.10
    }

    dashboard = {
        "tasa_cambio": {"USD_VES": tasa_bcv},
        "cripto": {"BTC_USDT": 0.0}, # Puedes reactivar el de ayer
        "wall_street": data_ws,
        "acciones_bvc": data_bvc,
        "status": "Actualizado"
    }

    with open('dashboard.json', 'w') as f:
        json.dump(dashboard, f, indent=4)
    print("✨ dashboard.json listo para el motor de C++")

if __name__ == "__main__":
    obtener_datos()