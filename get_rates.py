import requests
from bs4 import BeautifulSoup
import urllib3

# Deshabilitar advertencias de certificados (el BCV a veces tiene problemas de SSL)
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

def get_bcv_fallback():
    """Scraper directo a la web del BCV cuando la API falla"""
    url = "https://www.bcv.org.ve/"
    headers = {'User-Agent': 'Mozilla/5.0'}
    try:
        # verify=False porque el BCV suele tener certificados expirados o mal configurados
        response = requests.get(url, headers=headers, verify=False, timeout=10)
        soup = BeautifulSoup(response.text, 'html.parser')
        
        # El precio del USD está en un div con id "dolar"
        usd_container = soup.find('div', id='dolar')
        if usd_container:
            precio = usd_container.find('strong').text.strip()
            # Convertimos la coma decimal de Ven a punto para Python
            return float(precio.replace(',', '.'))
    except Exception as e:
        print(f"Error en Scraper BCV: {e}")
    return None

def get_bcv_price():
    url = "https://www.bcvapi.tech/api/v1/exchange" 
    try:
        response = requests.get(url, timeout=5)
        if response.status_code == 200:
            data = response.json()
            return float(data['message']['USD'])
        else:
            print(f"API BCV retornó status {response.status_code}. Usando fallback...")
            return get_bcv_fallback()
    except:
        return get_bcv_fallback()

if __name__ == "__main__":
    dolar = get_bcv_price()
    if dolar:
        print(f"✅ Tasa obtenida: {dolar} VES/USD")
    else:
        print("❌ No se pudo obtener la tasa por ningún método.")