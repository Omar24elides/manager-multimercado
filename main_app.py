import flet as ft
import json
import subprocess # Para llamar a tu motor de C++

def main(page: ft.Page):
    page.title = "Manager Multimercado - Omar"
    page.theme_mode = ft.ThemeMode.DARK
    page.vertical_alignment = ft.MainAxisAlignment.START
    page.padding = 20

    # Variables de estado
    lbl_total_ves = ft.Text("0.00 VES", size=30, weight=ft.FontWeight.BOLD, color="green")
    lbl_total_usd = ft.Text("0.00 USD", size=20, color="bluegrey")
    lista_activos = ft.Column(scroll=ft.ScrollMode.AUTO, expand=True)

    def cargar_datos(e=None):
        # 1. Ejecutar el recolector de datos (Python)
        # Esto es lo mismo que hacías en la consola
        subprocess.run(["python3", "generar_dashboard.py"])
        
        # 2. Ejecutar el motor de C++ para actualizar historial y cálculos
        subprocess.run(["./motor_pnl"])

        # 3. Leer los resultados del JSON para la interfaz
        try:
            with open('dashboard.json', 'r') as f:
                market = json.load(f)
            with open('portafolio.json', 'r') as f:
                port = json.load(f)
            
            tasa = market["tasa_cambio"]["USD_VES"]
            lista_activos.controls.clear()
            total_acumulado_ves = 0

            # Lógica simple de visualización
            for activo in port["activos"]:
                ticker = activo["ticker"]
                tipo = activo["tipo"]
                
                # Buscar precio actual en el dashboard
                precio_act = 0
                if tipo == "wall_street": precio_act = market["wall_street"].get(ticker, 0)
                elif tipo == "accion_bvc": precio_act = market["acciones_bvc"].get(ticker, 0)

                pnl = (precio_act - activo["precio_compra"]) * activo["cantidad"]
                total_acumulado_ves += pnl

                lista_activos.controls.append(
                    ft.Card(
                        content=ft.Container(
                            padding=15,
                            content=ft.Row([
                                ft.Icon(ft.Icons.CURRENCY_EXCHANGE, color="amber"),
                                ft.Column([
                                    ft.Text(f"{ticker}", weight="bold"),
                                    ft.Text(f"Tipo: {tipo}", size=12),
                                ], expand=True),
                                ft.Text(f"{pnl:+.2f} VES", color="green" if pnl >= 0 else "red")
                            ])
                        )
                    )
                )

            lbl_total_ves.value = f"{total_acumulado_ves:,.2f} VES"
            lbl_total_usd.value = f"{total_acumulado_ves / tasa:,.2f} USD"
            page.update()
            
        except Exception as ex:
            print(f"Error cargando datos: {ex}")

    # Diseño de la Interfaz
    page.add(
        ft.Row([
            ft.Text("Mi Portafolio Global", size=24, weight="bold"),
            ft.IconButton(ft.Icons.REFRESH, on_click=cargar_datos, icon_color="blue")
        ], alignment=ft.MainAxisAlignment.SPACE_BETWEEN),
        
        ft.Container(
            content=ft.Column([
                ft.Text("Ganancia Total Estimada", size=16),
                lbl_total_ves,
                lbl_total_usd,
            ]),
            padding=20,
            bgcolor=ft.Colors.SURFACE_VARIANT,
            border_radius=10
        ),
        
        ft.Text("Desglose por Activo", size=18, weight="bold"),
        lista_activos
    )

    # Cargar datos al iniciar
    cargar_datos()

ft.app(target=main)