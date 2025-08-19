# 🚀 Guía de Despliegue - NotaryPro Backend

## 📋 Prerrequisitos

### En tu máquina local:
- Node.js 18+ y npm
- Git configurado
- Clave SSH configurada para el servidor

### En el servidor:
- Ubuntu 20.04+ o similar
- Node.js 18+ y npm
- PM2 instalado globalmente
- Nginx configurado
- Usuario con permisos sudo

## 🔧 Configuración del Servidor

### 1. Conectar al servidor
```bash
ssh usuario@tu-servidor-ip.com
```

### 2. Instalar dependencias del sistema
```bash
sudo apt update
sudo apt install -y nodejs npm git nginx
sudo npm install -g pm2
```

### 3. Crear directorio de la aplicación
```bash
sudo mkdir -p /var/www/notarypro-backend
sudo chown $USER:$USER /var/www/notarypro-backend
cd /var/www/notarypro-backend
```

## 📤 Despliegue desde Local

### Opción 1: Despliegue Manual

1. **Compilar la aplicación localmente:**
```bash
npm run build
```

2. **Sincronizar archivos al servidor:**
```bash
rsync -avz --progress \
    --exclude 'node_modules' \
    --exclude '.git' \
    --exclude 'dist' \
    --exclude 'uploads' \
    --exclude 'temp' \
    --exclude 'logs' \
    --exclude '*.log' \
    --exclude '.env.local' \
    --exclude 'env.example' \
    --exclude '*.md' \
    --exclude '*.sql' \
    --exclude '*.sh' \
    --exclude '*.yaml' \
    --exclude '*.conf' \
    --exclude 'check-typescript.sh' \
    --exclude 'deploy-config.js' \
    ./ usuario@tu-servidor:/var/www/notarypro-backend/
```

3. **Copiar archivo de entorno:**
```bash
scp .env.production usuario@tu-servidor:/var/www/notarypro-backend/.env
```

### Opción 2: Despliegue con Git

1. **En el servidor, clonar el repositorio:**
```bash
cd /var/www/notarypro-backend
git clone https://github.com/tu-usuario/notarypro-backend.git .
```

2. **Configurar archivo de entorno:**
```bash
cp .env.production .env
# Editar .env con las credenciales correctas
nano .env
```

## 🚀 Instalación en el Servidor

### 1. Instalar dependencias
```bash
cd /var/www/notarypro-backend
npm install --production
npm run build
```

### 2. Crear directorios necesarios
```bash
mkdir -p uploads temp logs
chmod 755 uploads temp logs
```

### 3. Configurar PM2
```bash
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

### 4. Verificar que la aplicación esté funcionando
```bash
pm2 status
pm2 logs notarypro-backend
```

## 🌐 Configuración de Nginx

### 1. Crear configuración de Nginx
```bash
sudo nano /etc/nginx/sites-available/notarypro-backend
```

### 2. Agregar configuración:
```nginx
server {
    listen 80;
    server_name tu-dominio.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    location /uploads {
        alias /var/www/notarypro-backend/uploads;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }
}
```

### 3. Habilitar el sitio
```bash
sudo ln -s /etc/nginx/sites-available/notarypro-backend /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

## 🔒 Configuración de SSL (Opcional)

### 1. Instalar Certbot
```bash
sudo apt install certbot python3-certbot-nginx
```

### 2. Obtener certificado SSL
```bash
sudo certbot --nginx -d tu-dominio.com
```

## 📊 Monitoreo y Logs

### Ver logs de la aplicación
```bash
pm2 logs notarypro-backend
pm2 logs notarypro-backend --err
pm2 logs notarypro-backend --out
```

### Ver logs de Nginx
```bash
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

### Ver logs del sistema
```bash
sudo journalctl -u nginx -f
sudo journalctl -u pm2-root -f
```

## 🔄 Actualizaciones

### 1. Detener la aplicación
```bash
pm2 stop notarypro-backend
```

### 2. Hacer backup
```bash
cp -r /var/www/notarypro-backend /var/www/notarypro-backend.backup.$(date +%Y%m%d_%H%M%S)
```

### 3. Sincronizar nuevos archivos
```bash
# Desde tu máquina local
rsync -avz --progress ./ usuario@tu-servidor:/var/www/notarypro-backend/
```

### 4. Reiniciar la aplicación
```bash
cd /var/www/notarypro-backend
npm install --production
npm run build
pm2 restart notarypro-backend
```

## 🚨 Solución de Problemas

### La aplicación no inicia
```bash
# Verificar logs
pm2 logs notarypro-backend

# Verificar variables de entorno
cat .env

# Verificar puerto
netstat -tlnp | grep :3000
```

### Error de base de datos
```bash
# Verificar conexión
psql "postgres://usuario:password@host:puerto/database"

# Verificar variables de entorno
echo $DB_HOST
echo $DB_USER
echo $DB_NAME
```

### Error de permisos
```bash
# Verificar permisos de directorios
ls -la /var/www/notarypro-backend/

# Corregir permisos
sudo chown -R $USER:$USER /var/www/notarypro-backend/
chmod -R 755 /var/www/notarypro-backend/
```

## 📱 Verificación del Despliegue

### 1. Health Check
```bash
curl http://tu-servidor:3000/health
```

### 2. Información del servidor
```bash
curl http://tu-servidor:3000/info
```

### 3. Verificar PM2
```bash
pm2 status
pm2 monit
```

## 🔐 Variables de Entorno Críticas

Asegúrate de configurar estas variables en tu archivo `.env`:

```bash
# Base de datos
DB_USER=tu_usuario_db
DB_HOST=tu_host_db
DB_NAME=tu_nombre_db
DB_PASSWORD=tu_password_db
DB_PORT=5432

# JWT
JWT_SECRET=tu_jwt_secret_muy_largo_y_seguro

# API
API_BASE_URL=https://tu-dominio.com
NODE_ENV=production
PORT=3000

# Archivos
UPLOAD_DIR=/var/www/notarypro-backend/uploads

# Seguridad
API_KEY=tu_api_key_segura
```

## 📞 Soporte

Si encuentras problemas durante el despliegue:

1. Verifica los logs de la aplicación y del sistema
2. Confirma que todas las variables de entorno estén configuradas
3. Verifica que los puertos estén abiertos y accesibles
4. Confirma que la base de datos esté accesible desde el servidor

---

**¡Despliegue exitoso! 🎉**

Tu API de NotaryPro Backend debería estar funcionando en:
- **Local**: http://tu-servidor:3000
- **Nginx**: http://tu-dominio.com
- **Health Check**: http://tu-dominio.com/health
