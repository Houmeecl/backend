"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotaryProCoreManager = void 0;
const express_1 = __importDefault(require("express"));
const auth_middleware_1 = require("./auth_middleware");
const zod_1 = require("zod");
const cors_1 = __importDefault(require("cors"));
const auth_module_1 = __importDefault(require("./auth_module"));
const audit_module_1 = __importDefault(require("./audit_module"));
const templates_module_1 = __importDefault(require("./templates_module"));
const document_module_1 = __importDefault(require("./document_module"));
const signatures_module_1 = __importDefault(require("./signatures_module"));
const verification_module_1 = require("./verification_module");
const signers_module_1 = __importDefault(require("./signers_module"));
const password_reset_module_1 = __importDefault(require("./password_reset_module"));
const files_module_1 = __importDefault(require("./files_module"));
const notifications_module_1 = __importDefault(require("./notifications_module"));
const users_module_1 = require("./users_module");
const coupons_module_1 = require("./coupons_module");
const payments_module_1 = require("./payments_module");
const identity_module_1 = require("./identity_module");
const analytics_module_1 = require("./analytics_module");
const certifier_signatures_module_1 = require("./certifier_signatures_module");
const saas_admin_module_1 = require("./saas_admin_module");
const demo_module_enhanced_1 = require("./demo_module_enhanced");
class NotaryProCoreManager {
    constructor(database, jwtSecret, emailConfig) {
        this.modules = new Map();
        this.db = database;
        this.app = (0, express_1.default)();
        this.app.use((0, cors_1.default)());
        this.app.use(express_1.default.json({ limit: '50mb' }));
        this.app.use(express_1.default.static('.'));
        this.app.use('/uploads', express_1.default.static('uploads'));
        this.jwtSecret = jwtSecret;
        this.emailConfig = emailConfig;
    }
    async initialize() {
        console.log('?? Initializing NotaryPro Core Manager...');
        try {
            console.log('?? Creating AuthModule with jwtSecret');
            const authModule = new auth_module_1.default(this.db, this.jwtSecret);
            await authModule.initialize();
            this.modules.set(authModule.getName(), authModule);
            console.log(`-> Módulo ${authModule.getName()} inicializado.`);
        }
        catch (error) {
            console.error('? Error inicializando AuthModule:', error.message);
        }
        try {
            console.log('?? Creating NotificationsModule with emailConfig');
            const notificationsModule = new notifications_module_1.default(this.db, this.emailConfig);
            await notificationsModule.initialize();
            this.modules.set(notificationsModule.getName(), notificationsModule);
            console.log(`-> Módulo ${notificationsModule.getName()} inicializado.`);
        }
        catch (error) {
            console.error('? Error inicializando NotificationsModule:', error.message);
        }
        const dbOnlyModules = [
            audit_module_1.default,
            templates_module_1.default,
            document_module_1.default,
            signatures_module_1.default,
            verification_module_1.VerificationModule,
            signers_module_1.default,
            password_reset_module_1.default,
            files_module_1.default,
            users_module_1.UsersModule,
            coupons_module_1.CouponsModule,
            payments_module_1.PaymentsModule,
            identity_module_1.IdentityModule,
            analytics_module_1.AnalyticsModule,
            certifier_signatures_module_1.CertifierSignaturesModule
        ];
        for (const ModuleClass of dbOnlyModules) {
            try {
                console.log(`?? Attempting to initialize module: ${ModuleClass.name}`);
                if (typeof ModuleClass === 'function' && ModuleClass.prototype && ModuleClass.prototype.constructor === ModuleClass) {
                    const moduleInstance = new ModuleClass(this.db);
                    await moduleInstance.initialize();
                    this.modules.set(moduleInstance.getName(), moduleInstance);
                    console.log(`-> Módulo ${moduleInstance.getName()} inicializado.`);
                }
                else {
                    console.log(`?? Saltando módulo ${ModuleClass.name} - no es una clase BaseModule`);
                }
            }
            catch (error) {
                console.error(`? Error inicializando módulo ${ModuleClass.name}:`, error.message);
                console.error(`? Error details:`, error);
                continue;
            }
        }
        try {
            console.log('?? Initializing SaasAdminModule with jwtSecret');
            const saasModule = new saas_admin_module_1.SaasAdminModule(this.db, this.jwtSecret);
            await saasModule.initialize();
            this.modules.set(saasModule.getName(), saasModule);
            console.log(`-> Módulo ${saasModule.getName()} inicializado.`);
        }
        catch (error) {
            console.error('? Error inicializando SaasAdminModule:', error.message);
        }
        try {
            console.log('?? Initializing DemoEnhancedModule with jwtSecret');
            const demoModule = new demo_module_enhanced_1.DemoEnhancedModule(this.db, this.jwtSecret);
            await demoModule.initialize();
            this.modules.set(demoModule.getName(), demoModule);
            console.log(`-> Módulo ${demoModule.getName()} inicializado.`);
        }
        catch (error) {
            console.error('? Error inicializando DemoEnhancedModule:', error.message);
        }
        this.setupModuleRoutes();
        this.app.use((err, req, res, next) => {
            console.error('? API Error Caught:', err.message);
            if (err.stack) {
                console.error(err.stack);
            }
            if (err instanceof zod_1.ZodError) {
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
            if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
                return res.status(400).json({ error: 'Bad Request', message: 'JSON mal formado en el cuerpo de la petición.' });
            }
            return res.status(500).json({ error: 'Internal Server Error', message: 'Ocurrió un error inesperado en el servidor.' });
        });
        console.log('? NotaryPro Core Manager initialized successfully');
    }
    setupModuleRoutes() {
        const apiV1 = express_1.default.Router();
        const authModule = this.modules.get('auth_module');
        if (authModule) {
            const authRoutes = authModule.getRoutes();
            apiV1.post('/auth/login', async (req, res, next) => {
                try {
                    const data = { ...req.body };
                    const result = await authRoutes['POST /auth/login'](data);
                    res.status(200).json(result);
                }
                catch (error) {
                    next(error);
                }
            });
            apiV1.post('/auth/register', async (req, res, next) => {
                try {
                    const data = { ...req.body };
                    const result = await authRoutes['POST /auth/register'](data);
                    res.status(201).json(result);
                }
                catch (error) {
                    next(error);
                }
            });
        }
        apiV1.use((0, auth_middleware_1.authenticateToken)(this.jwtSecret));
        const registerModuleRoutes = (moduleName, prefix, permissions) => {
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
                        apiV1[method.toLowerCase()](fullPath, (0, auth_middleware_1.authorizePermission)(routePermissions), async (req, res, next) => {
                            try {
                                const data = { ...req.params, ...req.query, ...req.body, user: req.user };
                                const result = await handler(data);
                                res.status(method === 'POST' ? 201 : 200).json(result);
                            }
                            catch (error) {
                                next(error);
                            }
                        });
                    }
                    else {
                        apiV1[method.toLowerCase()](fullPath, async (req, res, next) => {
                            try {
                                const data = { ...req.params, ...req.query, ...req.body, user: req.user };
                                const result = await handler(data);
                                res.status(method === 'POST' ? 201 : 200).json(result);
                            }
                            catch (error) {
                                next(error);
                            }
                        });
                    }
                }
            }
        };
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
        const notificationsModule = this.modules.get('notifications_module');
        if (notificationsModule) {
            const notificationsRoutes = notificationsModule.getRoutes();
            apiV1.post('/notifications/send', (0, auth_middleware_1.authorizePermission)('notifications:send'), async (req, res, next) => {
                try {
                    const data = { ...req.body, user: req.user };
                    const result = await notificationsRoutes['POST /notifications/send'](data);
                    res.status(201).json(result);
                }
                catch (error) {
                    next(error);
                }
            });
            apiV1.get('/notifications/history', (0, auth_middleware_1.authorizePermission)('notifications:history_read'), async (req, res, next) => {
                try {
                    const data = { ...req.query, user: req.user };
                    const result = await notificationsRoutes['GET /notifications/history'](data);
                    res.json(result);
                }
                catch (error) {
                    next(error);
                }
            });
            apiV1.post('/contract/send/draft-priority/:ContractID', (0, auth_middleware_1.authorizePermission)('notifications:send'), async (req, res, next) => {
                try {
                    const data = { ...req.params, user: req.user };
                    const result = await notificationsRoutes['POST /contract/send/draft-priority/:ContractID'](data);
                    res.status(201).json(result);
                }
                catch (error) {
                    next(error);
                }
            });
            apiV1.post('/contract/send/draft-priority/:ContractID/:rut', (0, auth_middleware_1.authorizePermission)('notifications:send'), async (req, res, next) => {
                try {
                    const data = { ...req.params, user: req.user };
                    const result = await notificationsRoutes['POST /contract/send/draft-priority/:ContractID/:rut'](data);
                    res.status(201).json(result);
                }
                catch (error) {
                    next(error);
                }
            });
        }
        this.app.use('/api/v1', apiV1);
        this.app.get('/saas-panel', (req, res) => {
            res.sendFile('saas-panel.html', { root: '.' });
        });
        this.app.get('/demo-panel', (req, res) => {
            res.sendFile('demo-panel.html', { root: '.' });
        });
        this.app.get('/demo-enhanced', (req, res) => {
            res.sendFile('demo-panel-enhanced.html', { root: '.' });
        });
        this.app.get('/demo-playground', (req, res) => {
            res.sendFile('demo-playground.html', { root: '.' });
        });
        this.app.get('/', (req, res) => {
            res.redirect('/saas-panel');
        });
    }
    getApp() { return this.app; }
    start(port) {
        this.app.listen(port, () => {
            console.log(`\n?? Server listening on port ${port}`);
            console.log(`Access API at http://localhost:${port}/api/v1`);
        });
    }
}
exports.NotaryProCoreManager = NotaryProCoreManager;
exports.default = NotaryProCoreManager;
