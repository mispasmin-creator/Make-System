export const SYSTEMS = [
  { id: 'make', label: 'Make System', stages: ['requests', 'introduce', 'create', 'mis'] },
  { id: 'technical', label: 'Technical Help', stages: ['technical-new', 'technical-all'] },
  { id: 'repair', label: 'Repair System', stages: ['repair-new', 'repair-approval', 'repair-work'] }
];
export const STAGE_ALIASES = { 'repair-system': 'repair-approval', 'repair-problem': 'repair-work' };
export function normalizeAccess(user) {
  const restricted = Boolean(user.technicalOnly || String(user.password || '').startsWith('PMMPL'));
  const admin = user.role === 'Admin' && !restricted;
  const permissions = {};
  const systemAccess = {};
  for (const system of SYSTEMS) {
    const enabled = restricted ? system.id === 'technical' : admin || (user.systemAccess?.[system.id] ?? system.stages.some(id => user.permissions?.[id]?.view));
    systemAccess[system.id] = Boolean(enabled);
    for (const id of system.stages) {
      const old = user.permissions?.[id] || {};
      const view = enabled && (restricted ? true : admin || Boolean(old.view));
      const update = view && (restricted ? id === 'technical-new' : admin || Boolean(old.update));
      permissions[id] = { view: Boolean(view), update: Boolean(update), edit: admin, approve: Boolean(update) };
    }
  }
  return { ...user, technicalOnly: restricted, systemAccess, permissions };
}
export function hasStageAccess(user, stageId, action = 'view') {
  if (!user || user.status !== 'Active') return false;
  const access = normalizeAccess(user);
  if (stageId === 'admin') return user.role === 'Admin' && !access.technicalOnly;
  const id = STAGE_ALIASES[stageId] || stageId;
  const perm = access.permissions[id];
  if (!perm?.view) return false;
  if (action === 'edit') return user.role === 'Admin' && !access.technicalOnly;
  return action === 'view' ? true : Boolean(perm.update);
}
