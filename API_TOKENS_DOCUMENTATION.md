# NotaryPro API Tokens Documentation

## 🔑 **SISTEMA DE TOKENS API**

### Descripción General
El sistema de API Tokens permite a los usuarios generar tokens de acceso programático para integrar NotaryPro en aplicaciones externas, con control granular de permisos y monitoreo de uso.

## 📋 **CARACTERÍSTICAS PRINCIPALES**

- ✅ **Generación segura** de tokens con UUID v4
- ✅ **Permisos granulares** por endpoint y método HTTP
- ✅ **Rate limiting** configurable por token
- ✅ **Expiración automática** con renovación opcional
- ✅ **Monitoreo de uso** en tiempo real
- ✅ **Revocación inmediata** de tokens comprometidos
- ✅ **Auditoría completa** de todas las operaciones

## 🏗️ **ARQUITECTURA**

### Tablas de Base de Datos
```sql
-- Tokens principales
api_tokens
├── id (UUID)
├── user_id (UUID)
├── name (VARCHAR)
├── token_hash (VARCHAR)
├── permissions (JSONB)
├── rate_limit (INTEGER)
├── expires_at (TIMESTAMP)
├── created_at (TIMESTAMP)
└── updated_at (TIMESTAMP)

-- Uso y métricas
token_usage
├── id (UUID)
├── token_id (UUID)
├── endpoint (VARCHAR)
├── method (VARCHAR)
├── response_time (INTEGER)
├── status_code (INTEGER)
├── ip_address (INET)
└── timestamp (TIMESTAMP)

-- Revocaciones
token_revocations
├── id (UUID)
├── token_id (UUID)
├── reason (VARCHAR)
├── revoked_by (UUID)
└── revoked_at (TIMESTAMP)
```

## 🔧 **ENDPOINTS DISPONIBLES**

### 1. Crear Token
```http
POST /api/v1/tokens
```

**Headers:**
```http
Authorization: Bearer <user_token>
Content-Type: application/json
```

**Body:**
```json
{
  "name": "Mi Token de Producción",
  "permissions": [
    "documents:read",
    "documents:create",
    "templates:read"
  ],
  "rate_limit": 1000,
  "expires_at": "2024-12-31T23:59:59Z"
}
```

**Respuesta:**
```json
{
  "success": true,
  "data": {
    "id": "uuid-del-token",
    "name": "Mi Token de Producción",
    "token": "ntp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
    "permissions": [...],
    "rate_limit": 1000,
    "expires_at": "2024-12-31T23:59:59Z",
    "created_at": "2024-01-01T00:00:00Z"
  }
}
```

### 2. Listar Tokens
```http
GET /api/v1/tokens?page=1&limit=20
```

**Respuesta:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "Token de Desarrollo",
      "permissions": [...],
      "rate_limit": 500,
      "expires_at": "2024-12-31T23:59:59Z",
      "created_at": "2024-01-01T00:00:00Z",
      "last_used": "2024-01-15T10:30:00Z"
    }
  ],
  "pagination": {...}
}
```

### 3. Obtener Token Específico
```http
GET /api/v1/tokens/:id
```

### 4. Actualizar Token
```http
PUT /api/v1/tokens/:id
```

**Body:**
```json
{
  "name": "Nuevo Nombre",
  "permissions": ["documents:read"],
  "rate_limit": 2000
}
```

### 5. Regenerar Token
```http
POST /api/v1/tokens/:id/regenerate
```

**Respuesta:**
```json
{
  "success": true,
  "data": {
    "new_token": "ntp_yyyyyyyyyyyyyyyyyyyyyyyyyyyyyyy",
    "expires_at": "2024-12-31T23:59:59Z"
  }
}
```

### 6. Eliminar Token
```http
DELETE /api/v1/tokens/:id
```

### 7. Validar Token
```http
POST /api/v1/tokens/validate
```

**Body:**
```json
{
  "token": "ntp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  "endpoint": "/api/v1/documents",
  "method": "GET"
}
```

**Respuesta:**
```json
{
  "success": true,
  "data": {
    "valid": true,
    "user_id": "uuid-del-usuario",
    "permissions": [...],
    "rate_limit_remaining": 999,
    "expires_at": "2024-12-31T23:59:59Z"
  }
}
```

## 🔐 **PERMISOS DISPONIBLES**

### Documentos
- `documents:read` - Leer documentos
- `documents:create` - Crear documentos
- `documents:update` - Actualizar documentos
- `documents:delete` - Eliminar documentos
- `documents:sign` - Firmar documentos

### Plantillas
- `templates:read` - Leer plantillas
- `templates:create` - Crear plantillas
- `templates:update` - Actualizar plantillas
- `templates:delete` - Eliminar plantillas

### Usuarios
- `users:read` - Leer usuarios
- `users:create` - Crear usuarios
- `users:update` - Actualizar usuarios
- `users:delete` - Eliminar usuarios

### Firmas
- `signatures:read` - Leer firmas
- `signatures:create` - Crear firmas
- `signatures:update` - Actualizar firmas
- `signatures:delete` - Eliminar firmas

### Verificaciones
- `verifications:read` - Leer verificaciones
- `verifications:create` - Crear verificaciones
- `verifications:update` - Actualizar verificaciones

## 📊 **MONITOREO Y MÉTRICAS**

### Estadísticas de Uso
```http
GET /api/v1/tokens/:id/usage
```

**Respuesta:**
```json
{
  "success": true,
  "data": {
    "total_requests": 15420,
    "successful_requests": 15380,
    "failed_requests": 40,
    "average_response_time": 245,
    "endpoints_usage": {
      "/api/v1/documents": 8500,
      "/api/v1/templates": 4200,
      "/api/v1/signatures": 2720
    },
    "last_24h": {
      "requests": 1250,
      "errors": 5,
      "peak_hour": "14:00"
    }
  }
}
```

### Rate Limiting
- **Límite por defecto**: 1000 requests/hora
- **Configurable**: 100 - 10000 requests/hora
- **Headers de respuesta**:
  ```http
  X-RateLimit-Limit: 1000
  X-RateLimit-Remaining: 999
  X-RateLimit-Reset: 1640995200
  ```

## 🚀 **INTEGRACIÓN**

### Ejemplo con cURL
```bash
# Crear token
curl -X POST http://localhost:3000/api/v1/tokens \
  -H "Authorization: Bearer USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Mi App Token",
    "permissions": ["documents:read", "documents:create"],
    "rate_limit": 500
  }'

