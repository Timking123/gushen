/**
 * Unit Tests for RBAC Middleware
 * Feature: project-review-and-upgrade, Task 1.3
 *
 * Tests requirePermission and requireRole middleware functions
 * against Requirements 2.1, 2.2, 2.3, 2.4, 2.5, 2.6
 */

import { Request, Response, NextFunction } from 'express';
import { requirePermission, requireRole } from './rbac.js';
import { UserRole, Permission, rolePermissions, roleHasPermission, getEffectivePermissions } from '../types/roles.js';
import { ForbiddenError } from './errorHandler.js';

// --- Helpers ---

function mockReq(user?: { id: string; email: string; role?: UserRole; permissions?: string[] }): Request {
  return { user } as unknown as Request;
}

function mockRes(): Response {
  return {} as unknown as Response;
}

function callMiddleware(
  middleware: ReturnType<typeof requirePermission>,
  req: Request
): Promise<{ error?: unknown }> {
  return new Promise((resolve) => {
    const res = mockRes();
    const next: NextFunction = (err?: unknown) => {
      resolve({ error: err });
    };
    middleware(req, res, next);
  });
}

// --- Tests ---

describe('RBAC Roles and Permissions', () => {
  describe('UserRole enum (Requirement 2.1)', () => {
    it('should define at least three roles: USER, PREMIUM, ADMIN', () => {
      expect(UserRole.USER).toBe('user');
      expect(UserRole.PREMIUM).toBe('premium');
      expect(UserRole.ADMIN).toBe('admin');
    });
  });

  describe('rolePermissions mapping (Requirement 2.3)', () => {
    it('should define permissions for all roles', () => {
      expect(rolePermissions[UserRole.USER]).toBeDefined();
      expect(rolePermissions[UserRole.PREMIUM]).toBeDefined();
      expect(rolePermissions[UserRole.ADMIN]).toBeDefined();
    });

    it('USER should have basic read/write permissions but not admin', () => {
      const perms = rolePermissions[UserRole.USER];
      expect(perms).toContain(Permission.READ_STOCKS);
      expect(perms).toContain(Permission.READ_PORTFOLIO);
      expect(perms).toContain(Permission.WRITE_PORTFOLIO);
      expect(perms).not.toContain(Permission.ADMIN_USERS);
      expect(perms).not.toContain(Permission.ADMIN_SYSTEM);
      expect(perms).not.toContain(Permission.READ_ANALYSIS);
    });

    it('PREMIUM should have analysis permissions but not admin', () => {
      const perms = rolePermissions[UserRole.PREMIUM];
      expect(perms).toContain(Permission.READ_ANALYSIS);
      expect(perms).toContain(Permission.WRITE_ANALYSIS);
      expect(perms).not.toContain(Permission.ADMIN_USERS);
      expect(perms).not.toContain(Permission.ADMIN_SYSTEM);
    });

    it('ADMIN should have all permissions including admin', () => {
      const perms = rolePermissions[UserRole.ADMIN];
      for (const perm of Object.values(Permission)) {
        expect(perms).toContain(perm);
      }
    });
  });

  describe('roleHasPermission helper', () => {
    it('should return true when role has the permission', () => {
      expect(roleHasPermission(UserRole.ADMIN, Permission.ADMIN_USERS)).toBe(true);
      expect(roleHasPermission(UserRole.USER, Permission.READ_STOCKS)).toBe(true);
    });

    it('should return false when role lacks the permission', () => {
      expect(roleHasPermission(UserRole.USER, Permission.ADMIN_USERS)).toBe(false);
      expect(roleHasPermission(UserRole.PREMIUM, Permission.ADMIN_SYSTEM)).toBe(false);
    });
  });

  describe('getEffectivePermissions helper (Requirement 2.5)', () => {
    it('should return base role permissions when no extras', () => {
      const perms = getEffectivePermissions(UserRole.USER);
      expect(perms).toEqual(expect.arrayContaining(rolePermissions[UserRole.USER]));
    });

    it('should merge extra permissions with role permissions', () => {
      const extra = ['custom:feature'];
      const perms = getEffectivePermissions(UserRole.USER, extra);
      expect(perms).toContain('custom:feature');
      expect(perms).toContain(Permission.READ_STOCKS);
    });

    it('should deduplicate permissions', () => {
      const extra = [Permission.READ_STOCKS]; // already in USER role
      const perms = getEffectivePermissions(UserRole.USER, extra);
      const count = perms.filter((p) => p === Permission.READ_STOCKS).length;
      expect(count).toBe(1);
    });
  });
});

