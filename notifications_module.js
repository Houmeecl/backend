"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationsModule = void 0;
const zod_1 = require("zod");
const base_module_1 = require("./base_module");
const nodemailer_1 = __importDefault(require("nodemailer"));
const uuid_1 = require("uuid");
const NOTIFICATIONS_MODULE_CONFIG = {
    name: 'notifications_module',
    version: '1.1.0',
    enabled: true,
    dependencies: ['document_module', 'signers_module', 'audit_module'],
    permissions: ['notifications:send', 'notifications:history_read'],
    routes: [
        'POST /contract/send/draft-priority/{ContractID}',
        'POST /contract/send/draft-priority/{ContractID}/{rut}',
        'POST /notifications/send',
        'GET /notifications/history'
    ]
};
const sendNotificationSchema = zod_1.z.object({
    type: zod_1.z.enum(['SIGNING_REQUEST', 'SIGNATURE_COMPLETED', 'DOCUMENT_CERTIFIED', 'REMINDER', 'DRAFT_PRIORITY']),
    document_id: zod_1.z.string().uuid("El document_id debe ser un UUID válido."),
    recipient_email: zod_1.z.string().email("El email del destinatario es inválido.").optional(),
    recipient_rut: zod_1.z.string().optional(),
    template_data: zod_1.z.record(zod_1.z.any()).optional(),
});
class NotificationModel {
    constructor(db) {
        this.db = db;
    }
    async create(documentId, recipientEmail, type, subject, message, status, errorMessage) {
        const id = (0, uuid_1.v4)();
        const result = await this.db.query(`INSERT INTO notifications (id, document_id, recipient_email, notification_type, subject, message, status, error_message, sent_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP) RETURNING *`, [id, documentId, recipientEmail, type, subject, message, status, errorMessage]);
        return result.rows[0];
    }
    async getHistory(documentId) {
        let query = 'SELECT * FROM notifications';
        const params = [];
        if (documentId) {
            query += ' WHERE document_id = $1';
            params.push(documentId);
        }
        query += ' ORDER BY created_at DESC';
        const result = await this.db.query(query, params);
        return result.rows;
    }
}
class NotificationsModule extends base_module_1.BaseModule {
    constructor(database, emailConfig) {
        super(database, NOTIFICATIONS_MODULE_CONFIG);
        this.emailConfig = emailConfig;
        this.emailTransporter = nodemailer_1.default.createTransport({
            host: emailConfig.host,
            port: emailConfig.port,
            secure: emailConfig.secure,
            auth: emailConfig.auth,
        });
        this.notificationModel = new NotificationModel(database);
    }
    async initialize() {
        this.initialized = true;
        console.log(`✅ ${this.getName()} v${this.getVersion()} initialized`);
    }
    async cleanup() {
        this.initialized = false;
        this.emailTransporter.close();
    }
    async getHealth() {
        try {
            await this.db.query('SELECT 1 FROM notifications LIMIT 1;');
            await this.emailTransporter.verify();
            return { status: 'healthy', details: { db_notifications: 'reachable', email_smtp: 'connected' } };
        }
        catch (error) {
            return { status: 'unhealthy', details: { db_notifications: error.message || 'Error DB', email_smtp: error.message || 'Error SMTP' } };
        }
    }
    getRoutes() {
        return {
            'POST /contract/send/draft-priority/:ContractID': this.sendDraftPriorityNotification.bind(this),
            'POST /contract/send/draft-priority/:ContractID/:rut': this.resendNotificationByRut.bind(this),
            'POST /notifications/send': this.sendGenericNotification.bind(this),
            'GET /notifications/history': this.getNotificationHistory.bind(this),
        };
    }
    async _sendEmailAndRecord(documentId, recipientEmail, type, subject, htmlContent, trackingCode) {
        try {
            const info = await this.emailTransporter.sendMail({
                from: this.emailConfig.from,
                to: recipientEmail,
                subject: subject,
                html: htmlContent,
            });
            console.log(`Email '${type}' enviado a ${recipientEmail}: ${info.messageId}`);
            const notification = await this.notificationModel.create(documentId, recipientEmail, type, subject, htmlContent, 'SENT');
            return notification;
        }
        catch (error) {
            console.error(`Error enviando email '${type}' a ${recipientEmail}:`, error);
            const errorMessage = error.message || 'Error desconocido al enviar email.';
            const notification = await this.notificationModel.create(documentId, recipientEmail, type, subject, htmlContent, 'FAILED', errorMessage);
            return notification;
        }
    }
    async sendDraftPriorityNotification(data) {
        try {
            const { ContractID: documentId, user } = data;
            const signers = [
                { email: 'firmante1@example.com', full_name: 'Firmante Uno', order_number: 1, rut_id: '11111111-1' },
                { email: 'firmante2@example.com', full_name: 'Firmante Dos', order_number: 2, rut_id: '22222222-2' }
            ];
            const documentTitle = 'Contrato de Servicios Ejemplo';
            if (!signers || signers.length === 0) {
                throw new Error('No hay firmantes asociados a este documento para enviar notificaciones.');
            }
            let notificationsSentCount = 0;
            for (const signer of signers) {
                const signingToken = `token_${documentId}_${signer.rut_id}`;
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
                }
            }
            return { success: true, message: 'Notificaciones de firma enviadas exitosamente.', notifications_sent: notificationsSentCount };
        }
        catch (error) {
            console.error('Error in sendDraftPriorityNotification:', error);
            throw new Error(error.message || 'No se pudieron enviar las notificaciones de prioridad.');
        }
    }
    async resendNotificationByRut(data) {
        try {
            const { ContractID: documentId, rut, user } = data;
            const signer = { email: 'firmante_a_reenviar@example.com', full_name: 'Firmante a Reenviar', rut_id: rut };
            const documentTitle = 'Documento de Prueba para Reenvío';
            if (!signer) {
                throw new Error('Firmante no encontrado para el documento especificado.');
            }
            const signingLink = `${process.env.FRONTEND_URL}/sign-document/${documentId}/${(0, uuid_1.v4)()}`;
            const subject = `Recordatorio: Documento pendiente de firma - NotaryPro: ${documentTitle}`;
            const htmlContent = `
          <p>Hola ${signer.full_name},</p>
          <p>Te recordamos que el documento "${documentTitle}" aún está pendiente de tu firma. Por favor, haz clic aquí:</p>
          <p><a href="${signingLink}" style="padding: 10px 20px; background-color: #ffc107; color: black; text-decoration: none; border-radius: 5px;">Reanudar Firma</a></p>
          <p>Gracias,<br>El equipo de NotaryPro</p>
      `;
            const result = await this._sendEmailAndRecord(documentId, signer.email, 'REMINDER', subject, htmlContent);
            return { success: true, message: 'Notificación reenviada exitosamente.', data: { email: signer.email, sent_at: result.sent_at } };
        }
        catch (error) {
            console.error('Error in resendNotificationByRut:', error);
            throw new Error(error.message || 'No se pudo reenviar la notificación.');
        }
    }
    async sendGenericNotification(data) {
        try {
            const validatedData = sendNotificationSchema.parse(data);
            const { type, document_id, recipient_email, template_data } = validatedData;
            let subject = 'Notificación de NotaryPro';
            let htmlContent = '<p>Estimado/a usuario/a,</p><p>Recibiste una notificación de NotaryPro.</p>';
            if (type === 'SIGNATURE_COMPLETED') {
                subject = `Documento "${template_data?.documentTitle || 'Sin título'}" firmado por todos los participantes.`;
                htmlContent = `
                  <p>Estimado/a usuario/a,</p>
                  <p>El documento "${template_data?.documentTitle || 'Sin título'}" ha sido firmado por todos los participantes.</p>
                  <p>Puedes revisar el estado final aquí: <a href="${process.env.FRONTEND_URL}/track-document/${document_id}">Ver Estado del Documento</a></p>
                  <p>Gracias por usar NotaryPro.</p>
              `;
            }
            else if (type === 'DOCUMENT_CERTIFIED') {
                subject = `Documento "${template_data?.documentTitle || 'Sin título'}" Certificado y Disponible.`;
                htmlContent = `
                  <p>Estimado/a usuario/a,</p>
                  <p>Tu documento "${template_data?.documentTitle || 'Sin título'}" ha sido certificado y está disponible.</p>
                  <p><strong>Código de Seguimiento:</strong> ${document_id}</p>
                  <p>Puedes acceder a tu documento final aquí: <a href="${process.env.FRONTEND_URL}/track-document/${document_id}">Ver Documento Certificado</a></p>
                  <p>Gracias por usar NotaryPro.</p>
              `;
            }
            if (!recipient_email) {
                throw new Error('El email del destinatario es requerido para esta notificación.');
            }
            const result = await this._sendEmailAndRecord(document_id, recipient_email, type, subject, htmlContent);
            return { success: true, message: 'Notificación genérica enviada.', data: { notification_id: result.id, status: result.status } };
        }
        catch (error) {
            console.error('Error in sendGenericNotification:', error);
            if (error instanceof zod_1.z.ZodError) {
                throw new Error(`Error de validación: ${error.errors.map(e => e.message).join(', ')}`);
            }
            throw new Error(error.message || 'No se pudo enviar la notificación genérica.');
        }
    }
    async getNotificationHistory(data) {
        try {
            const history = await this.notificationModel.getHistory(data.documentId);
            return history;
        }
        catch (error) {
            console.error('Error in getNotificationHistory:', error);
            throw new Error(error.message || 'No se pudo obtener el historial de notificaciones.');
        }
    }
}
exports.NotificationsModule = NotificationsModule;
exports.default = NotificationsModule;
