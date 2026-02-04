import yfinance as yf

def get_market_data():
    # Tickers: AAPL (Apple), BTC-USD (Bitcoin)
    tickers = ["AAPL", "BTC-USD", "MSFT"]
    
    data_points = {}
    
    for ticker in tickers:
        try:
            asset = yf.Ticker(ticker)
            hist = asset.history(period="1d")

            if not hist.empty:
                # Obtenemos el precio de cierre más reciente
                price = hist['Close'].iloc[-1]
                data_points[ticker] = round(price, 2)
            else:
                # Plan B: Si es de Caracas y no está en Yahoo, pondremos un precio manual 
                # o un mensaje más limpio para el usuario.
                data_points[ticker] = "Dato no disponible hoy"
        except Exception as e:
            data_points[ticker] = f"Error: {e}"
            
    return data_points

if __name__ == "__main__":
    print("Precios de Mercado Actualizados:")
    prices = get_market_data()
    for t, p in prices.items():
        print(f"{t}: {p}")