import assert from 'node:assert/strict';
import {SYSTEMS,normalizeAccess,hasStageAccess} from './accessPolicy.mjs';
const user={role:'User',status:'Active',systemAccess:{make:false,technical:false,repair:true},permissions:{'repair-approval':{view:true,update:false},'repair-work':{view:true,update:true},requests:{view:true,update:true}}};
assert.equal(hasStageAccess(user,'requests'),false);
assert.equal(hasStageAccess(user,'repair-system'),true);
assert.equal(hasStageAccess(user,'repair-system','update'),false);
assert.equal(hasStageAccess(user,'repair-problem','update'),true);
assert.equal(hasStageAccess(user,'repair-problem','edit'),false);
assert.equal(hasStageAccess(user,'admin'),false);
assert.deepEqual(SYSTEMS.filter(s=>s.stages.some(id=>hasStageAccess(user,id))).map(s=>s.id),['repair']);
// A PMMPL-prefixed password no longer restricts anyone: access comes only from the saved permissions.
const pmmpl={...user,password:'PMMPL123'};
assert.equal(hasStageAccess(pmmpl,'repair-system'),true);
assert.equal(hasStageAccess(pmmpl,'technical-new'),false);
assert.equal(hasStageAccess({...pmmpl,role:'Admin'},'admin'),true);
assert.equal(hasStageAccess({...user,status:'Inactive'},'repair-problem'),false);
assert.equal(hasStageAccess({role:'Admin',status:'Active'},'admin'),true);
assert.equal(normalizeAccess({role:'User',permissions:{create:{view:true,edit:true}}}).permissions.create.update,false);
console.log('PASS: three-system isolation, aliases, View/Update separation, admin-only edit, inactive users, legacy migration and no password-based restriction.');

const legacyAssignmentUser = { role: 'DME', status: 'Active', permissions: { introduce: { view: true, update: true } } };
assert.equal(hasStageAccess(legacyAssignmentUser, 'assign', 'update'), true, 'Existing assignment access must survive the rename');
assert.equal(hasStageAccess({ ...legacyAssignmentUser, permissions: { ...legacyAssignmentUser.permissions, assign: { view: false, update: false } } }, 'assign'), false, 'Explicit assignment permissions override legacy fallback');
assert.equal(hasStageAccess({ ...legacyAssignmentUser, systemAccess: { make: false } }, 'assign'), false);
console.log('PASS: legacy assignment access migrates while explicit stage and system restrictions remain effective.');
