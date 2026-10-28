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

// Live layout: a Requester column now sits between Request No. and Company.
const headers = ['Timestamps','Request No.','Requester','Company','System Name','Requirements Summary','Image','Work Status','Planned','Actual','Delay','Assigned Developer','Target Date'];
const col = n => headers.indexOf(n) + 1;
const cells = Array.from({ length: 7 }, () => Array(headers.length).fill(''));
cells[5] = [...headers];
const formulas = new Set(['7:' + col('Planned'), '7:' + col('Delay')]);
const sheet = {
  getLastColumn: () => headers.length, getLastRow: () => Math.max(6, cells.filter((r, i) => i >= 6 && r.some(Boolean)).length + 6), getMaxRows: () => 100,
  getRange: (row, c, h = 1, w = 1) => ({
    getValues: () => Array.from({ length: h }, (_, i) => Array.from({ length: w }, (_, j) => cells[row - 1 + i]?.[c - 1 + j] ?? '')),
    getFormula: () => formulas.has(`${row}:${c}`) ? '=1' : '',
    setValue(v) { cells[row - 1] = cells[row - 1] || Array(headers.length).fill(''); cells[row - 1][c - 1] = v; },
  }),
};
context.SpreadsheetApp = { getActiveSpreadsheet: () => ({ getSheetByName: () => sheet }) };
context.bumpSyncVersion = () => 'v'; context.getSyncVersion = () => 'v';

const created = context.handleCreateRequest({ companyName: 'Pmmpl', systemName: 'Stock FMS', businessPurpose: 'Track stock', createdBy: 'Ravi Kumar' });
assert.equal(cells[6][col('Requester') - 1], 'Ravi Kumar', 'The signed-in user name is written to the Requester column');
assert.equal(cells[6][col('Company') - 1], 'Pmmpl');
assert.equal(cells[6][col('Request No.') - 1], created.requestNo);
assert.equal(created.request.requester, 'Ravi Kumar');

const read = context.fetchAllRequests()[0];
assert.equal(read.requester, 'Ravi Kumar');
assert.equal(read.createdBy, 'Ravi Kumar');

// Requester is read from the sheet, so User / EA only see their own rows.
const mine = { role: 'User', fullName: 'Ravi Kumar' }, other = { role: 'EA', fullName: 'Asha' }, dme = { role: 'DME', fullName: 'Dev' };
assert.equal(context.scopeToUser(mine, [read], context.requestOwnerNames).length, 1);
assert.equal(context.scopeToUser(other, [read], context.requestOwnerNames).length, 0);
assert.equal(context.scopeToUser(dme, [read], context.requestOwnerNames).length, 1);

// Later updates keep the requester untouched.
context.handleApproveIntroduction(created.requestNo, { assignedDeveloper: 'Dev', targetCompletionDate: '2026-11-10' });
assert.equal(cells[6][col('Requester') - 1], 'Ravi Kumar');
assert.equal(context.fetchAllRequests()[0].requester, 'Ravi Kumar');
console.log('PASS: Requester column is filled with the signed-in user, read back, used for the User/EA scope and kept on updates.');
