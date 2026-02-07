import json, os, requests, urllib3, asyncio
from flask import Flask, jsonify
from bs4 import BeautifulSoup
from telegram import Bot

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

app = Flask(__name__)

# --- CONFIGURACIÓN TELEGRAM ---
TOKEN = "TU_TOKEN_DE_BOTFATHER"
CHAT_ID = "TU_CHAT_ID"
bot = Bot(token=TOKEN)

# Archivo para no perder el rastro del precio al reiniciar el script
CACHE_PRECIO = "ultimo_precio_bcv.txt"

def obtener_precio_guardado():
    if os.path.exists(CACHE_PRECIO):
        with open(CACHE_PRECIO, "r") as f:
            return float(f.read())
    return 0.0

def guardar_precio(valor):
    with open(CACHE_PRECIO, "w") as f:
        f.write(str(valor))

# --- FUNCIÓN PARA ENVIAR ALERTA ---
async def enviar_async(msg):
    async with bot:
        await bot.send_message(chat_id=CHAT_ID, text=msg, parse_mode='Markdown')

def enviar_alerta_telegram(mensaje):
    try:
        asyncio.run(enviar_async(mensaje))
    except Exception as e:
        print(f"Error enviando alerta: {e}")

# --- SCRAPER BCV CON MONITOREO ---
def scrapper_bcv():
    url = "https://www.bcv.org.ve/"
    headers = {'User-Agent': 'Mozilla/5.0'}
    try:
        response = requests.get(url, headers=headers, verify=False, timeout=10)
        soup = BeautifulSoup(response.text, 'html.parser')
        
        # Extracción segura
        contenedor = soup.find(id="dolar")
        if not contenedor: return {"usd": obtener_precio_guardado(), "estado": "error"}
        
        dolar_text = contenedor.find('strong').text.strip().replace(',', '.')
        precio_actual = float(dolar_text)
        
        precio_anterior = obtener_precio_guardado()

        # LÓGICA DE MONITOREO
        if precio_anterior != 0 and precio_actual > precio_anterior:
            diff = precio_actual - precio_anterior
            msg = f"⚠️ *ALERTA BCV*\n\nSubió: *+{diff:.4f} Bs.*\nPrecio: *{precio_actual:.4f} Bs.*"
            enviar_alerta_telegram(msg)
            print(f"🔔 Alerta enviada: {precio_actual}")
        
        guardar_precio(precio_actual)
        return {"usd": precio_actual, "estado": "success"}
    except Exception as e:
        return {"usd": obtener_precio_guardado(), "estado": "error", "mensaje": str(e)}

# --- SCRAPER BVC (Yahoo) ---
def scrapper_bvc():
    # Asegúrate que estos tickers existan en Yahoo o no traerá nada
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

# --- BINANCE ---
def get_binance_p2p():
    url = "https://p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search"
    
    # Encabezados para que Binance no detecte el bot
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Content-Type": "application/json"
    }
    
    payload = {
        "asset": "USDT",
        "fiat": "VES",
        "merchantCheck": False,
        "page": 1,
        "rows": 1,
        "tradeType": "BUY",
        "publisherType": "merchant"
    }
    
    try:
        response = requests.post(url, json=payload, headers=headers, timeout=10)
        data = response.json()
        
        if data['data']:
            precio_crudo = float(data['data'][0]['adv']['price'])
            # Redondeo a 2 decimales exactos
            precio_formateado = round(precio_crudo, 2)
            return {"usdt_ves": precio_formateado, "estado": "success"}
        
        return {"usdt_ves": 0.0, "estado": "error"}
    except Exception as e:
        print(f"❌ Error en Binance API: {e}")
        return {"usdt_ves": 0.0, "estado": "error"}

@app.route('/all', methods=['GET'])
def get_all():
    return jsonify({
        "bcv": scrapper_bcv(),
        "bvc": scrapper_bvc(),
        "binance": get_binance_p2p()
    })

if __name__ == '__main__':
    # Puerto 5000 para que Node lo encuentre
    app.run(host='0.0.0.0', port=5000)