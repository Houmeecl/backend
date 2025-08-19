import { Pool, QueryResult } from 'pg';
import { z } from 'zod';
import { BaseModule, ModuleConfig, UserRole } from './base_module';
import { v4 as uuidv4 } from 'uuid'; // CORREGIDO: Importación de uuid

const COUPONS_MODULE_CONFIG: ModuleConfig = {
  name: 'coupons_module',
  version: '1.0.1', // Versión actualizada después de corrección
  enabled: true,
  dependencies: [],
  permissions: ['coupons:read', 'coupons:create', 'coupons:update', 'coupons:delete', 'coupons:validate', 'coupons:apply', 'coupons:usage_read'],
  routes: [
    'GET /coupons',
    'POST /coupons',
    'POST /coupons/validate',
    'POST /coupons/apply',
    'GET /coupons/:id/usage'
  ]
};

// Esquemas de validación
const createCouponSchema = z.object({
  code: z.string().min(3, "El código del cupón debe tener al menos 3 caracteres."),
  discount_value: z.number().positive("El valor de descuento debe ser un número positivo."),
  // CORREGIDO: Usar errorMap para mensajes personalizados en z.enum
  discount_type: z.enum(['percentage', 'fixed'], {
    errorMap: (issue, ctx) => {
      if (issue.code === z.ZodIssueCode.invalid_enum_value) {
        return { message: "El tipo de descuento debe ser 'percentage' o 'fixed'." };
      }
      return { message: ctx.defaultError };
    }
  }),
  description: z.string().optional(),
  expires_at: z.string().datetime("La fecha de expiración debe ser una fecha y hora válida.").optional(),
  max_uses: z.number().int().positive("Los usos máximos deben ser un entero positivo.").optional(),
  document_types: z.array(z.string()).optional().default(['all']),
});

const validateCouponSchema = z.object({
    code: z.string().min(1, "El código del cupón es requerido."),
    documentType: z.string().optional(), // Tipo de documento para validación específica
    userId: z.string().uuid("El userId debe ser un UUID válido.").optional(), // Para cupones específicos de usuario
});

const applyCouponSchema = z.object({
    code: z.string().min(1, "El código del cupón es requerido."),
    documentId: z.string().uuid("El documentId debe ser un UUID válido."),
});


// Interfaz para el modelo de Cupón
interface Coupon {
  id: string;
  code: string;
  discount_value: number;
  discount_type: 'percentage' | 'fixed';
  description?: string;
  expires_at?: Date;
  max_uses?: number;
  current_uses: number;
  is_active: boolean;
  document_types?: string[];
  created_at: Date;
  updated_at: Date;
}

// Modelo (operaciones de base de datos) para Cupones
class CouponModel {
  private db: Pool;

  constructor(db: Pool) {
    this.db = db;
  }

  async create(
    code: string,
    discountValue: number,
    discountType: 'percentage' | 'fixed',
    description?: string,
    expiresAt?: Date,
    maxUses?: number,
    documentTypes: string[] = ['all']
  ): Promise<Coupon> {
    const id = uuidv4();
    const result: QueryResult<Coupon> = await this.db.query(
      'INSERT INTO coupons (id, code, discount_value, discount_type, description, expires_at, max_uses, document_types) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *',
      [id, code, discountValue, discountType, description, expiresAt, maxUses, documentTypes]
    );
    return result.rows[0];
  }

  async findByCode(code: string): Promise<Coupon | undefined> {
    const result: QueryResult<Coupon> = await this.db.query('SELECT * FROM coupons WHERE code = $1 AND is_active = TRUE', [code]);
    return result.rows[0];
  }

  async getAll(): Promise<Coupon[]> {
    const result: QueryResult<Coupon> = await this.db.query('SELECT * FROM coupons ORDER BY created_at DESC');
    return result.rows;
  }

  async incrementUsage(id: string): Promise<Coupon | undefined> {
    const result: QueryResult<Coupon> = await this.db.query(
      'UPDATE coupons SET current_uses = current_uses + 1, updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *',
      [id]
    );
    return result.rows[0];
  }

  async getUsage(id: string): Promise<{ current_uses: number; max_uses?: number } | undefined> {
    const result: QueryResult<{ current_uses: number; max_uses?: number }> = await this.db.query(
      'SELECT current_uses, max_uses FROM coupons WHERE id = $1',
      [id]
    );
    return result.rows[0];
  }
}

export class CouponsModule extends BaseModule {
  private couponModel: CouponModel;

