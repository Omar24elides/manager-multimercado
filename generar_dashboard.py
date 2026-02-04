import json
import requests
from bs4 import BeautifulSoup
import urllib3

# Evitar mensajes de error de certificados del BCV
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

def obtener_datos():
    print("🚀 Iniciando captura de datos...")
    
    # 1. Obtener Dólar BCV
    tasa_bcv = 37.50 # Valor de respaldo
    try:
        res = requests.get("https://www.bcv.org.ve/", verify=False, timeout=10)
        soup = BeautifulSoup(res.text, 'html.parser')
        tasa_bcv = float(soup.find('div', id='dolar').find('strong').text.strip().replace(',', '.'))
        print(f"✅ BCV capturado: {tasa_bcv}")
    except Exception as e:
        print(f"⚠️ Error BCV, usando respaldo: {e}")

    # 2. Obtener Bitcoin de Binance
    btc_price = 0
    try:
        res_binance = requests.get("https://api.binance.com/api/v3/ticker/price?symbol=BTCUSDT")
        btc_price = float(res_binance.json()['price'])
        print(f"✅ Binance capturado: {btc_price}")
    except Exception as e:
        print(f"⚠️ Error Binance: {e}")

    # 3. Crear el JSON (El Dashboard)
    dashboard = {
        "tasa_cambio": {
            "USD_VES": tasa_bcv
        },
        "cripto": {
            "BTC_USDT": btc_price
        },
        "acciones_bvc": {
            "RST": 5.50,
            "MVZ.A": 42.00
        },
        "status": "Actualizado"
    }
    
    with open('dashboard.json', 'w') as f:
        json.dump(dashboard, f, indent=4)
    
    print("✨ dashboard.json generado con éxito.")

if __name__ == "__main__":
    obtener_datos()