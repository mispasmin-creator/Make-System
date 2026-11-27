import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { parse } from '@babel/parser';
import * as constants from '../constants/stages.js';
import { normalizeSystemRequest } from '../utils/systemWorkflow.mjs';
import { sortNewestFirst } from '../utils/sortUtils.js';

const legacyAudit = { introduction: { isCompleted: false, remarks: 'Historical scope' }, attachments: [{ id: 'original-file' }], activityLog: [{ action: 'Original event' }] };
const migrated = normalizeSystemRequest({ ...legacyAudit, currentStage: constants.STAGES.INTRODUCE });
assert.equal(migrated.currentStage, constants.STAGES.ASSIGN);
assert.deepEqual(migrated.introduction, legacyAudit.introduction);
assert.deepEqual(migrated.attachments, legacyAudit.attachments);
assert.deepEqual(migrated.activityLog, legacyAudit.activityLog);
assert.equal(normalizeSystemRequest({ currentStage: constants.STAGES.UPDATE_MIS }).currentStage, constants.STAGES.UPDATE_MIS);
assert.equal(normalizeSystemRequest({ currentStage: constants.STAGES.CLOSED }).currentStage, constants.STAGES.CLOSED);
const sheetRolledBack = normalizeSystemRequest({
  currentStage: constants.STAGES.CREATE,
  currentStatus: 'Development: In Progress',
  workStatus: constants.WORK_STATUS.IN_PROGRESS,
  workflowVersion: 2,
  sheetWorkflowAuthoritative: true,
  misUpdate: { isCompleted: true }
});
assert.equal(sheetRolledBack.currentStage, constants.STAGES.CREATE, 'stale MIS metadata cannot override an authoritative sheet rollback');
const sm0065SheetShape = normalizeSystemRequest({
  requestNo: 'SM-0065',
  sheetRowIndex: 71,
  currentStage: constants.STAGES.INTRODUCE,
  workStatus: constants.WORK_STATUS.COMPLETED,
  progressPercent: 100,
  actualCreateDate: '',
  introduction: { isCompleted: true },
  systemIntroduction: { isCompleted: true },
  misUpdate: { isCompleted: true }
});
assert.equal(sm0065SheetShape.currentStage, constants.STAGES.CREATE);
assert.equal(sm0065SheetShape.workStatus, constants.WORK_STATUS.IN_PROGRESS);
assert.equal(sm0065SheetShape.progressPercent < 100, true);
assert.equal(sm0065SheetShape.latestRemarks, 'Moved back to Create System.');
assert.equal(sm0065SheetShape.systemIntroduction.isCompleted, false);
assert.equal(sm0065SheetShape.misUpdate.isCompleted, false);
const ordinaryCreatePending = normalizeSystemRequest({
  requestNo: 'SM-NORMAL',
  sheetRowIndex: 72,
  currentStage: constants.STAGES.CREATE,
  workStatus: constants.WORK_STATUS.IN_PROGRESS,
  progressPercent: 0,
  actualCreateDate: '',
  introduction: { isCompleted: true },
  latestRemarks: 'Requirements assigned to developer.'
});
assert.equal(ordinaryCreatePending.latestRemarks, 'Requirements assigned to developer.', 'normal Create Pending rows must not receive a rollback remark');
const pollutedCreatePending = normalizeSystemRequest({ ...ordinaryCreatePending, latestRemarks: 'Moved back to Create System.' });
assert.equal(pollutedCreatePending.latestRemarks, '', 'previously over-applied rollback remarks are cleaned from normal rows');
assert.deepEqual(constants.NAV_ITEMS.filter(item => ['requests', 'assign', 'create', 'introduce', 'mis'].includes(item.id)).map(item => item.id), ['requests', 'assign', 'create', 'introduce', 'mis']);
const values = new Map();
let live = false;
let apiPayload;
const apiCalls = [];
const makeRequest = (id, stage, extra = {}) => ({
  id, requestNo: id, currentStage: stage, introduction: { isCompleted: true },
  developmentHistory: [], activityLog: [], testingHistory: [], ...extra,
});
values.set('make_system_requests_v1', JSON.stringify([
  makeRequest('new', constants.STAGES.CREATE),
  makeRequest('legacy-testing', constants.STAGES.TESTING),
  makeRequest('legacy-revise', constants.STAGES.REVISE, { currentRevisionNo: 'REV-01', workStatus: 'In Progress' }),
]));
let source = fs.readFileSync(new URL('./dataService.js', import.meta.url), 'utf8');
const ast = parse(source, { sourceType: 'module' });
for (const node of [...ast.program.body].reverse()) {
  if (node.type === 'ImportDeclaration') source = source.slice(0, node.start) + source.slice(node.end);
}
source = source.replace(/export /g, '');
const context = vm.createContext({
  ...constants, console, sortNewestFirst,
  normalizeLegacyStage: normalizeSystemRequest,
  localStorage: { getItem: key => values.get(key) || null, setItem: (key, value) => values.set(key, value) },
  setTimeout, clearTimeout, AbortController, URLSearchParams,
  isGoogleSheetsConnected: () => live,
  getGoogleAppsScriptUrl: () => 'https://example.test/exec',
  fetch: async (url, options) => {
    const payload = options?.body ? JSON.parse(options.body) : { action: new URL(url).searchParams.get('action') };
    apiCalls.push(payload);
    return { ok: true, json: async () => JSON.parse(JSON.stringify(typeof apiPayload === 'function' ? apiPayload(payload) : apiPayload)) };
  },
  getNowKolkataISO: () => '2026-10-28T12:00:00.000Z',
  formatToKolkataDateString: () => '2026-10-28',
});
vm.runInContext(`${source}\nglobalThis.service = dataService; globalThis.loadRequests = loadStoredRequests;`, context);
assert.equal(context.loadRequests().find(r => r.id === 'legacy-testing').currentStage, constants.STAGES.UPDATE_MIS);
assert.equal(context.loadRequests().find(r => r.id === 'legacy-revise').currentStage, constants.STAGES.CREATE);
for (const id of ['new', 'legacy-revise']) {
  const result = await context.service.updateDevelopmentProgress(id, { workStatus: 'Completed', remarks: 'Finished', systemUrl: 'https://example.test/app' });
  assert.equal(result.currentStage, constants.STAGES.INTRODUCE);
  await assert.rejects(context.service.completeMisUpdate(id, { remarks: 'Too early' }), /pending MIS/);
  const introduced = await context.service.completeIntroduction(id, { remarks: 'Walkthrough and handover complete' });
  assert.equal(introduced.currentStage, constants.STAGES.UPDATE_MIS);
  assert.equal(introduced.systemIntroduction.isCompleted, true);
  assert.equal(introduced.introduction.isCompleted, true, 'Assignment audit survives introduction');
  const saved = context.loadRequests().find(r => r.id === id);
  assert.equal(saved.currentStatus, 'Update MIS: Pending');
  assert.equal(saved.progressPercent, 100);
  assert.equal(saved.systemUrl, 'https://example.test/app');
}
assert(!constants.NAV_ITEMS.some(item => ['testing', 'revise'].includes(item.id)));
console.log('PASS: local completion -> introduction -> MIS, MIS gate, legacy Testing/Revise migration, links preserved, removed pages absent from navigation.');
const created = await context.service.createRequest({ companyName: 'Test Company', systemName: 'New Workflow', businessPurpose: 'Test', assignedDeveloper: 'Developer', targetCompletionDate: '2026-12-01' });
assert.equal(created.currentStage, constants.STAGES.ASSIGN);
const assigned = await context.service.approveIntroduction(created.id, { assignedDeveloper: 'Developer', targetCompletionDate: '2026-12-02', remarks: 'Assignment scope' });
assert.equal(assigned.currentStage, constants.STAGES.CREATE);
await context.service.updateDevelopmentProgress(created.id, { workStatus: 'On Hold', holdReason: 'Dependency', holdExtendTargetDate: '2026-12-03' });
const finished = await context.service.updateDevelopmentProgress(created.id, { workStatus: 'Completed', systemUrl: 'https://example.test/new' });
assert.equal(finished.currentStage, constants.STAGES.INTRODUCE);
assert.equal(finished.holdReason, 'Dependency');
await assert.rejects(context.service.completeIntroduction(created.id, { remarks: ' ' }), /remarks are required/);
await context.service.completeIntroduction(created.id, { remarks: 'Handover complete' });
await assert.rejects(context.service.completeIntroduction(created.id, { remarks: 'Duplicate' }), /pending introduction/);
const closed = await context.service.completeMisUpdate(created.id, { remarks: 'Recorded in MIS' });
assert.equal(closed.currentStage, constants.STAGES.CLOSED);
assert.equal(context.loadRequests().find(r => r.id === created.id).currentStage, constants.STAGES.CLOSED);
assert.equal(closed.introduction.remarks, 'Assignment scope');
assert.equal(closed.systemIntroduction.remarks, 'Handover complete');
console.log('PASS: new request -> assignment -> hold -> development completion -> introduction -> MIS -> closure, audit and hold history preserved.');
live = true;
const oldServerCompleted = makeRequest('live-completed', constants.STAGES.INTRODUCE, { workflowVersion: 2, systemIntroduction: { isCompleted: false }, workStatus: 'Completed', progressPercent: 100 });
values.set('make_system_requests_v1', JSON.stringify([makeRequest('live-completed', constants.STAGES.CREATE, { sheetRowIndex: 12 })]));
apiPayload = { success: true, request: oldServerCompleted, version: 'live-save' };
const liveSaved = await context.service.updateDevelopmentProgress('live-completed', { workStatus: 'Completed' });
assert.equal(apiCalls.at(-1).action, 'completeDevelopment');
assert.equal(apiCalls.at(-1).requestNo, 'live-completed');
assert.equal(apiCalls.at(-1).sheetRowIndex, 12);
assert.equal(liveSaved.currentStage, constants.STAGES.INTRODUCE, 'Live save must retain the separate introduction stage');
assert.equal(liveSaved.allRequests[0].currentStage, constants.STAGES.INTRODUCE);
apiPayload = { requests: [oldServerCompleted], version: 'live-read', hasChanges: true };
assert.equal((await context.service.listRequests())[0].currentStage, constants.STAGES.INTRODUCE);
assert.equal((await context.service.forceSyncFromSheets()).requests[0].currentStage, constants.STAGES.INTRODUCE);
assert.equal((await context.service.checkSync()).requests[0].currentStage, constants.STAGES.INTRODUCE);
console.log('PASS: live completion -> save/list/force-sync/background-sync all retain Introduce Pending.');

