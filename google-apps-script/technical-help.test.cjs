const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const code = fs.readFileSync(`${__dirname}/Code.gs`, 'utf8');
new vm.Script(code);
let headers;
const writes = [];
let existingTickets = [];
let existingAssignees = [];
const formats = [];
const sheet = {
  getLastRow: () => 6 + existingTickets.length, getLastColumn: () => headers.length, getMaxRows: () => 100,
  getRange: (row, column) => ({ getValues: () => row === 6 ? [headers] : column === headers.indexOf('Ticket') + 1 ? existingTickets : existingAssignees, setValue: value => writes.push({ row, column, value }), setNumberFormat: value => formats.push(value), setNote: () => { throw new Error('Extra metadata must not be saved'); } })
};
const context = {
  SpreadsheetApp: { flush() {}, getActiveSpreadsheet: () => ({ getSheetByName: () => ({ getLastRow: () => 3, getRange: () => ({ getValues: () => [['DME One'], ['DME Two']] }) }) }) },
  LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
  Utilities: { formatDate: () => '22/10/2026 12:00:00', getUuid: () => '12345678-abcd' }
};
vm.createContext(context);
vm.runInContext(code, context);
headers = Array.from(context.TECHNICAL_HELP_HEADERS);
context.getTechnicalHelpSheet = () => sheet;
context.handleCreateTechnicalTicket({ company: 'PMMPL', application: 'FMS', sheetPage: 'Orders', problem: 'Formula error', correction: 'Fix formula', requester: 'Admin' });
assert(writes.length > 0);
assert(writes.every(w => w.row === 7));
assert.equal(headers.length, 16);
assert(writes.every(w => ![13, 14, 15].includes(w.column)));
assert.equal(writes.find(w => w.column === 5).value, 'FMS / Orders');
assert.equal(writes.find(w => w.column === 4).value, 'Admin');
const columns = context.technicalHelpColumns(sheet);
assert.throws(() => context.writeTechnicalHelpCell(sheet, 7, columns, 'Planned', 'bad'));
assert.throws(() => context.writeTechnicalHelpCell(sheet, 7, columns, 'Delay', 'bad'));
// Header-based protection still works when formula columns move.
[headers[0], headers[12]] = [headers[12], headers[0]];
writes.length = 0;
context.handleCreateTechnicalTicket({ company: 'PMMPL', application: 'FMS', sheetPage: 'Orders', problem: 'Formula error', correction: 'Fix formula', submissionType: 'On Behalf', onBehalfOf: 'Store Manager' });
assert(writes.every(w => ![1, 14, 15].includes(w.column)));
assert.equal(writes.find(w => w.column === 4).value, 'Store Manager');
console.log('PASS: script syntax, row 7 mapping, requester, protected formula columns and reordered headers.');
headers = Array.from(context.TECHNICAL_HELP_HEADERS).filter(h => h !== 'Reassign');
writes.length = 0;
context.handleCreateTechnicalTicket({ company: 'PMMPL', application: 'FMS', sheetPage: 'Orders', problem: 'Formula error', correction: 'Fix formula', requester: 'Admin' });
const withoutReassign = context.technicalHelpColumns(sheet);
assert.equal(withoutReassign.reassign, undefined);
assert.equal(withoutReassign.overdueremaining, undefined);
assert(writes.every(w => ![withoutReassign.planned, withoutReassign.delay].includes(w.column)));
console.log('PASS: Reassign omitted; shifted Planned and Delay columns remain untouched.');
assert.equal(writes.find(w => w.column === withoutReassign.ticket).value, 'TH - 001');
assert.equal(writes.find(w => w.column === withoutReassign.assignedto).value, 'DME One');
assert.equal(Object.prototype.toString.call(writes.find(w => w.column === withoutReassign.requestdateist).value), '[object Date]');
assert(formats.every(f => f === 'MM/dd/yyyy HH:mm:ss'));
existingTickets = [['TH - 001']]; existingAssignees = [['DME One']]; writes.length = 0;
context.handleCreateTechnicalTicket({ company: 'PMMPL', application: 'FMS', sheetPage: 'Orders', problem: 'Formula error', correction: 'Fix formula' });
assert.equal(writes.find(w => w.column === withoutReassign.ticket).value, 'TH - 002');
assert.equal(writes.find(w => w.column === withoutReassign.assignedto).value, 'DME Two');
existingTickets.push(['TH - 002']); existingAssignees.push(['DME Two']); writes.length = 0;
context.handleCreateTechnicalTicket({ company: 'PMMPL', application: 'FMS', sheetPage: 'Orders', problem: 'Formula error', correction: 'Fix formula' });
assert.equal(writes.find(w => w.column === withoutReassign.ticket).value, 'TH - 003');
assert.equal(writes.find(w => w.column === withoutReassign.assignedto).value, 'DME One');
console.log('PASS: real date values, date formatting, sequential ticket numbers and alternating Master DMEs.');
writes.length = 0;
context.handleCreateTechnicalTicket({ company: 'PMMPL', application: 'FMS', sheetPage: 'Orders', problem: 'Formula error', correction: 'Fix formula', attachments: [{ driveUrl:'https://drive.google.com/file/d/one/view' }, { url:'https://drive.google.com/file/d/two/view' }] });
assert.equal(writes.find(w => w.column === 10).value, 'https://drive.google.com/file/d/one/view\nhttps://drive.google.com/file/d/two/view');
console.log('PASS: multiple uploaded Drive attachment links saved in J.');
// Submit writes Actual only; retry preserves the saved timestamp.
headers = Array.from(context.TECHNICAL_HELP_HEADERS);
const savedActual = new Map();
sheet.getLastRow = () => 7;
sheet.getRange = (row, column) => ({
  getValues: () => row === 6 ? [headers] : [['TH - 001']],
  getValue: () => savedActual.get(`${row}:${column}`) || '',
  setValue: value => { writes.push({ row, column, value }); savedActual.set(`${row}:${column}`, value); },
  setNumberFormat: value => formats.push(value)
});
writes.length = 0;
assert.throws(() => context.handleSubmitTechnicalTicket('TH - 001', '  '), /remark is required/);
assert.equal(writes.length, 0);
const firstSubmit = context.handleSubmitTechnicalTicket('TH - 001', 'Fixed the formula');
assert.equal(writes.length, 3);
assert.equal(writes[0].column, 16);
assert.equal(writes[0].value, 'Fixed the formula');
assert.equal(writes[1].column, headers.indexOf('Actual') + 1);
assert.equal(writes[0].row, 7);
const retrySubmit = context.handleSubmitTechnicalTicket('TH - 001', 'Different remark');
assert.equal(retrySubmit.actualDate, firstSubmit.actualDate);
assert.equal(retrySubmit.resolvedRemark, 'Fixed the formula');
assert.equal(firstSubmit.status, 'Resolved');
assert.equal(retrySubmit.status, 'Resolved');
assert.equal(writes[2].column, headers.indexOf('Status') + 1);
assert.equal(writes[2].value, 'Resolved');
assert.equal(writes.length, 4);
assert.throws(() => context.handleSubmitTechnicalTicket('TH - 999', 'Fixed'), /not found/);
assert.equal(writes.length, 4);
console.log('PASS: submit requires remark, writes column O and Actual only; retries preserve both.');
headers = ['Delay', 'Ticket Number', 'Company Name', 'Planned', 'Actual Date', 'Ticket Status', 'Resolved Remarks'];
const flexible = context.technicalHelpColumns(sheet);
assert.equal(flexible.ticket, 2);
assert.equal(flexible.company, 3);
assert.equal(flexible.actual, 5);
assert.equal(flexible.resolvedremark, 7);
writes.length = 0;
context.writeTechnicalHelpCell(sheet, 8, flexible, 'Application & Page', 'Missing optional field');
assert.equal(writes.length, 0);
context.writeTechnicalHelpCell(sheet, 8, flexible, 'Company', 'PMMPL');
assert.equal(writes[0].column, 3);
assert.throws(() => context.writeTechnicalHelpCell(sheet, 8, flexible, 'Planned', 'bad'));
sheet.getRange = () => ({ getFormula: () => '=NOW()', setValue: () => { throw new Error('Must not write'); } });
assert.throws(() => context.writeTechnicalHelpCell(sheet, 8, flexible, 'Company', 'bad'), /Existing formula/);
console.log('PASS: header aliases, missing optional columns, moved formula columns and existing cell formulas.');
