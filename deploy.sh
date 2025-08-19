#!/bin/bash

# Script de despliegue automatizado para NotaryPro Backend
# Uso: ./deploy.sh [servidor]

set -e

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Función para imprimir mensajes
print_message() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Verificar dependencias
check_dependencies() {
    print_message "Verificando dependencias..."
    
    if ! command -v rsync &> /dev/null; then
        print_error "rsync no está instalado. Instálalo con: sudo apt-get install rsync"
        exit 1
    fi
    
    if ! command -v ssh &> /dev/null; then
        print_error "SSH no está disponible"
        exit 1
    fi
    
    print_success "Dependencias verificadas"
}

# Compilar la aplicación
build_app() {
    print_message "Compilando la aplicación..."
    
    if npm run build; then
        print_success "Aplicación compilada exitosamente"
    else
        print_error "Error al compilar la aplicación"
        exit 1
    fi
}

# Crear archivo .env para producción
create_production_env() {
    print_message "Creando archivo .env para producción..."
    
    cat > .env.production << EOF
# ===========================================
# NOTARYPRO BACKEND - PRODUCCIÓN
# ===========================================

# Base de datos Neon
DB_USER=neondb_owner
DB_HOST=ep-dawn-night-ad9ixxns-pooler.c-2.us-east-1.aws.neon.tech
DB_NAME=neondb
DB_PASSWORD=npg_M2DXbHesGL7y
DB_PORT=5432
DATABASE_URL=postgres://neondb_owner:npg_M2DXbHesGL7y@ep-dawn-night-ad9ixxns-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require

# JWT
JWT_SECRET=notarypro_super_secret_jwt_key_2024_production_make_it_long_and_random

# API
API_BASE_URL=https://your-domain.com
NODE_ENV=production
PORT=3000

# Archivos
UPLOAD_DIR=/var/www/notarypro-backend/uploads

# Seguridad
API_KEY=notarypro_api_key_2024_production

# Logs
LOG_LEVEL=info
LOG_FILE=/var/log/notarypro/app.log

# CORS
CORS_ORIGIN=https://your-domain.com

# Sesiones
SESSION_SECRET=notarypro_session_secret_2024_production

# Archivos temporales
TEMP_DIR=/tmp/notarypro
MAX_FILE_SIZE=52428800

# Pool de base de datos
DB_POOL_MIN=5
DB_POOL_MAX=20
DB_POOL_IDLE_TIMEOUT=30000
DB_POOL_ACQUIRE_TIMEOUT=60000

# Monitoreo
ENABLE_HEALTH_CHECKS=true
HEALTH_CHECK_INTERVAL=30000
ENABLE_METRICS=true
METRICS_PORT=9090

# Desarrollo
DEBUG=false
ENABLE_SWAGGER=false
ENABLE_GRAPHIQL=false
EOF

    print_success "Archivo .env.production creado"
}

# Desplegar al servidor
deploy_to_server() {
    local server=$1
    
    print_message "Desplegando a servidor: $server"
    
    # Configuración del servidor (ajusta según tu configuración)
    case $server in
        "production"|"prod")
            REMOTE_HOST="your-production-server.com"
            REMOTE_USER="ubuntu"
            REMOTE_PATH="/var/www/notarypro-backend"
            ;;
        "staging"|"stage")
            REMOTE_HOST="your-staging-server.com"
            REMOTE_USER="ubuntu"
            REMOTE_PATH="/var/www/notarypro-backend"
            ;;
        "test")
            REMOTE_HOST="your-test-server.com"
            REMOTE_USER="ubuntu"
            REMOTE_PATH="/var/www/notarypro-backend"
            ;;
        *)
            print_error "Servidor no reconocido: $server"
            print_message "Servidores disponibles: production, staging, test"
            exit 1
            ;;
    esac
    
    print_message "Conectando a $REMOTE_HOST como $REMOTE_USER..."
    
    # Crear directorio remoto si no existe
    ssh -o StrictHostKeyChecking=no $REMOTE_USER@$REMOTE_HOST "mkdir -p $REMOTE_PATH"
    
    # Sincronizar archivos (excluyendo node_modules, .git, etc.)
    print_message "Sincronizando archivos..."
    rsync -avz --progress \
        --exclude 'node_modules' \
        --exclude '.git' \
        --exclude 'dist' \
        --exclude 'uploads' \
        --exclude 'temp' \
        --exclude 'logs' \
        --exclude '*.log' \
        --exclude '.env.local' \
        --exclude 'env.example' \
        --exclude '*.md' \
        --exclude '*.sql' \
        --exclude '*.sh' \
        --exclude '*.yaml' \
        --exclude '*.conf' \
        --exclude 'check-typescript.sh' \
        --exclude 'deploy-config.js' \
        ./ $REMOTE_USER@$REMOTE_HOST:$REMOTE_PATH/
    
    # Copiar archivo de entorno de producción
    scp .env.production $REMOTE_USER@$REMOTE_HOST:$REMOTE_PATH/.env
    
    print_success "Archivos sincronizados"
    
    # Ejecutar comandos post-despliegue
    print_message "Ejecutando comandos post-despliegue..."
    ssh $REMOTE_USER@$REMOTE_HOST "cd $REMOTE_PATH && \
        npm install --production && \
        npm run build && \
        sudo mkdir -p /var/log/notarypro && \
        sudo chown $REMOTE_USER:$REMOTE_USER /var/log/notarypro && \
        mkdir -p uploads temp logs && \
        chmod 755 uploads temp logs"
    
    # Reiniciar PM2 si está instalado, o iniciar la aplicación
    if ssh $REMOTE_USER@$REMOTE_HOST "command -v pm2 &> /dev/null"; then
        print_message "Reiniciando PM2..."
        ssh $REMOTE_USER@$REMOTE_HOST "cd $REMOTE_PATH && pm2 restart notarypro-backend || pm2 start ecosystem.config.js"
    else
        print_message "PM2 no está instalado. Instalando..."
        ssh $REMOTE_USER@$REMOTE_HOST "cd $REMOTE_PATH && \
            npm install -g pm2 && \
            pm2 start ecosystem.config.js && \
            pm2 save && \
            pm2 startup"
    fi
    
    # Verificar estado de la aplicación
    print_message "Verificando estado de la aplicación..."
    sleep 5
    
    if curl -s "http://$REMOTE_HOST:3000/health" > /dev/null; then
        print_success "Aplicación desplegada y funcionando correctamente"
        print_message "Health check: http://$REMOTE_HOST:3000/health"
        print_message "API info: http://$REMOTE_HOST:3000/info"
    else
        print_warning "La aplicación puede no estar funcionando correctamente"
        print_message "Verifica los logs: ssh $REMOTE_USER@$REMOTE_HOST 'cd $REMOTE_PATH && pm2 logs'"
    fi
}

# Función principal
main() {
    local server=${1:-"production"}
    
    print_message "Iniciando despliegue de NotaryPro Backend..."
    print_message "Servidor objetivo: $server"
    
    check_dependencies
    build_app
    create_production_env
    deploy_to_server $server
    
    print_success "Despliegue completado exitosamente!"
}

# Ejecutar script
main "$@"
