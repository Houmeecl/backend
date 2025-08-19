"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authorizeRole = exports.authorizePermission = exports.authenticateToken = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const authenticateToken = (jwtSecret) => {
    return (req, res, next) => {
        const publicRoutes = ['/api/v1/auth/login', '/api/v1/auth/register'];
        if (publicRoutes.includes(req.path)) {
            return next();
        }
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];
        if (!token) {
            return res.status(401).json({
                error: 'Access Denied',
                message: 'Token de acceso requerido'
            });
        }
        try {
            const decoded = jsonwebtoken_1.default.verify(token, jwtSecret);
            req.user = {
                id: decoded.userId || decoded.id,
                email: decoded.email,
                role: decoded.role,
                permissions: decoded.permissions || []
            };
            next();
        }
        catch (error) {
            return res.status(403).json({
                error: 'Forbidden',
                message: 'Token inválido o expirado'
            });
        }
    };
};
exports.authenticateToken = authenticateToken;
const authorizePermission = (requiredPermissions) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                error: 'Unauthorized',
                message: 'Usuario no autenticado'
            });
        }
        if (req.user.role === 'admin') {
            return next();
        }
        const permissions = Array.isArray(requiredPermissions)
            ? requiredPermissions
            : [requiredPermissions];
        const hasPermission = permissions.some(permission => req.user.permissions.includes(permission));
        if (!hasPermission) {
            return res.status(403).json({
                error: 'Forbidden',
                message: `Permiso denegado. Se requiere uno de: ${permissions.join(', ')}`
            });
        }
        next();
    };
};
exports.authorizePermission = authorizePermission;
const authorizeRole = (requiredRoles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                error: 'Unauthorized',
                message: 'Usuario no autenticado'
            });
        }
        const roles = Array.isArray(requiredRoles) ? requiredRoles : [requiredRoles];
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({
                error: 'Forbidden',
                message: `Acceso denegado. Se requiere rol: ${roles.join(' o ')}`
            });
        }
        return next();
    };
};
exports.authorizeRole = authorizeRole;
