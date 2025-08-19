-- Script para crear usuario SuperAdmin
-- Ejecutar en Neon DB

-- Insertar usuario superadmin
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
    '$2b$10$rQZ8K9vX2mN3pL1qW4eR5tY6uI7oP8aB9cC0dE1fG2hH3iI4jJ5kK6lL7mM8nN9oO0pP1qQ2rR3sS4tT5uU6vV7wW8xX9yY0zZ',
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

-- Insertar en la tabla de usuarios SaaS si existe
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
    '$2b$10$rQZ8K9vX2mN3pL1qW4eR5tY6uI7oP8aB9cC0dE1fG2hH3iI4jJ5kK6lL7mM8nN9oO0pP1qQ2rR3sS4tT5uU6vV7wW8xX9yY0zZ',
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

-- Verificar que se creó correctamente
SELECT 'Usuario SuperAdmin creado:' as status, email, name, role, is_active FROM users WHERE email = 'superadmin@notarypro.com';
SELECT 'Usuario SaaS creado:' as status, email, name, role, is_active FROM saas_users WHERE email = 'superadmin@notarypro.com';
