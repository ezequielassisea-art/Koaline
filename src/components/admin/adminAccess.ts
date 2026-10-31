import { User } from '../../types';

type AccessRole = { id: string; name: string; permissions: string[] };

export function canDeleteCommunityChannel(communityId: string, user: User, communityOwnerId?: string, channelOwnerId?: string) {
  if (!user.id) return false;
  if (user.id === channelOwnerId || user.id === communityOwnerId) return true;
  try {
    const saved = JSON.parse(localStorage.getItem(`koaline:admin:${communityId}`) || '{}');
    if (saved.ownerId === user.id) return true;
    const roles: AccessRole[] = saved.roles || [];
    const assigned: string[] = saved.memberRoles?.[user.id] || [];
    return roles.some((role) => assigned.includes(role.id) && /^(adm|admin|administrador)$/i.test(role.name.trim()));
  } catch { return false; }
}
export function canAccessAdminPanel(communityId: string, user: User, creatorId?: string) {
  try {
    const saved = JSON.parse(localStorage.getItem(`koaline:admin:${communityId}`) || '{}');
    if ((saved.ownerId || creatorId) && (saved.ownerId || creatorId) === user.id) return true;
    const roles: AccessRole[] = saved.roles || [];
    const assigned: string[] = saved.memberRoles?.[user.id] || [];
    return roles.some((role) => assigned.includes((role as AccessRole & { id: string }).id) && (role.name.toLowerCase() === 'admin' || role.permissions.length > 0));
  } catch { return creatorId === user.id; }
}

export function canModerateCommunity(communityId: string, user: User, creatorId?: string) {
  if (creatorId && creatorId === user.id) return true;
  try {
    const saved = JSON.parse(localStorage.getItem(`koaline:admin:${communityId}`) || '{}');
    if (saved.ownerId && saved.ownerId === user.id) return true;
    const roles: Array<{ id: string; name: string; permissions: string[] }> = saved.roles || [];
    const assigned: string[] = saved.memberRoles?.[user.id] || [];
    return roles.some((role) => assigned.includes(role.id) && (
      /admin|mod/i.test(role.name) || role.permissions.some((permission) => ['members', 'kick', 'ban'].includes(permission))
    ));
  } catch {
    return creatorId === user.id;
  }
}
