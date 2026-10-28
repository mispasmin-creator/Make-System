import assert from 'node:assert/strict';
import { presetPermissions, deriveSystemAccess, applyBulkAccess, ROLE_OPTIONS } from './accessPresets.mjs';

assert.deepEqual(ROLE_OPTIONS, ['User', 'EA', 'DME', 'Admin']);
// Roles carry no default pages: only Admin is pre-filled.
for (const role of ['User', 'EA', 'DME']) {
  const none = presetPermissions(role);
  assert(Object.values(none).every(p => !p.view && !p.update), role + ' starts with nothing ticked');
  assert.deepEqual(deriveSystemAccess(none), { make: false, technical: false, repair: false });
}
assert.equal(presetPermissions('Admin').mis.edit, true);
const user = { 'technical-new': { view: true, update: true }, 'technical-all': { view: true, update: false }, 'repair-new': { view: true, update: true } };

const worker = { role: 'User', permissions: user };
// add: keeps what they already have and grants more
const added = applyBulkAccess(worker, { mode: 'add', stages: { requests: { view: true }, 'technical-all': { update: true } } });
assert.equal(added.permissions.requests.view, true);
assert.equal(added.permissions['technical-all'].update, true);
assert.equal(added.permissions['repair-new'].update, true);
assert.equal(added.systemAccess.make, true);
// replace: only the ticked pages remain
const replaced = applyBulkAccess(worker, { mode: 'replace', stages: { create: { view: true } } });
assert.equal(replaced.permissions.create.view, true);
assert.equal(replaced.permissions['technical-new'].view, false);
assert.deepEqual(replaced.systemAccess, { make: true, technical: false, repair: false });
// remove: view removal drops update too; update-only removal keeps view
const removed = applyBulkAccess(worker, { mode: 'remove', stages: { 'technical-new': { view: true }, 'repair-new': { update: true } } });
assert.equal(removed.permissions['technical-new'].view, false);
assert.equal(removed.permissions['technical-new'].update, false);
assert.equal(removed.permissions['repair-new'].view, true);
assert.equal(removed.permissions['repair-new'].update, false);
// role change through bulk; Admins are untouched unless the role itself changes
assert.equal(applyBulkAccess({ role: 'Admin', permissions: {} }, { mode: 'add', stages: {} }), null);
assert.equal(applyBulkAccess(worker, { role: 'Admin', mode: 'add', stages: {} }).permissions.mis.edit, true);
assert.equal(applyBulkAccess({ role: 'Admin' }, { role: 'DME', mode: 'replace', stages: { create: { view: true, update: true } } }).permissions.create.update, true);
console.log('PASS: role presets, derived system access and bulk add/replace/remove.');
