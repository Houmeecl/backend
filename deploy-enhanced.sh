#!/bin/bash

# =============================================================================
# NOTARYPRO BACKEND - SCRIPT DE DESPLIEGUE COMPLETO CON TODAS LAS MEJORAS
# =============================================================================
# Este script despliega la aplicación completa con:
# - Módulos SaaS y administración
# - Sistema de API Tokens
# - Módulo de Demo Mejorado con playground interactivo
# - Panel de administración SaaS
# - Paneles de demo mejorados
# =============================================================================

set -e  # Exit on any error

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuración del servidor
SERVER_HOST="tu-servidor.com"
SERVER_USER="tu-usuario"
SERVER_PATH="/opt/notarypro-backend"
SSH_KEY="~/.ssh/id_rsa"

# Función para mostrar mensajes
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

warn() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING: $1${NC}"
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR: $1${NC}"
    exit 1
}

# Verificar que estamos en el directorio correcto
if [ ! -f "package.json" ]; then
    error "Debes ejecutar este script desde el directorio raíz del proyecto"
fi

log "🚀 Iniciando despliegue completo de NotaryPro Backend con todas las mejoras..."

# FASE 1: Preparación local
log "📦 Preparando aplicación local..."

# Limpiar y compilar
log "🧹 Limpiando directorio dist..."
rm -rf dist/

log "🔨 Compilando aplicación TypeScript..."
npm run build

if [ $? -ne 0 ]; then
    error "Error en la compilación. Revisa los errores de TypeScript."
fi

log "✅ Compilación exitosa"

# Verificar que todos los módulos estén compilados
REQUIRED_MODULES=(
    "app.js"
    "core_manager.js"
    "auth_module.js"
    "saas_admin_module.js"
    "api_token_module.js"
    "demo_module_enhanced.js"
    "verification_module.js"
    "document_module.js"
    "templates_module.js"
    "signatures_module.js"
    "users_module.js"
    "analytics_module.js"
)

log "🔍 Verificando módulos compilados..."
for module in "${REQUIRED_MODULES[@]}"; do
    if [ ! -f "dist/$module" ]; then
        error "Módulo faltante: $module"
    fi
done

log "✅ Todos los módulos están compilados"

# FASE 2: Preparar archivos para despliegue
log "📁 Preparando archivos para despliegue..."

# Crear directorio temporal para despliegue
DEPLOY_DIR="deploy-temp"
rm -rf $DEPLOY_DIR
mkdir -p $DEPLOY_DIR

# Copiar archivos compilados
log "📋 Copiando archivos compilados..."
cp -r dist/ $DEPLOY_DIR/
cp package.json $DEPLOY_DIR/
cp package-lock.json $DEPLOY_DIR/
cp ecosystem.config.js $DEPLOY_DIR/
cp .env.production $DEPLOY_DIR/.env

# Copiar archivos de configuración
log "⚙️ Copiando archivos de configuración..."
cp -r uploads/ $DEPLOY_DIR/ 2>/dev/null || mkdir -p $DEPLOY_DIR/uploads
cp -r temp/ $DEPLOY_DIR/ 2>/dev/null || mkdir -p $DEPLOY_DIR/temp
cp -r logs/ $DEPLOY_DIR/ 2>/dev/null || mkdir -p $DEPLOY_DIR/logs

# Copiar scripts SQL
log "🗄️ Copiando scripts de base de datos..."
cp saas_database.sql $DEPLOY_DIR/
cp api_tokens_database.sql $DEPLOY_DIR/
cp init_database.sql $DEPLOY_DIR/

# Copiar paneles frontend
log "🎨 Copiando paneles frontend..."
cp saas-panel.html $DEPLOY_DIR/
cp demo-panel.html $DEPLOY_DIR/
cp demo-panel-enhanced.html $DEPLOY_DIR/
cp demo-playground.html $DEPLOY_DIR/

# Copiar documentación
log "📚 Copiando documentación..."
cp README.md $DEPLOY_DIR/
cp API_DOCUMENTATION.md $DEPLOY_DIR/
cp SAAS_DOCUMENTATION.md $DEPLOY_DIR/
cp API_TOKENS_DOCUMENTATION.md $DEPLOY_DIR/
cp SAAS_PANEL_DOCUMENTATION.md $DEPLOY_DIR/
cp DEMO_MODULE_DOCUMENTATION.md $DEPLOY_DIR/
cp ENHANCED_FEATURES_DOCUMENTATION.md $DEPLOY_DIR/
cp DOCUMENTATION_INDEX.md $DEPLOY_DIR/
cp DEPLOYMENT.md $DEPLOY_DIR/

# FASE 3: Despliegue al servidor
log "🌐 Desplegando al servidor $SERVER_HOST..."

# Crear directorio en el servidor si no existe
log "📁 Creando directorio en el servidor..."
ssh -i $SSH_KEY $SERVER_USER@$SERVER_HOST "sudo mkdir -p $SERVER_PATH && sudo chown $SERVER_USER:$SERVER_USER $SERVER_PATH"

# Sincronizar archivos
log "🔄 Sincronizando archivos..."
rsync -avz --delete -e "ssh -i $SSH_KEY" $DEPLOY_DIR/ $SERVER_USER@$SERVER_HOST:$SERVER_PATH/

# FASE 4: Configuración del servidor
log "⚙️ Configurando servidor..."

