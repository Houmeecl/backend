import { Pool } from 'pg';
import { z } from 'zod';
import { BaseModule, ModuleConfig, UserRole } from './base_module';
import crypto from 'crypto';

const TEMPLATE_MODULE_CONFIG: ModuleConfig = {
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

// Esquema de validación para la creación de una plantilla
export const createTemplateSchema = z.object({
  codigo: z.string().min(3, "El código debe tener al menos 3 caracteres.").max(100, "El código no puede exceder 100 caracteres."),
  nombre: z.string().min(5, "El nombre debe tener al menos 5 caracteres.").max(255, "El nombre no puede exceder 255 caracteres."),
  categoria: z.string().max(100, "La categoría no puede exceder 100 caracteres.").optional(),
  precio_base: z.number().positive("El precio base debe ser un número positivo.").finite("El precio base debe ser un número finito."),
  campos_requeridos: z.array(
    z.object({
      nombre: z.string(),
      tipo: z.enum(['texto', 'numero', 'fecha', 'boolean']),
      requerido: z.boolean().default(false),
      placeholder: z.string().optional()
    })
  ).optional().default([]),
  plantilla_html: z.string().min(10, "La plantilla HTML es demasiado corta."),
});

// Esquema de validación para la actualización de una plantilla
export const updateTemplateSchema = createTemplateSchema.partial();

export class TemplateModule extends BaseModule {
  constructor(database: Pool) {
    super(database, TEMPLATE_MODULE_CONFIG);
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
      'GET /templates': this.listTemplates.bind(this),
      'GET /templates/:id': this.getTemplateById.bind(this),
      'POST /templates': this.createTemplate.bind(this),
      'PUT /templates/:id': this.updateTemplate.bind(this),
      'DELETE /templates/:id': this.deleteTemplate.bind(this)
    };
  }

  // Lógica para crear una nueva plantilla
  async createTemplate(data: any): Promise<any> {
    try {
      // Validar datos de entrada con Zod
      const validatedData = createTemplateSchema.parse(data);

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
    } catch (error: any) {
      console.error('Error creating template:', error);
      if (error instanceof z.ZodError) {
        throw new Error(`Error de validación: ${error.errors.map(e => e.message).join(', ')}`);
      }
      if (error.code === '23505') {
        throw new Error('Ya existe una plantilla con este código.');
      }
      throw new Error('No se pudo crear la plantilla.');
    }
  }

  // Lógica para listar plantillas
  async listTemplates(data: any): Promise<any[]> {
    try {
      const result = await this.db.query(
        `SELECT id, codigo, nombre, categoria, precio_base, campos_requeridos, created_at, updated_at FROM templates ORDER BY created_at DESC;`
      );
      return result.rows;
    } catch (error: any) {
      console.error('Error listing templates:', error);
      throw new Error('No se pudieron listar las plantillas.');
    }
  }

  // Lógica para obtener una plantilla por ID
  async getTemplateById(data: { id: string }): Promise<any | null> {
    try {
      if (!data.id) {
        throw new Error("ID de plantilla requerido.");
      }
      const result = await this.db.query(
        `SELECT id, codigo, nombre, categoria, precio_base, campos_requeridos, plantilla_html, created_at, updated_at FROM templates WHERE id = $1;`,
        [data.id]
      );
      if (result.rowCount === 0) {
        throw new Error("Plantilla no encontrada.");
      }
      return result.rows[0];
    } catch (error: any) {
      console.error('Error fetching template by ID:', error);
      throw new Error(error.message || 'No se pudo obtener la plantilla.');
    }
  }

  // Lógica para actualizar una plantilla
  async updateTemplate(data: { id: string } & Partial<z.infer<typeof createTemplateSchema>>): Promise<any> {
    try {
      if (!data.id) {
        throw new Error("ID de plantilla requerido para la actualización.");
      }
      const { id, ...updateData } = data;

      const validatedUpdateData = updateTemplateSchema.parse(updateData);

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
    } catch (error: any) {
      console.error('Error updating template:', error);
      if (error instanceof z.ZodError) {
        throw new Error(`Error de validación: ${error.errors.map(e => e.message).join(', ')}`);
      }
      throw new Error(error.message || 'No se pudo actualizar la plantilla.');
    }
  }

  // Lógica para eliminar una plantilla
  async deleteTemplate(data: { id: string }): Promise<{ success: boolean; message: string }> {
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
    } catch (error: any) {
      console.error('Error deleting template:', error);
      throw new Error(error.message || 'No se pudo eliminar la plantilla.');
    }
  }
}

export default TemplateModule;
