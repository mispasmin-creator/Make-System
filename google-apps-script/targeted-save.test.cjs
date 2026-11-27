const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(`${__dirname}/Code.gs`, 'utf8');
const events = [], cache = new Map(), properties = {};
const headers = ['Timestamps','Request No.','Requester','Company','System Name','Requirements Summary','Image','Work Status','Planned','Actual','Delay','Assigned Developer','Target Date','Planned 1','Actual 1','Delay 1','System Link / URL','Admin ID / Username','Password','Reason for Hold','Hold Extend Target Date','Planned 2','Actual 2','Delay 2','Status','Planned 4','Actual 4','Delay 4','Final Status'];
const col = heading => headers.indexOf(heading) + 1;
const rows = Array.from({ length: 206 }, () => Array(headers.length).fill(''));
rows[5] = headers;
for (let i = 1; i <= 200; i++) {
  const no = `SM-${String(i).padStart(4, '0')}`, row = rows[i + 5];
  row[col('Request No.') - 1] = no; row[col('Requester') - 1] = 'Owner';
  row[col('Work Status') - 1] = 'In Progress'; row[col('Actual') - 1] = new Date('2026-11-01');
  row[col('Assigned Developer') - 1] = 'Developer'; row[col('Target Date') - 1] = '2026-12-15';
  row[col('Final Status') - 1] = 'In Progress';
  properties['REQMETA_' + no] = JSON.stringify({ id: 'req-' + i, currentStage: 'Create System', introduction: { isCompleted: true }, activityLog: [], customIntegration: 'keep' });
  properties['REQID_req-' + i] = no;
}
const loginRows = [['Full Name','User','Role','Password','Status','Department','Created']];
for (let i = 0; i < 100; i++) loginRows.push(['Person ' + i, 'person' + i, 'User', 'example', 'Active', 'IT', '2026-11-01']);
loginRows[24] = ['Admin', 'admin', 'Admin', 'example', 'Active', 'IT', '2026-11-01'];
const formulas = new Set();
function makeSheet(name, grid, id) {
  return {
    getLastRow: () => grid.length, getLastColumn: () => grid[0].length,
    getParent: () => ({ getId: () => 'test-book' }), getSheetId: () => id,
    getRange(row, column, height = 1, width = 1) {
      return {
        getValues() { events.push({ op: 'read', sheet: name, row, column, height, width }); return Array.from({ length: height }, (_, i) => Array.from({ length: width }, (_, j) => grid[row - 1 + i]?.[column - 1 + j] ?? '')); },
        getFormula() { events.push({ op: 'formula', sheet: name, row, column }); return formulas.has(`${row}:${column}`) ? '=1' : ''; },
        setValue(value) { events.push({ op: 'write', sheet: name, row, column }); grid[row - 1][column - 1] = value; },
        createTextFinder(value) { assert.equal(width, 1); events.push({ op: 'find', sheet: name, column }); return { matchCase() { return this; }, matchEntireCell() { return this; }, findAll() { return grid.flatMap((r, i) => i + 1 >= row && i + 1 < row + height && String(r[column - 1] || '').toLowerCase() === String(value).toLowerCase() ? [{ getRow: () => i + 1 }] : []); } }; }
      };
    }
  };
}
const fms = makeSheet('FMS', rows, 1), login = makeSheet('Login Page', loginRows, 2);
const context = vm.createContext({ Date, console,
  LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
  CacheService: { getScriptCache: () => ({ get: key => cache.get(key) || null, put: (key, value) => cache.set(key, value) }) },
  SpreadsheetApp: { getActiveSpreadsheet: () => ({ getSheetByName: name => ({ FMS: fms, 'Login Page': login })[name] }) },
  PropertiesService: { getScriptProperties: () => ({ getProperty: key => { events.push({ op: 'property', key }); return properties[key] || null; }, setProperty: (key, value) => { properties[key] = value; }, getProperties() { throw new Error('A save must never load all request metadata'); } }) }
});
vm.runInContext(source, context);
context.verifySessionToken = () => 'admin'; context.jsonResponse = result => result;
const reference = { requestId: 'req-40', requestNo: 'SM-0040', sheetRowIndex: 46 };
function save(action, data = {}, ref = reference) {
  events.length = 0;
  return context.doPost({ postData: { contents: JSON.stringify({ action, ...ref, data }) } });
}
let result = save('updateDevelopmentProgress', { workStatus: 'In Progress', progressPercent: 50, remarks: 'Progress only' });
assert(!result.error, result.error);
assert.equal(events.filter(e => e.op === 'read').length, 4, 'Only Login header + signed-in row + FMS header + selected row');
assert(events.filter(e => e.op === 'read').every(e => e.height === 1), 'No entire FMS or Login table may be read');
assert.equal(events.filter(e => e.op === 'write').length, 0, 'An unchanged Work Status needs only metadata update');
result = save('updateDevelopmentProgress', { workStatus: 'On Hold', holdReason: 'Dependency', holdExtendTargetDate: '2026-12-20' });
assert(!result.error, result.error);
assert.deepEqual(events.filter(e => e.op === 'write').map(e => e.column).sort((a,b) => a-b), [col('Work Status'), col('Reason for Hold'), col('Hold Extend Target Date')]);
assert(events.filter(e => e.op === 'write').every(e => e.row === 46));
assert.equal(JSON.parse(properties.REQMETA_SM_0040 || properties['REQMETA_SM-0040']).customIntegration, 'keep');
console.log('PASS: 200-record FMS / 100-user Login: save reads exactly 4 single rows, no bulk metadata; progress writes 0 sheet cells, hold changes only 3 required cells.');

