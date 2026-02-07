const express = require('express');
const axios = require('axios');
const fs = require('fs');
const cron = require('node-cron');
const { exec } = require('child_process');

const app = express();

// Configuración básica para leer JSON y servir la carpeta pública
app.use(express.json());
app.use(express.static('public'));

// Archivos de base de datos (JSON)
const PORTAFOLIO_FILE = './portafolio.json';
const HISTORIAL_FILE = './historial.json';
const AHORROS_FILE = './ahorros.json'; // Nuestra nueva DB de efectivo

// --- RUTAS DE LA API ---

// 1. Agregar activo (Inversiones)
app.post('/api/agregar', (req, res) => {
    const { ticker, cantidad, precio_compra, tipo } = req.body;
    let data = { activos: [] };
    
    if (fs.existsSync(PORTAFOLIO_FILE)) {
        data = JSON.parse(fs.readFileSync(PORTAFOLIO_FILE));
    }

    const index = data.activos.findIndex(a => a.ticker === ticker);

    // Si ya tienes la acción, promediamos el precio de compra
    if (index !== -1) {
        let a = data.activos[index];
        const nuevaCant = a.cantidad + cantidad;
        const nuevoCosto = ((a.cantidad * a.precio_compra) + (cantidad * precio_compra)) / nuevaCant;
        data.activos[index].cantidad = nuevaCant;
        data.activos[index].precio_compra = nuevoCosto;
    } else {
        data.activos.push({ ticker, cantidad, precio_compra, tipo });
    }

    fs.writeFileSync(PORTAFOLIO_FILE, JSON.stringify(data, null, 4));

    // Notificación automática vía Telegram
    exec('python3 telegram_bot.py', (error) => {
        if (error) console.error(`Error bot: ${error.message}`);
        else console.log("🔔 Notificación de compra enviada");
    });

    res.json({ success: true });
});

// 2. Eliminar activo
app.post('/api/eliminar', (req, res) => {
    const { index } = req.body;
    if (!fs.existsSync(PORTAFOLIO_FILE)) return res.status(404).send();

    let data = JSON.parse(fs.readFileSync(PORTAFOLIO_FILE));
    const eliminado = data.activos[index]?.ticker || "Desconocido";
    
    data.activos.splice(index, 1);
    fs.writeFileSync(PORTAFOLIO_FILE, JSON.stringify(data, null, 4));

    exec('python3 telegram_bot.py', (error) => {
        if (!error) console.log(`🗑️ Notificación de venta (${eliminado}) enviada`);
    });

    res.json({ success: true });
});

// 3. Obtener Dashboard (Precios de mercado + Portafolio + Historial)
app.get('/api/dashboard', async (req, res) => {
    try {
        // Obtenemos precios de la BVC y Dólar desde tu script de Python
        const response = await axios.get('http://localhost:5000/all');
        const mercado = response.data;
        
        let portafolio = fs.existsSync(PORTAFOLIO_FILE) ? JSON.parse(fs.readFileSync(PORTAFOLIO_FILE)).activos : [];
        let historial = fs.existsSync(HISTORIAL_FILE) ? JSON.parse(fs.readFileSync(HISTORIAL_FILE)) : [];
        
        res.json({ mercado, portafolio, historial });
    } catch (e) {
        res.status(500).json({ error: "API Python (scraping) no responde" });
    }
});

// 4. Gestión de Ahorros (La nueva billetera de efectivo)
app.get('/api/ahorros', (req, res) => {
    let data = { usd: 0, ves: 0, usdt: 0, btc: 0 };
    if (fs.existsSync(AHORROS_FILE)) {
        data = JSON.parse(fs.readFileSync(AHORROS_FILE));
    }
    res.json(data);
});

app.post('/api/ahorros', (req, res) => {
    // Aquí guardamos lo que mandamos desde el modal de la interfaz
    fs.writeFileSync(AHORROS_FILE, JSON.stringify(req.body, null, 4));
    res.json({ success: true });
});

// --- TAREAS AUTOMÁTICAS (CRON) ---

// Reporte de cierre diario (Cada noche a las 23:59)
cron.schedule('59 23 * * *', async () => {
    try {
        const res = await axios.get('http://localhost:5000/all');
        const mercado = res.data;
        
        // 1. Sumar valor de Acciones
        let dataInv = fs.existsSync(PORTAFOLIO_FILE) ? JSON.parse(fs.readFileSync(PORTAFOLIO_FILE)) : { activos: [] };
        let totalUSD = 0;

        dataInv.activos.forEach(a => {
            const precio = mercado.bvc.precios[a.ticker] || a.precio_compra;
            let val = a.cantidad * precio;
            totalUSD += (a.tipo === 'acciones_bvc') ? val / mercado.bcv.usd : val;
        });

        // 2. Sumar valor de Ahorros Líquidos (¡Importante para un gráfico real!)
        if (fs.existsSync(AHORROS_FILE)) {
            const ahorros = JSON.parse(fs.readFileSync(AHORROS_FILE));
            totalUSD += ahorros.usd;                              // Dólares cash
            totalUSD += ahorros.usdt;                             // USDT
            totalUSD += (ahorros.ves / mercado.bcv.usd);          // Bolívares pasados a $
            totalUSD += (ahorros.btc * 45000);                    // Bitcoin (valor ref.)
        }

        // 3. Guardar en el historial
        let hist = fs.existsSync(HISTORIAL_FILE) ? JSON.parse(fs.readFileSync(HISTORIAL_FILE)) : [];
        hist.push({ 
            fecha: new Date().toLocaleDateString('es-VE'), 
            saldo: parseFloat(totalUSD.toFixed(2)) 
        });
        
        fs.writeFileSync(HISTORIAL_FILE, JSON.stringify(hist, null, 4));
        console.log(`✅ Historial diario guardado: $${totalUSD.toFixed(2)}`);

    } catch (e) { 
        console.log("❌ Error en la tarea programada:", e.message); 
    }
});

// Arrancamos el servidor
app.listen(3000, '0.0.0.0', () => {
    console.log("🚀 Servidor corriendo en http://localhost:3000");
    console.log("📂 Archivos de datos listos para operar.");
});