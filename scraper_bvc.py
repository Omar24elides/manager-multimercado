import requests
from bs4 import BeautifulSoup

def get_bvc_prices():
    url = "https://www.bolsadecaracas.com/cotizaciones/"
    headers = {'User-Agent': 'Mozilla/5.0'}
    response = requests.get(url, headers=headers)
    
    soup = BeautifulSoup(response.text, 'html.parser')
    
    # Buscamos la tabla de cotizaciones
    table = soup.find('table')
    stocks = {}

    for row in table.find_all('tr')[1:]: # Saltamos el encabezado
        cols = row.find_all('td')
        if len(cols) > 0:
            simbolo = cols[0].text.strip()
            precio_cierre = cols[4].text.strip() # Dependiendo de la web, ajustamos el índice
            stocks[simbolo] = precio_cierre
            
    return stocks

print("Precios BVC hoy:", get_bvc_prices())