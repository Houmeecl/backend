import { Pool, QueryResult } from 'pg';
import { z } from 'zod';
import { BaseModule, ModuleConfig, UserRole } from './base_module';
import nodemailer from 'nodemailer';
import { v4 as uuidv4 } from 'uuid'; // CORREGIDO: Importación de uuid

// Importar tipos de Nodemailer para tipado correcto
import { Transporter } from 'nodemailer';

const NOTIFICATIONS_MODULE_CONFIG: ModuleConfig = {
  name: 'notifications_module',
  version: '1.1.0', // Versión actualizada
  enabled: true,
  dependencies: ['document_module', 'signers_module', 'audit_module'], // Dependencias para obtener datos y logging
  permissions: ['notifications:send', 'notifications:history_read'],
  routes: [
    'POST /contract/send/draft-priority/{ContractID}',
    'POST /contract/send/draft-priority/{ContractID}/{rut}',
    'POST /notifications/send', // Endpoint más genérico para diferentes tipos de notificación
    'GET /notifications/history' // Para obtener historial general de notificaciones
  ]
};

// Esquemas de validación (para un endpoint de envío más genérico)
const sendNotificationSchema = z.object({
  type: z.enum(['SIGNING_REQUEST', 'SIGNATURE_COMPLETED', 'DOCUMENT_CERTIFIED', 'REMINDER', 'DRAFT_PRIORITY']),
  document_id: z.string().uuid("El document_id debe ser un UUID válido."),
  recipient_email: z.string().email("El email del destinatario es inválido.").optional(), // Si es para un solo recipiente
  recipient_rut: z.string().optional(), // Si se envía por RUT
  template_data: z.record(z.any()).optional(), // Datos para rellenar la plantilla de email
  // Puedes añadir `recipients_list: z.array(z.string().email()).optional()` si envías a múltiples
});

// Interfaz para la configuración de email (se pasa en el constructor del módulo)
interface EmailConfig {
    host: string;
    port: number;
    secure: boolean;
    auth: {
        user: string;
        pass: string;
    };
    from: string; // La dirección "from" del remitente
}

// Interfaz para una Notificación (cómo se guarda en la DB)
interface Notification {
    id: string;
    document_id: string;
    recipient_email: string;
    notification_type: 'SIGNING_REQUEST' | 'SIGNATURE_COMPLETED' | 'DOCUMENT_CERTIFIED' | 'REMINDER' | 'DRAFT_PRIORITY';
    status: 'PENDING' | 'SENT' | 'FAILED' | 'DELIVERED' | 'OPENED' | 'CLICKED';
    subject: string;
    message: string;
    sent_at: Date;
    error_message?: string;
    created_at: Date;
}

// Modelo para las operaciones de base de datos de Notificaciones
class NotificationModel {
    private db: Pool;

    constructor(db: Pool) {
        this.db = db;
    }

    async create(documentId: string, recipientEmail: string, type: Notification['notification_type'], subject: string, message: string, status: Notification['status'], errorMessage?: string): Promise<Notification> {
        const id = uuidv4();
        const result: QueryResult<Notification> = await this.db.query(
            `INSERT INTO notifications (id, document_id, recipient_email, notification_type, subject, message, status, error_message, sent_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP) RETURNING *`,
            [id, documentId, recipientEmail, type, subject, message, status, errorMessage]
        );
        return result.rows[0];
    }

    async getHistory(documentId?: string): Promise<Notification[]> {
        let query = 'SELECT * FROM notifications';
        const params: any[] = [];
        if (documentId) {
            query += ' WHERE document_id = $1';
            params.push(documentId);
        }
        query += ' ORDER BY created_at DESC';
        const result: QueryResult<Notification> = await this.db.query(query, params);
        return result.rows;
    }
}


export class NotificationsModule extends BaseModule {
  private emailTransporter: Transporter;
  private notificationModel: NotificationModel;
  // Las dependencias se inicializan en core_manager o se pasan aquí si es necesario
  // private documentModel: any; 
  // private signersModel: any;
  // private auditModuleInstance: any; 

  constructor(database: Pool, private emailConfig: EmailConfig) {
    super(database, NOTIFICATIONS_MODULE_CONFIG);
    this.emailTransporter = nodemailer.createTransport({
        host: emailConfig.host,
        port: emailConfig.port,
        secure: emailConfig.secure,
        auth: emailConfig.auth,
    });
    this.notificationModel = new NotificationModel(database);
    // Para interactuar con otros módulos, necesitarás inyectar sus modelos o instancias de módulos aquí
    // o hacer llamadas a la DB directamente si la lógica es simple.
  }

  async initialize(): Promise<void> {
    this.initialized = true;
    console.log(`✅ ${this.getName()} v${this.getVersion()} initialized`);
  }

  async cleanup(): Promise<void> {
    this.initialized = false;
    this.emailTransporter.close();
  }

