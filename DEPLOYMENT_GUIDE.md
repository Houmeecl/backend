# 🚀 GUÍA DE DESPLIEGUE - NOTARYPRO BACKEND

## 📋 PASOS PARA DESPLEGAR

### 1. CONFIGURAR VARIABLES DE DESPLIEGUE

Edita el archivo `deploy-enhanced.sh` y actualiza estas variables:

```bash
# Configuración del servidor
SERVER_HOST="tu-servidor.com"           # IP o dominio de tu servidor
SERVER_USER="tu-usuario"                # Usuario SSH (ej: root, ubuntu)
SERVER_PATH="/opt/notarypro-backend"    # Ruta en el servidor
SSH_KEY="~/.ssh/id_rsa"                 # Ruta de tu clave SSH
```

### 2. CONFIGURAR VARIABLES DE PRODUCCIÓN

Edita el archivo `env.production` y actualiza:

```bash
# Base de datos (ya configurada para Neon)
DB_USER=neondb_owner
DB_HOST=ep-dawn-night-ad9ixxns-pooler.c-2.us-east-1.aws.neon.tech
DB_NAME=neondb
DB_PASSWORD=npg_M2DXbHesGL7y

# Dominio
API_BASE_URL=https://tu-dominio.com

# Email
SMTP_USER=tu-email@gmail.com
SMTP_PASS=tu-app-password
```

### 3. PREPARAR EL SERVIDOR

En tu servidor, ejecuta:

```bash
# Instalar Node.js 18+
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Instalar PM2
sudo npm install -g pm2

# Instalar Nginx
sudo apt-get install -y nginx

# Instalar PostgreSQL client
sudo apt-get install -y postgresql-client
```

### 4. EJECUTAR DESPLIEGUE

```bash
# Dar permisos de ejecución
chmod +x deploy-enhanced.sh

# Ejecutar despliegue
./deploy-enhanced.sh
```

### 5. CONFIGURAR BASE DE DATOS

Conectarse a la base de datos y ejecutar:

```sql
-- Ejecutar en orden:
\i init_database.sql
\i saas_database.sql
\i api_tokens_database.sql
```

### 6. CREAR USUARIO ADMINISTRADOR

```bash
# Crear usuario SaaS administrador
curl -X POST https://tu-dominio.com/api/v1/saas/users \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@tuempresa.com",
    "password": "Admin123!",
    "name": "Administrador",
    "role": "admin",
    "api_quota": 10000
  }'
```

## 🌐 URLs DISPONIBLES DESPUÉS DEL DESPLIEGUE

- **API Principal:** `https://tu-dominio.com/api/v1`
- **Panel SaaS:** `https://tu-dominio.com/saas-panel`
- **Demo Básico:** `https://tu-dominio.com/demo-panel`
- **Demo Mejorado:** `https://tu-dominio.com/demo-enhanced`
- **Playground:** `https://tu-dominio.com/demo-playground`
- **Documentación:** `https://tu-dominio.com/docs`

## 🔧 COMANDOS ÚTILES

```bash
# Ver logs de la aplicación
pm2 logs notarypro-backend

# Reiniciar aplicación
pm2 restart notarypro-backend

# Ver estado de PM2
pm2 status

# Ver logs de Nginx
sudo tail -f /var/log/nginx/error.log
```

## 📞 SOPORTE

Si tienes problemas:

1. Verifica los logs: `pm2 logs notarypro-backend`
2. Verifica la conexión a la base de datos
3. Verifica que las variables de entorno estén correctas
4. Revisa los permisos de archivos en el servidor

## 🎯 DESPLIEGUE RÁPIDO

Para un despliegue rápido, solo necesitas:

1. **Configurar** las variables en `deploy-enhanced.sh`
2. **Ejecutar** `./deploy-enhanced.sh`
3. **Configurar** la base de datos
4. **Crear** usuario administrador

¡Y listo! Tu aplicación estará funcionando en producción.
