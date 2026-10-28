import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { parse } from '@babel/parser';
import { transformWithOxc } from 'vite';
import { STAGES, WORK_STATUS } from '../constants/stages.js';
import { isDevelopmentComplete, isMisPending, isSystemClosed } from './systemWorkflow.mjs';

// Exercise the actual JSX prop chain and dropdown with isolated hook state.
// No real account or production request is changed by this test.
const request = { id: 'test-request', requestNo: 'SM-TEST', companyName: 'Test', introduction: {} };
const masterRows = [['Pmmpl', 'Ahitesh Tandon'], ['Rkl', 'Bhupendra Kumar'], ['', 'MD Alauddin'], ['', 'Bhupendra Kumar']];
const backend = vm.createContext({
  SpreadsheetApp: { getActiveSpreadsheet: () => ({ getSheetByName: name => {
    assert.equal(name, 'Master');
    return { getLastRow: () => masterRows.length + 1, getRange: (row, col, count, width) => {
      assert.deepEqual([row, col, count, width], [2, 1, masterRows.length, 2]);
      return { getValues: () => masterRows, getDisplayValues: () => masterRows };
    } };
  } }) },
});
vm.runInContext(fs.readFileSync('google-apps-script/Code.gs', 'utf8'), backend);
const master = JSON.parse(JSON.stringify(backend.fetchMasterOptions()));
assert.deepEqual(master.developers, ['Ahitesh Tandon', 'Bhupendra Kumar', 'MD Alauddin']);

function element(type, props, ...children) { return { type, props: { ...props, children } }; }
async function loadComponent(file, name, overrides = {}, state = v => v) {
  const source = fs.readFileSync(file, 'utf8');
  const ast = parse(source, { sourceType: 'module', plugins: ['jsx'] });
  const scope = {
    React: { createElement: element, Fragment: 'fragment' },
    useState: initial => [state(typeof initial === 'function' ? initial() : initial), () => {}],
    useEffect: () => {}, useMemo: fn => fn(), useCallback: fn => fn,
    useRef: () => ({ current: null }),
  };
  let stripped = source;
  for (const node of [...ast.program.body].reverse()) {
    if (node.type !== 'ImportDeclaration') continue;
    for (const spec of node.specifiers) scope[spec.local.name] ??= spec.local.name;
    stripped = stripped.slice(0, node.start) + stripped.slice(node.end);
  }
  Object.assign(scope, overrides);
  stripped = stripped.replace(/export default function/g, 'function').replace(/export function/g, 'function');
  const transformed = await transformWithOxc(stripped, file, { jsx: { runtime: 'classic' } });
  vm.createContext(scope);
  vm.runInContext(`${transformed.code}\nglobalThis.component = ${name};`, scope);
  return scope.component;
}
function find(node, type) {
  if (!node || typeof node !== 'object') return;
  if (node.type === type) return node;
  for (const child of (Array.isArray(node) ? node : node.props?.children || [])) {
    const match = find(child, type);
    if (match) return match;
  }
}

const App = await loadComponent('src/App.jsx', 'App', {
  authService: { getCurrentUser: () => ({ role: 'Admin' }), isAdmin: () => true, canAccessStage: () => true },
  dataService: { loadCachedRequests: () => [request], loadCachedMasterOptions: () => master },
  REPAIR_NAV_ITEMS: [], STAGES: {}, WORK_STATUS: {},
}, v => v === 'requests' ? 'introduce' : v);
const pageProps = find(App(), 'IntroduceSystemPage').props;
assert.deepEqual(pageProps.developerOptions, master.developers, 'App must pass Master names to IntroduceSystemPage');

