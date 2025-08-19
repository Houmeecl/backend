"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TemplateModule = void 0;
const zod_1 = require("zod");
const base_module_1 = require("./base_module");
const uuid_1 = require("uuid");
const TEMPLATES_MODULE_CONFIG = {
    name: 'template_module',
    version: '1.1.0',
    enabled: true,
    dependencies: [],
    permissions: ['templates:read', 'templates:create', 'templates:update', 'templates:delete', 'templates:upload_convert'],
    routes: [
        'GET /templates',
        'GET /templates/:id',
        'POST /templates',
        'PUT /templates/:id',
        'DELETE /templates/:id',
        'POST /templates/upload-convert',
    ]
};
const createTemplateSchema = zod_1.z.object({
    name: zod_1.z.string().min(3, "El nombre de la plantilla es requerido y debe tener al menos 3 caracteres."),
    description: zod_1.z.string().optional(),
    content_html: zod_1.z.string().min(1, "El contenido HTML de la plantilla es requerido."),
    fields_definition: zod_1.z.array(zod_1.z.object({
        name: zod_1.z.string(),
        type: zod_1.z.enum(['text', 'number', 'date', 'checkbox']),
        required: zod_1.z.boolean().default(false)
    })).optional().default([]),
});
const updateTemplateSchema = zod_1.z.object({
    name: zod_1.z.string().min(3).optional(),
    description: zod_1.z.string().optional(),
    content_html: zod_1.z.string().min(1).optional(),
    fields_definition: zod_1.z.array(zod_1.z.object({
        name: zod_1.z.string(),
        type: zod_1.z.enum(['text', 'number', 'date', 'checkbox']),
        required: zod_1.z.boolean().default(false)
    })).optional(),
}).refine(data => Object.keys(data).length > 0, "Al menos un campo debe ser proporcionado para la actualización.");
const uploadConvertTemplateSchema = zod_1.z.object({
    file_content_base64: zod_1.z.string().min(1, "El contenido del archivo en Base64 es requerido."),
    file_name: zod_1.z.string().min(1, "El nombre del archivo es requerido."),
    template_name: zod_1.z.string().min(3, "El nombre de la plantilla es requerido."),
    template_description: zod_1.z.string().optional(),
});
class TemplateModel {
    constructor(db) {
        this.db = db;
    }
    async create(name, description, contentHtml, fieldsDefinition, createdBy) {
        const id = (0, uuid_1.v4)();
        const result = await this.db.query('INSERT INTO templates (id, name, description, content_html, fields_definition, created_by) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *', [id, name, description, contentHtml, JSON.stringify(fieldsDefinition), createdBy]);
        return result.rows[0];
    }
    async findById(id) {
        const result = await this.db.query('SELECT * FROM templates WHERE id = $1', [id]);
        return result.rows[0];
    }
    async getAll() {
        const result = await this.db.query('SELECT * FROM templates ORDER BY name ASC');
        return result.rows;
    }
    async update(id, data) {
        const fields = [];
        const values = [];
        let queryIndex = 1;
        if (data.fields_definition) {
            data.fields_definition = JSON.stringify(data.fields_definition);
        }
        for (const key in data) {
            if (data[key] !== undefined) {
                fields.push(`${key} = $${queryIndex++}`);
                values.push(data[key]);
            }
        }
        if (fields.length === 0)
            return undefined;
        values.push(id);
        const result = await this.db.query(`UPDATE templates SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = $${queryIndex} RETURNING *`, values);
        return result.rows[0];
    }
    async delete(id) {
        const result = await this.db.query('DELETE FROM templates WHERE id = $1', [id]);
        return result.rowCount !== null && result.rowCount > 0;
    }
}
const extractFieldsFromHtml = (htmlContent) => {
    const regex = /\{\{\s*(\w+)\s*\}\}/g;
    const matches = htmlContent.match(regex);
    if (!matches)
        return [];
    const uniqueFields = new Set();
    matches.forEach(match => {
        const fieldName = match.replace(/\{\{\s*|\s*\}\}/g, '');
        uniqueFields.add(fieldName);
    });
    return Array.from(uniqueFields).map(name => ({
        name,
        type: 'text',
        required: true
    }));
};
class TemplateModule extends base_module_1.BaseModule {
    constructor(database) {
        super(database, TEMPLATES_MODULE_CONFIG);
        this.templateModel = new TemplateModel(database);
    }
    async initialize() {
        this.initialized = true;
        console.log(`✅ ${this.getName()} v${this.getVersion()} initialized`);
    }
    async cleanup() {
        this.initialized = false;
    }
    async getHealth() {
        try {
            await this.db.query('SELECT 1 FROM templates LIMIT 1;');
            return { status: 'healthy', details: { db_templates: 'reachable' } };
        }
        catch (error) {
            return { status: 'unhealthy', details: { db_templates: error.message } };
        }
    }
    getRoutes() {
        return {
            'GET /templates': this.getAllTemplates.bind(this),
            'GET /templates/:id': this.getTemplateById.bind(this),
            'POST /templates': this.createTemplate.bind(this),
            'PUT /templates/:id': this.updateTemplate.bind(this),
            'DELETE /templates/:id': this.deleteTemplate.bind(this),
            'POST /templates/upload-convert': this.uploadConvertTemplate.bind(this),
        };
    }
    async createTemplate(data) {
        try {
            const validatedData = createTemplateSchema.parse(data);
            const { name, description, content_html, fields_definition } = validatedData;
            const { userId } = data.user;
            const existingTemplates = await this.templateModel.getAll();
            if (existingTemplates.some(t => t.name === name)) {
                throw new Error('Ya existe una plantilla con este nombre.');
            }
            const finalFieldsDefinition = fields_definition && fields_definition.length > 0 ? fields_definition : (content_html ? extractFieldsFromHtml(content_html) : []);
            const newTemplate = await this.templateModel.create(name, description, content_html, finalFieldsDefinition, userId);
            return newTemplate;
        }
        catch (error) {
            console.error('Error in createTemplate:', error);
            if (error instanceof zod_1.z.ZodError) {
                throw new Error(`Error de validación: ${error.errors.map(e => e.message).join(', ')}`);
            }
            throw new Error(error.message || 'No se pudo crear la plantilla.');
        }
    }
    async getAllTemplates() {
        try {
            const templates = await this.templateModel.getAll();
            return templates;
        }
        catch (error) {
            console.error('Error in getAllTemplates:', error);
            throw new Error(error.message || 'No se pudieron obtener las plantillas.');
        }
    }
    async getTemplateById(data) {
        try {
            if (!data.id)
                throw new Error("ID de plantilla requerido.");
            const template = await this.templateModel.findById(data.id);
            if (!template) {
                throw new Error('Plantilla no encontrada.');
            }
            return template;
        }
        catch (error) {
            console.error('Error in getTemplateById:', error);
            throw new Error(error.message || 'No se pudo obtener la plantilla.');
        }
    }
    async updateTemplate(data) {
        try {
            if (!data.id)
                throw new Error("ID de plantilla requerido para la actualización.");
            const { id, ...updateData } = data;
            const validatedData = updateTemplateSchema.parse(updateData);
            const updatedTemplate = await this.templateModel.update(id, validatedData);
            if (!updatedTemplate) {
                throw new Error('Plantilla no encontrada o no se pudo actualizar.');
            }
            return updatedTemplate;
        }
        catch (error) {
            console.error('Error in updateTemplate:', error);
            if (error instanceof zod_1.z.ZodError) {
                throw new Error(`Error de validación: ${error.errors.map(e => e.message).join(', ')}`);
            }
            throw new Error(error.message || 'No se pudo actualizar la plantilla.');
        }
    }
    async deleteTemplate(data) {
        try {
            if (!data.id)
                throw new Error("ID de plantilla requerido para la eliminación.");
            const deleted = await this.templateModel.delete(data.id);
            if (!deleted) {
                throw new Error('Plantilla no encontrada o no se pudo eliminar.');
            }
            return { success: true, message: 'Plantilla eliminada exitosamente.' };
        }
        catch (error) {
            console.error('Error in deleteTemplate:', error);
            throw new Error(error.message || 'No se pudo eliminar la plantilla.');
        }
    }
    async uploadConvertTemplate(data) {
        try {
            const validatedData = uploadConvertTemplateSchema.parse(data);
            const { file_content_base64, file_name, template_name, template_description } = validatedData;
            const { userId } = data.user;
            const fileBuffer = Buffer.from(file_content_base64, 'base64');
            let contentHtml = '';
            let detectedFields = [];
            if (file_name.endsWith('.html') || file_name.endsWith('.htm')) {
                contentHtml = fileBuffer.toString('utf8');
                detectedFields = extractFieldsFromHtml(contentHtml);
            }
            else if (file_name.endsWith('.docx')) {
                throw new Error('La conversión de DOCX a HTML no está implementada. Habilita mammoth.js e importa.');
            }
            else if (file_name.endsWith('.pdf')) {
                throw new Error('La extracción de texto de PDF no está implementada. Habilita pdf-parse e importa.');
            }
            else {
                throw new Error('Formato de archivo no soportado. Solo .html, .docx, .pdf son aceptados para conversión.');
            }
            const newTemplate = await this.templateModel.create(template_name, template_description, contentHtml, detectedFields, userId);
            return {
                success: true,
                message: 'Plantilla subida y convertida exitosamente.',
                template: newTemplate,
                detected_fields: detectedFields
            };
        }
        catch (error) {
            console.error('Error uploading/converting template:', error);
            if (error instanceof zod_1.z.ZodError) {
                throw new Error(`Error de validación: ${error.errors.map(e => e.message).join(', ')}`);
            }
            throw new Error(error.message || 'No se pudo subir o convertir la plantilla.');
        }
    }
}
exports.TemplateModule = TemplateModule;
exports.default = TemplateModule;
