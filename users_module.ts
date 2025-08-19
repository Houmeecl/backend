import { Pool, QueryResult } from 'pg';
import { z } from 'zod';
import { BaseModule, ModuleConfig, UserRole } from './base_module';
import bcrypt from 'bcryptjs'; // CORREGIDO: Importación de bcryptjs
import { v4 as uuidv4 } from 'uuid'; // CORREGIDO: Importación de uuid

const USERS_MODULE_CONFIG: ModuleConfig = {
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

// Esquemas de validación
const createUserSchema = z.object({
  email: z.string().email("Formato de email inválido."),
  password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres."),
  first_name: z.string().min(1, "El nombre es requerido."),
  last_name: z.string().min(1, "El apellido es requerido."),
  role: z.enum(['admin', 'gestor', 'certificador', 'operador', 'cliente', 'validador']).default('cliente'),
});

const updateUserSchema = z.object({
  email: z.string().email("Formato de email inválido.").optional(),
  password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres.").optional(),
  first_name: z.string().min(1, "El nombre es requerido.").optional(),
  last_name: z.string().min(1, "El apellido es requerido.").optional(),
  role: z.enum(['admin', 'gestor', 'certificador', 'operador', 'cliente', 'validador']).optional(),
}).refine(data => Object.keys(data).length > 0, "Al menos un campo debe ser proporcionado para la actualización.");

// Interfaz para el modelo de Usuario
interface User {
  id: string;
  email: string;
  password?: string; // Solo para el hash, no se expone
  first_name: string;
  last_name: string;
  role: UserRole;
  created_at: Date;
  updated_at: Date;
}

// Modelo (operaciones de base de datos) para Usuarios
class UserModel {
  private db: Pool;

  constructor(db: Pool) {
    this.db = db;
  }

  async create(email: string, password: string, firstName: string, lastName: string, role: UserRole): Promise<User> {
    const hashedPassword = await bcrypt.hash(password, 10);
    const id = uuidv4();
    const result: QueryResult<User> = await this.db.query(
      'INSERT INTO users (id, email, password, first_name, last_name, role) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, email, first_name, last_name, role, created_at',
      [id, email, hashedPassword, firstName, lastName, role]
    );
    return result.rows[0];
  }

  async findByEmail(email: string): Promise<User | undefined> {
    const result: QueryResult<User> = await this.db.query('SELECT * FROM users WHERE email = $1', [email]);
    return result.rows[0];
  }

  async findById(id: string): Promise<User | undefined> {
    const result: QueryResult<User> = await this.db.query('SELECT id, email, first_name, last_name, role, created_at FROM users WHERE id = $1', [id]);
    return result.rows[0];
  }

  async getAll(): Promise<User[]> {
    const result: QueryResult<User> = await this.db.query('SELECT id, email, first_name, last_name, role, created_at FROM users ORDER BY created_at DESC');
    return result.rows;
  }

  async update(id: string, data: Partial<User>): Promise<User | undefined> {
    const fields: string[] = [];
    const values: any[] = [];
    let queryIndex = 1;

    if (data.password) { // Encriptar nueva contraseña si se proporciona
        data.password = await bcrypt.hash(data.password, 10);
    }

    for (const key in data) {
      if ((data as any)[key] !== undefined) {
        fields.push(`${key} = $${queryIndex++}`);
        values.push((data as any)[key]);
      }
    }
    if (fields.length === 0) return undefined; // No hay nada que actualizar

    values.push(id); // Último valor para la cláusula WHERE
    const result: QueryResult<User> = await this.db.query(
      `UPDATE users SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = $${queryIndex} RETURNING id, email, first_name, last_name, role, updated_at`,
      values
    );
    return result.rows[0];
  }

  async delete(id: string): Promise<boolean> {
    const result: QueryResult = await this.db.query('DELETE FROM users WHERE id = $1', [id]);
    return result.rowCount !== null && result.rowCount > 0;
  }
  
  // Asumo que tienes una tabla de audit_trail para registrar la actividad del usuario
  async getUserActivity(userId: string): Promise<any[]> {
    // Aquí podrías filtrar por el user_id en tu tabla de auditoría
    const result = await this.db.query('SELECT * FROM audit_trail WHERE user_id = $1 ORDER BY timestamp DESC', [userId]);
    return result.rows;
  }
}


export class UsersModule extends BaseModule {
  private userModel: UserModel;

  constructor(database: Pool) {
    super(database, USERS_MODULE_CONFIG);
    this.userModel = new UserModel(database);
  }

  async initialize(): Promise<void> {
    this.initialized = true;
    console.log(`✅ ${this.getName()} v${this.getVersion()} initialized`);
  }

  async cleanup(): Promise<void> {
    this.initialized = false;
  }

  async getHealth(): Promise<{ status: string; details?: any; }> {
    try {
      await this.db.query('SELECT 1 FROM users LIMIT 1;');
      return { status: 'healthy', details: { db_users: 'reachable' } };
    } catch (error: any) {
      return { status: 'unhealthy', details: { db_users: error.message } };
    }
  }

  getRoutes(): Record<string, Function> {
    return {
      'GET /users': this.getAllUsers.bind(this),
      'POST /users': this.createUser.bind(this),
      'GET /users/:id': this.getUserById.bind(this),
      'PUT /users/:id': this.updateUser.bind(this),
      'DELETE /users/:id': this.deleteUser.bind(this),
      'GET /users/:id/activity': this.getUserActivity.bind(this)
    };
  }

  async getAllUsers(data: { user: { role: UserRole } }): Promise<any[]> {
    try {
      const users = await this.userModel.getAll();
      return users;
    } catch (error: any) {
      console.error('Error in getAllUsers:', error);
      throw new Error(error.message || 'No se pudieron obtener los usuarios.');
    }
  }

  async createUser(data: z.infer<typeof createUserSchema>): Promise<any> {
    try {
      const validatedData = createUserSchema.parse(data);
      const existingUser = await this.userModel.findByEmail(validatedData.email);
      if (existingUser) {
        throw new Error('El email ya está registrado.');
      }
      const newUser = await this.userModel.create(validatedData.email, validatedData.password, validatedData.first_name, validatedData.last_name, validatedData.role);
      return newUser;
    } catch (error: any) {
      console.error('Error in createUser:', error);
      if (error instanceof z.ZodError) {
        throw new Error(`Error de validación: ${error.errors.map(e => e.message).join(', ')}`);
      }
      throw new Error(error.message || 'No se pudo crear el usuario.');
    }
  }

  async getUserById(data: { id: string }): Promise<any> {
    try {
      if (!data.id) throw new Error("ID de usuario requerido.");
      const user = await this.userModel.findById(data.id);
      if (!user) {
        throw new Error('Usuario no encontrado.');
      }
      return user;
    } catch (error: any) {
      console.error('Error in getUserById:', error);
      throw new Error(error.message || 'No se pudo obtener el usuario.');
    }
  }

  async updateUser(data: { id: string } & z.infer<typeof updateUserSchema>): Promise<any> {
    try {
      if (!data.id) throw new Error("ID de usuario requerido para la actualización.");
      const { id, ...updateData } = data;
      const validatedData = updateUserSchema.parse(updateData);
      const updatedUser = await this.userModel.update(id, validatedData);
      if (!updatedUser) {
        throw new Error('Usuario no encontrado o no se pudo actualizar.');
      }
      return updatedUser;
    } catch (error: any) {
      console.error('Error in updateUser:', error);
      if (error instanceof z.ZodError) {
        throw new Error(`Error de validación: ${error.errors.map(e => e.message).join(', ')}`);
      }
      throw new Error(error.message || 'No se pudo actualizar el usuario.');
    }
  }

  async deleteUser(data: { id: string }): Promise<{ success: boolean; message: string }> {
    try {
      if (!data.id) throw new Error("ID de usuario requerido para la eliminación.");
      const deleted = await this.userModel.delete(data.id);
      if (!deleted) {
        throw new Error('Usuario no encontrado o no se pudo eliminar.');
      }
      return { success: true, message: 'Usuario eliminado exitosamente.' };
    } catch (error: any) {
      console.error('Error in deleteUser:', error);
      throw new Error(error.message || 'No se pudo eliminar el usuario.');
    }
  }

  async getUserActivity(data: { id: string }): Promise<any[]> {
    try {
      if (!data.id) throw new Error("ID de usuario requerido.");
      const activity = await this.userModel.getUserActivity(data.id);
      return activity;
    } catch (error: any) {
      console.error('Error in getUserActivity:', error);
      throw new Error(error.message || 'No se pudo obtener la actividad del usuario.');
    }
  }
}

export default UsersModule;