assert.equal(apiCalls.find(c => c.action === 'completeDevelopment').data.workflowVersion, 2);
const mislabeled = makeRequest('live-completed', constants.STAGES.UPDATE_MIS, { workflowVersion: 2, systemIntroduction: { isCompleted: false }, workStatus: 'Completed', progressPercent: 100 });
apiPayload = { success: true, request: mislabeled };
assert.equal((await context.service.updateDevelopmentProgress('live-completed', { workStatus: 'Completed' })).currentStage, constants.STAGES.INTRODUCE, 'Versioned completion must not skip introduction even with an older MIS stage label');
apiPayload = { requests: [mislabeled], hasChanges: true, version: 'compat-read' };
assert.equal((await context.service.forceSyncFromSheets()).requests[0].currentStage, constants.STAGES.INTRODUCE);
apiPayload = payload => payload.action === 'completeDevelopment'
  ? { success: true, version: 'write-only-response' }
  : { request: oldServerCompleted };
assert.equal((await context.service.updateDevelopmentProgress('live-completed', { workStatus: 'Completed' })).currentStage, constants.STAGES.INTRODUCE, 'A success-only save must read the persisted row instead of failing');
assert.equal(apiCalls.at(-1).action, 'getRequest', 'Readback must fetch only one request');
const beforeFailedSave = values.get('make_system_requests_v1');
apiPayload = { error: 'Unhandled action: completeDevelopment' };
await assert.rejects(context.service.updateDevelopmentProgress('live-completed', { workStatus: 'Completed' }), /Deploy > Manage deployments/);
assert.equal(values.get('make_system_requests_v1'), beforeFailedSave, 'An old deployment must not produce a fake local handoff');
console.log('PASS: explicit completion action, old MIS label compatibility, success-only save readback and actionable stale-deployment error.');

