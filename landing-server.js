// =============================================================================
// NOTARYPRO LANDING PAGE SERVER
// =============================================================================

const express = require('express');
const path = require('path');
const cors = require('cors');
const { testConnection } = require('./database-config');
const fs = require('fs'); // Added missing import for fs

const app = express();
const PORT = process.env.LANDING_PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('.')); // Servir archivos estáticos desde el directorio actual

// Configurar CORS
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    next();
});

// Ruta principal - Landing Page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'landing-page.html'));
});

// Ruta para verificar estado del servidor
app.get('/status', async (req, res) => {
    try {
        const dbStatus = await testConnection();
        res.json({
            status: 'running',
            timestamp: new Date().toISOString(),
            database: dbStatus ? 'connected' : 'disconnected',
            uptime: process.uptime(),
            memory: process.memoryUsage(),
            version: process.version
        });
    } catch (error) {
        res.status(500).json({
            status: 'error',
            message: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// Ruta para verificar conectividad con la API principal
app.get('/api-status', async (req, res) => {
    try {
        const apiUrl = process.env.API_BASE_URL || 'http://localhost:3000';
        const response = await fetch(`${apiUrl}/api/v1/health`);
        
        if (response.ok) {
            const data = await response.json();
            res.json({
                status: 'connected',
                api_url: apiUrl,
                api_status: data,
                timestamp: new Date().toISOString()
            });
        } else {
            res.json({
                status: 'error',
                api_url: apiUrl,
                message: 'API responded with error',
                status_code: response.status,
                timestamp: new Date().toISOString()
            });
        }
    } catch (error) {
        res.json({
            status: 'disconnected',
            api_url: process.env.API_BASE_URL || 'http://localhost:3000',
            message: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// Ruta para servir archivos HTML específicos
app.get('/:page.html', (req, res) => {
    const page = req.params.page;
    const filePath = path.join(__dirname, `${page}.html`);
    
    if (fs.existsSync(filePath)) {
        res.sendFile(filePath);
    } else {
        res.status(404).sendFile(path.join(__dirname, 'landing-page.html'));
    }
});

// Middleware de manejo de errores
app.use((err, req, res, next) => {
    console.error('Error en el servidor:', err);
    res.status(500).json({
        error: 'Error interno del servidor',
        message: err.message,
        timestamp: new Date().toISOString()
    });
});

// Middleware para rutas no encontradas
app.use((req, res) => {
    res.status(404).sendFile(path.join(__dirname, 'landing-page.html'));
});

// Función para iniciar el servidor
async function startServer() {
    try {
        // Verificar conexión a la base de datos
        console.log('🔍 Verificando conexión a la base de datos...');
        const dbConnected = await testConnection();
        
        if (dbConnected) {
            console.log('✅ Base de datos conectada correctamente');
        } else {
            console.log('⚠️ No se pudo conectar a la base de datos');
        }
        
        // Iniciar servidor
        app.listen(PORT, () => {
            console.log('🚀 Servidor de Landing Page iniciado');
            console.log(`📍 URL: http://localhost:${PORT}`);
            console.log(`🌐 Landing Page: http://localhost:${PORT}/landing-page.html`);
            console.log(`📊 Estado: http://localhost:${PORT}/status`);
            console.log(`🔗 API Status: http://localhost:${PORT}/api-status`);
            console.log('');
            console.log('📋 Archivos disponibles:');
            console.log(`   - Landing Page: http://localhost:${PORT}/`);
            console.log(`   - Demo Panel: http://localhost:${PORT}/demo-panel.html`);
            console.log(`   - Demo Enhanced: http://localhost:${PORT}/demo-panel-enhanced.html`);
            console.log(`   - Demo Playground: http://localhost:${PORT}/demo-playground.html`);
            console.log(`   - SAAS Panel: http://localhost:${PORT}/saas-panel.html`);
            console.log('');
            console.log('💡 Presiona Ctrl+C para detener el servidor');
        });
        
    } catch (error) {
        console.error('❌ Error al iniciar el servidor:', error.message);
        process.exit(1);
    }
}

// Manejar señales de terminación
process.on('SIGINT', () => {
    console.log('\n🛑 Deteniendo servidor...');
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\n🛑 Deteniendo servidor...');
    process.exit(0);
});

// Iniciar servidor si se ejecuta directamente
if (require.main === module) {
    startServer();
}

module.exports = { app, startServer };
