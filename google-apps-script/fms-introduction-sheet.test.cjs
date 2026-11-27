const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const props = {};
const context = vm.createContext({
  Date,
  LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
  PropertiesService: { getScriptProperties: () => ({ getProperties: () => ({ ...props }), setProperty: (k, v) => { props[k] = v; }, getProperty: k => props[k] || null }) },
});
vm.runInContext(fs.readFileSync(`${__dirname}/Code.gs`, 'utf8'), context);

// Updated sheet screenshot: Assign Actual, Create Actual 1, Introduce Actual 2 / Status, MIS Actual 4.
const headers = ['Timestamps','Request No.','Requester','Company','System Name','Requirements Summary','Image','Work Status','Planned','Actual','Delay','Assigned Developer','Target Date','Planned 1','Actual 1','Delay 1','System Link / URL','Admin ID / Username','Password','Reason for Hold','Hold Extend Target Date','Planned 2','Actual 2','Delay 2','Status','Planned 4','Actual 4','Delay 4','Final Status'];
const col = name => headers.indexOf(name) + 1;
const cells = Array.from({ length: 7 }, () => Array(headers.length + 1).fill(''));
cells[5] = [...headers, '_Make_System_Metadata'];
cells[6][1] = 'SM-0006';
cells[6][col('Requester') - 1] = 'Requester';
cells[6][col('Company') - 1] = 'Pmmpl';
cells[6][col('System Name') - 1] = 'Demo System';
// Formula cells: Planned/Delay must never be overwritten.
const protectedColumns = headers.map((header, index) => /planned|delay/i.test(header) ? index + 1 : 0).filter(Boolean);
// Leave some formula-owned cells blank: they must be skipped by heading too.
const formulas = new Set(protectedColumns.filter((_, i) => i % 2 === 0).map(column => '7:' + column));
for (const key of formulas) { const [r, c] = key.split(':').map(Number); cells[r - 1][c - 1] = 12345; }
const writes = [];
const sheet = {
  getLastColumn: () => headers.length + 1,
  getLastRow: () => cells.length,
  getMaxRows: () => 100,
  getRange: (row, column, height = 1, width = 1) => ({
    getValues: () => Array.from({ length: height }, (_, i) => Array.from({ length: width }, (_, j) => cells[row - 1 + i]?.[column - 1 + j] ?? '')),
    getFormula: () => formulas.has(`${row}:${column}`) ? '=IF(1,1)' : '',
    setValue: value => { writes.push({ row, column, value }); cells[row - 1] ||= Array(headers.length + 1).fill(''); cells[row - 1][column - 1] = value; },
    clearContent() {},
  }),
};
context.SpreadsheetApp = { getActiveSpreadsheet: () => ({ getSheetByName: () => sheet }) };
context.bumpSyncVersion = () => 'test';
context.getSyncVersion = () => 'test';

const mapping = context.findHeaderMapping(sheet);
assert.equal(mapping.colMeta, 0, 'No metadata column is used');
assert.equal(mapping.colActual, col('Actual'));
assert.equal(mapping.colActual1, col('Actual 1'));
assert.equal(mapping.colActual4, col('Actual 4'));
assert.equal(mapping.colFinalStatus, col('Final Status'));
for (const removed of ['colActual3', 'colDecision', 'colRevisionNo', 'colUpgradeTargetDate', 'colMeetingDate']) assert.equal(mapping[removed], 0, removed);

assert.equal(mapping.colWorkStatus, col('Work Status'));
assert.equal(mapping.colIntroductionStatus, col('Status'));
assert.equal(mapping.colActual2, col('Actual 2'));
assert.equal(col('Actual 2'), 23);
assert.equal(col('Status'), 25);
assert.equal(col('Actual 4'), 27);
assert.equal(col('Final Status'), 29);
for (const column of protectedColumns) {
  context.safeSetCellValue(sheet, 7, column, 'MUST NOT SAVE', mapping);
  context.safeSetCellValue(sheet, 7, column, 'MUST NOT SAVE');
}
assert.equal(writes.length, 0, 'Even blank Planned/Delay cells are protected');

