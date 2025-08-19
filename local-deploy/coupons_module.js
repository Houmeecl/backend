"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CouponsModule = void 0;
const zod_1 = require("zod");
const base_module_1 = require("./base_module");
const uuid_1 = require("uuid");
const COUPONS_MODULE_CONFIG = {
    name: 'coupons_module',
    version: '1.0.1',
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
const createCouponSchema = zod_1.z.object({
    code: zod_1.z.string().min(3, "El código del cupón debe tener al menos 3 caracteres."),
    discount_value: zod_1.z.number().positive("El valor de descuento debe ser un número positivo."),
    discount_type: zod_1.z.enum(['percentage', 'fixed'], {
        errorMap: (issue, ctx) => {
            if (issue.code === zod_1.z.ZodIssueCode.invalid_enum_value) {
                return { message: "El tipo de descuento debe ser 'percentage' o 'fixed'." };
            }
            return { message: ctx.defaultError };
        }
    }),
    description: zod_1.z.string().optional(),
    expires_at: zod_1.z.string().datetime("La fecha de expiración debe ser una fecha y hora válida.").optional(),
    max_uses: zod_1.z.number().int().positive("Los usos máximos deben ser un entero positivo.").optional(),
    document_types: zod_1.z.array(zod_1.z.string()).optional().default(['all']),
});
const validateCouponSchema = zod_1.z.object({
    code: zod_1.z.string().min(1, "El código del cupón es requerido."),
    documentType: zod_1.z.string().optional(),
    userId: zod_1.z.string().uuid("El userId debe ser un UUID válido.").optional(),
});
const applyCouponSchema = zod_1.z.object({
    code: zod_1.z.string().min(1, "El código del cupón es requerido."),
    documentId: zod_1.z.string().uuid("El documentId debe ser un UUID válido."),
});
class CouponModel {
    constructor(db) {
        this.db = db;
    }
    async create(code, discountValue, discountType, description, expiresAt, maxUses, documentTypes = ['all']) {
        const id = (0, uuid_1.v4)();
        const result = await this.db.query('INSERT INTO coupons (id, code, discount_value, discount_type, description, expires_at, max_uses, document_types) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *', [id, code, discountValue, discountType, description, expiresAt, maxUses, documentTypes]);
        return result.rows[0];
    }
    async findByCode(code) {
        const result = await this.db.query('SELECT * FROM coupons WHERE code = $1 AND is_active = TRUE', [code]);
        return result.rows[0];
    }
    async getAll() {
        const result = await this.db.query('SELECT * FROM coupons ORDER BY created_at DESC');
        return result.rows;
    }
    async incrementUsage(id) {
        const result = await this.db.query('UPDATE coupons SET current_uses = current_uses + 1, updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *', [id]);
        return result.rows[0];
    }
    async getUsage(id) {
        const result = await this.db.query('SELECT current_uses, max_uses FROM coupons WHERE id = $1', [id]);
        return result.rows[0];
    }
}
class CouponsModule extends base_module_1.BaseModule {
    constructor(database) {
        super(database, COUPONS_MODULE_CONFIG);
        this.couponModel = new CouponModel(database);
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
            await this.db.query('SELECT 1 FROM coupons LIMIT 1;');
            return { status: 'healthy', details: { db_coupons: 'reachable' } };
        }
        catch (error) {
            return { status: 'unhealthy', details: { db_coupons: error.message } };
        }
    }
    getRoutes() {
        return {
            'GET /coupons': this.getAllCoupons.bind(this),
            'POST /coupons': this.createCoupon.bind(this),
            'POST /coupons/validate': this.validateCoupon.bind(this),
            'POST /coupons/apply': this.applyCoupon.bind(this),
            'GET /coupons/:id/usage': this.getCouponUsage.bind(this)
        };
    }
    async createCoupon(data) {
        try {
            const validatedData = createCouponSchema.parse(data);
            const newCoupon = await this.couponModel.create(validatedData.code, validatedData.discount_value, validatedData.discount_type, validatedData.description, validatedData.expires_at ? new Date(validatedData.expires_at) : undefined, validatedData.max_uses, validatedData.document_types);
            return newCoupon;
        }
        catch (error) {
            console.error('Error in createCoupon:', error);
            if (error instanceof zod_1.z.ZodError) {
                throw new Error(`Error de validación: ${error.errors.map(e => e.message).join(', ')}`);
            }
            if (error.code === '23505') {
                throw new Error('El código de cupón ya existe.');
            }
            throw new Error(error.message || 'No se pudo crear el cupón.');
        }
    }
    async getAllCoupons() {
        try {
            const coupons = await this.couponModel.getAll();
            return coupons;
        }
        catch (error) {
            console.error('Error in getAllCoupons:', error);
            throw new Error(error.message || 'No se pudieron obtener los cupones.');
        }
    }
    async validateCoupon(data) {
        try {
            const validatedData = validateCouponSchema.parse(data);
            const { code, documentType, userId } = validatedData;
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
            return {
                valid: true,
                message: 'Cupón válido',
                discount: coupon.discount_value,
                type: coupon.discount_type
            };
        }
        catch (error) {
            console.error('Error in validateCoupon:', error);
            if (error instanceof zod_1.z.ZodError) {
                throw new Error(`Error de validación: ${error.errors.map(e => e.message).join(', ')}`);
            }
            throw new Error(error.message || 'No se pudo validar el cupón.');
        }
    }
    async applyCoupon(data) {
        try {
            const validatedData = applyCouponSchema.parse(data);
            const { code, documentId } = validatedData;
            const coupon = await this.couponModel.findByCode(code);
            if (!coupon || !coupon.is_active || (coupon.expires_at && new Date(coupon.expires_at) < new Date()) || (coupon.max_uses && coupon.current_uses >= coupon.max_uses)) {
                throw new Error('Cupón inválido o no aplicable.');
            }
            const updatedCoupon = await this.couponModel.incrementUsage(coupon.id);
            return { success: true, message: 'Cupón aplicado exitosamente', coupon: updatedCoupon };
        }
        catch (error) {
            console.error('Error in applyCoupon:', error);
            if (error instanceof zod_1.z.ZodError) {
                throw new Error(`Error de validación: ${error.errors.map(e => e.message).join(', ')}`);
            }
            throw new Error(error.message || 'No se pudo aplicar el cupón.');
        }
    }
    async getCouponUsage(data) {
        try {
            if (!data.id)
                throw new Error("ID de cupón requerido.");
            const usage = await this.couponModel.getUsage(data.id);
            if (!usage) {
                throw new Error('Cupón no encontrado.');
            }
            return usage;
        }
        catch (error) {
            console.error('Error in getCouponUsage:', error);
            throw new Error(error.message || 'No se pudo obtener el uso del cupón.');
        }
    }
}
exports.CouponsModule = CouponsModule;
exports.default = CouponsModule;
