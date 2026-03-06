import bcrypt from 'bcryptjs';
import jwt, { SignOptions } from 'jsonwebtoken';
import { prisma } from '../lib/prisma.js';
import { config } from '../config/index.js';
import { ConflictError, UnauthorizedError } from '../middleware/errorHandler.js';
import { logger } from '../utils/logger.js';

// Types for service responses
export interface AuthToken {
  token: string;
  expiresIn: string;
}

export interface UserResponse {
  id: string;
  email: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface LoginResponse {
  user: UserResponse;
  auth: AuthToken;
}

export interface RegisterResponse {
  user: UserResponse;
  auth: AuthToken;
}

// JWT payload type
export interface JWTPayload {
  userId: string;
  email: string;
}

/**
 * UserService - Handles user authentication and account management
 * Implements Requirements 7.1 (user registration) and 7.2 (user login)
 */
export class UserService {
  private readonly SALT_ROUNDS = 12;

  /**
   * Register a new user account
   * Creates user with encrypted password and initializes default settings
   * @param email - User's email address
   * @param password - User's password (will be hashed)
   * @returns User data and authentication token
   * @throws ConflictError if email already exists
   */
  async register(email: string, password: string): Promise<RegisterResponse> {
    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (existingUser) {
      throw new ConflictError('该邮箱已被注册');
    }

    // Hash password with bcrypt
    const passwordHash = await bcrypt.hash(password, this.SALT_ROUNDS);

    // Create user with default settings in a transaction
    const user = await prisma.$transaction(async (tx) => {
      // Create user
      const newUser = await tx.user.create({
        data: {
          email: email.toLowerCase(),
          passwordHash,
        },
      });

      // Initialize default user settings (Requirement 7.1)
      await tx.userSettings.create({
        data: {
          userId: newUser.id,
          theme: 'system',
          language: 'zh',
          timezone: 'Asia/Shanghai',
          pushEnabled: true,
          priceAlertThreshold: 5.0,
          investmentPreferences: [],
        },
      });

      return newUser;
    });

    logger.info(`New user registered: ${user.email}`);

    // Generate JWT token
    const auth = this.generateToken(user.id, user.email);

    return {
      user: {
        id: user.id,
        email: user.email,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
      auth,
    };
  }

  /**
   * Authenticate user and return token
   * Restores user's watchlist, subscriptions, and preferences (Requirement 7.2)
   * @param email - User's email address
   * @param password - User's password
   * @returns User data and authentication token
   * @throws UnauthorizedError if credentials are invalid
   */
  async login(email: string, password: string): Promise<LoginResponse> {
    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (!user) {
      throw new UnauthorizedError('邮箱或密码错误');
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);

    if (!isPasswordValid) {
      throw new UnauthorizedError('邮箱或密码错误');
    }

    logger.info(`User logged in: ${user.email}`);

    // Generate JWT token
    const auth = this.generateToken(user.id, user.email);

    return {
      user: {
        id: user.id,
        email: user.email,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
      auth,
    };
  }

  /**
   * Generate JWT token for authenticated user
   * @param userId - User's unique identifier
   * @param email - User's email address
   * @returns Authentication token with expiration
   */
  generateToken(userId: string, email: string): AuthToken {
    const payload: JWTPayload = {
      userId,
      email,
    };

    // Parse expiresIn to handle both string and number formats
    const expiresIn = config.jwt.expiresIn;
    const signOptions: SignOptions = {};
    
    // Handle different expiresIn formats (e.g., '7d', '24h', 3600)
    if (typeof expiresIn === 'number') {
      signOptions.expiresIn = expiresIn;
    } else if (typeof expiresIn === 'string') {
      // Convert string like '7d' to seconds or use as-is if it's a valid format
      signOptions.expiresIn = expiresIn as jwt.SignOptions['expiresIn'];
    }

    const token = jwt.sign(payload, config.jwt.secret, signOptions);

    return {
      token,
      expiresIn: config.jwt.expiresIn,
    };
  }

  /**
   * Verify and decode JWT token
   * @param token - JWT token to verify
   * @returns Decoded payload with user info
   * @throws UnauthorizedError if token is invalid
   */
  verifyToken(token: string): JWTPayload {
    try {
      const decoded = jwt.verify(token, config.jwt.secret) as JWTPayload;
      return decoded;
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new UnauthorizedError('登录已过期，请重新登录');
      }
      if (error instanceof jwt.JsonWebTokenError) {
        throw new UnauthorizedError('无效的认证令牌');
      }
      throw new UnauthorizedError('认证失败');
    }
  }

  /**
   * Get user by ID
   * @param userId - User's unique identifier
   * @returns User data or null if not found
   */
  async getUserById(userId: string): Promise<UserResponse | null> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return null;
    }

    return {
      id: user.id,
      email: user.email,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}

// Export singleton instance
export const userService = new UserService();
