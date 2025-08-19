#!/bin/bash

# ===========================================
# NOTARYPRO BACKEND - DESPLIEGUE EN VPS
# ===========================================

echo "🚀 Iniciando despliegue en VPS..."

# 1. Actualizar sistema
echo "📦 Actualizando sistema..."
apt update && apt upgrade -y

# 2. Instalar dependencias del sistema
echo "🔧 Instalando dependencias..."
apt install -y curl wget git build-essential

# 3. Instalar Node.js 18.x
echo "📱 Instalando Node.js 18.x..."
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt install -y nodejs

# 4. Verificar versiones
echo "✅ Verificando versiones..."
node --version
npm --version

# 5. Instalar PM2 globalmente
echo "⚡ Instalando PM2..."
npm install -g pm2

# 6. Navegar al directorio del proyecto
cd /var/www/notarypro-backend

# 7. Copiar archivo de configuración del VPS
echo "⚙️ Configurando variables de entorno..."
cp env.vps .env

# 8. Instalar dependencias del proyecto
echo "📚 Instalando dependencias del proyecto..."
npm install

# 9. Construir el proyecto
echo "🔨 Construyendo proyecto..."
npm run build

# 10. Crear directorios necesarios
echo "📁 Creando directorios..."
mkdir -p /var/log/notarypro-backend
mkdir -p /var/www/notarypro-backend/uploads
chmod 755 /var/www/notarypro-backend/uploads

# 11. Configurar PM2
echo "⚡ Configurando PM2..."
pm2 start ecosystem-vps.config.js --env production

# 12. Guardar configuración de PM2
pm2 save
pm2 startup

# 13. Verificar estado
echo "🔍 Verificando estado..."
pm2 status
pm2 logs --lines 20

echo "✅ Despliegue completado!"
echo "🌐 La API está corriendo en: http://170.239.86.119:3000"
echo "📊 Swagger UI: http://170.239.86.119:3000/api-docs"
echo "📝 Logs: pm2 logs notarypro-backend"
