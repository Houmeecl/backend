# NotaryPro SaaS System Documentation

## 📋 **TABLA DE CONTENIDOS**

1. [Descripción General](#descripción-general)
2. [Arquitectura del Sistema](#arquitectura-del-sistema)
3. [Instalación y Configuración](#instalación-y-configuración)
4. [Base de Datos](#base-de-datos)
5. [API Endpoints](#api-endpoints)
6. [Sistema de Tokens](#sistema-de-tokens)
7. [Panel de Administración](#panel-de-administración)
8. [Roles y Permisos](#roles-y-permisos)
9. [Suscripciones y Planes](#suscripciones-y-planes)
10. [Analíticas y Métricas](#analíticas-y-métricas)
11. [Seguridad](#seguridad)
12. [Monitoreo](#monitoreo)
13. [Ejemplos de Uso](#ejemplos-de-uso)
14. [Troubleshooting](#troubleshooting)

---

## 🎯 **DESCRIPCIÓN GENERAL**

El **Sistema SaaS NotaryPro** es una plataforma completa de gestión de usuarios, roles, suscripciones y analíticas para la API de firma electrónica. Permite a los administradores gestionar usuarios, configurar roles y permisos, monitorear el uso de la API y administrar suscripciones de manera eficiente.

### **Características Principales**

- 🔐 **Gestión de Usuarios SaaS**: Creación, edición y administración de usuarios
- 🏷️ **Sistema de Roles**: Roles personalizables con permisos granulares
- 💳 **Gestión de Suscripciones**: Planes de pago con límites de API
- 📊 **Analíticas en Tiempo Real**: Métricas de uso y rendimiento
- 🔑 **Tokens API**: Sistema seguro de autenticación con rate limiting
- 📱 **Panel de Administración**: Interfaz web moderna y responsive
- 🚀 **Escalabilidad**: Arquitectura modular y escalable

---

## 🏗️ **ARQUITECTURA DEL SISTEMA**

### **Componentes Principales**

```
┌─────────────────────────────────────────────────────────────┐
│                    NOTARYPRO SAAS SYSTEM                   │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────┐ │
│  │   SaaS Admin    │  │   API Token     │  │   Core      │ │
│  │    Module      │  │    Module       │  │  Manager    │ │
│  └─────────────────┘  └─────────────────┘  └─────────────┘ │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────┐ │
│  │   PostgreSQL    │  │   Redis Cache   │  │   Frontend  │ │
│  │   Database     │  │   (Optional)    │  │    Panel    │ │
│  └─────────────────┘  └─────────────────┘  └─────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### **Flujo de Datos**

1. **Frontend Panel** → **SaaS Admin Module** → **Database**
2. **API Requests** → **API Token Module** → **Rate Limiting** → **Core Modules**
3. **Analytics** → **Database Views** → **Dashboard Charts**

---

## ⚙️ **INSTALACIÓN Y CONFIGURACIÓN**

### **Requisitos del Sistema**

- Node.js >= 18.0.0
- PostgreSQL >= 12.0
- npm >= 8.0.0

### **Paso 1: Instalar Dependencias**

```bash
npm install
```

### **Paso 2: Configurar Base de Datos**

```bash
# Ejecutar script de base de datos SaaS
psql -U <username> -d <database> -f saas_database.sql

# Ejecutar script de tokens API
psql -U <username> -d <database> -f api_tokens_database.sql
```

### **Paso 3: Configurar Variables de Entorno**

```env
# Base de Datos
DB_USER=neondb_owner
DB_HOST=ep-dawn-night-ad9ixxns-pooler.c-2.us-east-1.aws.neon.tech
DB_NAME=neondb
DB_PASSWORD=npg_M2DXbHesGL7y
DB_PORT=5432

# JWT
JWT_SECRET=notarypro_super_secret_jwt_key_2024

# API
API_BASE_URL=http://localhost:3000
NODE_ENV=development
PORT=3000
```

### **Paso 4: Compilar y Ejecutar**

```bash
# Compilar TypeScript
npm run build

# Ejecutar en desarrollo
npm run dev

# Ejecutar en producción
npm start
```

---

## 🗄️ **BASE DE DATOS**

### **Tablas Principales**

#### **1. saas_users**
```sql
CREATE TABLE saas_users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    company VARCHAR(255),
    subscription_plan VARCHAR(20) NOT NULL DEFAULT 'free',
    role VARCHAR(20) NOT NULL DEFAULT 'user',
    api_quota INTEGER NOT NULL DEFAULT 1000,
    api_usage INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true,
    last_login TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### **2. saas_roles**
```sql
CREATE TABLE saas_roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    permissions TEXT[] DEFAULT '{}',
    is_system BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### **3. api_tokens**
```sql
CREATE TABLE api_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    user_id UUID NOT NULL REFERENCES saas_users(id),
    token_hash VARCHAR(64) UNIQUE NOT NULL,
    permissions TEXT[] DEFAULT '{}',
    rate_limit_per_minute INTEGER NOT NULL DEFAULT 100,
    expires_at TIMESTAMP,
    is_active BOOLEAN NOT NULL DEFAULT true,
    last_used TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### **Vistas Útiles**

#### **user_stats**
```sql
SELECT 
    subscription_plan,
    COUNT(*) as user_count,
    COUNT(CASE WHEN is_active THEN 1 END) as active_users
FROM saas_users
GROUP BY subscription_plan;
```

#### **api_stats**
```sql
SELECT 
    DATE_TRUNC('day', timestamp) as date,
    COUNT(*) as total_requests,
    AVG(response_time) as avg_response_time
FROM api_usage 
GROUP BY DATE_TRUNC('day', timestamp)
ORDER BY date DESC;
```

---

## 🌐 **API ENDPOINTS**

### **Base URL**
```
http://localhost:3000/api/v1
```

### **Autenticación**
```http
Authorization: Bearer <jwt_token>
```

### **1. Dashboard SaaS**

#### **GET /saas/dashboard**
Obtiene estadísticas generales del sistema.

**Response:**
```json
{
  "success": true,
  "data": {
    "total_users": 150,
    "active_subscriptions": 120,
    "api_requests_today": 2500,
    "revenue_month": 4500000
  },
  "message": "Dashboard SaaS cargado exitosamente"
}
```

### **2. Gestión de Usuarios**

#### **GET /saas/users**
Lista usuarios con filtros opcionales.

**Query Parameters:**
- `role`: Filtro por rol
- `plan`: Filtro por plan de suscripción
- `active`: Filtro por estado activo

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid-here",
      "email": "user@example.com",
      "first_name": "John",
      "last_name": "Doe",
      "subscription_plan": "premium",
      "role": "user",
      "is_active": true,
      "api_quota": 10000,
      "api_usage": 2500
    }
  ]
}
```

#### **POST /saas/users**
Crea un nuevo usuario SaaS.

**Request Body:**
```json
{
  "email": "newuser@example.com",
  "password": "securepassword123",
  "first_name": "Jane",
  "last_name": "Smith",
  "company": "Tech Corp",
  "subscription_plan": "basic",
  "role": "user",
  "api_quota": 5000
}
```

#### **PUT /saas/users/:id**
Actualiza un usuario existente.

#### **DELETE /saas/users/:id**
Desactiva un usuario (soft delete).

### **3. Gestión de Roles**

#### **GET /saas/roles**
Lista todos los roles disponibles.

#### **POST /saas/roles**
Crea un nuevo rol personalizado.

**Request Body:**
```json
{
  "name": "content_manager",
  "description": "Rol para gestión de contenido",
  "permissions": [
    "documents:read",
    "documents:create",
    "templates:read",
    "templates:update"
  ]
}
```

### **4. Analíticas**

#### **GET /saas/analytics**
Obtiene métricas de uso de la API.

**Query Parameters:**
- `range`: Rango de tiempo (7d, 30d, 90d, 1y)

**Response:**
```json
{
  "success": true,
  "data": {
    "api_usage": [
      {
        "date": "2024-01-01",
        "total_requests": 1500,
        "avg_response_time": 125.5,
        "error_count": 25
      }
    ],
    "time_range": "30d"
  }
}
```

---

## 🔑 **SISTEMA DE TOKENS**

### **Crear Token API**

#### **POST /api-tokens**
```json
{
  "name": "Production API Token",
  "description": "Token para aplicación de producción",
  "user_id": "user-uuid-here",
  "permissions": ["documents:read", "templates:read"],
  "rate_limit_per_minute": 500,
  "expires_at": "2024-12-31T23:59:59Z"
}
```

### **Validar Token**

```typescript
import { ApiTokenModule } from './api_token_module';

const tokenModule = new ApiTokenModule(database);
const validation = await tokenModule.validateApiToken(
  token, 
  '/api/documents', 
  'GET'
);

if (validation.valid) {
  // Token válido, proceder con la request
  const userId = validation.user_id;
  const permissions = validation.permissions;
} else if (validation.rate_limit_exceeded) {
  // Rate limit excedido
  res.status(429).json({ error: 'Rate limit exceeded' });
} else {
  // Token inválido
  res.status(401).json({ error: 'Invalid token' });
}
```

### **Rate Limiting**

El sistema implementa rate limiting por token:

- **Free Plan**: 100 requests/minuto
- **Basic Plan**: 500 requests/minuto
- **Premium Plan**: 2000 requests/minuto
- **Enterprise Plan**: 10000 requests/minuto

### **Seguridad de Tokens**

- Los tokens se almacenan como hashes SHA-256
- Expiración automática configurable
- Revocación inmediata disponible
- Monitoreo de uso y detección de anomalías

---

## 📱 **PANEL DE ADMINISTRACIÓN**

### **Acceso al Panel**

1. Abrir `saas-panel.html` en el navegador
2. El panel se conecta automáticamente a la API local
3. Usar credenciales de administrador para acceso completo

### **Funcionalidades del Panel**

#### **Dashboard Principal**
- Estadísticas en tiempo real
- Gráficos de uso de API
- Distribución de planes de suscripción
- Métricas de rendimiento

#### **Gestión de Usuarios**
- Lista de usuarios con filtros
- Crear nuevos usuarios
- Editar perfiles existentes
- Activar/desactivar usuarios

#### **Gestión de Roles**
- Lista de roles del sistema
- Crear roles personalizados
- Asignar permisos específicos
- Editar roles existentes

#### **Analíticas**
- Uso de API por endpoint
- Tiempo de respuesta promedio
- Errores y códigos de estado
- Métricas por rango de tiempo

### **Personalización del Panel**

El panel está construido con:
- **Tailwind CSS** para estilos
- **Chart.js** para gráficos
- **Font Awesome** para iconos
- **JavaScript ES6+** para funcionalidad

---

## 👥 **ROLES Y PERMISOS**

### **Roles del Sistema**

#### **1. Admin**
- Acceso completo a todas las funcionalidades
- Gestión de usuarios y roles
- Configuración del sistema
- Analíticas y reportes

#### **2. Manager**
- Gestión de usuarios
- Visualización de analíticas
- Gestión de facturación
- Reportes de uso

#### **3. User**
- Acceso básico a la API
- Gestión de su propio perfil
- Visualización de uso personal

### **Permisos Granulares**

```typescript
const PERMISSIONS = {
  // Usuarios
  'users:read': 'Leer información de usuarios',
  'users:create': 'Crear nuevos usuarios',
  'users:update': 'Actualizar usuarios',
  'users:delete': 'Eliminar usuarios',
  
  // Documentos
  'documents:read': 'Leer documentos',
  'documents:create': 'Crear documentos',
  'documents:update': 'Actualizar documentos',
  'documents:delete': 'Eliminar documentos',
  
  // Plantillas
  'templates:read': 'Leer plantillas',
  'templates:create': 'Crear plantillas',
  'templates:update': 'Actualizar plantillas',
  'templates:delete': 'Eliminar plantillas',
  
  // Analíticas
  'analytics:read': 'Ver analíticas',
  'analytics:export': 'Exportar reportes',
  
  // SaaS
  'saas:admin': 'Administración completa del sistema SaaS',
  'saas:users_manage': 'Gestión de usuarios SaaS',
  'saas:roles_manage': 'Gestión de roles SaaS',
  'saas:analytics_view': 'Ver analíticas SaaS'
};
```

---

## 💳 **SUSCRIPCIONES Y PLANES**

### **Planes Disponibles**

#### **Free Plan**
- **Precio**: $0 CLP
- **API Quota**: 100 requests/mes
- **Características**: Funcionalidades básicas
- **Soporte**: Comunidad

#### **Basic Plan**
- **Precio**: $15,000 CLP/mes
- **API Quota**: 1,000 requests/mes
- **Características**: Funcionalidades completas
- **Soporte**: Email

#### **Premium Plan**
- **Precio**: $45,000 CLP/mes
- **API Quota**: 10,000 requests/mes
- **Características**: Todas las funcionalidades + analíticas
- **Soporte**: Email + Chat

#### **Enterprise Plan**
- **Precio**: $150,000 CLP/mes
- **API Quota**: 100,000 requests/mes
- **Características**: Personalización completa + soporte dedicado
- **Soporte**: Dedicado 24/7

### **Gestión de Suscripciones**

```sql
-- Crear nueva suscripción
INSERT INTO saas_subscriptions (
    user_id, plan_name, start_date, end_date, price, currency, status
) VALUES (
    'user-uuid', 'premium', '2024-01-01', '2024-02-01', 45000, 'CLP', 'active'
);

-- Verificar suscripción activa
SELECT * FROM saas_subscriptions 
WHERE user_id = 'user-uuid' 
AND status = 'active' 
AND end_date > CURRENT_TIMESTAMP;
```

---

## 📊 **ANALÍTICAS Y MÉTRICAS**

### **Métricas Disponibles**

#### **1. Uso de API**
- Total de requests por día/mes
- Requests por endpoint
- Tiempo de respuesta promedio
- Códigos de estado HTTP

#### **2. Usuarios**
- Usuarios activos vs inactivos
- Distribución por plan de suscripción
- Crecimiento de usuarios
- Retención mensual

#### **3. Rendimiento**
- Uso de recursos del servidor
- Latencia de base de datos
- Tiempo de respuesta por endpoint
- Errores y excepciones

#### **4. Negocio**
- Ingresos mensuales
- Conversión de planes
- Churn rate
- LTV por usuario

### **Vistas de Base de Datos**

```sql
-- Estadísticas de usuarios por plan
SELECT * FROM user_stats;

-- Uso de API por día
SELECT * FROM api_stats;

-- Facturación mensual
SELECT * FROM monthly_billing;

-- Estado de rate limiting
SELECT * FROM rate_limit_status;
```

---

## 🔒 **SEGURIDAD**

### **Medidas de Seguridad**

#### **1. Autenticación**
- JWT tokens seguros
- Expiración configurable
- Refresh tokens opcionales
- Rate limiting por usuario

#### **2. Autorización**
- Permisos granulares por rol
- Validación de endpoints
- Auditoría de acciones
- Control de acceso basado en roles (RBAC)

#### **3. Protección de Datos**
- Contraseñas hasheadas con bcrypt
- Tokens API hasheados
- Encriptación de datos sensibles
- Logs de auditoría completos

#### **4. Seguridad de la API**
- Validación de entrada con Zod
- Sanitización de datos
- Protección contra SQL injection
- Headers de seguridad HTTP

### **Configuración de Seguridad**

```typescript
// Middleware de seguridad
app.use(helmet()); // Headers de seguridad
app.use(cors({
  origin: process.env.CORS_ORIGIN,
  credentials: true
}));
app.use(rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100 // máximo 100 requests por ventana
}));
```

---

## 📈 **MONITOREO**

### **Health Checks**

#### **Endpoint de Salud**
```http
GET /health
```

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "version": "2.2.0",
  "environment": "production",
  "services": {
    "database": "connected",
    "saas_module": "healthy",
    "api_tokens": "healthy"
  }
}
```

### **Logs del Sistema**

#### **Tipos de Logs**
- **Application Logs**: Operaciones de la aplicación
- **Access Logs**: Accesos a la API
- **Error Logs**: Errores y excepciones
- **Audit Logs**: Acciones de usuarios

#### **Configuración de Logs**
```typescript
import winston from 'winston';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' })
  ]
});
```

### **Alertas y Notificaciones**

#### **Condiciones de Alerta**
- Rate limit excedido
- Tokens expirados
- Errores de base de datos
- Uso alto de recursos

#### **Canales de Notificación**
- Email
- Slack
- Webhooks personalizados
- SMS (opcional)

---

## 💻 **EJEMPLOS DE USO**

### **1. Crear Usuario SaaS**

```typescript
// Frontend JavaScript
const createUser = async (userData) => {
  const response = await fetch('/api/v1/saas/users', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`
    },
    body: JSON.stringify(userData)
  });
  
  return response.json();
};

// Uso
const newUser = await createUser({
  email: 'developer@company.com',
  password: 'securepass123',
  first_name: 'John',
  last_name: 'Developer',
  subscription_plan: 'premium',
  role: 'user',
  api_quota: 10000
});
```

### **2. Crear Token API**

```typescript
const createApiToken = async (tokenData) => {
  const response = await fetch('/api/v1/api-tokens', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`
    },
    body: JSON.stringify(tokenData)
  });
  
  return response.json();
};

// Uso
const token = await createApiToken({
  name: 'Production App Token',
  description: 'Token para aplicación de producción',
  user_id: 'user-uuid',
  permissions: ['documents:read', 'templates:read'],
  rate_limit_per_minute: 1000
});
```

### **3. Usar Token API**

```typescript
// Cliente usando token API
const apiRequest = async (endpoint, options = {}) => {
  const response = await fetch(`/api/v1${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'X-API-Token': 'your-api-token-here',
      ...options.headers
    }
  });
  
  return response.json();
};

// Ejemplo de uso
const documents = await apiRequest('/documents', {
  method: 'GET'
});
```

### **4. Panel de Administración**

```html
<!-- Ejemplo de integración del panel -->
<div id="saas-dashboard">
  <div class="stats-grid">
    <div class="stat-card">
      <h3>Total Usuarios</h3>
      <p id="total-users">0</p>
    </div>
    <div class="stat-card">
      <h3>API Requests Hoy</h3>
      <p id="api-requests">0</p>
    </div>
  </div>
  
  <div class="charts-container">
    <canvas id="usage-chart"></canvas>
    <canvas id="plans-chart"></canvas>
  </div>
</div>

<script>
  // Cargar dashboard
  loadDashboard();
  
  // Actualizar cada 30 segundos
  setInterval(loadDashboard, 30000);
</script>
```

---

## 🚨 **TROUBLESHOOTING**

### **Problemas Comunes**

#### **1. Error de Conexión a Base de Datos**
```bash
Error: SASL: SCRAM-SERVER-FIRST-MESSAGE: client password must be a string
```

**Solución:**
- Verificar variables de entorno
- Asegurar que `.env.local` esté configurado correctamente
- Verificar credenciales de Neon DB

#### **2. Módulo SaaS No Inicializa**
```bash
Error inicializando módulo SaasAdminModule
```

**Solución:**
- Verificar que `saas_admin_module.ts` esté en el directorio correcto
- Asegurar que todas las dependencias estén instaladas
- Verificar la configuración de la base de datos

#### **3. Panel No Carga Datos**
```bash
Error loading dashboard: Failed to fetch
```

**Solución:**
- Verificar que la API esté ejecutándose
- Comprobar la URL de la API en el panel
- Verificar CORS y headers de autorización

#### **4. Error de Permisos**
```bash
Error: Permission denied for operation
```

**Solución:**
- Verificar que el usuario tenga el rol correcto
- Comprobar permisos asignados al rol
- Verificar que el token JWT sea válido

### **Logs de Debug**

#### **Habilitar Logs Detallados**
```typescript
// En el módulo SaaS
console.log('🔍 Debug:', {
  userData,
  validationResult,
  databaseResult
});
```

#### **Verificar Estado de Módulos**
```typescript
// Verificar salud de todos los módulos
for (const [name, module] of this.modules) {
  const health = await module.getHealth();
  console.log(`📊 ${name}:`, health);
}
```

### **Comandos de Verificación**

```bash
# Verificar estado de la base de datos
psql "postgres://user:pass@host:port/db" -c "SELECT version();"

# Verificar tablas SaaS
psql "postgres://user:pass@host:port/db" -c "\dt saas_*"

# Verificar usuarios del sistema
psql "postgres://user:pass@host:port/db" -c "SELECT * FROM saas_users;"

# Verificar logs de la aplicación
tail -f logs/app.log

# Verificar estado de PM2
pm2 status
pm2 logs notarypro-backend
```

---

## 📚 **RECURSOS ADICIONALES**

### **Documentación Relacionada**
- [README.md](./README.md) - Documentación general del proyecto
- [API_DOCUMENTATION.md](./API_DOCUMENTATION.md) - Documentación de la API
- [DEPLOYMENT.md](./DEPLOYMENT.md) - Guía de despliegue

### **Enlaces Útiles**
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [Node.js Documentation](https://nodejs.org/docs/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)

### **Soporte**
- **Email**: support@notarypro.com
- **Documentación**: docs.notarypro.com
- **GitHub Issues**: github.com/notarypro/backend/issues

---

## 📝 **CHANGELOG**

### **Versión 1.0.0** (2024-01-01)
- ✅ Sistema SaaS completo implementado
- ✅ Gestión de usuarios y roles
- ✅ Sistema de tokens API
- ✅ Panel de administración
- ✅ Analíticas y métricas
- ✅ Base de datos optimizada
- ✅ Documentación completa

---

**© 2024 NotaryPro. Todos los derechos reservados.**
