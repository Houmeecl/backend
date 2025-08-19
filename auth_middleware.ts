import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import { Permission } from './base_module';

export const authenticateToken = (jwtSecret: string) => {
  return (req: Request, res: Response, next: NextFunction) => {
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
      const decoded = jwt.verify(token, jwtSecret) as any;
      req.user = {
        id: decoded.userId || decoded.id,
        email: decoded.email,
        role: decoded.role,
        permissions: decoded.permissions || []
      };
      next();
    } catch (error) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Token inválido o expirado'
      });
    }
  };
};

export const authorizePermission = (requiredPermissions: Permission | Permission[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
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

    const hasPermission = permissions.some(permission => 
      req.user!.permissions.includes(permission as any)
    );

    if (!hasPermission) {
      return res.status(403).json({
        error: 'Forbidden',
        message: `Permiso denegado. Se requiere uno de: ${permissions.join(', ')}`
      });
    }

    next();
  };
};

export const authorizeRole = (requiredRoles: string | string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
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