describe('requirePermission middleware (Requirement 2.2, 2.4)', () => {
  it('should call next() when user has the required permission', async () => {
    const middleware = requirePermission(Permission.READ_STOCKS);
    const req = mockReq({ id: '1', email: 'a@b.com', role: UserRole.USER });
    const result = await callMiddleware(middleware, req);
    expect(result.error).toBeUndefined();
  });

  it('should return ForbiddenError when user lacks the required permission', async () => {
    const middleware = requirePermission(Permission.ADMIN_USERS);
    const req = mockReq({ id: '1', email: 'a@b.com', role: UserRole.USER });
    const result = await callMiddleware(middleware, req);
    expect(result.error).toBeInstanceOf(ForbiddenError);
    expect((result.error as ForbiddenError).statusCode).toBe(403);
  });

  it('should return ForbiddenError when no user is present', async () => {
    const middleware = requirePermission(Permission.READ_STOCKS);
    const req = mockReq(undefined);
    const result = await callMiddleware(middleware, req);
    expect(result.error).toBeInstanceOf(ForbiddenError);
  });

  it('should check ALL required permissions (AND logic)', async () => {
    const middleware = requirePermission(Permission.READ_STOCKS, Permission.ADMIN_USERS);
    const req = mockReq({ id: '1', email: 'a@b.com', role: UserRole.USER });
    const result = await callMiddleware(middleware, req);
    // USER has READ_STOCKS but not ADMIN_USERS
    expect(result.error).toBeInstanceOf(ForbiddenError);
  });

  it('should allow ADMIN to access admin-only permissions', async () => {
    const middleware = requirePermission(Permission.ADMIN_USERS, Permission.ADMIN_SYSTEM);
    const req = mockReq({ id: '1', email: 'admin@b.com', role: UserRole.ADMIN });
    const result = await callMiddleware(middleware, req);
    expect(result.error).toBeUndefined();
  });

  it('should default to USER role when role is not set', async () => {
    const middleware = requirePermission(Permission.READ_STOCKS);
    const req = mockReq({ id: '1', email: 'a@b.com' }); // no role
    const result = await callMiddleware(middleware, req);
    expect(result.error).toBeUndefined();
  });

  it('should respect extra custom permissions on the user', async () => {
    const middleware = requirePermission(Permission.READ_ANALYSIS);
    // USER doesn't have READ_ANALYSIS by default, but we add it as extra
    const req = mockReq({
      id: '1',
      email: 'a@b.com',
      role: UserRole.USER,
      permissions: [Permission.READ_ANALYSIS],
    });
    const result = await callMiddleware(middleware, req);
    expect(result.error).toBeUndefined();
  });

  it('should include missing permissions in error message', async () => {
    const middleware = requirePermission(Permission.ADMIN_USERS, Permission.ADMIN_SYSTEM);
    const req = mockReq({ id: '1', email: 'a@b.com', role: UserRole.USER });
    const result = await callMiddleware(middleware, req);
    const err = result.error as ForbiddenError;
    expect(err.message).toContain(Permission.ADMIN_USERS);
    expect(err.message).toContain(Permission.ADMIN_SYSTEM);
  });
});

describe('requireRole middleware (Requirement 2.2, 2.4)', () => {
  it('should call next() when user has one of the allowed roles', async () => {
    const middleware = requireRole(UserRole.ADMIN, UserRole.PREMIUM);
    const req = mockReq({ id: '1', email: 'a@b.com', role: UserRole.ADMIN });
    const result = await callMiddleware(middleware, req);
    expect(result.error).toBeUndefined();
  });

  it('should return ForbiddenError when user role is not in allowed list', async () => {
    const middleware = requireRole(UserRole.ADMIN);
    const req = mockReq({ id: '1', email: 'a@b.com', role: UserRole.USER });
    const result = await callMiddleware(middleware, req);
    expect(result.error).toBeInstanceOf(ForbiddenError);
    expect((result.error as ForbiddenError).statusCode).toBe(403);
  });

  it('should return ForbiddenError when no user is present', async () => {
    const middleware = requireRole(UserRole.USER);
    const req = mockReq(undefined);
    const result = await callMiddleware(middleware, req);
    expect(result.error).toBeInstanceOf(ForbiddenError);
  });

  it('should default to USER role when role is not set', async () => {
    const middleware = requireRole(UserRole.USER);
    const req = mockReq({ id: '1', email: 'a@b.com' }); // no role
    const result = await callMiddleware(middleware, req);
    expect(result.error).toBeUndefined();
  });

  it('should include required roles in error message', async () => {
    const middleware = requireRole(UserRole.ADMIN, UserRole.PREMIUM);
    const req = mockReq({ id: '1', email: 'a@b.com', role: UserRole.USER });
    const result = await callMiddleware(middleware, req);
    const err = result.error as ForbiddenError;
    expect(err.message).toContain(UserRole.ADMIN);
    expect(err.message).toContain(UserRole.PREMIUM);
  });
});
