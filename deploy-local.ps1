# =============================================================================
# NOTARYPRO BACKEND - CONFIGURADOR DE DESPLIEGUE LOCAL
# =============================================================================

Write-Host "CONFIGURADOR DE DESPLIEGUE LOCAL - NOTARYPRO BACKEND" -ForegroundColor Green
Write-Host "=====================================================" -ForegroundColor Green
Write-Host ""

Write-Host "Este script configura las variables para un despliegue local" -ForegroundColor Yellow
Write-Host ""

# Configuración para entorno local
$LOCAL_CONFIG = @{
    SERVER_HOST = "localhost"
    SERVER_USER = "local"
    SERVER_PATH = "./local-deploy"
    SSH_KEY = "local"
    DOMAIN = "localhost"
    PORT = "3000"
    NODE_ENV = "development"
}

Write-Host "CONFIGURACION LOCAL AUTOMATICA:" -ForegroundColor Cyan
Write-Host "Servidor: $($LOCAL_CONFIG.SERVER_HOST)" -ForegroundColor White
Write-Host "Usuario: $($LOCAL_CONFIG.SERVER_USER)" -ForegroundColor White
Write-Host "Ruta: $($LOCAL_CONFIG.SERVER_PATH)" -ForegroundColor White
Write-Host "Dominio: $($LOCAL_CONFIG.DOMAIN)" -ForegroundColor White
Write-Host "Puerto: $($LOCAL_CONFIG.PORT)" -ForegroundColor White
Write-Host ""

Write-Host "¿Deseas personalizar alguna configuración? (s/n)" -ForegroundColor Yellow
$customize = Read-Host

if ($customize -eq "s" -or $customize -eq "S") {
    Write-Host ""
    Write-Host "CONFIGURACION PERSONALIZADA:" -ForegroundColor Yellow
    
    $LOCAL_CONFIG.SERVER_HOST = Read-Host "Host del servidor (default: localhost)" 
    if ([string]::IsNullOrWhiteSpace($LOCAL_CONFIG.SERVER_HOST)) { $LOCAL_CONFIG.SERVER_HOST = "localhost" }
    
    $LOCAL_CONFIG.SERVER_USER = Read-Host "Usuario SSH (default: local)" 
    if ([string]::IsNullOrWhiteSpace($LOCAL_CONFIG.SERVER_USER)) { $LOCAL_CONFIG.SERVER_USER = "local" }
    
    $LOCAL_CONFIG.SERVER_PATH = Read-Host "Ruta en el servidor (default: ./local-deploy)" 
    if ([string]::IsNullOrWhiteSpace($LOCAL_CONFIG.SERVER_PATH)) { $LOCAL_CONFIG.SERVER_PATH = "./local-deploy" }
    
    $LOCAL_CONFIG.DOMAIN = Read-Host "Dominio (default: localhost)" 
    if ([string]::IsNullOrWhiteSpace($LOCAL_CONFIG.DOMAIN)) { $LOCAL_CONFIG.DOMAIN = "localhost" }
    
    $LOCAL_CONFIG.PORT = Read-Host "Puerto (default: 3000)" 
    if ([string]::IsNullOrWhiteSpace($LOCAL_CONFIG.PORT)) { $LOCAL_CONFIG.PORT = "3000" }
}

Write-Host ""
Write-Host "CONFIGURACION FINAL:" -ForegroundColor Green
Write-Host "===================" -ForegroundColor Green
Write-Host "Servidor: $($LOCAL_CONFIG.SERVER_HOST)" -ForegroundColor White
Write-Host "Usuario: $($LOCAL_CONFIG.SERVER_USER)" -ForegroundColor White
Write-Host "Ruta: $($LOCAL_CONFIG.SERVER_PATH)" -ForegroundColor White
Write-Host "Dominio: $($LOCAL_CONFIG.DOMAIN)" -ForegroundColor White
Write-Host "Puerto: $($LOCAL_CONFIG.PORT)" -ForegroundColor White
Write-Host ""

# Crear archivo de configuración local
$configContent = @"
# =============================================================================
# NOTARYPRO BACKEND - CONFIGURACION DE DESPLIEGUE LOCAL
# =============================================================================
# Generado automáticamente el $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")
# =============================================================================

# Configuración del servidor local
SERVER_HOST="$($LOCAL_CONFIG.SERVER_HOST)"
SERVER_USER="$($LOCAL_CONFIG.SERVER_USER)"
SERVER_PATH="$($LOCAL_CONFIG.SERVER_PATH)"
SSH_KEY="$($LOCAL_CONFIG.SSH_KEY)"

# Configuración del dominio local
DOMAIN="$($LOCAL_CONFIG.DOMAIN)"
PORT="$($LOCAL_CONFIG.PORT)"
NODE_ENV="$($LOCAL_CONFIG.NODE_ENV)"

