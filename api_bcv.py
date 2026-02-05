from flask import Flask, jsonify
import requests
from bs4 import BeautifulSoup
import urllib3

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

app = Flask(__name__)

def scrapper_bcv():
    url = "https://www.bcv.org.ve/"
    headers = {'User-Agent': 'Mozilla/5.0'}
    try:
        response = requests.get(url, headers=headers, verify=False, timeout=10)
        soup = BeautifulSoup(response.text, 'html.parser')
        dolar = soup.find(id="dolar").find('strong').text.strip().replace(',', '.')
        euro = soup.find(id="euro").find('strong').text.strip().replace(',', '.')
        return {"usd": float(dolar), "eur": float(euro), "estado": "success"}
    except Exception as e:
        return {"estado": "error", "mensaje": str(e)}

@app.route('/precio', methods=['GET'])
def get_precio():
    return jsonify(scrapper_bcv())

if __name__ == '__main__':
    app.run(debug=True, port=5000)
