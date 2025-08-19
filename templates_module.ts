import { Pool, QueryResult } from 'pg';
import { z } from 'zod';
import { BaseModule, ModuleConfig, UserRole } from './base_module';
import { v4 as uuidv4 } from 'uuid'; // CORREGIDO: Importación de uuid
// import mammoth from 'mammoth'; // Descomenta si usas para .docx
// import pdfParse from 'pdf-parse'; // Descomenta si usas para .pdf

const TEMPLATES_MODULE_CONFIG: ModuleConfig = {
  name: 'template_module',
  version: '1.1.0', // Versión actualizada
  enabled: true,
  dependencies: [],
  permissions: ['templates:read', 'templates:create', 'templates:update', 'templates:delete', 'templates:upload_convert'], // Nuevo permiso
  routes: [
    'GET /templates',
    'GET /templates/:id',
    'POST /templates',
    'PUT /templates/:id',
    'DELETE /templates/:id',
    'POST /templates/upload-convert', // Nueva ruta para subir y convertir plantilla
    // 'POST /documents/from-template/:templateId', // Esta ruta es de DocumentModule
  ]
};

// Esquemas de validación (ampliados)
const createTemplateSchema = z.object({
  name: z.string().min(3, "El nombre de la plantilla es requerido y debe tener al menos 3 caracteres."),
  description: z.string().optional(),
  content_html: z.string().min(1, "El contenido HTML de la plantilla es requerido."),
  fields_definition: z.array(z.object({ // Definición manual de campos (si no se extraen automáticamente)
      name: z.string(),
      type: z.enum(['text', 'number', 'date', 'checkbox']),
      required: z.boolean().default(false)
  })).optional().default([]), // Asegurar un array por defecto
});

const updateTemplateSchema = z.object({
  name: z.string().min(3).optional(),
  description: z.string().optional(),
  content_html: z.string().min(1).optional(),
  fields_definition: z.array(z.object({
      name: z.string(),
      type: z.enum(['text', 'number', 'date', 'checkbox']),
      required: z.boolean().default(false)
  })).optional(),
}).refine(data => Object.keys(data).length > 0, "Al menos un campo debe ser proporcionado para la actualización.");

const uploadConvertTemplateSchema = z.object({
    file_content_base64: z.string().min(1, "El contenido del archivo en Base64 es requerido."),
    file_name: z.string().min(1, "El nombre del archivo es requerido."),
    template_name: z.string().min(3, "El nombre de la plantilla es requerido."),
    template_description: z.string().optional(),
});


// Interfaz para el modelo de Plantilla
interface Template {
  id: string;
  name: string;
  description?: string;
  content_html: string; // La plantilla final en HTML para rellenar
  fields_definition?: Array<{ name: string; type: string; required: boolean }>; // Campos que se deben rellenar
  created_by: string; // UUID del usuario
  created_at: Date;
  updated_at: Date;
}

// Modelo (operaciones de base de datos) para Plantillas
class TemplateModel {
  private db: Pool;

  constructor(db: Pool) {
    this.db = db;
  }

  async create(name: string, description: string | undefined, contentHtml: string, fieldsDefinition: any[], createdBy: string): Promise<Template> {
    const id = uuidv4();
    const result: QueryResult<Template> = await this.db.query(
      'INSERT INTO templates (id, name, description, content_html, fields_definition, created_by) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [id, name, description, contentHtml, JSON.stringify(fieldsDefinition), createdBy]
    );
    return result.rows[0];
  }

  async findById(id: string): Promise<Template | undefined> {
    const result: QueryResult<Template> = await this.db.query('SELECT * FROM templates WHERE id = $1', [id]);
    return result.rows[0];
  }

  async getAll(): Promise<Template[]> {
    const result: QueryResult<Template> = await this.db.query('SELECT * FROM templates ORDER BY name ASC');
    return result.rows;
  }

  async update(id: string, data: Partial<Template>): Promise<Template | undefined> {
    const fields: string[] = [];
    const values: any[] = [];
    let queryIndex = 1;

    if (data.fields_definition) { // Convertir a JSON string si se actualiza
        (data as any).fields_definition = JSON.stringify(data.fields_definition);
    }

    for (const key in data) {
      if ((data as any)[key] !== undefined) {
        fields.push(`${key} = $${queryIndex++}`);
        values.push((data as any)[key]);
      }
    }
    if (fields.length === 0) return undefined;

    values.push(id);
    const result: QueryResult<Template> = await this.db.query(
      `UPDATE templates SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = $${queryIndex} RETURNING *`,
      values
    );
    return result.rows[0];
  }

