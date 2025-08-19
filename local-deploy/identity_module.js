"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IdentityModule = void 0;
const zod_1 = require("zod");
const base_module_1 = require("./base_module");
const uuid_1 = require("uuid");
const IDENTITY_MODULE_CONFIG = {
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
const validateRutSchema = zod_1.z.object({
    rut: zod_1.z.string().regex(/^[0-9]{7,8}-[0-9Kk]$/, "Formato de RUT inv�lido (ej. 12345678-9)."),
});
const sendOtpSchema = zod_1.z.object({
    phone: zod_1.z.string().min(8, "El n�mero de tel�fono es requerido y debe ser v�lido."),
    user_id: zod_1.z.string().uuid("El user_id debe ser un UUID v�lido.").optional(),
});
const verifyOtpSchema = zod_1.z.object({
    phone: zod_1.z.string().min(8, "El n�mero de tel�fono es requerido y debe ser v�lido."),
    code: zod_1.z.string().length(6, "El c�digo OTP debe tener 6 d�gitos."),
});
const verifyBiometricSchema = zod_1.z.object({
    biometricData: zod_1.z.record(zod_1.z.any()).refine(data => Object.keys(data).length > 0, {
        message: "Los datos biom�tricos no pueden estar vac�os."
    }),
});
class OtpTokenModel {
    constructor(db) {
        this.db = db;
    }
    async createOtpToken(userId, phoneNumber, code, expiresInMinutes = 15) {
        const id = (0, uuid_1.v4)();
        const expiresAt = new Date(Date.now() + expiresInMinutes * 60 * 1000);
        const result = await this.db.query('INSERT INTO otp_tokens (id, user_id, phone_number, code, expires_at) VALUES ($1, $2, $3, $4, $5) RETURNING *', [id, userId, phoneNumber, code, expiresAt]);
        return result.rows[0];
    }
    async getValidOtpToken(phoneNumber, code) {
        const result = await this.db.query('SELECT * FROM otp_tokens WHERE phone_number = $1 AND code = $2 AND expires_at > CURRENT_TIMESTAMP AND is_used = FALSE ORDER BY created_at DESC LIMIT 1', [phoneNumber, code]);
        return result.rows[0];
    }
    async markOtpTokenAsUsed(id) {
        const result = await this.db.query('UPDATE otp_tokens SET is_used = TRUE, updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *', [id]);
        return result.rows[0];
    }
}
class IdentityModule extends base_module_1.BaseModule {
    constructor(database) {
        super(database, IDENTITY_MODULE_CONFIG);
        this.otpTokenModel = new OtpTokenModel(database);
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
            await this.db.query('SELECT 1 FROM otp_tokens LIMIT 1;');
            return { status: 'healthy', details: { db_otp_tokens: 'reachable' } };
        }
        catch (error) {
            return { status: 'unhealthy', details: { db_otp_tokens: error.message } };
        }
    }
    getRoutes() {
        return {
            'POST /identity/validate-rut': this.validateRut.bind(this),
            'POST /identity/send-otp': this.sendOtpCode.bind(this),
            'POST /identity/verify-otp': this.verifyOtpCode.bind(this),
            'POST /identity/verify-biometric': this.verifyBiometric.bind(this)
        };
    }
    async validateRut(data) {
        try {
            const validatedData = validateRutSchema.parse(data);
            const { rut } = validatedData;
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
            }
            else {
                throw new Error('RUT inv�lido o formato incorrecto.');
            }
        }
        catch (error) {
            console.error('Error in validateRut:', error);
            if (error instanceof zod_1.z.ZodError) {
                throw new Error(`Error de validaci�n: ${error.errors.map(e => e.message).join(', ')}`);
            }
            throw new Error(error.message || 'No se pudo validar el RUT.');
        }
    }
    async sendOtpCode(data) {
        try {
            const validatedData = sendOtpSchema.parse(data);
            const { phone, user_id } = validatedData;
            const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
            await this.otpTokenModel.createOtpToken(user_id || data.user?.userId, phone, otpCode, 5);
            console.log(`[SMS/WhatsApp Simulador] Enviando OTP ${otpCode} al tel�fono ${phone}`);
            return { success: true, message: 'C�digo OTP enviado al tel�fono' };
        }
        catch (error) {
            console.error('Error in sendOtpCode:', error);
            if (error instanceof zod_1.z.ZodError) {
                throw new Error(`Error de validaci�n: ${error.errors.map(e => e.message).join(', ')}`);
            }
            throw new Error(error.message || 'No se pudo enviar el c�digo OTP.');
        }
    }
    async verifyOtpCode(data) {
        try {
            const validatedData = verifyOtpSchema.parse(data);
            const { phone, code } = validatedData;
            const token = await this.otpTokenModel.getValidOtpToken(phone, code);
            if (!token) {
                throw new Error('C�digo OTP inv�lido o expirado.');
            }
            await this.otpTokenModel.markOtpTokenAsUsed(token.id);
            return { success: true, message: 'C�digo OTP verificado exitosamente' };
        }
        catch (error) {
            console.error('Error in verifyOtpCode:', error);
            if (error instanceof zod_1.z.ZodError) {
                throw new Error(`Error de validaci�n: ${error.errors.map(e => e.message).join(', ')}`);
            }
            throw new Error(error.message || 'No se pudo verificar el c�digo OTP.');
        }
    }
    async verifyBiometric(data) {
        try {
            const validatedData = verifyBiometricSchema.parse(data);
            const { biometricData } = validatedData;
            const typedBiometricData = biometricData;
            console.log('Datos biom�tricos recibidos (simulado):', typedBiometricData);
            if (typedBiometricData.faceMatchScore !== undefined &&
                typedBiometricData.faceMatchScore > 0.8 &&
                typedBiometricData.livenessDetected !== undefined &&
                typedBiometricData.livenessDetected) {
                return { success: true, message: 'Verificaci�n biom�trica exitosa.' };
            }
            else {
                throw new Error('Fallo en la verificaci�n biom�trica.');
            }
        }
        catch (error) {
            console.error('Error in verifyBiometric:', error);
            if (error instanceof zod_1.z.ZodError) {
                throw new Error(`Error de validaci�n: ${error.errors.map(e => e.message).join(', ')}`);
            }
            throw new Error(error.message || 'No se pudo realizar la verificaci�n biom�trica.');
        }
    }
}
exports.IdentityModule = IdentityModule;
exports.default = IdentityModule;
