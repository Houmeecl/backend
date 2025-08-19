import { Pool, QueryResult } from 'pg';
import { z } from 'zod';
import { BaseModule, ModuleConfig, UserRole } from './base_module';
import { v4 as uuidv4 } from 'uuid';
// import twilio from 'twilio'; // Si usas Twilio para SMS
// const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

const IDENTITY_MODULE_CONFIG: ModuleConfig = {
  name: 'identity_module',
  version: '1.0.0',
  enabled: true,
  dependencies: [],
  permissions: ['identity:validate_rut', 'identity:send_otp', 'identity:verify_otp', 'identity:verify_biometric'],
  routes: [
    'POST /identity/validate-rut',
    'POST /identity/send-otp',
    'POST /identity/verify-otp',
    'POST /identity/verify-biometric'
  ]
};

// Esquemas de validación
const validateRutSchema = z.object({
  rut: z.string().regex(/^[0-9]{7,8}-[0-9Kk]$/, "Formato de RUT inválido (ej. 12345678-9)."),
});

const sendOtpSchema = z.object({
  phone: z.string().min(8, "El número de teléfono es requerido y debe ser válido."), // Ajusta la validación del teléfono
  user_id: z.string().uuid("El user_id debe ser un UUID válido.").optional(), // Asociar OTP a un usuario
});

const verifyOtpSchema = z.object({
  phone: z.string().min(8, "El número de teléfono es requerido y debe ser válido."),
  code: z.string().length(6, "El código OTP debe tener 6 dígitos."),
});

// Definir interfaz para los datos biométricos
interface BiometricData {
  faceMatchScore?: number;
  livenessDetected?: boolean;
}

const verifyBiometricSchema = z.object({
  biometricData: z.record(z.any()).refine(data => Object.keys(data).length > 0, {
    message: "Los datos biométricos no pueden estar vacíos."
  }),
});

// Interfaz para el modelo de OTP Token
interface OtpToken {
  id: string;
  user_id?: string;
  phone_number: string;
  code: string;
  expires_at: Date;
  is_used: boolean;
  created_at: Date;
}

// Modelo (operaciones de base de datos) para OTP Tokens
class OtpTokenModel {
  private db: Pool;

  constructor(db: Pool) {
    this.db = db;
  }

  async createOtpToken(userId: string | undefined, phoneNumber: string, code: string, expiresInMinutes: number = 15): Promise<OtpToken> {
    const id = uuidv4();
    const expiresAt = new Date(Date.now() + expiresInMinutes * 60 * 1000);
    const result: QueryResult<OtpToken> = await this.db.query(
      'INSERT INTO otp_tokens (id, user_id, phone_number, code, expires_at) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [id, userId, phoneNumber, code, expiresAt]
    );
    return result.rows[0];
  }

  async getValidOtpToken(phoneNumber: string, code: string): Promise<OtpToken | undefined> {
    const result: QueryResult<OtpToken> = await this.db.query(
      'SELECT * FROM otp_tokens WHERE phone_number = $1 AND code = $2 AND expires_at > CURRENT_TIMESTAMP AND is_used = FALSE ORDER BY created_at DESC LIMIT 1',
      [phoneNumber, code]
    );
    return result.rows[0];
  }

  async markOtpTokenAsUsed(id: string): Promise<OtpToken | undefined> {
    const result: QueryResult<OtpToken> = await this.db.query(
      'UPDATE otp_tokens SET is_used = TRUE, updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *',
      [id]
    );
    return result.rows[0];
  }
}

export class IdentityModule extends BaseModule {
  private otpTokenModel: OtpTokenModel;

