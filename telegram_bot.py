import asyncio
import requests
import json
import os
from telegram import Bot
from datetime import datetime

TOKEN = "8254188148:AAHWVBXksKwRryAcIwThjnaBED2Co5TzuXQ"
CHAT_ID = "1702728718"
API_URL = "http://localhost:5000/all" 
# Usamos rutas absolutas para que el Cron de Linux no falle
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PORTAFOLIO_PATH = os.path.join(BASE_DIR, "portafolio.json")
AHORROS_PATH = os.path.join(BASE_DIR, "ahorros.json")

async def enviar_resumen():
    try:
        r = requests.get(API_URL, timeout=15).json()
        bcv = r['bcv']['usd']
        usdt_ves = r['binance']['usdt_ves']
        btc_price = r['crypto']['btc']
        
        total_usd = 0
        mensaje = f"🏦 *FINANCE PRO - ESTADO DE CUENTA*\n"
        mensaje += f"📅 _Sincronizado: {datetime.now().strftime('%d/%m %H:%M')}_\n"
        mensaje += f"━━━━━━━━━━━━━━━━━━\n"
        mensaje += f"💵 *BCV:* `{bcv:.2f}`\n"
        mensaje += f"🔶 *USDT:* `{usdt_ves:.2f}`\n"
        mensaje += f"━━━━━━━━━━━━━━━━━━\n\n"

        # Inversiones
        if os.path.exists(PORTAFOLIO_PATH):
            with open(PORTAFOLIO_PATH, 'r') as f:
                data = json.load(f)
                activos = data.get('activos', [])
                if activos:
                    mensaje += "📈 *INVERSIONES*\n"
                    for a in activos:
                        # Lógica de precio actual
                        precio = r['bvc']['precios'].get(a['ticker'].replace('.CR',''), a['precio_compra'])
                        v_usd = (a['cantidad'] * precio) / bcv if a['tipo'] == 'acciones_bvc' else (a['cantidad'] * precio)
                        total_usd += v_usd
                        mensaje += f" • `{a['ticker']}`: ${v_usd:,.2f}\n"

        # Liquidez
        if os.path.exists(AHORROS_PATH):
            with open(AHORROS_PATH, 'r') as f:
                ah = json.load(f)
                total_caja = ah.get('usd',0) + ah.get('usdt',0) + (ah.get('ves',0)/bcv) + (ah.get('btc',0)*btc_price)
                total_usd += total_caja
                mensaje += f"\n💰 *LIQUIDEZ:* `${total_caja:,.2f}`\n"

        mensaje += f"\n━━━━━━━━━━━━━━━━━━\n"
        mensaje += f"🏆 *PATRIMONIO NETO*\n"
        mensaje += f"💰 *${total_usd:,.2f} USD*\n"
        mensaje += f"🇻🇪 *Bs. {total_usd * bcv:,.2f}*\n"
        mensaje += f"━━━━━━━━━━━━━━━━━━"

        bot = Bot(token=TOKEN)
        async with bot:
            await bot.send_message(chat_id=CHAT_ID, text=mensaje, parse_mode='Markdown')

    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(enviar_resumen())