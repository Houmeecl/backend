-- =============================================================================
-- NOTARYPRO DATABASE INITIALIZATION SCRIPT
-- =============================================================================

-- Crear extensión para UUIDs
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================================================
-- TABLA DE USUARIOS
-- =============================================================================
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
);

-- =============================================================================
-- TABLA DE PLANTILLAS
-- =============================================================================
CREATE TABLE IF NOT EXISTS templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL UNIQUE,
    description TEXT,
    content_html TEXT NOT NULL,
    fields_definition JSONB DEFAULT '[]',
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =============================================================================
-- TABLA DE DOCUMENTOS
-- =============================================================================
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
);

-- =============================================================================
-- TABLA DE FIRMANTES
-- =============================================================================
CREATE TABLE IF NOT EXISTS signers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
    full_name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    rut_id VARCHAR(12) NOT NULL,
    phone VARCHAR(20),
    user_type VARCHAR(10) DEFAULT 'NATURAL' CHECK (user_type IN ('NATURAL', 'LEGAL')),
    rol INTEGER DEFAULT 0 CHECK (rol IN (0, 1)), -- 0: Firmante, 1: Aprobador
    order_number INTEGER DEFAULT 1,
    status VARCHAR(20) DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'SIGNED', 'REJECTED')),
    signed_at TIMESTAMP,
    signature_hash VARCHAR(128),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =============================================================================
-- TABLA DE ARCHIVOS DE DOCUMENTOS
-- =============================================================================
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
);

-- =============================================================================
-- TABLA DE CUPONES
-- =============================================================================
CREATE TABLE IF NOT EXISTS coupons (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(50) UNIQUE NOT NULL,
    discount_value DECIMAL(10,2) NOT NULL,
    discount_type VARCHAR(20) NOT NULL CHECK (discount_type IN ('percentage', 'fixed')),
    description TEXT,
    expires_at TIMESTAMP,
    max_uses INTEGER,
    current_uses INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    document_types TEXT[] DEFAULT ARRAY['all'],
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =============================================================================
-- TABLA DE PAGOS
-- =============================================================================
CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id),
    document_id UUID REFERENCES documents(id),
    amount DECIMAL(12,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'CLP',
    status VARCHAR(20) DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'COMPLETED', 'FAILED', 'REFUNDED')),
    payment_method VARCHAR(50),
    transaction_id VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =============================================================================
-- TABLA DE TOKENS OTP
-- =============================================================================
CREATE TABLE IF NOT EXISTS otp_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id),
    phone_number VARCHAR(20) NOT NULL,
    code VARCHAR(6) NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    is_used BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =============================================================================
-- TABLA DE VERIFICACIONES
-- =============================================================================
CREATE TABLE IF NOT EXISTS verifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID REFERENCES documents(id),
    user_id UUID REFERENCES users(id),
    verification_type VARCHAR(20) NOT NULL CHECK (verification_type IN ('identity', 'document', 'biometric', 'full')),
    status VARCHAR(20) DEFAULT 'initiated' CHECK (status IN ('initiated', 'in_progress', 'completed', 'failed', 'expired')),
    result VARCHAR(20) CHECK (result IN ('passed', 'failed', 'pending')),
    verification_data JSONB,
    metadata JSONB,
    notes TEXT,
    initiated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,
    expires_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =============================================================================
-- TABLA DE NOTIFICACIONES
-- =============================================================================
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID REFERENCES documents(id),
    recipient_email VARCHAR(255) NOT NULL,
    recipient_rut VARCHAR(12),
    notification_type VARCHAR(30) NOT NULL CHECK (notification_type IN (
        'DRAFT_PRIORITY', 'REMINDER', 'STATUS_CHANGE', 'SIGNATURE_REQUEST',
        'SIGNATURE_COMPLETED', 'DOCUMENT_CERTIFIED', 'SIGNING_REQUEST'
    )),
    status VARCHAR(20) DEFAULT 'PENDING' CHECK (status IN (
        'PENDING', 'SENT', 'FAILED', 'DELIVERED', 'OPENED', 'CLICKED'
    )),
    subject VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    sent_at TIMESTAMP,
    delivered_at TIMESTAMP,
    opened_at TIMESTAMP,
    retry_count INTEGER DEFAULT 0,
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =============================================================================
-- TABLA DE AUDITORÍA
-- =============================================================================
CREATE TABLE IF NOT EXISTS audit_trail (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id),
    event_type VARCHAR(50) NOT NULL,
    entity_type VARCHAR(30) NOT NULL,
    entity_id UUID NOT NULL,
    details JSONB,
    ip_address INET,
    user_agent TEXT,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =============================================================================
