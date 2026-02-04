import requests

def get_binance_prices():
    # Pares comunes: BTC/USDT, ETH/USDT, y el precio del USDT en dólares (siempre ~1)
    pairs = ["BTCUSDT", "ETHUSDT", "BNBUSDT", "SOLUSDT"]
    base_url = "https://api.binance.com/api/v3/ticker/price?symbol="
    
    crypto_data = {}
    
    try:
        for pair in pairs:
            response = requests.get(base_url + pair)
            data = response.json()
            # Guardamos el precio formateado
            crypto_data[pair] = round(float(data['price']), 2)
        
        # El USDT siempre vale 1 USD, pero si quieres ver el volumen o variaciones
        # podrías consultar otros pares. Aquí lo añadimos como referencia.
        crypto_data["USDT_USD"] = 1.00
        
        return crypto_data
    except Exception as e:
        return f"Error Binance: {e}"

print("₿ Precios Binance:", get_binance_prices())