// =============================================================================
// NOTARYPRO DATABASE CONFIGURATION
// =============================================================================

const { Pool } = require('pg');

// Configuración de la base de datos
const dbConfig = {
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'notarypro',
    password: process.env.DB_PASSWORD || 'your_secure_password_here',
    port: process.env.DB_PORT || 5432,
    
    // Configuración del pool de conexiones
    max: process.env.DB_POOL_MAX || 20,
    idleTimeoutMillis: process.env.DB_POOL_IDLE_TIMEOUT || 30000,
    connectionTimeoutMillis: process.env.DB_POOL_ACQUIRE_TIMEOUT || 2000,
    
    // Configuración SSL (para producción)
    ssl: process.env.NODE_ENV === 'production' ? {
        rejectUnauthorized: false
    } : false
};

// Crear pool de conexiones
const pool = new Pool(dbConfig);

// Eventos del pool
pool.on('connect', (client) => {
    console.log('🟢 Nueva conexión a la base de datos establecida');
});

pool.on('error', (err, client) => {
    console.error('🔴 Error inesperado en el cliente de la base de datos:', err);
});

pool.on('remove', (client) => {
    console.log('🟡 Cliente de la base de datos removido del pool');
});

// Función para probar la conexión
async function testConnection() {
    try {
        const client = await pool.connect();
        const result = await client.query('SELECT NOW() as current_time, version() as db_version');
        client.release();
        
        console.log('✅ Conexión a la base de datos exitosa');
        console.log('🕐 Hora del servidor:', result.rows[0].current_time);
        console.log('📊 Versión de PostgreSQL:', result.rows[0].db_version.split(' ')[0]);
        
        return true;
    } catch (error) {
        console.error('❌ Error al conectar con la base de datos:', error.message);
        return false;
    }
}

// Función para ejecutar consultas
async function executeQuery(query, params = []) {
    const client = await pool.connect();
    try {
        const result = await client.query(query, params);
        return result;
    } catch (error) {
        console.error('❌ Error en la consulta:', error.message);
        throw error;
    } finally {
        client.release();
    }
}

// Función para obtener estadísticas de la base de datos
async function getDatabaseStats() {
    try {
        const stats = {};
        
        // Contar usuarios
        const usersResult = await executeQuery('SELECT COUNT(*) as total FROM users');
        stats.totalUsers = parseInt(usersResult.rows[0].total);
        
        // Contar documentos
        const docsResult = await executeQuery('SELECT COUNT(*) as total FROM documents');
        stats.totalDocuments = parseInt(docsResult.rows[0].total);
        
        // Contar plantillas
        const templatesResult = await executeQuery('SELECT COUNT(*) as total FROM templates');
        stats.totalTemplates = parseInt(templatesResult.rows[0].total);
        
        // Contar firmantes
        const signersResult = await executeQuery('SELECT COUNT(*) as total FROM signers');
        stats.totalSigners = parseInt(signersResult.rows[0].total);
        
        // Documentos por estado
        const statusResult = await executeQuery(`
            SELECT estado, COUNT(*) as count 
            FROM documents 
            GROUP BY estado 
            ORDER BY count DESC
        `);
        stats.documentsByStatus = statusResult.rows;
        
        // Usuarios por rol
        const rolesResult = await executeQuery(`
            SELECT role, COUNT(*) as count 
            FROM users 
            GROUP BY role 
            ORDER BY count DESC
        `);
        stats.usersByRole = rolesResult.rows;
        
        return stats;
    } catch (error) {
        console.error('❌ Error al obtener estadísticas:', error.message);
        throw error;
    }
}

// Función para verificar la salud de la base de datos
async function checkDatabaseHealth() {
    try {
        const client = await pool.connect();
        await client.query('SELECT 1');
        client.release();
        
        return {
            status: 'healthy',
            timestamp: new Date().toISOString(),
            message: 'Base de datos funcionando correctamente'
        };
    } catch (error) {
        return {
            status: 'unhealthy',
            timestamp: new Date().toISOString(),
            message: `Error de conexión: ${error.message}`,
            error: error.message
        };
    }
}

// Función para cerrar el pool de conexiones
async function closePool() {
    try {
        await pool.end();
        console.log('🔴 Pool de conexiones cerrado correctamente');
    } catch (error) {
        console.error('❌ Error al cerrar el pool:', error.message);
    }
}

// Función para reinicializar el pool
async function reinitializePool() {
    try {
        await closePool();
        const newPool = new Pool(dbConfig);
        
        // Reemplazar el pool existente
        Object.assign(pool, newPool);
        
        console.log('🔄 Pool de conexiones reinicializado');
        return true;
    } catch (error) {
        console.error('❌ Error al reinicializar el pool:', error.message);
        return false;
    }
}

