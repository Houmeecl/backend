# NotaryPro Backend API

## Descripción

NotaryPro Backend es una API completa para un sistema de firma electrónica y gestión de documentos notariales. La API está construida con Node.js, TypeScript, Express y PostgreSQL, siguiendo una arquitectura modular y escalable.

## Características Principales

- 🔐 **Autenticación y Autorización**: Sistema JWT con roles y permisos granulares
- 📄 **Gestión de Documentos**: Creación, edición y transiciones de estado de documentos
- ✍️ **Firmas Electrónicas**: Captura y verificación de firmas digitales
- 📋 **Plantillas**: Sistema de plantillas HTML personalizables
- 👥 **Gestión de Usuarios**: Roles múltiples (admin, gestor, certificador, operador, cliente, validador)
- 💰 **Sistema de Pagos**: Integración con pasarelas de pago
- 🎫 **Cupones y Descuentos**: Sistema de cupones y validación
- 📊 **Analíticas**: Métricas y reportes de uso
- 🔍 **Auditoría**: Log completo de todas las operaciones
- 📧 **Notificaciones**: Sistema de notificaciones por email
- 🆔 **Verificación de Identidad**: Validación RUT y OTP

## Arquitectura

La API está organizada en módulos independientes que extienden de `BaseModule`:

- **AuthModule**: Autenticación y gestión de sesiones
- **UsersModule**: Gestión de usuarios y perfiles
- **DocumentModule**: Gestión de documentos y transiciones
- **TemplateModule**: Plantillas HTML personalizables
- **SignatureModule**: Firmas electrónicas y verificación
- **VerificationModule**: Verificación de identidad y documentos
- **PaymentsModule**: Procesamiento de pagos
- **CouponsModule**: Sistema de cupones y descuentos
- **AnalyticsModule**: Métricas y reportes
- **AuditModule**: Log de auditoría
- **NotificationsModule**: Notificaciones por email

## Requisitos del Sistema

- Node.js >= 18.0.0
- npm >= 8.0.0
- PostgreSQL >= 12.0
- TypeScript >= 5.2.0

## Instalación

1. **Clonar el repositorio**
   ```bash
   git clone <repository-url>
   cd notarypro-backend
   ```

2. **Instalar dependencias**
   ```bash
   npm install
   ```

3. **Configurar variables de entorno**
   ```bash
   cp .env.example .env
   # Editar .env con tus configuraciones
   ```

4. **Configurar base de datos**
   ```bash
   # Ejecutar el script de inicialización
   psql -U <username> -d <database> -f init_database.sql
   ```

5. **Compilar el proyecto**
   ```bash
   npm run build
   ```

6. **Ejecutar la aplicación**
   ```bash
   # Desarrollo
   npm run dev
   
   # Producción
   npm start
   ```

## Variables de Entorno

```env
# Base de Datos
DB_USER=postgres
DB_HOST=localhost
DB_NAME=notarypro
DB_PASSWORD=your_password
DB_PORT=5432

# JWT
JWT_SECRET=your_jwt_secret_key

# Email (SMTP)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_password
EMAIL_FROM=NotaryPro <noreply@notarypro.com>

# API
API_BASE_URL=http://localhost:3000
NODE_ENV=development

# Uploads
UPLOAD_DIR=/var/www/notarypro-backend/uploads
```

## Estructura del Proyecto

```
notarypro-backend/
├── app.ts                 # Punto de entrada principal
├── core_manager.ts        # Gestor central de módulos
├── base_module.ts         # Clase base para todos los módulos
├── auth_middleware.ts     # Middleware de autenticación
├── modules/               # Módulos de la aplicación
│   ├── auth_module.ts
│   ├── users_module.ts
│   ├── document_module.ts
│   ├── template_module.ts
│   ├── signature_module.ts
│   ├── verification_module.ts
│   ├── payments_module.ts
│   ├── coupons_module.ts
│   ├── analytics_module.ts
│   ├── audit_module.ts
│   └── notifications_module.ts
├── dist/                  # Archivos compilados
├── uploads/               # Archivos subidos
├── migrations/            # Scripts de migración de BD
├── swagger.yaml           # Documentación OpenAPI
└── package.json
```

## Endpoints Principales

### Autenticación
- `POST /api/v1/auth/login` - Iniciar sesión
- `POST /api/v1/auth/register` - Registro de usuario
- `POST /api/v1/auth/logout` - Cerrar sesión

### Usuarios
- `GET /api/v1/users` - Listar usuarios
- `POST /api/v1/users` - Crear usuario
- `GET /api/v1/users/:id` - Obtener usuario
- `PUT /api/v1/users/:id` - Actualizar usuario
- `DELETE /api/v1/users/:id` - Eliminar usuario

### Documentos
- `GET /api/v1/documents` - Listar documentos
- `POST /api/v1/documents` - Crear documento
- `GET /api/v1/documents/:id` - Obtener documento
- `PUT /api/v1/documents/:id` - Actualizar documento
- `DELETE /api/v1/documents/:id` - Eliminar documento
- `POST /api/v1/documents/:id/transition` - Transición de estado

### Plantillas
- `GET /api/v1/templates` - Listar plantillas
- `POST /api/v1/templates` - Crear plantilla
- `GET /api/v1/templates/:id` - Obtener plantilla
- `PUT /api/v1/templates/:id` - Actualizar plantilla
- `DELETE /api/v1/templates/:id` - Eliminar plantilla
- `POST /api/v1/templates/upload-convert` - Subir y convertir plantilla

### Firmas
- `POST /api/v1/signatures/capture` - Capturar firma
- `GET /api/v1/signatures/:id/verify` - Verificar firma
- `POST /api/v1/signatures/request-signing` - Solicitar firma
- `POST /api/v1/signatures/handwritten` - Aplicar firma manuscrita