-- TABLA DE TOKENS DE RECUPERACIÓN DE CONTRASEÑA
-- =============================================================================
CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id),
    email VARCHAR(255) NOT NULL,
    token VARCHAR(6) NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    used BOOLEAN DEFAULT false,
    used_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =============================================================================
-- ÍNDICES PARA MEJORAR RENDIMIENTO
-- =============================================================================

-- Índices en users
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_rut ON users(rut);

-- Índices en documents
CREATE INDEX IF NOT EXISTS idx_documents_template_id ON documents(template_id);
CREATE INDEX IF NOT EXISTS idx_documents_created_by ON documents(created_by);
CREATE INDEX IF NOT EXISTS idx_documents_estado ON documents(estado);

-- Índices en signers
CREATE INDEX IF NOT EXISTS idx_signers_document_id ON signers(document_id);
CREATE INDEX IF NOT EXISTS idx_signers_email ON signers(email);
CREATE INDEX IF NOT EXISTS idx_signers_rut_id ON signers(rut_id);

-- Índices en document_files
CREATE INDEX IF NOT EXISTS idx_document_files_document_id ON document_files(document_id);

-- Índices en payments
CREATE INDEX IF NOT EXISTS idx_payments_user_id ON payments(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_document_id ON payments(document_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);

-- Índices en notifications
CREATE INDEX IF NOT EXISTS idx_notifications_document_id ON notifications(document_id);
CREATE INDEX IF NOT EXISTS idx_notifications_recipient_email ON notifications(recipient_email);
CREATE INDEX IF NOT EXISTS idx_notifications_status ON notifications(status);

-- Índices en audit_trail
CREATE INDEX IF NOT EXISTS idx_audit_trail_user_id ON audit_trail(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_trail_entity_id ON audit_trail(entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_trail_timestamp ON audit_trail(timestamp);

-- =============================================================================
-- TRIGGERS PARA ACTUALIZAR updated_at
-- =============================================================================

-- Función para actualizar updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers para updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_templates_updated_at BEFORE UPDATE ON templates FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_documents_updated_at BEFORE UPDATE ON documents FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_signers_updated_at BEFORE UPDATE ON signers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_coupons_updated_at BEFORE UPDATE ON coupons FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_payments_updated_at BEFORE UPDATE ON payments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_otp_tokens_updated_at BEFORE UPDATE ON otp_tokens FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_verifications_updated_at BEFORE UPDATE ON verifications FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- DATOS DE EJEMPLO (OPCIONAL)
-- =============================================================================

-- Usuario administrador por defecto (contraseña: admin123)
INSERT INTO users (email, password, first_name, last_name, role) 
VALUES ('admin@notarypro.com', '$2a$10$rV7ZqJ3mXVQr2yJ6vP4KXOzgzGvzKJE4S8YnXwM5KqJYpW8X0K7Nm', 'Administrador', 'Sistema', 'admin')
ON CONFLICT (email) DO NOTHING;

-- Plantilla de ejemplo
INSERT INTO templates (name, description, content_html, fields_definition) 
VALUES (
    'Contrato Simple',
    'Plantilla básica para contratos',
    '<h1>Contrato de {{tipo_contrato}}</h1><p>Entre {{parte_1}} y {{parte_2}}, se acuerda...</p>',
    '[{"name": "tipo_contrato", "type": "text", "required": true}, {"name": "parte_1", "type": "text", "required": true}, {"name": "parte_2", "type": "text", "required": true}]'::jsonb
)
ON CONFLICT (name) DO NOTHING;

-- Cupón de ejemplo
INSERT INTO coupons (code, discount_value, discount_type, description, max_uses) 
VALUES ('BIENVENIDA20', 20, 'percentage', '20% de descuento para nuevos usuarios', 100)
ON CONFLICT (code) DO NOTHING;

COMMIT;