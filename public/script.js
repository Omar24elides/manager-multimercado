/**
 * FINANCE PRO - MOTOR DE INTERFAZ (FRONTEND)
 * Este archivo gestiona la lógica visual, los cálculos y la comunicación con el servidor.
 */

// --- ESTADO GLOBAL ---
let marketData = null;      // Datos de BVC, BCV y Precios
let ahorrosLiquidos = {};   // Saldo en USD, VES, USDT, BTC
let pieC = null;            // Instancia del gráfico Circular
let lineC = null;           // Instancia del gráfico de Línea
let currentEditType = '';   // Moneda seleccionada para editar

// Base de datos para el buscador predictivo
const db = [
    {t:'AAPL', n:'Apple Inc.', m:'wall_street'}, {t:'TSLA', n:'Tesla Motors', m:'wall_street'},
    {t:'NVDA', n:'Nvidia Corp', m:'wall_street'}, {t:'MSFT', n:'Microsoft', m:'wall_street'},
    {t:'BVL', n:'Banco de Venezuela', m:'acciones_bvc'}, {t:'BNC', n:'Banco Nacional de Crédito', m:'acciones_bvc'},
    {t:'TDV.D', n:'CANTV Clase D', m:'acciones_bvc'}, {t:'RST', n:'Ron Santa Teresa', m:'acciones_bvc'}
];

