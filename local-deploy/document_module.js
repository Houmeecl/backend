"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DocumentModule = exports.transitionDocumentSchema = exports.updateDocumentSchema = exports.createDocumentSchema = exports.documentStatusSchema = void 0;
const zod_1 = require("zod");
const base_module_1 = require("./base_module");
const crypto_1 = __importDefault(require("crypto"));
const uuid_1 = require("uuid");
const DOCUMENT_MODULE_CONFIG = {
    name: 'document_module',
    version: '1.2.0',
    enabled: true,
    dependencies: ['template_module', 'audit_module'],
    permissions: ['documents:read', 'documents:create', 'documents:update', 'documents:transition', 'documents:delete'],
    routes: [
        'GET /documents',
        'GET /documents/:id',
        'POST /documents',
        'PUT /documents/:id',
        'DELETE /documents/:id',
        'POST /documents/:id/transition'
    ]
};
exports.documentStatusSchema = zod_1.z.enum([
    'borrador',
    'datos_completados',
    'verificacion_pendiente',
    'verificado',
    'firma_pendiente',
    'firmado_cliente',
    'revision_certificador',
    'aprobado_certificador',
    'certificacion_pendiente',
    'certificado',
    'entregado',
    'rechazado',
    'cancelado'
]);
exports.createDocumentSchema = zod_1.z.object({
    template_id: zod_1.z.string().uuid("El template_id debe ser un UUID v�lido."),
    nombre_documento: zod_1.z.string().min(5, "El nombre del documento debe tener al menos 5 caracteres.").max(255, "El nombre del documento no puede exceder 255 caracteres."),
    data_documento: zod_1.z.record(zod_1.z.any()).optional().default({}),
});
exports.updateDocumentSchema = zod_1.z.object({
    nombre_documento: zod_1.z.string().min(5).max(255).optional(),
    estado: exports.documentStatusSchema.optional(),
    data_documento: zod_1.z.record(zod_1.z.any()).optional(),
}).refine(data => Object.keys(data).length > 0, "Al menos un campo debe ser proporcionado para la actualizaci�n.");
exports.transitionDocumentSchema = zod_1.z.object({
    document_id: zod_1.z.string().uuid("El document_id debe ser un UUID v�lido."),
    action: zod_1.z.enum([
        'completar_datos',
        'iniciar_verificacion',
        'verificacion_exitosa',
        'solicitar_firma',
        'firma_capturada',
        'enviar_revision',
        'aprobar_certificador',
        'iniciar_certificacion',
        'certificacion_digital',
        'entregar_documento',
        'rechazar',
        'cancelar'
    ]),
    notas: zod_1.z.string().optional(),
});
const ALLOWED_TRANSITIONS = {
    'completar_datos': { nextState: 'datos_completados', allowedRoles: ['admin', 'gestor', 'operador'] },
    'iniciar_verificacion': { nextState: 'verificacion_pendiente', allowedRoles: ['admin', 'gestor', 'operador'] },
    'verificacion_exitosa': { nextState: 'verificado', allowedRoles: ['admin', 'certificador', 'validador'] },
    'solicitar_firma': { nextState: 'firma_pendiente', allowedRoles: ['admin', 'gestor', 'operador'] },
    'firma_capturada': { nextState: 'firmado_cliente', allowedRoles: ['admin', 'operador', 'cliente'] },
    'enviar_revision': { nextState: 'revision_certificador', allowedRoles: ['admin', 'operador'] },
    'aprobar_certificador': { nextState: 'aprobado_certificador', allowedRoles: ['admin', 'certificador'] },
    'iniciar_certificacion': { nextState: 'certificacion_pendiente', allowedRoles: ['admin', 'certificador'] },
    'certificacion_digital': { nextState: 'certificado', allowedRoles: ['admin', 'certificador'] },
    'entregar_documento': { nextState: 'entregado', allowedRoles: ['admin'] },
    'rechazar': { nextState: 'rechazado', allowedRoles: ['admin', 'certificador', 'operador'] },
    'cancelar': { nextState: 'cancelado', allowedRoles: ['admin', 'operador', 'cliente'] }
};
class DocumentModel {
    constructor(db) {
        this.db = db;
    }
    async create(templateId, nombreDocumento, dataDocumento, contenidoHtml, hashContenido, createdBy) {
        const id = (0, uuid_1.v4)();
        const result = await this.db.query(`INSERT INTO documents (id, template_id, nombre_documento, data_documento, contenido_html, hash_contenido, created_by, estado)
             VALUES ($1, $2, $3, $4, $5, $6, $7, 'borrador') RETURNING id, template_id, estado, nombre_documento, created_at, updated_at;`, [id, templateId, nombreDocumento, dataDocumento, contenidoHtml, hashContenido, createdBy]);
        return result.rows[0];
    }
    async list(filters = {}) {
        let query = `SELECT id, template_id, estado, nombre_documento, created_by, created_at, updated_at FROM documents`;
        const params = [];
        let whereClauses = [];
        if (filters.status) {
            whereClauses.push(`estado = $${params.push(filters.status)}`);
        }
        if (filters.createdBy) {
            whereClauses.push(`created_by = $${params.push(filters.createdBy)}`);
        }
        if (whereClauses.length > 0) {
            query += ` WHERE ${whereClauses.join(' AND ')}`;
        }
        query += ` ORDER BY created_at DESC;`;
        const result = await this.db.query(query, params);
        return result.rows;
    }
    async getById(id) {
        const result = await this.db.query(`SELECT id, template_id, estado, nombre_documento, data_documento, contenido_html, hash_contenido, created_by, created_at, updated_at FROM documents WHERE id = $1;`, [id]);
        return result.rows[0];
    }
    async update(id, updateData) {
        const fields = [];
        const values = [];
        let queryIndex = 1;
        delete updateData.template_id;
        delete updateData.created_by;
        for (const key in updateData) {
            if (updateData[key] !== undefined) {
                fields.push(`${key} = $${queryIndex++}`);
                values.push(updateData[key]);
            }
        }
        if (fields.length === 0)
            return undefined;
        values.push(id);
        const result = await this.db.query(`UPDATE documents SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = $${queryIndex} RETURNING id, template_id, estado, nombre_documento, created_at, updated_at;`, values);
        return result.rows[0];
    }
    async delete(id) {
        const result = await this.db.query(`DELETE FROM documents WHERE id = $1;`, [id]);
        return result.rowCount !== null && result.rowCount > 0;
    }
}
class DocumentModule extends base_module_1.BaseModule {
    constructor(database) {
        super(database, DOCUMENT_MODULE_CONFIG);
        this.documentModel = new DocumentModel(database);
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
            await this.db.query('SELECT 1 FROM documents LIMIT 1;');
            return { status: 'healthy', details: { db_documents: 'reachable' } };
        }
        catch (error) {
            return { status: 'unhealthy', details: { db_documents: error.message } };
        }
    }
    getRoutes() {
        return {
            'GET /documents': this.listDocuments.bind(this),
            'GET /documents/:id': this.getDocumentById.bind(this),
            'POST /documents': this.createDocument.bind(this),
            'PUT /documents/:id': this.updateDocument.bind(this),
            'DELETE /documents/:id': this.deleteDocument.bind(this),
            'POST /documents/:id/transition': this.transitionDocument.bind(this)
        };
    }
    _fillTemplate(templateHtml, data) {
        let filledHtml = templateHtml;
        for (const key in data) {
            if (Object.prototype.hasOwnProperty.call(data, key)) {
                const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
                filledHtml = filledHtml.replace(regex, String(data[key]));
            }
        }
        return filledHtml;
    }
    async createDocument(data) {
        try {
            const { user } = data;
            const validatedData = exports.createDocumentSchema.parse(data);
            const { template_id, nombre_documento, data_documento } = validatedData;
            const templateResult = await this.db.query(`SELECT content_html, fields_definition FROM templates WHERE id = $1;`, [template_id]);
            const template = templateResult.rows[0];
            if (!template) {
                throw new Error('Plantilla no encontrada.');
            }
            const fieldsDefinition = template.fields_definition ? JSON.parse(template.fields_definition) : [];
            for (const campo of fieldsDefinition) {
                if (campo.required && (data_documento[campo.name] === undefined || data_documento[campo.name] === null || data_documento[campo.name] === '')) {
                    throw new Error(`El campo requerido '${campo.name}' de la plantilla no fue proporcionado.`);
                }
            }
            const contenido_html = this._fillTemplate(template.content_html, data_documento);
            const hash_contenido = crypto_1.default.createHash('sha256').update(contenido_html).digest('hex');
            const id = (0, uuid_1.v4)();
            const result = await this.documentModel.create(template_id, nombre_documento, data_documento, contenido_html, hash_contenido, user?.userId || 'system');
            return result;
        }
        catch (error) {
            console.error('Error creating document:', error);
            if (error instanceof zod_1.z.ZodError) {
                throw new Error(`Error de validaci�n: ${error.errors.map(e => e.message).join(', ')}`);
            }
            if (error.code === '23503') {
                throw new Error('El ID de plantilla proporcionado no existe.');
            }
            if (error.code === '23505') {
                throw new Error('Ya existe un documento con este contenido (hash duplicado).');
            }
            throw new Error(error.message || 'No se pudo crear el documento.');
        }
    }
    async listDocuments(data) {
        try {
            const filters = data.filters || {};
            if (data.user?.role !== 'admin') {
                filters.createdBy = data.user?.userId;
            }
            const result = await this.documentModel.list(filters);
            return result;
        }
        catch (error) {
            console.error('Error listing documents:', error);
            throw new Error('No se pudieron listar los documentos.');
        }
    }
    async getDocumentById(data) {
        try {
            if (!data.id) {
                throw new Error("ID de documento requerido.");
            }
            const document = await this.documentModel.getById(data.id);
            if (!document) {
                throw new Error("Documento no encontrado.");
            }
            return document;
        }
        catch (error) {
            console.error('Error fetching document by ID:', error);
            throw new Error(error.message || 'No se pudo obtener el documento.');
        }
    }
    async updateDocument(data) {
        try {
            if (!data.id) {
                throw new Error("ID de documento requerido para la actualizaci�n.");
            }
            const { id, user, ...updateData } = data;
            const validatedUpdateData = exports.updateDocumentSchema.parse(updateData);
            if (validatedUpdateData.data_documento) {
                const currentDoc = await this.documentModel.getById(id);
                if (!currentDoc)
                    throw new Error("Documento no encontrado para actualizar su data.");
                const templateResult = await this.db.query(`SELECT content_html FROM templates WHERE id = $1;`, [currentDoc.template_id]);
                const template = templateResult.rows[0];
                if (!template)
                    throw new Error("Plantilla asociada no encontrada para actualizar documento.");
                const combinedData = { ...currentDoc.data_documento, ...validatedUpdateData.data_documento };
                const new_contenido_html = this._fillTemplate(template.content_html, combinedData);
                const new_hash_contenido = crypto_1.default.createHash('sha256').update(new_contenido_html).digest('hex');
                Object.assign(validatedUpdateData, {
                    contenido_html: new_contenido_html,
                    hash_contenido: new_hash_contenido,
                    data_documento: combinedData
                });
            }
            const updatedDocument = await this.documentModel.update(id, validatedUpdateData);
            if (!updatedDocument) {
                throw new Error("Documento no encontrado o no se pudo actualizar.");
            }
            return updatedDocument;
        }
        catch (error) {
            console.error('Error updating document:', error);
            if (error instanceof zod_1.z.ZodError) {
                throw new Error(`Error de validaci�n: ${error.errors.map(e => e.message).join(', ')}`);
            }
            throw new Error(error.message || 'No se pudo actualizar el documento.');
        }
    }
    async deleteDocument(data) {
        try {
            if (!data.id) {
                throw new Error("ID de documento requerido para la eliminaci�n.");
            }
            const { id, user } = data;
            const deleted = await this.documentModel.delete(id);
            if (!deleted) {
                throw new Error("Documento no encontrado para eliminar.");
            }
            return { success: true, message: "Documento eliminado exitosamente." };
        }
        catch (error) {
            console.error('Error deleting document:', error);
            throw new Error(error.message || 'No se pudo eliminar el documento.');
        }
    }
    async transitionDocument(data) {
        try {
            const { user } = data;
            const validatedTransitionData = exports.transitionDocumentSchema.parse(data);
            const { document_id, action, notas } = validatedTransitionData;
            const document = await this.documentModel.getById(document_id);
            if (!document) {
                throw new Error('Documento no encontrado para transici�n de estado.');
            }
            const transitionConfig = ALLOWED_TRANSITIONS[action];
            if (!transitionConfig) {
                throw new Error(`Acci�n '${action}' no reconocida o no permitida.`);
            }
            if (user?.role !== 'admin' && !transitionConfig.allowedRoles.includes(user?.role)) {
                throw new Error(`Permiso denegado. El rol '${user?.role}' no puede realizar la acci�n '${action}'.`);
            }
            const result = await this.executeWithTransaction(async (client) => {
                const query = `
          UPDATE documents
          SET estado = $1, updated_at = CURRENT_TIMESTAMP
          WHERE id = $2
          RETURNING id, estado, updated_at;
        `;
                const values = [transitionConfig.nextState, document_id];
                const res = await client.query(query, values);
                return res.rows[0];
            });
            return {
                document_id: result.id,
                new_state: result.estado,
                message: `Documento transicionado a '${result.estado}' mediante acci�n '${action}'.`
            };
        }
        catch (error) {
            console.error('Error transitioning document state:', error);
            if (error instanceof zod_1.z.ZodError) {
                throw new Error(`Error de validaci�n: ${error.errors.map(e => e.message).join(', ')}`);
            }
            throw new Error(error.message || 'No se pudo transicionar el estado del documento.');
        }
    }
}
exports.DocumentModule = DocumentModule;
exports.default = DocumentModule;