// A sort moves the record. A stale client hint must never write to its old row.
[rows[45], rows[46]] = [rows[46], rows[45]];
result = save('updateDevelopmentProgress', { workStatus: 'In Progress', progressPercent: 75, remarks: 'Moved row' });
assert(!result.error, result.error); assert.equal(result.request.sheetRowIndex, 47);
assert(events.filter(e => e.op === 'write').every(e => e.row === 47));
assert(events.some(e => e.op === 'find' && e.sheet === 'FMS'));
assert(events.filter(e => e.op === 'read' && e.sheet === 'FMS').every(e => e.height === 1));
assert(!save('updateDevelopmentProgress', { workStatus: 'In Progress', remarks: 'Forged reference' }, { ...reference, requestId: 'req-41' }).request);
assert.equal(events.filter(e => e.op === 'write').length, 0);
console.log('PASS: sorted rows resolve by Request No.; mismatched IDs never modify another record.');

formulas.add(`47:${col('Reason for Hold')}`);
result = save('updateDevelopmentProgress', { workStatus: 'On Hold', holdReason: 'New reason' });
assert.match(result.error, /formula will not be overwritten/);
assert.equal(events.filter(e => e.op === 'write').length, 0, 'Formula validation happens before any cell is written');
formulas.clear();
// Permissions are read fresh even with a cached Login row pointer.
loginRows[24][4] = 'Inactive';
result = save('updateDevelopmentProgress', { workStatus: 'In Progress', remarks: 'Inactive' });
assert.match(result.error, /inactive or removed/); assert.equal(events.filter(e => e.op === 'write').length, 0);
loginRows[24][4] = 'Active';
events.length = 0;
const readback = context.doGet({ parameter: { action: 'getRequest', ...reference, token: 'test' } });
assert.equal(readback.request.requestNo, reference.requestNo);
assert(events.filter(e => e.op === 'read').every(e => e.height === 1));
console.log('PASS: formulas and inactive accounts are protected; single-record GET avoids full-sheet readback.');

// Removing a row must not resurrect it from cached metadata or a row hint.
rows[46] = Array(headers.length).fill('');
result = save('updateDevelopmentProgress', { workStatus: 'In Progress', remarks: 'Deleted record' });
assert.match(result.error, /not found/); assert.equal(events.filter(e => e.op === 'write').length, 0);
assert(events.filter(e => e.op === 'read').every(e => e.height === 1 || e.width === 1));
console.log('PASS: deleted-row fallback inspects at most the Request No. column and never writes an unrelated row.');

// Legacy Login rows can still use the username derived from Full Name.
loginRows[24][1] = '';
assert.equal(context.authorizeAppAction('getRequests', 'test').role, 'Admin');
console.log('PASS: legacy derived usernames remain compatible without loading all Login user records.');
