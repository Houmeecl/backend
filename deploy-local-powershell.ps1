# =============================================================================
# NOTARYPRO BACKEND - DESPLIEGUE LOCAL CON POWERSHELL
# =============================================================================

Write-Host "🚀 Iniciando despliegue local de NotaryPro Backend..." -ForegroundColor Green
Write-Host ""

# FASE 1: Preparación local
Write-Host "📦 Preparando aplicación local..." -ForegroundColor Cyan

# Limpiar y compilar
Write-Host "🧹 Limpiando directorio dist..." -ForegroundColor Yellow
if (Test-Path "dist") {
    Remove-Item -Recurse -Force "dist"
}

Write-Host "🔨 Compilando aplicación TypeScript..." -ForegroundColor Yellow
npm run build

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Error en la compilación. Revisa los errores de TypeScript." -ForegroundColor Red
    exit 1
}

Write-Host "✅ Compilación exitosa" -ForegroundColor Green

# FASE 2: Crear directorio de despliegue local
Write-Host "📁 Creando directorio de despliegue local..." -ForegroundColor Cyan
$DEPLOY_DIR = "./local-deploy"
if (Test-Path $DEPLOY_DIR) {
    Remove-Item -Recurse -Force $DEPLOY_DIR
}
New-Item -ItemType Directory -Path $DEPLOY_DIR | Out-Null

# Copiar archivos compilados
Write-Host "📋 Copiando archivos compilados..." -ForegroundColor Yellow
Copy-Item -Path "dist/*" -Destination $DEPLOY_DIR -Recurse -Force
Copy-Item -Path "package.json" -Destination $DEPLOY_DIR -Force
Copy-Item -Path "package-lock.json" -Destination $DEPLOY_DIR -Force
Copy-Item -Path "env.local" -Destination "$DEPLOY_DIR/.env" -Force

# Copiar archivos de configuración
Write-Host "⚙️ Copiando archivos de configuración..." -ForegroundColor Yellow
if (Test-Path "uploads") {
    Copy-Item -Path "uploads/*" -Destination "$DEPLOY_DIR/uploads" -Recurse -Force
} else {
    New-Item -ItemType Directory -Path "$DEPLOY_DIR/uploads" | Out-Null
}

if (Test-Path "temp") {
    Copy-Item -Path "temp/*" -Destination "$DEPLOY_DIR/temp" -Recurse -Force
} else {
    New-Item -ItemType Directory -Path "$DEPLOY_DIR/temp" | Out-Null
}

if (Test-Path "logs") {
    Copy-Item -Path "logs/*" -Destination "$DEPLOY_DIR/logs" -Recurse -Force
} else {
    New-Item -ItemType Directory -Path "$DEPLOY_DIR/logs" | Out-Null
}

# Copiar scripts SQL
Write-Host "🗄️ Copiando scripts de base de datos..." -ForegroundColor Yellow
Copy-Item -Path "saas_database.sql" -Destination $DEPLOY_DIR -Force
Copy-Item -Path "api_tokens_database.sql" -Destination $DEPLOY_DIR -Force
Copy-Item -Path "init_database.sql" -Destination $DEPLOY_DIR -Force

# Copiar paneles frontend
Write-Host "🎨 Copiando paneles frontend..." -ForegroundColor Yellow
Copy-Item -Path "saas-panel.html" -Destination $DEPLOY_DIR -Force
Copy-Item -Path "demo-panel.html" -Destination $DEPLOY_DIR -Force
Copy-Item -Path "demo-panel-enhanced.html" -Destination $DEPLOY_DIR -Force
Copy-Item -Path "demo-playground.html" -Destination $DEPLOY_DIR -Force

# Copiar documentación
Write-Host "📚 Copiando documentación..." -ForegroundColor Yellow
Copy-Item -Path "*.md" -Destination $DEPLOY_DIR -Force

# Crear script de inicio local
$startScript = @"
# =============================================================================
# NOTARYPRO BACKEND - INICIO LOCAL
# =============================================================================

Write-Host "🚀 Iniciando NotaryPro Backend en modo local..." -ForegroundColor Green
Write-Host ""

# Verificar que Node.js esté instalado
try {
    $nodeVersion = node --version
    Write-Host "✅ Node.js detectado: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ Node.js no está instalado. Por favor instálalo primero." -ForegroundColor Red
    exit 1
}

# Verificar que las dependencias estén instaladas
if (-not (Test-Path "node_modules")) {
    Write-Host "📦 Instalando dependencias..." -ForegroundColor Yellow
    npm install
}

# Iniciar la aplicación
Write-Host "🚀 Iniciando aplicación..." -ForegroundColor Green
Write-Host "🌐 URLs disponibles:" -ForegroundColor Cyan
Write-Host "   - API: http://localhost:3000/api/v1" -ForegroundColor White
Write-Host "   - Panel SaaS: http://localhost:3000/saas-panel" -ForegroundColor White
Write-Host "   - Demo: http://localhost:3000/demo-panel" -ForegroundColor White
Write-Host "   - Demo Mejorado: http://localhost:3000/demo-enhanced" -ForegroundColor White
Write-Host "   - Playground: http://localhost:3000/demo-playground" -ForegroundColor White
Write-Host ""
Write-Host "📋 Para detener la aplicación: Ctrl+C" -ForegroundColor Yellow
Write-Host ""

npm start
"@

$startScript | Out-File -FilePath "$DEPLOY_DIR/start-local.ps1" -Encoding UTF8

Write-Host ""
Write-Host "✅ DESPLIEGUE LOCAL COMPLETADO!" -ForegroundColor Green
Write-Host ""
Write-Host "📁 Directorio de despliegue: $DEPLOY_DIR" -ForegroundColor Cyan
Write-Host "🚀 Para ejecutar:" -ForegroundColor Yellow
Write-Host "   cd $DEPLOY_DIR" -ForegroundColor White
Write-Host "   powershell -ExecutionPolicy Bypass -File start-local.ps1" -ForegroundColor White
Write-Host ""
Write-Host "🌐 URLs disponibles:" -ForegroundColor Cyan
Write-Host "   - API: http://localhost:3000/api/v1" -ForegroundColor White
Write-Host "   - Panel SaaS: http://localhost:3000/saas-panel" -ForegroundColor White
Write-Host "   - Demo: http://localhost:3000/demo-panel" -ForegroundColor White
Write-Host "   - Demo Mejorado: http://localhost:3000/demo-enhanced" -ForegroundColor White
Write-Host "   - Playground: http://localhost:3000/demo-playground" -ForegroundColor White
Write-Host ""
Write-Host "📋 Próximos pasos:" -ForegroundColor Yellow
Write-Host "1. Configurar base de datos (ejecutar SQL scripts)" -ForegroundColor White
Write-Host "2. Crear usuario administrador" -ForegroundColor White
Write-Host "3. Verificar que todo funcione" -ForegroundColor White
Write-Host ""
Write-Host "🎯 DESPLIEGUE RÁPIDO:" -ForegroundColor Green
Write-Host "   cd $DEPLOY_DIR && npm start" -ForegroundColor White
