"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DemoEnhancedModule = void 0;
const zod_1 = require("zod");
const base_module_1 = require("./base_module");
const uuid_1 = require("uuid");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const DEMO_MODULE_ENHANCED_CONFIG = {
    name: 'demo_enhanced',
    version: '2.3.0',
    enabled: true,
    dependencies: [],
    permissions: [
        'demo:read', 'demo:create', 'demo:update', 'demo:delete',
        'demo:admin', 'demo:seller', 'demo:developer', 'demo:sales', 'demo:support',
        'demo:view_examples', 'demo:simulate_api', 'demo:generate_code',
        'demo:export_data', 'demo:create_custom', 'demo:share', 'demo:analytics'
    ],
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
const LoginSchema = zod_1.z.object({
    email: zod_1.z.string().email(),
    password: zod_1.z.string().min(6)
});
const SimulateApiSchema = zod_1.z.object({
    method: zod_1.z.enum(['GET', 'POST', 'PUT', 'DELETE', 'PATCH']),
    body: zod_1.z.record(zod_1.z.any()).optional(),
    headers: zod_1.z.record(zod_1.z.string()).optional(),
    params: zod_1.z.record(zod_1.z.string()).optional(),
    query: zod_1.z.record(zod_1.z.string()).optional()
});
const GenerateCodeSchema = zod_1.z.object({
    language: zod_1.z.enum(['javascript', 'python', 'curl', 'php', 'java', 'csharp']),
    endpoint: zod_1.z.string(),
    method: zod_1.z.string(),
    data: zod_1.z.record(zod_1.z.any()).optional()
});
const PlaygroundExecuteSchema = zod_1.z.object({
    code: zod_1.z.string(),
    language: zod_1.z.string(),
    inputs: zod_1.z.record(zod_1.z.any()).optional()
});
class DemoEnhancedModel {
    constructor(db) {
        this.db = db;
    }
    async initialize() {
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
            const passwords = ['admin123', 'vendedor123', 'developer123', 'sales123', 'support123'];
            const hashedPasswords = await Promise.all(passwords.map(pwd => bcryptjs_1.default.hash(pwd, 10)));
            await this.db.query(insertDemoUsersQuery, hashedPasswords);
            console.log('✅ Enhanced demo users created successfully');
        }
        catch (error) {
            console.error('❌ Error creating enhanced demo users:', error);
        }
    }
    async findUserByEmail(email) {
        try {
            const result = await this.db.query('SELECT id, email, role, name, permissions, preferences, created_at, last_login FROM demo_users_enhanced WHERE email = $1', [email]);
            if (result.rows.length === 0)
                return null;
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
        }
        catch (error) {
            console.error('Error finding user:', error);
            return null;
        }
    }
    async validatePassword(email, password) {
        try {
            const result = await this.db.query('SELECT * FROM demo_users_enhanced WHERE email = $1', [email]);
            if (result.rows.length === 0)
                return null;
            const user = result.rows[0];
            const isValid = await bcryptjs_1.default.compare(password, user.password_hash);
            if (!isValid)
                return null;
            await this.db.query('UPDATE demo_users_enhanced SET last_login = CURRENT_TIMESTAMP WHERE id = $1', [user.id]);
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
        }
        catch (error) {
            console.error('Error validating password:', error);
            return null;
        }
    }
    async saveApiSimulation(simulation) {
        try {
            const result = await this.db.query(`INSERT INTO api_simulations (module, endpoint, method, request, response, execution_time, status_code, user_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`, [simulation.module, simulation.endpoint, simulation.method, simulation.request, simulation.response, simulation.execution_time, simulation.status_code, simulation.user_id]);
            return result.rows[0].id;
        }
        catch (error) {
            console.error('Error saving API simulation:', error);
            throw error;
        }
    }
    async savePlaygroundSession(session) {
        try {
            const result = await this.db.query(`INSERT INTO playground_sessions (user_id, code, language, result, execution_time, success, error_message)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`, [session.user_id, session.code, session.language, session.result, session.execution_time, session.success, session.error_message]);
            return result.rows[0].id;
        }
        catch (error) {
            console.error('Error saving playground session:', error);
            throw error;
        }
    }
    async trackUserActivity(userId, action, module, details) {
        try {
            await this.db.query('INSERT INTO user_activity (user_id, action, module, details) VALUES ($1, $2, $3, $4)', [userId, action, module, details]);
        }
        catch (error) {
            console.error('Error tracking user activity:', error);
        }
    }
    async getUserAnalytics(userId) {
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
        }
        catch (error) {
            console.error('Error getting user analytics:', error);
            return null;
        }
    }
    async getPlaygroundHistory(userId) {
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
        }
        catch (error) {
            console.error('Error getting playground history:', error);
            return [];
        }
    }
}
class DemoEnhancedModule extends base_module_1.BaseModule {
    constructor(database, jwtSecret) {
        super(database, DEMO_MODULE_ENHANCED_CONFIG);
        this.model = new DemoEnhancedModel(database);
        this.jwtSecret = jwtSecret;
    }
    async initialize() {
        try {
            await this.model.initialize();
            this.initialized = true;
            console.log('✅ DemoEnhancedModule initialized successfully');
        }
        catch (error) {
            console.error('❌ Error initializing DemoEnhancedModule:', error);
            throw error;
        }
    }
    async cleanup() {
        this.initialized = false;
    }
    async getHealth() {
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
        }
        catch (error) {
            return {
                status: 'error',
                details: { error: error.message }
            };
        }
    }
    getRoutes() {
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
    async login(req, res) {
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
            await this.model.trackUserActivity(user.id, 'login', 'auth');
            const token = jsonwebtoken_1.default.sign({
                userId: user.id,
                email: user.email,
                role: user.role,
                permissions: user.permissions,
                preferences: user.preferences
            }, this.jwtSecret, { expiresIn: '24h' });
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
        }
        catch (error) {
            res.status(400).json({
                success: false,
                error: {
                    code: 'VALIDATION_ERROR',
                    message: error.message
                }
            });
        }
    }
    async getDashboard(req, res) {
        try {
            const modules = this.getAvailableModules();
            const stats = {
                total_modules: modules.length,
                total_examples: this.getExamplesCount(),
                demo_users: 5,
                system_status: 'operational'
            };
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
        }
        catch (error) {
            res.status(500).json({
                success: false,
                error: {
                    code: 'INTERNAL_ERROR',
                    message: error.message
                }
            });
        }
    }
    async simulateApi(req, res) {
        try {
            const { module, endpoint } = req.params;
            const simulationData = SimulateApiSchema.parse(req.body);
            const startTime = Date.now();
            const result = await this.simulateApiCall(module, endpoint, simulationData);
            const executionTime = Date.now() - startTime;
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
        }
        catch (error) {
            res.status(400).json({
                success: false,
                error: {
                    code: 'SIMULATION_ERROR',
                    message: error.message
                }
            });
        }
    }
    async generateCode(req, res) {
        try {
            const { language, endpoint, method, data } = GenerateCodeSchema.parse(req.body);
            const generatedCode = this.generateCodeForLanguage(language, endpoint, method, data);
            await this.model.trackUserActivity(req.user.userId, 'code_generation', 'codegen', {
                language,
                endpoint,
                method
            });
            res.json({
                success: true,
                data: generatedCode
            });
        }
        catch (error) {
            res.status(400).json({
                success: false,
                error: {
                    code: 'CODE_GENERATION_ERROR',
                    message: error.message
                }
            });
        }
    }
    async executePlayground(req, res) {
        try {
            const { code, language, inputs } = PlaygroundExecuteSchema.parse(req.body);
            const startTime = Date.now();
            const result = await this.executeCodeInSandbox(code, language, inputs);
            const executionTime = Date.now() - startTime;
            const sessionId = await this.model.savePlaygroundSession({
                user_id: req.user.userId,
                code,
                language,
                result: result.output,
                execution_time: executionTime,
                success: result.success,
                error_message: result.error
            });
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
        }
        catch (error) {
            res.status(400).json({
                success: false,
                error: {
                    code: 'PLAYGROUND_ERROR',
                    message: error.message
                }
            });
        }
    }
    async getAnalytics(req, res) {
        try {
            const analytics = await this.model.getUserAnalytics(req.user.userId);
            res.json({
                success: true,
                data: analytics
            });
        }
        catch (error) {
            res.status(500).json({
                success: false,
                error: {
                    code: 'ANALYTICS_ERROR',
                    message: error.message
                }
            });
        }
    }
    async searchContent(req, res) {
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
        }
        catch (error) {
            res.status(500).json({
                success: false,
                error: {
                    code: 'SEARCH_ERROR',
                    message: error.message
                }
            });
        }
    }
    async exportData(req, res) {
        try {
            const { type } = req.params;
            const { format = 'json' } = req.query;
            const data = await this.exportDataByType(type, req.user.userId, format);
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
        }
        catch (error) {
            res.status(400).json({
                success: false,
                error: {
                    code: 'EXPORT_ERROR',
                    message: error.message
                }
            });
        }
    }
    async simulateApiCall(module, endpoint, data) {
        const simulations = {
            documents: {
                'POST /api/v1/documents': {
                    success: true,
                    data: {
                        id: `doc_${(0, uuid_1.v4)().substr(0, 8)}`,
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
                        id: `sig_${(0, uuid_1.v4)().substr(0, 8)}`,
                        status: 'pending',
                        sign_url: `https://app.notarypro.com/sign/sig_${(0, uuid_1.v4)().substr(0, 8)}`
                    }
                }
            }
        };
        const moduleSims = simulations[module];
        if (moduleSims && moduleSims[endpoint]) {
            return moduleSims[endpoint];
        }
        return {
            success: true,
            data: {
                message: `Simulación de ${module} - ${endpoint}`,
                timestamp: new Date().toISOString()
            }
        };
    }
    generateCodeForLanguage(language, endpoint, method, data) {
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
        const template = templates[language] || templates.javascript;
        return {
            ...template,
            language: language
        };
    }
    async executeCodeInSandbox(code, language, inputs) {
        try {
            if (language === 'javascript') {
                const safeCode = code.replace(/require|import|eval|Function|global|process/g, '');
                const result = new Function('inputs', safeCode);
                const output = result(inputs);
                return {
                    output,
                    success: true
                };
            }
            else if (language === 'python') {
                return {
                    output: `Python execution simulated: ${code}`,
                    success: true
                };
            }
            else {
                return {
                    output: `Language ${language} not supported in sandbox`,
                    success: false,
                    error: 'Unsupported language'
                };
            }
        }
        catch (error) {
            return {
                output: null,
                success: false,
                error: error.message
            };
        }
    }
    performSearch(query, filters) {
        const allContent = this.getAllSearchableContent();
        return allContent.filter(item => item.name.toLowerCase().includes(query.toLowerCase()) ||
            item.description.toLowerCase().includes(query.toLowerCase()) ||
            item.tags?.some((tag) => tag.toLowerCase().includes(query.toLowerCase())));
    }
    getAllSearchableContent() {
        const modules = this.getAvailableModules();
        const content = [];
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
    async exportDataByType(type, userId, format) {
        switch (type) {
            case 'simulations':
                const simulations = await this.db.query('SELECT * FROM api_simulations WHERE user_id = $1 ORDER BY timestamp DESC', [userId]);
                return simulations.rows;
            case 'playground':
                const sessions = await this.db.query('SELECT * FROM playground_sessions WHERE user_id = $1 ORDER BY timestamp DESC', [userId]);
                return sessions.rows;
            case 'activity':
                const activity = await this.db.query('SELECT * FROM user_activity WHERE user_id = $1 ORDER BY timestamp DESC', [userId]);
                return activity.rows;
            default:
                throw new Error(`Tipo de exportación no soportado: ${type}`);
        }
    }
    getDifficultyLevels(examples) {
        const levels = { beginner: 0, intermediate: 0, advanced: 0 };
        examples.forEach(example => {
            const difficulty = example.difficulty;
            levels[difficulty] = (levels[difficulty] || 0) + 1;
        });
        return levels;
    }
    getAvailableFeatures(role) {
        const features = {
            admin: ['all_features'],
            seller: ['view_examples', 'simulate_api', 'basic_analytics'],
            developer: ['view_examples', 'simulate_api', 'generate_code', 'playground', 'advanced_analytics'],
            sales: ['view_examples', 'analytics', 'export_data'],
            support: ['view_examples', 'simulate_api', 'basic_analytics']
        };
        return features[role] || ['view_examples'];
    }
    getAvailableModules() {
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
        ];
    }
    getExamplesCount() {
        const modules = this.getAvailableModules();
        return modules.reduce((total, module) => total + module.examples.length, 0);
    }
    async getModuleExamples(req, res) {
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
        }
        catch (error) {
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }
    async executeAction(req, res) {
        try {
            const { action } = req.params;
            const { data } = req.body;
            const result = await this.simulateApiCall('demo', action, data);
            res.json({
                success: true,
                data: result,
                message: 'Acción ejecutada exitosamente'
            });
        }
        catch (error) {
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }
    async getPlaygroundHistory(req, res) {
        try {
            const userId = req.user.id;
            const history = await this.model.getPlaygroundHistory(userId);
            res.json({
                success: true,
                data: history,
                message: 'Historial del playground obtenido exitosamente'
            });
        }
        catch (error) {
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }
    setupRoutes(app) {
        const authenticateDemo = (req, res, next) => {
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
                const decoded = jsonwebtoken_1.default.verify(token, this.jwtSecret);
                req.user = decoded;
                next();
            }
            catch (error) {
                res.status(401).json({
                    success: false,
                    error: {
                        code: 'INVALID_TOKEN',
                        message: 'Token inválido o expirado'
                    }
                });
            }
        };
        app.post('/api/v1/demo/login', this.login.bind(this));
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
exports.DemoEnhancedModule = DemoEnhancedModule;
exports.default = DemoEnhancedModule;
