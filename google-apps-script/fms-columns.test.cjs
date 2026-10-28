const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const context = vm.createContext({});
vm.runInContext(fs.readFileSync(`${__dirname}/Code.gs`, 'utf8'), context);
const headers = Array.from(context.FMS_HEADERS);
assert.equal(headers.length, 34);
assert.equal(headers[12], 'Planned 1');
assert.equal(headers[13], 'Actual 1');
assert(!headers.includes('Meeting Date'));
assert(!headers.includes('Discussion Remarks'));
headers.push('_Make_System_Metadata');
const cells = Array.from({ length: 7 }, () => Array(headers.length).fill(''));
cells[5] = headers;
cells[6][1] = 'SM-0006';
cells[6][34] = JSON.stringify({ id: 'req-test', activityLog: [], introduction: { isCompleted: false } });
const writes = [];
const sheet = {
  getLastColumn: () => headers.length,
  getLastRow: () => 7,
  getRange: (row, column, height = 1, width = 1) => ({
    getValues: () => Array.from({ length: height }, (_, i) => Array.from({ length: width }, (_, j) => cells[row - 1 + i]?.[column - 1 + j] || '')),
    setValue: value => { writes.push({ row, column, value }); cells[row - 1][column - 1] = value; },
  }),
};
context.SpreadsheetApp = { getActiveSpreadsheet: () => ({ getSheetByName: () => sheet }) };
context.bumpSyncVersion = () => 'test';
context.getSyncVersion = () => 'test';
context.formatTimestampCell = value => value ? String(value) : '';
context.formatDateCell = value => value ? String(value) : '';
const mapping = context.findHeaderMapping(sheet);
assert.equal(mapping.colMeetingDate, 0);
assert.equal(mapping.colDiscussionRemarks, 0);
assert.equal(mapping.colMeta, 35, 'Keep shifted metadata instead of losing request IDs and history');
assert.equal(mapping.colActual1, 14);
assert.equal(mapping.colFinalStatus, 34);
const approved = context.handleApproveIntroduction('req-test', {
  assignedDeveloper: 'Bhupendra Kumar', targetCompletionDate: '2026-11-01', remarks: 'Scope approved',
});
assert.equal(approved.success, true);
assert.equal(cells[6][10], 'Bhupendra Kumar');
assert.equal(cells[6][11], '2026-11-01');
assert.equal(cells[6][6], 'In Progress');
assert.equal(Object.prototype.toString.call(cells[6][8]), '[object Date]');
assert.equal(JSON.parse(cells[6][34]).introduction.remarks, 'Scope approved');
assert(writes.every(w => !mapping.protectedCols[w.column]), 'Preserve every Planned/Delay formula');
assert(writes.every(w => ![13, 14, 15].includes(w.column)), 'Approval must not touch the shifted development columns');
console.log('PASS: FMS without meeting/remarks columns; approval writes I/K/L, preserves M:O formulas/data and shifted AI metadata.');
const introductionActual = cells[6][8];
const completed = context.handleUpdateDevelopmentProgress('req-test', {
  workStatus: 'Completed', remarks: 'Ready for MIS', systemUrl: 'https://example.test/system',
});
assert.equal(completed.request.currentStage, 'Update MIS System');
assert.equal(completed.request.currentStatus, 'Update MIS: Pending');
assert.equal(cells[6][6], 'Completed');
assert.equal(Object.prototype.toString.call(cells[6][13]), '[object Date]');
assert.equal(cells[6][8], introductionActual, 'Development completion must preserve the introduction timestamp');
const developmentActual = cells[6][13];
const reloaded = context.fetchAllRequests().find(r => r.id === 'req-test');
assert.equal(reloaded.currentStage, 'Update MIS System');
assert.equal(reloaded.progressPercent, 100);
assert(reloaded.developmentCompletedAt);
assert(writes.every(w => !mapping.protectedCols[w.column]));
context.handleCompleteMisUpdate('req-test', { remarks: 'MIS updated' });
assert.equal(cells[6][13], developmentActual, 'MIS update must preserve the development completion timestamp');
assert.equal(context.fetchAllRequests().find(r => r.id === 'req-test').currentStage, 'Closed');
console.log('PASS: Create completion -> FMS save -> reload in MIS Pending -> MIS update -> Closed; formulas preserved.');

// Deleted workflow columns must not make a date field read the metadata cell.
const removed = ['Planned 2','Actual 2','Delay 2','Decision','Remarks / Defect Rationale','Revision No','Upgrade Target Date','Planned 3','Actual 3','Delay 3'];
const compactHeaders = Array.from(context.FMS_HEADERS).filter(h => !removed.includes(h));
compactHeaders.push('', '', '_Make_System_Metadata');
assert.equal(compactHeaders.indexOf('_Make_System_Metadata') + 1, 27);
cells[5] = compactHeaders;
cells[6] = Array(compactHeaders.length).fill('');
cells[6][1] = 'SM-0003';
cells[6][6] = 'Completed';
cells[6][compactHeaders.indexOf('_Make_System_Metadata')] = JSON.stringify({ id:'req-original', currentRevisionNo:null, introduction:{isCompleted:true}, activityLog:[] });
sheet.getLastColumn = () => compactHeaders.length;
const fullRange = sheet.getRange;
sheet.getRange = (row, col, height = 1, width = 1) => {
  assert(col + width - 1 <= compactHeaders.length, 'Reads must stay within the compact sheet width');
  return fullRange(row, col, height, width);
};
const compact = context.findHeaderMapping(sheet);
assert.equal(compact.colUpgradeTargetDate, 0, 'Missing Upgrade Target Date must not fall back to metadata at AA');
assert.equal(compact.colActual2, 0);
assert.equal(compact.colActual3, 0);
assert.equal(compact.colMeta, 27, 'Keep the real metadata header after columns are removed');
assert.equal(context.fetchAllRequests()[0].id, 'req-original');
assert.equal(context.fetchAllRequests()[0].upgradeTargetDate, null);
console.log('PASS: compact FMS layout keeps metadata at AA and never reads it as an upgrade date.');
