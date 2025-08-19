# NotaryPro API Documentation

## 📋 **TABLA DE CONTENIDOS**
1. [Información General](#información-general)
2. [Autenticación](#autenticación)
3. [Endpoints Principales](#endpoints-principales)
4. [Endpoints SaaS](#endpoints-saas)
5. [Endpoints API Tokens](#endpoints-api-tokens)
6. [Códigos de Estado HTTP](#códigos-de-estado-http)
7. [Manejo de Errores](#manejo-de-errores)
8. [Rate Limiting](#rate-limiting)
9. [Paginación](#paginación)
10. [Ejemplos de Uso](#ejemplos-de-uso)

## 🌐 **INFORMACIÓN GENERAL**

**Base URL**: `http://localhost:3000/api/v1`  
**Versión**: 2.2.0  
**Formato**: JSON  
**Encoding**: UTF-8  

### Headers Requeridos
```http
Content-Type: application/json
Authorization: Bearer <token>
```

## 🔐 **AUTENTICACIÓN**

### Login de Usuario
```http
POST /api/v1/auth/login
```

**Body:**
```json
{
  "email": "usuario@ejemplo.com",
  "password": "contraseña123"
}
```

**Respuesta Exitosa:**
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "uuid",
      "email": "usuario@ejemplo.com",
      "role": "user",
      "permissions": ["documents:read", "documents:create"]
    }
  }
}
```

### Login SaaS Admin
```http
POST /api/v1/saas/login
```

**Body:**
```json
{
  "email": "admin@notarypro.com",
  "password": "admin123"
}
```

## 📚 **ENDPOINTS PRINCIPALES**

### Health Check
```http
GET /api/v1/health
```

### Usuarios
```http
GET    /api/v1/users
POST   /api/v1/users
GET    /api/v1/users/:id
PUT    /api/v1/users/:id
DELETE /api/v1/users/:id
```

### Documentos
```http
GET    /api/v1/documents
POST   /api/v1/documents
GET    /api/v1/documents/:id
PUT    /api/v1/documents/:id
DELETE /api/v1/documents/:id
```

### Plantillas
```http
GET    /api/v1/templates
POST   /api/v1/templates
GET    /api/v1/templates/:id
PUT    /api/v1/templates/:id
DELETE /api/v1/templates/:id
```

### Firmas
```http
GET    /api/v1/signatures
POST   /api/v1/signatures
GET    /api/v1/signatures/:id
PUT    /api/v1/signatures/:id
DELETE /api/v1/signatures/:id
```

### Verificaciones
```http
POST   /api/v1/verifications/initiate
GET    /api/v1/verifications/:id
POST   /api/v1/verifications/:id/complete
GET    /api/v1/verifications/status/:documentId
```

## 🏢 **ENDPOINTS SAAS**

### Gestión de Usuarios SaaS
```http
GET    /api/v1/saas/users
POST   /api/v1/saas/users
GET    /api/v1/saas/users/:id
PUT    /api/v1/saas/users/:id
DELETE /api/v1/saas/users/:id
```

### Gestión de Roles
```http
GET    /api/v1/saas/roles
POST   /api/v1/saas/roles
GET    /api/v1/saas/roles/:id
PUT    /api/v1/saas/roles/:id
DELETE /api/v1/saas/roles/:id
```

### Suscripciones
```http
GET    /api/v1/saas/subscriptions
POST   /api/v1/saas/subscriptions
GET    /api/v1/saas/subscriptions/:id
PUT    /api/v1/saas/subscriptions/:id
DELETE /api/v1/saas/subscriptions/:id
```

### Analytics
```http
GET /api/v1/saas/analytics/dashboard
GET /api/v1/saas/analytics/users
GET /api/v1/saas/analytics/usage
GET /api/v1/saas/analytics/revenue
```

## 🔑 **ENDPOINTS API TOKENS**

### Gestión de Tokens
```http
GET    /api/v1/tokens
POST   /api/v1/tokens
GET    /api/v1/tokens/:id
PUT    /api/v1/tokens/:id
DELETE /api/v1/tokens/:id
POST   /api/v1/tokens/:id/regenerate
```

### Validación de Token
```http
POST /api/v1/tokens/validate
```

**Body:**
```json
{
  "token": "api_token_here",
  "endpoint": "/api/v1/documents",
  "method": "GET"
}
```

## 📊 **CÓDIGOS DE ESTADO HTTP**

| Código | Descripción |
|--------|-------------|
| 200 | OK - Solicitud exitosa |
| 201 | Created - Recurso creado |
| 400 | Bad Request - Datos inválidos |
| 401 | Unauthorized - No autenticado |
| 403 | Forbidden - Sin permisos |
| 404 | Not Found - Recurso no encontrado |
| 429 | Too Many Requests - Rate limit excedido |
| 500 | Internal Server Error - Error del servidor |

## ❌ **MANEJO DE ERRORES**

### Formato de Error
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Datos de entrada inválidos",
    "details": [
      "El campo 'email' es requerido",
      "El campo 'password' debe tener al menos 8 caracteres"
    ]
  }
}
```

### Códigos de Error Comunes
- `VALIDATION_ERROR`: Error de validación de datos
- `AUTHENTICATION_ERROR`: Error de autenticación
- `AUTHORIZATION_ERROR`: Error de autorización
- `NOT_FOUND`: Recurso no encontrado
- `RATE_LIMIT_EXCEEDED`: Límite de tasa excedido
- `INTERNAL_ERROR`: Error interno del servidor

## ⏱️ **RATE LIMITING**

- **Usuarios autenticados**: 1000 requests/hora
- **API Tokens**: 5000 requests/hora
- **Endpoints públicos**: 100 requests/hora

### Headers de Rate Limiting
```http
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1640995200
```

## 📄 **PAGINACIÓN**

### Parámetros de Paginación
```http
GET /api/v1/documents?page=1&limit=20&sort=created_at&order=desc
```

### Respuesta Paginada
```json
{
  "success": true,
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "pages": 8,
    "hasNext": true,
    "hasPrev": false
  }
}
```

## 💡 **EJEMPLOS DE USO**

### Crear un Documento
```bash
curl -X POST http://localhost:3000/api/v1/documents \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Contrato de Arrendamiento",
    "content": "Contenido del documento...",
    "type": "contract"
  }'
```

### Crear Usuario SaaS
```bash
curl -X POST http://localhost:3000/api/v1/saas/users \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "nuevo@usuario.com",
    "password": "password123",
    "role": "user",
    "subscription_plan": "basic"
  }'
```

### Generar API Token
```bash
curl -X POST http://localhost:3000/api/v1/tokens \
  -H "Authorization: Bearer USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Mi API Token",
    "permissions": ["documents:read", "documents:create"],
    "expires_at": "2024-12-31T23:59:59Z"
  }'
```

## 🔧 **CONFIGURACIÓN**

### Variables de Entorno
```bash
# Base de datos
DATABASE_URL=postgresql://user:pass@host:port/db

# JWT
JWT_SECRET=your_jwt_secret_here

# API
API_PORT=3000
API_HOST=localhost

# Rate Limiting
RATE_LIMIT_WINDOW=3600000
RATE_LIMIT_MAX=1000
```

## 📱 **SDK Y CLIENTES**

### JavaScript/Node.js
```javascript
const NotaryProAPI = {
  baseURL: 'http://localhost:3000/api/v1',
  token: null,
  
  setToken(token) {
    this.token = token;
  },
  
  async request(endpoint, options = {}) {
    const response = await fetch(`${this.baseURL}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.token}`,
        ...options.headers
      }
    });
    
    return response.json();
  }
};
```

## 🧪 **TESTING**

### Endpoints de Testing
```http
GET /api/v1/health
GET /api/v1/test/connection
POST /api/v1/test/email
```

### Datos de Prueba
```json
{
  "test_user": {
    "email": "test@notarypro.com",
    "password": "test123"
  },
  "test_document": {
    "title": "Documento de Prueba",
    "content": "Contenido de prueba"
  }
}
```

## 📈 **MONITOREO**

### Métricas Disponibles
- Tasa de requests por segundo
- Tiempo de respuesta promedio
- Tasa de errores
- Uso de memoria y CPU
- Conexiones de base de datos activas

### Endpoints de Monitoreo
```http
GET /api/v1/metrics
GET /api/v1/metrics/performance
GET /api/v1/metrics/errors
```

## 🆘 **SOPORTE**

### Canales de Soporte
- **Email**: soporte@notarypro.com
- **Documentación**: https://docs.notarypro.com
- **GitHub Issues**: https://github.com/notarypro/backend/issues

### Información de Debug
```http
GET /api/v1/debug/info
GET /api/v1/debug/logs
GET /api/v1/debug/version
```

---

**Última actualización**: Diciembre 2024  
**Versión de la documentación**: 2.2.0
