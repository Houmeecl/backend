import { Pool, PoolClient } from 'pg';

// Tipos de roles de usuario
export type UserRole = 'admin' | 'gestor' | 'certificador' | 'operador' | 'cliente' | 'validador';

// Tipos de permisos
export type Permission = 
  // Auth permissions
  | 'auth:login' | 'auth:register' | 'auth:logout'
  
  // Documents permissions
  | 'documents:read' | 'documents:create' | 'documents:update' | 'documents:delete' | 'documents:transition'
  
  // Templates permissions
  | 'templates:read' | 'templates:create' | 'templates:update' | 'templates:delete' | 'templates:upload_convert'
  
  // Signatures permissions
  | 'signatures:capture' | 'signatures:verify' | 'signatures:request_signing' | 'signatures:apply_handwritten' | 'signatures:certifier_upload'
  
  // Users permissions
  | 'users:read' | 'users:create' | 'users:update' | 'users:delete' | 'users:activity_read'
  
  // Coupons permissions
  | 'coupons:read' | 'coupons:create' | 'coupons:update' | 'coupons:delete' | 'coupons:validate' | 'coupons:apply' | 'coupons:usage_read'
  
  // Payments permissions
  | 'payments:read' | 'payments:create' | 'payments:process' | 'payments:invoice'
  
  // Identity permissions
  | 'identity:validate_rut' | 'identity:send_otp' | 'identity:verify_otp' | 'identity:verify_biometric'
  
  // Analytics permissions
  | 'analytics:read' | 'analytics:export'
  
  // Notifications permissions
  | 'notifications:send' | 'notifications:history_read'
  
  // Files permissions
  | 'files:upload' | 'files:download' | 'files:delete'
  
  // Audit permissions
  | 'audit:read' | 'audit:create' | 'audit:export'
  
  // Verification permissions
  | 'verifications:read' | 'verifications:initiate'
  
  // SaaS permissions
  | 'saas:read' | 'saas:create' | 'saas:update' | 'saas:delete' | 'saas:admin'
  | 'saas_users:read' | 'saas_users:create' | 'saas_users:update' | 'saas_users:delete'
  | 'saas_roles:read' | 'saas_roles:create' | 'saas_roles:update' | 'saas_roles:delete'
  | 'saas_subscriptions:read' | 'saas_subscriptions:create' | 'saas_subscriptions:update' | 'saas_subscriptions:delete'
  | 'saas_analytics:read' | 'saas_analytics:export'
  
  // API Tokens permissions
  | 'api_tokens:create' | 'api_tokens:read' | 'api_tokens:update' | 'api_tokens:delete'
  | 'api_tokens:regenerate' | 'api_tokens:validate' | 'api_tokens:usage_read'
  
  // Demo permissions
  | 'demo:read' | 'demo:create' | 'demo:update' | 'demo:delete'
  | 'demo:admin' | 'demo:seller' | 'demo:developer' | 'demo:sales' | 'demo:support'
  | 'demo:view_examples' | 'demo:simulate_api' | 'demo:generate_code'
  | 'demo:export_data' | 'demo:create_custom' | 'demo:share' | 'demo:analytics'
  | 'demo:playground' | 'demo:search' | 'demo:settings';

// Configuracin de un mdulo
export interface ModuleConfig {
  name: string;
  version: string;
  enabled: boolean;
  dependencies: string[];
  permissions: Permission[];
  routes: string[];
}

// Clase base abstracta para todos los m�dulos
export abstract class BaseModule {
  protected db: Pool;
  protected config: ModuleConfig;
  protected initialized: boolean = false;

  constructor(database: Pool, config: ModuleConfig) {
    this.db = database;
    this.config = config;
  }

  // M�todos abstractos que deben implementar los m�dulos hijos
  abstract initialize(): Promise<void>;
  abstract cleanup(): Promise<void>;
  abstract getHealth(): Promise<{ status: string; details?: any }>;
  abstract getRoutes(): Record<string, Function>;

  // M�todos p�blicos para obtener informaci�n del m�dulo
  public getName(): string {
    return this.config.name;
  }

  public getVersion(): string {
    return this.config.version;
  }

  public getConfig(): ModuleConfig {
    return this.config;
  }

  public isInitialized(): boolean {
    return this.initialized;
  }

  public isEnabled(): boolean {
    return this.config.enabled;
  }

  public getDependencies(): string[] {
    return this.config.dependencies;
  }

  public getPermissions(): Permission[] {
    return this.config.permissions;
  }

  // M�todo helper para ejecutar queries en transacciones
  protected async executeWithTransaction<T>(
    callback: (client: PoolClient) => Promise<T>
  ): Promise<T> {
    const client = await this.db.connect();
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  // M�todo helper para ejecutar queries simples
  protected async query(text: string, params?: any[]): Promise<any> {
    try {
      const result = await this.db.query(text, params);
      return result;
    } catch (error) {
      console.error(`Error en query del m�dulo ${this.getName()}:`, error);
      throw error;
    }
  }

  // M�todo para validar dependencias
  public validateDependencies(availableModules: string[]): string[] {
    const missingDependencies: string[] = [];
    
    for (const dependency of this.config.dependencies) {
      if (!availableModules.includes(dependency)) {
        missingDependencies.push(dependency);
      }
    }
    
    return missingDependencies;
  }

  // M�todo para obtener estad�sticas b�sicas del m�dulo
  public async getStats(): Promise<{ name: string; version: string; initialized: boolean; health: any }> {
    return {
      name: this.getName(),
      version: this.getVersion(),
      initialized: this.isInitialized(),
      health: await this.getHealth()
    };
  }
}