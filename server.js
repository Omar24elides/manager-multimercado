const express = require('express');
const axios = require('axios');
const fs = require('fs');
const cron = require('node-cron');
const { exec } = require('child_process');
const path = require('path');

const app = express();

app.use(express.json());
app.use(express.static('public'));

const PORTAFOLIO_FILE = './portafolio.json';
const HISTORIAL_FILE = './historial.json';
const AHORROS_FILE = './ahorros.json';

// --- FUNCIONES DE APOYO ---

function actualizarHistorialLocal(totalUSD) {
    let historial = fs.existsSync(HISTORIAL_FILE) ? JSON.parse(fs.readFileSync(HISTORIAL_FILE)) : [];
    const hoy = new Date().toLocaleDateString('es-VE');
    const entry = { fecha: hoy, valor: parseFloat(totalUSD.toFixed(2)) };
    
    const idx = historial.findIndex(h => h.fecha === hoy);
    if (idx > -1) historial[idx].valor = entry.valor;
    else historial.push(entry);

    if (historial.length > 30) historial.shift();
    fs.writeFileSync(HISTORIAL_FILE, JSON.stringify(historial, null, 4));
}

function ejecutarBot() {
    // Usamos la ruta absoluta para evitar errores de ubicación
    const botPath = path.join(__dirname, 'telegram_bot.py');
    exec(`python3 "${botPath}"`, (error, stdout, stderr) => {
        if (error) console.error(`❌ Error Bot: ${error.message}`);
        if (stderr) console.error(`⚠️ Stderr Bot: ${stderr}`);
        if (stdout) console.log(`🤖 Bot dice: ${stdout}`);
    });
}

// --- RUTAS API ---

app.get('/api/dashboard', async (req, res) => {
    try {
        const response = await axios.get('http://localhost:5000/all');
        const mercado = response.data;
        let portafolio = fs.existsSync(PORTAFOLIO_FILE) ? JSON.parse(fs.readFileSync(PORTAFOLIO_FILE)).activos : [];
        let historial = fs.existsSync(HISTORIAL_FILE) ? JSON.parse(fs.readFileSync(HISTORIAL_FILE)) : [];
        res.json({ mercado, portafolio, historial });
    } catch (e) {
        res.status(500).json({ error: "API Python no responde" });
    }
});

app.post('/api/agregar', (req, res) => {
    const { ticker, cantidad, precio_compra, tipo } = req.body;
    if (cantidad < 0 || precio_compra < 0) return res.status(400).json({ error: "No negativos" });

    let data = fs.existsSync(PORTAFOLIO_FILE) ? JSON.parse(fs.readFileSync(PORTAFOLIO_FILE)) : { activos: [] };
    const index = data.activos.findIndex(a => a.ticker === ticker);

    if (index !== -1) {
        let a = data.activos[index];
        const nuevaCant = a.cantidad + cantidad;
        data.activos[index].precio_compra = ((a.cantidad * a.precio_compra) + (cantidad * precio_compra)) / nuevaCant;
        data.activos[index].cantidad = nuevaCant;
    } else {
        data.activos.push({ ticker, cantidad, precio_compra, tipo });
    }

    fs.writeFileSync(PORTAFOLIO_FILE, JSON.stringify(data, null, 4));
    ejecutarBot();
    res.json({ success: true });
});

app.get('/api/ahorros', (req, res) => {
    let data = fs.existsSync(AHORROS_FILE) ? JSON.parse(fs.readFileSync(AHORROS_FILE)) : { usd: 0, ves: 0, usdt: 0, btc: 0 };
    res.json(data);
});

app.post('/api/ahorros', (req, res) => {
    fs.writeFileSync(AHORROS_FILE, JSON.stringify(req.body, null, 4));
    ejecutarBot(); // Notifica al actualizar saldo
    res.json({ success: true });
});

app.get('/api/historial', (req, res) => {
    let datos = fs.existsSync(HISTORIAL_FILE) ? JSON.parse(fs.readFileSync(HISTORIAL_FILE)) : [];
    res.json(datos);
});

app.post('/api/notificar-telegram', (req, res) => {
    const { exec } = require('child_process');
    const path = require('path');
    
    // Usamos la ruta absoluta para que Node no se pierda
    const scriptPath = path.join(__dirname, 'telegram_bot.py');
    
    console.log(`Buscando script en: ${scriptPath}`);

    exec(`python3 "${scriptPath}"`, (error, stdout, stderr) => {
        if (error) {
            console.error("❌ ERROR CRÍTICO:", error.message);
            return res.status(500).json({ 
                success: false, 
                error: "Error de ejecución", 
                detalle: error.message 
            });
        }
        
        if (stderr) {
            console.warn("⚠️ ADVERTENCIA:", stderr);
        }

        console.log("🤖 SALIDA DEL BOT:", stdout);
        res.json({ success: true, message: "Enviado" });
    });
});

// --- CRON DIARIO ---
cron.schedule('59 23 * * *', async () => {
    try {
        const response = await axios.get('http://localhost:5000/all');
        const m = response.data;
        let total = 0;

        if (fs.existsSync(PORTAFOLIO_FILE)) {
            JSON.parse(fs.readFileSync(PORTAFOLIO_FILE)).activos.forEach(a => {
                let p = m.bvc.precios[a.ticker] || a.precio_compra;
                total += (a.tipo === 'acciones_bvc') ? (a.cantidad * p) / m.bcv.usd : (a.cantidad * p);
            });
        }
        if (fs.existsSync(AHORROS_FILE)) {
            const ah = JSON.parse(fs.readFileSync(AHORROS_FILE));
            total += ah.usd + ah.usdt + (ah.ves / m.bcv.usd) + (ah.btc * (m.crypto?.btc || 65000));
        }
        actualizarHistorialLocal(total);
        ejecutarBot();
    } catch (e) { console.error("Error Cron:", e.message); }
});
app.get('/api/buscar-global-lista/:query', async (req, res) => {
    try {
        const response = await axios.get(`http://localhost:5000/api/search_global/${req.params.query}`);
        res.json(response.data);
    } catch (e) {
        res.json([]);
    }
});

// --- ESTO DEBE IR ANTES DE APP.LISTEN ---

app.post('/api/notificar-telegram', (req, res) => {
    console.log("🔔 El botón fue presionado. Ejecutando script de Python...");
    
    const { exec } = require('child_process');
    const path = require('path');
    const scriptPath = path.join(__dirname, 'telegram_bot.py');

    exec(`python3 "${scriptPath}"`, (error, stdout, stderr) => {
        if (error) {
            console.error(`❌ Error al ejecutar: ${error.message}`);
            return res.status(500).json({ success: false, error: error.message });
        }
        console.log(`✅ Bot ejecutado: ${stdout}`);
        res.json({ success: true });
    });
});

// --- EL APP.LISTEN SIEMPRE DEBE SER LO ÚLTIMO ---
app.listen(3000, '0.0.0.0', () => {
    console.log("🚀 Servidor corriendo en puerto 3000");
});
