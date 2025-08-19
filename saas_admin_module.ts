import { Pool, QueryResult } from 'pg';
import { z } from 'zod';
import { BaseModule, ModuleConfig, UserRole, Permission } from './base_module';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const SAAS_ADMIN_MODULE_CONFIG: ModuleConfig = {
  name: 'saas_admin_module',
  version: '1.0.0',
  enabled: true,
  dependencies: [],
  permissions: [
    'saas:admin',
    'saas_users:read', 'saas_users:create', 'saas_users:update', 'saas_users:delete',
    'saas_roles:read', 'saas_roles:create', 'saas_roles:update', 'saas_roles:delete',
    'saas_subscriptions:read', 'saas_subscriptions:create', 'saas_subscriptions:update', 'saas_subscriptions:delete',
    'saas_analytics:read', 'saas_analytics:export'
  ],
  routes: [
    'GET /saas/dashboard',
    'GET /saas/users',
    'POST /saas/users',
    'PUT /saas/users/:id',
    'DELETE /saas/users/:id',
    'GET /saas/roles',
    'POST /saas/roles',
    'PUT /saas/roles/:id',
    'DELETE /saas/roles/:id',
    'GET /saas/subscriptions',
    'POST /saas/subscriptions',
    'PUT /saas/subscriptions/:id',
    'GET /saas/analytics',
    'GET /saas/billing'
  ]
};

// Esquemas de validación para SaaS
const createSaasUserSchema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(8, "Contraseña debe tener al menos 8 caracteres"),
  first_name: z.string().min(2, "Nombre debe tener al menos 2 caracteres"),
  last_name: z.string().min(2, "Apellido debe tener al menos 2 caracteres"),
  company: z.string().optional(),
  subscription_plan: z.enum(['free', 'basic', 'premium', 'enterprise']).default('free'),
  role: z.enum(['admin', 'manager', 'user']).default('user'),
  api_quota: z.number().int().positive().default(1000),
  api_usage: z.number().int().nonnegative().default(0),
  is_active: z.boolean().default(true)
});

const createRoleSchema = z.object({
  name: z.string().min(2, "Nombre del rol debe tener al menos 2 caracteres"),
  description: z.string().optional(),
  permissions: z.array(z.string()).default([]),
  is_system: z.boolean().default(false)
});

const createSubscriptionSchema = z.object({
  user_id: z.string().uuid("ID de usuario inválido"),
  plan_name: z.enum(['free', 'basic', 'premium', 'enterprise']),
  start_date: z.string().datetime(),
  end_date: z.string().datetime(),
  price: z.number().positive("Precio debe ser positivo"),
  currency: z.enum(['CLP', 'USD']).default('CLP'),
  status: z.enum(['active', 'expired', 'cancelled', 'pending']).default('pending')
});

// Interfaces para SaaS
interface SaasUser {
  id: string;
  email: string;
  password?: string;
  first_name: string;
  last_name: string;
  company?: string;
  subscription_plan: 'free' | 'basic' | 'premium' | 'enterprise';
  role: 'admin' | 'manager' | 'user';
  api_quota: number;
  api_usage: number;
  is_active: boolean;
  last_login?: Date;
  created_at: Date;
  updated_at: Date;
}

interface SaasRole {
  id: string;
  name: string;
  description?: string;
  permissions: string[];
  is_system: boolean;
  created_at: Date;
  updated_at: Date;
}

interface SaasSubscription {
  id: string;
  user_id: string;
  plan_name: string;
  start_date: Date;
  end_date: Date;
  price: number;
  currency: string;
  status: string;
  created_at: Date;
  updated_at: Date;
}

interface ApiUsage {
  user_id: string;
  endpoint: string;
  method: string;
  response_time: number;
  status_code: number;
  timestamp: Date;
}

// Modelo para operaciones de base de datos SaaS
class SaasAdminModel {
  private db: Pool;

  constructor(database: Pool) {
    this.db = database;
  }

  // Gestión de usuarios SaaS
  async createSaasUser(userData: Omit<SaasUser, 'id' | 'created_at' | 'updated_at'>): Promise<SaasUser> {
    const hashedPassword = await bcrypt.hash(userData.password!, 12);
    
    const result: QueryResult<SaasUser> = await this.db.query(`
      INSERT INTO saas_users (
        email, password, first_name, last_name, company, 
        subscription_plan, role, api_quota, api_usage, is_active
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `, [
      userData.email, hashedPassword, userData.first_name, userData.last_name,
      userData.company, userData.subscription_plan, userData.role,
      userData.api_quota, 0, userData.is_active
    ]);

    return result.rows[0];
  }

