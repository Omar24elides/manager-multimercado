import json, os, requests, urllib3, asyncio
from flask import Flask, jsonify
from bs4 import BeautifulSoup
from telegram import Bot
import yfinance as yf

# 1. Primero desactivamos warnings e inicializamos la APP
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
app = Flask(__name__)

# --- CONFIGURACIÓN TELEGRAM ---
TOKEN = "TU_TOKEN_DE_BOTFATHER"
CHAT_ID = "TU_CHAT_ID"
bot = Bot(token=TOKEN)

# Archivo de caché
CACHE_PRECIO = "ultimo_precio_bcv.txt"

# --- RUTAS DE LA API ---

@app.route('/api/search_global/<query>')
def search_global(query):
    try:
        # Buscamos sugerencias en Yahoo Finance
        search = yf.Search(query, max_results=5)
        results = []
        for item in search.quotes:
            results.append({
                "symbol": item.get('symbol'),
                "name": item.get('shortname') or item.get('longname'),
                "type": "wall_street"
            })
        return jsonify(results)
    except Exception as e:
        return jsonify([])

@app.route('/api/search/<ticker>')
def get_single_price(ticker):
    """ Esta ruta la usa el JS al hacer clic en una sugerencia """
    try:
        stock = yf.Ticker(ticker)
        # Intentamos obtener el precio actual
        price = stock.fast_info.last_price
        return jsonify({"symbol": ticker, "price": price})
    except:
        return jsonify({"error": "No price found"}), 404

@app.route('/all', methods=['GET'])
def get_all():
    return jsonify({
        "bcv": scrapper_bcv(),
        "bvc": scrapper_bvc(),
        "binance": get_binance_p2p()
    })

# --- FUNCIONES DE APOYO ---

def obtener_precio_guardado():
    if os.path.exists(CACHE_PRECIO):
        with open(CACHE_PRECIO, "r") as f:
            try: return float(f.read())
            except: return 0.0
    return 0.0

def guardar_precio(valor):
    with open(CACHE_PRECIO, "w") as f:
        f.write(str(valor))

async def enviar_async(msg):
    async with bot:
        await bot.send_message(chat_id=CHAT_ID, text=msg, parse_mode='Markdown')

def enviar_alerta_telegram(mensaje):
    try:
        asyncio.run(enviar_async(mensaje))
    except Exception as e:
        print(f"Error enviando alerta: {e}")

# --- SCRAPERS ---

def scrapper_bcv():
    url = "https://www.bcv.org.ve/"
    headers = {'User-Agent': 'Mozilla/5.0'}
    try:
        response = requests.get(url, headers=headers, verify=False, timeout=10)
        soup = BeautifulSoup(response.text, 'html.parser')
        contenedor = soup.find(id="dolar")
        if not contenedor: return {"usd": obtener_precio_guardado(), "estado": "error"}
        
        dolar_text = contenedor.find('strong').text.strip().replace(',', '.')
        precio_actual = float(dolar_text)
        precio_anterior = obtener_precio_guardado()

        if precio_anterior != 0 and precio_actual > precio_anterior:
            diff = precio_actual - precio_anterior
            msg = f"⚠️ *ALERTA BCV*\n\nSubió: *+{diff:.4f} Bs.*\nPrecio: *{precio_actual:.4f} Bs.*"
            enviar_alerta_telegram(msg)
        
        guardar_precio(precio_actual)
        return {"usd": precio_actual, "estado": "success"}
    except Exception as e:
        return {"usd": obtener_precio_guardado(), "estado": "error", "mensaje": str(e)}

def scrapper_bvc():
    tickers = ["BVL.CR", "RST.CR", "BNC.CR", "AAPL", "NVDA", "TSLA", "MSFT"]
    precios = {}
    headers = {'User-Agent': 'Mozilla/5.0'}
    try:
        for ticker in tickers:
            url = f"https://query1.finance.yahoo.com/v8/finance/chart/{ticker}"
            response = requests.get(url, headers=headers, timeout=5)
            if response.status_code == 200:
                data = response.json()
                if data['chart']['result']:
                    precio = data['chart']['result'][0]['meta']['regularMarketPrice']
                    nombre = ticker.replace('.CR', '')
                    precios[nombre] = float(precio)
        return {"precios": precios, "estado": "success"}
    except:
        return {"precios": {}, "estado": "error"}

def get_binance_p2p():
    url = "https://p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search"
    headers = {
        "User-Agent": "Mozilla/5.0",
        "Content-Type": "application/json"
    }
    payload = {
        "asset": "USDT", "fiat": "VES", "merchantCheck": False,
        "page": 1, "rows": 1, "tradeType": "BUY", "publisherType": "merchant"
    }
    try:
        response = requests.post(url, json=payload, headers=headers, timeout=10)
        data = response.json()
        if data['data']:
            precio_crudo = float(data['data'][0]['adv']['price'])
            return {"usdt_ves": round(precio_crudo, 2), "estado": "success"}
        return {"usdt_ves": 0.0, "estado": "error"}
    except Exception as e:
        return {"usdt_ves": 0.0, "estado": "error"}

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)