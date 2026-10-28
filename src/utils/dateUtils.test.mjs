import assert from 'node:assert/strict';
import { formatDisplayDate, formatDisplayDateTime, calculateDueStatus } from './dateUtils.js';
import { normalizeSystemRequest } from './systemWorkflow.mjs';

const metadata = JSON.stringify({ id: 'req-SM-0003', requestNo: 'SM-0003', currentRevisionNo: null });
for (const invalid of [metadata, { requestNo: 'SM-0003' }, ['2026-10-28'], 'not-a-date', new Date('invalid')]) {
  assert.equal(formatDisplayDate(invalid), '-', 'Date fields must never display raw metadata or invalid values');
  assert.equal(formatDisplayDateTime(invalid), '-');
  assert.doesNotThrow(() => calculateDueStatus({ targetCompletionDate: invalid }));
}
assert.match(formatDisplayDate('2026-10-28'), /28 Oct 2026/);
assert.match(formatDisplayDateTime('2026-10-28T12:00:00Z'), /05:30 pm/i);
const normalized = normalizeSystemRequest({ id: 'req-SM-0003', currentStage: 'Update MIS System', upgradeTargetDate: metadata, targetCompletionDate: '2026-11-15' });
assert.equal(normalized.upgradeTargetDate, null);
assert.equal(normalized.targetCompletionDate, '2026-11-15');
console.log('PASS: date/timestamp displays reject JSON, objects and malformed values; valid dates and IST timestamps remain correct.');