  async getHealth(): Promise<{ status: string; details?: any; }> {
    try {
      await this.db.query('SELECT 1 FROM notifications LIMIT 1;');
      await this.emailTransporter.verify(); // Verifica conexión SMTP
      return { status: 'healthy', details: { db_notifications: 'reachable', email_smtp: 'connected' } };
    } catch (error: any) {
      return { status: 'unhealthy', details: { db_notifications: error.message || 'Error DB', email_smtp: error.message || 'Error SMTP' } };
    }
  }

  getRoutes(): Record<string, Function> {
    return {
      'POST /contract/send/draft-priority/:ContractID': this.sendDraftPriorityNotification.bind(this),
      'POST /contract/send/draft-priority/:ContractID/:rut': this.resendNotificationByRut.bind(this),
      'POST /notifications/send': this.sendGenericNotification.bind(this), // Endpoint genérico
      'GET /notifications/history': this.getNotificationHistory.bind(this),
    };
  }

  // Método auxiliar para enviar emails genéricos y registrar
  private async _sendEmailAndRecord(documentId: string, recipientEmail: string, type: Notification['notification_type'], subject: string, htmlContent: string, trackingCode?: string): Promise<Notification> {
      try {
          const info = await this.emailTransporter.sendMail({
              from: this.emailConfig.from, // Usar la dirección configurada en el constructor/env
              to: recipientEmail,
              subject: subject,
              html: htmlContent,
          });
          console.log(`Email '${type}' enviado a ${recipientEmail}: ${info.messageId}`);
          const notification = await this.notificationModel.create(documentId, recipientEmail, type, subject, htmlContent, 'SENT');
          // Emitir evento de auditoría si auditModuleInstance está disponible
          // this.auditModuleInstance.logEvent({ event_type: `NOTIFICATION_SENT_${type}`, entity_id: documentId, user_id: notification.id, details: { recipient: recipientEmail, subject } });
          return notification;
      } catch (error: any) {
          console.error(`Error enviando email '${type}' a ${recipientEmail}:`, error);
          const errorMessage = error.message || 'Error desconocido al enviar email.';
          const notification = await this.notificationModel.create(documentId, recipientEmail, type, subject, htmlContent, 'FAILED', errorMessage);
          // this.auditModuleInstance.logEvent({ event_type: `NOTIFICATION_FAILED_${type}`, entity_id: documentId, user_id: notification.id, details: { recipient: recipientEmail, subject, error: errorMessage } });
          return notification;
      }
  }

  // Modificado: enviar notificaciones de prioridad para inicio de firma
  async sendDraftPriorityNotification(data: { ContractID: string } & { user?: { userId: string } }): Promise<any> {
    try {
      const { ContractID: documentId, user } = data;
      
      // Simulación de obtención de firmantes y título de documento.
      // En una implementación real, llamarías a documentModule y signersModule.
      const signers: { email: string; full_name: string; order_number: number; rut_id: string; }[] = [
        { email: 'firmante1@example.com', full_name: 'Firmante Uno', order_number: 1, rut_id: '11111111-1' },
        { email: 'firmante2@example.com', full_name: 'Firmante Dos', order_number: 2, rut_id: '22222222-2' }
      ];
      const documentTitle = 'Contrato de Servicios Ejemplo'; 

      if (!signers || signers.length === 0) {
          throw new Error('No hay firmantes asociados a este documento para enviar notificaciones.');
      }

      let notificationsSentCount = 0;
      for (const signer of signers) {
          // Generar enlace de firma único para este firmante.
          // Esta lógica de generación de token/URL debe estar en el signatures_module.
          // Aquí, solo simulamos. En el signatures_module, se crearía y almacenaría este token.
          const signingToken = `token_${documentId}_${signer.rut_id}`; // Simulación de token
          const signingLink = `${process.env.FRONTEND_URL}/sign-document/${documentId}/${signingToken}`;

          const subject = `Documento listo para tu firma - NotaryPro: ${documentTitle}`;
          const htmlContent = `
              <p>Hola ${signer.full_name},</p>
              <p>El documento "${documentTitle}" está listo para tu firma. Por favor, haz clic en el siguiente enlace para iniciar el proceso:</p>
              <p><a href="${signingLink}" style="padding: 10px 20px; background-color: #007bff; color: white; text-decoration: none; border-radius: 5px;">Firmar Documento Ahora</a></p>
              <p>Este enlace expirará en 72 horas.</p>
              <p>Gracias,<br>El equipo de NotaryPro</p>
          `;
          const result = await this._sendEmailAndRecord(documentId, signer.email, 'SIGNING_REQUEST', subject, htmlContent);
          if (result.status === 'SENT') {
              notificationsSentCount++;
              // Registrar en auditoría
              // this.auditModuleInstance.logEvent({ event_type: `NOTIFICATION_SENT_DRAFT_PRIORITY`, entity_id: documentId, user_id: user?.userId, details: { recipient: signer.email } });
          }
      }

      return { success: true, message: 'Notificaciones de firma enviadas exitosamente.', notifications_sent: notificationsSentCount };
    } catch (error: any) {
      console.error('Error in sendDraftPriorityNotification:', error);
      throw new Error(error.message || 'No se pudieron enviar las notificaciones de prioridad.');
    }
  }

