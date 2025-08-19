-- =============================================================================
-- NOTARYPRO CORE - MIGRACIÓN CORREGIDA
-- Archivo: migration_fixed.sql
-- =============================================================================

-- Habilitar extensión UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Función helper para triggers
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- =============================================================================
-- 1. ACTUALIZAR TABLA USERS
-- =============================================================================

-- Agregar campos faltantes a users
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS first_name VARCHAR(100),
ADD COLUMN IF NOT EXISTS last_name VARCHAR(100),
ADD COLUMN IF NOT EXISTS rut VARCHAR(20),
ADD COLUMN IF NOT EXISTS phone VARCHAR(20);

-- Índice para búsquedas por email
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- =============================================================================
-- 2. ACTUALIZAR TABLA DOCUMENTS
-- =============================================================================

-- Agregar campos faltantes a documents
ALTER TABLE documents 
ADD COLUMN IF NOT EXISTS signed_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS callback_url TEXT,
ADD COLUMN IF NOT EXISTS contract_name VARCHAR(255);

-- =============================================================================
-- 3. CREAR TABLA SIGNERS
-- =============================================================================

DROP TABLE IF EXISTS signers CASCADE;

CREATE TABLE signers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    rut_id VARCHAR(20) NOT NULL,
    phone VARCHAR(20),
    user_type VARCHAR(10) DEFAULT 'NATURAL' CHECK (user_type IN ('NATURAL', 'LEGAL')),
    rol INTEGER DEFAULT 0 CHECK (rol IN (0, 1)),
    order_number INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Agregar FK después de crear la tabla
ALTER TABLE signers 
ADD CONSTRAINT fk_signers_document 
FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE;

-- Índices para signers
CREATE INDEX idx_signers_document_id ON signers(document_id);
CREATE INDEX idx_signers_email ON signers(email);
CREATE INDEX idx_signers_rut_id ON signers(rut_id);
CREATE INDEX idx_signers_document_email ON signers(document_id, email);
CREATE INDEX idx_signers_document_rut ON signers(document_id, rut_id);

-- Constraint único por documento
CREATE UNIQUE INDEX idx_unique_email_per_document ON signers(document_id, email);

-- Trigger para updated_at
CREATE TRIGGER update_signers_updated_at 
    BEFORE UPDATE ON signers 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- 4. CREAR TABLA PASSWORD_RESET_TOKENS
-- =============================================================================

DROP TABLE IF EXISTS password_reset_tokens CASCADE;

CREATE TABLE password_reset_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    token VARCHAR(6) NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    used BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Agregar FK después de crear la tabla
ALTER TABLE password_reset_tokens 
ADD CONSTRAINT fk_password_reset_user 
FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- Índices para password_reset_tokens
CREATE INDEX idx_password_reset_user_id ON password_reset_tokens(user_id);
CREATE INDEX idx_password_reset_token ON password_reset_tokens(token);
CREATE INDEX idx_password_reset_expires ON password_reset_tokens(expires_at);
CREATE INDEX idx_password_reset_user_token ON password_reset_tokens(user_id, token);

-- =============================================================================
-- 5. CREAR TABLA DOCUMENT_FILES
-- =============================================================================

DROP TABLE IF EXISTS document_files CASCADE;

CREATE TABLE document_files (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_path TEXT NOT NULL,
    file_size BIGINT NOT NULL,
    file_type VARCHAR(10) DEFAULT 'PDF',
    file_version VARCHAR(20) DEFAULT 'original' CHECK (file_version IN ('original', 'signed', 'notary')),
    content_base64 TEXT,
    upload_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Agregar FK después de crear la tabla
ALTER TABLE document_files 
ADD CONSTRAINT fk_document_files_document 
FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE;

-- Índices para document_files
CREATE INDEX idx_document_files_document_id ON document_files(document_id);
CREATE INDEX idx_document_files_version ON document_files(file_version);
CREATE INDEX idx_document_files_document_version ON document_files(document_id, file_version);

-- =============================================================================
-- 6. CREAR TABLA NOTIFICATIONS
-- =============================================================================

DROP TABLE IF EXISTS notifications CASCADE;

CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID NOT NULL,
    recipient_email VARCHAR(255) NOT NULL,
    recipient_rut VARCHAR(20),
    notification_type VARCHAR(50) NOT NULL CHECK (
        notification_type IN ('DRAFT_PRIORITY', 'REMINDER', 'STATUS_CHANGE', 'SIGNATURE_REQUEST')
    ),
    status VARCHAR(20) DEFAULT 'PENDING' CHECK (
        status IN ('PENDING', 'SENT', 'FAILED', 'DELIVERED')
    ),
    sent_at TIMESTAMP,
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Agregar FK después de crear la tabla
ALTER TABLE notifications 
ADD CONSTRAINT fk_notifications_document 
FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE;

-- Índices para notifications
CREATE INDEX idx_notifications_document_id ON notifications(document_id);
CREATE INDEX idx_notifications_email ON notifications(recipient_email);
CREATE INDEX idx_notifications_rut ON notifications(recipient_rut);
CREATE INDEX idx_notifications_status ON notifications(status);
CREATE INDEX idx_notifications_type ON notifications(notification_type);

-- Trigger para updated_at
CREATE TRIGGER update_notifications_updated_at 
    BEFORE UPDATE ON notifications 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- 7. FUNCIONES DE LIMPIEZA
-- =============================================================================

CREATE OR REPLACE FUNCTION cleanup_orphaned_files()
RETURNS void AS $$
BEGIN
    DELETE FROM document_files 
    WHERE document_id NOT IN (SELECT id FROM documents);
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION cleanup_old_notifications()
RETURNS void AS $$
BEGIN
    DELETE FROM notifications 
    WHERE created_at < NOW() - INTERVAL '30 days' 
    AND status IN ('SENT', 'DELIVERED');
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION cleanup_expired_tokens()
RETURNS void AS $$
BEGIN
    DELETE FROM password_reset_tokens 
    WHERE expires_at < NOW() OR used = TRUE;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- 8. VERIFICACIÓN FINAL
-- =============================================================================

SELECT 
    'users' as tabla, count(*) as registros FROM users
UNION ALL
SELECT 
    'documents' as tabla, count(*) as registros FROM documents
UNION ALL
SELECT 
    'templates' as tabla, count(*) as registros FROM templates
UNION ALL
SELECT 
    'signers' as tabla, count(*) as registros FROM signers
UNION ALL
SELECT 
    'password_reset_tokens' as tabla, count(*) as registros FROM password_reset_tokens
UNION ALL
SELECT 
    'document_files' as tabla, count(*) as registros FROM document_files
UNION ALL
SELECT 
    'notifications' as tabla, count(*) as registros FROM notifications;

SELECT 'MIGRACIÓN COMPLETADA EXITOSAMENTE - NOTARYPRO CORE' as status;
