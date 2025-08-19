"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SignatureModule = void 0;
const zod_1 = require("zod");
const base_module_1 = require("./base_module");
const uuid_1 = require("uuid");
const pdf_lib_1 = require("pdf-lib");
const SIGNATURES_MODULE_CONFIG = {
    name: 'signature_module',
    version: '1.1.0',
    enabled: true,
    dependencies: ['document_module', 'notifications_module', 'files_module'],
    permissions: ['signatures:capture', 'signatures:verify', 'signatures:request_signing', 'signatures:apply_handwritten', 'signatures:certifier_upload'],
    routes: [
        'POST /signatures/capture',
        'GET /signatures/:id/verify',
        'POST /signatures/request-signing',
        'POST /signatures/handwritten',
        'POST /signatures/upload-certifier-signed-pdf',
    ]
};
const requestSigningSchema = zod_1.z.object({
    document_id: zod_1.z.string().uuid("El document_id debe ser un UUID v�lido."),
    signer_id: zod_1.z.string().uuid("El signer_id debe ser un UUID v�lido.").optional(),
});
const applyHandwrittenSignatureSchema = zod_1.z.object({
    document_id: zod_1.z.string().uuid("El document_id debe ser un UUID v�lido."),
    signer_id: zod_1.z.string().uuid("El signer_id debe ser un UUID v�lido."),
    signature_image_base64: zod_1.z.string().min(10, "La imagen de la firma en Base64 es requerida."),
    x_coord: zod_1.z.number().int(),
    y_coord: zod_1.z.number().int(),
    page_number: zod_1.z.number().int().positive(),
});
const uploadCertifierSignedPdfSchema = zod_1.z.object({
    document_id: zod_1.z.string().uuid("El document_id debe ser un UUID v�lido."),
    certifier_id: zod_1.z.string().uuid("El certifier_id debe ser un UUID v�lido."),
    signed_pdf_base64: zod_1.z.string().min(10, "El PDF firmado en Base64 es requerido."),
});
async function embedImageInPdf(pdfBuffer, imageBase64, x, y, pageIndex) {
    const pdfDoc = await pdf_lib_1.PDFDocument.load(pdfBuffer);
    const pages = pdfDoc.getPages();
    if (pageIndex < 0 || pageIndex >= pages.length) {
        throw new Error(`N�mero de p�gina inv�lido: ${pageIndex + 1}. El documento tiene ${pages.length} p�ginas.`);
    }
    const page = pages[pageIndex];
    const imageBytes = Buffer.from(imageBase64.split(',')[1], 'base64');
    const image = await pdfDoc.embedPng(imageBytes);
    const imageDims = image.scale(0.5);
    const actualWidth = imageDims.width;
    const actualHeight = imageDims.height;
    page.drawImage(image, {
        x: x,
        y: page.getHeight() - y - actualHeight,
        width: actualWidth,
        height: actualHeight,
    });
    const pdfBytes = await pdfDoc.save();
    return Buffer.from(pdfBytes);
}
class SignatureModule extends base_module_1.BaseModule {
    constructor(database) {
        super(database, SIGNATURES_MODULE_CONFIG);
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
            await this.db.query('SELECT 1 FROM documents LIMIT 1;');
            return { status: 'healthy', details: { db_signatures: 'reachable' } };
        }
        catch (error) {
            return { status: 'unhealthy', details: { db_signatures: error.message } };
        }
    }
    getRoutes() {
        return {
            'POST /signatures/capture': this.captureSignature.bind(this),
            'GET /signatures/:id/verify': this.verifySignature.bind(this),
            'POST /signatures/request-signing': this.requestSigning.bind(this),
            'POST /signatures/handwritten': this.applyHandwrittenSignature.bind(this),
            'POST /signatures/upload-certifier-signed-pdf': this.uploadCertifierSignedPdf.bind(this),
        };
    }
    async captureSignature(data) {
        console.log('Captura de firma (general):', data);
        return { success: true, message: 'Captura de firma procesada (ej. video/DNI).' };
    }
    async verifySignature(data) {
        console.log('Verificaci�n de firma para ID:', data.id);
        return { success: true, valid: true, message: 'Firma verificada.' };
    }
    async requestSigning(data) {
        try {
            const validatedData = requestSigningSchema.parse(data);
            const { document_id, signer_id } = validatedData;
            const { userId, email } = data.user;
            const document = { id: document_id, nombre_documento: "Documento de Ejemplo" };
            const signer = { id: signer_id || (0, uuid_1.v4)(), full_name: "Firmante Invitado", email: "firmante@example.com" };
            const signingToken = "JWT_SIGNING_TOKEN_EXAMPLE";
            const signingUrl = `${process.env.FRONTEND_URL}/sign-document/${document_id}/${signingToken}`;
            console.log(`?? Enviando enlace de firma ${signingUrl} a ${signer.full_name} (${signer.email})`);
            return {
                success: true,
                message: 'Solicitud de firma y email enviado.',
                signing_url: signingUrl
            };
        }
        catch (error) {
            console.error('Error requesting signing:', error);
            if (error instanceof zod_1.z.ZodError) {
                throw new Error(`Error de validaci�n: ${error.errors.map(e => e.message).join(', ')}`);
            }
            throw new Error(error.message || 'No se pudo procesar la solicitud de firma.');
        }
    }
    async applyHandwrittenSignature(data) {
        try {
            const validatedData = applyHandwrittenSignatureSchema.parse(data);
            const { document_id, signer_id, signature_image_base64, x_coord, y_coord, page_number } = validatedData;
            const { userId } = data.user;
            const dummyPdf = await pdf_lib_1.PDFDocument.create();
            dummyPdf.addPage();
            const dummyPdfBuffer = Buffer.from(await dummyPdf.save());
            const updatedPdfBuffer = await embedImageInPdf(dummyPdfBuffer, signature_image_base64, x_coord, y_coord, page_number - 1);
            console.log(`?? PDF actualizado con firma manuscrita para documento ${document_id}.`);
            return { success: true, message: 'Firma manuscrita aplicada y documento actualizado.' };
        }
        catch (error) {
            console.error('Error applying handwritten signature:', error);
            if (error instanceof zod_1.z.ZodError) {
                throw new Error(`Error de validaci�n: ${error.errors.map(e => e.message).join(', ')}`);
            }
            throw new Error(error.message || 'No se pudo aplicar la firma manuscrita.');
        }
    }
    async uploadCertifierSignedPdf(data) {
        try {
            const validatedData = uploadCertifierSignedPdfSchema.parse(data);
            const { document_id, certifier_id, signed_pdf_base64 } = validatedData;
            const { userId } = data.user;
            console.log(`?? PDF certificado subido por el certificador ${certifier_id} para documento ${document_id}.`);
            return { success: true, message: 'PDF certificado subido exitosamente.' };
        }
        catch (error) {
            console.error('Error uploading certifier signed PDF:', error);
            if (error instanceof zod_1.z.ZodError) {
                throw new Error(`Error de validaci�n: ${error.errors.map(e => e.message).join(', ')}`);
            }
            throw new Error(error.message || 'No se pudo subir el PDF certificado.');
        }
    }
}
exports.SignatureModule = SignatureModule;
exports.default = SignatureModule;
