-- =============================================================================
-- NOTARYPRO SAAS DATABASE SCHEMA
-- =============================================================================

-- Crear extensión para UUIDs si no existe
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================================================
-- TABLA DE USUARIOS SAAS
-- =============================================================================
CREATE TABLE IF NOT EXISTS saas_users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    company VARCHAR(255),
    subscription_plan VARCHAR(20) NOT NULL DEFAULT 'free' CHECK (subscription_plan IN ('free', 'basic', 'premium', 'enterprise')),
    role VARCHAR(20) NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'manager', 'user')),
    api_quota INTEGER NOT NULL DEFAULT 1000,
    api_usage INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true,
    last_login TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =============================================================================
-- TABLA DE ROLES SAAS
-- =============================================================================
CREATE TABLE IF NOT EXISTS saas_roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    permissions TEXT[] DEFAULT '{}',
    is_system BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =============================================================================
-- TABLA DE SUSCRIPCIONES SAAS
-- =============================================================================
CREATE TABLE IF NOT EXISTS saas_subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES saas_users(id) ON DELETE CASCADE,
    plan_name VARCHAR(20) NOT NULL CHECK (plan_name IN ('free', 'basic', 'premium', 'enterprise')),
    start_date TIMESTAMP NOT NULL,
    end_date TIMESTAMP NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'CLP' CHECK (currency IN ('CLP', 'USD')),
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('active', 'expired', 'cancelled', 'pending')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =============================================================================
-- TABLA DE USO DE API
-- =============================================================================
CREATE TABLE IF NOT EXISTS api_usage (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES saas_users(id) ON DELETE CASCADE,
    endpoint VARCHAR(255) NOT NULL,
    method VARCHAR(10) NOT NULL CHECK (method IN ('GET', 'POST', 'PUT', 'DELETE', 'PATCH')),
    response_time INTEGER NOT NULL, -- en milisegundos
    status_code INTEGER NOT NULL,
    request_size INTEGER, -- en bytes
    response_size INTEGER, -- en bytes
    ip_address INET,
    user_agent TEXT,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =============================================================================
-- TABLA DE PLANES DE SUSCRIPCIÓN
-- =============================================================================
CREATE TABLE IF NOT EXISTS subscription_plans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    price DECIMAL(10,2) NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'CLP',
    duration_days INTEGER NOT NULL,
    api_quota INTEGER NOT NULL,
    features TEXT[] DEFAULT '{}',
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =============================================================================
-- TABLA DE FACTURACIÓN
-- =============================================================================
CREATE TABLE IF NOT EXISTS billing (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES saas_users(id) ON DELETE CASCADE,
    subscription_id UUID REFERENCES saas_subscriptions(id) ON DELETE SET NULL,
    amount DECIMAL(10,2) NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'CLP',
    description TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'failed', 'cancelled')),
    payment_method VARCHAR(50),
    transaction_id VARCHAR(255),
    due_date TIMESTAMP,
    paid_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =============================================================================