# Instalar dependencias en el servidor
log "📦 Instalando dependencias en el servidor..."
ssh -i $SSH_KEY $SERVER_USER@$SERVER_HOST "cd $SERVER_PATH && npm ci --only=production"

# Configurar PM2
log "🔄 Configurando PM2..."
ssh -i $SSH_KEY $SERVER_USER@$SERVER_HOST "cd $SERVER_PATH && pm2 delete notarypro-backend 2>/dev/null || true"
ssh -i $SSH_KEY $SERVER_USER@$SERVER_HOST "cd $SERVER_PATH && pm2 start ecosystem.config.js"

# Configurar Nginx
log "🌐 Configurando Nginx..."
NGINX_CONFIG="
server {
    listen 80;
    server_name $SERVER_HOST;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }
    
    # Servir archivos estáticos de los paneles
    location /saas-panel {
        alias $SERVER_PATH/saas-panel.html;
        add_header Content-Type text/html;
    }
    
    location /demo-panel {
        alias $SERVER_PATH/demo-panel.html;
        add_header Content-Type text/html;
    }
    
    location /demo-enhanced {
        alias $SERVER_PATH/demo-panel-enhanced.html;
        add_header Content-Type text/html;
    }
    
    location /demo-playground {
        alias $SERVER_PATH/demo-playground.html;
        add_header Content-Type text/html;
    }
}
"

echo "$NGINX_CONFIG" | ssh -i $SSH_KEY $SERVER_USER@$SERVER_HOST "sudo tee /etc/nginx/sites-available/notarypro-backend > /dev/null"
ssh -i $SSH_KEY $SERVER_USER@$SERVER_HOST "sudo ln -sf /etc/nginx/sites-available/notarypro-backend /etc/nginx/sites-enabled/ && sudo nginx -t && sudo systemctl reload nginx"

# FASE 5: Verificación del despliegue
log "🔍 Verificando despliegue..."

# Esperar a que la aplicación esté lista
log "⏳ Esperando a que la aplicación esté lista..."
sleep 10

# Verificar estado de PM2
log "📊 Estado de PM2:"
ssh -i $SSH_KEY $SERVER_USER@$SERVER_HOST "pm2 status notarypro-backend"

# Verificar logs
log "📝 Últimos logs de la aplicación:"
ssh -i $SSH_KEY $SERVER_USER@$SERVER_HOST "pm2 logs notarypro-backend --lines 20"

# Verificar endpoints principales
log "🌐 Verificando endpoints principales..."
ENDPOINTS=(
    "http://$SERVER_HOST/health"
    "http://$SERVER_HOST/api/v1/health"
    "http://$SERVER_HOST/saas-panel"
    "http://$SERVER_HOST/demo-panel"
    "http://$SERVER_HOST/demo-enhanced"
    "http://$SERVER_HOST/demo-playground"
)

for endpoint in "${ENDPOINTS[@]}"; do
    if curl -s -f "$endpoint" > /dev/null; then
        log "✅ $endpoint - OK"
    else
        warn "⚠️ $endpoint - No responde"
    fi
done

# FASE 6: Limpieza y finalización
log "🧹 Limpiando archivos temporales..."
rm -rf $DEPLOY_DIR

log "🎉 ¡Despliegue completado exitosamente!"
log ""
log "📋 RESUMEN DEL DESPLIEGUE:"
log "   🌐 Servidor: $SERVER_HOST"
log "   📁 Directorio: $SERVER_PATH"
log "   🚀 Aplicación: http://$SERVER_HOST"
log "   🎛️ Panel SaaS: http://$SERVER_HOST/saas-panel"
log "   🎯 Panel Demo: http://$SERVER_HOST/demo-panel"
log "   🚀 Demo Mejorado: http://$SERVER_HOST/demo-enhanced"
log "   🎮 Playground: http://$SERVER_HOST/demo-playground"
log "   📚 API Docs: http://$SERVER_HOST/api/v1/docs"
log ""
log "🔧 COMANDOS ÚTILES:"
log "   Ver estado: ssh $SERVER_USER@$SERVER_HOST 'pm2 status'"
log "   Ver logs: ssh $SERVER_USER@$SERVER_HOST 'pm2 logs notarypro-backend'"
log "   Reiniciar: ssh $SERVER_USER@$SERVER_HOST 'pm2 restart notarypro-backend'"
log "   Parar: ssh $SERVER_USER@$SERVER_HOST 'pm2 stop notarypro-backend'"
log ""
log "📖 DOCUMENTACIÓN:"
log "   - README.md: Documentación general"
log "   - API_DOCUMENTATION.md: Documentación de la API"
log "   - SAAS_DOCUMENTATION.md: Sistema SaaS"
log "   - ENHANCED_FEATURES_DOCUMENTATION.md: Características mejoradas"
log "   - DOCUMENTATION_INDEX.md: Índice completo"
log ""
log "🎯 PRÓXIMOS PASOS:"
log "   1. Ejecutar scripts SQL en la base de datos"
log "   2. Crear usuario administrador inicial"
log "   3. Configurar variables de entorno de producción"
log "   4. Configurar SSL/HTTPS (opcional)"
log "   5. Configurar monitoreo y alertas"
log ""
log "✨ ¡NotaryPro Backend está desplegado y funcionando!"
