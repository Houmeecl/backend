#!/bin/bash
echo "ðŸš€ Iniciando despliegue en VPS..."

# Actualizar sistema
echo "ðŸ“¦ Actualizando sistema..."
apt update
apt upgrade -y

# Instalar dependencias del sistema
echo "ðŸ”§ Instalando dependencias..."
apt install -y curl wget git build-essential

# Instalar Node.js 18.x
echo "ðŸ“± Instalando Node.js 18.x..."
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt install -y nodejs

# Verificar versiones
echo "âœ… Verificando versiones..."
node --version
npm --version

# Instalar PM2 globalmente
echo "âš¡ Instalando PM2..."
npm install -g pm2

# Navegar al directorio del proyecto
cd /var/www/notarypro-backend

# Copiar archivo de configuraciÃ³n del VPS
echo "âš™ï¸ Configurando variables de entorno..."
cp env.vps .env

# Instalar dependencias del proyecto
echo "ðŸ“š Instalando dependencias del proyecto..."
npm install

# Construir el proyecto
echo "ðŸ”¨ Construyendo proyecto..."
npm run build

# Crear directorios necesarios
echo "ðŸ“ Creando directorios..."
mkdir -p /var/log/notarypro-backend
mkdir -p /var/www/notarypro-backend/uploads
chmod 755 /var/www/notarypro-backend/uploads

# Configurar PM2
echo "âš¡ Configurando PM2..."
pm2 start ecosystem-vps.config.js --env production

# Guardar configuraciÃ³n de PM2
pm2 save
pm2 startup

# Verificar estado
echo "ðŸ” Verificando estado..."
pm2 status
pm2 logs --lines 20

echo "âœ… Despliegue completado!"
echo "ðŸŒ La API estÃ¡ corriendo en: http://170.239.86.119:3000"
echo "ðŸ“Š Swagger UI: http://170.239.86.119:3000/api-docs"
echo "ðŸ“ Logs: pm2 logs notarypro-backend"
