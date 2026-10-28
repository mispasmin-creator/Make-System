import assert from 'node:assert/strict';
import { sortNewestFirst } from './sortUtils.js';

const sheetOrder = [
  { ticketNo: 'TH - 001', createdAt: '2026-10-20T10:00:00.000Z' },
  { ticketNo: 'TH - 003', createdAt: '2026-10-22T10:00:00.000Z' },
  { ticketNo: 'TH - 002', createdAt: '2026-10-21T10:00:00.000Z' },
];
assert.deepEqual(sortNewestFirst(sheetOrder, 'createdAt', 'ticketNo').map(t => t.ticketNo), ['TH - 003', 'TH - 002', 'TH - 001']);
// Same timestamp (or missing dates): the higher number is newer.
assert.deepEqual(sortNewestFirst([{ s: 'RS - 001' }, { s: 'RS - 010' }, { s: 'RS - 002' }], 'createdAt', 's').map(t => t.s), ['RS - 010', 'RS - 002', 'RS - 001']);
// A local optimistic row and the later sheet read land in the same position.
const local = sortNewestFirst([{ ticketNo: 'TH - 004', createdAt: '2026-10-23T10:00:00.000Z' }, ...sheetOrder], 'createdAt', 'ticketNo');
const synced = sortNewestFirst([...sheetOrder, { ticketNo: 'TH - 004', createdAt: '2026-10-23T10:00:00.000Z' }], 'createdAt', 'ticketNo');
assert.deepEqual(local, synced);
console.log('PASS: newest-first ordering is identical before and after the sheet sync.');
