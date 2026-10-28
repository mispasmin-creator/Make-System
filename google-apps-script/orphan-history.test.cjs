const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const props = {
  'REQMETA_SM-0001': '{"id":"req-1"}', 'REQMETA_SM-0002': '{"id":"req-2"}',
  'REPAIRMETA_RS - 001': '{"version":3}', 'REPAIRMETA_RS - 002': '{"version":1}',
  'TECHMETA_TH - 001': '{"raisedBy":"Old"}', 'TECHMETA_TH - 002': '{"raisedBy":"Ravi"}',
  SESSION_SECRET: 'keep-me', MAKE_SYSTEM_SYNC_VERSION: '1',
};
const context = vm.createContext({ Date, PropertiesService: { getScriptProperties: () => ({ getProperties: () => ({ ...props }), setProperty: (k, v) => { props[k] = v; }, getProperty: k => props[k] || null, deleteProperty: k => { delete props[k]; } }) } });
vm.runInContext(fs.readFileSync(`${__dirname}/Code.gs`, 'utf8'), context);
// Only SM-0002, RS - 002 and TH - 002 still exist in the sheets.
context.getRequestsSheet = () => ({ getLastRow: () => 7, getLastColumn: () => 3, getRange: (r, c, h = 1, w = 1) => ({ getValues: () => (r === 7 ? [['SM-0002']] : Array.from({ length: h }, () => Array(w).fill(''))) }) });
context.findHeaderMapping = () => ({ dataStartRow: 7, colRequestNo: 2 });
context.repairSheet = () => ({});
context.repairRows = () => [{ serial: 'RS - 002' }];
context.fetchTechnicalTickets = () => [{ ticketNo: 'TH - 002' }];
context.bumpSyncVersion = () => 'v';
context.SpreadsheetApp = { getActiveSpreadsheet: () => ({ toast() {} }) };
const result = context.cleanOrphanHistory();
assert.equal(result.removed, 3);
assert(!('REQMETA_SM-0001' in props) && !('REPAIRMETA_RS - 001' in props) && !('TECHMETA_TH - 001' in props));
assert('REQMETA_SM-0002' in props && 'REPAIRMETA_RS - 002' in props && 'TECHMETA_TH - 002' in props);
assert.equal(props.SESSION_SECRET, 'keep-me', 'Login secret and sync version are never removed');
console.log('PASS: history of deleted rows is removed; live rows and the login secret are kept.');