  constructor(database: Pool) {
    super(database, COUPONS_MODULE_CONFIG);
    this.couponModel = new CouponModel(database);
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
      await this.db.query('SELECT 1 FROM coupons LIMIT 1;');
      return { status: 'healthy', details: { db_coupons: 'reachable' } };
    } catch (error: any) {
      return { status: 'unhealthy', details: { db_coupons: error.message } };
    }
  }

  getRoutes(): Record<string, Function> {
    return {
      'GET /coupons': this.getAllCoupons.bind(this),
      'POST /coupons': this.createCoupon.bind(this),
      'POST /coupons/validate': this.validateCoupon.bind(this),
      'POST /coupons/apply': this.applyCoupon.bind(this),
      'GET /coupons/:id/usage': this.getCouponUsage.bind(this)
    };
  }

  async createCoupon(data: z.infer<typeof createCouponSchema>): Promise<any> {
    try {
      const validatedData = createCouponSchema.parse(data);
      const newCoupon = await this.couponModel.create(
        validatedData.code,
        validatedData.discount_value,
        validatedData.discount_type,
        validatedData.description,
        validatedData.expires_at ? new Date(validatedData.expires_at) : undefined,
        validatedData.max_uses,
        validatedData.document_types
      );
      return newCoupon;
    } catch (error: any) {
      console.error('Error in createCoupon:', error);
      if (error instanceof z.ZodError) {
        throw new Error(`Error de validación: ${error.errors.map(e => e.message).join(', ')}`);
      }
      if (error.code === '23505') { // UniqueViolation (código de cupón duplicado)
        throw new Error('El código de cupón ya existe.');
      }
      throw new Error(error.message || 'No se pudo crear el cupón.');
    }
  }

  async getAllCoupons(): Promise<any[]> {
    try {
      const coupons = await this.couponModel.getAll();
      return coupons;
    } catch (error: any) {
      console.error('Error in getAllCoupons:', error);
      throw new Error(error.message || 'No se pudieron obtener los cupones.');
    }
  }

  async validateCoupon(data: z.infer<typeof validateCouponSchema> & { user?: { userId: string } }): Promise<any> {
    try {
      const validatedData = validateCouponSchema.parse(data);
      const { code, documentType, userId } = validatedData; // userId del cliente autenticado

      const coupon = await this.couponModel.findByCode(code);

      if (!coupon) {
        throw new Error('Cupón no encontrado o inactivo.');
      }
      if (coupon.expires_at && new Date(coupon.expires_at) < new Date()) {
        throw new Error('Cupón expirado.');
      }
      if (coupon.max_uses && coupon.current_uses >= coupon.max_uses) {
        throw new Error('Cupón sin usos disponibles.');
      }
      if (coupon.document_types && !coupon.document_types.includes('all') && documentType && !coupon.document_types.includes(documentType)) {
          throw new Error('Cupón no aplica a este tipo de documento.');
      }
      // Podrías añadir lógica aquí si el cupón es de un solo uso por usuario, etc.
      
      return { 
          valid: true, 
          message: 'Cupón válido', 
          discount: coupon.discount_value, 
          type: coupon.discount_type 
      };
    } catch (error: any) {
      console.error('Error in validateCoupon:', error);
      if (error instanceof z.ZodError) {
        throw new Error(`Error de validación: ${error.errors.map(e => e.message).join(', ')}`);
      }
      throw new Error(error.message || 'No se pudo validar el cupón.');
    }
  }

  async applyCoupon(data: z.infer<typeof applyCouponSchema>): Promise<any> {
    try {
      const validatedData = applyCouponSchema.parse(data);
      const { code, documentId } = validatedData;
      
      const coupon = await this.couponModel.findByCode(code);
      if (!coupon || !coupon.is_active || (coupon.expires_at && new Date(coupon.expires_at) < new Date()) || (coupon.max_uses && coupon.current_uses >= coupon.max_uses)) {
        throw new Error('Cupón inválido o no aplicable.');
      }

      // Lógica para asociar el cupón al documento/pago
      // Esto implicaría una actualización en la tabla de documentos o pagos
      // Por simplicidad, aquí solo incrementamos el uso del cupón.
      const updatedCoupon = await this.couponModel.incrementUsage(coupon.id);

      return { success: true, message: 'Cupón aplicado exitosamente', coupon: updatedCoupon };
    } catch (error: any) {
      console.error('Error in applyCoupon:', error);
      if (error instanceof z.ZodError) {
        throw new Error(`Error de validación: ${error.errors.map(e => e.message).join(', ')}`);
      }
      throw new Error(error.message || 'No se pudo aplicar el cupón.');
    }
  }

  async getCouponUsage(data: { id: string }): Promise<any> {
    try {
      if (!data.id) throw new Error("ID de cupón requerido.");
      const usage = await this.couponModel.getUsage(data.id);
      if (!usage) {
        throw new Error('Cupón no encontrado.');
      }
      return usage;
    } catch (error: any) {
      console.error('Error in getCouponUsage:', error);
      throw new Error(error.message || 'No se pudo obtener el uso del cupón.');
    }
  }
}

export default CouponsModule;
