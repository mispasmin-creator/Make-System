const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const context = vm.createContext({ Utilities: { formatDate: (date, timezone, pattern) => {
  assert.equal(timezone, 'Asia/Kolkata');
  assert.equal(pattern, 'yyyy-MM-dd');
  return date.toISOString().slice(0, 10);
} } });
vm.runInContext(fs.readFileSync(`${__dirname}/Code.gs`, 'utf8'), context);
const metadata = JSON.stringify({ id:'req-SM-0003', requestNo:'SM-0003', currentRevisionNo:null });
for (const value of [metadata, {}, [], 'not-a-date']) {
  assert.equal(context.formatDateCell(value), '');
  assert.equal(context.formatTimestampCell(value), '');
}
const instant = vm.runInContext("new Date('2026-10-28T12:00:00.000Z')", context);
assert.equal(context.formatDateCell(instant), '2026-10-28');
assert.equal(context.formatTimestampCell(instant), '2026-10-28T12:00:00.000Z', 'Do not label an IST-shifted time as UTC');
assert.equal(context.formatDateCell('2026-11-15'), '2026-11-15');
console.log('PASS: Apps Script date fields reject metadata; timestamps preserve the original UTC instant for IST display.');