# Configuración de la base de datos (Neon DB)
DB_USER=neondb_owner
DB_HOST=ep-dawn-night-ad9ixxns-pooler.c-2.us-east-1.aws.neon.tech
DB_NAME=neondb
DB_PASSWORD=npg_M2DXbHesGL7y
DB_PORT=5432
DATABASE_URL=postgres://neondb_owner:npg_M2DXbHesGL7y@ep-dawn-night-ad9ixxns-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require

# Configuración JWT
JWT_SECRET=notarypro_local_jwt_key_$(Get-Random -Minimum 100000 -Maximum 999999)

# Configuración de email
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=tu-email@gmail.com
SMTP_PASS=tu-app-password

# URLs locales
API_BASE_URL=http://$($LOCAL_CONFIG.DOMAIN):$($LOCAL_CONFIG.PORT)
CORS_ORIGIN=http://$($LOCAL_CONFIG.DOMAIN):$($LOCAL_CONFIG.PORT),http://localhost:3001
"@

# Guardar configuración local
$configContent | Out-File -FilePath "deployment-config-local.txt" -Encoding UTF8

Write-Host "CONFIGURACION GUARDADA EN: deployment-config-local.txt" -ForegroundColor Green
Write-Host ""

# Actualizar script de despliegue para local
Write-Host "Actualizando script de despliegue para entorno local..." -ForegroundColor Cyan

if (Test-Path "deploy-enhanced.sh") {
    $deployScript = Get-Content "deploy-enhanced.sh" -Raw
    
    # Actualizar variables para local
    $deployScript = $deployScript -replace 'SERVER_HOST="tu-servidor\.com"', "SERVER_HOST=`"$($LOCAL_CONFIG.SERVER_HOST)`""
    $deployScript = $deployScript -replace 'SERVER_USER="tu-usuario"', "SERVER_USER=`"$($LOCAL_CONFIG.SERVER_USER)`""
    $deployScript = $deployScript -replace 'SERVER_PATH="/opt/notarypro-backend"', "SERVER_PATH=`"$($LOCAL_CONFIG.SERVER_PATH)`""
    $deployScript = $deployScript -replace 'SSH_KEY="~/.ssh/id_rsa"', "SSH_KEY=`"$($LOCAL_CONFIG.SSH_KEY)`""
    
    # Guardar script actualizado
    $deployScript | Out-File -FilePath "deploy-local.sh" -Encoding UTF8
    
    Write-Host "Script de despliegue local creado: deploy-local.sh" -ForegroundColor Green
} else {
    Write-Host "ADVERTENCIA: deploy-enhanced.sh no encontrado" -ForegroundColor Yellow
}

# Crear archivo .env.local actualizado
$envLocalContent = @"
# ===========================================
# NOTARYPRO BACKEND - VARIABLES DE ENTORNO LOCAL
# ===========================================

# ===========================================
# CONFIGURACION DE BASE DE DATOS (NEON)
# ===========================================
DB_USER=neondb_owner
DB_HOST=ep-dawn-night-ad9ixxns-pooler.c-2.us-east-1.aws.neon.tech
DB_NAME=neondb
DB_PASSWORD=npg_M2DXbHesGL7y
DB_PORT=5432
DATABASE_URL=postgres://neondb_owner:npg_M2DXbHesGL7y@ep-dawn-night-ad9ixxns-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require

# ===========================================
# CONFIGURACION JWT
# ===========================================
JWT_SECRET=notarypro_local_jwt_key_$(Get-Random -Minimum 100000 -Maximum 999999)

# ===========================================
# CONFIGURACION DE EMAIL (SMTP)
# ===========================================
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=tu-email@gmail.com
SMTP_PASS=tu-app-password-aqui

# ===========================================
# CONFIGURACION DE LA API
# ===========================================
API_BASE_URL=http://$($LOCAL_CONFIG.DOMAIN):$($LOCAL_CONFIG.PORT)
NODE_ENV=development
PORT=$($LOCAL_CONFIG.PORT)

# ===========================================
# CONFIGURACION DE ARCHIVOS
# ===========================================
UPLOAD_DIR=./uploads

# ===========================================
# CONFIGURACION DE SEGURIDAD
# ===========================================
API_KEY=notarypro_local_api_key_$(Get-Random -Minimum 100000 -Maximum 999999)

# ===========================================
# CONFIGURACION DE LOGS
# ===========================================
LOG_LEVEL=debug
LOG_FILE=logs/app-local.log

# ===========================================
# CONFIGURACION DE CORS
# ===========================================
CORS_ORIGIN=http://$($LOCAL_CONFIG.DOMAIN):$($LOCAL_CONFIG.PORT),http://localhost:3001

