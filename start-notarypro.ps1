# =============================================================================
# NOTARYPRO START SCRIPT FOR WINDOWS
# =============================================================================

param(
    [switch]$Setup,
    [switch]$Database,
    [switch]$Landing,
    [switch]$Help
)

# Colores para la consola
$Host.UI.RawUI.ForegroundColor = "White"

function Write-ColorOutput {
    param(
        [string]$Message,
        [string]$Color = "White"
    )
    
    $Host.UI.RawUI.ForegroundColor = $Color
    Write-Host $Message
    $Host.UI.RawUI.ForegroundColor = "White"
}

function Write-Step {
    param([string]$Message)
    Write-ColorOutput "`n🔵 $Message" "Cyan"
}

function Write-Success {
    param([string]$Message)
    Write-ColorOutput "✅ $Message" "Green"
}

function Write-Error {
    param([string]$Message)
    Write-ColorOutput "❌ $Message" "Red"
}

function Write-Warning {
    param([string]$Message)
    Write-ColorOutput "⚠️ $Message" "Yellow"
}

function Write-Info {
    param([string]$Message)
    Write-ColorOutput "ℹ️ $Message" "Blue"
}

function Show-Help {
    Write-ColorOutput "🚀 NotaryPro Windows Start Script" "Magenta"
    Write-ColorOutput "=====================================" "Magenta"
    Write-ColorOutput ""
    Write-ColorOutput "Uso: .\start-notarypro.ps1 [opciones]" "White"
    Write-ColorOutput ""
    Write-ColorOutput "Opciones:" "White"
    Write-ColorOutput "  -Setup     Ejecutar configuración completa" "Yellow"
    Write-ColorOutput "  -Database  Solo inicializar base de datos" "Yellow"
    Write-ColorOutput "  -Landing   Solo iniciar servidor de landing page" "Yellow"
    Write-ColorOutput "  -Help      Mostrar esta ayuda" "Yellow"
    Write-ColorOutput ""
    Write-ColorOutput "Ejemplos:" "White"
    Write-ColorOutput "  .\start-notarypro.ps1 -Setup" "Cyan"
    Write-ColorOutput "  .\start-notarypro.ps1 -Database" "Cyan"
    Write-ColorOutput "  .\start-notarypro.ps1 -Landing" "Cyan"
    Write-ColorOutput ""
    Write-ColorOutput "Sin opciones: Inicia la aplicación completa" "White"
}

function Test-NodeJS {
    Write-Step "Verificando Node.js..."
    
    try {
        $nodeVersion = node --version 2>$null
        if ($LASTEXITCODE -eq 0) {
            Write-Success "Node.js detectado: $nodeVersion"
            return $true
        }
    } catch {
        # Continuar con la verificación
    }
    
    try {
        $nodeVersion = Get-Command node -ErrorAction SilentlyContinue
        if ($nodeVersion) {
            $version = node --version 2>$null
            Write-Success "Node.js detectado: $version"
            return $true
        }
    } catch {
        # Continuar con la verificación
    }
    
    Write-Error "Node.js no está instalado o no está en el PATH"
    Write-Info "Instala Node.js desde: https://nodejs.org/"
    return $false
}

function Test-PostgreSQL {
    Write-Step "Verificando PostgreSQL..."
    
    try {
        $psqlVersion = psql --version 2>$null
        if ($LASTEXITCODE -eq 0) {
            Write-Success "PostgreSQL detectado: $psqlVersion"
            return $true
        }
    } catch {
        # Continuar con la verificación
    }
    
    try {
        $psqlCommand = Get-Command psql -ErrorAction SilentlyContinue
        if ($psqlCommand) {
            $version = psql --version 2>$null
            Write-Success "PostgreSQL detectado: $version"
            return $true
        }
    } catch {
        # Continuar con la verificación
    }
    
    Write-Error "PostgreSQL no está instalado o no está en el PATH"
    Write-Info "Instala PostgreSQL desde: https://www.postgresql.org/download/windows/"
    return $false
}

function Install-Dependencies {
    Write-Step "Instalando dependencias..."
    
    if (!(Test-Path "node_modules")) {
        Write-Info "Instalando dependencias de Node.js..."
        try {
            npm install
            if ($LASTEXITCODE -eq 0) {
                Write-Success "Dependencias instaladas correctamente"
            } else {
                Write-Error "Error al instalar dependencias"
                return $false
            }
        } catch {
            Write-Error "Error al instalar dependencias: $($_.Exception.Message)"
            return $false
        }
    } else {
        Write-Info "Dependencias ya están instaladas"
    }
    
    return $true
}

function Initialize-Database {
    Write-Step "Inicializando base de datos..."
    
    try {
        node database-config.js
        if ($LASTEXITCODE -eq 0) {
            Write-Success "Base de datos inicializada correctamente"
            return $true
        } else {
            Write-Error "Error al inicializar base de datos"
            return $false
        }
    } catch {
        Write-Error "Error al inicializar base de datos: $($_.Exception.Message)"
        return $false
    }
}

