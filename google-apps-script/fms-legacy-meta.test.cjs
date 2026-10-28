const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

// Old deployments wrote JSON into extra "_Make_System_Metadata" columns (Y, Z, AA...). The cleanup must move it
// into Script Properties and empty every one of those columns, without touching Planned / Delay or real data.
const props = {};
const context = vm.createContext({
  Date,
  PropertiesService: { getScriptProperties: () => ({ getProperties: () => ({ ...props }), setProperty: (k, v) => { props[k] = v; }, getProperty: k => props[k] || null }) },
});
vm.runInContext(fs.readFileSync(`${__dirname}/Code.gs`, 'utf8'), context);

const headers = ['Timestamps', 'Request No.', 'Company', 'System Name', 'Planned 1', 'Actual 1', 'Delay 1', 'Final Status', '_Make_System_Metadata', '_Make_System_Metadata', '_Make_System_Metadata'];
const grid = Array.from({ length: 9 }, () => Array(headers.length).fill(''));
grid[5] = [...headers];
grid[6][1] = 'SM-0001'; grid[6][8] = JSON.stringify({ id: 'req-1', progressPercent: 40, createdBy: 'Admin' });
grid[7][1] = 'SM-0002'; grid[7][9] = JSON.stringify({ id: 'req-2', progressPercent: 70 });
grid[8][1] = 'SM-0003'; grid[8][10] = JSON.stringify({ id: 'req-3' });
grid[6][4] = 10; grid[6][6] = 99; // Planned 1 / Delay 1 values must survive

const sheet = {
  getLastColumn: () => headers.length, getLastRow: () => 9,
  getRange: (row, col, height = 1, width = 1) => ({
    getValues: () => Array.from({ length: height }, (_, i) => Array.from({ length: width }, (_, j) => grid[row - 1 + i]?.[col - 1 + j] ?? '')),
    clearContent() { for (let i = 0; i < height; i++) for (let j = 0; j < width; j++) grid[row - 1 + i][col - 1 + j] = ''; },
  }),
};
context.SpreadsheetApp = { getActiveSpreadsheet: () => ({ getSheetByName: () => sheet, toast() {} }) };

const result = context.clearLegacyMetadataColumn();
assert.equal(result.cleared, 3);
for (let c = 8; c <= 10; c++) for (let r = 5; r < 9; r++) assert.equal(grid[r][c], '', `column ${c + 1} row ${r + 1} is empty`);
assert.equal(grid[6][4], 10);
assert.equal(grid[6][6], 99);
assert.equal(grid[6][1], 'SM-0001');
assert.equal(JSON.parse(props['REQMETA_SM-0001']).progressPercent, 40);
assert.equal(JSON.parse(props['REQMETA_SM-0002']).progressPercent, 70);
assert(props['REQMETA_SM-0003']);
console.log('PASS: every _Make_System_Metadata column is moved into Script Properties and emptied; real FMS data untouched.');