  async delete(id: string): Promise<boolean> {
    const result: QueryResult = await this.db.query('DELETE FROM templates WHERE id = $1', [id]);
    return result.rowCount !== null && result.rowCount > 0;
  }
}

// Función auxiliar para extraer campos de un HTML (placeholders {{campo}})
const extractFieldsFromHtml = (htmlContent: string): Array<{ name: string; type: string; required: boolean }> => {
    const regex = /\{\{\s*(\w+)\s*\}\}/g;
    const matches = htmlContent.match(regex);
    if (!matches) return [];

    const uniqueFields = new Set<string>();
    matches.forEach(match => {
        const fieldName = match.replace(/\{\{\s*|\s*\}\}/g, '');
        uniqueFields.add(fieldName);
    });

    return Array.from(uniqueFields).map(name => ({
        name,
        type: 'text', // Por defecto 'text', el usuario puede ajustar después
        required: true // Por defecto requerido, el usuario puede ajustar después
    }));
};

// Controladores para el módulo de Plantillas
export class TemplateModule extends BaseModule {
  private templateModel: TemplateModel;

  constructor(database: Pool) {
    super(database, TEMPLATES_MODULE_CONFIG);
    this.templateModel = new TemplateModel(database);
  }

  async initialize(): Promise<void> {
    this.initialized = true;
    console.log(`✅ ${this.getName()} v${this.getVersion()} initialized`);
  }

  async cleanup(): Promise<void> {
    this.initialized = false;
  }

  async getHealth(): Promise<{ status: string; details?: any; }> {
    try {
      await this.db.query('SELECT 1 FROM templates LIMIT 1;');
      return { status: 'healthy', details: { db_templates: 'reachable' } };
    } catch (error: any) {
      return { status: 'unhealthy', details: { db_templates: error.message } };
    }
  }

  getRoutes(): Record<string, Function> {
    return {
      'GET /templates': this.getAllTemplates.bind(this),
      'GET /templates/:id': this.getTemplateById.bind(this),
      'POST /templates': this.createTemplate.bind(this),
      'PUT /templates/:id': this.updateTemplate.bind(this),
      'DELETE /templates/:id': this.deleteTemplate.bind(this),
      'POST /templates/upload-convert': this.uploadConvertTemplate.bind(this),
      // 'POST /documents/from-template/:templateId', // Esta ruta es de DocumentModule
    };
  }

  async createTemplate(data: z.infer<typeof createTemplateSchema> & { user: { userId: string } }): Promise<any> {
    try {
      const validatedData = createTemplateSchema.parse(data);
      const { name, description, content_html, fields_definition } = validatedData;
      const { userId } = data.user;

      const existingTemplates = await this.templateModel.getAll(); // Obtener todas para verificar nombre
      if (existingTemplates.some(t => t.name === name)) {
        throw new Error('Ya existe una plantilla con este nombre.');
      }

      // Si no se proporcionan fields_definition, intentamos extraerlos del HTML
      const finalFieldsDefinition = fields_definition && fields_definition.length > 0 ? fields_definition : (content_html ? extractFieldsFromHtml(content_html) : []);

      const newTemplate = await this.templateModel.create(name, description, content_html, finalFieldsDefinition, userId);
      return newTemplate;
    } catch (error: any) {
      console.error('Error in createTemplate:', error);
      if (error instanceof z.ZodError) {
        throw new Error(`Error de validación: ${error.errors.map(e => e.message).join(', ')}`);
      }
      throw new Error(error.message || 'No se pudo crear la plantilla.');
    }
  }

  async getAllTemplates(): Promise<any[]> {
    try {
      const templates = await this.templateModel.getAll();
      return templates;
    } catch (error: any) {
      console.error('Error in getAllTemplates:', error);
      throw new Error(error.message || 'No se pudieron obtener las plantillas.');
    }
  }

