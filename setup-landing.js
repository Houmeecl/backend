#!/usr/bin/env node

// =============================================================================
// NOTARYPRO LANDING PAGE SETUP SCRIPT
// =============================================================================

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🚀 Configurando NotaryPro Landing Page...\n');

// Colores para la consola
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
}

function logStep(step, message) {
    log(`\n${step} ${message}`, 'cyan');
}

function logSuccess(message) {
    log(`✅ ${message}`, 'green');
}

function logError(message) {
    log(`❌ ${message}`, 'red');
}

function logWarning(message) {
    log(`⚠️ ${message}`, 'yellow');
}

function logInfo(message) {
    log(`ℹ️ ${message}`, 'blue');
}

// Verificar dependencias
function checkDependencies() {
    logStep('1️⃣', 'Verificando dependencias...');
    
    const requiredPackages = ['pg', 'bcrypt'];
    const missingPackages = [];
    
    for (const pkg of requiredPackages) {
        try {
            require.resolve(pkg);
            logSuccess(`${pkg} está instalado`);
        } catch (error) {
            missingPackages.push(pkg);
            logWarning(`${pkg} no está instalado`);
        }
    }
    
    if (missingPackages.length > 0) {
        logInfo('Instalando dependencias faltantes...');
        try {
            execSync(`npm install ${missingPackages.join(' ')}`, { stdio: 'inherit' });
            logSuccess('Dependencias instaladas correctamente');
        } catch (error) {
            logError('Error al instalar dependencias');
            process.exit(1);
        }
    }
}

// Crear archivo .env si no existe
function createEnvFile() {
    logStep('2️⃣', 'Configurando variables de entorno...');
    
    const envPath = path.join(__dirname, '.env');
    const envExamplePath = path.join(__dirname, 'env.example');
    
    if (!fs.existsSync(envPath)) {
        if (fs.existsSync(envExamplePath)) {
            try {
                fs.copyFileSync(envExamplePath, envPath);
                logSuccess('Archivo .env creado desde env.example');
            } catch (error) {
                logError('Error al crear archivo .env');
            }
        } else {
            // Crear .env básico
            const envContent = `# ===========================================
# NOTARYPRO BACKEND - VARIABLES DE ENTORNO
# ===========================================

# CONFIGURACIÓN DE BASE DE DATOS
DB_USER=postgres
DB_HOST=localhost
DB_NAME=notarypro
DB_PASSWORD=your_secure_password_here
DB_PORT=5432

# CONFIGURACIÓN JWT
JWT_SECRET=your_super_secret_jwt_key_here_make_it_long_and_random

# CONFIGURACIÓN DE EMAIL (SMTP)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_password_here

# CONFIGURACIÓN DE LA API
API_BASE_URL=http://localhost:3000
NODE_ENV=development

# CONFIGURACIÓN DE ARCHIVOS
UPLOAD_DIR=./uploads
MAX_FILE_SIZE=52428800

# CONFIGURACIÓN DE SEGURIDAD
API_KEY=your_api_key_here

# CONFIGURACIÓN DE LOGS
LOG_LEVEL=info
LOG_FILE=logs/app.log

# CONFIGURACIÓN DE CORS
CORS_ORIGIN=http://localhost:3000,http://localhost:3001

# CONFIGURACIÓN DE SESIONES
SESSION_SECRET=your_session_secret_here
SESSION_COOKIE_MAX_AGE=86400000

# CONFIGURACIÓN DE BASE DE DATOS (ADVANCED)
DB_POOL_MIN=2
DB_POOL_MAX=10
DB_POOL_IDLE_TIMEOUT=30000
DB_POOL_ACQUIRE_TIMEOUT=60000

# CONFIGURACIÓN DE MONITOREO
ENABLE_HEALTH_CHECKS=true
HEALTH_CHECK_INTERVAL=30000
ENABLE_METRICS=true
METRICS_PORT=9090

# CONFIGURACIÓN DE DESARROLLO
DEBUG=false
ENABLE_SWAGGER=true
ENABLE_GRAPHIQL=false`;
            
            try {
                fs.writeFileSync(envPath, envContent);
                logSuccess('Archivo .env básico creado');
            } catch (error) {
                logError('Error al crear archivo .env básico');
            }
        }
    } else {
        logInfo('Archivo .env ya existe');
    }
}