function Start-LandingServer {
    Write-Step "Iniciando servidor de landing page..."
    
    try {
        Start-Process -FilePath "node" -ArgumentList "landing-server.js" -NoNewWindow
        Write-Success "Servidor de landing page iniciado en http://localhost:3001"
        return $true
    } catch {
        Write-Error "Error al iniciar servidor de landing page: $($_.Exception.Message)"
        return $false
    }
}

function Start-MainApplication {
    Write-Step "Iniciando aplicación principal..."
    
    try {
        Start-Process -FilePath "node" -ArgumentList "app.js" -NoNewWindow
        Write-Success "Aplicación principal iniciada en http://localhost:3000"
        return $true
    } catch {
        Write-Error "Error al iniciar aplicación principal: $($_.Exception.Message)"
        return $false
    }
}

function Wait-ForServer {
    param([string]$Url, [string]$Name)
    
    Write-Info "Esperando que $Name esté disponible en $Url..."
    
    $maxAttempts = 30
    $attempt = 0
    
    while ($attempt -lt $maxAttempts) {
        try {
            $response = Invoke-WebRequest -Uri $Url -Method GET -TimeoutSec 5 -ErrorAction SilentlyContinue
            if ($response.StatusCode -eq 200) {
                Write-Success "$Name está funcionando correctamente"
                return $true
            }
        } catch {
            # Continuar esperando
        }
        
        $attempt++
        Start-Sleep -Seconds 2
        
        if ($attempt % 5 -eq 0) {
            Write-Info "Esperando... ($attempt/$maxAttempts)"
        }
    }
    
    Write-Warning "$Name no respondió después de $maxAttempts intentos"
    return $false
}

function Show-Status {
    Write-ColorOutput "`n🎯 Estado de NotaryPro:" "Magenta"
    Write-ColorOutput "=========================" "Magenta"
    
    # Verificar servidor principal
    try {
        $mainResponse = Invoke-WebRequest -Uri "http://localhost:3000/api/v1/health" -Method GET -TimeoutSec 5 -ErrorAction SilentlyContinue
        if ($mainResponse.StatusCode -eq 200) {
            Write-Success "Servidor Principal: http://localhost:3000 ✅"
        } else {
            Write-Warning "Servidor Principal: http://localhost:3000 ⚠️"
        }
    } catch {
        Write-Error "Servidor Principal: http://localhost:3000 ❌"
    }
    
    # Verificar servidor de landing page
    try {
        $landingResponse = Invoke-WebRequest -Uri "http://localhost:3001/status" -Method GET -TimeoutSec 5 -ErrorAction SilentlyContinue
        if ($landingResponse.StatusCode -eq 200) {
            Write-Success "Landing Page: http://localhost:3001 ✅"
        } else {
            Write-Warning "Landing Page: http://localhost:3001 ⚠️"
        }
    } catch {
        Write-Error "Landing Page: http://localhost:3001 ❌"
    }
    
    Write-ColorOutput "`n📋 URLs de Acceso:" "Cyan"
    Write-ColorOutput "  - Landing Page: http://localhost:3001" "White"
    Write-ColorOutput "  - API Principal: http://localhost:3000" "White"
    Write-ColorOutput "  - Swagger Docs: http://localhost:3000/api-docs" "White"
    Write-ColorOutput "  - Demo Panel: http://localhost:3001/demo-panel.html" "White"
    Write-ColorOutput "  - SAAS Panel: http://localhost:3001/saas-panel.html" "White"
}

function Main {
    Write-ColorOutput "🚀 Iniciando NotaryPro para Windows..." "Magenta"
    Write-ColorOutput "=========================================" "Magenta"
    
    # Verificar requisitos
    if (!(Test-NodeJS)) {
        exit 1
    }
    
    if (!(Test-PostgreSQL)) {
        exit 1
    }
    
    # Instalar dependencias
    if (!(Install-Dependencies)) {
        exit 1
    }
    
    # Ejecutar según las opciones
    if ($Setup) {
        Write-Step "Ejecutando configuración completa..."
        
        if (!(Initialize-Database)) {
            exit 1
        }
        
        if (!(Start-LandingServer)) {
            exit 1
        }
        
        if (!(Start-MainApplication)) {
            exit 1
        }
        
    } elseif ($Database) {
        Write-Step "Solo inicializando base de datos..."
        
        if (!(Initialize-Database)) {
            exit 1
        }
        
    } elseif ($Landing) {
        Write-Step "Solo iniciando servidor de landing page..."
        
        if (!(Start-LandingServer)) {
            exit 1
        }
        
    } else {
        Write-Step "Iniciando aplicación completa..."
        
        if (!(Initialize-Database)) {
            exit 1
        }
        
        if (!(Start-LandingServer)) {
            exit 1
        }
        
        if (!(Start-MainApplication)) {
            exit 1
        }
    }
    
    # Esperar un momento para que los servidores se inicien
    Start-Sleep -Seconds 3
    
    # Mostrar estado
    Show-Status
    
    Write-ColorOutput "`n💡 Presiona cualquier tecla para salir..." "Yellow"
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
}

# Manejar opciones
if ($Help) {
    Show-Help
    exit 0
}

# Ejecutar función principal
Main