### Verificaciones
- `POST /api/v1/verifications/initiate` - Iniciar verificación
- `GET /api/v1/verifications/:id` - Obtener verificación
- `POST /api/v1/verifications/:id/complete` - Completar verificación
- `GET /api/v1/verifications/status/:documentId` - Estado de verificación

### Pagos
- `POST /api/v1/payments/create` - Crear pago
- `POST /api/v1/payments/:id/process` - Procesar pago
- `GET /api/v1/payments/history` - Historial de pagos
- `POST /api/v1/payments/:id/invoice` - Generar factura

### Cupones
- `GET /api/v1/coupons` - Listar cupones
- `POST /api/v1/coupons` - Crear cupón
- `POST /api/v1/coupons/validate` - Validar cupón
- `POST /api/v1/coupons/apply` - Aplicar cupón
- `GET /api/v1/coupons/:id/usage` - Uso del cupón

### Analíticas
- `GET /api/v1/analytics/dashboard` - Estadísticas del dashboard
- `GET /api/v1/analytics/usage` - Reporte de uso
- `GET /api/v1/analytics/conversion` - Métricas de conversión

## Scripts Disponibles

```bash
# Desarrollo
npm run dev          # Ejecutar en modo desarrollo con hot reload
npm run build        # Compilar TypeScript a JavaScript
npm run start        # Ejecutar versión compilada
npm run lint         # Ejecutar ESLint
npm run test         # Ejecutar tests
npm run clean        # Limpiar carpeta dist
```

## Desarrollo

### Estructura de un Módulo

Cada módulo debe extender de `BaseModule` e implementar los métodos requeridos:

```typescript
import { BaseModule, ModuleConfig } from './base_module';

const MODULE_CONFIG: ModuleConfig = {
  name: 'module_name',
  version: '1.0.0',
  enabled: true,
  dependencies: [],
  permissions: ['permission:read', 'permission:write'],
  routes: ['GET /endpoint', 'POST /endpoint']
};

export class MyModule extends BaseModule {
  constructor(database: Pool) {
    super(database, MODULE_CONFIG);
  }

  async initialize(): Promise<void> {
    this.initialized = true;
    console.log(`✅ ${this.getName()} v${this.getVersion()} initialized`);
  }

  async cleanup(): Promise<void> {
    this.initialized = false;
  }

  async getHealth(): Promise<{ status: string; details?: any }> {
    return { status: 'healthy' };
  }

  getRoutes(): Record<string, Function> {
    return {
      'GET /endpoint': this.handleGet.bind(this),
      'POST /endpoint': this.handlePost.bind(this)
    };
  }
}
```

### Middleware de Autenticación

La API utiliza middleware de autenticación JWT con verificación de permisos:

```typescript
import { authenticateToken, authorizePermission } from './auth_middleware';

// Ruta pública
app.post('/auth/login', loginHandler);

// Ruta protegida con permiso específico
app.get('/documents', 
  authenticateToken(jwtSecret), 
  authorizePermission('documents:read'), 
  documentsHandler
);
```

## Base de Datos

### Tablas Principales

- **users**: Usuarios del sistema
- **documents**: Documentos y trámites
- **templates**: Plantillas HTML
- **signatures**: Firmas electrónicas
- **verifications**: Verificaciones de identidad
- **payments**: Transacciones de pago
- **coupons**: Cupones y descuentos
- **audit_trail**: Log de auditoría

### Migraciones

Para aplicar cambios en la base de datos:

```bash
# Aplicar migración
psql -U <username> -d <database> -f migration.sql

# Revertir migración
psql -U <username> -d <database> -f migration_fixed.sql
```

## Despliegue

### Producción con PM2

```bash
# Instalar PM2 globalmente
npm install -g pm2

# Iniciar aplicación
pm2 start ecosystem.config.js

# Monitorear
pm2 monit

# Logs
pm2 logs
```

### Docker (opcional)

```bash
# Construir imagen
docker build -t notarypro-backend .

# Ejecutar contenedor
docker run -p 3000:3000 notarypro-backend
```

## Monitoreo y Logs

### Health Check

```bash
GET /health
```

Respuesta:
```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "version": "2.2.0",
  "environment": "production",
  "services": {
    "database": "connected",
    "email": "configured",
    "storage": "ready"
  }
}
```

### Logs

La aplicación registra logs detallados para:
- Inicialización de módulos
- Operaciones de base de datos
- Errores y excepciones
- Auditoría de acciones

## Seguridad

- **JWT**: Tokens de autenticación seguros
- **CORS**: Configuración de origen cruzado
- **Rate Limiting**: Protección contra ataques de fuerza bruta
- **Validación**: Esquemas Zod para validación de entrada
- **Auditoría**: Log completo de todas las operaciones
- **Permisos**: Sistema granular de permisos por rol

## Contribución

1. Fork el proyecto
2. Crear una rama para tu feature (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abrir un Pull Request

## Licencia

Este proyecto está bajo la Licencia MIT. Ver el archivo `LICENSE` para más detalles.

## Soporte

Para soporte técnico o preguntas:
- Crear un issue en GitHub
- Contactar al equipo de desarrollo
- Revisar la documentación de la API en `swagger.yaml`

## Changelog

### v2.2.0
- Arquitectura modular mejorada
- Sistema de permisos granular
- Módulo de verificación de identidad
- Sistema de cupones y descuentos
- Analíticas y reportes
- Mejoras en la seguridad

### v2.1.0
- Sistema de firmas electrónicas
- Gestión de plantillas HTML
- Sistema de pagos integrado
- Notificaciones por email

### v2.0.0
- Reescritura completa en TypeScript
- Arquitectura modular
- Base de datos PostgreSQL
- API RESTful completa
