# =============================================================================
# NOTARYPRO BACKEND - DESPLIEGUE RÁPIDO
# =============================================================================

Write-Host "DESPLIEGUE RAPIDO - NOTARYPRO BACKEND" -ForegroundColor Green
Write-Host "=====================================" -ForegroundColor Green
Write-Host ""

Write-Host "IMPORTANTE: Antes de ejecutar este script, debes:" -ForegroundColor Yellow
Write-Host "1. Configurar las variables en deploy-enhanced.sh" -ForegroundColor White
Write-Host "2. Tener acceso SSH al servidor" -ForegroundColor White
Write-Host "3. Tener Node.js y PM2 instalados en el servidor" -ForegroundColor White
Write-Host ""

Write-Host "¿Has configurado las variables en deploy-enhanced.sh? (s/n)" -ForegroundColor Yellow
$configured = Read-Host

if ($configured -ne "s" -and $configured -ne "S") {
    Write-Host "Por favor, configura las variables primero:" -ForegroundColor Red
    Write-Host "1. Edita deploy-enhanced.sh" -ForegroundColor White
    Write-Host "2. Actualiza SERVER_HOST, SERVER_USER, SERVER_PATH, SSH_KEY" -ForegroundColor White
    Write-Host "3. Ejecuta este script nuevamente" -ForegroundColor White
    exit 1
}

Write-Host ""
Write-Host "Iniciando despliegue..." -ForegroundColor Green

# Verificar que el build esté actualizado
Write-Host "Compilando aplicación..." -ForegroundColor Cyan
npm run build

if ($LASTEXITCODE -ne 0) {
    Write-Host "Error en la compilación. Revisa los errores." -ForegroundColor Red
    exit 1
}

Write-Host "Compilación exitosa!" -ForegroundColor Green

# Verificar que el script de despliegue existe
if (-not (Test-Path "deploy-enhanced.sh")) {
    Write-Host "Error: deploy-enhanced.sh no encontrado" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "Ejecutando despliegue..." -ForegroundColor Green
Write-Host "Esto puede tomar varios minutos..." -ForegroundColor Yellow

# Ejecutar el script de despliegue
bash deploy-enhanced.sh

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "DESPLIEGUE COMPLETADO EXITOSAMENTE!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Próximos pasos:" -ForegroundColor Yellow
    Write-Host "1. Configurar la base de datos (ejecutar SQL scripts)" -ForegroundColor White
    Write-Host "2. Crear usuario administrador" -ForegroundColor White
    Write-Host "3. Verificar que todo funcione" -ForegroundColor White
    Write-Host ""
    Write-Host "Revisa DEPLOYMENT_GUIDE.md para más detalles" -ForegroundColor Cyan
} else {
    Write-Host ""
    Write-Host "ERROR EN EL DESPLIEGUE" -ForegroundColor Red
    Write-Host "Revisa los logs para más detalles" -ForegroundColor Yellow
    Write-Host "Verifica:" -ForegroundColor White
    Write-Host "- Configuración del servidor" -ForegroundColor White
    Write-Host "- Acceso SSH" -ForegroundColor White
    Write-Host "- Variables de entorno" -ForegroundColor White
}