const approved = context.handleApproveIntroduction('req-SM-0006', { assignedDeveloper: 'Bhupendra Kumar', targetCompletionDate: '2026-11-01', remarks: 'Scope approved' });
assert.equal(approved.success, true);
assert.equal(cells[6][col('Assigned Developer') - 1], 'Bhupendra Kumar');
assert.equal(cells[6][col('Target Date') - 1], '2026-11-01');
assert.equal(Object.prototype.toString.call(cells[6][col('Actual') - 1]), '[object Date]');

assert.equal(cells[6][col('Actual 2') - 1], '', 'Assignment never completes the later introduction');
const introductionActual = cells[6][col('Actual') - 1];
const completed = context.handleUpdateDevelopmentProgress('req-SM-0006', { workStatus: 'Completed', remarks: 'Ready for MIS', systemUrl: 'https://example.test/system' });
assert.equal(completed.request.currentStage, 'Introduce System');
assert.equal(cells[6][col('Status') - 1], 'Pending');
assert.equal(cells[6][col('Actual 2') - 1], '');
assert.equal(cells[6][col('Work Status') - 1], 'Completed');
assert.throws(() => context.handleCompleteMisUpdate('req-SM-0006', { remarks: 'Too early' }), /introduction before/);
assert.equal(Object.prototype.toString.call(cells[6][col('Actual 1') - 1]), '[object Date]');
assert.equal(cells[6][col('Actual') - 1], introductionActual);
assert.equal(context.fetchAllRequests().find(r => r.requestNo === 'SM-0006').currentStage, 'Introduce System');
assert.throws(() => context.handleCompleteIntroduction('req-SM-0006', { remarks: ' ' }), /remarks are required/);
const introduced = context.handleCompleteIntroduction('req-SM-0006', { remarks: 'Users trained and system introduced', updatedBy: 'Test Admin' });
assert.equal(introduced.request.currentStage, 'Update MIS System');
assert.equal(cells[6][col('Status') - 1], 'Completed');
assert.equal(Object.prototype.toString.call(cells[6][col('Actual 2') - 1]), '[object Date]');
const introducedAt = cells[6][col('Actual 2') - 1];
assert.equal(introduced.request.introduction.isCompleted, true);
assert.equal(context.fetchAllRequests().find(r => r.requestNo === 'SM-0006').systemIntroduction.completedBy, 'Test Admin');
assert.equal(context.fetchAllRequests().find(r => r.requestNo === 'SM-0006').currentStage, 'Update MIS System');
assert.throws(() => context.handleCompleteIntroduction('req-SM-0006', { remarks: 'Again' }), /pending introduction/);
// Sheet edits override stale metadata before the next mutation too.
cells[6][col('Actual 2') - 1] = '';
cells[6][col('Status') - 1] = 'Pending';
assert.equal(context.fetchAllRequests()[0].currentStage, 'Introduce System');
assert.throws(() => context.handleCompleteMisUpdate('req-SM-0006', { remarks: 'Too early after sheet edit' }), /introduction before/);
cells[6][col('Actual 2') - 1] = introducedAt;
cells[6][col('Status') - 1] = 'Completed';
assert.equal(context.fetchAllRequests()[0].currentStage, 'Update MIS System');
context.handleCompleteMisUpdate('req-SM-0006', { remarks: 'MIS updated' });
assert.equal(cells[6][col('Actual 2') - 1], introducedAt, 'MIS must preserve introduction timestamp');
assert.equal(cells[6][col('Status') - 1], 'Completed');
assert.equal(cells[6][col('Final Status') - 1], 'Closed');
assert.equal(cells[6][col('Work Status') - 1], 'Closed');
assert.equal(Object.prototype.toString.call(cells[6][col('Actual 4') - 1]), '[object Date]');
assert.throws(() => context.handleCompleteMisUpdate('req-SM-0006', { remarks: 'Duplicate' }), /introduction before/);
assert.equal(context.fetchAllRequests().find(r => r.requestNo === 'SM-0006').currentStage, 'Closed');

