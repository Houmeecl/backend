# 🚀 **NOTARYPRO BACKEND - GUÍA DE DESPLIEGUE COMPLETO**

## 📋 **RESUMEN DEL DESPLIEGUE**

Esta guía te llevará paso a paso a través del despliegue completo de NotaryPro Backend con todas las mejoras implementadas:

- ✅ **Módulos SaaS y administración**
- ✅ **Sistema de API Tokens**
- ✅ **Módulo de Demo Mejorado con playground interactivo**
- ✅ **Panel de administración SaaS**
- ✅ **Paneles de demo mejorados**
- ✅ **Configuración de producción optimizada**
- ✅ **Monitoreo y alertas avanzadas**

---

## 🎯 **PREREQUISITOS**

### **1. Servidor en la Nube**
- **Ubuntu 20.04+** o **CentOS 8+**
- **2GB RAM** mínimo (4GB recomendado)
- **20GB** espacio en disco
- **Acceso SSH** configurado

### **2. Dominio Configurado**
- **DNS** apuntando al servidor
- **SSL/HTTPS** (Let's Encrypt recomendado)

### **3. Base de Datos**
- **PostgreSQL 12+** (Neon DB ya configurado)
- **Acceso desde el servidor**

---

## 🔧 **PASO 1: PREPARACIÓN DEL SERVIDOR**

### **1.1 Conectar al Servidor**
```bash
ssh tu-usuario@tu-servidor.com
```

### **1.2 Actualizar el Sistema**
```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl wget git unzip
```

### **1.3 Instalar Node.js 18+**
```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verificar instalación
node --version
npm --version
```

### **1.4 Instalar PM2**
```bash
sudo npm install -g pm2
pm2 startup
sudo env PATH=$PATH:/usr/bin /usr/lib/node_modules/pm2/bin/pm2 startup systemd -u $USER --hp $HOME
```

### **1.5 Instalar Nginx**
```bash
sudo apt install -y nginx
sudo systemctl enable nginx
sudo systemctl start nginx
```

### **1.6 Instalar PostgreSQL Client**
```bash
sudo apt install -y postgresql-client
```

---

## 📁 **PASO 2: PREPARACIÓN LOCAL**

### **2.1 Verificar Compilación**
```bash
# En tu máquina local
npm run build
```

### **2.2 Configurar Variables de Entorno**
```bash
# Copiar archivo de producción
cp env.production.enhanced .env.production

# Editar variables según tu servidor
nano .env.production
```

**Variables importantes a cambiar:**
```bash
# Servidor
HOST=tu-servidor.com
JWT_SECRET=tu-super-secret-key-aqui
EMAIL_USER=tu-email@gmail.com
EMAIL_PASS=tu-app-password

# Base de datos (ya configurado para Neon DB)
DATABASE_URL=postgres://neondb_owner:npg_M2DXbHesGL7y@ep-dawn-night-ad9ixxns-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require
```

### **2.3 Configurar Script de Despliegue**
```bash
# Editar deploy-enhanced.sh
nano deploy-enhanced.sh

# Cambiar estas variables:
SERVER_HOST="tu-servidor.com"
SERVER_USER="tu-usuario"
SERVER_PATH="/opt/notarypro-backend"
SSH_KEY="~/.ssh/id_rsa"
```

---

## 🚀 **PASO 3: DESPLIEGUE AUTOMÁTICO**

### **3.1 Ejecutar Script de Despliegue**
```bash
# Dar permisos de ejecución
chmod +x deploy-enhanced.sh

# Ejecutar despliegue
./deploy-enhanced.sh
```

**El script realizará automáticamente:**
- ✅ Compilación de la aplicación
- ✅ Verificación de módulos
- ✅ Preparación de archivos
- ✅ Sincronización al servidor
- ✅ Instalación de dependencias
- ✅ Configuración de PM2
- ✅ Configuración de Nginx
- ✅ Verificación del despliegue

---

## ⚙️ **PASO 4: CONFIGURACIÓN MANUAL (SI ES NECESARIO)**

### **4.1 Verificar Estado de PM2**
```bash
ssh tu-usuario@tu-servidor.com
cd /opt/notarypro-backend
pm2 status
pm2 logs notarypro-backend
```

### **4.2 Verificar Nginx**
```bash
sudo nginx -t
sudo systemctl status nginx
sudo systemctl reload nginx
```

### **4.3 Verificar Logs**
```bash
# Logs de la aplicación
tail -f logs/app.log
tail -f logs/error.log

# Logs de Nginx
sudo tail -f /var/log/nginx/notarypro_access.log
sudo tail -f /var/log/nginx/notarypro_error.log
```

---

## 🗄️ **PASO 5: CONFIGURACIÓN DE BASE DE DATOS**

### **5.1 Ejecutar Scripts SQL**
```bash
# Conectar a la base de datos
psql "postgres://neondb_owner:npg_M2DXbHesGL7y@ep-dawn-night-ad9ixxns-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require"

# Ejecutar scripts en orden:
\i init_database.sql
\i saas_database.sql
\i api_tokens_database.sql
```

### **5.2 Verificar Tablas Creadas**
```sql
-- Verificar tablas principales
\dt

-- Verificar tablas SaaS
\dt saas_*

-- Verificar tablas de API Tokens
\dt api_*

-- Verificar tablas de Demo
\dt demo_*
\dt api_simulations
\dt playground_sessions
\dt user_activity
```

---

## 👤 **PASO 6: CREAR USUARIO ADMINISTRADOR**

### **6.1 Crear Usuario SaaS Admin**
```bash
# Usar la API para crear usuario
curl -X POST https://tu-servidor.com/api/v1/saas/users \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@tu-servidor.com",
    "password": "Admin123!",
    "first_name": "Administrador",
    "last_name": "Sistema",
    "role": "admin",
    "subscription_plan": "enterprise"
  }'
```

### **6.2 Verificar Usuario Demo**
Los usuarios demo ya están creados automáticamente:

| Email | Password | Rol |
|-------|----------|-----|
| `admin@demo.com` | `admin123` | Admin |
| `vendedor@demo.com` | `vendedor123` | Seller |
| `developer@demo.com` | `developer123` | Developer |
| `sales@demo.com` | `sales123` | Sales Manager |
| `support@demo.com` | `support123` | Support |

---

## 🔍 **PASO 7: VERIFICACIÓN DEL DESPLIEGUE**

### **7.1 Verificar Endpoints Principales**
```bash
# Health check
curl https://tu-servidor.com/health

# API health
curl https://tu-servidor.com/api/v1/health

# Paneles frontend
curl -I https://tu-servidor.com/saas-panel
curl -I https://tu-servidor.com/demo-panel
curl -I https://tu-servidor.com/demo-enhanced
curl -I https://tu-servidor.com/demo-playground
```

### **7.2 Verificar Funcionalidades**
- ✅ **Panel SaaS**: https://tu-servidor.com/saas-panel
- ✅ **Panel Demo Básico**: https://tu-servidor.com/demo-panel
- ✅ **Panel Demo Mejorado**: https://tu-servidor.com/demo-enhanced
- ✅ **Playground Interactivo**: https://tu-servidor.com/demo-playground
- ✅ **API Completa**: https://tu-servidor.com/api/v1/

---

## 📊 **PASO 8: CONFIGURACIÓN DE MONITOREO**

### **8.1 Configurar PM2 Monitoring**
```bash
# Habilitar monitoreo PM2
pm2 install pm2-server-monit
pm2 install pm2-logrotate

# Configurar rotación de logs
pm2 set pm2-logrotate:max_size 20M
pm2 set pm2-logrotate:retain 5
pm2 set pm2-logrotate:compress true
```

### **8.2 Configurar Logrotate del Sistema**
```bash
sudo nano /etc/logrotate.d/notarypro

# Agregar configuración:
/opt/notarypro-backend/logs/*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    create 644 $USER $USER
    postrotate
        pm2 reloadLogs
    endscript
}
```

---

## 🔒 **PASO 9: CONFIGURACIÓN DE SEGURIDAD**

### **9.1 Configurar Firewall**
```bash
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

### **9.2 Configurar SSL con Let's Encrypt**
```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d tu-servidor.com -d www.tu-servidor.com
sudo certbot renew --dry-run
```

### **9.3 Configurar Headers de Seguridad**
```bash
# Verificar que nginx-enhanced.conf esté aplicado
sudo nginx -t
sudo systemctl reload nginx
```

---

## 📈 **PASO 10: OPTIMIZACIONES DE PRODUCCIÓN**

### **10.1 Configurar Cache**
```bash
# Instalar Redis (opcional)
sudo apt install -y redis-server
sudo systemctl enable redis-server
```

### **10.2 Configurar Compresión**
```bash
# Verificar que gzip esté habilitado en Nginx
sudo nginx -t
sudo systemctl reload nginx
```

### **10.3 Configurar Rate Limiting**
```bash
# Verificar configuración en nginx-enhanced.conf
# Los límites ya están configurados:
# - API general: 10 requests/segundo
# - Login: 5 requests/minuto
```

---

## 🚨 **PASO 11: CONFIGURACIÓN DE ALERTAS**

### **11.1 Configurar Alertas por Email**
```bash
# Editar env.production.enhanced
nano env.production.enhanced

# Configurar:
EMAIL_ALERTS_ENABLED=true
EMAIL_ALERTS_RECIPIENTS=admin@tu-servidor.com
```

### **11.2 Configurar Monitoreo de Recursos**
```bash
# Instalar herramientas de monitoreo
sudo apt install -y htop iotop nethogs

# Configurar alertas de disco
sudo apt install -y smartmontools
```

---

## 🔄 **PASO 12: MANTENIMIENTO Y ACTUALIZACIONES**

### **12.1 Scripts de Mantenimiento**
```bash
# Limpieza automática (configurada en PM2)
# Se ejecuta automáticamente los domingos a las 4 AM

# Limpieza manual
pm2 restart notarypro-backend
pm2 flush
pm2 reloadLogs
```

### **12.2 Actualizaciones de Seguridad**
```bash
# Actualizar sistema
sudo apt update && sudo apt upgrade -y

# Actualizar Node.js si es necesario
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
```

---

## 📚 **PASO 13: DOCUMENTACIÓN Y SOPORTE**

### **13.1 Acceso a Documentación**
- **README.md**: Documentación general
- **API_DOCUMENTATION.md**: Documentación de la API
- **SAAS_DOCUMENTATION.md**: Sistema SaaS
- **ENHANCED_FEATURES_DOCUMENTATION.md**: Características mejoradas
- **DOCUMENTATION_INDEX.md**: Índice completo

### **13.2 Logs y Debugging**
```bash
# Logs de la aplicación
tail -f logs/app.log

# Logs de PM2
pm2 logs notarypro-backend

# Logs de Nginx
sudo tail -f /var/log/nginx/notarypro_error.log

# Estado del sistema
pm2 status
pm2 monit
```

---

## 🎉 **¡DESPLIEGUE COMPLETADO!**

### **Resumen de URLs Disponibles:**
- 🌐 **Aplicación Principal**: https://tu-servidor.com
- 🎛️ **Panel SaaS**: https://tu-servidor.com/saas-panel
- 🎯 **Panel Demo**: https://tu-servidor.com/demo-panel
- 🚀 **Demo Mejorado**: https://tu-servidor.com/demo-enhanced
- 🎮 **Playground**: https://tu-servidor.com/demo-playground
- 📚 **API Docs**: https://tu-servidor.com/api/v1/docs

### **Comandos Útiles:**
```bash
# Ver estado
pm2 status

# Ver logs
pm2 logs notarypro-backend

# Reiniciar
pm2 restart notarypro-backend

# Monitoreo en tiempo real
pm2 monit

# Ver métricas
pm2 show notarypro-backend
```

### **Próximos Pasos Recomendados:**
1. 🔐 **Configurar SSL/HTTPS** si no está configurado
2. 📊 **Configurar monitoreo externo** (Sentry, DataDog, etc.)
3. 🔄 **Configurar backups automáticos** de base de datos
4. 📧 **Configurar notificaciones** por email/Slack
5. 🚀 **Configurar CI/CD** para despliegues automáticos

---

## 🆘 **SOLUCIÓN DE PROBLEMAS**

### **Problemas Comunes:**

#### **1. Aplicación no inicia**
```bash
# Verificar logs
pm2 logs notarypro-backend

# Verificar variables de entorno
cat .env

# Verificar base de datos
psql $DATABASE_URL -c "SELECT 1"
```

#### **2. Errores de permisos**
```bash
# Verificar permisos de archivos
ls -la /opt/notarypro-backend/

# Corregir permisos
sudo chown -R $USER:$USER /opt/notarypro-backend/
```

#### **3. Nginx no funciona**
```bash
# Verificar configuración
sudo nginx -t

# Verificar logs
sudo tail -f /var/log/nginx/error.log

# Reiniciar Nginx
sudo systemctl restart nginx
```

#### **4. Base de datos no conecta**
```bash
# Verificar conectividad
psql $DATABASE_URL -c "SELECT 1"

# Verificar variables de entorno
echo $DATABASE_URL

# Verificar firewall
sudo ufw status
```

---

## 📞 **SOPORTE Y CONTACTO**

### **Recursos de Ayuda:**
- 📚 **Documentación**: Todos los archivos .md en el proyecto
- 🐛 **Issues**: Crear issue en el repositorio
- 💬 **Discusiones**: Usar sección de discusiones del repo
- 📧 **Email**: admin@tu-servidor.com

### **Información del Sistema:**
- **Versión**: 2.3.0
- **Node.js**: 18.x+
- **Base de Datos**: PostgreSQL (Neon DB)
- **Proceso Manager**: PM2
- **Web Server**: Nginx
- **SSL**: Let's Encrypt (recomendado)

---

**¡Felicidades! 🎉 Has desplegado exitosamente NotaryPro Backend con todas las mejoras implementadas. El sistema está listo para producción y uso en el mundo real.**
