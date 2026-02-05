#include <iostream>
#include <fstream>
#include <nlohmann/json.hpp>
#include <ctime> 

using json = nlohmann::json;
using namespace std;

int main() {
    try {
        ifstream f_dash("dashboard.json");
        json market = json::parse(f_dash);
        ifstream f_port("portafolio.json");
        json portfolio = json::parse(f_port);

        float tasa_bcv = market["tasa_cambio"]["USD_VES"];
        float total_ganancia_ves = 0;

        cout << "=== ESTADO DE CUENTA MULTIMERCADO ===" << endl;

        for (auto& item : portfolio["activos"]) {
            if (!item.contains("ticker") || !item.contains("cantidad") || !item.contains("precio_compra")) {
                cout << "⚠️ Error: Falta una llave en portafolio.json" << endl;
                continue;
            }

            string ticker = item["ticker"];
            string tipo = item["tipo"];
            float cant = item["cantidad"];
            float c_compra = item["precio_compra"];
            float p_actual = 0;

            if (tipo == "accion_bvc" && market["acciones_bvc"].contains(ticker)) {
                p_actual = market["acciones_bvc"][ticker];
            } 
            else if (tipo == "cripto" && market["cripto"].contains(ticker)) {
                p_actual = market["cripto"][ticker];
            }
            // Nueva validación para Wall Street
            else if (tipo == "wall_street" && market["wall_street"].contains(ticker)) {
                p_actual = market["wall_street"][ticker];
            }
            else {
                cout << "⚠️ Alerta: Ticker [" << ticker << "] no encontrado." << endl;
                continue;
            }

            float pnl = (p_actual - c_compra) * cant;
            total_ganancia_ves += pnl;
            cout << "Activo: " << ticker << " | P&L: " << pnl << " VES" << endl;
        }

        float total_usd = total_ganancia_ves / tasa_bcv;

        cout << "-------------------------------------" << endl;
        cout << "GANANCIA TOTAL: " << total_ganancia_ves << " VES" << endl;
        cout << "EQUIVALENTE:    " << total_usd << " USD" << endl;

        // --- SECCIÓN DE HISTORIAL (CSV) ---
        ofstream f_hist("historial.csv", ios::app); 
        if (f_hist.is_open()) {
            time_t now = time(0);
            char* dt = ctime(&now);
            string timestamp = string(dt);
            timestamp.pop_back(); // Quitar el salto de línea que trae ctime

            // Guardamos: Fecha, Ganancia_VES, Ganancia_USD
            f_hist << timestamp << "," << total_ganancia_ves << "," << total_usd << endl;
            f_hist.close();
            cout << "📊 Registro guardado en historial.csv" << endl;
        }

    } catch (const exception& e) {
        cerr << "❌ Error Crítico: " << e.what() << endl;
    }

    return 0;
}