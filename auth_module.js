"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthModule = void 0;
const zod_1 = require("zod");
const base_module_1 = require("./base_module");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const AUTH_MODULE_CONFIG = {
    name: 'auth_module',
    version: '1.0.0',
    enabled: true,
    dependencies: [],
    permissions: ['auth:login', 'auth:register', 'auth:logout'],
    routes: [
        'POST /auth/login',
        'POST /auth/register',
        'POST /auth/logout'
    ]
};
const loginSchema = zod_1.z.object({
    email: zod_1.z.string().email("Formato de email inv�lido."),
    password: zod_1.z.string().min(1, "La contrase�a es requerida."),
});
const registerSchema = zod_1.z.object({
    email: zod_1.z.string().email("Formato de email inv�lido."),
    password: zod_1.z.string().min(6, "La contrase�a debe tener al menos 6 caracteres."),
    first_name: zod_1.z.string().min(1, "El nombre es requerido."),
    last_name: zod_1.z.string().min(1, "El apellido es requerido."),
    role: zod_1.z.enum(['admin', 'gestor', 'certificador', 'operador', 'cliente', 'validador']).default('cliente'),
});
const ROLE_PERMISSIONS = {
    admin: [
        'auth:login', 'auth:register', 'auth:logout',
        'documents:read', 'documents:create', 'documents:update', 'documents:delete', 'documents:transition',
        'templates:read', 'templates:create', 'templates:update', 'templates:delete', 'templates:upload_convert',
        'signatures:capture', 'signatures:verify', 'signatures:request_signing', 'signatures:apply_handwritten', 'signatures:certifier_upload',
        'users:read', 'users:create', 'users:update', 'users:delete', 'users:activity_read',
        'coupons:read', 'coupons:create', 'coupons:update', 'coupons:delete', 'coupons:validate', 'coupons:apply', 'coupons:usage_read',
        'payments:read', 'payments:create', 'payments:process', 'payments:invoice',
        'identity:validate_rut', 'identity:send_otp', 'identity:verify_otp', 'identity:verify_biometric',
        'analytics:read', 'analytics:export',
        'notifications:send', 'notifications:history_read',
        'files:upload', 'files:download', 'files:delete',
        'audit:read', 'audit:create', 'audit:export',
        'verifications:read', 'verifications:initiate'
    ],
    gestor: [
        'auth:login', 'auth:logout',
        'documents:read', 'documents:create', 'documents:update', 'documents:transition',
        'templates:read', 'templates:create', 'templates:update',
        'signatures:capture', 'signatures:verify', 'signatures:request_signing',
        'users:read', 'users:create', 'users:update',
        'coupons:read', 'coupons:validate', 'coupons:apply',
        'payments:read', 'payments:create',
        'identity:validate_rut', 'identity:send_otp', 'identity:verify_otp',
        'analytics:read',
        'notifications:send', 'notifications:history_read',
        'files:upload', 'files:download',
        'audit:read',
        'verifications:read', 'verifications:initiate'
    ],
    certificador: [
        'auth:login', 'auth:logout',
        'documents:read', 'documents:transition',
        'templates:read',
        'signatures:capture', 'signatures:verify', 'signatures:certifier_upload',
        'users:read',
        'identity:validate_rut', 'identity:verify_biometric',
        'analytics:read',
        'files:upload', 'files:download',
        'audit:read',
        'verifications:read', 'verifications:initiate'
    ],
    operador: [
        'auth:login', 'auth:logout',
        'documents:read', 'documents:create', 'documents:update', 'documents:transition',
        'templates:read',
        'signatures:capture', 'signatures:verify', 'signatures:apply_handwritten',
        'users:read',
        'coupons:read', 'coupons:validate', 'coupons:apply',
        'payments:read', 'payments:create',
        'identity:validate_rut', 'identity:send_otp', 'identity:verify_otp',
        'notifications:send',
        'files:upload', 'files:download',
        'verifications:read'
    ],
    cliente: [
        'auth:login', 'auth:logout',
        'documents:read', 'documents:create',
        'signatures:capture', 'signatures:apply_handwritten',
        'coupons:validate', 'coupons:apply',
        'payments:read', 'payments:create',
        'identity:validate_rut', 'identity:send_otp', 'identity:verify_otp', 'identity:verify_biometric',
        'files:upload', 'files:download'
    ],
    validador: [
        'auth:login', 'auth:logout',
        'documents:read',
        'signatures:verify',
        'identity:validate_rut', 'identity:verify_biometric',
        'files:download',
        'audit:read',
        'verifications:read', 'verifications:initiate'
    ]
};
class AuthModule extends base_module_1.BaseModule {
    constructor(database, jwtSecret) {
        super(database, AUTH_MODULE_CONFIG);
        this.jwtSecret = jwtSecret || process.env.JWT_SECRET || 'default-secret';
    }
    async initialize() {
        this.initialized = true;
        console.log(`? ${this.getName()} v${this.getVersion()} initialized`);
    }
    async cleanup() {
        this.initialized = false;
    }
    async getHealth() {
        try {
            await this.db.query('SELECT 1 FROM users LIMIT 1;');
            return { status: 'healthy', details: { db_users: 'reachable' } };
        }
        catch (error) {
            return { status: 'unhealthy', details: { db_users: error.message } };
        }
    }
    getRoutes() {
        return {
            'POST /auth/login': this.login.bind(this),
            'POST /auth/register': this.register.bind(this),
            'POST /auth/logout': this.logout.bind(this)
        };
    }
    async login(data) {
        try {
            const validatedData = loginSchema.parse(data);
            const { email, password } = validatedData;
            const result = await this.db.query('SELECT * FROM users WHERE email = $1', [email]);
            if (result.rows.length === 0) {
                throw new Error('Credenciales inv�lidas.');
            }
            const user = result.rows[0];
            const isValidPassword = await bcryptjs_1.default.compare(password, user.password);
            if (!isValidPassword) {
                throw new Error('Credenciales inv�lidas.');
            }
            const permissions = ROLE_PERMISSIONS[user.role] || [];
            const token = jsonwebtoken_1.default.sign({
                userId: user.id,
                email: user.email,
                role: user.role,
                permissions: permissions
            }, this.jwtSecret, { expiresIn: '24h' });
            return {
                success: true,
                message: 'Login exitoso',
                token: token,
                user: {
                    id: user.id,
                    email: user.email,
                    first_name: user.first_name,
                    last_name: user.last_name,
                    role: user.role,
                    permissions: permissions
                }
            };
        }
        catch (error) {
            console.error('Error in login:', error);
            if (error instanceof zod_1.z.ZodError) {
                throw new Error(`Error de validaci�n: ${error.errors.map(e => e.message).join(', ')}`);
            }
            throw new Error(error.message || 'Error en el proceso de login.');
        }
    }
    async register(data) {
        try {
            const validatedData = registerSchema.parse(data);
            const { email, password, first_name, last_name, role } = validatedData;
            const existingUser = await this.db.query('SELECT id FROM users WHERE email = $1', [email]);
            if (existingUser.rows.length > 0) {
                throw new Error('El email ya est� registrado.');
            }
            const hashedPassword = await bcryptjs_1.default.hash(password, 10);
            const result = await this.db.query('INSERT INTO users (email, password, first_name, last_name, role) VALUES ($1, $2, $3, $4, $5) RETURNING id, email, first_name, last_name, role, created_at', [email, hashedPassword, first_name, last_name, role]);
            const newUser = result.rows[0];
            return {
                success: true,
                message: 'Usuario registrado exitosamente',
                user: {
                    id: newUser.id,
                    email: newUser.email,
                    first_name: newUser.first_name,
                    last_name: newUser.last_name,
                    role: newUser.role,
                    created_at: newUser.created_at
                }
            };
        }
        catch (error) {
            console.error('Error in register:', error);
            if (error instanceof zod_1.z.ZodError) {
                throw new Error(`Error de validaci�n: ${error.errors.map(e => e.message).join(', ')}`);
            }
            if (error.code === '23505') {
                throw new Error('El email ya est� registrado.');
            }
            throw new Error(error.message || 'Error en el proceso de registro.');
        }
    }
    async logout(data) {
        try {
            console.log(`Usuario ${data.user?.userId} ha cerrado sesi�n`);
            return {
                success: true,
                message: 'Logout exitoso'
            };
        }
        catch (error) {
            console.error('Error in logout:', error);
            throw new Error(error.message || 'Error en el proceso de logout.');
        }
    }
}
exports.AuthModule = AuthModule;
exports.default = AuthModule;
