import { Pool, QueryResult } from 'pg';
import { z } from 'zod';
import { BaseModule, ModuleConfig, UserRole, Permission } from './base_module';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const AUTH_MODULE_CONFIG: ModuleConfig = {
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

// Esquemas de validación
const loginSchema = z.object({
  email: z.string().email("Formato de email inválido."),
  password: z.string().min(1, "La contraseña es requerida."),
});

const registerSchema = z.object({
  email: z.string().email("Formato de email inválido."),
  password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres."),
  first_name: z.string().min(1, "El nombre es requerido."),
  last_name: z.string().min(1, "El apellido es requerido."),
  role: z.enum(['admin', 'gestor', 'certificador', 'operador', 'cliente', 'validador']).default('cliente'),
});

// Mapa de permisos por rol
const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
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

// Interfaz para el usuario
interface User {
  id: string;
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  role: UserRole;
  created_at: Date;
  updated_at: Date;
}

export class AuthModule extends BaseModule {
  private jwtSecret: string;

  constructor(database: Pool, jwtSecret?: string) {
    super(database, AUTH_MODULE_CONFIG);
    this.jwtSecret = jwtSecret || process.env.JWT_SECRET || 'default-secret';
  }

  async initialize(): Promise<void> {
    this.initialized = true;
    console.log(`? ${this.getName()} v${this.getVersion()} initialized`);
  }

  async cleanup(): Promise<void> {
    this.initialized = false;
  }

  async getHealth(): Promise<{ status: string; details?: any; }> {
    try {
      await this.db.query('SELECT 1 FROM users LIMIT 1;');
      return { status: 'healthy', details: { db_users: 'reachable' } };
    } catch (error: any) {
      return { status: 'unhealthy', details: { db_users: error.message } };
    }
  }

  getRoutes(): Record<string, Function> {
    return {
      'POST /auth/login': this.login.bind(this),
      'POST /auth/register': this.register.bind(this),
      'POST /auth/logout': this.logout.bind(this)
    };
  }

  async login(data: z.infer<typeof loginSchema>): Promise<any> {
    try {
      const validatedData = loginSchema.parse(data);
      const { email, password } = validatedData;

      // Buscar usuario por email
      const result: QueryResult<User> = await this.db.query(
        'SELECT * FROM users WHERE email = $1',
        [email]
      );

      if (result.rows.length === 0) {
        throw new Error('Credenciales inválidas.');
      }

      const user = result.rows[0];

      // Verificar contraseña
      const isValidPassword = await bcrypt.compare(password, user.password);
      if (!isValidPassword) {
        throw new Error('Credenciales inválidas.');
      }

      // Obtener permisos del usuario basados en su rol
      const permissions = ROLE_PERMISSIONS[user.role] || [];

      // Generar JWT token
      const token = jwt.sign(
        {
          userId: user.id,
          email: user.email,
          role: user.role,
          permissions: permissions
        },
        this.jwtSecret,
        { expiresIn: '24h' }
      );

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

    } catch (error: any) {
      console.error('Error in login:', error);
      if (error instanceof z.ZodError) {
        throw new Error(`Error de validación: ${error.errors.map(e => e.message).join(', ')}`);
      }
      throw new Error(error.message || 'Error en el proceso de login.');
    }
  }

  async register(data: z.infer<typeof registerSchema>): Promise<any> {
    try {
      const validatedData = registerSchema.parse(data);
      const { email, password, first_name, last_name, role } = validatedData;

      // Verificar si el email ya existe
      const existingUser: QueryResult = await this.db.query(
        'SELECT id FROM users WHERE email = $1',
        [email]
      );

      if (existingUser.rows.length > 0) {
        throw new Error('El email ya está registrado.');
      }

      // Encriptar contraseña
      const hashedPassword = await bcrypt.hash(password, 10);

      // Crear usuario
      const result: QueryResult<User> = await this.db.query(
        'INSERT INTO users (email, password, first_name, last_name, role) VALUES ($1, $2, $3, $4, $5) RETURNING id, email, first_name, last_name, role, created_at',
        [email, hashedPassword, first_name, last_name, role]
      );

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

    } catch (error: any) {
      console.error('Error in register:', error);
      if (error instanceof z.ZodError) {
        throw new Error(`Error de validación: ${error.errors.map(e => e.message).join(', ')}`);
      }
      if (error.code === '23505') { // Unique violation
        throw new Error('El email ya está registrado.');
      }
      throw new Error(error.message || 'Error en el proceso de registro.');
    }
  }

  async logout(data: { user?: { userId: string } }): Promise<any> {
    try {
      // En una implementación real, podrías invalidar el token en una blacklist
      // o registro de tokens revocados
      console.log(`Usuario ${data.user?.userId} ha cerrado sesión`);

      return {
        success: true,
        message: 'Logout exitoso'
      };

    } catch (error: any) {
      console.error('Error in logout:', error);
      throw new Error(error.message || 'Error en el proceso de logout.');
    }
  }
}

export default AuthModule;