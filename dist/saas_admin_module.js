"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SaasAdminModule = void 0;
const zod_1 = require("zod");
const base_module_1 = require("./base_module");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const SAAS_ADMIN_MODULE_CONFIG = {
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
const createSaasUserSchema = zod_1.z.object({
    email: zod_1.z.string().email("Email inválido"),
    password: zod_1.z.string().min(8, "Contraseña debe tener al menos 8 caracteres"),
    first_name: zod_1.z.string().min(2, "Nombre debe tener al menos 2 caracteres"),
    last_name: zod_1.z.string().min(2, "Apellido debe tener al menos 2 caracteres"),
    company: zod_1.z.string().optional(),
    subscription_plan: zod_1.z.enum(['free', 'basic', 'premium', 'enterprise']).default('free'),
    role: zod_1.z.enum(['admin', 'manager', 'user']).default('user'),
    api_quota: zod_1.z.number().int().positive().default(1000),
    api_usage: zod_1.z.number().int().nonnegative().default(0),
    is_active: zod_1.z.boolean().default(true)
});
const createRoleSchema = zod_1.z.object({
    name: zod_1.z.string().min(2, "Nombre del rol debe tener al menos 2 caracteres"),
    description: zod_1.z.string().optional(),
    permissions: zod_1.z.array(zod_1.z.string()).default([]),
    is_system: zod_1.z.boolean().default(false)
});
const createSubscriptionSchema = zod_1.z.object({
    user_id: zod_1.z.string().uuid("ID de usuario inválido"),
    plan_name: zod_1.z.enum(['free', 'basic', 'premium', 'enterprise']),
    start_date: zod_1.z.string().datetime(),
    end_date: zod_1.z.string().datetime(),
    price: zod_1.z.number().positive("Precio debe ser positivo"),
    currency: zod_1.z.enum(['CLP', 'USD']).default('CLP'),
    status: zod_1.z.enum(['active', 'expired', 'cancelled', 'pending']).default('pending')
});
class SaasAdminModel {
    constructor(database) {
        this.db = database;
    }
    async createSaasUser(userData) {
        const hashedPassword = await bcryptjs_1.default.hash(userData.password, 12);
        const result = await this.db.query(`
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
    async getSaasUsers(filters = {}) {
        let query = 'SELECT * FROM saas_users WHERE 1=1';
        const values = [];
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
        const result = await this.db.query(query, values);
        return result.rows;
    }
    async updateSaasUser(id, updateData) {
        const fields = [];
        const values = [];
        let paramIndex = 1;
        if (updateData.password) {
            updateData.password = await bcryptjs_1.default.hash(updateData.password, 12);
        }
        for (const [key, value] of Object.entries(updateData)) {
            if (value !== undefined && key !== 'id') {
                fields.push(`${key} = $${paramIndex++}`);
                values.push(value);
            }
        }
        if (fields.length === 0)
            return null;
        fields.push('updated_at = CURRENT_TIMESTAMP');
        values.push(id);
        const result = await this.db.query(`
      UPDATE saas_users 
      SET ${fields.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `, values);
        return result.rows[0] || null;
    }
    async createRole(roleData) {
        const result = await this.db.query(`
      INSERT INTO saas_roles (name, description, permissions, is_system)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `, [roleData.name, roleData.description, roleData.permissions, roleData.is_system]);
        return result.rows[0];
    }
    async getRoles() {
        const result = await this.db.query('SELECT * FROM saas_roles ORDER BY name');
        return result.rows;
    }
    async createSubscription(subscriptionData) {
        const result = await this.db.query(`
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
    async getApiUsageStats(timeRange = '30d') {
        const result = await this.db.query(`
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
    async getUserApiUsage(userId) {
        const result = await this.db.query(`
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
class SaasAdminModule extends base_module_1.BaseModule {
    constructor(database, jwtSecret) {
        super(database, SAAS_ADMIN_MODULE_CONFIG);
        this.saasModel = new SaasAdminModel(database);
        this.jwtSecret = jwtSecret;
    }
    async initialize() {
        this.initialized = true;
        console.log(`✅ ${this.getName()} v${this.getVersion()} initialized`);
    }
    async cleanup() {
        this.initialized = false;
    }
    async getHealth() {
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
    getRoutes() {
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
    async getDashboard(req, res) {
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
        }
        catch (error) {
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }
    async getUsers(req, res) {
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
                    password: undefined
                })),
                message: 'Usuarios SaaS obtenidos exitosamente'
            });
        }
        catch (error) {
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }
    async createUser(req, res) {
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
        }
        catch (error) {
            if (error instanceof zod_1.z.ZodError) {
                res.status(400).json({
                    success: false,
                    error: 'Datos de entrada inválidos',
                    details: error.errors
                });
            }
            else {
                res.status(500).json({
                    success: false,
                    error: error.message
                });
            }
        }
    }
    async updateUser(req, res) {
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
        }
        catch (error) {
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }
    async deleteUser(req, res) {
        try {
            const { id } = req.params;
            await this.saasModel.updateSaasUser(id, { is_active: false });
            res.json({
                success: true,
                message: 'Usuario SaaS desactivado exitosamente'
            });
        }
        catch (error) {
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }
    async getRoles(req, res) {
        try {
            const roles = await this.saasModel.getRoles();
            res.json({
                success: true,
                data: roles,
                message: 'Roles SaaS obtenidos exitosamente'
            });
        }
        catch (error) {
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }
    async createRole(req, res) {
        try {
            const validatedData = createRoleSchema.parse(req.body);
            const role = await this.saasModel.createRole(validatedData);
            res.status(201).json({
                success: true,
                data: role,
                message: 'Rol SaaS creado exitosamente'
            });
        }
        catch (error) {
            if (error instanceof zod_1.z.ZodError) {
                res.status(400).json({
                    success: false,
                    error: 'Datos de entrada inválidos',
                    details: error.errors
                });
            }
            else {
                res.status(500).json({
                    success: false,
                    error: error.message
                });
            }
        }
    }
    async getAnalytics(req, res) {
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
        }
        catch (error) {
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }
    async getUsersCount() {
        const result = await this.db.query('SELECT COUNT(*) FROM saas_users WHERE is_active = true');
        return parseInt(result.rows[0].count);
    }
    async getActiveSubscriptionsCount() {
        const result = await this.db.query('SELECT COUNT(*) FROM saas_subscriptions WHERE status = \'active\'');
        return parseInt(result.rows[0].count);
    }
    async getApiRequestsCount(timeRange) {
        const result = await this.db.query(`
      SELECT COUNT(*) FROM api_usage 
      WHERE timestamp >= NOW() - INTERVAL '1 ${timeRange}'
    `);
        return parseInt(result.rows[0].count);
    }
    async getMonthlyRevenue() {
        const result = await this.db.query(`
      SELECT COALESCE(SUM(price), 0) as revenue 
      FROM saas_subscriptions 
      WHERE status = 'active' 
      AND start_date >= DATE_TRUNC('month', CURRENT_DATE)
    `);
        return parseFloat(result.rows[0].revenue);
    }
}
exports.SaasAdminModule = SaasAdminModule;
exports.default = SaasAdminModule;