-- TABLA DE ACTIVIDAD DE USUARIOS
-- =============================================================================
CREATE TABLE IF NOT EXISTS user_activity (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES saas_users(id) ON DELETE CASCADE,
    activity_type VARCHAR(100) NOT NULL,
    description TEXT,
    metadata JSONB,
    ip_address INET,
    user_agent TEXT,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =============================================================================
-- TABLA DE CONFIGURACIÓN SAAS
-- =============================================================================
CREATE TABLE IF NOT EXISTS saas_config (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    key VARCHAR(100) UNIQUE NOT NULL,
    value TEXT,
    description TEXT,
    is_public BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =============================================================================
-- ÍNDICES PARA OPTIMIZACIÓN
-- =============================================================================

-- Índices para saas_users
CREATE INDEX IF NOT EXISTS idx_saas_users_email ON saas_users(email);
CREATE INDEX IF NOT EXISTS idx_saas_users_subscription_plan ON saas_users(subscription_plan);
CREATE INDEX IF NOT EXISTS idx_saas_users_role ON saas_users(role);
CREATE INDEX IF NOT EXISTS idx_saas_users_is_active ON saas_users(is_active);
CREATE INDEX IF NOT EXISTS idx_saas_users_created_at ON saas_users(created_at);

-- Índices para saas_subscriptions
CREATE INDEX IF NOT EXISTS idx_saas_subscriptions_user_id ON saas_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_saas_subscriptions_status ON saas_subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_saas_subscriptions_start_date ON saas_subscriptions(start_date);
CREATE INDEX IF NOT EXISTS idx_saas_subscriptions_end_date ON saas_subscriptions(end_date);

-- Índices para api_usage
CREATE INDEX IF NOT EXISTS idx_api_usage_user_id ON api_usage(user_id);
CREATE INDEX IF NOT EXISTS idx_api_usage_timestamp ON api_usage(timestamp);
CREATE INDEX IF NOT EXISTS idx_api_usage_endpoint ON api_usage(endpoint);
CREATE INDEX IF NOT EXISTS idx_api_usage_status_code ON api_usage(status_code);

-- Índices para billing
CREATE INDEX IF NOT EXISTS idx_billing_user_id ON billing(user_id);
CREATE INDEX IF NOT EXISTS idx_billing_status ON billing(status);
CREATE INDEX IF NOT EXISTS idx_billing_due_date ON billing(due_date);

-- Índices para user_activity
CREATE INDEX IF NOT EXISTS idx_user_activity_user_id ON user_activity(user_id);
CREATE INDEX IF NOT EXISTS idx_user_activity_timestamp ON user_activity(timestamp);
CREATE INDEX IF NOT EXISTS idx_user_activity_type ON user_activity(activity_type);

-- =============================================================================
-- DATOS INICIALES
-- =============================================================================

-- Insertar roles del sistema
INSERT INTO saas_roles (name, description, permissions, is_system) VALUES
('admin', 'Administrador del sistema con acceso completo', ARRAY['*'], true),
('manager', 'Gerente con acceso a gestión de usuarios y reportes', ARRAY['saas:users_manage', 'saas:analytics_view', 'saas:billing_manage'], true),
('user', 'Usuario estándar con acceso básico', ARRAY['documents:read', 'templates:read', 'signatures:capture'], true)
ON CONFLICT (name) DO NOTHING;

-- Insertar planes de suscripción
INSERT INTO subscription_plans (name, description, price, currency, duration_days, api_quota, features) VALUES
('free', 'Plan gratuito con funcionalidades básicas', 0.00, 'CLP', 30, 100, ARRAY['documents:read', 'templates:read']),
('basic', 'Plan básico para uso personal', 15000.00, 'CLP', 30, 1000, ARRAY['documents:read', 'documents:create', 'templates:read', 'signatures:capture']),
('premium', 'Plan premium para profesionales', 45000.00, 'CLP', 30, 10000, ARRAY['documents:*', 'templates:*', 'signatures:*', 'analytics:read']),
('enterprise', 'Plan empresarial con soporte dedicado', 150000.00, 'CLP', 30, 100000, ARRAY['*'])
ON CONFLICT (name) DO NOTHING;

-- Insertar configuración del sistema
INSERT INTO saas_config (key, value, description, is_public) VALUES
('max_file_size_mb', '50', 'Tamaño máximo de archivo en MB', true),
('max_documents_per_user', '1000', 'Máximo número de documentos por usuario', true),
('api_rate_limit_per_minute', '100', 'Límite de requests por minuto por usuario', true),
('maintenance_mode', 'false', 'Modo mantenimiento del sistema', false),
('default_currency', 'CLP', 'Moneda por defecto del sistema', true)
ON CONFLICT (key) DO NOTHING;

-- =============================================================================
-- TRIGGERS PARA ACTUALIZACIÓN AUTOMÁTICA
-- =============================================================================

-- Trigger para actualizar updated_at en saas_users
CREATE OR REPLACE FUNCTION update_saas_users_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_saas_users_updated_at
    BEFORE UPDATE ON saas_users
    FOR EACH ROW
    EXECUTE FUNCTION update_saas_users_updated_at();

-- Trigger para actualizar updated_at en saas_roles
CREATE OR REPLACE FUNCTION update_saas_roles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_saas_roles_updated_at
    BEFORE UPDATE ON saas_roles
    FOR EACH ROW
    EXECUTE FUNCTION update_saas_roles_updated_at();

-- Trigger para actualizar updated_at en saas_subscriptions
CREATE OR REPLACE FUNCTION update_saas_subscriptions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_saas_subscriptions_updated_at
    BEFORE UPDATE ON saas_subscriptions
    FOR EACH ROW
    EXECUTE FUNCTION update_saas_subscriptions_updated_at();

-- =============================================================================
-- VISTAS ÚTILES
-- =============================================================================

-- Vista para estadísticas de usuarios
CREATE OR REPLACE VIEW user_stats AS
SELECT 
    subscription_plan,
    COUNT(*) as user_count,
    COUNT(CASE WHEN is_active THEN 1 END) as active_users,
    COUNT(CASE WHEN last_login >= CURRENT_DATE - INTERVAL '30 days' THEN 1 END) as recent_users
FROM saas_users
GROUP BY subscription_plan;

-- Vista para estadísticas de API
CREATE OR REPLACE VIEW api_stats AS
SELECT 
    DATE_TRUNC('day', timestamp) as date,
    COUNT(*) as total_requests,
    AVG(response_time) as avg_response_time,
    COUNT(CASE WHEN status_code >= 400 THEN 1 END) as error_count,
    COUNT(DISTINCT user_id) as unique_users
FROM api_usage
GROUP BY DATE_TRUNC('day', timestamp)
ORDER BY date DESC;

-- Vista para facturación mensual
CREATE OR REPLACE VIEW monthly_billing AS
SELECT 
    DATE_TRUNC('month', created_at) as month,
    SUM(amount) as total_amount,
    COUNT(*) as invoice_count,
    COUNT(CASE WHEN status = 'paid' THEN 1 END) as paid_invoices,
    COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_invoices
FROM billing
GROUP BY DATE_TRUNC('month', created_at)
ORDER BY month DESC;

-- =============================================================================
-- FUNCIONES UTILITARIAS
-- =============================================================================

-- Función para obtener estadísticas de un usuario
CREATE OR REPLACE FUNCTION get_user_stats(user_uuid UUID)
RETURNS TABLE(
    total_documents BIGINT,
    total_api_calls BIGINT,
    subscription_status TEXT,
    days_until_expiry INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COALESCE(doc_count.count, 0)::BIGINT as total_documents,
        COALESCE(api_count.count, 0)::BIGINT as total_api_calls,
        COALESCE(sub.status, 'no_subscription')::TEXT as subscription_status,
        COALESCE(EXTRACT(DAY FROM (sub.end_date - CURRENT_DATE))::INTEGER, 0) as days_until_expiry
    FROM saas_users u
    LEFT JOIN (
        SELECT user_id, COUNT(*) as count 
        FROM documents 
        WHERE user_id = user_uuid 
        GROUP BY user_id
    ) doc_count ON u.id = doc_count.user_id
    LEFT JOIN (
        SELECT user_id, COUNT(*) as count 
        FROM api_usage 
        WHERE user_id = user_uuid 
        GROUP BY user_id
    ) api_count ON u.id = api_count.user_id
    LEFT JOIN (
        SELECT user_id, status, end_date 
        FROM saas_subscriptions 
        WHERE user_id = user_uuid 
        AND status = 'active' 
        ORDER BY end_date DESC 
        LIMIT 1
    ) sub ON u.id = sub.user_id
    WHERE u.id = user_uuid;
END;
$$ LANGUAGE plpgsql;

-- Función para verificar límites de API
CREATE OR REPLACE FUNCTION check_api_quota(user_uuid UUID)
RETURNS BOOLEAN AS $$
DECLARE
    user_quota INTEGER;
    user_usage INTEGER;
BEGIN
    SELECT api_quota, api_usage INTO user_quota, user_usage
    FROM saas_users
    WHERE id = user_uuid;
    
    RETURN user_usage < user_quota;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- PERMISOS Y SEGURIDAD
-- =============================================================================

-- Crear usuario de solo lectura para reportes
-- CREATE USER saas_readonly WITH PASSWORD 'secure_password_here';
-- GRANT CONNECT ON DATABASE notarypro TO saas_readonly;
-- GRANT USAGE ON SCHEMA public TO saas_readonly;
-- GRANT SELECT ON ALL TABLES IN SCHEMA public TO saas_readonly;
-- GRANT SELECT ON ALL SEQUENCES IN SCHEMA public TO saas_readonly;

-- Comentarios sobre las tablas
COMMENT ON TABLE saas_users IS 'Usuarios del sistema SaaS con suscripciones y límites de API';
COMMENT ON TABLE saas_roles IS 'Roles y permisos del sistema SaaS';
COMMENT ON TABLE saas_subscriptions IS 'Suscripciones activas de los usuarios';
COMMENT ON TABLE api_usage IS 'Registro de uso de la API para análisis y facturación';
COMMENT ON TABLE subscription_plans IS 'Planes de suscripción disponibles';
COMMENT ON TABLE billing IS 'Facturación y pagos de usuarios';
COMMENT ON TABLE user_activity IS 'Actividad y auditoría de usuarios';
COMMENT ON TABLE saas_config IS 'Configuración del sistema SaaS';

COMMENT ON COLUMN saas_users.api_quota IS 'Límite de requests de API por mes';
COMMENT ON COLUMN saas_users.api_usage IS 'Uso actual de API en el mes';
COMMENT ON COLUMN api_usage.response_time IS 'Tiempo de respuesta en milisegundos';
COMMENT ON COLUMN subscription_plans.features IS 'Array de características incluidas en el plan';
