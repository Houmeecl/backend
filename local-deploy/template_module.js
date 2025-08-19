"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TemplateModule = exports.updateTemplateSchema = exports.createTemplateSchema = void 0;
const zod_1 = require("zod");
const base_module_1 = require("./base_module");
const TEMPLATE_MODULE_CONFIG = {
    name: 'template_module',
    version: '1.0.0',
    enabled: true,
    dependencies: [],
    permissions: ['templates:read', 'templates:create', 'templates:update', 'templates:delete'],
    routes: [
        'GET /templates',
        'GET /templates/:id',
        'POST /templates',
        'PUT /templates/:id',
        'DELETE /templates/:id'
    ]
};
exports.createTemplateSchema = zod_1.z.object({
    codigo: zod_1.z.string().min(3, "El código debe tener al menos 3 caracteres.").max(100, "El código no puede exceder 100 caracteres."),
    nombre: zod_1.z.string().min(5, "El nombre debe tener al menos 5 caracteres.").max(255, "El nombre no puede exceder 255 caracteres."),
    categoria: zod_1.z.string().max(100, "La categoría no puede exceder 100 caracteres.").optional(),
    precio_base: zod_1.z.number().positive("El precio base debe ser un número positivo.").finite("El precio base debe ser un número finito."),
    campos_requeridos: zod_1.z.array(zod_1.z.object({
        nombre: zod_1.z.string(),
        tipo: zod_1.z.enum(['texto', 'numero', 'fecha', 'boolean']),
        requerido: zod_1.z.boolean().default(false),
        placeholder: zod_1.z.string().optional()
    })).optional().default([]),
    plantilla_html: zod_1.z.string().min(10, "La plantilla HTML es demasiado corta."),
});
exports.updateTemplateSchema = exports.createTemplateSchema.partial();
class TemplateModule extends base_module_1.BaseModule {
    constructor(database) {
        super(database, TEMPLATE_MODULE_CONFIG);
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
            'GET /templates': this.listTemplates.bind(this),
            'GET /templates/:id': this.getTemplateById.bind(this),
            'POST /templates': this.createTemplate.bind(this),
            'PUT /templates/:id': this.updateTemplate.bind(this),
            'DELETE /templates/:id': this.deleteTemplate.bind(this)
        };
    }
    async createTemplate(data) {
        try {
            const validatedData = exports.createTemplateSchema.parse(data);
            const { codigo, nombre, categoria, precio_base, campos_requeridos, plantilla_html } = validatedData;
            const result = await this.executeWithTransaction(async (client) => {
                const query = `
          INSERT INTO templates (codigo, nombre, categoria, precio_base, campos_requeridos, plantilla_html)
          VALUES ($1, $2, $3, $4, $5, $6)
          RETURNING id, codigo, nombre, categoria, precio_base, campos_requeridos, plantilla_html, created_at, updated_at;
        `;
                const values = [codigo, nombre, categoria || null, precio_base, JSON.stringify(campos_requeridos), plantilla_html];
                const res = await client.query(query, values);
                return res.rows[0];
            });
            return result;
        }
        catch (error) {
            console.error('Error creating template:', error);
            if (error instanceof zod_1.z.ZodError) {
                throw new Error(`Error de validación: ${error.errors.map(e => e.message).join(', ')}`);
            }
            if (error.code === '23505') {
                throw new Error('Ya existe una plantilla con este código.');
            }
            throw new Error('No se pudo crear la plantilla.');
        }
    }
    async listTemplates(data) {
        try {
            const result = await this.db.query(`SELECT id, codigo, nombre, categoria, precio_base, campos_requeridos, created_at, updated_at FROM templates ORDER BY created_at DESC;`);
            return result.rows;
        }
        catch (error) {
            console.error('Error listing templates:', error);
            throw new Error('No se pudieron listar las plantillas.');
        }
    }
    async getTemplateById(data) {
        try {
            if (!data.id) {
                throw new Error("ID de plantilla requerido.");
            }
            const result = await this.db.query(`SELECT id, codigo, nombre, categoria, precio_base, campos_requeridos, plantilla_html, created_at, updated_at FROM templates WHERE id = $1;`, [data.id]);
            if (result.rowCount === 0) {
                throw new Error("Plantilla no encontrada.");
            }
            return result.rows[0];
        }
        catch (error) {
            console.error('Error fetching template by ID:', error);
            throw new Error(error.message || 'No se pudo obtener la plantilla.');
        }
    }
    async updateTemplate(data) {
        try {
            if (!data.id) {
                throw new Error("ID de plantilla requerido para la actualización.");
            }
            const { id, ...updateData } = data;
            const validatedUpdateData = exports.updateTemplateSchema.parse(updateData);
            const fields = Object.keys(validatedUpdateData)
                .map((key, index) => `${key} = $${index + 2}`)
                .join(', ');
            const values = Object.values(validatedUpdateData);
            if (fields.length === 0) {
                return this.getTemplateById({ id });
            }
            const query = `
        UPDATE templates
        SET ${fields}, updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
        RETURNING id, codigo, nombre, categoria, precio_base, campos_requeridos, plantilla_html, created_at, updated_at;
      `;
            const res = await this.executeWithTransaction(async (client) => {
                const result = await client.query(query, [id, ...values]);
                return result.rows[0];
            });
            if (res === undefined) {
                throw new Error("Plantilla no encontrada para actualizar.");
            }
            return res;
        }
        catch (error) {
            console.error('Error updating template:', error);
            if (error instanceof zod_1.z.ZodError) {
                throw new Error(`Error de validación: ${error.errors.map(e => e.message).join(', ')}`);
            }
            throw new Error(error.message || 'No se pudo actualizar la plantilla.');
        }
    }
    async deleteTemplate(data) {
        try {
            if (!data.id) {
                throw new Error("ID de plantilla requerido para la eliminación.");
            }
            const rowsAffected = await this.executeWithTransaction(async (client) => {
                const res = await client.query(`DELETE FROM templates WHERE id = $1;`, [data.id]);
                return res.rowCount !== null ? res.rowCount : 0;
            });
            if (rowsAffected === 0) {
                throw new Error("Plantilla no encontrada para eliminar.");
            }
            return { success: true, message: "Plantilla eliminada exitosamente." };
        }
        catch (error) {
            console.error('Error deleting template:', error);
            throw new Error(error.message || 'No se pudo eliminar la plantilla.');
        }
    }
}
exports.TemplateModule = TemplateModule;
exports.default = TemplateModule;
