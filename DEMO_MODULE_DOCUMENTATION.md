# NotaryPro Demo Module Documentation

## 🎯 **MÓDULO DE DEMOSTRACIÓN**

### Descripción General
El módulo de demostración proporciona una interfaz interactiva para explorar y probar todas las funcionalidades del sistema NotaryPro, con roles de administrador y vendedor, y ejemplos visuales de cada módulo/API.

## 📋 **CARACTERÍSTICAS PRINCIPALES**

- ✅ **Sistema de login dual** con roles admin y vendedor
- ✅ **Dashboard interactivo** con métricas en tiempo real
- ✅ **Ejemplos visuales** de cada módulo del sistema
- ✅ **Gráficos y visualizaciones** con Chart.js
- ✅ **Interfaz responsive** con Tailwind CSS
- ✅ **Ejemplos de API** con request/response reales
- ✅ **Acciones de demostración** ejecutables
- ✅ **Navegación intuitiva** entre módulos

## 🏗️ **ARQUITECTURA**

### Estructura del Módulo
```
DemoModule
├── DemoModel (Base de datos)
├── Autenticación JWT
├── Gestión de roles
├── Ejemplos de módulos
├── Visualizaciones
└── Acciones de demo
```

### Usuarios de Demostración
| Rol | Email | Contraseña | Permisos |
|-----|-------|------------|----------|
| **Administrador** | admin@demo.com | admin123 | Acceso completo |
| **Vendedor** | vendedor@demo.com | vendedor123 | Acceso limitado |

## 🔐 **AUTENTICACIÓN Y ROLES**

### Sistema de Login
```http
POST /api/v1/demo/login
```

**Body:**
```json
{
  "email": "admin@demo.com",
  "password": "admin123"
}
```

