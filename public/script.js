/**
 * FINANCE PRO - MOTOR DE INTERFAZ (FRONTEND)
 * Optimizado: Conexión Telegram corregida y Gráficos unificados.
 */

// --- ESTADO GLOBAL ---
let marketData = null;      
let ahorrosLiquidos = {};   
let pieC = null;            
let lineC = null;           
let currentEditType = '';   

const db = [
    {t:'AAPL', n:'Apple Inc.', m:'wall_street'}, {t:'TSLA', n:'Tesla Motors', m:'wall_street'},
    {t:'NVDA', n:'Nvidia Corp', m:'wall_street'}, {t:'MSFT', n:'Microsoft', m:'wall_street'},
    {t:'BVL', n:'Banco de Venezuela', m:'acciones_bvc'}, {t:'BNC', n:'Banco Nacional de Crédito', m:'acciones_bvc'},
    {t:'TDV.D', n:'CANTV Clase D', m:'acciones_bvc'}, {t:'RST', n:'Ron Santa Teresa', m:'acciones_bvc'}
];

/**
 * 1. NAVEGACIÓN Y CARGA
 */
function switchTab(tab) {
    const btnC = document.getElementById('tab-cartera');
    const btnI = document.getElementById('tab-inversiones');
    const viewC = document.getElementById('view-cartera');
    const viewI = document.getElementById('view-inversiones');

    if (tab === 'cartera') {
        btnC.className = "flex-1 py-3 rounded-xl text-[11px] font-black transition-all bg-[#F3BA2F] text-black shadow-lg";
        btnI.className = "flex-1 py-3 rounded-xl text-[11px] font-black transition-all text-gray-500 hover:text-gray-300";
        viewC.classList.remove('hidden');
        viewI.classList.add('hidden');
    } else {
        btnI.className = "flex-1 py-3 rounded-xl text-[11px] font-black transition-all bg-[#F3BA2F] text-black shadow-lg";
        btnC.className = "flex-1 py-3 rounded-xl text-[11px] font-black transition-all text-gray-500 hover:text-gray-300";
        viewI.classList.remove('hidden');
        viewC.classList.add('hidden');
    }
}

async function loadData() {
    try {
        const [resMarket, resAhorros] = await Promise.all([
            fetch('/api/dashboard'),
            fetch('/api/ahorros')
        ]);

        marketData = await resMarket.json();
        ahorrosLiquidos = await resAhorros.json();

        const bcv = marketData.mercado.bcv.usd;
        const usdtves = marketData.mercado.binance.usdt_ves;
        const btcPrice = marketData.mercado.crypto?.btc || 95000;

        document.getElementById('bcv-p').innerText = bcv.toFixed(2);
        document.getElementById('usdt-p').innerText = usdtves.toFixed(2);

        document.getElementById('save-ves').innerText = ahorrosLiquidos.ves.toLocaleString('es-VE');
        document.getElementById('save-cash').innerText = ahorrosLiquidos.usd.toLocaleString('en-US');
        document.getElementById('save-usdt').innerText = ahorrosLiquidos.usdt.toLocaleString('en-US');
        document.getElementById('save-btc').innerText = ahorrosLiquidos.btc.toFixed(6);

        const list = document.getElementById('assets-list');
        list.innerHTML = ''; 
        let valorInversionesUSD = 0;

        marketData.portafolio.forEach((a, i) => {
            const actual = marketData.mercado.bvc.precios[a.ticker] || a.precio_compra;
            const valPos = a.cantidad * actual;
            const valUSD = (a.tipo === 'acciones_bvc') ? valPos / bcv : valPos;
            valorInversionesUSD += valUSD;
            
            const pnl = valPos - (a.cantidad * a.precio_compra);
            const colorL = a.tipo === 'wall_street' ? 'border-yellow-500' : 'border-blue-500';

            list.innerHTML += `
                <div class="bg-[#1E2329] p-4 rounded-2xl flex justify-between items-center border-l-4 ${colorL} shadow-md mb-2">
                    <div class="flex flex-col">
                        <span class="font-black text-sm text-gray-200">${a.ticker}</span>
                        <span class="text-[10px] text-gray-500">Costo: ${a.precio_compra.toFixed(2)}</span>
                    </div>
                    <div class="text-right flex-1 px-4">
                        <p class="font-bold text-sm">$${valUSD.toFixed(2)}</p>
                        <p class="text-[10px] font-bold ${pnl >= 0 ? 'text-green-400' : 'text-red-400'}">
                            ${pnl >= 0 ? '▲' : '▼'} ${Math.abs(pnl).toFixed(2)}
                        </p>
                    </div>
                    <button onclick="delA(${i})" class="text-gray-700 hover:text-red-500 p-2"><i class="fa-solid fa-trash-can"></i></button>
                </div>`;
        });

        const cashEnUSD = ahorrosLiquidos.usd + (ahorrosLiquidos.ves / bcv) + ahorrosLiquidos.usdt + (ahorrosLiquidos.btc * btcPrice);
        const patrimonioTotal = valorInversionesUSD + cashEnUSD;
        
        animarValor('total-usd', patrimonioTotal);

    } catch(e) { console.error("Error loadData:", e); }
}