  async resendNotificationByRut(data: { ContractID: string; rut: string } & { user?: { userId: string } }): Promise<any> {
    try {
      const { ContractID: documentId, rut, user } = data;
      
      // Simulación de obtención de firmante y título de documento.
      // En una implementación real, llamarías a signersModule y documentModule.
      const signer = { email: 'firmante_a_reenviar@example.com', full_name: 'Firmante a Reenviar', rut_id: rut };
      const documentTitle = 'Documento de Prueba para Reenvío';

      if (!signer) {
        throw new Error('Firmante no encontrado para el documento especificado.');
      }

      const signingLink = `${process.env.FRONTEND_URL}/sign-document/${documentId}/${uuidv4()}`; // Generar un nuevo token si es necesario
      const subject = `Recordatorio: Documento pendiente de firma - NotaryPro: ${documentTitle}`;
      const htmlContent = `
          <p>Hola ${signer.full_name},</p>
          <p>Te recordamos que el documento "${documentTitle}" aún está pendiente de tu firma. Por favor, haz clic aquí:</p>
          <p><a href="${signingLink}" style="padding: 10px 20px; background-color: #ffc107; color: black; text-decoration: none; border-radius: 5px;">Reanudar Firma</a></p>
          <p>Gracias,<br>El equipo de NotaryPro</p>
      `;
      const result = await this._sendEmailAndRecord(documentId, signer.email, 'REMINDER', subject, htmlContent);
      // this.auditModuleInstance.logEvent({ event_type: `NOTIFICATION_RESENT`, entity_id: documentId, user_id: user?.userId, details: { recipient: signer.email, rut } });

      return { success: true, message: 'Notificación reenviada exitosamente.', data: { email: signer.email, sent_at: result.sent_at } };
    } catch (error: any) {
      console.error('Error in resendNotificationByRut:', error);
      throw new Error(error.message || 'No se pudo reenviar la notificación.');
    }
  }

  // Nuevo método para un envío de notificación más genérico (por ejemplo, para el tracking code)
  async sendGenericNotification(data: z.infer<typeof sendNotificationSchema> & { user?: { userId: string } }): Promise<any> {
      try {
          const validatedData = sendNotificationSchema.parse(data);
          const { type, document_id, recipient_email, template_data } = validatedData;
          // const { userId } = data.user; // Para logging o auditoría

          let subject = 'Notificación de NotaryPro';
          let htmlContent = '<p>Estimado/a usuario/a,</p><p>Recibiste una notificación de NotaryPro.</p>';

          // Personalizar según el tipo de notificación
          if (type === 'SIGNATURE_COMPLETED') {
              subject = `Documento "${template_data?.documentTitle || 'Sin título'}" firmado por todos los participantes.`;
              htmlContent = `
                  <p>Estimado/a usuario/a,</p>
                  <p>El documento "${template_data?.documentTitle || 'Sin título'}" ha sido firmado por todos los participantes.</p>
                  <p>Puedes revisar el estado final aquí: <a href="${process.env.FRONTEND_URL}/track-document/${document_id}">Ver Estado del Documento</a></p>
                  <p>Gracias por usar NotaryPro.</p>
              `;
          } else if (type === 'DOCUMENT_CERTIFIED') {
              subject = `Documento "${template_data?.documentTitle || 'Sin título'}" Certificado y Disponible.`;
              htmlContent = `
                  <p>Estimado/a usuario/a,</p>
                  <p>Tu documento "${template_data?.documentTitle || 'Sin título'}" ha sido certificado y está disponible.</p>
                  <p><strong>Código de Seguimiento:</strong> ${document_id}</p>
                  <p>Puedes acceder a tu documento final aquí: <a href="${process.env.FRONTEND_URL}/track-document/${document_id}">Ver Documento Certificado</a></p>
                  <p>Gracias por usar NotaryPro.</p>
              `;
          }
          // Puedes añadir más tipos de notificación aquí.

          if (!recipient_email) {
              // Si no se especifica recipient_email, se podría buscar todos los participantes del documento.
              throw new Error('El email del destinatario es requerido para esta notificación.');
          }

          const result = await this._sendEmailAndRecord(document_id, recipient_email, type, subject, htmlContent);
          // this.auditModuleInstance.logEvent({ event_type: `NOTIFICATION_SENT_${type}`, entity_id: document_id, user_id: user?.userId, details: { recipient: recipient_email, subject } });

          return { success: true, message: 'Notificación genérica enviada.', data: { notification_id: result.id, status: result.status } };

      } catch (error: any) {
          console.error('Error in sendGenericNotification:', error);
          if (error instanceof z.ZodError) {
              throw new Error(`Error de validación: ${error.errors.map(e => e.message).join(', ')}`);
          }
          throw new Error(error.message || 'No se pudo enviar la notificación genérica.');
      }
  }

  async getNotificationHistory(data: { documentId?: string }): Promise<any[]> {
    try {
      const history = await this.notificationModel.getHistory(data.documentId);
      return history;
    } catch (error: any) {
      console.error('Error in getNotificationHistory:', error);
      throw new Error(error.message || 'No se pudo obtener el historial de notificaciones.');
    }
  }
}

export default NotificationsModule;