**Respuesta:**
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "uuid",
      "email": "admin@demo.com",
      "role": "admin",
      "name": "Administrador Demo",
      "permissions": ["demo:admin", "demo:view_examples", "demo:read", "demo:create", "demo:update", "demo:delete"]
    }
  }
}
```

### Permisos por Rol

#### Administrador
- ✅ `demo:admin` - Acceso completo al sistema
- ✅ `demo:view_examples` - Ver todos los ejemplos
- ✅ `demo:read` - Leer datos del demo
- ✅ `demo:create` - Crear elementos de demo
- ✅ `demo:update` - Actualizar elementos de demo
- ✅ `demo:delete` - Eliminar elementos de demo

#### Vendedor
- ✅ `demo:seller` - Acceso limitado
- ✅ `demo:view_examples` - Ver ejemplos básicos
- ✅ `demo:read` - Leer datos del demo

## 📊 **DASHBOARD PRINCIPAL**

### Métricas del Sistema
- **Total de módulos** disponibles
- **Total de ejemplos** de API
- **Usuarios demo** activos
- **Estado del sistema** (operativo/error)

### Acciones Rápidas
1. **Ver Documentos** - Ejemplos del módulo de documentos
2. **Probar Firmas** - Ejemplos del sistema de firmas
3. **Explorar Analytics** - Métricas y reportes
4. **Gestión SaaS** - Panel de administración SaaS

### Vista de Módulos
- Grid de tarjetas para cada módulo
- Contador de ejemplos por módulo
- Navegación directa a ejemplos

## 🔧 **ENDPOINTS DISPONIBLES**

### 1. Dashboard Principal
```http
GET /api/v1/demo/dashboard
```

**Headers:**
```http
Authorization: Bearer <token>
```

**Respuesta:**
```json
{
  "success": true,
  "data": {
    "stats": {
      "total_modules": 6,
      "total_examples": 12,
      "demo_users": 2,
      "system_status": "operational"
    },
    "modules": [
      {
        "name": "documents",
        "description": "Sistema de gestión de documentos",
        "examples_count": 2
      }
    ],
    "quick_actions": [
      "Ver ejemplos de documentos",
      "Probar sistema de firmas",
      "Explorar analytics",
      "Gestionar usuarios SaaS"
    ]
  }
}
```

### 2. Ejemplos de Módulo
```http
GET /api/v1/demo/examples/:module
```

**Parámetros:**
- `module`: Nombre del módulo (documents, signatures, templates, users, analytics, saas)

**Respuesta:**
```json
{
  "success": true,
  "data": {
    "name": "documents",
    "description": "Sistema de gestión de documentos",
    "endpoints": [
      "GET /api/v1/documents",
      "POST /api/v1/documents",
      "GET /api/v1/documents/:id",
      "PUT /api/v1/documents/:id",
      "DELETE /api/v1/documents/:id"
    ],
    "examples": [
      {
        "request": {
          "method": "POST",
          "endpoint": "/api/v1/documents",
          "body": {
            "title": "Contrato de Arrendamiento",
            "content": "Este contrato establece...",
            "type": "contract",
            "status": "draft"
          }
        },
        "response": {
          "success": true,
          "data": {
            "id": "doc_123456",
            "title": "Contrato de Arrendamiento",
            "status": "draft",
            "created_at": "2024-01-15T10:30:00Z"
          }
        },
        "description": "Crear un nuevo documento"
      }
    ],
    "visual_data": {
      "chart_type": "bar",
      "data": {
        "labels": ["Borradores", "En Revisión", "Aprobados", "Firmados"],
        "datasets": [{
          "label": "Documentos por Estado",
          "data": [15, 8, 12, 25],
          "backgroundColor": ["#fbbf24", "#3b82f6", "#10b981", "#8b5cf6"]
        }]
      }
    }
  }
}
```

### 3. Lista de Módulos
```http
GET /api/v1/demo/modules
```

**Respuesta:**
```json
{
  "success": true,
  "data": [
    {
      "name": "documents",
      "description": "Sistema de gestión de documentos",
      "endpoints": [...],
      "examples": [...],
      "visual_data": {...}
    }
  ]
}
```

### 4. Ejecutar Acciones de Demo
```http
POST /api/v1/demo/execute/:action
```

**Parámetros:**
- `action`: Acción a ejecutar (create_sample_document, generate_sample_signature, simulate_analytics)

**Body:**
```json
{
  "params": {},
  "data": {}
}
```

**Respuesta:**
```json
{
  "success": true,
  "data": {
    "action": "create_sample_document",
    "result": "Documento de ejemplo creado exitosamente",
    "document_id": "demo_doc_abc123",
    "timestamp": "2024-01-15T10:30:00Z"
  }
}
```

## 📚 **MÓDULOS DISPONIBLES**

### 1. **Documents** - Gestión de Documentos
- **Descripción**: Sistema completo de gestión de documentos
- **Endpoints**: CRUD completo (GET, POST, PUT, DELETE)
- **Ejemplos**: Crear documento, listar documentos
- **Visualización**: Gráfico de barras por estado

### 2. **Signatures** - Sistema de Firmas
- **Descripción**: Firmas digitales y verificación
- **Endpoints**: Crear firma, verificar, obtener por documento
- **Ejemplos**: Solicitud de firma
- **Visualización**: Gráfico circular por estado

### 3. **Templates** - Plantillas
- **Descripción**: Plantillas reutilizables de documentos
- **Endpoints**: CRUD completo de plantillas
- **Ejemplos**: Crear plantilla con variables
- **Visualización**: Gráfico de dona por tipo

### 4. **Users** - Gestión de Usuarios
- **Descripción**: Administración de usuarios del sistema
- **Endpoints**: CRUD completo de usuarios
- **Ejemplos**: Crear nuevo usuario
- **Visualización**: Gráfico de línea de crecimiento

### 5. **Analytics** - Métricas y Reportes
- **Descripción**: Analytics y métricas del sistema
- **Endpoints**: Dashboard, usuarios, documentos, ingresos
- **Ejemplos**: Métricas del dashboard
- **Visualización**: Gráfico de área de actividad

### 6. **SaaS** - Administración SaaS
- **Descripción**: Sistema SaaS y administración
- **Endpoints**: Usuarios, analytics, suscripciones
- **Ejemplos**: Analytics del SaaS
- **Visualización**: Gráfico de barras por plan

## 🎨 **INTERFAZ DE USUARIO**

### Login Modal
- Formulario de autenticación
- Credenciales predefinidas visibles
- Validación en tiempo real
- Manejo de errores

### Dashboard Principal
- **Tarjetas de métricas** con iconos y colores
- **Acciones rápidas** con hover effects
- **Grid de módulos** clickeable
- **Información del usuario** con badge de rol

### Vista de Ejemplos
- **Navegación** con botón de retorno
- **Ejemplos de API** con request/response
- **Visualizaciones** con Chart.js
- **Endpoints** con códigos de color por método

### Responsive Design
- **Mobile-first** approach
- **Grid adaptativo** según pantalla
- **Navegación táctil** optimizada
- **Tipografía escalable**

## 🚀 **IMPLEMENTACIÓN**

### Requisitos del Sistema
- **Backend**: Node.js con Express
- **Base de datos**: PostgreSQL con extensión UUID
- **Frontend**: HTML5, CSS3, JavaScript ES6+
- **Librerías**: Chart.js, Tailwind CSS, Font Awesome

### Instalación
1. **Agregar módulo** al `core_manager.ts`
2. **Ejecutar migraciones** de base de datos
3. **Compilar** la aplicación
4. **Acceder** a `/demo-panel.html`

### Configuración
```typescript
// En core_manager.ts
import { DemoModule } from './demo_module';

