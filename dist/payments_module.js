"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaymentsModule = void 0;
const zod_1 = require("zod");
const base_module_1 = require("./base_module");
const uuid_1 = require("uuid");
const PAYMENTS_MODULE_CONFIG = {
    name: 'payments_module',
    version: '1.0.0',
    enabled: true,
    dependencies: [],
    permissions: ['payments:read', 'payments:create', 'payments:process', 'payments:invoice'],
    routes: [
        'POST /payments/create',
        'POST /payments/:id/process',
        'GET /payments/history',
        'POST /payments/:id/invoice'
    ]
};
const createPaymentSchema = zod_1.z.object({
    document_id: zod_1.z.string().uuid("El document_id debe ser un UUID v�lido."),
    amount: zod_1.z.number().positive("El monto debe ser un n�mero positivo."),
    currency: zod_1.z.string().optional().default('CLP'),
});
const processPaymentSchema = zod_1.z.object({
    payment_method: zod_1.z.string().min(1, "El m�todo de pago es requerido."),
    payment_details: zod_1.z.record(zod_1.z.any()).optional(),
});
class PaymentModel {
    constructor(db) {
        this.db = db;
    }
    async create(userId, documentId, amount, currency, paymentMethod = null, transactionId = null, status = 'PENDING') {
        const id = (0, uuid_1.v4)();
        const values = [id, userId, documentId, amount, currency, paymentMethod, transactionId, status];
        const result = await this.db.query('INSERT INTO payments (id, user_id, document_id, amount, currency, payment_method, transaction_id, status) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *', values);
        return result.rows[0];
    }
    async findById(id) {
        const result = await this.db.query('SELECT * FROM payments WHERE id = $1', [id]);
        return result.rows[0];
    }
    async updateStatus(id, status, transactionId) {
        const updateFields = ['status = $1', 'updated_at = CURRENT_TIMESTAMP'];
        const updateValues = [status];
        let queryIndex = 2;
        if (transactionId) {
            updateFields.push(`transaction_id = ${queryIndex++}`);
            updateValues.push(transactionId);
        }
        updateValues.push(id);
        const result = await this.db.query(`UPDATE payments SET ${updateFields.join(', ')} WHERE id = ${queryIndex} RETURNING *`, updateValues);
        return result.rows[0];
    }
    async getHistory(userId, role) {
        let query = `
      SELECT 
        p.id, p.user_id, p.document_id, p.amount, p.currency, p.status, p.payment_method, p.transaction_id, p.created_at, p.updated_at,
        d.nombre_documento as document_title -- Asume que 'documents' tiene 'nombre_documento'
      FROM payments p 
      LEFT JOIN documents d ON p.document_id = d.id
    `;
        const params = [];
        if (role !== 'admin' && userId) {
            query += ' WHERE p.user_id = $1';
            params.push(userId);
        }
        query += ' ORDER BY p.created_at DESC';
        const result = await this.db.query(query, params);
        return result.rows;
    }
}
const paymentGateway = {
    process: async (amount, method, details) => {
        return new Promise((resolve) => {
            setTimeout(() => {
                if (Math.random() > 0.1) {
                    resolve({ success: true, transactionId: `TRX-${Date.now()}-${Math.random().toString(36).substring(2, 8)}` });
                }
                else {
                    resolve({ success: false, message: 'Fallo en la pasarela de pago simulada' });
                }
            }, 1000);
        });
    }
};
class PaymentsModule extends base_module_1.BaseModule {
    constructor(database) {
        super(database, PAYMENTS_MODULE_CONFIG);
        this.paymentModel = new PaymentModel(database);
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
            await this.db.query('SELECT 1 FROM payments LIMIT 1;');
            return { status: 'healthy', details: { db_payments: 'reachable' } };
        }
        catch (error) {
            return { status: 'unhealthy', details: { db_payments: error.message } };
        }
    }
    getRoutes() {
        return {
            'POST /payments/create': this.createPayment.bind(this),
            'POST /payments/:id/process': this.processPayment.bind(this),
            'GET /payments/history': this.getPaymentHistory.bind(this),
            'POST /payments/:id/invoice': this.generateInvoice.bind(this)
        };
    }
    async createPayment(data) {
        try {
            const validatedData = createPaymentSchema.parse(data);
            const { document_id, amount, currency } = validatedData;
            const { userId } = data.user;
            const newPayment = await this.paymentModel.create(userId, document_id, amount, currency || 'CLP');
            return { message: 'Pago creado como pendiente', payment: newPayment };
        }
        catch (error) {
            console.error('Error in createPayment:', error);
            if (error instanceof zod_1.z.ZodError) {
                throw new Error(`Error de validaci�n: ${error.errors.map(e => e.message).join(', ')}`);
            }
            throw new Error(error.message || 'No se pudo crear el pago.');
        }
    }
    async processPayment(data) {
        try {
            const { id, payment_method, payment_details } = data;
            const validatedData = processPaymentSchema.parse({ payment_method, payment_details });
            const payment = await this.paymentModel.findById(id);
            if (!payment) {
                throw new Error('Pago no encontrado.');
            }
            if (payment.status !== 'PENDING') {
                throw new Error('El pago ya fue procesado o no est� pendiente.');
            }
            const gatewayResult = await paymentGateway.process(payment.amount, validatedData.payment_method, validatedData.payment_details || {});
            if (gatewayResult.success) {
                const updatedPayment = await this.paymentModel.updateStatus(id, 'COMPLETED', gatewayResult.transactionId);
                return { message: 'Pago procesado exitosamente', payment: updatedPayment };
            }
            else {
                await this.paymentModel.updateStatus(id, 'FAILED');
                throw new Error(gatewayResult.message || 'Fallo al procesar el pago.');
            }
        }
        catch (error) {
            console.error('Error in processPayment:', error);
            if (error instanceof zod_1.z.ZodError) {
                throw new Error(`Error de validaci�n: ${error.errors.map(e => e.message).join(', ')}`);
            }
            throw new Error(error.message || 'No se pudo procesar el pago.');
        }
    }
    async getPaymentHistory(data) {
        try {
            const { userId, role } = data.user;
            const history = await this.paymentModel.getHistory(userId, role);
            return history;
        }
        catch (error) {
            console.error('Error in getPaymentHistory:', error);
            throw new Error(error.message || 'No se pudo obtener el historial de pagos.');
        }
    }
    async generateInvoice(data) {
        try {
            const payment = await this.paymentModel.findById(data.id);
            if (!payment || payment.status !== 'COMPLETED') {
                throw new Error('Pago no encontrado o no completado.');
            }
            const invoiceUrl = `http://your-invoice-service.com/invoices/${payment.id}.pdf`;
            return { message: 'Factura generada', url: invoiceUrl };
        }
        catch (error) {
            console.error('Error in generateInvoice:', error);
            throw new Error(error.message || 'No se pudo generar la factura.');
        }
    }
}
exports.PaymentsModule = PaymentsModule;
exports.default = PaymentsModule;