const Page = await loadComponent('src/pages/IntroduceSystemPage.jsx', 'IntroduceSystemPage', { formatDisplayDateTime: value => value || '', formatDisplayDate: value => value || '' }, v => v === null ? request : v === false ? true : v);
const modalProps = find(Page(pageProps), 'IntroduceActionModal').props;
assert.deepEqual(modalProps.developerOptions, master.developers);
const Modal = await loadComponent('src/components/IntroduceActionModal.jsx', 'IntroduceActionModal', { formatToKolkataDateString: () => '2026-10-28' });
const approvalForm = Modal(modalProps);
assert(!JSON.stringify(approvalForm).includes('meetingDate'));
assert(!JSON.stringify(approvalForm).includes('Meeting Date'));
const selectProps = find(approvalForm, 'SearchableSelect').props;
assert.deepEqual(selectProps.options, master.developers);
let selected;
const Select = await loadComponent('src/components/SearchableSelect.jsx', 'SearchableSelect', {}, v => v === false ? true : v);
const dropdown = Select({ ...selectProps, onChange: value => { selected = value; } });
const firstOption = find(dropdown, 'div');
assert(firstOption);
const serialized = JSON.stringify(dropdown);
for (const name of master.developers) assert(serialized.includes(name));
assert(!serialized.includes('No matching options found'));
function clickName(node, name) {
  if (!node || typeof node !== 'object') return false;
  if (node.props?.role === 'option' && JSON.stringify(node.props.children).includes(name)) {
    node.props.onClick(); return true;
  }
  return (Array.isArray(node) ? node : node.props?.children || []).some(child => clickName(child, name));
}
assert(clickName(dropdown, 'Bhupendra Kumar'));
assert.equal(selected, 'Bhupendra Kumar');
backend.updateRequestRow = (_id, update) => update({ activityLog: [] });
const approved = backend.handleApproveIntroduction('test-request', {
  assignedDeveloper: 'Bhupendra Kumar', targetCompletionDate: '2026-11-01', remarks: 'Approved scope',
});
assert.equal(approved.introduction.isCompleted, true);
assert.equal(approved.assignedDeveloper, 'Bhupendra Kumar');
assert(!('meetingDate' in approved.introduction));
assert(!Array.from(backend.FMS_HEADERS).includes('Meeting Date'));
console.log('PASS: Master B names -> App -> Introduce page -> approval form -> visible dropdown options -> developer selection.');
console.log('PASS: approval form and backend approval work without Meeting Date; new FMS template omits its column.');

// Render actual table components using raw records an older backend can return.
const fixture = (id, extra) => ({ id, requestNo: id, introduction: { isCompleted: true }, ...extra });
const rows = [
  fixture('TESTING-COMPLETE', { currentStage: STAGES.TESTING, workStatus: WORK_STATUS.COMPLETED }),
  fixture('CREATE-COMPLETE', { currentStage: STAGES.CREATE, workStatus: WORK_STATUS.COMPLETED }),
  fixture('CREATE-ACTIVE', { currentStage: STAGES.CREATE, workStatus: WORK_STATUS.IN_PROGRESS }),
  fixture('MIS-CLOSED', { currentStage: STAGES.TESTING, misUpdate: { isCompleted: true } }),
];
const flowScope = {
  STAGES, WORK_STATUS, isDevelopmentComplete, isMisPending, isSystemClosed,
  formatDisplayDate: value => value || '', formatDisplayDateTime: value => value || '',
  calculateDueStatus: () => ({ isOverdue: false, isDueSoon: false }),
};
const MisPage = await loadComponent('src/pages/UpdateMisSystemPage.jsx', 'UpdateMisSystemPage', flowScope);
const misPending = JSON.stringify(find(MisPage({ requests: rows }), 'tbody'));
assert(misPending.includes('TESTING-COMPLETE'));
assert(misPending.includes('CREATE-COMPLETE'));
assert(!misPending.includes('CREATE-ACTIVE'));
assert(!misPending.includes('MIS-CLOSED'));
const CreatePage = await loadComponent('src/pages/CreateSystemPage.jsx', 'CreateSystemPage', flowScope, v => v === 'pending' ? 'completed' : v);
const createCompleted = JSON.stringify(find(CreatePage({ requests: rows }), 'tbody'));
assert(createCompleted.includes('TESTING-COMPLETE'));
assert(createCompleted.includes('CREATE-COMPLETE'));
assert(!createCompleted.includes('CREATE-ACTIVE'));
console.log('PASS: actual Create Completed and MIS Pending tables both render legacy/current completed records; active and MIS-closed records excluded from MIS Pending.');
