import flet as ft
import json
import subprocess

def main(page: ft.Page):
    page.title = "Elite Portfolio"
    page.theme_mode = ft.ThemeMode.DARK
    page.bgcolor = "#0F111A"
    page.padding = 20
    page.window_width = 450

    # UI Elements
    lbl_total = ft.Text("$ 0.00", size=40, weight="bold")
    lbl_pnl_g = ft.Text("Global: $0.00", color="green400")
    lbl_pnl_v = ft.Text("Vzla: Bs. 0.00", color="blue400")
    lbl_info = ft.Text("Cargando...", size=12, color="grey500")
    
    barra_v = ft.Container(bgcolor="blue700", height=12, width=0, border_radius=10)
    barra_g = ft.Container(bgcolor="green700", height=12, width=0, border_radius=10)
    lista_activos = ft.Column(spacing=10, scroll=ft.ScrollMode.ALWAYS, expand=True)

    # Inputs
    txt_tk = ft.TextField(label="Ticker", expand=2)
    txt_ca = ft.TextField(label="Cant.", expand=1)
    txt_co = ft.TextField(label="Costo Unit.", expand=1)
    dd_ti = ft.Dropdown(expand=2, value="wall_street", options=[
        ft.dropdown.Option("wall_street", "Global"), ft.dropdown.Option("accion_bvc", "Vzla")
    ])

    def cargar_ui(e=None):
        try:
            with open('dashboard.json', 'r') as f: m = json.load(f)
            with open('portafolio.json', 'r') as f: p = json.load(f)
            
            tasa = m["tasa_cambio"]["USD_VES"]
            lbl_info.value = f"BCV: {tasa} | Binance: {m['tasa_cambio']['USDT_BINANCE']} | BTC: ${m['cripto']['BTC_USDT']:,.0f}"
            
            tot_usd, pnl_g, pnl_v = 0, 0, 0
            val_v_usd, val_g_usd = 0, 0
            lista_activos.controls.clear()

            for a in p["activos"]:
                mkt = m.get("wall_street" if a["tipo"]=="wall_street" else "acciones_bvc", {})
                p_act = mkt.get(a["ticker"], 0)
                v_act = p_act * a["cantidad"]
                gan = v_act - (a["precio_compra"] * a["cantidad"])

                if a["tipo"] == "wall_street":
                    tot_usd += v_act; val_g_usd += v_act; pnl_g += gan
                    fmt = f"$ {v_act:,.2f}"
                else:
                    v_usd = v_act / tasa
                    tot_usd += v_usd; val_v_usd += v_usd; pnl_v += gan
                    fmt = f"Bs. {v_act:,.2f}"

                lista_activos.controls.append(ft.Container(
                    bgcolor="#1A1C26", padding=12, border_radius=10,
                    content=ft.Row([
                        ft.Column([ft.Text(a["ticker"], weight="bold"), ft.Text(a["tipo"].upper(), size=9)], expand=True),
                        ft.Column([ft.Text(fmt), ft.Text(f"{gan:+,.2f}", color="green" if gan>=0 else "red", size=11)], horizontal_alignment="end"),
                        ft.IconButton(ft.Icons.DELETE, on_click=lambda _, t=a["ticker"]: borrar(t))
                    ])
                ))

            total_r = val_v_usd + val_g_usd
            if total_r > 0:
                barra_v.width = (val_v_usd / total_r) * 400
                barra_g.width = (val_g_usd / total_r) * 400
            
            lbl_total.value = f"$ {tot_usd:,.2f}"
            lbl_pnl_g.value = f"Global: ${pnl_g:+,.2f}"
            lbl_pnl_v.value = f"Vzla: Bs. {pnl_v:+,.2f}"
            page.update()
        except: pass

    def agregar(e):
        with open('portafolio.json', 'r') as f: p = json.load(f)
        p["activos"].append({"ticker": txt_tk.value.upper(), "cantidad": float(txt_ca.value), "precio_compra": float(txt_co.value), "tipo": dd_ti.value})
        with open('portafolio.json', 'w') as f: json.dump(p, f, indent=4)
        txt_tk.value = ""; txt_ca.value = ""; txt_co.value = ""; txt_tk.focus(); cargar_ui()

    def borrar(tk):
        with open('portafolio.json', 'r') as f: p = json.load(f)
        p["activos"] = [a for a in p["activos"] if a["ticker"] != tk]
        with open('portafolio.json', 'w') as f: json.dump(p, f, indent=4); cargar_ui()

    def refrescar(e):
        subprocess.run(["python3", "generar_dashboard.py"]); cargar_ui()

    page.add(
        ft.Text("PORTAFOLIO USD", size=10, color="grey"),
        lbl_total, ft.Row([lbl_pnl_g, lbl_pnl_v], alignment="spaceBetween"),
        lbl_info, ft.Row([barra_v, barra_g], spacing=2),
        ft.Divider(height=10),
        ft.Row([txt_tk, dd_ti]), ft.Row([txt_ca, txt_co, ft.ElevatedButton("Añadir", on_click=agregar)]),
        ft.Row([ft.Text("Activos"), ft.TextButton("Sync Precios", icon=ft.Icons.SYNC, on_click=refrescar)], alignment="spaceBetween"),
        lista_activos
    )
    cargar_ui()

if __name__ == "__main__":
    ft.run(main)