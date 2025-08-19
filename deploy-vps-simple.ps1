# ===========================================
# NOTARYPRO BACKEND - DESPLIEGUE EN VPS (POWERSHELL SIMPLIFICADO)
# ===========================================

Write-Host "🚀 PREPARANDO DESPLIEGUE EN VPS..." -ForegroundColor Green
Write-Host "=====================================" -ForegroundColor Yellow

# Crear el script de despliegue en el VPS
$deployScript = @'
#!/bin/bash
echo "🚀 Iniciando despliegue en VPS..."

# Actualizar sistema
echo "📦 Actualizando sistema..."
apt update
apt upgrade -y

# Instalar dependencias del sistema
echo "🔧 Instalando dependencias..."
apt install -y curl wget git build-essential

# Instalar Node.js 18.x
echo "📱 Instalando Node.js 18.x..."
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt install -y nodejs

# Verificar versiones
echo "✅ Verificando versiones..."
node --version
npm --version

# Instalar PM2 globalmente
echo "⚡ Instalando PM2..."
npm install -g pm2

# Navegar al directorio del proyecto
cd /var/www/notarypro-backend

# Copiar archivo de configuración del VPS
echo "⚙️ Configurando variables de entorno..."
cp env.vps .env

# Instalar dependencias del proyecto
echo "📚 Instalando dependencias del proyecto..."
npm install

# Construir el proyecto
echo "🔨 Construyendo proyecto..."
npm run build

# Crear directorios necesarios
echo "📁 Creando directorios..."
mkdir -p /var/log/notarypro-backend
mkdir -p /var/www/notarypro-backend/uploads
chmod 755 /var/www/notarypro-backend/uploads

# Configurar PM2
echo "⚡ Configurando PM2..."
pm2 start ecosystem-vps.config.js --env production

# Guardar configuración de PM2
pm2 save
pm2 startup

# Verificar estado
echo "🔍 Verificando estado..."
pm2 status
pm2 logs --lines 20

echo "✅ Despliegue completado!"
echo "🌐 La API está corriendo en: http://170.239.86.119:3000"
echo "📊 Swagger UI: http://170.239.86.119:3000/api-docs"
echo "📝 Logs: pm2 logs notarypro-backend"
'@

# Guardar el script temporalmente
$deployScript | Out-File -FilePath "deploy-temp.sh" -Encoding UTF8

Write-Host "📝 Script de despliegue creado exitosamente!" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Yellow

Write-Host "📋 PASOS PARA EJECUTAR EN EL VPS:" -ForegroundColor Yellow
Write-Host "1. Conecta al VPS: ssh root@170.239.86.119 -p22222" -ForegroundColor White
Write-Host "2. Navega al directorio: cd /var/www/notarypro-backend" -ForegroundColor White
Write-Host "3. Copia la configuración: cp env.vps .env" -ForegroundColor White
Write-Host "4. Ejecuta el despliegue: bash deploy-temp.sh" -ForegroundColor White

Write-Host "`n🔍 COMANDOS DE VERIFICACIÓN:" -ForegroundColor Yellow
Write-Host "pm2 status" -ForegroundColor Gray
Write-Host "pm2 logs notarypro-backend" -ForegroundColor Gray
Write-Host "curl http://170.239.86.119:3000/health" -ForegroundColor Gray

Write-Host "`n✅ ¡Todo listo para el despliegue!" -ForegroundColor Green
Write-Host "El archivo deploy-temp.sh está listo para usar en el VPS" -ForegroundColor Cyan
