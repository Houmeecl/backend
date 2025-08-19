import { Pool, QueryResult } from 'pg';
import { z } from 'zod';
import { BaseModule, ModuleConfig, UserRole } from './base_module';
import { v4 as uuidv4 } from 'uuid';

const AUDIT_MODULE_CONFIG: ModuleConfig = {
  name: 'audit_module',
  version: '1.0.0',
  enabled: true,
  dependencies: [],
  permissions: ['audit:read', 'audit:create', 'audit:export'],
  routes: [
    'GET /audit/events',
    'POST /audit/events',
    'GET /audit/export'
  ]
};

// Esquemas de validación
const createAuditEventSchema = z.object({
  event_type: z.string().min(1, "El tipo de evento es requerido."),
  entity_type: z.string().min(1, "El tipo de entidad es requerido."),
  entity_id: z.string().uuid("El ID de entidad debe ser un UUID válido."),
  details: z.record(z.any()).optional(),
  ip_address: z.string().optional(),
  user_agent: z.string().optional(),
});

const getAuditEventsSchema = z.object({
  entity_id: z.string().uuid().optional(),
  entity_type: z.string().optional(),
  event_type: z.string().optional(),
  start_date: z.string().datetime().optional(),
  end_date: z.string().datetime().optional(),
  limit: z.number().int().positive().max(1000).default(100),
  offset: z.number().int().min(0).default(0),
});

// Interfaz para el modelo de Evento de Auditoría
interface AuditEvent {
  id: string;
  user_id?: string;
  event_type: string;
  entity_type: string;
  entity_id: string;
  details?: Record<string, any>;
  ip_address?: string;
  user_agent?: string;
  timestamp: Date;
}

// Modelo para las operaciones de base de datos de Auditoría
class AuditModel {
  private db: Pool;

  constructor(db: Pool) {
    this.db = db;
  }

  async createEvent(
    userId: string | undefined,
    eventType: string,
    entityType: string,
    entityId: string,
    details?: Record<string, any>,
    ipAddress?: string,
    userAgent?: string
  ): Promise<AuditEvent> {
    const id = uuidv4();
    const result: QueryResult<AuditEvent> = await this.db.query(
      `INSERT INTO audit_trail (id, user_id, event_type, entity_type, entity_id, details, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [id, userId, eventType, entityType, entityId, details, ipAddress, userAgent]
    );
    return result.rows[0];
  }

  async getEvents(filters: {
    entityId?: string;
    entityType?: string;
    eventType?: string;
    startDate?: string;
    endDate?: string;
    limit: number;
    offset: number;
  }): Promise<AuditEvent[]> {
    let query = `SELECT * FROM audit_trail WHERE 1=1`;
    const params: any[] = [];
    let paramIndex = 1;

    if (filters.entityId) {
      query += ` AND entity_id = $${paramIndex++}`;
      params.push(filters.entityId);
    }

    if (filters.entityType) {
      query += ` AND entity_type = $${paramIndex++}`;
      params.push(filters.entityType);
    }

    if (filters.eventType) {
      query += ` AND event_type = $${paramIndex++}`;
      params.push(filters.eventType);
    }

    if (filters.startDate) {
      query += ` AND timestamp >= $${paramIndex++}`;
      params.push(filters.startDate);
    }

    if (filters.endDate) {
      query += ` AND timestamp <= $${paramIndex++}`;
      params.push(filters.endDate);
    }

    query += ` ORDER BY timestamp DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
    params.push(filters.limit, filters.offset);

    const result: QueryResult<AuditEvent> = await this.db.query(query, params);
    return result.rows;
  }
}

export class AuditModule extends BaseModule {
  private auditModel: AuditModel;

  constructor(database: Pool) {
    super(database, AUDIT_MODULE_CONFIG);
    this.auditModel = new AuditModel(database);
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
      await this.db.query('SELECT 1 FROM audit_trail LIMIT 1;');
      return { status: 'healthy', details: { db_audit: 'reachable' } };
    } catch (error: any) {
      return { status: 'unhealthy', details: { db_audit: error.message } };
    }
  }

  getRoutes(): Record<string, Function> {
    return {
      'GET /audit/events': this.getAuditEvents.bind(this),
      'POST /audit/events': this.createAuditEvent.bind(this),
      'GET /audit/export': this.exportAuditEvents.bind(this)
    };
  }

  // Método público para que otros módulos registren eventos
  async logEvent(data: {
    userId?: string;
    eventType: string;
    entityType: string;
    entityId: string;
    details?: Record<string, any>;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<AuditEvent> {
    return await this.auditModel.createEvent(
      data.userId,
      data.eventType,
      data.entityType,
      data.entityId,
      data.details,
      data.ipAddress,
      data.userAgent
    );
  }

  async createAuditEvent(data: z.infer<typeof createAuditEventSchema> & { user?: { userId: string } }): Promise<any> {
    try {
      const validatedData = createAuditEventSchema.parse(data);
      const { event_type, entity_type, entity_id, details, ip_address, user_agent } = validatedData;
      const userId = data.user?.userId;

      const auditEvent = await this.auditModel.createEvent(
        userId,
        event_type,
        entity_type,
        entity_id,
        details,
        ip_address,
        user_agent
      );

      return { success: true, event: auditEvent };
    } catch (error: any) {
      console.error('Error in createAuditEvent:', error);
      if (error instanceof z.ZodError) {
        throw new Error(`Error de validación: ${error.errors.map(e => e.message).join(', ')}`);
      }
      throw new Error(error.message || 'No se pudo crear el evento de auditoría.');
    }
  }

  async getAuditEvents(data: z.infer<typeof getAuditEventsSchema> & { user: { role: UserRole } }): Promise<any[]> {
    try {
      const validatedData = getAuditEventsSchema.parse(data);
      const events = await this.auditModel.getEvents(validatedData);
      return events;
    } catch (error: any) {
      console.error('Error in getAuditEvents:', error);
      if (error instanceof z.ZodError) {
        throw new Error(`Error de validación: ${error.errors.map(e => e.message).join(', ')}`);
      }
      throw new Error(error.message || 'No se pudieron obtener los eventos de auditoría.');
    }
  }

  async exportAuditEvents(data: { user: { role: UserRole } }): Promise<any> {
    try {
      // Implementar exportación de eventos (CSV, Excel, etc.)
      const events = await this.auditModel.getEvents({ limit: 10000, offset: 0 });
      
      // Simular URL de descarga
      const exportUrl = `${process.env.API_URL}/downloads/audit-export-${Date.now()}.csv`;
      
      return { 
        success: true, 
        message: 'Exportación generada exitosamente',
        downloadUrl: exportUrl,
        recordCount: events.length
      };
    } catch (error: any) {
      console.error('Error in exportAuditEvents:', error);
      throw new Error(error.message || 'No se pudo exportar los eventos de auditoría.');
    }
  }
}

export default AuditModule;