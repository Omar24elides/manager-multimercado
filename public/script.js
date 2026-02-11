/**
 * FINANCE PRO - SISTEMA INTEGRADO TOTAL
 * Conectividad: Frontend -> Node.js (3000) -> Python (5000)
 */

// --- 1. CONFIGURACIÓN E INICIALIZACIÓN DE FIREBASE ---
const firebaseConfig = {
    apiKey: "AIzaSyCVOCPHBlp98pJdqxHM4Py-chI521B5Qjo",
    authDomain: "finance-pro-cloud.firebaseapp.com",
    projectId: "finance-pro-cloud",
    storageBucket: "finance-pro-cloud.firebasestorage.app",
    messagingSenderId: "173590650190",
    appId: "1:173590650190:web:22aa2a5a7fd3679921521f"
};

// Inicialización inmediata para evitar errores de "No Firebase App created"
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

// --- 2. ESTADO DE LA APLICACIÓN ---
const MI_CORREO = "elidesomar@gmail.com";
let isAppUnlocked = false;
let marketData = { 
    mercado: { bcv: { usd: 0 }, binance: { usdt_ves: 0 }, bvc: { precios: {} } }, 
    portafolio: [],
    historial: []
};
let ahorrosLiquidos = { ves: 0, usd: 0, usdt: 0, btc: 0 };
let currentEditType = '';
let calcMode = 'ves-usd';
let timeoutBusqueda;

// --- 3. SEGURIDAD Y AUTENTICACIÓN (GLOBALES PARA HTML) ---

firebase.auth().onAuthStateChanged(async (user) => {
    const authScreen = document.getElementById('auth-container');
    const lockScreen = document.getElementById('lock-screen');
    const mainContent = document.getElementById('app-main-content');

    if (user && user.email === MI_CORREO) {
        if(authScreen) authScreen.classList.add('hidden');
        await loadData();
        if (!isAppUnlocked && lockScreen) {
            lockScreen.classList.remove('hidden');
        }
    } else {
        if(authScreen) authScreen.classList.remove('hidden');
        if(mainContent) mainContent.classList.add('hidden');
        if (user) {
            console.warn("Usuario no autorizado");
            firebase.auth().signOut();
        }
    }
});

window.loginConGoogle = function() {
    const provider = new firebase.auth.GoogleAuthProvider();
    firebase.auth().signInWithPopup(provider)
        .catch(err => alert("Error en Login: " + err.message));
};

window.unlockWithBiometrics = async function() {
    try {
        // Desafío básico para WebAuthn (Biometría)
        const challenge = new Uint8Array(32);
        window.crypto.getRandomValues(challenge);
        const credential = await navigator.credentials.get({
            publicKey: { challenge, userVerification: "required", timeout: 60000 }
        });
        
        if (credential) {
            ejecutarDesbloqueoVisual();
        }
    } catch (e) {
        console.warn("Biometría fallida, usando bypass de desarrollo", e);
        // Descomenta la línea de abajo para probar en PC sin huella:
        // ejecutarDesbloqueoVisual();
    }
};

function ejecutarDesbloqueoVisual() {
    isAppUnlocked = true;
    const lockScreen = document.getElementById('lock-screen');
    const mainContent = document.getElementById('app-main-content');
    
    if (lockScreen) lockScreen.classList.add('fade-out');
    setTimeout(() => {
        if (lockScreen) lockScreen.classList.add('hidden');
        if (mainContent) {
            mainContent.classList.remove('hidden');
            mainContent.classList.add('fade-in');
        }
        actualizarUI();
    }, 400);
}

// --- 4. CORE DE DATOS ---

async function loadData() {
    try {
        const [dashRes, ahorrosRes] = await Promise.all([
            fetch('/api/dashboard'),
            fetch('/api/ahorros')
        ]);
        
        const dashData = await dashRes.json();
        marketData.mercado = dashData.mercado;
        marketData.portafolio = dashData.portafolio || [];
        marketData.historial = dashData.historial || [];
        ahorrosLiquidos = await ahorrosRes.json();

        actualizarUI();
    } catch (e) {
        console.error("Error sincronizando con el servidor:", e);
    }
}