/**
 * 2. GESTIÓN DE SALDOS Y ACTIVOS
 */
function openEditModal(type) {
    currentEditType = type;
    const modal = document.getElementById('modal-saldo');
    const input = document.getElementById('input-saldo');
    const names = { ves: 'Bolívares', usd: 'Dólares Cash', usdt: 'USDT', btc: 'Bitcoin' };
    document.getElementById('modal-title').innerText = `Actualizar ${names[type]}`;
    document.getElementById('modal-currency').innerText = type.toUpperCase();
    input.value = ahorrosLiquidos[type] || 0;
    modal.classList.remove('hidden');
    input.focus();
}

async function saveNewBalance() {
    const val = parseFloat(document.getElementById('input-saldo').value) || 0;
    ahorrosLiquidos[currentEditType] = val;
    await fetch('/api/ahorros', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(ahorrosLiquidos)
    });
    document.getElementById('modal-saldo').classList.add('hidden');
    loadData();
}

async function addA() {
    const body = { 
        ticker: document.getElementById('sk').value.toUpperCase(), 
        cantidad: parseFloat(document.getElementById('ck').value), 
        precio_compra: parseFloat(document.getElementById('pk').value.replace(',','.')), 
        tipo: document.getElementById('tk').value 
    };
    if(!body.ticker || isNaN(body.cantidad)) return alert("Datos inválidos");
    await fetch('/api/agregar', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body) });
    ['sk', 'ck', 'pk'].forEach(id => document.getElementById(id).value = '');
    loadData();
}

async function delA(index) { 
    if(confirm("¿Eliminar activo?")) {
        await fetch('/api/eliminar', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ index }) }); 
        loadData(); 
    }
}

/**
 * 3. GRÁFICOS Y ANÁLISIS (UNIFICADO)
 */
function toggleAnalysis() {
    const m = document.getElementById('modal');
    m.classList.toggle('hidden');
    if(!m.classList.contains('hidden')) renderCharts();
}

function renderCharts() {
    const bcv = marketData.mercado.bcv.usd;
    const btcPrice = marketData.mercado.crypto?.btc || 95000;

    // Torta: Inversiones vs Liquidez
    let invUSD = marketData.portafolio.reduce((s, a) => {
        const p = marketData.mercado.bvc.precios[a.ticker] || a.precio_compra;
        return s + (a.tipo === 'acciones_bvc' ? (a.cantidad * p / bcv) : (a.cantidad * p));
    }, 0);
    let cashUSD = ahorrosLiquidos.usd + ahorrosLiquidos.usdt + (ahorrosLiquidos.ves / bcv) + (ahorrosLiquidos.btc * btcPrice);

    if(pieC) pieC.destroy();
    pieC = new Chart(document.getElementById('chartPie'), {
        type: 'doughnut',
        data: {
            labels: ['Inversiones', 'Liquidez'],
            datasets: [{ data: [invUSD.toFixed(2), cashUSD.toFixed(2)], backgroundColor: ['#F3BA2F', '#3B82F6'], borderWidth: 0 }]
        },
        options: { maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { color: '#848E9C' } } } }
    });

    // Línea: Historial
    const historial = marketData.historial || [];
    if(lineC) lineC.destroy();
    lineC = new Chart(document.getElementById('chartLine'), {
        type: 'line',
        data: {
            labels: historial.map(h => h.fecha),
            datasets: [{
                label: 'USD',
                data: historial.map(h => h.saldo || h.valor),
                borderColor: '#F3BA2F', tension: 0.4, fill: true, backgroundColor: 'rgba(243, 186, 47, 0.1)'
            }]
        },
        options: { maintainAspectRatio: false, scales: { x: { display: false }, y: { ticks: { color: '#848E9C' } } } }
    });
}

