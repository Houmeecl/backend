import { Pool, QueryResult } from 'pg';
import { z } from 'zod';
import { BaseModule, ModuleConfig } from './base_module';
import { v4 as uuidv4 } from 'uuid';

const SIGNERS_MODULE_CONFIG: ModuleConfig = {
  name: 'signers_module',
  version: '1.0.0',
  enabled: true,
  dependencies: ['document_module'],
  permissions: ['documents:read', 'documents:update'],
  routes: [
    'POST /signer/upd/:ContractID/EMAIL',
    'POST /signer/upd/:ContractID/RUT',
    'GET /signer/list'
  ]
};

// Esquemas de validación
const updateSignerEmailSchema = z.object({
  ContractID: z.string().uuid("El ContractID debe ser un UUID válido."),
  email: z.string().email("Formato de email inválido."),
});

const updateSignerRutSchema = z.object({
  ContractID: z.string().uuid("El ContractID debe ser un UUID válido."),
  rut: z.string().regex(/^[0-9]{7,8}-[0-9Kk]$/, "Formato de RUT inválido."),
});

// Interfaz para firmante
interface Signer {
  id: string;
  document_id: string;
  full_name: string;
  email: string;
  rut_id: string;
  phone?: string;
  order_number: number;
  status: 'pending' | 'signed' | 'declined' | 'expired';
  signed_at?: Date;
  created_at: Date;
}

export class SignersModule extends BaseModule {
  constructor(database: Pool) {
    super(database, SIGNERS_MODULE_CONFIG);
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
      await this.db.query('SELECT 1 FROM signers LIMIT 1;');
      return { status: 'healthy', details: { db_signers: 'reachable' } };
    } catch (error: any) {
      return { status: 'unhealthy', details: { db_signers: error.message } };
    }
  }

  getRoutes(): Record<string, Function> {
    return {
      'POST /signer/upd/:ContractID/EMAIL': this.updateSignerEmail.bind(this),
      'POST /signer/upd/:ContractID/RUT': this.updateSignerRut.bind(this),
      'GET /signer/list': this.listSigners.bind(this)
    };
  }

  async updateSignerEmail(data: z.infer<typeof updateSignerEmailSchema>): Promise<any> {
    try {
      const validatedData = updateSignerEmailSchema.parse(data);
      const { ContractID, email } = validatedData;

      const result: QueryResult = await this.db.query(
        'UPDATE signers SET email = $1, updated_at = CURRENT_TIMESTAMP WHERE document_id = $2 RETURNING *',
        [email, ContractID]
      );

      if (result.rows.length === 0) {
        throw new Error('Firmante no encontrado para este documento.');
      }

      return {
        success: true,
        message: 'Email del firmante actualizado exitosamente',
        signer: result.rows[0]
      };

    } catch (error: any) {
      console.error('Error updating signer email:', error);
      if (error instanceof z.ZodError) {
        throw new Error(`Error de validación: ${error.errors.map(e => e.message).join(', ')}`);
      }
      throw new Error(error.message || 'No se pudo actualizar el email del firmante.');
    }
  }

  async updateSignerRut(data: z.infer<typeof updateSignerRutSchema>): Promise<any> {
    try {
      const validatedData = updateSignerRutSchema.parse(data);
      const { ContractID, rut } = validatedData;

      const result: QueryResult = await this.db.query(
        'UPDATE signers SET rut_id = $1, updated_at = CURRENT_TIMESTAMP WHERE document_id = $2 RETURNING *',
        [rut, ContractID]
      );

      if (result.rows.length === 0) {
        throw new Error('Firmante no encontrado para este documento.');
      }

      return {
        success: true,
        message: 'RUT del firmante actualizado exitosamente',
        signer: result.rows[0]
      };

    } catch (error: any) {
      console.error('Error updating signer RUT:', error);
      if (error instanceof z.ZodError) {
        throw new Error(`Error de validación: ${error.errors.map(e => e.message).join(', ')}`);
      }
      throw new Error(error.message || 'No se pudo actualizar el RUT del firmante.');
    }
  }

  async listSigners(): Promise<any[]> {
    try {
      const result: QueryResult<Signer> = await this.db.query(
        'SELECT * FROM signers ORDER BY created_at DESC'
      );

      return result.rows;

    } catch (error: any) {
      console.error('Error listing signers:', error);
      throw new Error(error.message || 'No se pudieron listar los firmantes.');
    }
  }
}

export default SignersModule;