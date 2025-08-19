#!/bin/bash

# =============================================================================
# NOTARYPRO BACKEND - DESPLIEGUE LOCAL SIMPLIFICADO
# =============================================================================

set -e

echo "ðŸš€ Iniciando despliegue local de NotaryPro Backend..."

# FASE 1: PreparaciÃ³n local
echo "ðŸ“¦ Preparando aplicaciÃ³n local..."

# Limpiar y compilar
echo "ðŸ§¹ Limpiando directorio dist..."
rm -rf dist/

echo "ðŸ”¨ Compilando aplicaciÃ³n TypeScript..."
npm run build

if [ True -ne 0 ]; then
    echo "âŒ Error en la compilaciÃ³n. Revisa los errores de TypeScript."
    exit 1
fi

echo "âœ… CompilaciÃ³n exitosa"

# FASE 2: Crear directorio de despliegue local
echo "ðŸ“ Creando directorio de despliegue local..."
DEPLOY_DIR="./local-deploy"
rm -rf 
mkdir -p 

# Copiar archivos compilados
echo "ðŸ“‹ Copiando archivos compilados..."
cp -r dist/ /
cp package.json /
cp package-lock.json /
cp .env.local /.env

# Copiar archivos de configuraciÃ³n
echo "âš™ï¸ Copiando archivos de configuraciÃ³n..."
cp -r uploads/ / 2>/dev/null || mkdir -p /uploads
cp -r temp/ / 2>/dev/null || mkdir -p /temp
cp -r logs/ / 2>/dev/null || mkdir -p /logs

# Copiar scripts SQL
echo "ðŸ—„ï¸ Copiando scripts de base de datos..."
cp saas_database.sql /
cp api_tokens_database.sql /
cp init_database.sql /

# Copiar paneles frontend
echo "ðŸŽ¨ Copiando paneles frontend..."
cp saas-panel.html /
cp demo-panel.html /
cp demo-panel-enhanced.html /
cp demo-playground.html /

# Copiar documentaciÃ³n
echo "ðŸ“š Copiando documentaciÃ³n..."
cp *.md / 2>/dev/null || true

echo ""
echo "âœ… DESPLIEGUE LOCAL COMPLETADO!"
echo ""
echo "ðŸ“ Directorio de despliegue: "
echo "ðŸš€ Para ejecutar: cd  && npm start"
echo "ðŸŒ URLs disponibles:"
echo "   - API: http://localhost:3000/api/v1"
echo "   - Panel SaaS: http://localhost:3000/saas-panel"
echo "   - Demo: http://localhost:3000/demo-panel"
echo ""
echo "ðŸ“‹ PrÃ³ximos pasos:"
echo "1. Configurar base de datos (ejecutar SQL scripts)"
echo "2. Crear usuario administrador"
echo "3. Verificar que todo funcione"