function actualizarUI() {
    const bcv = marketData.mercado.bcv.usd || 1;
    const btcPrice = marketData.mercado.crypto?.btc || 95000;

    // Tasas superiores
    const bcvEl = document.getElementById('bcv-p');
    const usdtEl = document.getElementById('usdt-p');
    if(bcvEl) bcvEl.innerText = bcv.toFixed(2);
    if(usdtEl) usdtEl.innerText = (marketData.mercado.binance.usdt_ves || 0).toFixed(2);

    // Render de Portafolio
    const list = document.getElementById('assets-list');
    if(list) {
        list.innerHTML = '';
        let totalInvUSD = 0;

        marketData.portafolio.forEach((a, i) => {
            const pActual = marketData.mercado.bvc.precios[a.ticker] || a.precio_compra;
            const subtotal = a.cantidad * pActual;
            const subUSD = (a.tipo === 'acciones_bvc') ? subtotal / bcv : subtotal;
            totalInvUSD += subUSD;

            const ganancia = ((pActual - a.precio_compra) / a.precio_compra * 100).toFixed(2);
            const colorGanancia = ganancia >= 0 ? 'text-green-400' : 'text-red-400';

            list.innerHTML += `
                <div class="bg-[#1E2329] p-4 rounded-[24px] flex justify-between items-center mb-3 border border-gray-800/50 asset-card">
                    <div class="flex items-center gap-3">
                        <div class="w-10 h-10 bg-[#0B0E11] rounded-full flex items-center justify-center text-[#F3BA2F] font-bold">${a.ticker.substring(0,2)}</div>
                        <div>
                            <p class="font-black text-sm uppercase text-white">${a.ticker}</p>
                            <p class="text-[10px] text-gray-500">${a.cantidad.toFixed(2)} units</p>
                        </div>
                    </div>
                    <div class="text-right">
                        <p class="font-bold text-white">$${subUSD.toFixed(2)}</p>
                        <p class="text-[10px] ${colorGanancia}">${ganancia}%</p>
                    </div>
                    <button onclick="deleteAsset(${i})" class="ml-4 text-gray-600 hover:text-red-500 transition-colors">
                        <i class="fa-solid fa-trash-can"></i>
                    </button>
                </div>`;
        });

        // Totales de Patrimonio
        const totalAhorrosUSD = (ahorrosLiquidos.usd) + (ahorrosLiquidos.ves / bcv) + (ahorrosLiquidos.usdt) + (ahorrosLiquidos.btc * btcPrice);
        const patrimonioTotal = totalAhorrosUSD + totalInvUSD;

        document.getElementById('total-usd').innerText = `$${patrimonioTotal.toLocaleString('en-US', {minimumFractionDigits: 2})}`;
        document.getElementById('total-ves').innerText = `≈ Bs. ${(patrimonioTotal * bcv).toLocaleString('es-VE')}`;
        
        // Tarjetas de ahorro
        document.getElementById('save-ves').innerText = ahorrosLiquidos.ves.toLocaleString('es-VE');
        document.getElementById('save-cash').innerText = ahorrosLiquidos.usd.toLocaleString('en-US');
        document.getElementById('save-usdt').innerText = ahorrosLiquidos.usdt.toLocaleString('en-US');
        document.getElementById('save-btc').innerText = ahorrosLiquidos.btc.toFixed(6);

        renderMainChart(ahorrosLiquidos.usd, (ahorrosLiquidos.ves / bcv), (ahorrosLiquidos.usdt + (ahorrosLiquidos.btc * btcPrice)), totalInvUSD);
    }
}

// --- 5. BÚSQUEDA PREDICTIVA ---

window.filterP = async function() {
    const query = document.getElementById('sk').value;
    const box = document.getElementById('predictive');
    if (!query || query.length < 2) { box?.classList.add('hidden'); return; }

    clearTimeout(timeoutBusqueda);
    timeoutBusqueda = setTimeout(async () => {
        try {
            const res = await fetch(`/api/buscar-global-lista/${query}`);
            const results = await res.json();
            if(box) {
                box.innerHTML = '';
                results.forEach(item => {
                    const d = document.createElement('div');
                    d.className = "p-4 border-b border-gray-700 hover:bg-[#F3BA2F] hover:text-black cursor-pointer text-xs font-bold transition-all";
                    d.innerHTML = `<span class="text-[#F3BA2F] group-hover:text-black">${item.symbol}</span> | ${item.name}`;
                    d.onclick = () => selectTicker(item.symbol);
                    box.appendChild(d);
                });
                box.classList.remove('hidden');
            }
        } catch (e) { console.error("Error buscando ticker"); }
    }, 350);
};

