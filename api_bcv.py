import os
import requests
import urllib3
import asyncio
from flask import Flask, jsonify
from flask_cors import CORS
from bs4 import BeautifulSoup
from telegram import Bot
import yfinance as yf

# Desactivar advertencias de SSL para el BCV
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

app = Flask(__name__)
CORS(app)

# --- CONFIGURACIÓN ---
# Recomendación: Usar variables de entorno en producción
TOKEN = os.getenv("TELEGRAM_TOKEN", "8254188148:AAHWVBXksKwRryAcIwThjnaBED2Co5TzuXQ")
CHAT_ID = os.getenv("TELEGRAM_CHAT_ID", "1702728718")
CACHE_PRECIO = "ultimo_precio_bcv.txt"

# --- UTILIDADES ---
def obtener_precio_guardado():
    if os.path.exists(CACHE_PRECIO):
        with open(CACHE_PRECIO, "r") as f:
            try: return float(f.read())
            except: return 0.0
    return 0.0

def guardar_precio(valor):
    with open(CACHE_PRECIO, "w") as f:
        f.write(str(valor))

# --- SCRAPERS ---
def scrapper_bcv():
    url = "https://www.bcv.org.ve/"
    headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'}
    try:
        response = requests.get(url, headers=headers, verify=False, timeout=15)
        soup = BeautifulSoup(response.text, 'html.parser')
        contenedor = soup.find(id="dolar")
        if not contenedor: return {"usd": obtener_precio_guardado(), "estado": "error"}
        
        precio_actual = float(contenedor.find('strong').text.strip().replace(',', '.'))
        guardar_precio(precio_actual)
        return {"usd": precio_actual, "estado": "success"}
    except:
        return {"usd": obtener_precio_guardado(), "estado": "error"}

def get_binance_p2p():
    url = "https://p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search"
    payload = {
        "asset": "USDT", "fiat": "VES", "merchantCheck": False,
        "page": 1, "rows": 3, "tradeType": "BUY", "publisherType": "merchant"
    }
    try:
        # Intentamos obtener el promedio de los 3 mejores precios para más estabilidad
        response = requests.post(url, json=payload, timeout=10)
        data = response.json()
        precios = [float(adv['adv']['price']) for adv in data['data']]
        avg_price = sum(precios) / len(precios)
        return {"usdt_ves": round(avg_price, 2), "estado": "success"}
    except:
        return {"usdt_ves": 0.0, "estado": "error"}

# --- RUTAS API ---
@app.route('/all', methods=['GET'])
def get_all():
    # Obtener Bitcoin directamente de yfinance para el reporte
    btc_data = yf.Ticker("BTC-USD").fast_info
    return jsonify({
        "bcv": scrapper_bcv(),
        "binance": get_binance_p2p(),
        "crypto": {"btc": btc_data.get('last_price', 95000)},
        "bvc": {"precios": {}} # Aquí puedes añadir tus tickers fijos de la BVC
    })

@app.route('/api/search_global/<query>')
def search_global(query):
    search = yf.Search(query, max_results=5)
    return jsonify([{"symbol": i['symbol'], "name": i.get('shortname', 'Stock')} for i in search.quotes])

@app.route('/api/search/<ticker>')
def get_price(ticker):
    try:
        stock = yf.Ticker(ticker)
        price = stock.fast_info.get('last_price') or stock.history(period="1d")['Close'].iloc[-1]
        return jsonify({"price": float(price)})
    except:
        return jsonify({"error": "Not found"}), 404

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)