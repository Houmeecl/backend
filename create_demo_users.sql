-- Script para crear usuarios demo
-- Ejecutar en Neon DB

-- Usuario Admin Demo
INSERT INTO users (
    email,
    password_hash,
    name,
    role,
    is_active,
    created_at,
    updated_at
) VALUES (
    'admin@demo.com',
    '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', -- password: password
    'Administrador Demo',
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

-- Usuario Seller Demo
INSERT INTO users (
    email,
    password_hash,
    name,
    role,
    is_active,
    created_at,
    updated_at
) VALUES (
    'seller@demo.com',
    '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', -- password: password
    'Vendedor Demo',
    'seller',
    true,
    NOW(),
    NOW()
) ON CONFLICT (email) DO UPDATE SET
    password_hash = EXCLUDED.password_hash,
    name = EXCLUDED.name,
    role = EXCLUDED.role,
    is_active = EXCLUDED.is_active,
    updated_at = NOW();

-- Usuario Developer Demo
INSERT INTO users (
    email,
    password_hash,
    name,
    role,
    is_active,
    created_at,
    updated_at
) VALUES (
    'developer@demo.com',
    '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', -- password: password
    'Desarrollador Demo',
    'developer',
    true,
    NOW(),
    NOW()
) ON CONFLICT (email) DO UPDATE SET
    password_hash = EXCLUDED.password_hash,
    name = EXCLUDED.name,
    role = EXCLUDED.role,
    is_active = EXCLUDED.is_active,
    updated_at = NOW();

-- Verificar usuarios creados
SELECT 'Usuarios demo creados:' as status;
SELECT email, name, role, is_active FROM users WHERE email IN ('admin@demo.com', 'seller@demo.com', 'developer@demo.com');
