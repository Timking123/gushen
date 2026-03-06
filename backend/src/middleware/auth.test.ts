import { Response, NextFunction } from 'express';
import { authenticate, optionalAuthenticate } from './auth.js';
import { AuthenticatedRequest } from '../types/index.js';
import { UnauthorizedError } from './errorHandler.js';

// Mock the userService
jest.mock('../services/userService', () => ({
  userService: {
    verifyToken: jest.fn(),
  },
}));

jest.mock('../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

import { userService } from '../services/userService.js';

describe('Authentication Middleware', () => {
  let mockRequest: Partial<AuthenticatedRequest>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockRequest = {
      headers: {},
    };
    mockResponse = {};
    mockNext = jest.fn();
    jest.clearAllMocks();
  });

  describe('authenticate', () => {
    it('should call next with UnauthorizedError if no authorization header', async () => {
      await authenticate(
        mockRequest as AuthenticatedRequest,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalledWith(expect.any(UnauthorizedError));
      const error = (mockNext as jest.Mock).mock.calls[0][0];
      expect(error.message).toBe('未提供认证令牌');
    });

    it('should call next with UnauthorizedError if authorization header is not Bearer', async () => {
      mockRequest.headers = { authorization: 'Basic token123' };

      await authenticate(
        mockRequest as AuthenticatedRequest,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalledWith(expect.any(UnauthorizedError));
      const error = (mockNext as jest.Mock).mock.calls[0][0];
      expect(error.message).toBe('无效的认证格式');
    });

    it('should call next with UnauthorizedError if token is empty', async () => {
      mockRequest.headers = { authorization: 'Bearer ' };

      await authenticate(
        mockRequest as AuthenticatedRequest,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalledWith(expect.any(UnauthorizedError));
    });

    it('should attach user to request and call next on valid token', async () => {
      const mockPayload = { userId: 'user-123', email: 'test@example.com' };
      mockRequest.headers = { authorization: 'Bearer valid-token' };

      (userService.verifyToken as jest.Mock).mockReturnValue(mockPayload);

      await authenticate(
        mockRequest as AuthenticatedRequest,
        mockResponse as Response,
        mockNext
      );

      expect(userService.verifyToken).toHaveBeenCalledWith('valid-token');
      expect(mockRequest.user).toEqual({
        id: mockPayload.userId,
        email: mockPayload.email,
      });
      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should call next with error if token verification fails', async () => {
      mockRequest.headers = { authorization: 'Bearer invalid-token' };

      const verifyError = new UnauthorizedError('无效的认证令牌');
      (userService.verifyToken as jest.Mock).mockImplementation(() => {
        throw verifyError;
      });

      await authenticate(
        mockRequest as AuthenticatedRequest,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalledWith(verifyError);
    });
  });

  describe('optionalAuthenticate', () => {
    it('should call next without user if no authorization header', async () => {
      await optionalAuthenticate(
        mockRequest as AuthenticatedRequest,
        mockResponse as Response,
        mockNext
      );

      expect(mockRequest.user).toBeUndefined();
      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should call next without user if authorization header is not Bearer', async () => {
      mockRequest.headers = { authorization: 'Basic token123' };

      await optionalAuthenticate(
        mockRequest as AuthenticatedRequest,
        mockResponse as Response,
        mockNext
      );

      expect(mockRequest.user).toBeUndefined();
      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should attach user to request on valid token', async () => {
      const mockPayload = { userId: 'user-123', email: 'test@example.com' };
      mockRequest.headers = { authorization: 'Bearer valid-token' };

      (userService.verifyToken as jest.Mock).mockReturnValue(mockPayload);

      await optionalAuthenticate(
        mockRequest as AuthenticatedRequest,
        mockResponse as Response,
        mockNext
      );

      expect(mockRequest.user).toEqual({
        id: mockPayload.userId,
        email: mockPayload.email,
      });
      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should call next without user if token verification fails', async () => {
      mockRequest.headers = { authorization: 'Bearer invalid-token' };

      (userService.verifyToken as jest.Mock).mockImplementation(() => {
        throw new UnauthorizedError('无效的认证令牌');
      });

      await optionalAuthenticate(
        mockRequest as AuthenticatedRequest,
        mockResponse as Response,
        mockNext
      );

      expect(mockRequest.user).toBeUndefined();
      expect(mockNext).toHaveBeenCalledWith();
    });
  });
});
