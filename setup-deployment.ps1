# =============================================================================
# NOTARYPRO BACKEND - CONFIGURADOR DE DESPLIEGUE SIMPLIFICADO
# =============================================================================

Write-Host "CONFIGURADOR DE DESPLIEGUE - NOTARYPRO BACKEND" -ForegroundColor Green
Write-Host "==================================================" -ForegroundColor Green
Write-Host ""

# Solicitar información del servidor
Write-Host "CONFIGURACION DEL SERVIDOR:" -ForegroundColor Yellow
$SERVER_HOST = Read-Host "Host del servidor (ej: mi-servidor.com o IP)"
$SERVER_USER = Read-Host "Usuario SSH (ej: root o ubuntu)"
$SERVER_PATH = Read-Host "Ruta en el servidor (ej: /opt/notarypro-backend)"
$SSH_KEY = Read-Host "Ruta de la clave SSH (ej: ~/.ssh/id_rsa)"

Write-Host ""
Write-Host "CONFIGURACION DE LA BASE DE DATOS:" -ForegroundColor Yellow
$DB_HOST = Read-Host "Host de la base de datos (ej: ep-dawn-night-ad9ixxns-pooler.c-2.us-east-1.aws.neon.tech)"
$DB_NAME = Read-Host "Nombre de la base de datos (ej: neondb)"
$DB_USER = Read-Host "Usuario de la base de datos (ej: neondb_owner)"
$DB_PASSWORD = Read-Host "Contraseña de la base de datos"

Write-Host ""
Write-Host "CONFIGURACION DE DOMINIO:" -ForegroundColor Yellow
$DOMAIN = Read-Host "Dominio principal (ej: api.notarypro.com)"

Write-Host ""
Write-Host "CONFIGURACION DE EMAIL:" -ForegroundColor Yellow
$SMTP_HOST = Read-Host "Servidor SMTP (ej: smtp.gmail.com)"
$SMTP_USER = Read-Host "Usuario SMTP (ej: tu-email@gmail.com)"
$SMTP_PASS = Read-Host "Contraseña SMTP"

# Crear archivo de configuración
$configContent = @"
# =============================================================================
# NOTARYPRO BACKEND - CONFIGURACION DE DESPLIEGUE
# =============================================================================
# Generado automáticamente el $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")
# =============================================================================

# Configuración del servidor
SERVER_HOST="$SERVER_HOST"
SERVER_USER="$SERVER_USER"
SERVER_PATH="$SERVER_PATH"
SSH_KEY="$SSH_KEY"

# Configuración de la base de datos
DB_HOST="$DB_HOST"
DB_NAME="$DB_NAME"
DB_USER="$DB_USER"
DB_PASSWORD="$DB_PASSWORD"
DATABASE_URL="postgres://$DB_USER`:$DB_PASSWORD@$DB_HOST/$DB_NAME?sslmode=require"

# Configuración del dominio
DOMAIN="$DOMAIN"

# Configuración de email
SMTP_HOST="$SMTP_HOST"
SMTP_USER="$SMTP_USER"
SMTP_PASS="$SMTP_PASS"

# Configuración adicional
JWT_SECRET="notarypro_super_secret_jwt_key_$(Get-Random -Minimum 100000 -Maximum 999999)_$(Get-Date -Format "yyyyMMdd")"
API_KEY="notarypro_api_key_$(Get-Random -Minimum 100000 -Maximum 999999)"
"@

# Guardar configuración
$configContent | Out-File -FilePath "deployment-config.txt" -Encoding UTF8

Write-Host ""
Write-Host "CONFIGURACION GUARDADA EN: deployment-config.txt" -ForegroundColor Green
Write-Host ""

# Mostrar resumen
Write-Host "RESUMEN DE CONFIGURACION:" -ForegroundColor Cyan
Write-Host "Servidor: $SERVER_HOST" -ForegroundColor White
Write-Host "Usuario: $SERVER_USER" -ForegroundColor White
Write-Host "Ruta: $SERVER_PATH" -ForegroundColor White
Write-Host "Dominio: $DOMAIN" -ForegroundColor White
Write-Host "Base de datos: $DB_HOST/$DB_NAME" -ForegroundColor White
Write-Host ""

Write-Host "PROXIMOS PASOS:" -ForegroundColor Yellow
Write-Host "1. Revisa la configuración en deployment-config.txt" -ForegroundColor White
Write-Host "2. Actualiza las variables en deploy-enhanced.sh" -ForegroundColor White
Write-Host "3. Ejecuta: ./deploy-enhanced.sh" -ForegroundColor White
Write-Host ""

Write-Host "¿Deseas que actualice automáticamente el script de despliegue? (s/n)" -ForegroundColor Yellow
$updateScript = Read-Host

if ($updateScript -eq "s" -or $updateScript -eq "S" -or $updateScript -eq "si" -or $updateScript -eq "SI") {
    # Leer el script de despliegue
    $deployScript = Get-Content "deploy-enhanced.sh" -Raw
    
    # Actualizar variables
    $deployScript = $deployScript -replace 'SERVER_HOST="tu-servidor\.com"', "SERVER_HOST=`"$SERVER_HOST`""
    $deployScript = $deployScript -replace 'SERVER_USER="tu-usuario"', "SERVER_USER=`"$SERVER_USER`""
    $deployScript = $deployScript -replace 'SERVER_PATH="/opt/notarypro-backend"', "SERVER_PATH=`"$SERVER_PATH`""
    $deployScript = $deployScript -replace 'SSH_KEY="~/.ssh/id_rsa"', "SSH_KEY=`"$SSH_KEY`""
    
    # Guardar script actualizado
    $deployScript | Out-File -FilePath "deploy-enhanced.sh" -Encoding UTF8
    
    Write-Host "Script de despliegue actualizado automáticamente" -ForegroundColor Green
    Write-Host ""
    Write-Host "YA PUEDES EJECUTAR: ./deploy-enhanced.sh" -ForegroundColor Green
} else {
    Write-Host "Actualiza manualmente las variables en deploy-enhanced.sh:" -ForegroundColor Yellow
    Write-Host "   SERVER_HOST=`"$SERVER_HOST`"" -ForegroundColor White
    Write-Host "   SERVER_USER=`"$SERVER_USER`"" -ForegroundColor White
    Write-Host "   SERVER_PATH=`"$SERVER_PATH`"" -ForegroundColor White
    Write-Host "   SSH_KEY=`"$SSH_KEY`"" -ForegroundColor White
}

Write-Host ""
Write-Host "Configuracion completada!" -ForegroundColor Green