  async getSaasUsers(filters: any = {}): Promise<SaasUser[]> {
    let query = 'SELECT * FROM saas_users WHERE 1=1';
    const values: any[] = [];
    let paramIndex = 1;

    if (filters.role) {
      query += ` AND role = $${paramIndex++}`;
      values.push(filters.role);
    }

    if (filters.subscription_plan) {
      query += ` AND subscription_plan = $${paramIndex++}`;
      values.push(filters.subscription_plan);
    }

    if (filters.is_active !== undefined) {
      query += ` AND is_active = $${paramIndex++}`;
      values.push(filters.is_active);
    }

    query += ' ORDER BY created_at DESC';

    const result: QueryResult<SaasUser> = await this.db.query(query, values);
    return result.rows;
  }

  async updateSaasUser(id: string, updateData: Partial<SaasUser>): Promise<SaasUser | null> {
    const fields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (updateData.password) {
      updateData.password = await bcrypt.hash(updateData.password, 12);
    }

    for (const [key, value] of Object.entries(updateData)) {
      if (value !== undefined && key !== 'id') {
        fields.push(`${key} = $${paramIndex++}`);
        values.push(value);
      }
    }

    if (fields.length === 0) return null;

    fields.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);

    const result: QueryResult<SaasUser> = await this.db.query(`
      UPDATE saas_users 
      SET ${fields.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `, values);

    return result.rows[0] || null;
  }

  // Gestión de roles SaaS
  async createRole(roleData: Omit<SaasRole, 'id' | 'created_at' | 'updated_at'>): Promise<SaasRole> {
    const result: QueryResult<SaasRole> = await this.db.query(`
      INSERT INTO saas_roles (name, description, permissions, is_system)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `, [roleData.name, roleData.description, roleData.permissions, roleData.is_system]);

    return result.rows[0];
  }

  async getRoles(): Promise<SaasRole[]> {
    const result: QueryResult<SaasRole> = await this.db.query('SELECT * FROM saas_roles ORDER BY name');
    return result.rows;
  }

  // Gestión de suscripciones
  async createSubscription(subscriptionData: Omit<SaasSubscription, 'id' | 'created_at' | 'updated_at'>): Promise<SaasSubscription> {
    const result: QueryResult<SaasSubscription> = await this.db.query(`
      INSERT INTO saas_subscriptions (
        user_id, plan_name, start_date, end_date, price, currency, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `, [
      subscriptionData.user_id, subscriptionData.plan_name,
      subscriptionData.start_date, subscriptionData.end_date,
      subscriptionData.price, subscriptionData.currency, subscriptionData.status
    ]);

    return result.rows[0];
  }

  // Analytics y métricas
  async getApiUsageStats(timeRange: string = '30d'): Promise<any> {
    const result: QueryResult<ApiUsage> = await this.db.query(`
      SELECT 
        COUNT(*) as total_requests,
        AVG(response_time) as avg_response_time,
        COUNT(CASE WHEN status_code >= 400 THEN 1 END) as error_count,
        DATE_TRUNC('day', timestamp) as date
      FROM api_usage 
      WHERE timestamp >= NOW() - INTERVAL '1 ${timeRange}'
      GROUP BY DATE_TRUNC('day', timestamp)
      ORDER BY date DESC
    `);

    return result.rows;
  }

  async getUserApiUsage(userId: string): Promise<any> {
    const result: QueryResult<ApiUsage> = await this.db.query(`
      SELECT 
        endpoint,
        method,
        COUNT(*) as request_count,
        AVG(response_time) as avg_response_time,
        MAX(timestamp) as last_used
      FROM api_usage 
      WHERE user_id = $1
      GROUP BY endpoint, method
      ORDER BY request_count DESC
    `, [userId]);

    return result.rows;
  }
}

// Módulo principal de administración SaaS
export class SaasAdminModule extends BaseModule {
  private saasModel: SaasAdminModel;
  private jwtSecret: string;

  constructor(database: Pool, jwtSecret: string) {
    super(database, SAAS_ADMIN_MODULE_CONFIG);
    this.saasModel = new SaasAdminModel(database);
    this.jwtSecret = jwtSecret;
  }

  async initialize(): Promise<void> {
    this.initialized = true;
    console.log(`✅ ${this.getName()} v${this.getVersion()} initialized`);
  }

  async cleanup(): Promise<void> {
    this.initialized = false;
  }

  async getHealth(): Promise<{ status: string; details?: any }> {
    return {
      status: this.initialized ? 'healthy' : 'not_initialized',
      details: {
        module: this.getName(),
        version: this.getVersion(),
        users_count: await this.getUsersCount(),
        active_subscriptions: await this.getActiveSubscriptionsCount()
      }
    };
  }

