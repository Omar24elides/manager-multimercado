const express = require('express');
const axios = require('axios');
const fs = require('fs').promises; // Usamos la versión PROMISE para no bloquear el servidor
const { exec } = require('child_process');
const path = require('path');
const cron = require('node-cron');

const app = express();

// --- CONFIGURACIÓN DE RUTAS ---
const FILES = {
    portfolio: path.join(__dirname, 'portafolio.json'),
    history: path.join(__dirname, 'historial.json'),
    savings: path.join(__dirname, 'ahorros.json')
};

app.use(express.json());
app.use(express.static('public'));

// --- UTILIDADES ---

// Ruta para disparar el reporte
app.post('/api/telegram-report', (req, res) => {
    console.log("Iniciando envío de reporte vía telegram_bot.py...");

    // CAMBIO AQUÍ: Usamos el nombre exacto de tu archivo
    exec('python3 telegram_bot.py', (error, stdout, stderr) => {
        if (error) {
            console.error(`Error de ejecución: ${error.message}`);
            return res.status(500).json({ success: false, error: error.message });
        }
        
        console.log("Reporte enviado con éxito.");
        res.json({ success: true });
    });
});

// --- API ENDPOINTS ---

// Dashboard unificado
app.get('/api/dashboard', async (req, res) => {
    try {
        const [mercado, portafolio, historial] = await Promise.all([
            axios.get('http://localhost:5000/all').then(r => r.data),
            fs.readFile(FILES.portfolio, 'utf8').then(JSON.parse).catch(() => ({ activos: [] })),
            fs.readFile(FILES.history, 'utf8').then(JSON.parse).catch(() => [])
        ]);
        res.json({ mercado, portafolio: portafolio.activos, historial });
    } catch (e) {
        res.status(500).json({ error: "Servicio de datos no disponible" });
    }
});

// Ahorros con persistencia limpia
app.route('/api/ahorros')
    .get(async (req, res) => {
        const data = await fs.readFile(FILES.savings, 'utf8').then(JSON.parse).catch(() => ({ usd: 0, ves: 0, usdt: 0, btc: 0 }));
        res.json(data);
    })
    .post(async (req, res) => {
        await fs.writeFile(FILES.savings, JSON.stringify(req.body, null, 4));
        runBot();
        res.json({ success: true });
    });

// Eliminar activo por ID/Index
app.post('/api/eliminar', async (req, res) => {
    try {
        const { index } = req.body;
        const data = await fs.readFile(FILES.portfolio, 'utf8').then(JSON.parse);
        data.activos.splice(index, 1);
        await fs.writeFile(FILES.portfolio, JSON.stringify(data, null, 4));
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// Proxy para búsqueda Yahoo (evita problemas de CORS en el front)
app.get('/api/buscar-global-lista/:query', async (req, res) => {
    try {
        const r = await axios.get(`http://localhost:5000/api/search_global/${req.params.query}`);
        res.json(r.data);
    } catch (e) { res.json([]); }
});
// RUTA 1: Obtener precio en tiempo real (Yahoo Finance vía Python)
app.get('/api/get_price/:ticker', async (req, res) => {
    try {
        const ticker = req.params.ticker;
        // Llamamos al servicio de Python (puerto 5000)
        const response = await fetch(`http://localhost:5000/api/buscar-global/${ticker}`);
        const data = await response.json();
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: "Error conectando con el motor de precios" });
    }
});

// RUTA 2: Agregar activo al portafolio
app.post('/api/agregar', async (req, res) => {
    try {
        const nuevoActivo = req.body;
        // Aquí deberías guardar en tu DB o enviarlo a Python para procesar
        const response = await fetch('http://localhost:5000/api/portafolio/agregar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(nuevoActivo)
        });
        const resultado = await response.json();
        res.json(resultado);
    } catch (error) {
        res.status(500).json({ error: "Error al guardar el activo" });
    }
});

app.post('/api/notificar-telegram', (req, res) => {
    runBot();
    res.json({ success: true });
});

// Puerto dinámico para hosting
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server Ready on port ${PORT}`);
});