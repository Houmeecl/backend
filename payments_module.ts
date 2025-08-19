import { Pool, QueryResult } from 'pg';
import { z } from 'zod';
import { BaseModule, ModuleConfig, UserRole } from './base_module';
import { v4 as uuidv4 } from 'uuid';

const PAYMENTS_MODULE_CONFIG: ModuleConfig = {
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

// Esquemas de validación
const createPaymentSchema = z.object({
  document_id: z.string().uuid("El document_id debe ser un UUID válido."),
  amount: z.number().positive("El monto debe ser un número positivo."),
  currency: z.string().optional().default('CLP'),
});

const processPaymentSchema = z.object({
  payment_method: z.string().min(1, "El método de pago es requerido."),
  payment_details: z.record(z.any()).optional(), // Detalles específicos de la pasarela (ej. token de tarjeta)
});

// Interfaz para el modelo de Pago
interface Payment {
  id: string;
  user_id: string;
  document_id: string;
  amount: number;
  currency: string;
  status: 'PENDING' | 'COMPLETED' | 'FAILED' | 'REFUNDED';
  payment_method?: string;
  transaction_id?: string;
  created_at: Date;
  updated_at: Date;
}

// Modelo (operaciones de base de datos) para Pagos
class PaymentModel {
  private db: Pool;

  constructor(db: Pool) {
    this.db = db;
  }

  async create(userId: string, documentId: string, amount: number, currency: string, paymentMethod: string | null = null, transactionId: string | null = null, status: Payment['status'] = 'PENDING'): Promise<Payment> {
    const id = uuidv4();
    const values = [id, userId, documentId, amount, currency, paymentMethod, transactionId, status];
    
    const result: QueryResult<Payment> = await this.db.query(
      'INSERT INTO payments (id, user_id, document_id, amount, currency, payment_method, transaction_id, status) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *',
      values
    );
    return result.rows[0];
  }

  async findById(id: string): Promise<Payment | undefined> {
    const result: QueryResult<Payment> = await this.db.query('SELECT * FROM payments WHERE id = $1', [id]);
    return result.rows[0];
  }

  async updateStatus(id: string, status: Payment['status'], transactionId?: string): Promise<Payment | undefined> {
    const updateFields = ['status = $1', 'updated_at = CURRENT_TIMESTAMP'];
    const updateValues: any[] = [status];
    let queryIndex = 2;

    if (transactionId) {
        updateFields.push(`transaction_id = ${queryIndex++}`);
        updateValues.push(transactionId);
    }
    
    updateValues.push(id); // ID para la cláusula WHERE

    const result: QueryResult<Payment> = await this.db.query(
      `UPDATE payments SET ${updateFields.join(', ')} WHERE id = ${queryIndex} RETURNING *`,
      updateValues
    );
    return result.rows[0];
  }

  async getHistory(userId: string | null, role: UserRole): Promise<Payment[]> {
    let query = `
      SELECT 
        p.id, p.user_id, p.document_id, p.amount, p.currency, p.status, p.payment_method, p.transaction_id, p.created_at, p.updated_at,
        d.nombre_documento as document_title -- Asume que 'documents' tiene 'nombre_documento'
      FROM payments p 
      LEFT JOIN documents d ON p.document_id = d.id
    `;
    const params: any[] = [];
    
    if (role !== 'admin' && userId) { // Los administradores pueden ver todo
      query += ' WHERE p.user_id = $1';
      params.push(userId);
    }
    query += ' ORDER BY p.created_at DESC';
    const result: QueryResult<Payment & { document_title?: string }> = await this.db.query(query, params);
    return result.rows;
  }
}

// Simulación de pasarela de pago (en un entorno real sería una integración externa)
const paymentGateway = {
    process: async (amount: number, method: string, details: Record<string, any>): Promise<{ success: boolean; transactionId?: string; message?: string }> => {
        return new Promise((resolve) => {
            setTimeout(() => {
                if (Math.random() > 0.1) { // 90% de éxito simulado
                    resolve({ success: true, transactionId: `TRX-${Date.now()}-${Math.random().toString(36).substring(2, 8)}` });
                } else {
                    resolve({ success: false, message: 'Fallo en la pasarela de pago simulada' });
                }
            }, 1000);
        });
    }
};

export class PaymentsModule extends BaseModule {
  private paymentModel: PaymentModel;

  constructor(database: Pool) {
    super(database, PAYMENTS_MODULE_CONFIG);
    this.paymentModel = new PaymentModel(database);
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
      await this.db.query('SELECT 1 FROM payments LIMIT 1;');
      return { status: 'healthy', details: { db_payments: 'reachable' } };
    } catch (error: any) {
      return { status: 'unhealthy', details: { db_payments: error.message } };
    }
  }

  getRoutes(): Record<string, Function> {
    return {
      'POST /payments/create': this.createPayment.bind(this),
      'POST /payments/:id/process': this.processPayment.bind(this),
      'GET /payments/history': this.getPaymentHistory.bind(this),
      'POST /payments/:id/invoice': this.generateInvoice.bind(this)
    };
  }

  async createPayment(data: z.infer<typeof createPaymentSchema> & { user: { userId: string } }): Promise<any> {
    try {
      const validatedData = createPaymentSchema.parse(data);
      const { document_id, amount, currency } = validatedData;
      const { userId } = data.user;

      const newPayment = await this.paymentModel.create(userId, document_id, amount, currency || 'CLP');
      return { message: 'Pago creado como pendiente', payment: newPayment };
    } catch (error: any) {
      console.error('Error in createPayment:', error);
      if (error instanceof z.ZodError) {
        throw new Error(`Error de validación: ${error.errors.map(e => e.message).join(', ')}`);
      }
      throw new Error(error.message || 'No se pudo crear el pago.');
    }
  }

  async processPayment(data: { id: string } & z.infer<typeof processPaymentSchema>): Promise<any> {
    try {
      const { id, payment_method, payment_details } = data;
      const validatedData = processPaymentSchema.parse({ payment_method, payment_details });

      const payment = await this.paymentModel.findById(id);
      if (!payment) {
        throw new Error('Pago no encontrado.');
      }
      if (payment.status !== 'PENDING') {
        throw new Error('El pago ya fue procesado o no está pendiente.');
      }

      const gatewayResult = await paymentGateway.process(payment.amount, validatedData.payment_method, validatedData.payment_details || {});

      if (gatewayResult.success) {
        const updatedPayment = await this.paymentModel.updateStatus(id, 'COMPLETED', gatewayResult.transactionId);
        return { message: 'Pago procesado exitosamente', payment: updatedPayment };
      } else {
        await this.paymentModel.updateStatus(id, 'FAILED');
        throw new Error(gatewayResult.message || 'Fallo al procesar el pago.');
      }
    } catch (error: any) {
      console.error('Error in processPayment:', error);
      if (error instanceof z.ZodError) {
        throw new Error(`Error de validación: ${error.errors.map(e => e.message).join(', ')}`);
      }
      throw new Error(error.message || 'No se pudo procesar el pago.');
    }
  }

  async getPaymentHistory(data: { user: { userId: string; role: UserRole } }): Promise<any[]> {
    try {
      const { userId, role } = data.user;
      const history = await this.paymentModel.getHistory(userId, role);
      return history;
    } catch (error: any) {
      console.error('Error in getPaymentHistory:', error);
      throw new Error(error.message || 'No se pudo obtener el historial de pagos.');
    }
  }

  async generateInvoice(data: { id: string }): Promise<any> {
    try {
      const payment = await this.paymentModel.findById(data.id);
      if (!payment || payment.status !== 'COMPLETED') {
        throw new Error('Pago no encontrado o no completado.');
      }
      // Lógica para generar PDF de factura (ej. con 'pdfkit' o un servicio externo)
      const invoiceUrl = `http://your-invoice-service.com/invoices/${payment.id}.pdf`; // URL simulada
      return { message: 'Factura generada', url: invoiceUrl };
    } catch (error: any) {
      console.error('Error in generateInvoice:', error);
      throw new Error(error.message || 'No se pudo generar la factura.');
    }
  }
}

export default PaymentsModule;