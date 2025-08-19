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