// Sheet rollback is authoritative even while completion audit metadata remains.
const finalActual = cells[6][col('Actual 4') - 1];
cells[6][col('Actual 4') - 1] = '';
cells[6][col('Final Status') - 1] = 'In Progress';
assert.equal(context.fetchAllRequests()[0].currentStage, 'Update MIS System', 'clearing final milestone reopens MIS');
cells[6][col('Actual 2') - 1] = '';
cells[6][col('Status') - 1] = 'Pending';
assert.equal(context.fetchAllRequests()[0].currentStage, 'Introduce System', 'clearing introduction milestone rolls back introduction');
cells[6][col('Actual 1') - 1] = '';
cells[6][col('Work Status') - 1] = 'Completed';
const rolledBackCreate = context.fetchAllRequests()[0];
assert.equal(rolledBackCreate.currentStage, 'Create System', 'clearing development Actual 1 rolls back to Create');
assert.equal(rolledBackCreate.workStatus, 'In Progress', 'stale Completed status cannot keep a rolled-back request completed');
assert.equal(rolledBackCreate.progressPercent < 100, true);
assert.equal(rolledBackCreate.latestRemarks, 'Moved back to Create System.');
assert.equal(rolledBackCreate.sheetWorkflowRolledBack, true);
cells[6][col('Actual 1') - 1] = completed.request.developmentCompletedAt ? new Date(completed.request.developmentCompletedAt) : new Date();
cells[6][col('Actual 2') - 1] = introducedAt;
cells[6][col('Status') - 1] = 'Completed';
cells[6][col('Actual 4') - 1] = finalActual;
cells[6][col('Final Status') - 1] = 'Closed';
cells[6][col('Work Status') - 1] = 'Closed';
assert.equal(context.fetchAllRequests()[0].currentStage, 'Closed');

// History is kept in Script Properties; the metadata column stays empty and nothing formula-owned is written.
assert(Object.keys(props).some(k => k === 'REQMETA_SM-0006'));
assert(writes.every(w => w.column <= headers.length), 'Nothing may be written to the metadata column');
assert(writes.every(w => !mapping.protectedCols[w.column]), 'Planned/Delay columns are never written');
for (const key of formulas) { const [r, c] = key.split(':').map(Number); assert.equal(cells[r - 1][c - 1], 12345); }
for (const column of protectedColumns.filter(column => !formulas.has('7:' + column))) assert.equal(cells[6][column - 1], '');
const writesBeforeRead = writes.length;
// Already introduced rows must work without Script Properties (sheet is authoritative).
delete props['REQMETA_SM-0006'];
cells[6][col('Actual 4') - 1] = '';
cells[6][col('Final Status') - 1] = 'In Progress';
cells[6][col('Work Status') - 1] = 'Completed';
const sheetOnly = context.fetchAllRequests()[0];
assert.equal(sheetOnly.currentStage, 'Update MIS System');
assert.equal(sheetOnly.systemIntroduction.isCompleted, true);
assert.equal(sheetOnly.actualIntroductionDate, introducedAt.toISOString());
assert.equal(sheetOnly.actualTestingDate, '', 'Actual 2 is introduction, not testing');
assert.equal(writes.length, writesBeforeRead, 'Fetching requests never writes sheet cells');
context.handleCompleteMisUpdate('req-SM-0006', { remarks: 'Sheet-only introduction can close' });
assert.equal(context.fetchAllRequests()[0].currentStage, 'Closed');
assert(writes.every(w => !protectedColumns.includes(w.column)));
console.log('PASS: screenshot layout maps W/Actual 2, Y/Status, AA/Actual 4, AC/Final Status; introduction sync and MIS gating work; every Planned/Delay cell, including blanks, remains untouched.');