// Verificar PostgreSQL
function checkPostgreSQL() {
    logStep('3️⃣', 'Verificando PostgreSQL...');
    
    try {
        const version = execSync('psql --version', { encoding: 'utf8' });
        logSuccess(`PostgreSQL detectado: ${version.trim()}`);
        
        // Verificar si el servicio está corriendo
        try {
            execSync('pg_isready', { stdio: 'pipe' });
            logSuccess('Servicio PostgreSQL está funcionando');
        } catch (error) {
            logWarning('Servicio PostgreSQL no está funcionando');
            logInfo('Inicia PostgreSQL con: sudo systemctl start postgresql');
        }
    } catch (error) {
        logError('PostgreSQL no está instalado');
        logInfo('Instala PostgreSQL desde: https://www.postgresql.org/download/');
        process.exit(1);
    }
}

// Crear base de datos
function createDatabase() {
    logStep('4️⃣', 'Creando base de datos...');
    
    try {
        // Intentar crear la base de datos
        execSync('createdb notarypro', { stdio: 'pipe' });
        logSuccess('Base de datos "notarypro" creada');
    } catch (error) {
        try {
            // Verificar si ya existe
            execSync('psql -d notarypro -c "SELECT 1"', { stdio: 'pipe' });
            logInfo('Base de datos "notarypro" ya existe');
        } catch (dbError) {
            logError('No se pudo crear ni conectar a la base de datos');
            logInfo('Verifica que PostgreSQL esté funcionando y que tengas permisos');
            process.exit(1);
        }
    }
}

// Inicializar base de datos
async function initializeDatabase() {
    logStep('5️⃣', 'Inicializando base de datos...');
    
    try {
        const dbConfig = require('./database-config');
        await dbConfig.initializeTables();
        await dbConfig.createDefaultAdmin();
        logSuccess('Base de datos inicializada correctamente');
    } catch (error) {
        logError(`Error al inicializar base de datos: ${error.message}`);
        process.exit(1);
    }
}

// Crear directorios necesarios
function createDirectories() {
    logStep('6️⃣', 'Creando directorios necesarios...');
    
    const directories = [
        'uploads',
        'logs',
        'temp'
    ];
    
    for (const dir of directories) {
        const dirPath = path.join(__dirname, dir);
        if (!fs.existsSync(dirPath)) {
            try {
                fs.mkdirSync(dirPath, { recursive: true });
                logSuccess(`Directorio ${dir} creado`);
            } catch (error) {
                logError(`Error al crear directorio ${dir}`);
            }
        } else {
            logInfo(`Directorio ${dir} ya existe`);
        }
    }
}

// Verificar archivos HTML
function checkHTMLFiles() {
    logStep('7️⃣', 'Verificando archivos HTML...');
    
    const htmlFiles = [
        'landing-page.html',
        'demo-panel.html',
        'demo-panel-enhanced.html',
        'demo-playground.html',
        'saas-panel.html'
    ];
    
    for (const file of htmlFiles) {
        if (fs.existsSync(file)) {
            logSuccess(`${file} encontrado`);
        } else {
            logWarning(`${file} no encontrado`);
        }
    }
}

// Crear script de inicio
function createStartScript() {
    logStep('8️⃣', 'Creando script de inicio...');
    
    const startScript = `#!/bin/bash
# =============================================================================
# NOTARYPRO START SCRIPT
# =============================================================================

echo "🚀 Iniciando NotaryPro..."

# Verificar si Node.js está instalado
if ! command -v node &> /dev/null; then
    echo "❌ Node.js no está instalado"
    exit 1
fi

# Verificar si PostgreSQL está funcionando
if ! pg_isready &> /dev/null; then
    echo "⚠️ PostgreSQL no está funcionando. Iniciando..."
    sudo systemctl start postgresql
fi

# Instalar dependencias si es necesario
if [ ! -d "node_modules" ]; then
    echo "📦 Instalando dependencias..."
    npm install
fi

# Inicializar base de datos si es necesario
echo "🔧 Verificando base de datos..."
node database-config.js

# Iniciar la aplicación
echo "🌟 Iniciando aplicación..."
npm start
`;
    
    try {
        fs.writeFileSync('start-notarypro.sh', startScript);
        fs.chmodSync('start-notarypro.sh', '755');
        logSuccess('Script de inicio creado: start-notarypro.sh');
    } catch (error) {
        logError('Error al crear script de inicio');
    }
}

