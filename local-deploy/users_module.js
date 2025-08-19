"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UsersModule = void 0;
const zod_1 = require("zod");
const base_module_1 = require("./base_module");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const uuid_1 = require("uuid");
const USERS_MODULE_CONFIG = {
    name: 'users_module',
    version: '1.0.0',
    enabled: true,
    dependencies: [],
    permissions: ['users:read', 'users:create', 'users:update', 'users:delete', 'users:activity_read'],
    routes: [
        'GET /users',
        'POST /users',
        'GET /users/:id',
        'PUT /users/:id',
        'DELETE /users/:id',
        'GET /users/:id/activity'
    ]
};
const createUserSchema = zod_1.z.object({
    email: zod_1.z.string().email("Formato de email inválido."),
    password: zod_1.z.string().min(6, "La contraseña debe tener al menos 6 caracteres."),
    first_name: zod_1.z.string().min(1, "El nombre es requerido."),
    last_name: zod_1.z.string().min(1, "El apellido es requerido."),
    role: zod_1.z.enum(['admin', 'gestor', 'certificador', 'operador', 'cliente', 'validador']).default('cliente'),
});
const updateUserSchema = zod_1.z.object({
    email: zod_1.z.string().email("Formato de email inválido.").optional(),
    password: zod_1.z.string().min(6, "La contraseña debe tener al menos 6 caracteres.").optional(),
    first_name: zod_1.z.string().min(1, "El nombre es requerido.").optional(),
    last_name: zod_1.z.string().min(1, "El apellido es requerido.").optional(),
    role: zod_1.z.enum(['admin', 'gestor', 'certificador', 'operador', 'cliente', 'validador']).optional(),
}).refine(data => Object.keys(data).length > 0, "Al menos un campo debe ser proporcionado para la actualización.");
class UserModel {
    constructor(db) {
        this.db = db;
    }
    async create(email, password, firstName, lastName, role) {
        const hashedPassword = await bcryptjs_1.default.hash(password, 10);
        const id = (0, uuid_1.v4)();
        const result = await this.db.query('INSERT INTO users (id, email, password, first_name, last_name, role) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, email, first_name, last_name, role, created_at', [id, email, hashedPassword, firstName, lastName, role]);
        return result.rows[0];
    }
    async findByEmail(email) {
        const result = await this.db.query('SELECT * FROM users WHERE email = $1', [email]);
        return result.rows[0];
    }
    async findById(id) {
        const result = await this.db.query('SELECT id, email, first_name, last_name, role, created_at FROM users WHERE id = $1', [id]);
        return result.rows[0];
    }
    async getAll() {
        const result = await this.db.query('SELECT id, email, first_name, last_name, role, created_at FROM users ORDER BY created_at DESC');
        return result.rows;
    }
    async update(id, data) {
        const fields = [];
        const values = [];
        let queryIndex = 1;
        if (data.password) {
            data.password = await bcryptjs_1.default.hash(data.password, 10);
        }
        for (const key in data) {
            if (data[key] !== undefined) {
                fields.push(`${key} = $${queryIndex++}`);
                values.push(data[key]);
            }
        }
        if (fields.length === 0)
            return undefined;
        values.push(id);
        const result = await this.db.query(`UPDATE users SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = $${queryIndex} RETURNING id, email, first_name, last_name, role, updated_at`, values);
        return result.rows[0];
    }
    async delete(id) {
        const result = await this.db.query('DELETE FROM users WHERE id = $1', [id]);
        return result.rowCount !== null && result.rowCount > 0;
    }
    async getUserActivity(userId) {
        const result = await this.db.query('SELECT * FROM audit_trail WHERE user_id = $1 ORDER BY timestamp DESC', [userId]);
        return result.rows;
    }
}
class UsersModule extends base_module_1.BaseModule {
    constructor(database) {
        super(database, USERS_MODULE_CONFIG);
        this.userModel = new UserModel(database);
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
            await this.db.query('SELECT 1 FROM users LIMIT 1;');
            return { status: 'healthy', details: { db_users: 'reachable' } };
        }
        catch (error) {
            return { status: 'unhealthy', details: { db_users: error.message } };
        }
    }
    getRoutes() {
        return {
            'GET /users': this.getAllUsers.bind(this),
            'POST /users': this.createUser.bind(this),
            'GET /users/:id': this.getUserById.bind(this),
            'PUT /users/:id': this.updateUser.bind(this),
            'DELETE /users/:id': this.deleteUser.bind(this),
            'GET /users/:id/activity': this.getUserActivity.bind(this)
        };
    }
    async getAllUsers(data) {
        try {
            const users = await this.userModel.getAll();
            return users;
        }
        catch (error) {
            console.error('Error in getAllUsers:', error);
            throw new Error(error.message || 'No se pudieron obtener los usuarios.');
        }
    }
    async createUser(data) {
        try {
            const validatedData = createUserSchema.parse(data);
            const existingUser = await this.userModel.findByEmail(validatedData.email);
            if (existingUser) {
                throw new Error('El email ya está registrado.');
            }
            const newUser = await this.userModel.create(validatedData.email, validatedData.password, validatedData.first_name, validatedData.last_name, validatedData.role);
            return newUser;
        }
        catch (error) {
            console.error('Error in createUser:', error);
            if (error instanceof zod_1.z.ZodError) {
                throw new Error(`Error de validación: ${error.errors.map(e => e.message).join(', ')}`);
            }
            throw new Error(error.message || 'No se pudo crear el usuario.');
        }
    }
    async getUserById(data) {
        try {
            if (!data.id)
                throw new Error("ID de usuario requerido.");
            const user = await this.userModel.findById(data.id);
            if (!user) {
                throw new Error('Usuario no encontrado.');
            }
            return user;
        }
        catch (error) {
            console.error('Error in getUserById:', error);
            throw new Error(error.message || 'No se pudo obtener el usuario.');
        }
    }
    async updateUser(data) {
        try {
            if (!data.id)
                throw new Error("ID de usuario requerido para la actualización.");
            const { id, ...updateData } = data;
            const validatedData = updateUserSchema.parse(updateData);
            const updatedUser = await this.userModel.update(id, validatedData);
            if (!updatedUser) {
                throw new Error('Usuario no encontrado o no se pudo actualizar.');
            }
            return updatedUser;
        }
        catch (error) {
            console.error('Error in updateUser:', error);
            if (error instanceof zod_1.z.ZodError) {
                throw new Error(`Error de validación: ${error.errors.map(e => e.message).join(', ')}`);
            }
            throw new Error(error.message || 'No se pudo actualizar el usuario.');
        }
    }
    async deleteUser(data) {
        try {
            if (!data.id)
                throw new Error("ID de usuario requerido para la eliminación.");
            const deleted = await this.userModel.delete(data.id);
            if (!deleted) {
                throw new Error('Usuario no encontrado o no se pudo eliminar.');
            }
            return { success: true, message: 'Usuario eliminado exitosamente.' };
        }
        catch (error) {
            console.error('Error in deleteUser:', error);
            throw new Error(error.message || 'No se pudo eliminar el usuario.');
        }
    }
    async getUserActivity(data) {
        try {
            if (!data.id)
                throw new Error("ID de usuario requerido.");
            const activity = await this.userModel.getUserActivity(data.id);
            return activity;
        }
        catch (error) {
            console.error('Error in getUserActivity:', error);
            throw new Error(error.message || 'No se pudo obtener la actividad del usuario.');
        }
    }
}
exports.UsersModule = UsersModule;
exports.default = UsersModule;