// New rows have no formulas yet, but every Planned/Delay heading is still write-protected.
const fresh = context.handleCreateRequest({ companyName: 'Pmmpl', systemName: 'New sheet request', createdBy: 'Requester' });
assert.equal(fresh.request.currentStage, 'Assign System');
assert.equal(cells[7][col('Work Status') - 1], 'Pending Assignment');
assert.equal(cells[7][col('Actual 2') - 1], '');
context.handleApproveIntroduction(fresh.requestNo, { assignedDeveloper: 'Developer', targetCompletionDate: '2026-12-15', remarks: 'Scope assigned' });
context.handleUpdateDevelopmentProgress(fresh.requestNo, { workStatus: 'On Hold', holdReason: 'Waiting for input', holdExtendTargetDate: '2026-12-20' });
assert.equal(cells[7][col('Reason for Hold') - 1], 'Waiting for input');
assert.equal(cells[7][col('Hold Extend Target Date') - 1], '2026-12-20');
// Revision metadata from older flows must still write Create completion to Actual 1 in this layout.
const freshMeta = JSON.parse(props['REQMETA_' + fresh.requestNo]);
freshMeta.currentRevisionNo = 'REV-01';
props['REQMETA_' + fresh.requestNo] = JSON.stringify(freshMeta);
context.authorizeAppAction = action => { assert.equal(action, 'completeDevelopment'); return { fullName: 'Signed-in Developer' }; };
context.jsonResponse = result => result;
const routedCompletion = context.doPost({ postData: { contents: JSON.stringify({ action: 'completeDevelopment', requestId: fresh.requestNo, data: { systemUrl: 'https://example.test/new' } }) } });
assert.equal(routedCompletion.request.currentStage, 'Introduce System');
assert.equal(cells[7][col('Status') - 1], 'Pending');
assert.equal(cells[7][col('Actual 2') - 1], '');
assert.equal(routedCompletion.request.activityLog.at(-1).actor, 'Signed-in Developer');
assert.equal(Object.prototype.toString.call(cells[7][col('Actual 1') - 1]), '[object Date]');
context.handleCompleteIntroduction(fresh.requestNo, { remarks: 'Introduced', updatedBy: 'Manager' });
context.handleCompleteMisUpdate(fresh.requestNo, { remarks: 'MIS updated' });
for (const column of protectedColumns) assert.equal(cells[7][column - 1], '', headers[column - 1] + ' must remain blank');
assert(writes.every(w => !protectedColumns.includes(w.column)), 'No action writes any Planned or Delay column');
console.log('PASS: creation, assignment, hold, revision completion, introduction and MIS never write Planned/Delay, including on a new row with no formulas.');

const stranded = context.handleCreateRequest({ companyName: 'Test', systemName: 'SM-0065 regression', createdBy: 'Requester' });
context.handleApproveIntroduction(stranded.requestNo, { assignedDeveloper: 'Dev', targetCompletionDate: '2026-12-04' });
context.handleUpdateDevelopmentProgress(stranded.requestNo, { workStatus: 'Completed' });
cells[8][col('Status') - 1] = '';
const strandedMeta = JSON.parse(props['REQMETA_' + stranded.requestNo]);
strandedMeta.currentStage = 'Update MIS System';
strandedMeta.workflowVersion = 1;
strandedMeta.customIntegrationValue = 'preserve';
props['REQMETA_' + stranded.requestNo] = JSON.stringify(strandedMeta);
const beforeRepairWrites = writes.length;
const repaired = context.syncPendingIntroductionStatus();
assert.equal(repaired.repaired, 1);
assert.equal(cells[8][col('Status') - 1], 'Pending');
assert.equal(context.fetchAllRequests().find(r => r.requestNo === stranded.requestNo).currentStage, 'Introduce System');
assert.equal(JSON.parse(props['REQMETA_' + stranded.requestNo]).customIntegrationValue, 'preserve');
assert(writes.slice(beforeRepairWrites).every(w => w.column === col('Status')), 'Repair may write only introduction Status, never dates or formula columns');
assert.equal(context.syncPendingIntroductionStatus().repaired, 0, 'Repair is safe to repeat');
assert.equal(context.fetchAllRequests().filter(r => r.currentStage === 'Closed').length, 2, 'Closed records stay closed');
console.log('PASS: previously completed requests with a blank introduction Status are repaired without modifying history, Closed rows, Planned or Delay.');
