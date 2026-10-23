import { User } from '../../types';

type AccessRole = { name: string; permissions: string[] };
export function canAccessAdminPanel(communityId: string, user: User, creatorId?: string) {
  try {
    const saved = JSON.parse(localStorage.getItem(`koaline:admin:${communityId}`) || '{}');
    if ((saved.ownerId || creatorId) && (saved.ownerId || creatorId) === user.id) return true;
    const roles: AccessRole[] = saved.roles || [];
    const assigned: string[] = saved.memberRoles?.[user.id] || [];
    return roles.some((role) => assigned.includes((role as AccessRole & { id: string }).id) && (role.name.toLowerCase() === 'admin' || role.permissions.length > 0));
  } catch { return creatorId === user.id; }
}