// Crear README de configuración
function createSetupREADME() {
    logStep('9️⃣', 'Creando documentación de configuración...');
    
    const readmeContent = `# NotaryPro - Configuración de Landing Page

## 🚀 Configuración Rápida

### 1. Requisitos Previos
- Node.js 16+ instalado
- PostgreSQL 12+ instalado y funcionando
- NPM o Yarn

### 2. Instalación
\`\`\`bash
# Clonar o descargar el proyecto
cd notarypro-backend

# Ejecutar script de configuración
node setup-landing.js

# O ejecutar manualmente:
npm install
node database-config.js
\`\`\`

### 3. Configuración de Base de Datos
1. Edita el archivo \`.env\` con tus credenciales de PostgreSQL
2. Asegúrate de que PostgreSQL esté funcionando
3. La base de datos se creará automáticamente

### 4. Usuarios por Defecto
- **Admin**: admin@notarypro.cl / admin123
- **Certificador**: certificador@notarypro.cl / cert123
- **Gestor**: gestor@notarypro.cl / gestor123
- **Cliente**: cliente@notarypro.cl / cliente123

### 5. Iniciar la Aplicación
\`\`\`bash
# Usar script automático
./start-notarypro.sh

# O manualmente
npm start
\`\`\`

### 6. Acceder a la Landing Page
- **Landing Page**: http://localhost:3000/landing-page.html
- **API**: http://localhost:3000/api/v1
- **Swagger**: http://localhost:3000/api-docs

## 📁 Estructura de Archivos
\`\`\`
notarypro-backend/
├── landing-page.html          # Landing page principal
├── database-config.js         # Configuración de BD
├── setup-landing.js           # Script de configuración
├── start-notarypro.sh         # Script de inicio
├── .env                       # Variables de entorno
├── demo-panel.html            # Panel de demostración
├── demo-panel-enhanced.html   # Panel mejorado
├── demo-playground.html       # Playground de pruebas
├── saas-panel.html            # Panel SAAS
└── ...                        # Otros módulos
\`\`\`

## 🔧 Configuración Avanzada

### Variables de Entorno Importantes
- \`DB_*\`: Configuración de base de datos
- \`JWT_SECRET\`: Clave secreta para JWT
- \`SMTP_*\`: Configuración de email
- \`API_BASE_URL\`: URL base de la API

### Personalización
1. Edita \`landing-page.html\` para cambiar el diseño
2. Modifica \`database-config.js\` para esquemas personalizados
3. Ajusta \`.env\` para tu entorno

## 🆘 Solución de Problemas

### Error de Conexión a BD
\`\`\`bash
# Verificar PostgreSQL
sudo systemctl status postgresql

# Iniciar si es necesario
sudo systemctl start postgresql

# Verificar conexión
psql -U postgres -d notarypro
\`\`\`

### Error de Dependencias
\`\`\`bash
# Limpiar e instalar
rm -rf node_modules package-lock.json
npm install
\`\`\`

### Error de Permisos
\`\`\`bash
# Dar permisos de ejecución
chmod +x start-notarypro.sh
chmod +x setup-landing.js
\`\`\`

## 📞 Soporte
- **Email**: support@notarypro.cl
- **Documentación**: https://docs.notarypro.cl
- **Issues**: GitHub Issues del proyecto

---
*NotaryPro Chile - Plataforma de Firma Electrónica*
`;
    
    try {
        fs.writeFileSync('SETUP_README.md', readmeContent);
        logSuccess('README de configuración creado: SETUP_README.md');
    } catch (error) {
        logError('Error al crear README de configuración');
    }
}

// Función principal
async function main() {
    try {
        log('🎯 Iniciando configuración de NotaryPro Landing Page...', 'bright');
        
        checkDependencies();
        createEnvFile();
        checkPostgreSQL();
        createDatabase();
        await initializeDatabase();
        createDirectories();
        checkHTMLFiles();
        createStartScript();
        createSetupREADME();
        
        log('\n🎉 ¡Configuración completada exitosamente!', 'bright');
        log('\n📋 Próximos pasos:', 'cyan');
        log('1. Edita el archivo .env con tus credenciales', 'yellow');
        log('2. Ejecuta: ./start-notarypro.sh', 'yellow');
        log('3. Accede a: http://localhost:3000/landing-page.html', 'yellow');
        log('\n📚 Lee SETUP_README.md para más detalles', 'blue');
        
    } catch (error) {
        logError(`Error durante la configuración: ${error.message}`);
        process.exit(1);
    }
}

// Ejecutar si se llama directamente
if (require.main === module) {
    main();
}

module.exports = {
    checkDependencies,
    createEnvFile,
    checkPostgreSQL,
    createDatabase,
    initializeDatabase,
    createDirectories,
    checkHTMLFiles,
    createStartScript,
    createSetupREADME
};