  getRoutes(): Record<string, Function> {
    return {
      'GET /saas/dashboard': this.getDashboard.bind(this),
      'GET /saas/users': this.getUsers.bind(this),
      'POST /saas/users': this.createUser.bind(this),
      'PUT /saas/users/:id': this.updateUser.bind(this),
      'DELETE /saas/users/:id': this.deleteUser.bind(this),
      'GET /saas/roles': this.getRoles.bind(this),
      'POST /saas/roles': this.createRole.bind(this),
      'GET /saas/analytics': this.getAnalytics.bind(this)
    };
  }

  // Métodos de la API
  async getDashboard(req: any, res: any): Promise<void> {
    try {
      const stats = {
        total_users: await this.getUsersCount(),
        active_subscriptions: await this.getActiveSubscriptionsCount(),
        api_requests_today: await this.getApiRequestsCount('1 day'),
        revenue_month: await this.getMonthlyRevenue()
      };

      res.json({
        success: true,
        data: stats,
        message: 'Dashboard SaaS cargado exitosamente'
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  async getUsers(req: any, res: any): Promise<void> {
    try {
      const filters = {
        role: req.query.role,
        subscription_plan: req.query.plan,
        is_active: req.query.active === 'true'
      };

      const users = await this.saasModel.getSaasUsers(filters);
      
      res.json({
        success: true,
        data: users.map(user => ({
          ...user,
          password: undefined // No exponer contraseñas
        })),
        message: 'Usuarios SaaS obtenidos exitosamente'
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  async createUser(req: any, res: any): Promise<void> {
    try {
      const validatedData = createSaasUserSchema.parse(req.body);
      const user = await this.saasModel.createSaasUser(validatedData);

      res.status(201).json({
        success: true,
        data: {
          ...user,
          password: undefined
        },
        message: 'Usuario SaaS creado exitosamente'
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          success: false,
          error: 'Datos de entrada inválidos',
          details: error.errors
        });
      } else {
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    }
  }

  async updateUser(req: any, res: any): Promise<void> {
    try {
      const { id } = req.params;
      const validatedData = createSaasUserSchema.partial().parse(req.body);
      
      const updatedUser = await this.saasModel.updateSaasUser(id, validatedData);
      
      if (!updatedUser) {
        return res.status(404).json({
          success: false,
          error: 'Usuario SaaS no encontrado'
        });
      }

      res.json({
        success: true,
        data: {
          ...updatedUser,
          password: undefined
        },
        message: 'Usuario SaaS actualizado exitosamente'
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  async deleteUser(req: any, res: any): Promise<void> {
    try {
      const { id } = req.params;
      
      // Soft delete - marcar como inactivo
      await this.saasModel.updateSaasUser(id, { is_active: false });
      
      res.json({
        success: true,
        message: 'Usuario SaaS desactivado exitosamente'
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  async getRoles(req: any, res: any): Promise<void> {
    try {
      const roles = await this.saasModel.getRoles();
      
      res.json({
        success: true,
        data: roles,
        message: 'Roles SaaS obtenidos exitosamente'
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  async createRole(req: any, res: any): Promise<void> {
    try {
      const validatedData = createRoleSchema.parse(req.body);
      const role = await this.saasModel.createRole(validatedData);

      res.status(201).json({
        success: true,
        data: role,
        message: 'Rol SaaS creado exitosamente'
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          success: false,
          error: 'Datos de entrada inválidos',
          details: error.errors
        });
      } else {
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    }
  }

  async getAnalytics(req: any, res: any): Promise<void> {
    try {
      const timeRange = req.query.range || '30d';
      const apiStats = await this.saasModel.getApiUsageStats(timeRange);
      
      res.json({
        success: true,
        data: {
          api_usage: apiStats,
          time_range: timeRange
        },
        message: 'Analíticas SaaS obtenidas exitosamente'
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  // Métodos helper privados
  private async getUsersCount(): Promise<number> {
    const result = await this.db.query('SELECT COUNT(*) FROM saas_users WHERE is_active = true');
    return parseInt(result.rows[0].count);
  }

  private async getActiveSubscriptionsCount(): Promise<number> {
    const result = await this.db.query('SELECT COUNT(*) FROM saas_subscriptions WHERE status = \'active\'');
    return parseInt(result.rows[0].count);
  }

  private async getApiRequestsCount(timeRange: string): Promise<number> {
    const result = await this.db.query(`
      SELECT COUNT(*) FROM api_usage 
      WHERE timestamp >= NOW() - INTERVAL '1 ${timeRange}'
    `);
    return parseInt(result.rows[0].count);
  }

  private async getMonthlyRevenue(): Promise<number> {
    const result = await this.db.query(`
      SELECT COALESCE(SUM(price), 0) as revenue 
      FROM saas_subscriptions 
      WHERE status = 'active' 
      AND start_date >= DATE_TRUNC('month', CURRENT_DATE)
    `);
    return parseFloat(result.rows[0].revenue);
  }
}

export default SaasAdminModule;
