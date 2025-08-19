import { Pool } from 'pg';
import express, { Express, Request, Response, NextFunction } from 'express';
import { BaseModule, UserRole, Permission } from './base_module';
import { authenticateToken, authorizePermission } from './auth_middleware';
import { ZodError } from 'zod';
import cors from 'cors';

// === Importaciones de TODOS los Módulos ===
import AuthModule from './auth_module';
import AuditModule from './audit_module';
import TemplateModule from './templates_module';
import DocumentModule from './document_module';
import SignatureModule from './signatures_module';
import { VerificationModule } from './verification_module';
import SignersModule from './signers_module';
import PasswordResetModule from './password_reset_module';
import FilesModule from './files_module';
import NotificationsModule from './notifications_module';

// === Importaciones de los NUEVOS Módulos ===
import { UsersModule } from './users_module';
import { CouponsModule } from './coupons_module';
import { PaymentsModule } from './payments_module';
import { IdentityModule } from './identity_module';
import { AnalyticsModule } from './analytics_module';
import { CertifierSignaturesModule } from './certifier_signatures_module';
import { SaasAdminModule } from './saas_admin_module';
import { DemoEnhancedModule } from './demo_module_enhanced';


// Extender el Request de Express para añadir la propiedad 'user'
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        role: UserRole;
        permissions: Permission[];
      };
    }
  }
}

// Configuración de email para el módulo de notificaciones
interface EmailConfig {
  host: string;
  port: number;
  secure: boolean;
  auth: {
    user: string;
    pass: string;
  };
  from: string;
}

export class NotaryProCoreManager {
  private app: Express;
  private db: Pool;
  private modules: Map<string, BaseModule> = new Map();
  private jwtSecret: string;
  private emailConfig: EmailConfig;

  constructor(database: Pool, jwtSecret: string, emailConfig: EmailConfig) {
    this.db = database;
    this.app = express();
    this.app.use(cors());
    this.app.use(express.json({ limit: '50mb' }));
    
    // Configurar archivos estáticos para los paneles frontend
    this.app.use(express.static('.'));
    this.app.use('/uploads', express.static('uploads'));
    
    this.jwtSecret = jwtSecret;
    this.emailConfig = emailConfig;
  }

