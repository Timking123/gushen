/**
 * RBAC Middleware - Role-Based Access Control
 * Requirements: 2.2, 2.3, 2.4, 2.5
 *
 * Provides middleware functions to check user roles and permissions
 * before allowing access to protected resources.
 */

import { Response, NextFunction, RequestHandler } from 'express';
import { AuthenticatedRequest } from '../types/index.js';
import { UserRole, Permission, rolePermissions, getEffectivePermissions } from '../types/roles.js';
import { ForbiddenError } from './errorHandler.js';

/**
 * Middleware that requires the user to have ALL of the specified permissions.
 * Uses the user's role-based permissions plus any extra custom permissions.
 *
 * Returns 403 ForbiddenError if the user lacks any required permission.
 */
export function requirePermission(...permissions: Permission[]): RequestHandler {
  return (req: AuthenticatedRequest, _res: Response, next: NextFunction): void => {
    const user = req.user;

    if (!user) {
      return next(new ForbiddenError('访问被拒绝：未找到用户信息'));
    }

    const userRole = user.role || UserRole.USER;
    const effectivePermissions = getEffectivePermissions(userRole, user.permissions || []);

    const missingPermissions = permissions.filter(
      (perm) => !effectivePermissions.includes(perm)
    );

    if (missingPermissions.length > 0) {
      return next(
        new ForbiddenError(
          `权限不足：缺少以下权限 ${missingPermissions.join(', ')}`
        )
      );
    }

    next();
  };
}

/**
 * Middleware that requires the user to have one of the specified roles.
 *
 * Returns 403 ForbiddenError if the user's role is not in the allowed list.
 */
export function requireRole(...roles: UserRole[]): RequestHandler {
  return (req: AuthenticatedRequest, _res: Response, next: NextFunction): void => {
    const user = req.user;

    if (!user) {
      return next(new ForbiddenError('访问被拒绝：未找到用户信息'));
    }

    const userRole = user.role || UserRole.USER;

    if (!roles.includes(userRole)) {
      return next(
        new ForbiddenError(
          `权限不足：需要以下角色之一 ${roles.join(', ')}`
        )
      );
    }

    next();
  };
}

export { UserRole, Permission, rolePermissions };
