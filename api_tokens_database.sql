-- =============================================================================
-- NOTARYPRO API TOKENS DATABASE SCHEMA
-- =============================================================================

-- Crear extensión para UUIDs si no existe
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================================================
-- TABLA DE TOKENS API
-- =============================================================================
CREATE TABLE IF NOT EXISTS api_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    user_id UUID NOT NULL REFERENCES saas_users(id) ON DELETE CASCADE,
    token_hash VARCHAR(64) UNIQUE NOT NULL, -- Hash SHA-256 del token
    permissions TEXT[] DEFAULT '{}',
    rate_limit_per_minute INTEGER NOT NULL DEFAULT 100,
    expires_at TIMESTAMP,
    is_active BOOLEAN NOT NULL DEFAULT true,
    last_used TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =============================================================================
-- TABLA DE USO DE TOKENS
-- =============================================================================
CREATE TABLE IF NOT EXISTS token_usage (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    token_id UUID NOT NULL REFERENCES api_tokens(id) ON DELETE CASCADE,
    endpoint VARCHAR(255) NOT NULL,
    method VARCHAR(10) NOT NULL CHECK (method IN ('GET', 'POST', 'PUT', 'DELETE', 'PATCH')),
    response_time INTEGER NOT NULL, -- en milisegundos
    status_code INTEGER NOT NULL,
    ip_address INET NOT NULL,
    user_agent TEXT,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =============================================================================
-- TABLA DE REVOCACIÓN DE TOKENS
-- =============================================================================
CREATE TABLE IF NOT EXISTS token_revocations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    token_id UUID NOT NULL REFERENCES api_tokens(id) ON DELETE CASCADE,
    reason VARCHAR(255) NOT NULL,
    revoked_by UUID REFERENCES saas_users(id),
    revoked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =============================================================================
-- ÍNDICES PARA OPTIMIZACIÓN
-- =============================================================================

-- Índices para api_tokens
CREATE INDEX IF NOT EXISTS idx_api_tokens_user_id ON api_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_api_tokens_token_hash ON api_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_api_tokens_is_active ON api_tokens(is_active);
CREATE INDEX IF NOT EXISTS idx_api_tokens_expires_at ON api_tokens(expires_at);
CREATE INDEX IF NOT EXISTS idx_api_tokens_created_at ON api_tokens(created_at);

-- Índices para token_usage
CREATE INDEX IF NOT EXISTS idx_token_usage_token_id ON token_usage(token_id);
CREATE INDEX IF NOT EXISTS idx_token_usage_timestamp ON token_usage(timestamp);
CREATE INDEX IF NOT EXISTS idx_token_usage_endpoint ON token_usage(endpoint);
CREATE INDEX IF NOT EXISTS idx_token_usage_status_code ON token_usage(status_code);
CREATE INDEX IF NOT EXISTS idx_token_usage_ip_address ON token_usage(ip_address);

-- Índices para token_revocations
CREATE INDEX IF NOT EXISTS idx_token_revocations_token_id ON token_revocations(token_id);
CREATE INDEX IF NOT EXISTS idx_token_revocations_revoked_at ON token_revocations(revoked_at);

-- =============================================================================
-- TRIGGERS PARA ACTUALIZACIÓN AUTOMÁTICA
-- =============================================================================

-- Trigger para actualizar updated_at en api_tokens
CREATE OR REPLACE FUNCTION update_api_tokens_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_api_tokens_updated_at
    BEFORE UPDATE ON api_tokens
    FOR EACH ROW
    EXECUTE FUNCTION update_api_tokens_updated_at();

-- Trigger para actualizar last_used en api_tokens
CREATE OR REPLACE FUNCTION update_api_tokens_last_used()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE api_tokens 
    SET last_used = CURRENT_TIMESTAMP 
    WHERE id = NEW.token_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_api_tokens_last_used
    AFTER INSERT ON token_usage
    FOR EACH ROW
    EXECUTE FUNCTION update_api_tokens_last_used();

-- =============================================================================
-- VISTAS ÚTILES
-- =============================================================================

-- Vista para estadísticas de uso de tokens
CREATE OR REPLACE VIEW token_usage_stats AS
SELECT 
    t.id as token_id,
    t.name as token_name,
    t.user_id,
    u.email as user_email,
    COUNT(tu.id) as total_requests,
    AVG(tu.response_time) as avg_response_time,
    COUNT(CASE WHEN tu.status_code >= 400 THEN 1 END) as error_count,
    MAX(tu.timestamp) as last_used,
    t.rate_limit_per_minute,
    t.is_active,
    t.expires_at
FROM api_tokens t
LEFT JOIN token_usage tu ON t.id = tu.token_id
LEFT JOIN saas_users u ON t.user_id = u.id
GROUP BY t.id, t.name, t.user_id, u.email, t.rate_limit_per_minute, t.is_active, t.expires_at
ORDER BY total_requests DESC;

-- Vista para tokens expirados o próximos a expirar
CREATE OR REPLACE VIEW token_expiry_warnings AS
SELECT 
    t.id,
    t.name,
    t.user_id,
    u.email as user_email,
    t.expires_at,
    EXTRACT(DAY FROM (t.expires_at - CURRENT_TIMESTAMP)) as days_until_expiry,
    CASE 
        WHEN t.expires_at <= CURRENT_TIMESTAMP THEN 'expired'
        WHEN t.expires_at <= CURRENT_TIMESTAMP + INTERVAL '7 days' THEN 'expiring_soon'
        ELSE 'valid'
    END as expiry_status
FROM api_tokens t
LEFT JOIN saas_users u ON t.user_id = u.id
WHERE t.expires_at IS NOT NULL
ORDER BY t.expires_at ASC;

-- Vista para rate limiting
CREATE OR REPLACE VIEW rate_limit_status AS
SELECT 
    t.id as token_id,
    t.name as token_name,
    t.user_id,
    u.email as user_email,
    t.rate_limit_per_minute,
    COUNT(tu.id) as current_minute_requests,
    (t.rate_limit_per_minute - COUNT(tu.id)) as remaining_requests,
    CASE 
        WHEN COUNT(tu.id) >= t.rate_limit_per_minute THEN 'limit_exceeded'
        WHEN COUNT(tu.id) >= t.rate_limit_per_minute * 0.8 THEN 'approaching_limit'
        ELSE 'within_limit'
    END as limit_status
FROM api_tokens t
LEFT JOIN token_usage tu ON t.id = tu.token_id 
    AND tu.timestamp >= NOW() - INTERVAL '1 minute'
LEFT JOIN saas_users u ON t.user_id = u.id
WHERE t.is_active = true
GROUP BY t.id, t.name, t.user_id, u.email, t.rate_limit_per_minute
ORDER BY current_minute_requests DESC;

-- =============================================================================
-- FUNCIONES UTILITARIAS
-- =============================================================================

-- Función para verificar si un token está activo y no ha expirado
CREATE OR REPLACE FUNCTION is_token_valid(token_uuid UUID)
RETURNS BOOLEAN AS $$
DECLARE
    token_record RECORD;
BEGIN
    SELECT * INTO token_record
    FROM api_tokens
    WHERE id = token_uuid;
    
    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;
    
    -- Verificar si está activo
    IF NOT token_record.is_active THEN
        RETURN FALSE;
    END IF;
    
    -- Verificar si ha expirado
    IF token_record.expires_at IS NOT NULL AND token_record.expires_at <= CURRENT_TIMESTAMP THEN
        RETURN FALSE;
    END IF;
    
    -- Verificar si ha sido revocado
    IF EXISTS (
        SELECT 1 FROM token_revocations 
        WHERE token_id = token_uuid
    ) THEN
        RETURN FALSE;
    END IF;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Función para obtener estadísticas de uso de un token en un rango de tiempo
CREATE OR REPLACE FUNCTION get_token_usage_stats(
    token_uuid UUID,
    time_range INTERVAL DEFAULT '30 days'
)
RETURNS TABLE(
    total_requests BIGINT,
    avg_response_time NUMERIC,
    error_count BIGINT,
    unique_endpoints BIGINT,
    unique_ips BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*)::BIGINT as total_requests,
        ROUND(AVG(response_time), 2) as avg_response_time,
        COUNT(CASE WHEN status_code >= 400 THEN 1 END)::BIGINT as error_count,
        COUNT(DISTINCT endpoint)::BIGINT as unique_endpoints,
        COUNT(DISTINCT ip_address)::BIGINT as unique_ips
    FROM token_usage
    WHERE token_id = token_uuid
    AND timestamp >= CURRENT_TIMESTAMP - time_range;
END;
$$ LANGUAGE plpgsql;

-- Función para limpiar tokens expirados (ejecutar periódicamente)
CREATE OR REPLACE FUNCTION cleanup_expired_tokens()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM api_tokens
    WHERE expires_at IS NOT NULL 
    AND expires_at < CURRENT_TIMESTAMP
    AND is_active = true;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    -- Marcar como inactivos en lugar de eliminar completamente
    UPDATE api_tokens
    SET is_active = false
    WHERE expires_at IS NOT NULL 
    AND expires_at < CURRENT_TIMESTAMP
    AND is_active = true;
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- PERMISOS Y SEGURIDAD
-- =============================================================================

-- Crear usuario de solo lectura para monitoreo
-- CREATE USER api_monitor WITH PASSWORD 'secure_password_here';
-- GRANT CONNECT ON DATABASE notarypro TO api_monitor;
-- GRANT USAGE ON SCHEMA public TO api_monitor;
-- GRANT SELECT ON ALL TABLES IN SCHEMA public TO api_monitor;
-- GRANT SELECT ON ALL SEQUENCES IN SCHEMA public TO api_monitor;

-- Comentarios sobre las tablas
COMMENT ON TABLE api_tokens IS 'Tokens de API para autenticación y autorización';
COMMENT ON TABLE token_usage IS 'Registro de uso de tokens API para análisis y rate limiting';
COMMENT ON TABLE token_revocations IS 'Registro de tokens revocados por seguridad';

COMMENT ON COLUMN api_tokens.token_hash IS 'Hash SHA-256 del token original (no se almacena el token)';
COMMENT ON COLUMN api_tokens.rate_limit_per_minute IS 'Límite de requests por minuto para este token';
COMMENT ON COLUMN token_usage.response_time IS 'Tiempo de respuesta en milisegundos';
COMMENT ON COLUMN token_usage.ip_address IS 'Dirección IP del cliente que usó el token';

-- =============================================================================
-- DATOS DE EJEMPLO (OPCIONAL)
-- =============================================================================

-- Insertar token de ejemplo para testing
-- INSERT INTO api_tokens (name, description, user_id, token_hash, permissions, rate_limit_per_minute) VALUES
-- ('Test Token', 'Token de prueba para desarrollo', 
--  (SELECT id FROM saas_users LIMIT 1), 
--  'test_hash_1234567890abcdef', 
--  ARRAY['documents:read', 'templates:read'], 
--  1000)
-- ON CONFLICT DO NOTHING;
