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

// Esquemas de validaci�n
const validateRutSchema = z.object({
  rut: z.string().regex(/^[0-9]{7,8}-[0-9Kk]$/, "Formato de RUT inv�lido (ej. 12345678-9)."),
});

const sendOtpSchema = z.object({
  phone: z.string().min(8, "El n�mero de tel�fono es requerido y debe ser v�lido."), // Ajusta la validaci�n del tel�fono
  user_id: z.string().uuid("El user_id debe ser un UUID v�lido.").optional(), // Asociar OTP a un usuario
});

const verifyOtpSchema = z.object({
  phone: z.string().min(8, "El n�mero de tel�fono es requerido y debe ser v�lido."),
  code: z.string().length(6, "El c�digo OTP debe tener 6 d�gitos."),
});

// Definir interfaz para los datos biom�tricos
interface BiometricData {
  faceMatchScore?: number;
  livenessDetected?: boolean;
}

const verifyBiometricSchema = z.object({
  biometricData: z.record(z.any()).refine(data => Object.keys(data).length > 0, {
    message: "Los datos biom�tricos no pueden estar vac�os."
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

      // L�gica de validaci�n de formato y d�gito verificador.
      // Puedes usar una librer�a o implementar la l�gica chilena aqu�.
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
        return { success: true, message: 'RUT v�lido' };
      } else {
        throw new Error('RUT inv�lido o formato incorrecto.');
      }
    } catch (error: any) {
      console.error('Error in validateRut:', error);
      if (error instanceof z.ZodError) {
        throw new Error(`Error de validaci�n: ${error.errors.map(e => e.message).join(', ')}`);
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

      // Simular env�o de SMS (en producci�n, usar�as un servicio como Twilio o una API de WhatsApp)
      console.log(`[SMS/WhatsApp Simulador] Enviando OTP ${otpCode} al tel�fono ${phone}`);
      // Ejemplo con Twilio:
      // await client.messages.create({ body: `Tu c�digo OTP es: ${otpCode}`, from: process.env.TWILIO_PHONE_NUMBER, to: phone });

      return { success: true, message: 'C�digo OTP enviado al tel�fono' };
    } catch (error: any) {
      console.error('Error in sendOtpCode:', error);
      if (error instanceof z.ZodError) {
        throw new Error(`Error de validaci�n: ${error.errors.map(e => e.message).join(', ')}`);
      }
      throw new Error(error.message || 'No se pudo enviar el c�digo OTP.');
    }
  }

  async verifyOtpCode(data: z.infer<typeof verifyOtpSchema>): Promise<any> {
    try {
      const validatedData = verifyOtpSchema.parse(data);
      const { phone, code } = validatedData;

      const token = await this.otpTokenModel.getValidOtpToken(phone, code);

      if (!token) {
        throw new Error('C�digo OTP inv�lido o expirado.');
      }

      await this.otpTokenModel.markOtpTokenAsUsed(token.id); // Marcar como usado
      return { success: true, message: 'C�digo OTP verificado exitosamente' };
    } catch (error: any) {
      console.error('Error in verifyOtpCode:', error);
      if (error instanceof z.ZodError) {
        throw new Error(`Error de validaci�n: ${error.errors.map(e => e.message).join(', ')}`);
      }
      throw new Error(error.message || 'No se pudo verificar el c�digo OTP.');
    }
  }

  async verifyBiometric(data: z.infer<typeof verifyBiometricSchema>): Promise<any> {
    try {
      const validatedData = verifyBiometricSchema.parse(data);
      const { biometricData } = validatedData;
      
      // Usar type assertion para tipar correctamente biometricData
      const typedBiometricData = biometricData as BiometricData;
      
      // Esta es una simulaci�n. En un caso real, integrar�as un SDK o API de un proveedor biom�trico externo.
      console.log('Datos biom�tricos recibidos (simulado):', typedBiometricData);

      // Simulaci�n de �xito/fallo basada en datos
      if (typedBiometricData.faceMatchScore !== undefined && 
          typedBiometricData.faceMatchScore > 0.8 && 
          typedBiometricData.livenessDetected !== undefined && 
          typedBiometricData.livenessDetected) {
        return { success: true, message: 'Verificaci�n biom�trica exitosa.' };
      } else {
        throw new Error('Fallo en la verificaci�n biom�trica.');
      }
    } catch (error: any) {
      console.error('Error in verifyBiometric:', error);
      if (error instanceof z.ZodError) {
        throw new Error(`Error de validaci�n: ${error.errors.map(e => e.message).join(', ')}`);
      }
      throw new Error(error.message || 'No se pudo realizar la verificaci�n biom�trica.');
    }
  }
}

export default IdentityModule;