import { Response, NextFunction } from 'express';
import { userService } from '../services/userService.js';
import { UnauthorizedError } from './errorHandler.js';
import { AuthenticatedRequest } from '../types/index.js';
import { logger } from '../utils/logger.js';

/**
 * Authentication middleware - Verifies JWT token and attaches user to request
 * Used to protect routes that require authentication
 */
export const authenticate = async (
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Get token from Authorization header
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      throw new UnauthorizedError('未提供认证令牌');
    }

    // Check for Bearer token format
    if (!authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedError('无效的认证格式');
    }

    // Extract token
    const token = authHeader.substring(7);

    if (!token) {
      throw new UnauthorizedError('未提供认证令牌');
    }

    // Verify token and get payload
    const payload = userService.verifyToken(token);

    // Attach user info to request
    req.user = {
      id: payload.userId,
      email: payload.email,
    };

    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Optional authentication middleware - Attaches user if token is valid, but doesn't require it
 * Used for routes that have different behavior for authenticated vs anonymous users
 */
export const optionalAuthenticate = async (
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      // No token provided, continue without user
      return next();
    }

    const token = authHeader.substring(7);

    if (!token) {
      return next();
    }

    try {
      // Verify token and get payload
      const payload = userService.verifyToken(token);

      // Attach user info to request
      req.user = {
        id: payload.userId,
        email: payload.email,
      };
    } catch {
      // Token invalid, continue without user
      logger.debug('Optional auth: Invalid token provided');
    }

    next();
  } catch (error) {
    next(error);
  }
};
