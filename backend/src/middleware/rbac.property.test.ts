/**
 * Property-Based Tests for RBAC Permission System
 * Feature: project-review-and-upgrade
 *
 * **Property 2: RBAC权限验证正确性**
 * **Property 3: 角色修改即时生效**
 * **Validates: Requirements 2.2, 2.4, 2.6**
 */

import fc from 'fast-check';
import { Request, Response, NextFunction } from 'express';
import { requirePermission, requireRole } from './rbac.js';
import {
  UserRole,
  Permission,
  rolePermissions,
  roleHasPermission,
  getEffectivePermissions,
} from '../types/roles.js';
import { ForbiddenError } from './errorHandler.js';

// --- Mock logger ---
jest.mock('../utils/logger.js', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

// --- Constants ---
const ALL_ROLES = Object.values(UserRole);
const ALL_PERMISSIONS = Object.values(Permission);

// --- Helpers ---

function mockReq(user?: {
  id: string;
  email: string;
  role?: UserRole;
  permissions?: string[];
}): Request {
  return { user } as unknown as Request;
}

function mockRes(): Response {
  return {} as unknown as Response;
}

/**
 * Run a middleware and capture the result (error or success).
 */
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

// --- Arbitraries ---

/** Arbitrary for a single UserRole */
const roleArb = fc.constantFrom(...ALL_ROLES);

/** Arbitrary for a single Permission */
const permissionArb = fc.constantFrom(...ALL_PERMISSIONS);

/** Arbitrary for a non-empty subset of permissions (1 to all) */
const permissionSubsetArb = fc
  .subarray(ALL_PERMISSIONS, { minLength: 1 })
  .filter((arr) => arr.length > 0);

/** Arbitrary for a user with a given role and optional extra permissions */
const userArb = fc.record({
  id: fc.uuid(),
  email: fc.emailAddress(),
  role: roleArb,
  extraPermissions: fc.subarray(ALL_PERMISSIONS, { minLength: 0 }),
});

// --- Property 2: RBAC权限验证正确性 ---

describe('Property 2: RBAC权限验证正确性', () => {
  /**
   * For any user role and any set of required permissions, the requirePermission
   * middleware should grant access if and only if the user has ALL required permissions.
   * Otherwise it should return a 403 ForbiddenError.
   *
   * **Validates: Requirements 2.2, 2.4**
   */
  it('should grant access iff user has all required permissions (requirePermission)', async () => {
    await fc.assert(
      fc.asyncProperty(
        userArb,
        permissionSubsetArb,
        async ({ id, email, role, extraPermissions }, requiredPermissions) => {
          const effectivePermissions = getEffectivePermissions(role, extraPermissions);
          const hasAll = requiredPermissions.every((p) =>
            effectivePermissions.includes(p)
          );

          const middleware = requirePermission(...requiredPermissions);
          const req = mockReq({
            id,
            email,
            role,
            permissions: extraPermissions,
          });
          const result = await callMiddleware(middleware, req);

          if (hasAll) {
            // Access should be granted
            expect(result.error).toBeUndefined();
          } else {
            // Access should be denied with 403
            expect(result.error).toBeInstanceOf(ForbiddenError);
            expect((result.error as ForbiddenError).statusCode).toBe(403);
            // Error message should be non-empty
            expect((result.error as ForbiddenError).message.length).toBeGreaterThan(0);
          }
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * For any user role and any set of allowed roles, the requireRole middleware
   * should grant access if and only if the user's role is in the allowed set.
   * Otherwise it should return a 403 ForbiddenError.
   *
   * **Validates: Requirements 2.2, 2.4**
   */
  it('should grant access iff user role is in the allowed roles (requireRole)', async () => {
    await fc.assert(
      fc.asyncProperty(
        roleArb,
        fc.subarray(ALL_ROLES, { minLength: 1 }).filter((arr) => arr.length > 0),
        async (userRole, allowedRoles) => {
          const shouldAllow = allowedRoles.includes(userRole);

          const middleware = requireRole(...allowedRoles);
          const req = mockReq({
            id: 'test-user',
            email: 'test@example.com',
            role: userRole,
          });
          const result = await callMiddleware(middleware, req);

          if (shouldAllow) {
            expect(result.error).toBeUndefined();
          } else {
            expect(result.error).toBeInstanceOf(ForbiddenError);
            expect((result.error as ForbiddenError).statusCode).toBe(403);
            expect((result.error as ForbiddenError).message.length).toBeGreaterThan(0);
          }
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * For any user without authentication (no user object), both requirePermission
   * and requireRole should always return 403.
   *
   * **Validates: Requirements 2.2, 2.4**
   */
  it('should always deny access when no user is present', async () => {
    await fc.assert(
      fc.asyncProperty(
        permissionSubsetArb,
        async (requiredPermissions) => {
          const middleware = requirePermission(...requiredPermissions);
          const req = mockReq(undefined);
          const result = await callMiddleware(middleware, req);

          expect(result.error).toBeInstanceOf(ForbiddenError);
          expect((result.error as ForbiddenError).statusCode).toBe(403);
        }
      ),
      { numRuns: 20 }
    );
  });
});

// --- Property 3: 角色修改即时生效 ---

describe('Property 3: 角色修改即时生效', () => {
  /**
   * For any user role change, the middleware should immediately reflect the new
   * role's permissions without any caching of the old role. After changing a user's
   * role on the request object, subsequent middleware calls should use the new
   * role's permissions.
   *
   * **Validates: Requirements 2.6**
   */
  it('should immediately reflect new permissions after role change', async () => {
    await fc.assert(
      fc.asyncProperty(
        roleArb,
        roleArb,
        permissionSubsetArb,
        async (oldRole, newRole, requiredPermissions) => {
          const middleware = requirePermission(...requiredPermissions);

          // Step 1: Check access with old role
          const reqOld = mockReq({
            id: 'role-change-user',
            email: 'change@example.com',
            role: oldRole,
            permissions: [],
          });
          const resultOld = await callMiddleware(middleware, reqOld);

          const oldEffective = getEffectivePermissions(oldRole, []);
          const oldHasAll = requiredPermissions.every((p) => oldEffective.includes(p));

          if (oldHasAll) {
            expect(resultOld.error).toBeUndefined();
          } else {
            expect(resultOld.error).toBeInstanceOf(ForbiddenError);
          }

          // Step 2: Change role to newRole (simulating admin modifying user role)
          // Step 3: Check access with new role — should immediately reflect new permissions
          const reqNew = mockReq({
            id: 'role-change-user',
            email: 'change@example.com',
            role: newRole,
            permissions: [],
          });
          const resultNew = await callMiddleware(middleware, reqNew);

          const newEffective = getEffectivePermissions(newRole, []);
          const newHasAll = requiredPermissions.every((p) => newEffective.includes(p));

          if (newHasAll) {
            expect(resultNew.error).toBeUndefined();
          } else {
            expect(resultNew.error).toBeInstanceOf(ForbiddenError);
          }
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * For any role transition (upgrade or downgrade), the requireRole middleware
   * should immediately use the new role without any stale state.
   *
   * **Validates: Requirements 2.6**
   */
  it('should immediately use new role in requireRole after role change', async () => {
    await fc.assert(
      fc.asyncProperty(
        roleArb,
        roleArb,
        fc.subarray(ALL_ROLES, { minLength: 1 }).filter((arr) => arr.length > 0),
        async (oldRole, newRole, allowedRoles) => {
          // Step 1: Check with old role
          const middlewareRole = requireRole(...allowedRoles);

          const reqOld = mockReq({
            id: 'role-change-user',
            email: 'change@example.com',
            role: oldRole,
          });
          const resultOld = await callMiddleware(middlewareRole, reqOld);

          if (allowedRoles.includes(oldRole)) {
            expect(resultOld.error).toBeUndefined();
          } else {
            expect(resultOld.error).toBeInstanceOf(ForbiddenError);
          }

          // Step 2: Change role and check again — must reflect immediately
          const reqNew = mockReq({
            id: 'role-change-user',
            email: 'change@example.com',
            role: newRole,
          });
          const resultNew = await callMiddleware(middlewareRole, reqNew);

          if (allowedRoles.includes(newRole)) {
            expect(resultNew.error).toBeUndefined();
          } else {
            expect(resultNew.error).toBeInstanceOf(ForbiddenError);
          }
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * For any role change, the roleHasPermission function should immediately
   * return the correct result for the new role, proving there is no stale
   * permission caching at the data layer.
   *
   * **Validates: Requirements 2.6**
   */
  it('should have no stale permission caching in roleHasPermission', async () => {
    await fc.assert(
      fc.asyncProperty(
        roleArb,
        roleArb,
        permissionArb,
        async (oldRole, newRole, permission) => {
          // Check old role
          const oldResult = roleHasPermission(oldRole, permission);
          const oldExpected = rolePermissions[oldRole].includes(permission);
          expect(oldResult).toBe(oldExpected);

          // Check new role — should immediately reflect new role's permissions
          const newResult = roleHasPermission(newRole, permission);
          const newExpected = rolePermissions[newRole].includes(permission);
          expect(newResult).toBe(newExpected);
        }
      ),
      { numRuns: 20 }
    );
  });
});
