import { REPAIR_CONFIG } from '../config/repairConfig';
import { authService } from './authService';
import { repairSheetAdapter, repairSheetConnected } from './repairSheetAdapter';
import { addRepairWorkingDays, transitionIssue, getSummary, getMISRows } from '../utils/repairWorkflow.mjs';

const KEY = 'make_system_repair_demo_v1';
let adapter = repairSheetConnected() ? repairSheetAdapter : null;
let demo = false;
let cache = [];
const listeners = new Set();
let revision = 0;
let listInFlight = null;
const emit = () => listeners.forEach(listener => listener(cache));
const readDemo = () => { const data = JSON.parse(localStorage.getItem(KEY) || '{"sequence":0,"issues":[]}'); return data; };
const operations = ['listIssues', 'getIssueDetails', 'createIssue', 'submitAssessment', 'completeRepair', 'acknowledgeCompletion'];

export function configureRepairAdapter(value) {
  if (!value || operations.some(key => typeof value[key] !== 'function')) throw new Error('Repair backend adapter is incomplete.');
  adapter = value; demo = false; cache = []; emit();
}
// Live issues are cached in memory only; drop them whenever the signed-in user changes.
export function clearRepairCache() { if (!demo) { cache = []; revision++; emit(); } }
export function enableRepairDemo() { demo = true; cache = readDemo().issues; emit(); }
export function getRepairMode() { return demo ? 'demo' : adapter ? 'connected' : 'unconfigured'; }
export function getCachedRepairIssues() { return cache; }
export function subscribeRepairIssues(listener) { listeners.add(listener); return () => listeners.delete(listener); }

export function canRepairAction(user, action) {
  if (!user || user.status !== 'Active') return false;
  if (user.role === 'Admin') return true;
  if (action === 'create') return authService.canAccessStage(user, 'repair-new', 'update');
  return authService.canAccessStage(user, REPAIR_CONFIG.permissionStages[action], 'update');
}

function assertReady() { if (!demo && !adapter) throw new Error('Repair backend is not configured. Supply the Sheet mapping or explicitly enable development demo mode.'); }
function assertPermission(user, action) { if (!canRepairAction(user, action)) throw new Error('You do not have permission for this repair action.'); }

async function demoWrite(work) {
  if (!navigator.locks) throw new Error('Demo writes require a browser with Web Locks support.');
  return navigator.locks.request(KEY, () => {
    const store = readDemo();
    const result = work(store);
    localStorage.setItem(KEY, JSON.stringify(store));
    cache = store.issues; emit(); return result;
  });
}

async function updateIssue(action, method, id, data, user, expectedVersion) {
  assertReady(); assertPermission(user, action);
  if (!demo) {
    // Adapter must validate the authenticated session, role, expectedVersion and idempotency on the server.
    const result = await adapter[method]({ id, data, expectedVersion });
    revision++; cache = cache.map(issue => issue.id === id ? result : issue); emit(); return result;
  }
  return demoWrite(store => {
    const index = store.issues.findIndex(issue => issue.id === id);
    if (index < 0) throw new Error('Issue not found.');
    if (store.issues[index].version !== expectedVersion) throw new Error('This issue changed. Refresh and try again.');
    const result = transitionIssue(store.issues[index], action, data, user);
    store.issues[index] = result; return result;
  });
}

export const repairService = {
  async listIssues() {
    assertReady();
    if (listInFlight) return listInFlight;
    const started = revision;
    listInFlight = (async () => {
      const result = demo ? readDemo().issues : await adapter.listIssues();
      if (started === revision) { cache = result; emit(); }
      return cache;
    })().finally(() => { listInFlight = null; });
    return listInFlight;
  },
  async getIssueDetails(id) { assertReady(); return demo ? readDemo().issues.find(issue => issue.id === id) : adapter.getIssueDetails(id); },
  async createIssue(data, user, idempotencyKey) {
    assertReady(); assertPermission(user, 'create');
    if (!data.requester?.trim() || !data.company?.trim() || !data.description?.trim()) throw new Error('Name, company and issue description are required.');
    if (!demo) { const result = await adapter.createIssue({ data, idempotencyKey }); revision++; cache = [result, ...cache.filter(i => i.id !== result.id)]; emit(); return result; }
    return demoWrite(store => {
      const existing = store.issues.find(i => i.idempotencyKey === idempotencyKey);
      if (existing) return existing;
      const now = new Date().toISOString();
      const issue = { id: crypto.randomUUID(), serial: `RS - ${String(++store.sequence).padStart(3, '0')}`, requester: data.requester.trim(), company: data.company, description: data.description.trim(), location: data.location?.trim() || '', attachments: Array.isArray(data.attachments) ? data.attachments : [], createdAt: now, version: 1, idempotencyKey, approval: { planned: addRepairWorkingDays(now, 1) }, repair: {}, management: {}, activity: [{ action: 'Issue Request', actor: user.fullName || user.username, actorId: user.id, timestamp: now }] };
      store.issues.unshift(issue); return issue;
    });
  },
  submitAssessment: (id, data, user, version) => updateIssue('assessment', 'submitAssessment', id, data, user, version),
  completeRepair: (id, data, user, version) => updateIssue('repair', 'completeRepair', id, data, user, version),
  acknowledgeCompletion: (id, user, version) => updateIssue('acknowledge', 'acknowledgeCompletion', id, {}, user, version),
  async getDashboardSummary() { return getSummary(await this.listIssues()); },
  async getMISReport() { return getMISRows(await this.listIssues()); }
};