// Función para crear tablas si no existen
async function initializeTables() {
    try {
        console.log('🔧 Inicializando tablas de la base de datos...');
        
        // Crear extensión para UUIDs
        await executeQuery('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
        
        // Tabla de usuarios
        await executeQuery(`
            CREATE TABLE IF NOT EXISTS users (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                email VARCHAR(255) UNIQUE NOT NULL,
                password VARCHAR(255) NOT NULL,
                first_name VARCHAR(100) NOT NULL,
                last_name VARCHAR(100) NOT NULL,
                rut VARCHAR(12) UNIQUE,
                phone VARCHAR(20),
                role VARCHAR(20) NOT NULL DEFAULT 'cliente' CHECK (role IN ('admin', 'gestor', 'certificador', 'operador', 'cliente', 'validador')),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        
        // Tabla de plantillas
        await executeQuery(`
            CREATE TABLE IF NOT EXISTS templates (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                name VARCHAR(255) NOT NULL UNIQUE,
                description TEXT,
                content_html TEXT NOT NULL,
                fields_definition JSONB DEFAULT '[]',
                created_by UUID REFERENCES users(id),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        
        // Tabla de documentos
        await executeQuery(`
            CREATE TABLE IF NOT EXISTS documents (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                template_id UUID REFERENCES templates(id),
                nombre_documento VARCHAR(255) NOT NULL,
                estado VARCHAR(50) NOT NULL DEFAULT 'borrador' CHECK (estado IN (
                    'borrador', 'datos_completados', 'verificacion_pendiente', 'verificado',
                    'firma_pendiente', 'firmado_cliente', 'revision_certificador',
                    'aprobado_certificador', 'certificacion_pendiente', 'certificado',
                    'entregado', 'rechazado', 'cancelado'
                )),
                data_documento JSONB DEFAULT '{}',
                contenido_html TEXT,
                hash_contenido VARCHAR(64),
                created_by UUID REFERENCES users(id),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        
        // Tabla de firmantes
        await executeQuery(`
            CREATE TABLE IF NOT EXISTS signers (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
                full_name VARCHAR(255) NOT NULL,
                email VARCHAR(255) NOT NULL,
                rut_id VARCHAR(12) NOT NULL,
                phone VARCHAR(20),
                user_type VARCHAR(10) DEFAULT 'NATURAL' CHECK (user_type IN ('NATURAL', 'LEGAL')),
                rol INTEGER DEFAULT 0 CHECK (rol IN (0, 1)),
                order_number INTEGER DEFAULT 1,
                status VARCHAR(20) DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'SIGNED', 'REJECTED')),
                signed_at TIMESTAMP,
                signature_hash VARCHAR(128),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        
        // Tabla de archivos
        await executeQuery(`
            CREATE TABLE IF NOT EXISTS document_files (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
                file_name VARCHAR(255) NOT NULL,
                file_path VARCHAR(500) NOT NULL,
                file_size BIGINT NOT NULL,
                file_type VARCHAR(10) DEFAULT 'PDF',
                file_version VARCHAR(20) DEFAULT 'original' CHECK (file_version IN ('original', 'signed', 'notary', 'extra')),
                content_hash VARCHAR(64),
                upload_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        
        // Tabla de auditoría
        await executeQuery(`
            CREATE TABLE IF NOT EXISTS audit_logs (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                event_type VARCHAR(100) NOT NULL,
                entity_type VARCHAR(50),
                entity_id UUID,
                user_id UUID REFERENCES users(id),
                details JSONB DEFAULT '{}',
                ip_address INET,
                user_agent TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        
        console.log('✅ Tablas inicializadas correctamente');
        return true;
    } catch (error) {
        console.error('❌ Error al inicializar tablas:', error.message);
        throw error;
    }
}

// Función para crear usuario administrador por defecto
async function createDefaultAdmin() {
    try {
        const adminExists = await executeQuery(
            'SELECT id FROM users WHERE email = $1',
            ['admin@notarypro.cl']
        );
        
        if (adminExists.rows.length === 0) {
            const bcrypt = require('bcrypt');
            const hashedPassword = await bcrypt.hash('admin123', 10);
            
            await executeQuery(`
                INSERT INTO users (email, password, first_name, last_name, role, rut)
                VALUES ($1, $2, $3, $4, $5, $6)
            `, [
                'admin@notarypro.cl',
                hashedPassword,
                'Administrador',
                'Sistema',
                'admin',
                '11111111-1'
            ]);
            
            console.log('✅ Usuario administrador creado por defecto');
            console.log('📧 Email: admin@notarypro.cl');
            console.log('🔑 Contraseña: admin123');
        } else {
            console.log('ℹ️ Usuario administrador ya existe');
        }
    } catch (error) {
        console.error('❌ Error al crear usuario administrador:', error.message);
    }
}

// Exportar funciones y configuración
module.exports = {
    pool,
    dbConfig,
    testConnection,
    executeQuery,
    getDatabaseStats,
    checkDatabaseHealth,
    closePool,
    reinitializePool,
    initializeTables,
    createDefaultAdmin
};

// Ejecutar inicialización si se ejecuta directamente
if (require.main === module) {
    (async () => {
        try {
            console.log('🚀 Inicializando base de datos NotaryPro...');
            
            // Probar conexión
            const connected = await testConnection();
            if (!connected) {
                console.error('❌ No se pudo conectar a la base de datos');
                process.exit(1);
            }
            
            // Inicializar tablas
            await initializeTables();
            
            // Crear usuario admin
            await createDefaultAdmin();
            
            // Obtener estadísticas
            const stats = await getDatabaseStats();
            console.log('📊 Estadísticas de la base de datos:', stats);
            
            console.log('✅ Inicialización completada exitosamente');
            process.exit(0);
        } catch (error) {
            console.error('❌ Error durante la inicialización:', error.message);
            process.exit(1);
        }
    })();
}