// Agregar a la lista de módulos
const otherModules = [
  // ... otros módulos
  DemoModule
];
```

## 🔍 **CASOS DE USO**

### Para Desarrolladores
- **Explorar APIs** antes de implementar
- **Probar endpoints** con ejemplos reales
- **Entender respuestas** de la API
- **Verificar autenticación** y permisos

### Para Administradores
- **Demostrar funcionalidades** a clientes
- **Entrenar usuarios** en el sistema
- **Probar configuraciones** antes de producción
- **Validar integraciones** de terceros

### Para Vendedores
- **Mostrar capacidades** del sistema
- **Crear presentaciones** interactivas
- **Demostrar valor** a prospectos
- **Entrenar equipos** de ventas

## 📊 **MÉTRICAS Y MONITOREO**

### Estadísticas del Demo
- **Usuarios activos** por sesión
- **Módulos más visitados**
- **Ejemplos más populares**
- **Tiempo de sesión** promedio

### Logs de Actividad
- **Login/logout** de usuarios
- **Navegación** entre módulos
- **Ejecución** de acciones demo
- **Errores** y excepciones

## 🔒 **SEGURIDAD**

### Autenticación
- **JWT tokens** con expiración de 24h
- **Contraseñas hasheadas** con bcrypt
- **Validación** de permisos por endpoint
- **Logout automático** al cerrar sesión

### Autorización
- **Roles granulares** (admin/seller)
- **Permisos específicos** por funcionalidad
- **Middleware** de autenticación
- **Validación** de tokens en cada request

### Datos de Demo
- **Información ficticia** para demostración
- **Sin datos reales** de producción
- **Acceso limitado** a funcionalidades críticas
- **Logs de auditoría** completos

## 🚀 **DESPLIEGUE**

### Desarrollo Local
```bash
# 1. Compilar la aplicación
npm run build

# 2. Iniciar el servidor
npm start

# 3. Abrir demo panel
open demo-panel.html
```

### Producción
```bash
# 1. Construir para producción
npm run build

# 2. Configurar variables de entorno
cp .env.example .env.production

# 3. Desplegar con PM2
pm2 start ecosystem.config.js
```

## 🔧 **TROUBLESHOOTING**

### Problemas Comunes

#### Error de Login
```bash
# Verificar base de datos
psql -d notarypro -c "SELECT * FROM demo_users;"

# Verificar JWT_SECRET
echo $JWT_SECRET
```

#### Error de CORS
```javascript
// Verificar configuración en app.ts
app.use(cors({
  origin: ['http://localhost:3000'],
  credentials: true
}));
```

#### Error de Base de Datos
```bash
# Verificar conexión
psql "postgres://usuario:password@host:port/database"

# Verificar tabla demo_users
\dt demo_users
```

### Soluciones
1. **Reiniciar aplicación** después de cambios
2. **Verificar logs** del servidor
3. **Comprobar base de datos** y conexiones
4. **Validar variables** de entorno

## 📚 **RECURSOS ADICIONALES**

### Documentación Relacionada
- [API Documentation](./API_DOCUMENTATION.md)
- [SaaS System Documentation](./SAAS_DOCUMENTATION.md)
- [Deployment Guide](./DEPLOYMENT_GUIDE.md)

### Enlaces Útiles
- [Chart.js Documentation](https://www.chartjs.org/docs/)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- [Font Awesome Icons](https://fontawesome.com/icons)

### Soporte Técnico
- **Email**: soporte@notarypro.com
- **Documentación**: https://docs.notarypro.com
- **GitHub Issues**: https://github.com/notarypro/backend/issues

---

**Versión del Módulo**: 2.2.0  
**Última actualización**: Diciembre 2024  
**Estado**: ✅ **COMPLETO Y FUNCIONAL**

> 💡 **Tip**: Usa las credenciales de demo para explorar rápidamente todas las funcionalidades del sistema.