const liveIntroduced = { ...oldServerCompleted, currentStage: constants.STAGES.UPDATE_MIS, systemIntroduction: { isCompleted: true, remarks: 'Management introduction complete' } };
apiPayload = { success: true, request: liveIntroduced, version: 'introduction-done' };
const handedToMis = await context.service.completeIntroduction('live-completed', { remarks: 'Management introduction complete' });
assert.equal(handedToMis.currentStage, constants.STAGES.UPDATE_MIS);
apiPayload = { requests: [liveIntroduced], hasChanges: true, version: 'mis-pending-sync' };
assert.equal((await context.service.forceSyncFromSheets()).requests[0].currentStage, constants.STAGES.UPDATE_MIS, 'MIS pending must survive a sheet refresh');
const liveClosed = { ...liveIntroduced, currentStage: constants.STAGES.CLOSED, currentStatus: 'Closed', misUpdate: { isCompleted: true, remarks: 'Final MIS entry', updatedAt: '2026-11-27T07:00:00Z' } };
apiPayload = { success: true, request: liveClosed, version: 'mis-closed' };
const finalSaved = await context.service.completeMisUpdate('live-completed', { remarks: 'Final MIS entry' });
assert.equal(finalSaved.currentStage, constants.STAGES.CLOSED);
assert.equal(finalSaved.misUpdate.isCompleted, true);
apiPayload = { requests: [liveClosed], hasChanges: true, version: 'closed-sync' };
assert.equal((await context.service.listRequests())[0].currentStage, constants.STAGES.CLOSED);
assert.equal((await context.service.forceSyncFromSheets()).requests[0].currentStage, constants.STAGES.CLOSED);
assert.equal((await context.service.checkSync()).requests[0].currentStage, constants.STAGES.CLOSED);
await assert.rejects(context.service.completeMisUpdate('live-completed', { remarks: 'Duplicate' }), /pending MIS/);
console.log('PASS: live introduction hands off to MIS; final MIS submission closes the request permanently across cached load, list, refresh and background sync.');