  async getTemplateById(data: { id: string }): Promise<any> {
    try {
      if (!data.id) throw new Error("ID de plantilla requerido.");
      const template = await this.templateModel.findById(data.id);
      if (!template) {
        throw new Error('Plantilla no encontrada.');
      }
      return template;
    } catch (error: any) {
      console.error('Error in getTemplateById:', error);
      throw new Error(error.message || 'No se pudo obtener la plantilla.');
    }
  }

  async updateTemplate(data: { id: string } & z.infer<typeof updateTemplateSchema>): Promise<any> {
    try {
      if (!data.id) throw new Error("ID de plantilla requerido para la actualización.");
      const { id, ...updateData } = data;
      const validatedData = updateTemplateSchema.parse(updateData);

      const updatedTemplate = await this.templateModel.update(id, validatedData);
      if (!updatedTemplate) {
        throw new Error('Plantilla no encontrada o no se pudo actualizar.');
      }
      return updatedTemplate;
    } catch (error: any) {
      console.error('Error in updateTemplate:', error);
      if (error instanceof z.ZodError) {
        throw new Error(`Error de validación: ${error.errors.map(e => e.message).join(', ')}`);
      }
      throw new Error(error.message || 'No se pudo actualizar la plantilla.');
    }
  }

  async deleteTemplate(data: { id: string }): Promise<{ success: boolean; message: string }> {
    try {
      if (!data.id) throw new Error("ID de plantilla requerido para la eliminación.");
      const deleted = await this.templateModel.delete(data.id);
      if (!deleted) {
        throw new Error('Plantilla no encontrada o no se pudo eliminar.');
      }
      return { success: true, message: 'Plantilla eliminada exitosamente.' };
    } catch (error: any) {
      console.error('Error in deleteTemplate:', error);
      throw new Error(error.message || 'No se pudo eliminar la plantilla.');
    }
  }

  // Nueva lógica para subir un archivo de plantilla y convertirlo a HTML/extraer campos
  async uploadConvertTemplate(data: z.infer<typeof uploadConvertTemplateSchema> & { user: { userId: string } }): Promise<any> {
      try {
          const validatedData = uploadConvertTemplateSchema.parse(data);
          const { file_content_base64, file_name, template_name, template_description } = validatedData;
          const { userId } = data.user;

          const fileBuffer = Buffer.from(file_content_base64, 'base64');
          let contentHtml = '';
          let detectedFields: Array<{ name: string; type: string; required: boolean }> = [];
          
          // Deducir tipo de archivo y procesar
          if (file_name.endsWith('.html') || file_name.endsWith('.htm')) {
              contentHtml = fileBuffer.toString('utf8');
              detectedFields = extractFieldsFromHtml(contentHtml);
          } else if (file_name.endsWith('.docx')) {
              // Requiere 'mammoth.js'
              // const mammoth = await import('mammoth'); // Importación dinámica
              // const result = await mammoth.convertToHtml({ arrayBuffer: fileBuffer });
              // contentHtml = result.value;
              // detectedFields = extractFieldsFromHtml(contentHtml); // O usar lógica específica para DOCX
              throw new Error('La conversión de DOCX a HTML no está implementada. Habilita mammoth.js e importa.');
          } else if (file_name.endsWith('.pdf')) {
              // Requiere 'pdf-parse'
              // const pdfParse = await import('pdf-parse'); // Importación dinámica
              // const data = await pdfParse(fileBuffer);
              // contentHtml = `<pre>${data.text}</pre>`; // Extrae texto, no HTML renderizable
              // detectedFields = extractFieldsFromHtml(data.text); // Intentar extraer de texto plano
              throw new Error('La extracción de texto de PDF no está implementada. Habilita pdf-parse e importa.');
          } else {
              throw new Error('Formato de archivo no soportado. Solo .html, .docx, .pdf son aceptados para conversión.');
          }

          // Crear la plantilla en la base de datos
          const newTemplate = await this.templateModel.create(template_name, template_description, contentHtml, detectedFields, userId);

          return { 
              success: true, 
              message: 'Plantilla subida y convertida exitosamente.', 
              template: newTemplate,
              detected_fields: detectedFields
          };

      } catch (error: any) {
          console.error('Error uploading/converting template:', error);
          if (error instanceof z.ZodError) {
              throw new Error(`Error de validación: ${error.errors.map(e => e.message).join(', ')}`);
          }
          throw new Error(error.message || 'No se pudo subir o convertir la plantilla.');
      }
  }
}

export default TemplateModule;
