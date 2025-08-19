import { Pool, QueryResult } from 'pg';
import { z } from 'zod';
import { BaseModule, ModuleConfig, Permission } from './base_module';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const DEMO_MODULE_ENHANCED_CONFIG: ModuleConfig = {
  name: 'demo_enhanced',
  version: '2.3.0',
  enabled: true,
  dependencies: [],
  permissions: [
    'demo:read', 'demo:create', 'demo:update', 'demo:delete',
    'demo:admin', 'demo:seller', 'demo:developer', 'demo:sales', 'demo:support',
    'demo:view_examples', 'demo:simulate_api', 'demo:generate_code',
    'demo:export_data', 'demo:create_custom', 'demo:share', 'demo:analytics'
  ] as Permission[],
  routes: [
    'POST /api/v1/demo/login',
    'GET /api/v1/demo/dashboard',
    'GET /api/v1/demo/examples/:module',
    'GET /api/v1/demo/modules',
    'POST /api/v1/demo/execute/:action',
    'POST /api/v1/demo/simulate/:module/:endpoint',
    'POST /api/v1/demo/generate-code',
    'GET /api/v1/demo/export/:type',
    'POST /api/v1/demo/analytics',
    'GET /api/v1/demo/search',
    'POST /api/v1/demo/playground/execute',
    'GET /api/v1/demo/playground/history'
  ]
};

// Enhanced validation schemas
const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6)
});

const SimulateApiSchema = z.object({
  method: z.enum(['GET', 'POST', 'PUT', 'DELETE', 'PATCH']),
  body: z.record(z.any()).optional(),
  headers: z.record(z.string()).optional(),
  params: z.record(z.string()).optional(),
  query: z.record(z.string()).optional()
});

const GenerateCodeSchema = z.object({
  language: z.enum(['javascript', 'python', 'curl', 'php', 'java', 'csharp']),
  endpoint: z.string(),
  method: z.string(),
  data: z.record(z.any()).optional()
});

const PlaygroundExecuteSchema = z.object({
  code: z.string(),
  language: z.string(),
  inputs: z.record(z.any()).optional()
});

// Enhanced interfaces
interface DemoUser {
  id: string;
  email: string;
  role: 'admin' | 'seller' | 'developer' | 'sales' | 'support';
  name: string;
  permissions: string[];
  preferences: {
    theme: string;
    language: string;
    autoSave: boolean;
    notifications: boolean;
  };
  created_at: Date;
  last_login: Date;
}

interface ModuleExample {
  name: string;
  description: string;
  endpoints: string[];
  examples: {
    request: any;
    response: any;
    description: string;
    tags: string[];
    difficulty: 'beginner' | 'intermediate' | 'advanced';
  }[];
  visual_data?: any;
  code_snippets?: {
    language: string;
    code: string;
    description: string;
  }[];
}

interface ApiSimulation {
  id: string;
  module: string;
  endpoint: string;
  method: string;
  request: any;
  response: any;
  execution_time: number;
  status_code: number;
  timestamp: Date;
  user_id: string;
}

interface CodeGeneration {
  language: string;
  code: string;
  description: string;
  dependencies: string[];
  usage_examples: string[];
}

interface PlaygroundSession {
  id: string;
  user_id: string;
  code: string;
  language: string;
  result: any;
  execution_time: number;
  timestamp: Date;
  success: boolean;
  error_message?: string;
}

// Enhanced database model
class DemoEnhancedModel {
  private db: Pool;

  constructor(db: Pool) {
    this.db = db;
  }