  constructor(database: Pool) {
    super(database, IDENTITY_MODULE_CONFIG);
    this.otpTokenModel = new OtpTokenModel(database);
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
      await this.db.query('SELECT 1 FROM otp_tokens LIMIT 1;');
      return { status: 'healthy', details: { db_otp_tokens: 'reachable' } };
    } catch (error: any) {
      return { status: 'unhealthy', details: { db_otp_tokens: error.message } };
    }
  }

  getRoutes(): Record<string, Function> {
    return {
      'POST /identity/validate-rut': this.validateRut.bind(this),
      'POST /identity/send-otp': this.sendOtpCode.bind(this),
      'POST /identity/verify-otp': this.verifyOtpCode.bind(this),
      'POST /identity/verify-biometric': this.verifyBiometric.bind(this)
    };
  }

  async validateRut(data: z.infer<typeof validateRutSchema>): Promise<any> {
    try {
      const validatedData = validateRutSchema.parse(data);
      const { rut } = validatedData;

      // Lógica de validación de formato y dígito verificador.
      // Puedes usar una librería o implementar la lógica chilena aquí.
      // Ejemplo simplificado:
      const isValidFormat = /^[0-9]{7,8}-[0-9Kk]$/.test(rut);
      const rutBody = rut.slice(0, -1);
      const dv = rut.slice(-1).toUpperCase();
      let sum = 0;
      let multiplier = 2;
      for (let i = rutBody.length - 1; i >= 0; i--) {
          sum += parseInt(rutBody[i], 10) * multiplier;
          multiplier = multiplier === 7 ? 2 : multiplier + 1;
      }
      const calculatedDv = 11 - (sum % 11);
      const finalDv = (calculatedDv === 11) ? '0' : (calculatedDv === 10) ? 'K' : String(calculatedDv);
      
      const isValidDigit = finalDv === dv;

      if (isValidFormat && isValidDigit) {
        return { success: true, message: 'RUT válido' };
      } else {
        throw new Error('RUT inválido o formato incorrecto.');
      }
    } catch (error: any) {
      console.error('Error in validateRut:', error);
      if (error instanceof z.ZodError) {
        throw new Error(`Error de validación: ${error.errors.map(e => e.message).join(', ')}`);
      }
      throw new Error(error.message || 'No se pudo validar el RUT.');
    }
  }

  async sendOtpCode(data: z.infer<typeof sendOtpSchema> & { user?: { userId: string } }): Promise<any> {
    try {
      const validatedData = sendOtpSchema.parse(data);
      const { phone, user_id } = validatedData;
      const otpCode = Math.floor(100000 + Math.random() * 900000).toString();

      // Almacenar el OTP en la base de datos
      await this.otpTokenModel.createOtpToken(user_id || data.user?.userId, phone, otpCode, 5); // Expira en 5 minutos

      // Simular envío de SMS (en producción, usarías un servicio como Twilio o una API de WhatsApp)
      console.log(`[SMS/WhatsApp Simulador] Enviando OTP ${otpCode} al teléfono ${phone}`);
      // Ejemplo con Twilio:
      // await client.messages.create({ body: `Tu código OTP es: ${otpCode}`, from: process.env.TWILIO_PHONE_NUMBER, to: phone });

      return { success: true, message: 'Código OTP enviado al teléfono' };
    } catch (error: any) {
      console.error('Error in sendOtpCode:', error);
      if (error instanceof z.ZodError) {
        throw new Error(`Error de validación: ${error.errors.map(e => e.message).join(', ')}`);
      }
      throw new Error(error.message || 'No se pudo enviar el código OTP.');
    }
  }

  async verifyOtpCode(data: z.infer<typeof verifyOtpSchema>): Promise<any> {
    try {
      const validatedData = verifyOtpSchema.parse(data);
      const { phone, code } = validatedData;

      const token = await this.otpTokenModel.getValidOtpToken(phone, code);

      if (!token) {
        throw new Error('Código OTP inválido o expirado.');
      }

      await this.otpTokenModel.markOtpTokenAsUsed(token.id); // Marcar como usado
      return { success: true, message: 'Código OTP verificado exitosamente' };
    } catch (error: any) {
      console.error('Error in verifyOtpCode:', error);
      if (error instanceof z.ZodError) {
        throw new Error(`Error de validación: ${error.errors.map(e => e.message).join(', ')}`);
      }
      throw new Error(error.message || 'No se pudo verificar el código OTP.');
    }
  }

  async verifyBiometric(data: z.infer<typeof verifyBiometricSchema>): Promise<any> {
    try {
      const validatedData = verifyBiometricSchema.parse(data);
      const { biometricData } = validatedData;
      
      // Usar type assertion para tipar correctamente biometricData
      const typedBiometricData = biometricData as BiometricData;
      
      // Esta es una simulación. En un caso real, integrarías un SDK o API de un proveedor biométrico externo.
      console.log('Datos biométricos recibidos (simulado):', typedBiometricData);

      // Simulación de éxito/fallo basada en datos
      if (typedBiometricData.faceMatchScore !== undefined && 
          typedBiometricData.faceMatchScore > 0.8 && 
          typedBiometricData.livenessDetected !== undefined && 
          typedBiometricData.livenessDetected) {
        return { success: true, message: 'Verificación biométrica exitosa.' };
      } else {
        throw new Error('Fallo en la verificación biométrica.');
      }
    } catch (error: any) {
      console.error('Error in verifyBiometric:', error);
      if (error instanceof z.ZodError) {
        throw new Error(`Error de validación: ${error.errors.map(e => e.message).join(', ')}`);
      }
      throw new Error(error.message || 'No se pudo realizar la verificación biométrica.');
    }
  }
}

export default IdentityModule;