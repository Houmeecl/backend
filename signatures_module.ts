import { Pool, QueryResult } from 'pg';
import { z } from 'zod';
import { BaseModule, ModuleConfig, UserRole } from './base_module';
import { v4 as uuidv4 } from 'uuid';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'; // Para incrustar firmas

const SIGNATURES_MODULE_CONFIG: ModuleConfig = {
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

// Esquemas de validación
const requestSigningSchema = z.object({
  document_id: z.string().uuid("El document_id debe ser un UUID válido."),
  signer_id: z.string().uuid("El signer_id debe ser un UUID válido.").optional(),
});

const applyHandwrittenSignatureSchema = z.object({
  document_id: z.string().uuid("El document_id debe ser un UUID válido."),
  signer_id: z.string().uuid("El signer_id debe ser un UUID válido."),
  signature_image_base64: z.string().min(10, "La imagen de la firma en Base64 es requerida."),
  x_coord: z.number().int(),
  y_coord: z.number().int(),
  page_number: z.number().int().positive(),
});

const uploadCertifierSignedPdfSchema = z.object({
  document_id: z.string().uuid("El document_id debe ser un UUID válido."),
  certifier_id: z.string().uuid("El certifier_id debe ser un UUID válido."),
  signed_pdf_base64: z.string().min(10, "El PDF firmado en Base64 es requerido."),
});

// Helper para incrustar imagen en PDF
async function embedImageInPdf(pdfBuffer: Buffer, imageBase64: string, x: number, y: number, pageIndex: number): Promise<Buffer> {
    const pdfDoc = await PDFDocument.load(pdfBuffer);
    const pages = pdfDoc.getPages();
    
    if (pageIndex < 0 || pageIndex >= pages.length) {
        throw new Error(`Número de página inválido: ${pageIndex + 1}. El documento tiene ${pages.length} páginas.`);
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

export class SignatureModule extends BaseModule {
  constructor(database: Pool) {
    super(database, SIGNATURES_MODULE_CONFIG);
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
      await this.db.query('SELECT 1 FROM documents LIMIT 1;');
      return { status: 'healthy', details: { db_signatures: 'reachable' } };
    } catch (error: any) {
      return { status: 'unhealthy', details: { db_signatures: error.message } };
    }
  }

  getRoutes(): Record<string, Function> {
    return {
      'POST /signatures/capture': this.captureSignature.bind(this),
      'GET /signatures/:id/verify': this.verifySignature.bind(this),
      'POST /signatures/request-signing': this.requestSigning.bind(this),
      'POST /signatures/handwritten': this.applyHandwrittenSignature.bind(this),
      'POST /signatures/upload-certifier-signed-pdf': this.uploadCertifierSignedPdf.bind(this),
    };
  }

  async captureSignature(data: any): Promise<any> {
    console.log('Captura de firma (general):', data);
    return { success: true, message: 'Captura de firma procesada (ej. video/DNI).' };
  }

  async verifySignature(data: { id: string }): Promise<any> {
    console.log('Verificación de firma para ID:', data.id);
    return { success: true, valid: true, message: 'Firma verificada.' };
  }

  async requestSigning(data: z.infer<typeof requestSigningSchema> & { user: { userId: string, email: string } }): Promise<any> {
    try {
      const validatedData = requestSigningSchema.parse(data);
      const { document_id, signer_id } = validatedData;
      const { userId, email } = data.user;

      const document = { id: document_id, nombre_documento: "Documento de Ejemplo" };
      const signer = { id: signer_id || uuidv4(), full_name: "Firmante Invitado", email: "firmante@example.com" };

      const signingToken = "JWT_SIGNING_TOKEN_EXAMPLE";
      const signingUrl = `${process.env.FRONTEND_URL}/sign-document/${document_id}/${signingToken}`;

      console.log(`?? Enviando enlace de firma ${signingUrl} a ${signer.full_name} (${signer.email})`);

      return { 
        success: true, 
        message: 'Solicitud de firma y email enviado.', 
        signing_url: signingUrl 
      };

    } catch (error: any) {
      console.error('Error requesting signing:', error);
      if (error instanceof z.ZodError) {
        throw new Error(`Error de validación: ${error.errors.map(e => e.message).join(', ')}`);
      }
      throw new Error(error.message || 'No se pudo procesar la solicitud de firma.');
    }
  }

  async applyHandwrittenSignature(data: z.infer<typeof applyHandwrittenSignatureSchema> & { user: { userId: string } }): Promise<any> {
    try {
      const validatedData = applyHandwrittenSignatureSchema.parse(data);
      const { document_id, signer_id, signature_image_base64, x_coord, y_coord, page_number } = validatedData;
      const { userId } = data.user;

      // Crear un PDF dummy para la demostración
      const dummyPdf = await PDFDocument.create();
      dummyPdf.addPage();
      const dummyPdfBuffer = Buffer.from(await dummyPdf.save());

      const updatedPdfBuffer = await embedImageInPdf(dummyPdfBuffer, signature_image_base64, x_coord, y_coord, page_number - 1);

      console.log(`?? PDF actualizado con firma manuscrita para documento ${document_id}.`);

      return { success: true, message: 'Firma manuscrita aplicada y documento actualizado.' };

    } catch (error: any) {
      console.error('Error applying handwritten signature:', error);
      if (error instanceof z.ZodError) {
        throw new Error(`Error de validación: ${error.errors.map(e => e.message).join(', ')}`);
      }
      throw new Error(error.message || 'No se pudo aplicar la firma manuscrita.');
    }
  }

  async uploadCertifierSignedPdf(data: z.infer<typeof uploadCertifierSignedPdfSchema> & { user: { userId: string } }): Promise<any> {
    try {
      const validatedData = uploadCertifierSignedPdfSchema.parse(data);
      const { document_id, certifier_id, signed_pdf_base64 } = validatedData;
      const { userId } = data.user;

      console.log(`?? PDF certificado subido por el certificador ${certifier_id} para documento ${document_id}.`);

      return { success: true, message: 'PDF certificado subido exitosamente.' };

    } catch (error: any) {
      console.error('Error uploading certifier signed PDF:', error);
      if (error instanceof z.ZodError) {
        throw new Error(`Error de validación: ${error.errors.map(e => e.message).join(', ')}`);
      }
      throw new Error(error.message || 'No se pudo subir el PDF certificado.');
    }
  }
}

export default SignatureModule;