import asyncio
import requests
import json
import os
from telegram import Bot

# --- CONFIGURACIÓN ---
TOKEN = "8254188148:AAHWVBXksKwRryAcIwThjnaBED2Co5TzuXQ"
CHAT_ID = "1702728718"
API_URL = "http://localhost:5000/all" 
PORTAFOLIO_PATH = "./portafolio.json"
AHORROS_PATH = "./ahorros.json"  # <--- Nueva ruta necesaria

bot = Bot(token=TOKEN)

async def enviar_resumen():
    try:
        # 1. Obtener datos de mercado
        r = requests.get(API_URL).json()
        bcv = r['bcv']['usd']
        usdt_ves = r['binance']['usdt_ves']
        btc_price = 65000 # Precio referencia
        
        total_usd = 0
        mensaje = f"📊 *REPORTE FINANCE PRO*\n"
        mensaje += f"━━━━━━━━━━━━━━━\n"
        mensaje += f"💵 *BCV:* {bcv:.2f} | 🟢 *USDT:* {usdt_ves:.2f}\n\n"

        # 2. Procesar Inversiones (Acciones)
        if os.path.exists(PORTAFOLIO_PATH):
            with open(PORTAFOLIO_PATH, 'r') as f:
                p = json.load(f)
            
            if p['activos']:
                mensaje += "📈 *Inversiones:*\n"
                for a in p['activos']:
                    ticker_key = a['ticker'].replace('.CR', '')
                    precio_actual = r['bvc']['precios'].get(ticker_key, a['precio_compra'])
                    valor_pos = a['cantidad'] * precio_actual
                    v_usd = valor_pos / bcv if a['tipo'] == 'acciones_bvc' else valor_pos
                    total_usd += v_usd
                    
                    pnl = valor_pos - (a['cantidad'] * a['precio_compra'])
                    emoji = "🔹" # Para inversiones
                    mensaje += f"{emoji} {a['ticker']}: ${v_usd:.2f}\n"

        # 3. Procesar Ahorros Líquidos (La Billetera)
        if os.path.exists(AHORROS_PATH):
            with open(AHORROS_PATH, 'r') as f:
                ah = json.load(f)
            
            # Calculamos el valor de la caja en USD
            caja_usd = ah.get('usd', 0)
            caja_usdt = ah.get('usdt', 0)
            caja_ves_en_usd = ah.get('ves', 0) / bcv
            caja_btc_en_usd = ah.get('btc', 0) * btc_price
            
            total_caja = caja_usd + caja_usdt + caja_ves_en_usd + caja_btc_en_usd
            total_usd += total_caja
            
            mensaje += f"\n💰 *Liquidez:* ${total_caja:.2f}\n"
            mensaje += f"   (USDT: {ah.get('usdt', 0)} | Bs: {ah.get('ves', 0)})\n"

        # 4. Total Final
        mensaje += f"━━━━━━━━━━━━━━━\n"
        mensaje += f"🏆 *PATRIMONIO NETO:* ${total_usd:.2f}\n"
        mensaje += f"≈ Bs. {total_usd * bcv:.2f}"

        async with bot:
            await bot.send_message(chat_id=CHAT_ID, text=mensaje, parse_mode='Markdown')
        print(f"✅ Notificación enviada: ${total_usd:.2f}")

    except Exception as e:
        print(f"❌ Error en Bot: {e}")

if __name__ == "__main__":
    asyncio.run(enviar_resumen())