/**
 * 1. NAVEGACIÓN ENTRE PESTAÑAS
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

/**
 * 2. CARGA Y PROCESAMIENTO DE DATOS
 */
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
        const btcPrice = 65000; // Precio base para cálculo rápido

        // Actualizar Widget Superior (BCV/USDT)
        document.getElementById('bcv-p').innerText = bcv.toFixed(2);
        document.getElementById('usdt-p').innerText = usdtves.toFixed(2);

        // Actualizar Tarjetas de la Cartera
        document.getElementById('save-ves').innerText = ahorrosLiquidos.ves.toLocaleString('es-VE');
        document.getElementById('save-cash').innerText = ahorrosLiquidos.usd.toLocaleString('en-US');
        document.getElementById('save-usdt').innerText = ahorrosLiquidos.usdt.toLocaleString('en-US');
        document.getElementById('save-btc').innerText = ahorrosLiquidos.btc.toFixed(6);

        // Procesar Inversiones (Lista vertical)
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
                <div class="bg-[#1E2329] p-4 rounded-2xl flex justify-between items-center border-l-4 ${colorL} shadow-md">
                    <div class="flex flex-col">
                        <span class="font-black text-sm text-gray-200">${a.ticker}</span>
                        <span class="text-[10px] text-gray-500 tracking-tight">Costo: ${a.precio_compra.toFixed(2)}</span>
                    </div>
                    <div class="text-right flex-1 px-4">
                        <p class="font-bold text-sm">$${valUSD.toFixed(2)}</p>
                        <p class="text-[10px] font-bold ${pnl >= 0 ? 'text-green-400' : 'text-red-400'}">
                            ${pnl >= 0 ? '▲' : '▼'} ${Math.abs(pnl).toFixed(2)}
                        </p>
                    </div>
                    <button onclick="delA(${i})" class="text-gray-700 hover:text-red-500 transition-colors p-2">
                        <i class="fa-solid fa-trash-can"></i>
                    </button>
                </div>`;
        });

        // CALCULO PATRIMONIO TOTAL (Inversiones + Caja)
        const cashEnUSD = ahorrosLiquidos.usd + 
                         (ahorrosLiquidos.ves / bcv) + 
                         (ahorrosLiquidos.usdt) + 
                         (ahorrosLiquidos.btc * btcPrice);

        const patrimonioTotal = valorInversionesUSD + cashEnUSD;
        document.getElementById('total-usd').innerText = patrimonioTotal.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2});

    } catch(e) { console.error("Error en loadData:", e); }
}

/**
 * 3. MODAL DE AHORROS (ACTUALIZACIÓN RÁPIDA)
 */
function openEditModal(type) {
    currentEditType = type;
    const modal = document.getElementById('modal-saldo');
    const input = document.getElementById('input-saldo');
    const names = { ves: 'Bolívares', usd: 'Dólares Efectivo', usdt: 'USDT', btc: 'Bitcoin' };
    
    document.getElementById('modal-title').innerText = `Actualizar ${names[type]}`;
    document.getElementById('modal-currency').innerText = type.toUpperCase();
    input.value = ahorrosLiquidos[type] || 0;
    
    modal.classList.remove('hidden');
    input.focus();
}

function closeEditModal() {
    document.getElementById('modal-saldo').classList.add('hidden');
}

async function saveNewBalance() {
    const val = parseFloat(document.getElementById('input-saldo').value) || 0;
    ahorrosLiquidos[currentEditType] = val;

    await fetch('/api/ahorros', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(ahorrosLiquidos)
    });

    closeEditModal();
    loadData();
}

/**
 * 4. BUSCADOR Y REGISTRO DE INVERSIONES
 */
function filterP() {
    const v = document.getElementById('sk').value.toUpperCase();
    const b = document.getElementById('predictive');
    if(v.length < 1) { b.classList.add('hidden'); return; }
    
    const f = db.filter(x => x.t.includes(v) || x.n.toUpperCase().includes(v));
    b.innerHTML = f.map(x => `
        <div class="p-4 border-b border-gray-800 text-sm hover:bg-gray-800 cursor-pointer flex justify-between items-center" onclick="sel('${x.t}','${x.m}')">
            <span class="font-bold">${x.t}</span> 
            <span class="text-[10px] text-gray-500 uppercase">${x.n}</span>
        </div>`).join('');
    b.classList.toggle('hidden', f.length === 0);
}

function sel(t, m) { 
    document.getElementById('sk').value = t; 
    document.getElementById('tk').value = m; 
    document.getElementById('predictive').classList.add('hidden'); 
}

async function addA() {
    const body = { 
        ticker: document.getElementById('sk').value.toUpperCase(), 
        cantidad: parseFloat(document.getElementById('ck').value), 
        precio_compra: parseFloat(document.getElementById('pk').value.replace(',','.')), 
        tipo: document.getElementById('tk').value 
    };
    if(!body.ticker || isNaN(body.cantidad)) return alert("Revisa los datos");
    
    await fetch('/api/agregar', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body) });
    ['sk', 'ck', 'pk'].forEach(id => document.getElementById(id).value = '');
    loadData();
}

async function delA(index) { 
    if(confirm("¿Eliminar este activo?")) {
        await fetch('/api/eliminar', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ index }) }); 
        loadData(); 
    }
}

/**
 * 5. ANÁLISIS Y GRÁFICOS
 */
function toggleAnalysis() {
    const m = document.getElementById('modal');
    m.classList.toggle('hidden');
    if(!m.classList.contains('hidden')) renderCharts();
}

function renderCharts() {
    const bcv = marketData.mercado.bcv.usd;
    
    // Calcular Inversiones vs Liquidez
    let invUSD = marketData.portafolio.reduce((s, a) => {
        const p = marketData.mercado.bvc.precios[a.ticker] || a.precio_compra;
        return s + (a.tipo === 'acciones_bvc' ? (a.cantidad * p / bcv) : (a.cantidad * p));
    }, 0);

    let cashUSD = ahorrosLiquidos.usd + ahorrosLiquidos.usdt + (ahorrosLiquidos.ves / bcv) + (ahorrosLiquidos.btc * 65000);

    if(pieC) pieC.destroy();
    if(lineC) lineC.destroy();

    // Gráfico de Torta
    pieC = new Chart(document.getElementById('chartPie'), {
        type: 'doughnut',
        data: {
            labels: ['Inversiones', 'Liquidez'],
            datasets: [{
                data: [invUSD.toFixed(2), cashUSD.toFixed(2)],
                backgroundColor: ['#F3BA2F', '#3B82F6'],
                borderWidth: 0
            }]
        },
        options: { maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { color: '#848E9C' } } } }
    });

    // Gráfico de Línea
    const historial = marketData.historial || [];
    lineC = new Chart(document.getElementById('chartLine'), {
        type: 'line',
        data: {
            labels: historial.map(h => h.fecha),
            datasets: [{
                label: 'Total USD',
                data: historial.map(h => h.saldo),
                borderColor: '#F3BA2F',
                tension: 0.4,
                fill: true,
                backgroundColor: 'rgba(243, 186, 47, 0.1)'
            }]
        },
        options: { maintainAspectRatio: false, scales: { x: { display: false }, y: { ticks: { color: '#848E9C' } } } }
    });
}

// Inicialización
loadData();
setInterval(loadData, 60000);