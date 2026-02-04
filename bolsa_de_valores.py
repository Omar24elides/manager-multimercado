import requests
from bs4 import BeautifulSoup
import urllib3

# Desactivamos advertencias de SSL por si la web de la BVC tiene certificados vencidos
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

def get_bvc_stocks():
    url = "https://www.bolsadecaracas.com/cotizaciones/"
    headers = {'User-Agent': 'Mozilla/5.0'}
    
    try:
        # verify=False para evitar el error de SSL que viste antes
        response = requests.get(url, headers=headers, verify=False, timeout=15)
        soup = BeautifulSoup(response.text, 'html.parser')
        
        stocks = {}
        # Buscamos la tabla de cotizaciones
        table = soup.find('table')
        if not table:
            return "No se encontró la tabla de cotizaciones."

        rows = table.find_all('tr')
        for row in rows[1:]:  # Saltamos el encabezado
            cols = row.find_all('td')
            if len(cols) >= 5:
                # Limpieza de datos: Ticker y Precio
                ticker = cols[0].text.strip()
                # Tomamos el 'Último' precio (columna 4)
                precio = cols[4].text.strip().replace('.', '').replace(',', '.')
                if ticker:
                    stocks[ticker] = float(precio)
        
        return stocks
    except Exception as e:
        return f"Error BVC: {e}"

print("📈 Acciones Caracas:", get_bvc_stocks())