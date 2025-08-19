"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApiTokenModule = void 0;
const zod_1 = require("zod");
const base_module_1 = require("./base_module");
const crypto_1 = __importDefault(require("crypto"));
const API_TOKEN_MODULE_CONFIG = {
    name: 'api_token_module',
    version: '1.0.0',
    enabled: true,
    dependencies: [],
    permissions: [
        'api_tokens:create',
        'api_tokens:read',
        'api_tokens:update',
        'api_tokens:delete',
        'api_tokens:regenerate'
    ],
    routes: [
        'POST /api-tokens',
        'GET /api-tokens',
        'GET /api-tokens/:id',
        'PUT /api-tokens/:id',
        'DELETE /api-tokens/:id',
        'POST /api-tokens/:id/regenerate'
    ]
};
const createApiTokenSchema = zod_1.z.object({
    name: zod_1.z.string().min(3, "El nombre debe tener al menos 3 caracteres"),
    description: zod_1.z.string().optional(),
    user_id: zod_1.z.string().uuid("ID de usuario inválido"),
    permissions: zod_1.z.array(zod_1.z.string()).default([]),
    rate_limit_per_minute: zod_1.z.number().int().positive().max(1000).default(100),
    expires_at: zod_1.z.string().datetime().optional().transform((val) => val ? new Date(val) : undefined),
    is_active: zod_1.z.boolean().default(true)
});
const updateApiTokenSchema = createApiTokenSchema.partial();
class ApiTokenModel {
    constructor(database) {
        this.db = database;
    }
    async createToken(tokenData) {
        const token = crypto_1.default.randomBytes(32).toString('hex');
        const tokenHash = crypto_1.default.createHash('sha256').update(token).digest('hex');
        const result = await this.db.query(`
      INSERT INTO api_tokens (
        name, description, user_id, token_hash, permissions, 
        rate_limit_per_minute, expires_at, is_active
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `, [
            tokenData.name, tokenData.description, tokenData.user_id, tokenHash,
            tokenData.permissions, tokenData.rate_limit_per_minute, tokenData.expires_at, tokenData.is_active
        ]);
        return { ...result.rows[0], token_hash: token };
    }
    async getTokensByUser(userId) {
        const result = await this.db.query(`
      SELECT * FROM api_tokens 
      WHERE user_id = $1 
      ORDER BY created_at DESC
    `, [userId]);
        return result.rows;
    }
    async getTokenById(id) {
        const result = await this.db.query(`
      SELECT * FROM api_tokens WHERE id = $1
    `, [id]);
        return result.rows[0] || null;
    }
    async getTokenByHash(tokenHash) {
        const result = await this.db.query(`
      SELECT * FROM api_tokens WHERE token_hash = $1 AND is_active = true
    `, [tokenHash]);
        return result.rows[0] || null;
    }
    async updateToken(id, updateData) {
        const fields = [];
        const values = [];
        let paramIndex = 1;
        for (const [key, value] of Object.entries(updateData)) {
            if (value !== undefined && key !== 'id' && key !== 'token_hash') {
                fields.push(`${key} = $${paramIndex++}`);
                values.push(value);
            }
        }
        if (fields.length === 0)
            return null;
        fields.push('updated_at = CURRENT_TIMESTAMP');
        values.push(id);
        const result = await this.db.query(`
      UPDATE api_tokens 
      SET ${fields.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `, values);
        return result.rows[0] || null;
    }
    async regenerateToken(id) {
        const newToken = crypto_1.default.randomBytes(32).toString('hex');
        const newTokenHash = crypto_1.default.createHash('sha256').update(newToken).digest('hex');
        const result = await this.db.query(`
      UPDATE api_tokens 
      SET token_hash = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING token_hash
    `, [newTokenHash, id]);
        if (result.rows[0]) {
            return { token: newToken, token_hash: newTokenHash };
        }
        return null;
    }
    async deleteToken(id) {
        const result = await this.db.query(`
      DELETE FROM api_tokens WHERE id = $1
    `, [id]);
        return (result.rowCount || 0) > 0;
    }
    async logTokenUsage(usageData) {
        await this.db.query(`
      INSERT INTO token_usage (
        token_id, endpoint, method, response_time, status_code, ip_address, user_agent
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [
            usageData.token_id, usageData.endpoint, usageData.method,
            usageData.response_time, usageData.status_code, usageData.ip_address, usageData.user_agent
        ]);
    }
    async checkRateLimit(tokenId) {
        const result = await this.db.query(`
      SELECT COUNT(*) as count 
      FROM token_usage 
      WHERE token_id = $1 
      AND timestamp >= NOW() - INTERVAL '1 minute'
    `, [tokenId]);
        const currentUsage = parseInt(result.rows[0].count);
        const tokenResult = await this.db.query(`
      SELECT rate_limit_per_minute FROM api_tokens WHERE id = $1
    `, [tokenId]);
        if (tokenResult.rows[0]) {
            return currentUsage < tokenResult.rows[0].rate_limit_per_minute;
        }
        return false;
    }
    async getTokenUsageStats(tokenId, timeRange = '30d') {
        const result = await this.db.query(`
      SELECT 
        DATE_TRUNC('day', timestamp) as date,
        COUNT(*) as total_requests,
        AVG(response_time) as avg_response_time,
        COUNT(CASE WHEN status_code >= 400 THEN 1 END) as error_count
      FROM token_usage 
      WHERE token_id = $1 
      AND timestamp >= NOW() - INTERVAL '1 ${timeRange}'
      GROUP BY DATE_TRUNC('day', timestamp)
      ORDER BY date DESC
    `, [tokenId]);
        return result.rows;
    }
}
class ApiTokenModule extends base_module_1.BaseModule {
    constructor(database) {
        super(database, API_TOKEN_MODULE_CONFIG);
        this.tokenModel = new ApiTokenModel(database);
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
                version: this.getVersion()
            }
        };
    }
    getRoutes() {
        return {
            'POST /api-tokens': this.createToken.bind(this),
            'GET /api-tokens': this.getTokens.bind(this),
            'GET /api-tokens/:id': this.getToken.bind(this),
            'PUT /api-tokens/:id': this.updateToken.bind(this),
            'DELETE /api-tokens/:id': this.deleteToken.bind(this),
            'POST /api-tokens/:id/regenerate': this.regenerateToken.bind(this)
        };
    }
    async createToken(req, res) {
        try {
            const validatedData = createApiTokenSchema.parse(req.body);
            const token = await this.tokenModel.createToken(validatedData);
            res.status(201).json({
                success: true,
                data: {
                    id: token.id,
                    name: token.name,
                    description: token.description,
                    user_id: token.user_id,
                    permissions: token.permissions,
                    rate_limit_per_minute: token.rate_limit_per_minute,
                    expires_at: token.expires_at,
                    is_active: token.is_active,
                    created_at: token.created_at
                },
                token: token.token_hash,
                message: 'Token API creado exitosamente'
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
    async getTokens(req, res) {
        try {
            const userId = req.query.user_id;
            if (!userId) {
                return res.status(400).json({
                    success: false,
                    error: 'user_id es requerido'
                });
            }
            const tokens = await this.tokenModel.getTokensByUser(userId);
            res.json({
                success: true,
                data: tokens.map(token => ({
                    ...token,
                    token_hash: undefined
                })),
                message: 'Tokens API obtenidos exitosamente'
            });
        }
        catch (error) {
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }
    async getToken(req, res) {
        try {
            const { id } = req.params;
            const token = await this.tokenModel.getTokenById(id);
            if (!token) {
                return res.status(404).json({
                    success: false,
                    error: 'Token API no encontrado'
                });
            }
            res.json({
                success: true,
                data: {
                    ...token,
                    token_hash: undefined
                },
                message: 'Token API obtenido exitosamente'
            });
        }
        catch (error) {
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }
    async updateToken(req, res) {
        try {
            const { id } = req.params;
            const validatedData = updateApiTokenSchema.parse(req.body);
            const updatedToken = await this.tokenModel.updateToken(id, validatedData);
            if (!updatedToken) {
                return res.status(404).json({
                    success: false,
                    error: 'Token API no encontrado'
                });
            }
            res.json({
                success: true,
                data: {
                    ...updatedToken,
                    token_hash: undefined
                },
                message: 'Token API actualizado exitosamente'
            });
        }
        catch (error) {
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }
    async deleteToken(req, res) {
        try {
            const { id } = req.params;
            const deleted = await this.tokenModel.deleteToken(id);
            if (!deleted) {
                return res.status(404).json({
                    success: false,
                    error: 'Token API no encontrado'
                });
            }
            res.json({
                success: true,
                message: 'Token API eliminado exitosamente'
            });
        }
        catch (error) {
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }
    async regenerateToken(req, res) {
        try {
            const { id } = req.params;
            const result = await this.tokenModel.regenerateToken(id);
            if (!result) {
                return res.status(404).json({
                    success: false,
                    error: 'Token API no encontrado'
                });
            }
            res.json({
                success: true,
                data: {
                    id,
                    new_token_hash: result.token_hash
                },
                message: 'Token API regenerado exitosamente'
            });
        }
        catch (error) {
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }
    async validateApiToken(token, endpoint, method) {
        try {
            const tokenHash = crypto_1.default.createHash('sha256').update(token).digest('hex');
            const apiToken = await this.tokenModel.getTokenByHash(tokenHash);
            if (!apiToken) {
                return { valid: false };
            }
            if (apiToken.expires_at && new Date() > apiToken.expires_at) {
                return { valid: false };
            }
            const rateLimitOk = await this.tokenModel.checkRateLimit(apiToken.id);
            if (!rateLimitOk) {
                return {
                    valid: false,
                    rate_limit_exceeded: true
                };
            }
            await this.tokenModel.logTokenUsage({
                token_id: apiToken.id,
                endpoint,
                method,
                response_time: 0,
                status_code: 200,
                ip_address: '0.0.0.0',
                user_agent: 'API Client'
            });
            return {
                valid: true,
                user_id: apiToken.user_id,
                permissions: apiToken.permissions
            };
        }
        catch (error) {
            console.error('Error validating API token:', error);
            return { valid: false };
        }
    }
}
exports.ApiTokenModule = ApiTokenModule;
exports.default = ApiTokenModule;