  async initialize(): Promise<void> {
    console.log('?? Initializing NotaryPro Core Manager...');
    
    // Inicializar módulos uno por uno para evitar problemas de identidad
    try {
      // AuthModule
      console.log('?? Creating AuthModule with jwtSecret');
      const authModule = new AuthModule(this.db, this.jwtSecret);
      await authModule.initialize();
      this.modules.set(authModule.getName(), authModule);
      console.log(`-> Módulo ${authModule.getName()} inicializado.`);
    } catch (error: any) {
      console.error('? Error inicializando AuthModule:', error.message);
    }

    try {
      // NotificationsModule
      console.log('?? Creating NotificationsModule with emailConfig');
      const notificationsModule = new NotificationsModule(this.db, this.emailConfig);
      await notificationsModule.initialize();
      this.modules.set(notificationsModule.getName(), notificationsModule);
      console.log(`-> Módulo ${notificationsModule.getName()} inicializado.`);
    } catch (error: any) {
      console.error('? Error inicializando NotificationsModule:', error.message);
    }

    // Inicializar módulos que solo necesitan database
    const dbOnlyModules = [
      AuditModule,
      TemplateModule,
      DocumentModule,
      SignatureModule,
      VerificationModule,
      SignersModule,
      PasswordResetModule,
      FilesModule,
      UsersModule,
      CouponsModule,
      PaymentsModule,
      IdentityModule,
      AnalyticsModule,
      CertifierSignaturesModule
    ];

    for (const ModuleClass of dbOnlyModules) {
      try {
        console.log(`?? Attempting to initialize module: ${ModuleClass.name}`);
        
        if (typeof ModuleClass === 'function' && ModuleClass.prototype && ModuleClass.prototype.constructor === ModuleClass) {
          const moduleInstance = new ModuleClass(this.db);
          await moduleInstance.initialize();
          this.modules.set(moduleInstance.getName(), moduleInstance);
          console.log(`-> Módulo ${moduleInstance.getName()} inicializado.`);
        } else {
          console.log(`?? Saltando módulo ${ModuleClass.name} - no es una clase BaseModule`);
        }
      } catch (error: any) {
        console.error(`? Error inicializando módulo ${ModuleClass.name}:`, error.message);
        console.error(`? Error details:`, error);
        continue;
      }
    }

    // Inicializar módulos que necesitan jwtSecret
    try {
      console.log('?? Initializing SaasAdminModule with jwtSecret');
      const saasModule = new SaasAdminModule(this.db, this.jwtSecret);
      await saasModule.initialize();
      this.modules.set(saasModule.getName(), saasModule);
      console.log(`-> Módulo ${saasModule.getName()} inicializado.`);
    } catch (error: any) {
      console.error('? Error inicializando SaasAdminModule:', error.message);
    }

    try {
      console.log('?? Initializing DemoEnhancedModule with jwtSecret');
      const demoModule = new DemoEnhancedModule(this.db, this.jwtSecret);
      await demoModule.initialize();
      this.modules.set(demoModule.getName(), demoModule);
      console.log(`-> Módulo ${demoModule.getName()} inicializado.`);
    } catch (error: any) {
      console.error('? Error inicializando DemoEnhancedModule:', error.message);
    }

    this.setupModuleRoutes();
    
    // === Manejador de Errores Centralizado ===
    this.app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
        console.error('? API Error Caught:', err.message);
        if (err.stack) {
            console.error(err.stack);
        }

        if (err instanceof ZodError) {
            return res.status(400).json({ 
                error: 'Validation Error', 
                message: 'Datos de entrada inválidos.', 
                details: err.errors.map(e => ({ path: e.path.join('.'), message: e.message }))
            });
        }
        
        if (err.message.includes("Token") || err.message.includes("Acceso denegado") || err.message.includes("Permiso denegado")) {
            return res.status(403).json({ error: 'Forbidden', message: err.message });
        }

        if (err.message.includes("no encontrado") || err.message.includes("no existe") || err.message.includes("duplicado") || err.message.includes("no se pudo")) {
            let statusCode = 400; 
            if (err.message.includes("no encontrado") || err.message.includes("no existe")) {
                statusCode = 404; 
            }
            return res.status(statusCode).json({ error: 'Business Logic Error', message: err.message });
        }

        if (err instanceof SyntaxError && (err as any).status === 400 && 'body' in err) {
            return res.status(400).json({ error: 'Bad Request', message: 'JSON mal formado en el cuerpo de la petición.' });
        }

        return res.status(500).json({ error: 'Internal Server Error', message: 'Ocurrió un error inesperado en el servidor.' });
    });

    console.log('? NotaryPro Core Manager initialized successfully');
  }

  private setupModuleRoutes(): void {
    const apiV1 = express.Router();
    
    // === RUTAS DE AUTENTICACIÓN (SIN AUTENTICACIÓN) ===
    
    // AuthModule tiene un caso especial para login sin auth
    const authModule = this.modules.get('auth_module');
    if (authModule) {
        const authRoutes = authModule.getRoutes();
        apiV1.post('/auth/login', async (req: Request, res: Response, next: NextFunction) => {
            try {
                const data = { ...req.body }; 
                const result = await authRoutes['POST /auth/login'](data);
                res.status(200).json(result);
            } catch (error: any) {
                next(error); 
            }
        });
        apiV1.post('/auth/register', async (req: Request, res: Response, next: NextFunction) => {
            try {
                const data = { ...req.body };
                const result = await authRoutes['POST /auth/register'](data);
                res.status(201).json(result);
            } catch (error: any) {
                next(error); 
            }
        });
    }
    
    // Middleware de autenticación global para el resto de rutas
    apiV1.use(authenticateToken(this.jwtSecret));
    
    // Helper para registrar rutas de módulos
    const registerModuleRoutes = (moduleName: string, prefix: string, permissions: Record<string, string[]>) => {
        const moduleInstance = this.modules.get(moduleName);
        if (moduleInstance) {
            const routes = moduleInstance.getRoutes();
            console.log(`???  Registering ${moduleName} Routes`);
            for (const routePath in routes) {
                const [method, path] = routePath.split(' ');
                const handler = routes[routePath];
                const fullPath = `${prefix}${path}`;

                const routePermissions = permissions[routePath];
                
                if (routePermissions && routePermissions.length > 0) {
                    (apiV1 as any)[method.toLowerCase()](fullPath, authorizePermission(routePermissions as Permission[]), async (req: Request, res: Response, next: NextFunction) => {
                        try {
                            const data = { ...req.params, ...req.query, ...req.body, user: req.user };
                            const result = await handler(data);
                            res.status(method === 'POST' ? 201 : 200).json(result);
                        } catch (error: any) {
                            next(error); 
                        }
                    });
                } else {
                    (apiV1 as any)[method.toLowerCase()](fullPath, async (req: Request, res: Response, next: NextFunction) => {
                        try {
                            const data = { ...req.params, ...req.query, ...req.body, user: req.user };
                            const result = await handler(data);
                            res.status(method === 'POST' ? 201 : 200).json(result);
                        } catch (error: any) {
                            next(error);
                        }
                    });
                }
            }
        }
    };

        // === RUTAS POR MÓDULO ===
    
    registerModuleRoutes('document_module', '/documents', {
        'GET /documents': ['documents:read'],
        'GET /documents/:id': ['documents:read'],
        'POST /documents': ['documents:create'],
        'PUT /documents/:id': ['documents:update'],
        'DELETE /documents/:id': ['documents:delete'],
        'POST /documents/:id/transition': ['documents:transition']
    });

    registerModuleRoutes('template_module', '/templates', {
        'GET /templates': ['templates:read'],
        'GET /templates/:id': ['templates:read'],
        'POST /templates': ['templates:create'],
        'PUT /templates/:id': ['templates:update'],
        'DELETE /templates/:id': ['templates:delete'],
        'POST /templates/upload-convert': ['templates:upload_convert']
    });

    registerModuleRoutes('signature_module', '/signatures', {
        'POST /signatures/capture': ['signatures:capture'],
        'GET /signatures/:id/verify': ['signatures:verify'],
        'POST /signatures/request-signing': ['signatures:request_signing'],
        'POST /signatures/handwritten': ['signatures:apply_handwritten'],
    });

    registerModuleRoutes('certifier_signatures_module', '/signatures', {
        'POST /signatures/certifier-upload': ['signatures:certifier_upload'],
    });
    
    registerModuleRoutes('users_module', '/users', {
        'GET /users': ['users:read'],
        'POST /users': ['users:create'],
        'GET /users/:id': ['users:read'],
        'PUT /users/:id': ['users:update'],
        'DELETE /users/:id': ['users:delete'],
        'GET /users/:id/activity': ['users:activity_read']
    });

    registerModuleRoutes('coupons_module', '/coupons', {
        'GET /coupons': ['coupons:read'],
        'POST /coupons': ['coupons:create'],
        'POST /coupons/validate': ['coupons:validate'],
        'POST /coupons/apply': ['coupons:apply'],
        'GET /coupons/:id/usage': ['coupons:usage_read']
    });

    registerModuleRoutes('payments_module', '/payments', {
        'POST /payments/create': ['payments:create'],
        'POST /payments/:id/process': ['payments:process'],
        'GET /payments/history': ['payments:read'],
        'POST /payments/:id/invoice': ['payments:invoice']
    });

    registerModuleRoutes('identity_module', '/identity', {
        'POST /identity/validate-rut': ['identity:validate_rut'],
        'POST /identity/send-otp': ['identity:send_otp'],
        'POST /identity/verify-otp': ['identity:verify_otp'],
        'POST /identity/verify-biometric': ['identity:verify_biometric']
    });

    registerModuleRoutes('analytics_module', '/analytics', {
        'GET /analytics/dashboard': ['analytics:read'],
        'GET /analytics/usage': ['analytics:read'],
        'GET /analytics/conversion': ['analytics:read']
    });

    // Demo Enhanced Module
    registerModuleRoutes('demo_enhanced', '/demo', {
        'POST /login': ['demo:read'],
        'GET /dashboard': ['demo:read'],
        'GET /examples/:module': ['demo:view_examples'],
        'GET /modules': ['demo:read'],
        'POST /execute/:action': ['demo:read'],
        'POST /simulate/:module/:endpoint': ['demo:simulate_api'],
        'POST /generate-code': ['demo:generate_code'],
        'GET /export/:type': ['demo:export_data'],
        'POST /analytics': ['demo:analytics'],
        'GET /search': ['demo:read'],
        'POST /playground/execute': ['demo:playground'],
        'GET /playground/history': ['demo:read']
    });

    // SaaS Admin Module
    registerModuleRoutes('saas_admin', '/saas', {
        'GET /users': ['saas_users:read'],
        'POST /users': ['saas_users:create'],
        'GET /users/:id': ['saas_users:read'],
        'PUT /users/:id': ['saas_users:update'],
        'DELETE /users/:id': ['saas_users:delete'],
        'GET /roles': ['saas_roles:read'],
        'POST /roles': ['saas_roles:create'],
        'PUT /roles/:id': ['saas_roles:update'],
        'DELETE /roles/:id': ['saas_roles:delete'],
        'GET /subscriptions': ['saas_subscriptions:read'],
        'POST /subscriptions': ['saas_subscriptions:create'],
        'PUT /subscriptions/:id': ['saas_subscriptions:update'],
        'DELETE /subscriptions/:id': ['saas_subscriptions:delete'],
        'GET /analytics': ['saas_analytics:read'],
        'GET /analytics/export': ['saas_analytics:export']
    });

    // API Token Module
    registerModuleRoutes('api_token_module', '/api-tokens', {
        'POST /create': ['api_tokens:create'],
        'GET /list': ['api_tokens:read'],
        'GET /:id': ['api_tokens:read'],
        'PUT /:id': ['api_tokens:update'],
        'DELETE /:id': ['api_tokens:delete'],
        'POST /:id/regenerate': ['api_tokens:regenerate'],
        'POST /validate': ['api_tokens:validate'],
        'GET /:id/usage': ['api_tokens:usage_read']
    });
    
    // NotificationsModule
    const notificationsModule = this.modules.get('notifications_module');
    if (notificationsModule) {
        const notificationsRoutes = notificationsModule.getRoutes();
        apiV1.post('/notifications/send', authorizePermission('notifications:send'), async (req: Request, res: Response, next: NextFunction) => {
            try {
                const data = { ...req.body, user: req.user };
                const result = await notificationsRoutes['POST /notifications/send'](data);
                res.status(201).json(result);
            } catch (error: any) {
                next(error);
            }
        });
        apiV1.get('/notifications/history', authorizePermission('notifications:history_read'), async (req: Request, res: Response, next: NextFunction) => {
            try {
                const data = { ...req.query, user: req.user };
                const result = await notificationsRoutes['GET /notifications/history'](data);
                res.json(result);
            } catch (error: any) {
                next(error);
            }
        });
        
        apiV1.post('/contract/send/draft-priority/:ContractID', authorizePermission('notifications:send'), async (req: Request, res: Response, next: NextFunction) => {
            try {
                const data = { ...req.params, user: req.user };
                const result = await notificationsRoutes['POST /contract/send/draft-priority/:ContractID'](data);
                res.status(201).json(result);
            } catch (error: any) {
                next(error);
            }
        });
        apiV1.post('/contract/send/draft-priority/:ContractID/:rut', authorizePermission('notifications:send'), async (req: Request, res: Response, next: NextFunction) => {
            try {
                const data = { ...req.params, user: req.user };
                const result = await notificationsRoutes['POST /contract/send/draft-priority/:ContractID/:rut'](data);
                res.status(201).json(result);
            } catch (error: any) {
                next(error);
            }
        });
    }

    this.app.use('/api/v1', apiV1);
    
    // Rutas para los paneles frontend
    this.app.get('/saas-panel', (req: Request, res: Response) => {
      res.sendFile('saas-panel.html', { root: '.' });
    });
    
    this.app.get('/demo-panel', (req: Request, res: Response) => {
      res.sendFile('demo-panel.html', { root: '.' });
    });
    
    this.app.get('/demo-enhanced', (req: Request, res: Response) => {
      res.sendFile('demo-panel-enhanced.html', { root: '.' });
    });
    
    this.app.get('/demo-playground', (req: Request, res: Response) => {
      res.sendFile('demo-playground.html', { root: '.' });
    });
    
    // Ruta raíz que redirige al panel SaaS
    this.app.get('/', (req: Request, res: Response) => {
      res.redirect('/saas-panel');
    });
  }
  
  public getApp(): Express { return this.app; }
  
  public start(port: number): void {
    this.app.listen(port, () => {
      console.log(`\n?? Server listening on port ${port}`);
      console.log(`Access API at http://localhost:${port}/api/v1`);
    });
  }
}

export default NotaryProCoreManager;