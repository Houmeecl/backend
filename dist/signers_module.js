"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SignersModule = void 0;
const zod_1 = require("zod");
const base_module_1 = require("./base_module");
const SIGNERS_MODULE_CONFIG = {
    name: 'signers_module',
    version: '1.0.0',
    enabled: true,
    dependencies: ['document_module'],
    permissions: ['documents:read', 'documents:update'],
    routes: [
        'POST /signer/upd/:ContractID/EMAIL',
        'POST /signer/upd/:ContractID/RUT',
        'GET /signer/list'
    ]
};
const updateSignerEmailSchema = zod_1.z.object({
    ContractID: zod_1.z.string().uuid("El ContractID debe ser un UUID v�lido."),
    email: zod_1.z.string().email("Formato de email inv�lido."),
});
const updateSignerRutSchema = zod_1.z.object({
    ContractID: zod_1.z.string().uuid("El ContractID debe ser un UUID v�lido."),
    rut: zod_1.z.string().regex(/^[0-9]{7,8}-[0-9Kk]$/, "Formato de RUT inv�lido."),
});
class SignersModule extends base_module_1.BaseModule {
    constructor(database) {
        super(database, SIGNERS_MODULE_CONFIG);
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
            await this.db.query('SELECT 1 FROM signers LIMIT 1;');
            return { status: 'healthy', details: { db_signers: 'reachable' } };
        }
        catch (error) {
            return { status: 'unhealthy', details: { db_signers: error.message } };
        }
    }
    getRoutes() {
        return {
            'POST /signer/upd/:ContractID/EMAIL': this.updateSignerEmail.bind(this),
            'POST /signer/upd/:ContractID/RUT': this.updateSignerRut.bind(this),
            'GET /signer/list': this.listSigners.bind(this)
        };
    }
    async updateSignerEmail(data) {
        try {
            const validatedData = updateSignerEmailSchema.parse(data);
            const { ContractID, email } = validatedData;
            const result = await this.db.query('UPDATE signers SET email = $1, updated_at = CURRENT_TIMESTAMP WHERE document_id = $2 RETURNING *', [email, ContractID]);
            if (result.rows.length === 0) {
                throw new Error('Firmante no encontrado para este documento.');
            }
            return {
                success: true,
                message: 'Email del firmante actualizado exitosamente',
                signer: result.rows[0]
            };
        }
        catch (error) {
            console.error('Error updating signer email:', error);
            if (error instanceof zod_1.z.ZodError) {
                throw new Error(`Error de validaci�n: ${error.errors.map(e => e.message).join(', ')}`);
            }
            throw new Error(error.message || 'No se pudo actualizar el email del firmante.');
        }
    }
    async updateSignerRut(data) {
        try {
            const validatedData = updateSignerRutSchema.parse(data);
            const { ContractID, rut } = validatedData;
            const result = await this.db.query('UPDATE signers SET rut_id = $1, updated_at = CURRENT_TIMESTAMP WHERE document_id = $2 RETURNING *', [rut, ContractID]);
            if (result.rows.length === 0) {
                throw new Error('Firmante no encontrado para este documento.');
            }
            return {
                success: true,
                message: 'RUT del firmante actualizado exitosamente',
                signer: result.rows[0]
            };
        }
        catch (error) {
            console.error('Error updating signer RUT:', error);
            if (error instanceof zod_1.z.ZodError) {
                throw new Error(`Error de validaci�n: ${error.errors.map(e => e.message).join(', ')}`);
            }
            throw new Error(error.message || 'No se pudo actualizar el RUT del firmante.');
        }
    }
    async listSigners() {
        try {
            const result = await this.db.query('SELECT * FROM signers ORDER BY created_at DESC');
            return result.rows;
        }
        catch (error) {
            console.error('Error listing signers:', error);
            throw new Error(error.message || 'No se pudieron listar los firmantes.');
        }
    }
}
exports.SignersModule = SignersModule;
exports.default = SignersModule;
