import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { webcrypto } from 'node:crypto';
import * as workflow from '../utils/repairWorkflow.mjs';
import {hasStageAccess} from '../utils/accessPolicy.mjs';

const values = new Map();
let lockQueue = Promise.resolve();
const context = {
  authService: {canAccessStage:hasStageAccess},
  isTechnicalOnlyUser: user => Boolean(user?.technicalOnly),
  repairSheetConnected: () => false, repairSheetAdapter: {},
  ...workflow, REPAIR_CONFIG: { permissionStages: { assessment: 'repair-approval', repair: 'repair-work', acknowledge: 'repair-management' } },
  localStorage: { getItem: key => values.get(key), setItem: (key, value) => values.set(key, value) },
  navigator: { locks: { request: (_key, action) => { const result = lockQueue.then(action); lockQueue = result.catch(() => {}); return result; } } },
  crypto: webcrypto, structuredClone
};
const source = fs.readFileSync(new URL('./repairService.js', import.meta.url), 'utf8').replace(/^import .*;\r?\n/gm, '').replace(/export /g, '');
vm.createContext(context);
vm.runInContext(`${source}\nglobalThis.service = repairService; globalThis.demoMode = enableRepairDemo; globalThis.allowed = canRepairAction;`, context);
const user = { id: 'requester', role: 'User', status: 'Active', fullName: 'Requester', permissions: { 'repair-new': { view: true, update:true } } };
const admin = { ...user, id: 'admin', role: 'Admin' };
const data = { requester: 'Person', company: 'RKL', description: 'Not working' };
await assert.rejects(context.service.createIssue(data, user, 'first'), /not configured/);
context.demoMode();
const created = await Promise.all([context.service.createIssue(data, user, 'first'), context.service.createIssue(data, user, 'first'), context.service.createIssue(data, user, 'second')]);
assert.equal(created[0].id, created[1].id);
assert.equal(created[0].serial, 'RS - 001');
assert.equal(created[2].serial, 'RS - 002');
assert.equal((await context.service.listIssues()).length, 2);
await assert.rejects(context.service.submitAssessment(created[0].id, { repairRequired: 'Yes', whereToSolve: 'Workshop' }, user, 1), /permission/);
assert.equal(context.allowed({ ...user, permissions: { 'repair-approval': { view: true } } }, 'assessment'), false);
assert.equal(context.allowed({ ...user, permissions: { 'repair-approval': { view: true, update:true } } }, 'assessment'), true);
const approved = await context.service.submitAssessment(created[0].id, { repairRequired: 'Yes', whereToSolve: 'Workshop' }, admin, 1);
await assert.rejects(context.service.completeRepair(approved.id, {}, admin, 1), /changed/);
const repaired = await context.service.completeRepair(approved.id, { remarks: 'Fixed' }, admin, approved.version);
const done = await context.service.acknowledgeCompletion(repaired.id, admin, repaired.version);
assert.equal(workflow.overallStatus(done), 'Completed');
await assert.rejects(context.service.acknowledgeCompletion(done.id, admin, done.version), /not eligible/);
const summary = await context.service.getDashboardSummary();
assert.equal(summary.Completed, 1);
assert.equal(summary['Pending Approval'], 1);
assert.equal((await context.service.getMISReport()).length, 6);
console.log('PASS: unconfigured mode, demo serial locking, idempotency, permissions, stale updates, completion and MIS.');