async function selectTicker(ticker) {
    document.getElementById('sk').value = ticker;
    document.getElementById('predictive').classList.add('hidden');
    
    try {
        // Ahora esta ruta ya existe en el servidor Node
        const res = await fetch(`/api/get_price/${ticker}`);
        const data = await res.json();
        if (data.price) {
            document.getElementById('pk').value = data.price.toFixed(2);
        }
    } catch (e) {
        console.error("No se pudo obtener el precio del servidor");
    }
}

// --- 6. OPERACIONES CRUD ---

window.addA = async function() {
    const btn = event.currentTarget;
    btn.disabled = true;
    
    const asset = {
        ticker: document.getElementById('sk').value.toUpperCase(),
        cantidad: parseFloat(document.getElementById('ck').value),
        precio_compra: parseFloat(document.getElementById('pk').value),
        tipo: document.getElementById('tk').value
    };

    if (!asset.ticker || isNaN(asset.cantidad)) {
        alert("Completa los datos correctamente");
        btn.disabled = false;
        return;
    }

    try {
        await fetch('/api/agregar', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(asset)
        });
        
        document.getElementById('sk').value = '';
        document.getElementById('ck').value = '';
        document.getElementById('pk').value = '';
        await loadData();
    } catch (e) { console.error("Error al agregar"); }
    btn.disabled = false;
};

window.deleteAsset = async function(index) {
    if (confirm("¿Eliminar este activo?")) {
        await fetch('/api/eliminar', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ index })
        });
        loadData();
    }
};

// --- 7. MODALES DE AHORRO ---

window.openEditModal = function(type) {
    currentEditType = type;
    const labels = { ves: 'Bolívares', usd: 'Dólares Cash', usdt: 'USDT', btc: 'Bitcoin' };
    document.getElementById('modal-currency').innerText = labels[type];
    document.getElementById('input-saldo').value = ahorrosLiquidos[type];
    document.getElementById('modal-saldo').classList.remove('hidden');
};

window.closeEditModal = function() {
    document.getElementById('modal-saldo').classList.add('hidden');
};

window.saveNewBalance = async function() {
    const val = parseFloat(document.getElementById('input-saldo').value) || 0;
    ahorrosLiquidos[currentEditType] = val;

    await fetch('/api/ahorros', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(ahorrosLiquidos)
    });
    closeEditModal();
    loadData();
};

// --- 8. CALCULADORA Y UTILIDADES ---

window.setCalcMode = function(mode) {
    calcMode = mode;
    const label = document.getElementById('calc-label');
    const buttons = {
        'ves-usd': document.getElementById('btn-ves-usd'),
        'usd-ves': document.getElementById('btn-usd-ves'),
        'paralelo-ves': document.getElementById('btn-par-ves')
    };

    // Resetear todos los botones a gris
    Object.values(buttons).forEach(btn => {
        if(btn) {
            btn.classList.remove('bg-[#F3BA2F]', 'text-black');
            btn.classList.add('text-gray-500');
        }
    });

    // Activar el seleccionado
    if(buttons[mode]) {
        buttons[mode].classList.add('bg-[#F3BA2F]', 'text-black');
        buttons[mode].classList.remove('text-gray-500');
    }

    // Cambiar label visual
    if(label) {
        label.innerText = mode === 'ves-usd' ? "VES" : "USD";
    }

    calcularTodo();
};

