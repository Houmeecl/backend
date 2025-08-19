# 🚀 GUÍA DE DESPLIEGUE EN VPS - NOTARYPRO BACKEND

## 📋 Resumen del Despliegue

Este documento describe el proceso completo para desplegar NotaryPro Backend en tu VPS (170.239.86.119:22222).

## 🔧 Requisitos Previos

- Acceso SSH al VPS como root
- Puerto 3000 abierto en el firewall
- Conexión a internet para descargar dependencias

## 📁 Archivos de Configuración Creados

### 1. `env.vps` - Variables de Entorno del VPS
- Configuración de base de datos Neon
- Configuración de producción
- **DEBUG=true** para desarrollo
- **ENABLE_SWAGGER=true** para documentación

### 2. `ecosystem-vps.config.js` - Configuración de PM2
- Gestión de procesos con PM2
- Logs centralizados
- Reinicio automático en caso de fallo

### 3. `deploy-vps.sh` - Script de Despliegue
- Instalación automática de dependencias
- Configuración del sistema
- Despliegue completo

## 🚀 Pasos para el Despliegue

### Paso 1: Conectar al VPS
```bash
ssh root@170.239.86.119 -p22222
```

### Paso 2: Navegar al Directorio del Proyecto
```bash
cd /var/www/notarypro-backend
```

### Paso 3: Copiar Configuración del VPS
```bash
cp env.vps .env
```

### Paso 4: Ejecutar Script de Despliegue
```bash
bash deploy-vps.sh
```

## 📦 Dependencias que se Instalan

- **Node.js 18.x** - Runtime de JavaScript
- **npm** - Gestor de paquetes
- **PM2** - Gestor de procesos
- **Git** - Control de versiones
- **Build tools** - Compiladores necesarios

## ⚙️ Configuración Específica del VPS

### Variables de Entorno Clave
```bash
NODE_ENV=production
PORT=3000
DEBUG=true
ENABLE_SWAGGER=true
API_BASE_URL=http://170.239.86.119:3000
```

### Base de Datos
- **Host**: ep-dawn-night-ad9ixxns-pooler.c-2.us-east-1.aws.neon.tech
- **Base de datos**: neondb
- **Usuario**: neondb_owner

## 🔍 Verificación del Despliegue

### 1. Verificar Estado de PM2
```bash
pm2 status
```

### 2. Ver Logs de la Aplicación
```bash
pm2 logs notarypro-backend
```

### 3. Probar Endpoint de Salud
```bash
curl http://170.239.86.119:3000/health
```

### 4. Acceder a Swagger UI
```
http://170.239.86.119:3000/api-docs
```

## 📊 Monitoreo y Logs

### Logs de la Aplicación
- **Ubicación**: `/var/log/notarypro-backend/`
- **Archivos**: `app.log`, `err.log`, `out.log`, `combined.log`

### Comandos de Monitoreo
```bash
# Ver estado de PM2
pm2 status

# Ver logs en tiempo real
pm2 logs notarypro-backend --lines 100

# Ver uso de recursos
pm2 monit

# Reiniciar aplicación
pm2 restart notarypro-backend
```

## 🛠️ Comandos de Mantenimiento

### Actualizar Código
```bash
cd /var/www/notarypro-backend
git pull
npm install
npm run build
pm2 restart notarypro-backend
```

### Reiniciar Servicios
```bash
# Reiniciar solo la aplicación
pm2 restart notarypro-backend

# Reiniciar todo PM2
pm2 restart all

# Reiniciar sistema
pm2 startup
```

### Verificar Puerto
```bash
# Verificar si el puerto 3000 está en uso
netstat -tlnp | grep :3000

# Verificar procesos de Node.js
ps aux | grep node
```

## 🔒 Seguridad

### Firewall
```bash
# Abrir puerto 3000
ufw allow 3000

# Verificar estado del firewall
ufw status
```

### Variables Sensibles
- **JWT_SECRET**: Cambiar en producción
- **API_KEY**: Configurar clave segura
- **DB_PASSWORD**: Ya configurada para Neon

## 🚨 Solución de Problemas

### Error: "npm: command not found"
```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt install -y nodejs npm
```

### Error: "pm2: command not found"
```bash
npm install -g pm2
```

### Error: "Permission denied"
```bash
chmod +x deploy-vps.sh
chown -R root:root /var/www/notarypro-backend
```

### Error: "Port already in use"
```bash
# Ver qué proceso usa el puerto
lsof -i :3000

# Matar proceso si es necesario
kill -9 <PID>
```

## 📞 Soporte

Si encuentras problemas durante el despliegue:

1. Verificar logs: `pm2 logs notarypro-backend`
2. Verificar estado: `pm2 status`
3. Verificar configuración: `cat .env`
4. Verificar puertos: `netstat -tlnp`

## ✅ Checklist de Despliegue

- [ ] Conexión SSH establecida
- [ ] Archivo `env.vps` copiado como `.env`
- [ ] Script de despliegue ejecutado
- [ ] Node.js y npm instalados
- [ ] PM2 instalado y configurado
- [ ] Aplicación construida y ejecutándose
- [ ] Puerto 3000 accesible
- [ ] Swagger UI funcionando
- [ ] Logs configurados correctamente

---

**🎯 Objetivo**: Tener NotaryPro Backend funcionando en producción en el VPS con modo debug habilitado para desarrollo y testing.
