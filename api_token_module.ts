import { Pool, QueryResult } from 'pg';
import { z } from 'zod';
import { BaseModule, ModuleConfig, Permission } from './base_module';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';

const API_TOKEN_MODULE_CONFIG: ModuleConfig = {
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

// Esquemas de validación
const createApiTokenSchema = z.object({
  name: z.string().min(3, "El nombre debe tener al menos 3 caracteres"),
  description: z.string().optional(),
  user_id: z.string().uuid("ID de usuario inválido"),
  permissions: z.array(z.string()).default([]),
  rate_limit_per_minute: z.number().int().positive().max(1000).default(100),
  expires_at: z.string().datetime().optional().transform((val) => val ? new Date(val) : undefined),
  is_active: z.boolean().default(true)
});

const updateApiTokenSchema = createApiTokenSchema.partial();

// Interfaces
interface ApiToken {
  id: string;
  name: string;
  description?: string;
  user_id: string;
  token_hash: string;
  permissions: string[];
  rate_limit_per_minute: number;
  expires_at?: Date;
  is_active: boolean;
  last_used?: Date;
  created_at: Date;
  updated_at: Date;
}

interface TokenUsage {
  id: string;
  token_id: string;
  endpoint: string;
  method: string;
  response_time: number;
  status_code: number;
  ip_address: string;
  user_agent?: string;
  timestamp: Date;
}

// Modelo para operaciones de base de datos
class ApiTokenModel {
  private db: Pool;

  constructor(database: Pool) {
    this.db = database;
  }

  // Crear token API
  async createToken(tokenData: Omit<ApiToken, 'id' | 'token_hash' | 'created_at' | 'updated_at'>): Promise<ApiToken> {
    // Generar token aleatorio
    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    const result: QueryResult<ApiToken> = await this.db.query(`
      INSERT INTO api_tokens (
        name, description, user_id, token_hash, permissions, 
        rate_limit_per_minute, expires_at, is_active
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `, [
      tokenData.name, tokenData.description, tokenData.user_id, tokenHash,
      tokenData.permissions, tokenData.rate_limit_per_minute, tokenData.expires_at, tokenData.is_active
    ]);

    // Retornar el token con el hash (no el token original por seguridad)
    return { ...result.rows[0], token_hash: token };
  }

  // Obtener tokens por usuario
  async getTokensByUser(userId: string): Promise<ApiToken[]> {
    const result: QueryResult<ApiToken> = await this.db.query(`
      SELECT * FROM api_tokens 
      WHERE user_id = $1 
      ORDER BY created_at DESC
    `, [userId]);

    return result.rows;
  }

  // Obtener token por ID
  async getTokenById(id: string): Promise<ApiToken | null> {
    const result: QueryResult<ApiToken> = await this.db.query(`
      SELECT * FROM api_tokens WHERE id = $1
    `, [id]);

    return result.rows[0] || null;
  }

  // Obtener token por hash
  async getTokenByHash(tokenHash: string): Promise<ApiToken | null> {
    const result: QueryResult<ApiToken> = await this.db.query(`
      SELECT * FROM api_tokens WHERE token_hash = $1 AND is_active = true
    `, [tokenHash]);

    return result.rows[0] || null;
  }

  // Actualizar token
  async updateToken(id: string, updateData: Partial<ApiToken>): Promise<ApiToken | null> {
    const fields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    for (const [key, value] of Object.entries(updateData)) {
      if (value !== undefined && key !== 'id' && key !== 'token_hash') {
        fields.push(`${key} = $${paramIndex++}`);
        values.push(value);
      }
    }

    if (fields.length === 0) return null;

    fields.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);

    const result: QueryResult<ApiToken> = await this.db.query(`
      UPDATE api_tokens 
      SET ${fields.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `, values);

    return result.rows[0] || null;
  }

  // Regenerar token
  async regenerateToken(id: string): Promise<{ token: string; token_hash: string } | null> {
    const newToken = crypto.randomBytes(32).toString('hex');
    const newTokenHash = crypto.createHash('sha256').update(newToken).digest('hex');

    const result: QueryResult<ApiToken> = await this.db.query(`
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

  // Eliminar token
  async deleteToken(id: string): Promise<boolean> {
    const result: QueryResult<ApiToken> = await this.db.query(`
      DELETE FROM api_tokens WHERE id = $1
    `, [id]);

    return (result.rowCount || 0) > 0;
  }

  // Registrar uso del token
  async logTokenUsage(usageData: Omit<TokenUsage, 'id' | 'timestamp'>): Promise<void> {
    await this.db.query(`
      INSERT INTO token_usage (
        token_id, endpoint, method, response_time, status_code, ip_address, user_agent
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [
      usageData.token_id, usageData.endpoint, usageData.method,
      usageData.response_time, usageData.status_code, usageData.ip_address, usageData.user_agent
    ]);
  }

  // Verificar límite de rate
  async checkRateLimit(tokenId: string): Promise<boolean> {
    const result: QueryResult<{ count: string }> = await this.db.query(`
      SELECT COUNT(*) as count 
      FROM token_usage 
      WHERE token_id = $1 
      AND timestamp >= NOW() - INTERVAL '1 minute'
    `, [tokenId]);

    const currentUsage = parseInt(result.rows[0].count);
    
    // Obtener límite del token
    const tokenResult: QueryResult<{ rate_limit_per_minute: number }> = await this.db.query(`
      SELECT rate_limit_per_minute FROM api_tokens WHERE id = $1
    `, [tokenId]);

    if (tokenResult.rows[0]) {
      return currentUsage < tokenResult.rows[0].rate_limit_per_minute;
    }

    return false;
  }

  // Obtener estadísticas de uso
  async getTokenUsageStats(tokenId: string, timeRange: string = '30d'): Promise<any> {
    const result: QueryResult<TokenUsage> = await this.db.query(`
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

// Módulo principal de tokens API
export class ApiTokenModule extends BaseModule {
  private tokenModel: ApiTokenModel;

  constructor(database: Pool) {
    super(database, API_TOKEN_MODULE_CONFIG);
    this.tokenModel = new ApiTokenModel(database);
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
        version: this.getVersion()
      }
    };
  }

  getRoutes(): Record<string, Function> {
    return {
      'POST /api-tokens': this.createToken.bind(this),
      'GET /api-tokens': this.getTokens.bind(this),
      'GET /api-tokens/:id': this.getToken.bind(this),
      'PUT /api-tokens/:id': this.updateToken.bind(this),
      'DELETE /api-tokens/:id': this.deleteToken.bind(this),
      'POST /api-tokens/:id/regenerate': this.regenerateToken.bind(this)
    };
  }

  // Métodos de la API
  async createToken(req: any, res: any): Promise<void> {
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
        token: token.token_hash, // Solo mostrar el hash por seguridad
        message: 'Token API creado exitosamente'
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

  async getTokens(req: any, res: any): Promise<void> {
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
          token_hash: undefined // No exponer el hash
        })),
        message: 'Tokens API obtenidos exitosamente'
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  async getToken(req: any, res: any): Promise<void> {
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
          token_hash: undefined // No exponer el hash
        },
        message: 'Token API obtenido exitosamente'
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  async updateToken(req: any, res: any): Promise<void> {
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
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  async deleteToken(req: any, res: any): Promise<void> {
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
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  async regenerateToken(req: any, res: any): Promise<void> {
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
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  // Middleware para validar tokens API
  async validateApiToken(token: string, endpoint: string, method: string): Promise<{
    valid: boolean;
    user_id?: string;
    permissions?: string[];
    rate_limit_exceeded?: boolean;
  }> {
    try {
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
      const apiToken = await this.tokenModel.getTokenByHash(tokenHash);

      if (!apiToken) {
        return { valid: false };
      }

      // Verificar si el token ha expirado
      if (apiToken.expires_at && new Date() > apiToken.expires_at) {
        return { valid: false };
      }

      // Verificar rate limit
      const rateLimitOk = await this.tokenModel.checkRateLimit(apiToken.id);
      if (!rateLimitOk) {
        return { 
          valid: false, 
          rate_limit_exceeded: true 
        };
      }

      // Registrar uso del token
      await this.tokenModel.logTokenUsage({
        token_id: apiToken.id,
        endpoint,
        method,
        response_time: 0, // Se actualizará después
        status_code: 200,
        ip_address: '0.0.0.0', // Se actualizará con IP real
        user_agent: 'API Client'
      });

      return {
        valid: true,
        user_id: apiToken.user_id,
        permissions: apiToken.permissions
      };
    } catch (error) {
      console.error('Error validating API token:', error);
      return { valid: false };
    }
  }
}

export default ApiTokenModule;
