import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { parse } from '@babel/parser';
import * as constants from '../constants/stages.js';
import { normalizeSystemRequest } from '../utils/systemWorkflow.mjs';
import { sortNewestFirst } from '../utils/sortUtils.js';

const values = new Map();
let live = false;
let apiPayload;
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
  fetch: async () => ({ ok: true, json: async () => JSON.parse(JSON.stringify(apiPayload)) }),
  getNowKolkataISO: () => '2026-10-28T12:00:00.000Z',
  formatToKolkataDateString: () => '2026-10-28',
});
vm.runInContext(`${source}\nglobalThis.service = dataService; globalThis.loadRequests = loadStoredRequests;`, context);
assert.equal(context.loadRequests().find(r => r.id === 'legacy-testing').currentStage, constants.STAGES.UPDATE_MIS);
assert.equal(context.loadRequests().find(r => r.id === 'legacy-revise').currentStage, constants.STAGES.CREATE);
for (const id of ['new', 'legacy-revise']) {
  const result = await context.service.updateDevelopmentProgress(id, { workStatus: 'Completed', remarks: 'Finished', systemUrl: 'https://example.test/app' });
  assert.equal(result.currentStage, constants.STAGES.UPDATE_MIS);
  const saved = context.loadRequests().find(r => r.id === id);
  assert.equal(saved.currentStatus, 'Update MIS: Pending');
  assert.equal(saved.progressPercent, 100);
  assert.equal(saved.systemUrl, 'https://example.test/app');
}
assert(!constants.NAV_ITEMS.some(item => ['testing', 'revise'].includes(item.id)));
console.log('PASS: local completion/reload to MIS, legacy Testing/Revise migration, links preserved, removed pages absent from navigation.');
live = true;
const oldServerCompleted = makeRequest('live-completed', constants.STAGES.TESTING, { workStatus: 'Completed', progressPercent: 100 });
values.set('make_system_requests_v1', JSON.stringify([makeRequest('live-completed', constants.STAGES.CREATE)]));
apiPayload = { success: true, request: oldServerCompleted, version: 'live-save' };
const liveSaved = await context.service.updateDevelopmentProgress('live-completed', { workStatus: 'Completed' });
assert.equal(liveSaved.currentStage, constants.STAGES.UPDATE_MIS, 'Live save must normalize a legacy Testing stage before updating App state');
assert.equal(liveSaved.allRequests[0].currentStage, constants.STAGES.UPDATE_MIS);
apiPayload = { requests: [oldServerCompleted], version: 'live-read', hasChanges: true };
assert.equal((await context.service.listRequests())[0].currentStage, constants.STAGES.UPDATE_MIS);
assert.equal((await context.service.forceSyncFromSheets()).requests[0].currentStage, constants.STAGES.UPDATE_MIS);
assert.equal((await context.service.checkSync()).requests[0].currentStage, constants.STAGES.UPDATE_MIS);
console.log('PASS: live API legacy completion -> save response -> list/force-sync/background-sync all return MIS Pending.');
