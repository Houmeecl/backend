-- Script simple para crear usuario SuperAdmin
-- Ejecutar en Neon DB

-- Crear usuario en la tabla principal
INSERT INTO users (
    email,
    password_hash,
    name,
    role,
    is_active,
    created_at,
    updated_at
) VALUES (
    'superadmin@notarypro.com',
    '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', -- password: password
    'Super Administrador',
    'admin',
    true,
    NOW(),
    NOW()
) ON CONFLICT (email) DO UPDATE SET
    password_hash = EXCLUDED.password_hash,
    name = EXCLUDED.name,
    role = EXCLUDED.role,
    is_active = EXCLUDED.is_active,
    updated_at = NOW();

-- Crear usuario en la tabla SaaS si existe
INSERT INTO saas_users (
    email,
    password_hash,
    name,
    role,
    api_quota,
    api_usage,
    is_active,
    created_at,
    updated_at
) VALUES (
    'superadmin@notarypro.com',
    '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', -- password: password
    'Super Administrador',
    'admin',
    100000,
    0,
    true,
    NOW(),
    NOW()
) ON CONFLICT (email) DO UPDATE SET
    password_hash = EXCLUDED.password_hash,
    name = EXCLUDED.name,
    role = EXCLUDED.role,
    api_quota = EXCLUDED.api_quota,
    is_active = EXCLUDED.is_active,
    updated_at = NOW();

-- Verificar que se creó
SELECT 'Usuario creado:' as status, email, name, role, is_active FROM users WHERE email = 'superadmin@notarypro.com';