window.calcularTodo = function() {
    const monto = parseFloat(document.getElementById('calc-input').value) || 0;
    const tasaBcv = parseFloat(document.getElementById('bcv-p').innerText.replace(/[^\d.]/g, '')) || 1;
    const tasaP2p = parseFloat(document.getElementById('usdt-p').innerText.replace(/[^\d.]/g, '')) || 1;
    const tasaParalelo = parseFloat(document.getElementById('tasa-paralelo').value) || 1;

    const resBcv = document.getElementById('res-bcv');
    const resUsdt = document.getElementById('res-usdt');
    const resPar = document.getElementById('res-paralelo');

    if (calcMode === 'ves-usd') {
        resBcv.innerText = "$" + (monto / tasaBcv).toFixed(2);
        resUsdt.innerText = "$" + (monto / tasaP2p).toFixed(2);
        resPar.innerText = "$" + (monto / tasaParalelo).toFixed(2);
    } else {
        // En los otros dos modos (USD a VES o Paralelo a VES) multiplicamos
        // Si el modo es Paralelo-VES, usamos la tasa del input de arriba
        const tasaFinal = (calcMode === 'paralelo-ves') ? tasaParalelo : tasaBcv;
        
        resBcv.innerText = "Bs " + (monto * tasaBcv).toLocaleString('es-VE');
        resUsdt.innerText = "Bs " + (monto * tasaP2p).toLocaleString('es-VE');
        resPar.innerText = "Bs " + (monto * tasaParalelo).toLocaleString('es-VE');
    }
};

window.enviarTelegram = async function(btn) {
    const icon = btn.querySelector('i');
    const text = btn.querySelector('span');
    
    // Feedback visual
    icon.className = "fa-solid fa-spinner fa-spin text-blue-400";
    
    try {
        // Llamamos a una nueva ruta en tu servidor Node que ejecute el Python
        const response = await fetch('/api/telegram-report', { method: 'POST' });
        
        if (response.ok) {
            icon.className = "fa-solid fa-circle-check text-green-400";
            if(text) text.innerText = "Enviado";
        } else {
            throw new Error();
        }
    } catch (e) {
        icon.className = "fa-solid fa-circle-exclamation text-red-500";
        if(text) text.innerText = "Error";
    }

    setTimeout(() => {
        icon.className = "fa-solid fa-paper-plane text-xl";
        if(text) text.innerText = "Telegram";
    }, 3000);
};

// --- 9. GRÁFICOS Y NAVEGACIÓN ---

function renderMainChart(cash, ves, crypto, inv) {
    const ctx = document.getElementById('portfolioChart');
    if (!ctx) return;
    
    if (window.myChart) window.myChart.destroy();
    window.myChart = new Chart(ctx.getContext('2d'), {
        type: 'doughnut',
        data: {
            labels: ['Cash', 'VES', 'Crypto', 'Acciones'],
            datasets: [{
                data: [cash, ves, crypto, inv],
                backgroundColor: ['#F3BA2F', '#3B82F6', '#9452FF', '#FF5252'],
                borderWidth: 0,
                hoverOffset: 10
            }]
        },
        options: { cutout: '80%', plugins: { legend: { display: false } }, responsive: true, maintainAspectRatio: false }
    });
}

window.switchTab = function(tab) {
    const car = document.getElementById('view-cartera');
    const inv = document.getElementById('view-inversiones');
    const btnCar = document.getElementById('nav-btn-cartera');
    const btnInv = document.getElementById('nav-btn-inversiones');

    if(car) car.classList.toggle('hidden', tab !== 'cartera');
    if(inv) inv.classList.toggle('hidden', tab !== 'inversiones');
    
    if(btnCar) btnCar.classList.toggle('text-[#F3BA2F]', tab === 'cartera');
    if(btnInv) btnInv.classList.toggle('text-[#F3BA2F]', tab === 'inversiones');
};

/* --- AGREGAR ESTO AL FINAL DE TU SCRIPT.JS --- */

// Control de Modal de Calculadora
window.toggleCalcModal = function() {
    const modal = document.getElementById('modal-calc');
    if (modal) {
        modal.classList.toggle('hidden');
        if (!modal.classList.contains('hidden')) {
            calcularTodo(); // Recalcular al abrir
        }
    }
};

// Control de Modal de Análisis (Si lo tienes)
window.toggleAnalysis = function() {
    const modal = document.getElementById('modal-analysis'); // Asegúrate que este ID exista en tu HTML
    if (modal) {
        modal.classList.toggle('hidden');
    } else {
        alert("Función de análisis en desarrollo o ID no encontrado");
    }
};

// Cerrar modales al hacer click fuera del contenido
window.onclick = function(event) {
    const modales = ['modal-saldo', 'modal-calc', 'modal-analysis'];
    modales.forEach(id => {
        const m = document.getElementById(id);
        if (event.target == m) {
            m.classList.add('hidden');
        }
    });
};

// Inicialización final
document.addEventListener('DOMContentLoaded', () => {
    switchTab('cartera');
});