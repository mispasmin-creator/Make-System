const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const props = {};
const context = vm.createContext({
  Date,
  PropertiesService: { getScriptProperties: () => ({ getProperties: () => ({ ...props }), setProperty: (k, v) => { props[k] = v; }, getProperty: k => props[k] || null }) },
});
vm.runInContext(fs.readFileSync(`${__dirname}/Code.gs`, 'utf8'), context);

// Live sheet layout from the current FMS tab (row 6 headings, no Revise/Testing columns, no metadata column).
const headers = ['Timestamps','Request No.','Company','System Name','Requirements Summary','Image','Work Status','Planned','Actual','Delay','Assigned Developer','Target Date','Planned 1','Actual 1','Delay 1','System Link / URL','Admin ID / Username','Password','Reason for Hold','Hold Extend Target Date','Planned 4','Actual 4','Delay 4','Final Status'];
const col = name => headers.indexOf(name) + 1;
const cells = Array.from({ length: 7 }, () => Array(headers.length + 1).fill(''));
cells[5] = [...headers, '_Make_System_Metadata'];
cells[6][1] = 'SM-0006';
cells[6][2] = 'Pmmpl';
cells[6][3] = 'Demo System';
// Formula cells: Planned/Delay must never be overwritten.
const formulas = new Set(['7:' + col('Planned'), '7:' + col('Delay'), '7:' + col('Planned 1'), '7:' + col('Delay 1')]);
for (const key of formulas) { const [r, c] = key.split(':').map(Number); cells[r - 1][c - 1] = 12345; }
const writes = [];
const sheet = {
  getLastColumn: () => headers.length + 1,
  getLastRow: () => 7,
  getRange: (row, column, height = 1, width = 1) => ({
    getValues: () => Array.from({ length: height }, (_, i) => Array.from({ length: width }, (_, j) => cells[row - 1 + i]?.[column - 1 + j] ?? '')),
    getFormula: () => formulas.has(`${row}:${column}`) ? '=IF(1,1)' : '',
    setValue: value => { writes.push({ row, column, value }); cells[row - 1][column - 1] = value; },
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
for (const removed of ['colActual2', 'colActual3', 'colDecision', 'colRevisionNo', 'colUpgradeTargetDate', 'colMeetingDate']) assert.equal(mapping[removed], 0, removed);

const approved = context.handleApproveIntroduction('req-SM-0006', { assignedDeveloper: 'Bhupendra Kumar', targetCompletionDate: '2026-11-01', remarks: 'Scope approved' });
assert.equal(approved.success, true);
assert.equal(cells[6][col('Assigned Developer') - 1], 'Bhupendra Kumar');
assert.equal(cells[6][col('Target Date') - 1], '2026-11-01');
assert.equal(Object.prototype.toString.call(cells[6][col('Actual') - 1]), '[object Date]');

const introductionActual = cells[6][col('Actual') - 1];
const completed = context.handleUpdateDevelopmentProgress('req-SM-0006', { workStatus: 'Completed', remarks: 'Ready for MIS', systemUrl: 'https://example.test/system' });
assert.equal(completed.request.currentStage, 'Update MIS System');
assert.equal(Object.prototype.toString.call(cells[6][col('Actual 1') - 1]), '[object Date]');
assert.equal(cells[6][col('Actual') - 1], introductionActual);
assert.equal(context.fetchAllRequests().find(r => r.requestNo === 'SM-0006').currentStage, 'Update MIS System');
context.handleCompleteMisUpdate('req-SM-0006', { remarks: 'MIS updated' });
assert.equal(context.fetchAllRequests().find(r => r.requestNo === 'SM-0006').currentStage, 'Closed');

// History is kept in Script Properties; the metadata column stays empty and nothing formula-owned is written.
assert(Object.keys(props).some(k => k === 'REQMETA_SM-0006'));
assert(writes.every(w => w.column <= headers.length), 'Nothing may be written to the metadata column');
assert(writes.every(w => !mapping.protectedCols[w.column]), 'Planned/Delay columns are never written');
for (const key of formulas) { const [r, c] = key.split(':').map(Number); assert.equal(cells[r - 1][c - 1], 12345); }
console.log('PASS: current FMS layout - no metadata column, Planned/Delay formulas untouched, Create -> MIS -> Closed flow works.');
