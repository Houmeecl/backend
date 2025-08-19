"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuditModule = void 0;
const zod_1 = require("zod");
const base_module_1 = require("./base_module");
const uuid_1 = require("uuid");
const AUDIT_MODULE_CONFIG = {
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
const createAuditEventSchema = zod_1.z.object({
    event_type: zod_1.z.string().min(1, "El tipo de evento es requerido."),
    entity_type: zod_1.z.string().min(1, "El tipo de entidad es requerido."),
    entity_id: zod_1.z.string().uuid("El ID de entidad debe ser un UUID v�lido."),
    details: zod_1.z.record(zod_1.z.any()).optional(),
    ip_address: zod_1.z.string().optional(),
    user_agent: zod_1.z.string().optional(),
});
const getAuditEventsSchema = zod_1.z.object({
    entity_id: zod_1.z.string().uuid().optional(),
    entity_type: zod_1.z.string().optional(),
    event_type: zod_1.z.string().optional(),
    start_date: zod_1.z.string().datetime().optional(),
    end_date: zod_1.z.string().datetime().optional(),
    limit: zod_1.z.number().int().positive().max(1000).default(100),
    offset: zod_1.z.number().int().min(0).default(0),
});
class AuditModel {
    constructor(db) {
        this.db = db;
    }
    async createEvent(userId, eventType, entityType, entityId, details, ipAddress, userAgent) {
        const id = (0, uuid_1.v4)();
        const result = await this.db.query(`INSERT INTO audit_trail (id, user_id, event_type, entity_type, entity_id, details, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`, [id, userId, eventType, entityType, entityId, details, ipAddress, userAgent]);
        return result.rows[0];
    }
    async getEvents(filters) {
        let query = `SELECT * FROM audit_trail WHERE 1=1`;
        const params = [];
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
        const result = await this.db.query(query, params);
        return result.rows;
    }
}
class AuditModule extends base_module_1.BaseModule {
    constructor(database) {
        super(database, AUDIT_MODULE_CONFIG);
        this.auditModel = new AuditModel(database);
    }
    async initialize() {
        this.initialized = true;
        console.log(`? ${this.getName()} v${this.getVersion()} initialized`);
    }
    async cleanup() {
        this.initialized = false;
    }
    async getHealth() {
        try {
            await this.db.query('SELECT 1 FROM audit_trail LIMIT 1;');
            return { status: 'healthy', details: { db_audit: 'reachable' } };
        }
        catch (error) {
            return { status: 'unhealthy', details: { db_audit: error.message } };
        }
    }
    getRoutes() {
        return {
            'GET /audit/events': this.getAuditEvents.bind(this),
            'POST /audit/events': this.createAuditEvent.bind(this),
            'GET /audit/export': this.exportAuditEvents.bind(this)
        };
    }
    async logEvent(data) {
        return await this.auditModel.createEvent(data.userId, data.eventType, data.entityType, data.entityId, data.details, data.ipAddress, data.userAgent);
    }
    async createAuditEvent(data) {
        try {
            const validatedData = createAuditEventSchema.parse(data);
            const { event_type, entity_type, entity_id, details, ip_address, user_agent } = validatedData;
            const userId = data.user?.userId;
            const auditEvent = await this.auditModel.createEvent(userId, event_type, entity_type, entity_id, details, ip_address, user_agent);
            return { success: true, event: auditEvent };
        }
        catch (error) {
            console.error('Error in createAuditEvent:', error);
            if (error instanceof zod_1.z.ZodError) {
                throw new Error(`Error de validaci�n: ${error.errors.map(e => e.message).join(', ')}`);
            }
            throw new Error(error.message || 'No se pudo crear el evento de auditor�a.');
        }
    }
    async getAuditEvents(data) {
        try {
            const validatedData = getAuditEventsSchema.parse(data);
            const events = await this.auditModel.getEvents(validatedData);
            return events;
        }
        catch (error) {
            console.error('Error in getAuditEvents:', error);
            if (error instanceof zod_1.z.ZodError) {
                throw new Error(`Error de validaci�n: ${error.errors.map(e => e.message).join(', ')}`);
            }
            throw new Error(error.message || 'No se pudieron obtener los eventos de auditor�a.');
        }
    }
    async exportAuditEvents(data) {
        try {
            const events = await this.auditModel.getEvents({ limit: 10000, offset: 0 });
            const exportUrl = `${process.env.API_URL}/downloads/audit-export-${Date.now()}.csv`;
            return {
                success: true,
                message: 'Exportaci�n generada exitosamente',
                downloadUrl: exportUrl,
                recordCount: events.length
            };
        }
        catch (error) {
            console.error('Error in exportAuditEvents:', error);
            throw new Error(error.message || 'No se pudo exportar los eventos de auditor�a.');
        }
    }
}
exports.AuditModule = AuditModule;
exports.default = AuditModule;