  async initialize(): Promise<void> {
    const createTablesQuery = `
      -- Enhanced demo users table
      CREATE TABLE IF NOT EXISTS demo_users_enhanced (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        role VARCHAR(50) NOT NULL CHECK (role IN ('admin', 'seller', 'developer', 'sales', 'support')),
        name VARCHAR(255) NOT NULL,
        permissions TEXT[] NOT NULL,
        preferences JSONB DEFAULT '{"theme": "light", "language": "es", "autoSave": true, "notifications": true}',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_login TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- API simulations table
      CREATE TABLE IF NOT EXISTS api_simulations (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        module VARCHAR(100) NOT NULL,
        endpoint VARCHAR(255) NOT NULL,
        method VARCHAR(10) NOT NULL,
        request JSONB,
        response JSONB,
        execution_time INTEGER,
        status_code INTEGER,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        user_id UUID REFERENCES demo_users_enhanced(id)
      );

      -- Playground sessions table
      CREATE TABLE IF NOT EXISTS playground_sessions (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID REFERENCES demo_users_enhanced(id),
        code TEXT NOT NULL,
        language VARCHAR(50) NOT NULL,
        result JSONB,
        execution_time INTEGER,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        success BOOLEAN DEFAULT true,
        error_message TEXT
      );

      -- User activity tracking
      CREATE TABLE IF NOT EXISTS user_activity (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID REFERENCES demo_users_enhanced(id),
        action VARCHAR(100) NOT NULL,
        module VARCHAR(100),
        details JSONB,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;

    const insertDemoUsersQuery = `
      INSERT INTO demo_users_enhanced (email, password_hash, role, name, permissions) VALUES
      ('admin@demo.com', $1, 'admin', 'Administrador Demo', ARRAY['demo:admin', 'demo:view_examples', 'demo:read', 'demo:create', 'demo:update', 'demo:delete', 'demo:simulate_api', 'demo:generate_code', 'demo:export_data', 'demo:create_custom', 'demo:share', 'demo:analytics']),
      ('vendedor@demo.com', $2, 'seller', 'Vendedor Demo', ARRAY['demo:seller', 'demo:view_examples', 'demo:read', 'demo:simulate_api']),
      ('developer@demo.com', $3, 'developer', 'Desarrollador Demo', ARRAY['demo:developer', 'demo:view_examples', 'demo:read', 'demo:simulate_api', 'demo:generate_code', 'demo:playground']),
      ('sales@demo.com', $4, 'sales', 'Ventas Demo', ARRAY['demo:sales', 'demo:view_examples', 'demo:read', 'demo:analytics']),
      ('support@demo.com', $5, 'support', 'Soporte Demo', ARRAY['demo:support', 'demo:view_examples', 'demo:read', 'demo:simulate_api'])
      ON CONFLICT (email) DO NOTHING;
    `;

    try {
      await this.db.query(createTablesQuery);
      
      // Create demo users with hashed passwords
      const passwords = ['admin123', 'vendedor123', 'developer123', 'sales123', 'support123'];
      const hashedPasswords = await Promise.all(passwords.map(pwd => bcrypt.hash(pwd, 10)));
      
      await this.db.query(insertDemoUsersQuery, hashedPasswords);
      console.log('✅ Enhanced demo users created successfully');
    } catch (error) {
      console.error('❌ Error creating enhanced demo users:', error);
    }
  }

  async findUserByEmail(email: string): Promise<DemoUser | null> {
    try {
      const result = await this.db.query(
        'SELECT id, email, role, name, permissions, preferences, created_at, last_login FROM demo_users_enhanced WHERE email = $1',
        [email]
      );
      
      if (result.rows.length === 0) return null;
      
      const user = result.rows[0];
      return {
        ...user,
        permissions: user.permissions || [],
        preferences: user.preferences || {
          theme: 'light',
          language: 'es',
          autoSave: true,
          notifications: true
        }
      };
    } catch (error) {
      console.error('Error finding user:', error);
      return null;
    }
  }

  async validatePassword(email: string, password: string): Promise<DemoUser | null> {
    try {
      const result = await this.db.query(
        'SELECT * FROM demo_users_enhanced WHERE email = $1',
        [email]
      );
      
      if (result.rows.length === 0) return null;
      
      const user = result.rows[0];
      const isValid = await bcrypt.compare(password, user.password_hash);
      
      if (!isValid) return null;
      
      // Update last login
      await this.db.query(
        'UPDATE demo_users_enhanced SET last_login = CURRENT_TIMESTAMP WHERE id = $1',
        [user.id]
      );
      
      return {
        id: user.id,
        email: user.email,
        role: user.role,
        name: user.name,
        permissions: user.permissions || [],
        preferences: user.preferences || {
          theme: 'light',
          language: 'es',
          autoSave: true,
          notifications: true
        },
        created_at: user.created_at,
        last_login: new Date()
      };
    } catch (error) {
      console.error('Error validating password:', error);
      return null;
    }
  }

  async saveApiSimulation(simulation: Omit<ApiSimulation, 'id' | 'timestamp'>): Promise<string> {
    try {
      const result = await this.db.query(
        `INSERT INTO api_simulations (module, endpoint, method, request, response, execution_time, status_code, user_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
        [simulation.module, simulation.endpoint, simulation.method, simulation.request, simulation.response, simulation.execution_time, simulation.status_code, simulation.user_id]
      );
      
      return result.rows[0].id;
    } catch (error) {
      console.error('Error saving API simulation:', error);
      throw error;
    }
  }

  async savePlaygroundSession(session: Omit<PlaygroundSession, 'id' | 'timestamp'>): Promise<string> {
    try {
      const result = await this.db.query(
        `INSERT INTO playground_sessions (user_id, code, language, result, execution_time, success, error_message)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
        [session.user_id, session.code, session.language, session.result, session.execution_time, session.success, session.error_message]
      );
      
      return result.rows[0].id;
    } catch (error) {
      console.error('Error saving playground session:', error);
      throw error;
    }
  }

  async trackUserActivity(userId: string, action: string, module?: string, details?: any): Promise<void> {
    try {
      await this.db.query(
        'INSERT INTO user_activity (user_id, action, module, details) VALUES ($1, $2, $3, $4)',
        [userId, action, module, details]
      );
    } catch (error) {
      console.error('Error tracking user activity:', error);
    }
  }

  async getUserAnalytics(userId: string): Promise<any> {
    try {
      const [simulations, sessions, activity] = await Promise.all([
        this.db.query('SELECT COUNT(*) as total, AVG(execution_time) as avg_time FROM api_simulations WHERE user_id = $1', [userId]),
        this.db.query('SELECT COUNT(*) as total, AVG(execution_time) as avg_time FROM playground_sessions WHERE user_id = $1', [userId]),
        this.db.query('SELECT action, COUNT(*) as count FROM user_activity WHERE user_id = $1 GROUP BY action', [userId])
      ]);
      
      return {
        simulations: simulations.rows[0],
        sessions: sessions.rows[0],
        activity: activity.rows
      };
    } catch (error) {
      console.error('Error getting user analytics:', error);
      return null;
    }
  }

  async getPlaygroundHistory(userId: string): Promise<any[]> {
    try {
      const result = await this.db.query(`
        SELECT 
          id,
          code,
          language,
          result,
          execution_time,
          success,
          error_message,
          timestamp
        FROM playground_sessions 
        WHERE user_id = $1 
        ORDER BY timestamp DESC 
        LIMIT 50
      `, [userId]);
      
      return result.rows;
    } catch (error) {
      console.error('Error getting playground history:', error);
      return [];
    }
  }
}

export class DemoEnhancedModule extends BaseModule {
  private model: DemoEnhancedModel;
  private jwtSecret: string;

  constructor(database: Pool, jwtSecret: string) {
    super(database, DEMO_MODULE_ENHANCED_CONFIG);
    this.model = new DemoEnhancedModel(database);
    this.jwtSecret = jwtSecret;
  }

  async initialize(): Promise<void> {
    try {
      await this.model.initialize();
      this.initialized = true;
      console.log('✅ DemoEnhancedModule initialized successfully');
    } catch (error) {
      console.error('❌ Error initializing DemoEnhancedModule:', error);
      throw error;
    }
  }

  async cleanup(): Promise<void> {
    this.initialized = false;
  }

  async getHealth(): Promise<{ status: string; details?: any }> {
    try {
      const [users, simulations, sessions] = await Promise.all([
        this.db.query('SELECT COUNT(*) FROM demo_users_enhanced'),
        this.db.query('SELECT COUNT(*) FROM api_simulations'),
        this.db.query('SELECT COUNT(*) FROM playground_sessions')
      ]);
      
      return {
        status: 'healthy',
        details: {
          demo_users: parseInt(users.rows[0].count),
          api_simulations: parseInt(simulations.rows[0].count),
          playground_sessions: parseInt(sessions.rows[0].count),
          available_modules: this.getAvailableModules().length,
          examples_count: this.getExamplesCount()
        }
      };
    } catch (error) {
      return {
        status: 'error',
        details: { error: (error as any).message }
      };
    }
  }

  getRoutes(): Record<string, Function> {
    return {
      'POST /api/v1/demo/login': this.login.bind(this),
      'GET /api/v1/demo/dashboard': this.getDashboard.bind(this),
      'GET /api/v1/demo/examples/:module': this.getModuleExamples.bind(this),
      'GET /api/v1/demo/modules': this.getAvailableModules.bind(this),
      'POST /api/v1/demo/execute/:action': this.executeAction.bind(this),
      'POST /api/v1/demo/simulate/:module/:endpoint': this.simulateApi.bind(this),
      'POST /api/v1/demo/generate-code': this.generateCode.bind(this),
      'GET /api/v1/demo/export/:type': this.exportData.bind(this),
      'POST /api/v1/demo/analytics': this.getAnalytics.bind(this),
      'GET /api/v1/demo/search': this.searchContent.bind(this),
      'POST /api/v1/demo/playground/execute': this.executePlayground.bind(this),
      'GET /api/v1/demo/playground/history': this.getPlaygroundHistory.bind(this)
    };
  }

  // Enhanced login with role-based permissions
  async login(req: any, res: any): Promise<void> {
    try {
      const { email, password } = LoginSchema.parse(req.body);
      
      const user = await this.model.validatePassword(email, password);
      if (!user) {
        res.status(401).json({
          success: false,
          error: {
            code: 'INVALID_CREDENTIALS',
            message: 'Credenciales inválidas'
          }
        });
        return;
      }

      // Track login activity
      await this.model.trackUserActivity(user.id, 'login', 'auth');

      // Generate token JWT with enhanced payload
      const token = jwt.sign(
        { 
          userId: user.id, 
          email: user.email, 
          role: user.role,
          permissions: user.permissions,
          preferences: user.preferences
        },
        this.jwtSecret,
        { expiresIn: '24h' }
      );

      res.json({
        success: true,
        data: {
          token,
          user: {
            id: user.id,
            email: user.email,
            role: user.role,
            name: user.name,
            permissions: user.permissions,
            preferences: user.preferences
          }
        }
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: error.message
        }
      });
    }
  }

  // Enhanced dashboard with analytics
  async getDashboard(req: any, res: any): Promise<void> {
    try {
      const modules = this.getAvailableModules();
      const stats = {
        total_modules: modules.length,
        total_examples: this.getExamplesCount(),
        demo_users: 5, // Enhanced with more roles
        system_status: 'operational'
      };

      // Track dashboard access
      await this.model.trackUserActivity(req.user.userId, 'dashboard_access');

      res.json({
        success: true,
        data: {
          stats,
          modules: modules.map(m => ({
            name: m.name,
            description: m.description,
            examples_count: m.examples.length,
            difficulty_levels: this.getDifficultyLevels(m.examples)
          })),
          quick_actions: [
            'Ver ejemplos de documentos',
            'Probar sistema de firmas',
            'Explorar analytics',
            'Gestionar usuarios SaaS',
            'Simular APIs',
            'Generar código',
            'Playground interactivo'
          ],
          user_role: req.user.role,
          available_features: this.getAvailableFeatures(req.user.role)
        }
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: error.message
        }
      });
    }
  }

  // API Simulation endpoint
  async simulateApi(req: any, res: any): Promise<void> {
    try {
      const { module, endpoint } = req.params;
      const simulationData = SimulateApiSchema.parse(req.body);
      
      const startTime = Date.now();
      
      // Simulate API call based on module and endpoint
      const result = await this.simulateApiCall(module, endpoint, simulationData);
      
      const executionTime = Date.now() - startTime;
      
      // Save simulation to database
      const simulationId = await this.model.saveApiSimulation({
        module,
        endpoint,
        method: simulationData.method,
        request: simulationData,
        response: result,
        execution_time: executionTime,
        status_code: 200,
        user_id: req.user.userId
      });
      
      // Track activity
      await this.model.trackUserActivity(req.user.userId, 'api_simulation', module, {
        endpoint,
        method: simulationData.method,
        simulation_id: simulationId
      });

      res.json({
        success: true,
        data: {
          simulation_id: simulationId,
          result,
          execution_time: executionTime,
          timestamp: new Date().toISOString()
        }
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        error: {
          code: 'SIMULATION_ERROR',
          message: error.message
        }
      });
    }
  }

  // Code generation endpoint
  async generateCode(req: any, res: any): Promise<void> {
    try {
      const { language, endpoint, method, data } = GenerateCodeSchema.parse(req.body);
      
      const generatedCode = this.generateCodeForLanguage(language, endpoint, method, data);
      
      // Track activity
      await this.model.trackUserActivity(req.user.userId, 'code_generation', 'codegen', {
        language,
        endpoint,
        method
      });

      res.json({
        success: true,
        data: generatedCode
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        error: {
          code: 'CODE_GENERATION_ERROR',
          message: error.message
        }
      });
    }
  }

  // Playground execution endpoint
  async executePlayground(req: any, res: any): Promise<void> {
    try {
      const { code, language, inputs } = PlaygroundExecuteSchema.parse(req.body);
      
      const startTime = Date.now();
      
      // Execute code in sandbox environment
      const result = await this.executeCodeInSandbox(code, language, inputs);
      
      const executionTime = Date.now() - startTime;
      
      // Save playground session
      const sessionId = await this.model.savePlaygroundSession({
        user_id: req.user.userId,
        code,
        language,
        result: result.output,
        execution_time: executionTime,
        success: result.success,
        error_message: result.error
      });
      
      // Track activity
      await this.model.trackUserActivity(req.user.userId, 'playground_execution', 'playground', {
        language,
        session_id: sessionId,
        success: result.success
      });

      res.json({
        success: true,
        data: {
          session_id: sessionId,
          result: result.output,
          execution_time: executionTime,
          success: result.success,
          error: result.error,
          timestamp: new Date().toISOString()
        }
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        error: {
          code: 'PLAYGROUND_ERROR',
          message: error.message
        }
      });
    }
  }

  // Analytics endpoint
  async getAnalytics(req: any, res: any): Promise<void> {
    try {
      const analytics = await this.model.getUserAnalytics(req.user.userId);
      
      res.json({
        success: true,
        data: analytics
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: {
          code: 'ANALYTICS_ERROR',
          message: error.message
        }
      });
    }
  }

  // Search endpoint
  async searchContent(req: any, res: any): Promise<void> {
    try {
      const { query, filters } = req.query;
      
      if (!query || query.length < 2) {
        res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_QUERY',
            message: 'Query debe tener al menos 2 caracteres'
          }
        });
        return;
      }
      
      const results = this.performSearch(query, filters);
      
      // Track search activity
      await this.model.trackUserActivity(req.user.userId, 'search', 'search', {
        query,
        results_count: results.length
      });

      res.json({
        success: true,
        data: {
          query,
          results,
          total: results.length
        }
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: {
          code: 'SEARCH_ERROR',
          message: error.message
        }
      });
    }
  }

  // Export data endpoint
  async exportData(req: any, res: any): Promise<void> {
    try {
      const { type } = req.params;
      const { format = 'json' } = req.query;
      
      const data = await this.exportDataByType(type, req.user.userId, format);
      
      // Track export activity
      await this.model.trackUserActivity(req.user.userId, 'data_export', 'export', {
        type,
        format
      });

      res.json({
        success: true,
        data: {
          type,
          format,
          data,
          timestamp: new Date().toISOString()
        }
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        error: {
          code: 'EXPORT_ERROR',
          message: error.message
        }
      });
    }
  }

  // Helper methods
  private async simulateApiCall(module: string, endpoint: string, data: any): Promise<any> {
    // Simulate different API responses based on module and endpoint
    const simulations = {
      documents: {
        'POST /api/v1/documents': {
          success: true,
          data: {
            id: `doc_${uuidv4().substr(0, 8)}`,
            title: data.body?.title || 'Documento de ejemplo',
            status: 'created',
            created_at: new Date().toISOString()
          }
        },
        'GET /api/v1/documents': {
          success: true,
          data: [
            {
              id: 'doc_123456',
              title: 'Contrato de Arrendamiento',
              status: 'draft'
            }
          ],
          pagination: {
            page: 1,
            limit: 10,
            total: 1
          }
        }
      },
      signatures: {
        'POST /api/v1/signatures': {
          success: true,
          data: {
            id: `sig_${uuidv4().substr(0, 8)}`,
            status: 'pending',
            sign_url: `https://app.notarypro.com/sign/sig_${uuidv4().substr(0, 8)}`
          }
        }
      }
    };
    
    const moduleSims = simulations[module as keyof typeof simulations];
    if (moduleSims && moduleSims[endpoint as keyof typeof moduleSims]) {
      return moduleSims[endpoint as keyof typeof moduleSims];
    }
    
    // Default response
    return {
      success: true,
      data: {
        message: `Simulación de ${module} - ${endpoint}`,
        timestamp: new Date().toISOString()
      }
    };
  }

  private generateCodeForLanguage(language: string, endpoint: string, method: string, data?: any): CodeGeneration {
    const templates = {
      javascript: {
        code: `// NotaryPro API Client - ${method} ${endpoint}
const response = await fetch('${endpoint}', {
  method: '${method}',
  headers: {
    'Authorization': 'Bearer YOUR_TOKEN',
    'Content-Type': 'application/json'
  }${data ? `,
  body: JSON.stringify(${JSON.stringify(data, null, 2)})` : ''}
});

const result = await response.json();
console.log(result);`,
        description: `JavaScript client para ${method} ${endpoint}`,
        dependencies: ['fetch API'],
        usage_examples: ['Browser environment', 'Node.js with node-fetch']
      },
      python: {
        code: `# NotaryPro API Client - ${method} ${endpoint}
import requests

response = requests.${method.toLowerCase()}('${endpoint}', 
  headers={
    'Authorization': 'Bearer YOUR_TOKEN',
    'Content-Type': 'application/json'
  }${data ? `,
  json=${JSON.stringify(data, null, 2)}` : ''}
)

result = response.json()
print(result)`,
        description: `Python client para ${method} ${endpoint}`,
        dependencies: ['requests'],
        usage_examples: ['Python 3.6+', 'Virtual environment recommended']
      },
      curl: {
        code: `# NotaryPro API Client - ${method} ${endpoint}
curl -X ${method} '${endpoint}' \\
  -H 'Authorization: Bearer YOUR_TOKEN' \\
  -H 'Content-Type: application/json'${data ? ` \\
  -d '${JSON.stringify(data)}'` : ''}`,
        description: `cURL command para ${method} ${endpoint}`,
        dependencies: ['curl'],
        usage_examples: ['Terminal', 'Command line', 'Shell scripts']
      }
    };
    
    const template = templates[language as keyof typeof templates] || templates.javascript;
    return {
      ...template,
      language: language
    };
  }

  private async executeCodeInSandbox(code: string, language: string, inputs?: any): Promise<{ output: any; success: boolean; error?: string }> {
    try {
      // Simple sandbox execution (in production, use proper sandboxing)
      if (language === 'javascript') {
        // Basic JavaScript evaluation (limited for security)
        const safeCode = code.replace(/require|import|eval|Function|global|process/g, '');
        const result = new Function('inputs', safeCode);
        const output = result(inputs);
        
        return {
          output,
          success: true
        };
      } else if (language === 'python') {
        // Python simulation (would need proper Python runtime)
        return {
          output: `Python execution simulated: ${code}`,
          success: true
        };
      } else {
        return {
          output: `Language ${language} not supported in sandbox`,
          success: false,
          error: 'Unsupported language'
        };
      }
    } catch (error: any) {
      return {
        output: null,
        success: false,
        error: error.message
      };
    }
  }

  private performSearch(query: string, filters?: any): any[] {
    // Simple search implementation
    const allContent = this.getAllSearchableContent();
    
    return allContent.filter(item => 
      item.name.toLowerCase().includes(query.toLowerCase()) ||
      item.description.toLowerCase().includes(query.toLowerCase()) ||
      item.tags?.some((tag: string) => tag.toLowerCase().includes(query.toLowerCase()))
    );
  }

  private getAllSearchableContent(): any[] {
    const modules = this.getAvailableModules();
    const content: any[] = [];
    
    modules.forEach(module => {
      content.push({
        type: 'module',
        name: module.name,
        description: module.description,
        tags: [module.name, 'module']
      });
      
      module.examples.forEach(example => {
        content.push({
          type: 'example',
          name: example.description,
          description: example.description,
          tags: [...example.tags, 'example']
        });
      });
    });
    
    return content;
  }

  private async exportDataByType(type: string, userId: string, format: string): Promise<any> {
    switch (type) {
      case 'simulations':
        const simulations = await this.db.query(
          'SELECT * FROM api_simulations WHERE user_id = $1 ORDER BY timestamp DESC',
          [userId]
        );
        return simulations.rows;
        
      case 'playground':
        const sessions = await this.db.query(
          'SELECT * FROM playground_sessions WHERE user_id = $1 ORDER BY timestamp DESC',
          [userId]
        );
        return sessions.rows;
        
      case 'activity':
        const activity = await this.db.query(
          'SELECT * FROM user_activity WHERE user_id = $1 ORDER BY timestamp DESC',
          [userId]
        );
        return activity.rows;
        
      default:
        throw new Error(`Tipo de exportación no soportado: ${type}`);
    }
  }

  private getDifficultyLevels(examples: any[]): Record<string, number> {
    const levels = { beginner: 0, intermediate: 0, advanced: 0 };
    examples.forEach(example => {
      const difficulty = example.difficulty as keyof typeof levels;
      levels[difficulty] = (levels[difficulty] || 0) + 1;
    });
    return levels;
  }

  private getAvailableFeatures(role: string): string[] {
    const features = {
      admin: ['all_features'],
      seller: ['view_examples', 'simulate_api', 'basic_analytics'],
      developer: ['view_examples', 'simulate_api', 'generate_code', 'playground', 'advanced_analytics'],
      sales: ['view_examples', 'analytics', 'export_data'],
      support: ['view_examples', 'simulate_api', 'basic_analytics']
    };
    
    return features[role as keyof typeof features] || ['view_examples'];
  }

  // Enhanced module examples with code snippets
  private getAvailableModules(): ModuleExample[] {
    return [
      {
        name: 'documents',
        description: 'Sistema de gestión de documentos',
        endpoints: [
          'GET /api/v1/documents',
          'POST /api/v1/documents',
          'GET /api/v1/documents/:id',
          'PUT /api/v1/documents/:id',
          'DELETE /api/v1/documents/:id'
        ],
        examples: [
          {
            request: {
              method: 'POST',
              endpoint: '/api/v1/documents',
              body: {
                title: 'Contrato de Arrendamiento',
                content: 'Este contrato establece...',
                type: 'contract',
                status: 'draft'
              }
            },
            response: {
              success: true,
              data: {
                id: 'doc_123456',
                title: 'Contrato de Arrendamiento',
                status: 'draft',
                created_at: '2024-01-15T10:30:00Z'
              }
            },
            description: 'Crear un nuevo documento',
            tags: ['documentos', 'crear', 'contrato'],
            difficulty: 'beginner'
          }
        ],
        visual_data: {
          chart_type: 'bar',
          data: {
            labels: ['Borradores', 'En Revisión', 'Aprobados', 'Firmados'],
            datasets: [{
              label: 'Documentos por Estado',
              data: [15, 8, 12, 25],
              backgroundColor: ['#fbbf24', '#3b82f6', '#10b981', '#8b5cf6']
            }]
          }
        },
        code_snippets: [
          {
            language: 'javascript',
            code: '// Crear documento\nconst doc = await api.post("/documents", documentData);',
            description: 'Crear documento con JavaScript'
          },
          {
            language: 'python',
            code: '# Crear documento\nresponse = requests.post("/documents", json=document_data)',
            description: 'Crear documento con Python'
          }
        ]
      }
      // ... more modules would be defined here
    ];
  }

  private getExamplesCount(): number {
    const modules = this.getAvailableModules();
    return modules.reduce((total, module) => total + module.examples.length, 0);
  }

  // Additional methods for backward compatibility
  async getModuleExamples(req: any, res: any): Promise<void> {
    try {
      const { module } = req.params;
      const modules = this.getAvailableModules();
      const targetModule = modules.find(m => m.name === module);
      
      if (!targetModule) {
        return res.status(404).json({
          success: false,
          error: 'Módulo no encontrado'
        });
      }
      
      res.json({
        success: true,
        data: targetModule,
        message: 'Ejemplos del módulo obtenidos exitosamente'
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  async executeAction(req: any, res: any): Promise<void> {
    try {
      const { action } = req.params;
      const { data } = req.body;
      
      // Simular ejecución de acción
      const result = await this.simulateApiCall('demo', action, data);
      
      res.json({
        success: true,
        data: result,
        message: 'Acción ejecutada exitosamente'
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  async getPlaygroundHistory(req: any, res: any): Promise<void> {
    try {
      const userId = req.user.id;
      const history = await this.model.getPlaygroundHistory(userId);
      
      res.json({
        success: true,
        data: history,
        message: 'Historial del playground obtenido exitosamente'
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  setupRoutes(app: any): void {
    // Middleware de autenticación para rutas protegidas
    const authenticateDemo = (req: any, res: any, next: any) => {
      const token = req.headers.authorization?.replace('Bearer ', '');
      
      if (!token) {
        res.status(401).json({
          success: false,
          error: {
            code: 'TOKEN_REQUIRED',
            message: 'Token de autenticación requerido'
          }
        });
        return;
      }

      try {
        const decoded = jwt.verify(token, this.jwtSecret) as any;
        req.user = decoded;
        next();
      } catch (error) {
        res.status(401).json({
          success: false,
          error: {
            code: 'INVALID_TOKEN',
            message: 'Token inválido o expirado'
          }
        });
      }
    };

    // Rutas públicas
    app.post('/api/v1/demo/login', this.login.bind(this));
    
    // Rutas protegidas
    app.get('/api/v1/demo/dashboard', authenticateDemo, this.getDashboard.bind(this));
    app.get('/api/v1/demo/examples/:module', authenticateDemo, this.getModuleExamples.bind(this));
    app.get('/api/v1/demo/modules', authenticateDemo, this.getAvailableModules.bind(this));
    app.post('/api/v1/demo/execute/:action', authenticateDemo, this.executeAction.bind(this));
    app.post('/api/v1/demo/simulate/:module/:endpoint', authenticateDemo, this.simulateApi.bind(this));
    app.post('/api/v1/demo/generate-code', authenticateDemo, this.generateCode.bind(this));
    app.get('/api/v1/demo/export/:type', authenticateDemo, this.exportData.bind(this));
    app.post('/api/v1/demo/analytics', authenticateDemo, this.getAnalytics.bind(this));
    app.get('/api/v1/demo/search', authenticateDemo, this.searchContent.bind(this));
    app.post('/api/v1/demo/playground/execute', authenticateDemo, this.executePlayground.bind(this));
    app.get('/api/v1/demo/playground/history', authenticateDemo, this.getPlaygroundHistory.bind(this));
  }


}

export default DemoEnhancedModule;