# Usar token
curl -X GET http://localhost:3000/api/v1/documents \
  -H "Authorization: Bearer API_TOKEN" \
  -H "Content-Type: application/json"
```

### Ejemplo con JavaScript
```javascript
class NotaryProClient {
  constructor(apiToken) {
    this.apiToken = apiToken;
    this.baseURL = 'http://localhost:3000/api/v1';
  }

  async request(endpoint, options = {}) {
    const response = await fetch(`${this.baseURL}${endpoint}`, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.apiToken}`,
        'Content-Type': 'application/json',
        ...options.headers
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return response.json();
  }

  async getDocuments() {
    return this.request('/documents');
  }

  async createDocument(documentData) {
    return this.request('/documents', {
      method: 'POST',
      body: JSON.stringify(documentData)
    });
  }
}

// Uso
const client = new NotaryProClient('ntp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx');
const documents = await client.getDocuments();
```

### Ejemplo con Python
```python
import requests

class NotaryProClient:
    def __init__(self, api_token):
        self.api_token = api_token
        self.base_url = 'http://localhost:3000/api/v1'
        self.headers = {
            'Authorization': f'Bearer {api_token}',
            'Content-Type': 'application/json'
        }
    
    def get_documents(self):
        response = requests.get(
            f'{self.base_url}/documents',
            headers=self.headers
        )
        response.raise_for_status()
        return response.json()
    
    def create_document(self, document_data):
        response = requests.post(
            f'{self.base_url}/documents',
            headers=self.headers,
            json=document_data
        )
        response.raise_for_status()
        return response.json()

# Uso
client = NotaryProClient('ntp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx')
documents = client.get_documents()
```

## 🛡️ **SEGURIDAD**

### Mejores Prácticas
1. **Nunca compartas** tokens en código público
2. **Usa HTTPS** en producción
3. **Configura rate limits** apropiados
4. **Monitorea el uso** regularmente
5. **Revoca tokens** no utilizados
6. **Usa permisos mínimos** necesarios

### Validación de Seguridad
- Tokens se almacenan como hashes SHA-256
- Validación de expiración automática
- Verificación de permisos por endpoint
- Rate limiting por IP y token
- Auditoría completa de todas las operaciones

## 🔍 **TROUBLESHOOTING**

### Errores Comunes

#### 401 Unauthorized
```json
{
  "success": false,
  "error": {
    "code": "TOKEN_INVALID",
    "message": "Token inválido o expirado"
  }
}
```

#### 403 Forbidden
```json
{
  "success": false,
  "error": {
    "code": "INSUFFICIENT_PERMISSIONS",
    "message": "Token no tiene permisos para este endpoint"
  }
}
```

#### 429 Too Many Requests
```json
{
  "success": false,
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Rate limit excedido para este token"
  }
}
```

### Soluciones
1. **Verificar token**: Usar endpoint de validación
2. **Revisar permisos**: Confirmar permisos del token
3. **Ajustar rate limit**: Incrementar límite si es necesario
4. **Regenerar token**: Si hay problemas de seguridad

## 📚 **RECURSOS ADICIONALES**

- [Documentación Principal de la API](./API_DOCUMENTATION.md)
- [Guía de Implementación](./IMPLEMENTATION_GUIDE.md)
- [Ejemplos de Código](./CODE_EXAMPLES.md)
- [Soporte Técnico](mailto:soporte@notarypro.com)

---

**Versión**: 2.2.0  
**Última actualización**: Diciembre 2024
