const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const props = {};
const context = vm.createContext({ Date, PropertiesService: { getScriptProperties: () => ({ getProperties: () => ({ ...props }), setProperty: (k, v) => { props[k] = v; }, getProperty: k => props[k] || null }) } });
vm.runInContext(fs.readFileSync(`${__dirname}/Code.gs`, 'utf8'), context);
const headers = ['Timestamps','Request No.','Company','System Name','Work Status','Actual','Assigned Developer','Target Date','Actual 1','System Link / URL','Admin ID / Username','Password','Reason for Hold','Hold Extend Target Date','Final Status'];
const col = n => headers.indexOf(n) + 1;
const cells = Array.from({ length: 7 }, () => Array(headers.length).fill(''));
cells[5] = [...headers]; cells[6][1] = 'SM-0008'; cells[6][5] = new Date('2026-10-29T10:00:00Z');
const sheet = { getLastColumn: () => headers.length, getLastRow: () => 7, getRange: (row, c, h = 1, w = 1) => ({
  getValues: () => Array.from({ length: h }, (_, i) => Array.from({ length: w }, (_, j) => cells[row - 1 + i]?.[c - 1 + j] ?? '')),
  getFormula: () => '', setValue: v => { cells[row - 1][c - 1] = v; } }) };
context.SpreadsheetApp = { getActiveSpreadsheet: () => ({ getSheetByName: () => sheet }) };
context.bumpSyncVersion = () => 'v'; context.getSyncVersion = () => 'v';

context.handleUpdateDevelopmentProgress('SM-0008', { workStatus: 'On Hold', holdReason: 'Waiting for client data', holdExtendTargetDate: '2026-11-12' });
assert.equal(cells[6][col('Reason for Hold') - 1], 'Waiting for client data');
assert.equal(cells[6][col('Hold Extend Target Date') - 1], '2026-11-12');

context.handleUpdateDevelopmentProgress('SM-0008', { workStatus: 'Completed', remarks: 'Done' });
assert.equal(cells[6][col('Work Status') - 1], 'Completed');
assert(cells[6][col('Actual 1') - 1], 'Actual 1 is stamped on completion');
assert.equal(cells[6][col('Reason for Hold') - 1], 'Waiting for client data', 'Hold reason survives completion');
assert.equal(cells[6][col('Hold Extend Target Date') - 1], '2026-11-12', 'Hold extend date survives completion');

// Holding again replaces the values instead of blanking them.
context.handleUpdateDevelopmentProgress('SM-0008', { workStatus: 'On Hold', holdReason: 'Second hold', holdExtendTargetDate: '2026-12-01' });
assert.equal(cells[6][col('Reason for Hold') - 1], 'Second hold');
assert.equal(cells[6][col('Hold Extend Target Date') - 1], '2026-12-01');
console.log('PASS: Reason for Hold and Hold Extend Target Date are kept when a held system is completed, and replaced by a new hold.');

// A completed system sent back to pending: its link / login cells were cleared in the sheet, but history still has them.
cells[6][col('Work Status') - 1] = ''; cells[6][col('Actual 1') - 1] = '';
cells[6][col('System Link / URL') - 1] = ''; cells[6][col('Admin ID / Username') - 1] = ''; cells[6][col('Password') - 1] = '';
props['REQMETA_SM-0008'] = JSON.stringify({ id: 'req-8', systemUrl: 'https://old.example', adminId: 'oldadmin', adminPassword: 'oldpass', introduction: { isCompleted: true } });
context.handleUpdateDevelopmentProgress('SM-0008', { workStatus: 'On Hold', holdReason: 'Waiting', holdExtendTargetDate: '2026-11-20', systemUrl: 'https://typed.example', adminId: 'typed', adminPassword: 'typed' });
assert.equal(cells[6][col('System Link / URL') - 1], '', 'Hold must not write the system link');
assert.equal(cells[6][col('Admin ID / Username') - 1], '');
assert.equal(cells[6][col('Password') - 1], '');
assert.equal(cells[6][col('Reason for Hold') - 1], 'Waiting');
const held = context.fetchAllRequests()[0];
assert.equal(held.systemUrl, '', 'A cleared sheet cell stays empty in the app');
context.handleUpdateDevelopmentProgress('SM-0008', { workStatus: 'In Progress', progressPercent: 30, systemUrl: 'https://typed.example', adminId: 'typed', adminPassword: 'typed' });
assert.equal(cells[6][col('System Link / URL') - 1], '', 'In Progress must not write the system link either');
context.handleUpdateDevelopmentProgress('SM-0008', { workStatus: 'Completed', systemUrl: 'https://final.example', adminId: 'final', adminPassword: 'finalpw' });
assert.equal(cells[6][col('System Link / URL') - 1], 'https://final.example');
assert.equal(cells[6][col('Admin ID / Username') - 1], 'final');
assert.equal(cells[6][col('Password') - 1], 'finalpw');
console.log('PASS: system link / admin login are written only when a system is completed and never revived from history.');
