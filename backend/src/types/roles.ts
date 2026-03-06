/**
 * RBAC Role and Permission definitions
 * Requirements: 2.1, 2.2, 2.3, 2.5
 */

// User roles - at least three: regular user, premium user, admin
export enum UserRole {
  USER = 'user',
  PREMIUM = 'premium',
  ADMIN = 'admin',
}

// Fine-grained permissions for API endpoints
export enum Permission {
  READ_STOCKS = 'read:stocks',
  READ_PORTFOLIO = 'read:portfolio',
  WRITE_PORTFOLIO = 'write:portfolio',
  READ_WATCHLIST = 'read:watchlist',
  WRITE_WATCHLIST = 'write:watchlist',
  READ_ANALYSIS = 'read:analysis',
  WRITE_ANALYSIS = 'write:analysis',
  ADMIN_USERS = 'admin:users',
  ADMIN_SYSTEM = 'admin:system',
}

// Role-to-permissions mapping: each role inherits permissions cumulatively
export const rolePermissions: Record<UserRole, Permission[]> = {
  [UserRole.USER]: [
    Permission.READ_STOCKS,
    Permission.READ_PORTFOLIO,
    Permission.WRITE_PORTFOLIO,
    Permission.READ_WATCHLIST,
    Permission.WRITE_WATCHLIST,
  ],
  [UserRole.PREMIUM]: [
    Permission.READ_STOCKS,
    Permission.READ_PORTFOLIO,
    Permission.WRITE_PORTFOLIO,
    Permission.READ_WATCHLIST,
    Permission.WRITE_WATCHLIST,
    Permission.READ_ANALYSIS,
    Permission.WRITE_ANALYSIS,
  ],
  [UserRole.ADMIN]: [
    Permission.READ_STOCKS,
    Permission.READ_PORTFOLIO,
    Permission.WRITE_PORTFOLIO,
    Permission.READ_WATCHLIST,
    Permission.WRITE_WATCHLIST,
    Permission.READ_ANALYSIS,
    Permission.WRITE_ANALYSIS,
    Permission.ADMIN_USERS,
    Permission.ADMIN_SYSTEM,
  ],
};

/**
 * Check if a role has a specific permission.
 */
export function roleHasPermission(role: UserRole, permission: Permission): boolean {
  const permissions = rolePermissions[role];
  return permissions ? permissions.includes(permission) : false;
}

/**
 * Get all permissions for a role, including any extra custom permissions.
 */
export function getEffectivePermissions(role: UserRole, extraPermissions: string[] = []): string[] {
  const base = rolePermissions[role] || [];
  const combined = new Set<string>([...base, ...extraPermissions]);
  return Array.from(combined);
}