# ===========================================
# CONFIGURACION DE DESARROLLO
# ===========================================
DEBUG=true
ENABLE_SWAGGER=true
ENABLE_GRAPHIQL=true
"@

# Guardar .env.local
$envLocalContent | Out-File -FilePath ".env.local" -Encoding UTF8

Write-Host "Archivo .env.local actualizado para entorno local" -ForegroundColor Green
Write-Host ""

# Crear script de despliegue local simplificado
$deployLocalScript = @"
#!/bin/bash

# =============================================================================
# NOTARYPRO BACKEND - DESPLIEGUE LOCAL SIMPLIFICADO
# =============================================================================

set -e

echo "🚀 Iniciando despliegue local de NotaryPro Backend..."

# FASE 1: Preparación local
echo "📦 Preparando aplicación local..."

# Limpiar y compilar
echo "🧹 Limpiando directorio dist..."
rm -rf dist/

echo "🔨 Compilando aplicación TypeScript..."
npm run build

if [ $? -ne 0 ]; then
    echo "❌ Error en la compilación. Revisa los errores de TypeScript."
    exit 1
fi

echo "✅ Compilación exitosa"

# FASE 2: Crear directorio de despliegue local
echo "📁 Creando directorio de despliegue local..."
DEPLOY_DIR="$($LOCAL_CONFIG.SERVER_PATH)"
rm -rf $DEPLOY_DIR
mkdir -p $DEPLOY_DIR

# Copiar archivos compilados
echo "📋 Copiando archivos compilados..."
cp -r dist/ $DEPLOY_DIR/
cp package.json $DEPLOY_DIR/
cp package-lock.json $DEPLOY_DIR/
cp .env.local $DEPLOY_DIR/.env

# Copiar archivos de configuración
echo "⚙️ Copiando archivos de configuración..."
cp -r uploads/ $DEPLOY_DIR/ 2>/dev/null || mkdir -p $DEPLOY_DIR/uploads
cp -r temp/ $DEPLOY_DIR/ 2>/dev/null || mkdir -p $DEPLOY_DIR/temp
cp -r logs/ $DEPLOY_DIR/ 2>/dev/null || mkdir -p $DEPLOY_DIR/logs

# Copiar scripts SQL
echo "🗄️ Copiando scripts de base de datos..."
cp saas_database.sql $DEPLOY_DIR/
cp api_tokens_database.sql $DEPLOY_DIR/
cp init_database.sql $DEPLOY_DIR/

# Copiar paneles frontend
echo "🎨 Copiando paneles frontend..."
cp saas-panel.html $DEPLOY_DIR/
cp demo-panel.html $DEPLOY_DIR/
cp demo-panel-enhanced.html $DEPLOY_DIR/
cp demo-playground.html $DEPLOY_DIR/

# Copiar documentación
echo "📚 Copiando documentación..."
cp *.md $DEPLOY_DIR/ 2>/dev/null || true

echo ""
echo "✅ DESPLIEGUE LOCAL COMPLETADO!"
echo ""
echo "📁 Directorio de despliegue: $DEPLOY_DIR"
echo "🚀 Para ejecutar: cd $DEPLOY_DIR && npm start"
echo "🌐 URLs disponibles:"
echo "   - API: http://$($LOCAL_CONFIG.DOMAIN):$($LOCAL_CONFIG.PORT)/api/v1"
echo "   - Panel SaaS: http://$($LOCAL_CONFIG.DOMAIN):$($LOCAL_CONFIG.PORT)/saas-panel"
echo "   - Demo: http://$($LOCAL_CONFIG.DOMAIN):$($LOCAL_CONFIG.PORT)/demo-panel"
echo ""
echo "📋 Próximos pasos:"
echo "1. Configurar base de datos (ejecutar SQL scripts)"
echo "2. Crear usuario administrador"
echo "3. Verificar que todo funcione"
"@

# Guardar script de despliegue local
$deployLocalScript | Out-File -FilePath "deploy-local.sh" -Encoding UTF8

Write-Host "Script de despliegue local creado: deploy-local.sh" -ForegroundColor Green
Write-Host ""

Write-Host "PROXIMOS PASOS:" -ForegroundColor Yellow
Write-Host "1. Revisa la configuración en deployment-config-local.txt" -ForegroundColor White
Write-Host "2. Ejecuta el despliegue local: bash deploy-local.sh" -ForegroundColor White
Write-Host "3. O ejecuta manualmente: npm run build && npm start" -ForegroundColor White
Write-Host ""

Write-Host "CONFIGURACION LOCAL COMPLETADA!" -ForegroundColor Green
Write-Host "Tu aplicación está configurada para ejecutarse en:" -ForegroundColor White
Write-Host "   http://$($LOCAL_CONFIG.DOMAIN):$($LOCAL_CONFIG.PORT)" -ForegroundColor Cyan
