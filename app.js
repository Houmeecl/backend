"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const pg_1 = require("pg");
const core_manager_1 = __importDefault(require("./core_manager"));
const dotenv_1 = __importDefault(require("dotenv"));
const fs_1 = __importDefault(require("fs"));
dotenv_1.default.config({ path: 'env.local' });
const uploadDir = process.env.UPLOAD_DIR || '/var/www/notarypro-backend/uploads';
if (!fs_1.default.existsSync(uploadDir)) {
    fs_1.default.mkdirSync(uploadDir, { recursive: true });
    console.log(`?? Directorio de uploads creado: ${uploadDir}`);
}
const db = new pg_1.Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: parseInt(process.env.DB_PORT || '5432'),
    ssl: {
        rejectUnauthorized: false
    }
});
const jwtSecret = process.env.JWT_SECRET || '772398007723980085454';
const emailConfig = {
    host: process.env.SMTP_HOST || process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || process.env.EMAIL_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true' || process.env.EMAIL_SECURE === 'true' || false,
    auth: {
        user: process.env.SMTP_USER || process.env.EMAIL_USER || 'tu-email@gmail.com',
        pass: process.env.SMTP_PASS || process.env.EMAIL_PASSWORD || 'tu-password'
    },
    from: process.env.EMAIL_FROM || 'NotaryPro <noreply@notarypro.com>'
};
const coreManager = new core_manager_1.default(db, jwtSecret, emailConfig);
async function startApplication() {
    try {
        console.log('?? Iniciando NotaryPro Backend...');
        console.log(`?? Servidor de producci�n: ${process.env.API_BASE_URL}`);
        console.log(`?? Directorio de uploads: ${uploadDir}`);
        try {
            await db.query('SELECT NOW()');
            console.log('? Conexi�n a base de datos establecida');
        }
        catch (dbError) {
            console.error('? Error conectando a la base de datos:', dbError);
            throw dbError;
        }
        await coreManager.initialize();
        const app = coreManager.getApp();
        app.get('/health', (req, res) => {
            res.json({
                status: 'healthy',
                timestamp: new Date().toISOString(),
                version: '2.2.0',
                environment: process.env.NODE_ENV || 'development',
                server: {
                    url: process.env.API_BASE_URL,
                    upload_dir: uploadDir,
                    jwt_configured: !!process.env.JWT_SECRET,
                    api_key_configured: !!process.env.API_KEY
                },
                services: {
                    database: 'connected',
                    email: emailConfig.auth.user !== 'tu-email@gmail.com' ? 'configured' : 'not configured',
                    storage: fs_1.default.existsSync(uploadDir) ? 'ready' : 'not ready'
                },
                modules: {
                    auth: 'active',
                    templates: 'active',
                    documents: 'active',
                    signatures: 'active',
                    verification: 'active',
                    audit: 'active',
                    users: 'active',
                    coupons: 'active',
                    payments: 'active',
                    identity: 'active',
                    analytics: 'active',
                    certifier_signatures: 'active',
                    notifications: 'active',
                    signers: 'active',
                    password_reset: 'active',
                    files: 'active'
                },
                endpoints: {
                    auth: [
                        'POST /api/v1/auth/login',
                        'POST /api/v1/auth/register'
                    ],
                    documents: [
                        'GET /api/v1/documents',
                        'POST /api/v1/documents',
                        'GET /api/v1/documents/:id',
                        'PUT /api/v1/documents/:id',
                        'DELETE /api/v1/documents/:id',
                        'POST /api/v1/documents/:id/transition'
                    ],
                    templates: [
                        'GET /api/v1/templates',
                        'POST /api/v1/templates',
                        'GET /api/v1/templates/:id',
                        'PUT /api/v1/templates/:id',
                        'DELETE /api/v1/templates/:id',
                        'POST /api/v1/templates/upload-convert'
                    ],
                    signatures: [
                        'POST /api/v1/signatures/request-signing',
                        'POST /api/v1/signatures/handwritten',
                        'POST /api/v1/signatures/certifier-upload'
                    ],
                    users: [
                        'GET /api/v1/users',
                        'POST /api/v1/users',
                        'GET /api/v1/users/:id',
                        'PUT /api/v1/users/:id',
                        'DELETE /api/v1/users/:id',
                        'GET /api/v1/users/:id/activity'
                    ],
                    coupons: [
                        'GET /api/v1/coupons',
                        'POST /api/v1/coupons',
                        'POST /api/v1/coupons/validate',
                        'POST /api/v1/coupons/apply',
                        'GET /api/v1/coupons/:id/usage'
                    ],
                    payments: [
                        'POST /api/v1/payments/create',
                        'POST /api/v1/payments/:id/process',
                        'GET /api/v1/payments/history',
                        'POST /api/v1/payments/:id/invoice'
                    ],
                    identity: [
                        'POST /api/v1/identity/validate-rut',
                        'POST /api/v1/identity/send-otp',
                        'POST /api/v1/identity/verify-otp',
                        'POST /api/v1/identity/verify-biometric'
                    ],
                    analytics: [
                        'GET /api/v1/analytics/dashboard',
                        'GET /api/v1/analytics/usage',
                        'GET /api/v1/analytics/conversion'
                    ],
                    notifications: [
                        'POST /api/v1/notifications/send',
                        'GET /api/v1/notifications/history',
                        'POST /api/v1/contract/send/draft-priority/:ContractID',
                        'POST /api/v1/contract/send/draft-priority/:ContractID/:rut'
                    ],
                    signers: [
                        'POST /api/v1/signer/upd/:ContractID/EMAIL',
                        'POST /api/v1/signer/upd/:ContractID/RUT',
                        'GET /api/v1/signer/list'
                    ]
                }
            });
        });
        app.get('/info', (req, res) => {
            res.json({
                name: 'NotaryPro Backend API',
                version: '2.2.0',
                description: 'Sistema completo de firma electr�nica',
                base_url: process.env.API_BASE_URL,
                upload_dir: uploadDir,
                environment: process.env.NODE_ENV || 'development',
                api_key_configured: !!process.env.API_KEY,
                documentation: `${process.env.API_BASE_URL}/health`
            });
        });
        const port = parseInt(process.env.PORT || '3000');
        coreManager.start(port);
        console.log('?? NotaryPro Backend started successfully!');
        console.log(`?? API available at: ${process.env.API_BASE_URL || `http://localhost:${port}`}`);
        console.log(`?? Health check: ${process.env.API_BASE_URL || `http://localhost:${port}`}/health`);
        console.log(`??  Server info: ${process.env.API_BASE_URL || `http://localhost:${port}`}/info`);
        console.log('? Todos los m�dulos integrados en el Core Manager');
    }
    catch (error) {
        console.error('? Error starting application:', error);
        process.exit(1);
    }
}
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});
process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    process.exit(1);
});
process.on('SIGTERM', async () => {
    console.log('SIGTERM received, shutting down gracefully');
    await db.end();
    process.exit(0);
});
process.on('SIGINT', async () => {
    console.log('SIGINT received, shutting down gracefully');
    await db.end();
    process.exit(0);
});
startApplication();
