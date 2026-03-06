import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { UserService, JWTPayload } from './userService.js';
import { prisma } from '../lib/prisma.js';
import { config } from '../config/index.js';
import { ConflictError, UnauthorizedError } from '../middleware/errorHandler.js';

// Mock dependencies
jest.mock('../lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    userSettings: {
      create: jest.fn(),
    },
    $transaction: jest.fn(),
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

describe('UserService', () => {
  let userService: UserService;

  beforeEach(() => {
    userService = new UserService();
    jest.clearAllMocks();
  });

  describe('register', () => {
    const mockEmail = 'test@example.com';
    const mockPassword = 'Password123';
    const mockUserId = 'user-123';
    const mockUser = {
      id: mockUserId,
      email: mockEmail.toLowerCase(),
      passwordHash: 'hashed-password',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it('should successfully register a new user', async () => {
      // Mock: user doesn't exist
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

      // Mock: transaction creates user and settings
      (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
        const tx = {
          user: {
            create: jest.fn().mockResolvedValue(mockUser),
          },
          userSettings: {
            create: jest.fn().mockResolvedValue({}),
          },
        };
        return callback(tx);
      });

      const result = await userService.register(mockEmail, mockPassword);

      // Verify user was checked for existence
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: mockEmail.toLowerCase() },
      });

      // Verify response structure
      expect(result).toHaveProperty('user');
      expect(result).toHaveProperty('auth');
      expect(result.user.email).toBe(mockEmail.toLowerCase());
      expect(result.auth).toHaveProperty('token');
      expect(result.auth).toHaveProperty('expiresIn');
    });

    it('should throw ConflictError if email already exists', async () => {
      // Mock: user already exists
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);

      await expect(userService.register(mockEmail, mockPassword)).rejects.toThrow(
        ConflictError
      );
      await expect(userService.register(mockEmail, mockPassword)).rejects.toThrow(
        '该邮箱已被注册'
      );
    });

    it('should normalize email to lowercase', async () => {
      const upperCaseEmail = 'TEST@EXAMPLE.COM';

      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
        const tx = {
          user: {
            create: jest.fn().mockResolvedValue({
              ...mockUser,
              email: upperCaseEmail.toLowerCase(),
            }),
          },
          userSettings: {
            create: jest.fn().mockResolvedValue({}),
          },
        };
        return callback(tx);
      });

      const result = await userService.register(upperCaseEmail, mockPassword);

      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: upperCaseEmail.toLowerCase() },
      });
      expect(result.user.email).toBe(upperCaseEmail.toLowerCase());
    });

    it('should hash password with bcrypt', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

      let capturedPasswordHash: string | undefined;
      (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
        const tx = {
          user: {
            create: jest.fn().mockImplementation(async (data) => {
              capturedPasswordHash = data.data.passwordHash;
              return {
                ...mockUser,
                passwordHash: capturedPasswordHash,
              };
            }),
          },
          userSettings: {
            create: jest.fn().mockResolvedValue({}),
          },
        };
        return callback(tx);
      });

      await userService.register(mockEmail, mockPassword);

      // Verify password was hashed (not stored as plain text)
      expect(capturedPasswordHash).toBeDefined();
      expect(capturedPasswordHash).not.toBe(mockPassword);

      // Verify the hash is valid bcrypt
      const isValidHash = await bcrypt.compare(mockPassword, capturedPasswordHash!);
      expect(isValidHash).toBe(true);
    });

    it('should initialize default user settings', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

      let capturedSettings: Record<string, unknown> | undefined;
      (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
        const tx = {
          user: {
            create: jest.fn().mockResolvedValue(mockUser),
          },
          userSettings: {
            create: jest.fn().mockImplementation(async (data) => {
              capturedSettings = data.data;
              return {};
            }),
          },
        };
        return callback(tx);
      });

      await userService.register(mockEmail, mockPassword);

      // Verify default settings were created
      expect(capturedSettings).toBeDefined();
      expect(capturedSettings?.userId).toBe(mockUserId);
      expect(capturedSettings?.theme).toBe('system');
      expect(capturedSettings?.language).toBe('zh');
      expect(capturedSettings?.pushEnabled).toBe(true);
      expect(capturedSettings?.priceAlertThreshold).toBe(5.0);
    });
  });

  describe('login', () => {
    const mockEmail = 'test@example.com';
    const mockPassword = 'Password123';
    const mockPasswordHash = bcrypt.hashSync(mockPassword, 10);
    const mockUser = {
      id: 'user-123',
      email: mockEmail,
      passwordHash: mockPasswordHash,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it('should successfully login with valid credentials', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);

      const result = await userService.login(mockEmail, mockPassword);

      expect(result).toHaveProperty('user');
      expect(result).toHaveProperty('auth');
      expect(result.user.email).toBe(mockEmail);
      expect(result.auth).toHaveProperty('token');
    });

    it('should throw UnauthorizedError if user not found', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(userService.login(mockEmail, mockPassword)).rejects.toThrow(
        UnauthorizedError
      );
      await expect(userService.login(mockEmail, mockPassword)).rejects.toThrow(
        '邮箱或密码错误'
      );
    });

    it('should throw UnauthorizedError if password is incorrect', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);

      await expect(userService.login(mockEmail, 'WrongPassword123')).rejects.toThrow(
        UnauthorizedError
      );
    });

    it('should normalize email to lowercase for lookup', async () => {
      const upperCaseEmail = 'TEST@EXAMPLE.COM';
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);

      await userService.login(upperCaseEmail, mockPassword);

      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: upperCaseEmail.toLowerCase() },
      });
    });
  });

  describe('generateToken', () => {
    it('should generate a valid JWT token', () => {
      const userId = 'user-123';
      const email = 'test@example.com';

      const result = userService.generateToken(userId, email);

      expect(result).toHaveProperty('token');
      expect(result).toHaveProperty('expiresIn');
      expect(typeof result.token).toBe('string');

      // Verify token can be decoded
      const decoded = jwt.verify(result.token, config.jwt.secret) as JWTPayload;
      expect(decoded.userId).toBe(userId);
      expect(decoded.email).toBe(email);
    });

    it('should include correct expiration', () => {
      const result = userService.generateToken('user-123', 'test@example.com');

      expect(result.expiresIn).toBe(config.jwt.expiresIn);
    });
  });

  describe('verifyToken', () => {
    it('should verify and decode a valid token', () => {
      const userId = 'user-123';
      const email = 'test@example.com';
      const token = jwt.sign({ userId, email }, config.jwt.secret, {
        expiresIn: '1h',
      });

      const result = userService.verifyToken(token);

      expect(result.userId).toBe(userId);
      expect(result.email).toBe(email);
    });

    it('should throw UnauthorizedError for expired token', () => {
      const token = jwt.sign(
        { userId: 'user-123', email: 'test@example.com' },
        config.jwt.secret,
        { expiresIn: '-1s' } // Already expired
      );

      expect(() => userService.verifyToken(token)).toThrow(UnauthorizedError);
      expect(() => userService.verifyToken(token)).toThrow('登录已过期，请重新登录');
    });

    it('should throw UnauthorizedError for invalid token', () => {
      const invalidToken = 'invalid.token.here';

      expect(() => userService.verifyToken(invalidToken)).toThrow(UnauthorizedError);
      expect(() => userService.verifyToken(invalidToken)).toThrow('无效的认证令牌');
    });

    it('should throw UnauthorizedError for token with wrong secret', () => {
      const token = jwt.sign(
        { userId: 'user-123', email: 'test@example.com' },
        'wrong-secret',
        { expiresIn: '1h' }
      );

      expect(() => userService.verifyToken(token)).toThrow(UnauthorizedError);
    });
  });

  describe('getUserById', () => {
    it('should return user if found', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        passwordHash: 'hash',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);

      const result = await userService.getUserById('user-123');

      expect(result).not.toBeNull();
      expect(result?.id).toBe(mockUser.id);
      expect(result?.email).toBe(mockUser.email);
      // Should not include passwordHash
      expect(result).not.toHaveProperty('passwordHash');
    });

    it('should return null if user not found', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await userService.getUserById('non-existent');

      expect(result).toBeNull();
    });
  });
});
