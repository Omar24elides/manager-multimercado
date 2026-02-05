import flet as ft
import json
import subprocess
from datetime import datetime

def main(page: ft.Page):
    page.title = "Omar's Global Terminal"
    page.theme_mode = ft.ThemeMode.DARK
    page.scroll = ft.ScrollMode.AUTO
    
    # --- UI ELEMENTS ---
    chart = ft.PieChart(sections=[], sections_space=0, center_space_radius=40, expand=True)
    lista_activos = ft.Column()
    
    # Campos nuevos con Fecha
    txt_ticker = ft.TextField(label="Ticker", expand=True)
    txt_cantidad = ft.TextField(label="Cant", expand=1)
    txt_precio = ft.TextField(label="Precio Compra", expand=1)
    txt_fecha = ft.TextField(label="Fecha (DD/MM/AAAA)", value=datetime.now().strftime("%d/%m/%Y"), expand=1)
    dd_tipo = ft.Dropdown(label="Mercado", options=[ft.dropdown.Option("wall_street"), ft.dropdown.Option("accion_bvc")])

    def cargar_datos(e=None):
        subprocess.run(["python3", "generar_dashboard.py"])
        subprocess.run(["./motor_pnl"])
        
        try:
            with open('dashboard.json', 'r') as f: market = json.load(f)
            with open('portafolio.json', 'r') as f: port = json.load(f)
            
            tasa = market["tasa_cambio"]["USD_VES"]
            lista_activos.controls.clear()
            pie_data = {}
            total_invertido_usd = 0

            for activo in port["activos"]:
                ticker = activo["ticker"]
                tipo = activo["tipo"]
                precios = market.get("wall_street" if tipo == "wall_street" else "acciones_bvc", {})
                p_actual = precios.get(ticker, 0)
                
                # Cálculos de rendimiento
                pnl_ves = (p_actual - activo["precio_compra"]) * activo["cantidad"]
                porcentaje = ((p_actual / activo["precio_compra"]) - 1) * 100 if activo["precio_compra"] > 0 else 0
                
                # Para la gráfica de torta
                valor_actual_usd = (p_actual * activo["cantidad"]) / (tasa if tipo == "accion_bvc" else 1)
                pie_data[ticker] = pie_data.get(ticker, 0) + valor_actual_usd
                
                # Color de alerta
                color_pnl = ft.Colors.GREEN_ACCENT if pnl_ves >= 0 else ft.Colors.RED_ACCENT
                if porcentaje < -10: color_pnl = ft.Colors.ORANGE_700 # Alerta de caída fuerte

                lista_activos.controls.append(
                    ft.Container(
                        content=ft.Column([
                            ft.Row([
                                ft.Text(f"{ticker}", size=18, weight="bold"),
                                ft.Text(f"{porcentaje:+.2f}%", color=color_pnl, weight="bold"),
                                ft.IconButton(ft.Icons.DELETE, icon_color="red400", on_click=lambda _, t=ticker: borrar(t))
                            ], alignment="spaceBetween"),
                            ft.Row([
                                ft.Text(f"Compra: {activo.get('fecha', 'S/F')}", size=12, color="grey"),
                                ft.Text(f"P. Compra: {activo['precio_compra']}", size=12),
                                ft.Text(f"P. Actual: {p_actual}", size=12, weight="bold"),
                            ], alignment="spaceBetween"),
                            ft.Divider(height=1, color="white24")
                        ]),
                        padding=10
                    )
                )

            # Actualizar Gráfica
            chart.sections = [
                ft.PieChartSection(val, title=f"{tk}", title_style=ft.TextStyle(size=10, weight="bold"), 
                                   radius=30, color=ft.Colors.AMBER if "BVC" in tk else ft.Colors.BLUE) 
                for tk, val in pie_data.items()
            ]
            
            page.update()
        except Exception as ex: print(f"Error: {ex}")

    def borrar(t):
        with open('portafolio.json', 'r') as f: port = json.load(f)
        port["activos"] = [a for a in port["activos"] if a["ticker"] != t]
        with open('portafolio.json', 'w') as f: json.dump(port, f, indent=4)
        cargar_datos()

    def agregar(e):
        with open('portafolio.json', 'r') as f: port = json.load(f)
        port["activos"].append({
            "ticker": txt_ticker.value.upper(),
            "cantidad": float(txt_cantidad.value),
            "precio_compra": float(txt_precio.value),
            "fecha": txt_fecha.value,
            "tipo": dd_tipo.value
        })
        with open('portafolio.json', 'w') as f: json.dump(port, f, indent=4)
        cargar_datos()

    # --- LAYOUT ---
    page.add(
        ft.Text("Métricas de Portafolio", size=28, weight="bold"),
        ft.Row([
            ft.Container(chart, height=200, width=200),
            ft.Column([
                ft.Text("Distribución de Activos", weight="bold"),
                ft.Text("Azul: Wall Street\nÁmbar: Venezuela", size=12)
            ])
        ]),
        ft.ExpansionTile(
            title=ft.Text("Añadir Nuevo Activo"),
            controls=[
                ft.Row([txt_ticker, txt_cantidad]),
                ft.Row([txt_precio, txt_fecha, dd_tipo]),
                ft.ElevatedButton("Guardar en Portafolio", on_click=agregar)
            ]
        ),
        ft.Divider(),
        lista_activos
    )
    cargar_datos()

ft.app(target=main, view=ft.AppView.WEB_BROWSER)