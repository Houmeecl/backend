import { Pool, QueryResult } from 'pg';
import { z } from 'zod';
import { BaseModule, ModuleConfig, UserRole } from './base_module';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';

const DOCUMENT_MODULE_CONFIG: ModuleConfig = {
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

// Esquema de validaci�n para el estado del documento
export const documentStatusSchema = z.enum([
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

// Esquema de validaci�n para la creaci�n de un documento
export const createDocumentSchema = z.object({
  template_id: z.string().uuid("El template_id debe ser un UUID v�lido."),
  nombre_documento: z.string().min(5, "El nombre del documento debe tener al menos 5 caracteres.").max(255, "El nombre del documento no puede exceder 255 caracteres."),
  data_documento: z.record(z.any()).optional().default({}),
});

// Esquema de validaci�n para la actualizaci�n de un documento
export const updateDocumentSchema = z.object({
  nombre_documento: z.string().min(5).max(255).optional(),
  estado: documentStatusSchema.optional(),
  data_documento: z.record(z.any()).optional(),
}).refine(data => Object.keys(data).length > 0, "Al menos un campo debe ser proporcionado para la actualizaci�n.");

// Esquema para la transici�n de estado del documento
export const transitionDocumentSchema = z.object({
  document_id: z.string().uuid("El document_id debe ser un UUID v�lido."),
  action: z.enum([
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
  notas: z.string().optional(),
});

// Definici�n de las transiciones permitidas y los roles
const ALLOWED_TRANSITIONS: Record<string, { nextState: string; allowedRoles: UserRole[] }> = {
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

// Interfaz para el modelo de Documento
interface Document {
    id: string;
    template_id: string;
    nombre_documento: string;
    estado: string;
    data_documento: Record<string, any>;
    contenido_html: string;
    hash_contenido: string;
    created_by: string;
    created_at: Date;
    updated_at: Date;
}

// Modelo (operaciones de base de datos) para Documentos
class DocumentModel {
    private db: Pool;

    constructor(db: Pool) {
        this.db = db;
    }

    async create(templateId: string, nombreDocumento: string, dataDocumento: Record<string, any>, contenidoHtml: string, hashContenido: string, createdBy: string): Promise<Document> {
        const id = uuidv4();
        const result: QueryResult<Document> = await this.db.query(
            `INSERT INTO documents (id, template_id, nombre_documento, data_documento, contenido_html, hash_contenido, created_by, estado)
             VALUES ($1, $2, $3, $4, $5, $6, $7, 'borrador') RETURNING id, template_id, estado, nombre_documento, created_at, updated_at;`,
            [id, templateId, nombreDocumento, dataDocumento, contenidoHtml, hashContenido, createdBy]
        );
        return result.rows[0];
    }

    async list(filters: any = {}): Promise<Document[]> {
        let query = `SELECT id, template_id, estado, nombre_documento, created_by, created_at, updated_at FROM documents`;
        const params: any[] = [];
        let whereClauses: string[] = [];

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

        const result: QueryResult<Document> = await this.db.query(query, params);
        return result.rows;
    }

    async getById(id: string): Promise<Document | undefined> {
        const result: QueryResult<Document> = await this.db.query(
            `SELECT id, template_id, estado, nombre_documento, data_documento, contenido_html, hash_contenido, created_by, created_at, updated_at FROM documents WHERE id = $1;`,
            [id]
        );
        return result.rows[0];
    }

    async update(id: string, updateData: Partial<Document>): Promise<Document | undefined> {
        const fields: string[] = [];
        const values: any[] = [];
        let queryIndex = 1;
        
        // No permitir actualizar template_id o created_by directamente
        delete updateData.template_id;
        delete updateData.created_by;

        for (const key in updateData) {
            if ((updateData as any)[key] !== undefined) {
                fields.push(`${key} = $${queryIndex++}`);
                values.push((updateData as any)[key]);
            }
        }
        if (fields.length === 0) return undefined;

        values.push(id);
        const result: QueryResult<Document> = await this.db.query(
            `UPDATE documents SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = $${queryIndex} RETURNING id, template_id, estado, nombre_documento, created_at, updated_at;`,
            values
        );
        return result.rows[0];
    }

    async delete(id: string): Promise<boolean> {
        const result: QueryResult = await this.db.query(`DELETE FROM documents WHERE id = $1;`, [id]);
        return result.rowCount !== null && result.rowCount > 0;
    }
}

export class DocumentModule extends BaseModule {
  private documentModel: DocumentModel;

  constructor(database: Pool) {
    super(database, DOCUMENT_MODULE_CONFIG);
    this.documentModel = new DocumentModel(database);
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
      await this.db.query('SELECT 1 FROM documents LIMIT 1;');
      return { status: 'healthy', details: { db_documents: 'reachable' } };
    } catch (error: any) {
      return { status: 'unhealthy', details: { db_documents: error.message } };
    }
  }

  getRoutes(): Record<string, Function> {
    return {
      'GET /documents': this.listDocuments.bind(this),
      'GET /documents/:id': this.getDocumentById.bind(this),
      'POST /documents': this.createDocument.bind(this),
      'PUT /documents/:id': this.updateDocument.bind(this),
      'DELETE /documents/:id': this.deleteDocument.bind(this),
      'POST /documents/:id/transition': this.transitionDocument.bind(this)
    };
  }

  // Funci�n auxiliar para rellenar la plantilla HTML
  private _fillTemplate(templateHtml: string, data: Record<string, any>): string {
    let filledHtml = templateHtml;
    for (const key in data) {
      if (Object.prototype.hasOwnProperty.call(data, key)) {
        const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
        filledHtml = filledHtml.replace(regex, String(data[key]));
      }
    }
    return filledHtml;
  }

  async createDocument(data: z.infer<typeof createDocumentSchema> & { user?: { userId: string; email: string; role: UserRole; } }): Promise<any> {
    try {
      const { user } = data; 
      const validatedData = createDocumentSchema.parse(data);

      const { template_id, nombre_documento, data_documento } = validatedData;

      // 1. Obtener la plantilla por su ID
      const templateResult: QueryResult = await this.db.query(
        `SELECT content_html, fields_definition FROM templates WHERE id = $1;`,
        [template_id]
      );
      const template = templateResult.rows[0];

      if (!template) {
        throw new Error('Plantilla no encontrada.');
      }

      // 2. Validar que los campos requeridos de la plantilla est�n presentes
      const fieldsDefinition = template.fields_definition ? JSON.parse(template.fields_definition) : [];
      for (const campo of fieldsDefinition) {
          if (campo.required && (data_documento[campo.name] === undefined || data_documento[campo.name] === null || data_documento[campo.name] === '')) {
              throw new Error(`El campo requerido '${campo.name}' de la plantilla no fue proporcionado.`);
          }
      }

      // 3. Rellenar la plantilla HTML con los datos proporcionados
      const contenido_html = this._fillTemplate(template.content_html, data_documento);

      // 4. Calcular el hash del contenido para verificar integridad
      const hash_contenido = crypto.createHash('sha256').update(contenido_html).digest('hex');

      // 5. Insertar el documento en la base de datos
      const id = uuidv4();
      const result = await this.documentModel.create(
        template_id, 
        nombre_documento, 
        data_documento, 
        contenido_html, 
        hash_contenido, 
        user?.userId || 'system'
      );
      
      return result;

    } catch (error: any) {
      console.error('Error creating document:', error);
      if (error instanceof z.ZodError) {
        throw new Error(`Error de validaci�n: ${error.errors.map(e => e.message).join(', ')}`);
      }
      if (error.code === '23503') { // ForeignKeyViolation
        throw new Error('El ID de plantilla proporcionado no existe.');
      }
      if (error.code === '23505') { // UniqueViolation
        throw new Error('Ya existe un documento con este contenido (hash duplicado).');
      }
      throw new Error(error.message || 'No se pudo crear el documento.');
    }
  }

  async listDocuments(data: { user?: { userId: string; role: UserRole; }; filters?: any }): Promise<any[]> {
    try {
      const filters = data.filters || {};
      if (data.user?.role !== 'admin') {
          filters.createdBy = data.user?.userId;
      }
      const result = await this.documentModel.list(filters);
      return result;
    } catch (error: any) {
      console.error('Error listing documents:', error);
      throw new Error('No se pudieron listar los documentos.');
    }
  }

  async getDocumentById(data: { id: string }): Promise<any | null> {
    try {
      if (!data.id) {
        throw new Error("ID de documento requerido.");
      }
      const document = await this.documentModel.getById(data.id);
      if (!document) {
        throw new Error("Documento no encontrado.");
      }
      return document;
    } catch (error: any) {
      console.error('Error fetching document by ID:', error);
      throw new Error(error.message || 'No se pudo obtener el documento.');
    }
  }

  async updateDocument(data: { id: string } & Partial<z.infer<typeof updateDocumentSchema>> & { user?: { userId: string } }): Promise<any> {
    try {
      if (!data.id) {
        throw new Error("ID de documento requerido para la actualizaci�n.");
      }
      const { id, user, ...updateData } = data;

      const validatedUpdateData = updateDocumentSchema.parse(updateData);
      
      // Si se actualiza data_documento, necesitamos volver a rellenar la plantilla y calcular el hash
      if (validatedUpdateData.data_documento) {
        const currentDoc = await this.documentModel.getById(id);
        if (!currentDoc) throw new Error("Documento no encontrado para actualizar su data.");
        
        // Obtener la plantilla asociada para volver a rellenar
        const templateResult: QueryResult = await this.db.query(
            `SELECT content_html FROM templates WHERE id = $1;`,
            [currentDoc.template_id]
        );
        const template = templateResult.rows[0];
        if (!template) throw new Error("Plantilla asociada no encontrada para actualizar documento.");

        // Combinar data_documento existente con la nueva data_documento
        const combinedData = { ...currentDoc.data_documento, ...validatedUpdateData.data_documento };

        const new_contenido_html = this._fillTemplate(template.content_html, combinedData);
        const new_hash_contenido = crypto.createHash('sha256').update(new_contenido_html).digest('hex');

        Object.assign(validatedUpdateData, {
            contenido_html: new_contenido_html,
            hash_contenido: new_hash_contenido,
            data_documento: combinedData
        });
      }
      
      const updatedDocument = await this.documentModel.update(id, validatedUpdateData as Partial<Document>);
      if (!updatedDocument) {
        throw new Error("Documento no encontrado o no se pudo actualizar.");
      }

      return updatedDocument;

    } catch (error: any) {
      console.error('Error updating document:', error);
      if (error instanceof z.ZodError) {
        throw new Error(`Error de validaci�n: ${error.errors.map(e => e.message).join(', ')}`);
      }
      throw new Error(error.message || 'No se pudo actualizar el documento.');
    }
  }

  async deleteDocument(data: { id: string } & { user?: { userId: string } }): Promise<{ success: boolean; message: string }> {
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
    } catch (error: any) {
      console.error('Error deleting document:', error);
      throw new Error(error.message || 'No se pudo eliminar el documento.');
    }
  }

  async transitionDocument(data: z.infer<typeof transitionDocumentSchema> & { user?: { userId: string; email: string; role: UserRole; } }): Promise<any> {
    try {
      const { user } = data;
      const validatedTransitionData = transitionDocumentSchema.parse(data);
      const { document_id, action, notas } = validatedTransitionData;

      const document = await this.documentModel.getById(document_id);

      if (!document) {
        throw new Error('Documento no encontrado para transici�n de estado.');
      }

      const transitionConfig = ALLOWED_TRANSITIONS[action as string];
      if (!transitionConfig) {
          throw new Error(`Acci�n '${action}' no reconocida o no permitida.`);
      }

      // Si el usuario no es ADMIN, verificar si su rol est� permitido para esta acci�n
      if (user?.role !== 'admin' && !transitionConfig.allowedRoles.includes(user?.role as UserRole)) {
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

    } catch (error: any) {
      console.error('Error transitioning document state:', error);
      if (error instanceof z.ZodError) {
        throw new Error(`Error de validaci�n: ${error.errors.map(e => e.message).join(', ')}`);
      }
      throw new Error(error.message || 'No se pudo transicionar el estado del documento.');
    }
  }
}

export default DocumentModule;