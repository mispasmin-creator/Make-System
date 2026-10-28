import { SYSTEMS } from './accessPolicy.mjs';

export const ROLE_OPTIONS = ['User', 'EA', 'DME', 'Admin'];

const STAGE_IDS = SYSTEMS.flatMap(system => system.stages);

const entry = (view, update) => ({ view: Boolean(view), update: Boolean(view && update), edit: false, approve: Boolean(view && update) });

export function fullAccessPermissions() {
  return Object.fromEntries(STAGE_IDS.map(id => [id, { view: true, update: true, edit: true, approve: true }]));
}

// Roles carry no default pages: only Admin is full access, everyone else starts with nothing and gets pages
// from the Permissions table (or Bulk Access).
export function presetPermissions(role) {
  if (role === 'Admin') return fullAccessPermissions();
  return Object.fromEntries(STAGE_IDS.map(id => [id, entry(false, false)]));
}

// A system is on when at least one of its pages can be viewed.
export function deriveSystemAccess(permissions) {
  return Object.fromEntries(SYSTEMS.map(system => [system.id, system.stages.some(id => permissions?.[id]?.view)]));
}

/**
 * Bulk access change for one user.
 * change = { role?: string, mode: 'add' | 'replace' | 'remove', stages: { [stageId]: { view, update } } }
 * Admin accounts always keep full access, so they are skipped (null).
 */
export function applyBulkAccess(user, change) {
  if (user.role === 'Admin' && !change.role) return null;
  const role = change.role || user.role;
  if (role === 'Admin') return { role, permissions: fullAccessPermissions(), systemAccess: Object.fromEntries(SYSTEMS.map(s => [s.id, true])) };
  const base = user.role === 'Admin' ? {} : (user.permissions || {});
  const permissions = {};
  for (const id of STAGE_IDS) {
    const old = base[id] || {};
    const picked = change.stages?.[id] || {};
    const wantsView = Boolean(picked.view || picked.update);
    let view = Boolean(old.view), update = Boolean(old.update);
    if (change.mode === 'replace') { view = wantsView; update = Boolean(picked.update); }
    else if (change.mode === 'add' && wantsView) { view = true; update = update || Boolean(picked.update); }
    else if (change.mode === 'remove') {
      if (picked.view) { view = false; update = false; }
      else if (picked.update) update = false;
    }
    permissions[id] = entry(view, update);
  }
  return { role, permissions, systemAccess: deriveSystemAccess(permissions) };
}