/**
 * 4. UTILIDADES Y TELEGRAM
 */
function animarValor(id, valorFinal) {
    const el = document.getElementById(id);
    let valorInicial = parseFloat(el.innerText.replace(/[^0-9.-]+/g, "")) || 0;
    const duracion = 1000;
    let inicio = null;
    function paso(timestamp) {
        if (!inicio) inicio = timestamp;
        const progreso = Math.min((timestamp - inicio) / duracion, 1);
        const actual = progreso * (valorFinal - valorInicial) + valorInicial;
        el.innerText = `$${actual.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
        if (progreso < 1) window.requestAnimationFrame(paso);
    }
    window.requestAnimationFrame(paso);
}

// CORRECCIÓN CLAVE: Función de Telegram mejorada
async function enviarTelegram(btnElement) {
    if(btnElement) btnElement.classList.add('animate-bounce');
    console.log("🚀 Disparando reporte a Telegram...");
    
    try {
        const res = await fetch('/api/notificar-telegram', { 
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });
        
        if (res.ok) {
            // Hemos quitado el alert("🚀 Reporte enviado a Telegram");
            console.log("✅ Reporte enviado con éxito");
            
            // Opcional: Cambia el color del botón un segundo para dar feedback visual
            if(btnElement) {
                btnElement.classList.replace('bg-[#24A1DE]', 'bg-green-500');
                setTimeout(() => btnElement.classList.replace('bg-green-500', 'bg-[#24A1DE]'), 2000);
            }
        }
    } catch (e) {
        console.error("Error de red:", e);
    } finally {
        if(btnElement) btnElement.classList.remove('animate-bounce');
    }
}

// Buscador predictivo
let debounceTimer;

async function filterP() {
    const v = document.getElementById('sk').value.toUpperCase();
    const b = document.getElementById('predictive');
    
    if (v.length < 1) { 
        b.classList.add('hidden'); 
        return; 
    }

    // 1. Filtrar primero en la base de datos local (BVC)
    let coincidencias = db.filter(x => x.t.includes(v) || x.n.toUpperCase().includes(v));
    
    // Mostrar resultados locales de inmediato
    renderSugerencias(coincidencias);

    // 2. Si el usuario escribe más de 2 letras, buscar en Wall Street (Yahoo)
    clearTimeout(debounceTimer);
    if (v.length >= 2) {
        debounceTimer = setTimeout(async () => {
            try {
                const res = await fetch(`/api/buscar-global-lista/${v}`);
                const globalResults = await res.json();
                
                // Combinar locales con globales (evitando duplicados)
                const final = [...coincidencias];
                globalResults.forEach(g => {
                    if (!final.find(f => f.t === g.symbol)) {
                        final.push({ t: g.symbol, n: g.name, m: 'wall_street' });
                    }
                });
                
                renderSugerencias(final);
            } catch (e) {
                console.error("Error en búsqueda global");
            }
        }, 500); // Espera 500ms tras la última tecla
    }
}

/**
 * CALCULADORA DINÁMICA
 */
function calcularCambio(origen) {
    // 1. Extraer los precios que ya cargó loadData() en la interfaz
    const bcvText = document.getElementById('bcv-p').innerText;
    const usdtText = document.getElementById('usdt-p').innerText;

    const tasaBCV = parseFloat(bcvText) || 0;
    const tasaUSDT = parseFloat(usdtText) || 0;

    const inputUSD = document.getElementById('conv-usd');
    const inputVES = document.getElementById('conv-ves');
    
    const resBCV = document.getElementById('res-bcv');
    const resBinance = document.getElementById('res-binance');

    if (tasaBCV === 0) return;

    if (origen === 'usd') {
        const usd = parseFloat(inputUSD.value) || 0;
        inputVES.value = (usd * tasaBCV).toFixed(2);
        
        resBCV.innerText = (usd * tasaBCV).toLocaleString('es-VE') + " Bs (BCV)";
        resBinance.innerText = (usd * tasaUSDT).toLocaleString('es-VE') + " Bs (P2P)";
    } else {
        const ves = parseFloat(inputVES.value) || 0;
        inputUSD.value = (ves / tasaBCV).toFixed(2);
        
        resBCV.innerText = (ves / tasaBCV).toLocaleString('en-US', {maximumFractionDigits:2}) + " USD (BCV)";
        resBinance.innerText = (ves / tasaUSDT).toLocaleString('en-US', {maximumFractionDigits:2}) + " USDT (P2P)";
    }
}

function renderSugerencias(lista) {
    const b = document.getElementById('predictive');
    if (lista.length === 0) {
        b.classList.add('hidden');
        return;
    }

    b.innerHTML = lista.map(x => `
        <div class="p-4 border-b border-gray-800 text-sm hover:bg-gray-800 cursor-pointer flex justify-between items-center" 
             onclick="seleccionarActivo('${x.t}', '${x.m}')">
            <div class="flex flex-col">
                <span class="font-bold text-yellow-500">${x.t}</span>
                <span class="text-[10px] text-gray-400 uppercase truncate w-40">${x.n}</span>
            </div>
            <span class="text-[9px] bg-gray-700 px-2 py-1 rounded text-gray-300">
                ${x.m === 'wall_street' ? '🇺🇸 NYSE/NASD' : '🇻🇪 BVC'}
            </span>
        </div>`).join('');
    b.classList.remove('hidden');
}

async function seleccionarActivo(ticker, mercado) {
    document.getElementById('sk').value = ticker;
    document.getElementById('tk').value = mercado;
    document.getElementById('predictive').classList.add('hidden');

    // Buscar precio actual automáticamente
    try {
        const res = await fetch(`/api/buscar-global/${ticker}`);
        const data = await res.json();
        if (data.price) {
            document.getElementById('pk').value = data.price.toFixed(2);
            console.log(`Precio cargado para ${ticker}: $${data.price}`);
        }
    } catch (e) {
        console.warn("No se pudo obtener el precio automático");
    }
}
function sel(t, m) { 
    document.getElementById('sk').value = t; 
    document.getElementById('tk').value = m; 
    document.getElementById('predictive').classList.add('hidden'); 
}

async function buscarTickerGlobal() {
    const ticker = document.getElementById('sk').value.toUpperCase();
    if (!ticker) return;

    const btn = document.getElementById('btn-search-global');
    btn.innerHTML = '<i class="fa-solid fa-spinner animate-spin"></i>';

    try {
        const res = await fetch(`/api/buscar-global/${ticker}`);
        const data = await res.json();

        if (data.error) {
            alert("No se encontró el activo en Yahoo Finance");
        } else {
            // Auto-completamos los campos del formulario
            document.getElementById('sk').value = data.symbol;
            document.getElementById('pk').value = data.price.toFixed(2);
            document.getElementById('tk').value = 'wall_street'; // Marcamos como mercado global
            
            console.log(`Encontrado: ${data.name} a $${data.price}`);
        }
    } catch (e) {
        console.error("Error en búsqueda global:", e);
    } finally {
        btn.innerHTML = '<i class="fa-solid fa-globe"></i>';
    }
}

// Inicialización
document.addEventListener('DOMContentLoaded', () => {
    loadData();
    setInterval(loadData, 60000);
});