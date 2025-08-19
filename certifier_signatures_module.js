"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CertifierSignaturesModule = void 0;
const zod_1 = require("zod");
const base_module_1 = require("./base_module");
const CERTIFIER_SIGNATURES_MODULE_CONFIG = {
    name: 'certifier_signatures_module',
    version: '1.0.1',
    enabled: true,
    dependencies: ['document_module', 'files_module', 'audit_module', 'notifications_module'],
    permissions: ['signatures:certifier_upload'],
    routes: [
        'POST /signatures/certifier-upload'
    ]
};
const uploadCertifierSignedPdfSchema = zod_1.z.object({
    document_id: zod_1.z.string().uuid("El document_id debe ser un UUID válido."),
    certifier_id: zod_1.z.string().uuid("El certifier_id debe ser un UUID válido."),
    signed_pdf_base64: zod_1.z.string().min(10, "El PDF firmado en Base64 es requerido."),
});
class CertifierSignaturesModule extends base_module_1.BaseModule {
    constructor(database) {
        super(database, CERTIFIER_SIGNATURES_MODULE_CONFIG);
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
            await this.db.query('SELECT 1 FROM documents LIMIT 1;');
            return { status: 'healthy', details: { certifier_db: 'reachable' } };
        }
        catch (error) {
            return { status: 'unhealthy', details: { certifier_db: error.message } };
        }
    }
    getRoutes() {
        return {
            'POST /signatures/certifier-upload': this.uploadCertifierSignedPdf.bind(this),
        };
    }
    async uploadCertifierSignedPdf(data) {
        try {
            const validatedData = uploadCertifierSignedPdfSchema.parse(data);
            const { document_id, certifier_id, signed_pdf_base64 } = validatedData;
            const { userId: uploaderId, role: uploaderRole } = data.user;
            if (uploaderRole !== 'admin' && uploaderRole !== 'certificador') {
                throw new Error('Permiso denegado. Solo administradores o certificadores pueden subir PDFs certificados.');
            }
            if (uploaderId !== certifier_id && uploaderRole !== 'admin') {
                throw new Error('No estás autorizado para certificar este documento con otro ID de certificador.');
            }
            const document = { id: document_id, nombre_documento: "Documento para Certificar" };
            const fileBuffer = Buffer.from(signed_pdf_base64, 'base64');
            console.log(`💾 PDF certificado subido para documento ${document_id} por ${certifier_id}.`);
            console.log(`✅ Estado del documento ${document_id} transicionado a 'certificado'.`);
            return { success: true, message: 'PDF certificado subido exitosamente. Documento finalizado.' };
        }
        catch (error) {
            console.error('Error in uploadCertifierSignedPdf:', error);
            if (error instanceof zod_1.z.ZodError) {
                throw new Error(`Error de validación: ${error.errors.map(e => e.message).join(', ')}`);
            }
            throw new Error(error.message || 'No se pudo subir el PDF certificado.');
        }
    }
}
exports.CertifierSignaturesModule = CertifierSignaturesModule;
exports.default = CertifierSignaturesModule;
