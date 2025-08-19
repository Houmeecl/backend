#!/bin/bash

# =============================================================================
# NOTARYPRO BACKEND - VERIFICAR TYPESCRIPT
# =============================================================================

echo "🔍 Verificando archivos TypeScript..."

# Ir al directorio del proyecto
cd /var/www/notarypro-backend

# Verificar que tsconfig.json existe
if [ ! -f "tsconfig.json" ]; then
    echo "📝 Creando tsconfig.json..."
    cat > tsconfig.json << 'EOF'
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "outDir": "./dist",
    "rootDir": "./",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": false,
    "removeComments": true,
    "allowSyntheticDefaultImports": true,
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true,
    "noImplicitAny": true,
    "noImplicitReturns": true,
    "noUnusedLocals": false,
    "noUnusedParameters": false,
    "allowUnreachableCode": false,
    "exactOptionalPropertyTypes": false
  },
  "include": [
    "*.ts",
    "**/*.ts"
  ],
  "exclude": [
    "node_modules",
    "dist",
    "uploads"
  ]
}
EOF
fi

# Verificar archivos TypeScript principales
echo "📋 Verificando archivos principales..."

MAIN_FILES=(
    "app.ts"
    "core_manager.ts"
    "base_module.ts"
    "auth_middleware.ts"
    "auth_module.ts"
    "identity_module.ts"
    "verification_module.ts"
    "analytics_module.ts"
    "audit_module.ts"
    "certifier_signatures_module.ts"
    "coupons_module.ts"
    "document_module.ts"
    "files_module.ts"
    "notifications_module.ts"
    "password_reset_module.ts"
    "payments_module.ts"
    "signers_module.ts"
    "signatures_module.ts"
    "templates_module.ts"
    "users_module.ts"
)

for file in "${MAIN_FILES[@]}"; do
    if [ -f "$file" ]; then
        echo "✅ $file"
    else
        echo "❌ $file (faltante)"
    fi
done

echo ""
echo "🔨 Verificando sintaxis TypeScript..."

# Verificar sintaxis sin compilar
npx tsc --noEmit --skipLibCheck

if [ $? -eq 0 ]; then
    echo "✅ Sintaxis TypeScript correcta"
    echo ""
    echo "🔨 Compilando proyecto completo..."
    
    # Limpiar directorio dist
    rm -rf dist
    
    # Compilar
    npx tsc
    
    if [ $? -eq 0 ]; then
        echo "✅ Compilación exitosa"
        echo "📁 Archivos generados en ./dist/"
        ls -la dist/ | head -10
        echo ""
        echo "🎯 Proyecto listo para ejecutar:"
        echo "   node dist/app.js"
    else
        echo "❌ Error en compilación"
        exit 1
    fi
else
    echo "❌ Errores de sintaxis encontrados"
    echo ""
    echo "🔍 Verificando errores específicos por archivo..."
    
    # Verificar archivos individualmente
    for file in "${MAIN_FILES[@]}"; do
        if [ -f "$file" ]; then
            echo "Verificando $file..."
            npx tsc --noEmit --skipLibCheck "$file" 2>/dev/null
            if [ $? -eq 0 ]; then
                echo "  ✅ $file - OK"
            else
                echo "  ❌ $file - Errores encontrados"
                npx tsc --noEmit --skipLibCheck "$file"
            fi
        fi
    done
    
    exit 1
fi

echo ""
echo "🎉 Verificación completa exitosa!"