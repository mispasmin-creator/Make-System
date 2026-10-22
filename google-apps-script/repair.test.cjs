const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const headers = ['Timestamp','Sr No.','Name Of The Person','Company','Things Not Working','Location Of Problem','Planned','Actual','Problem','Where Have To Solve','Time Delay','Planned','Actual','Status','Time Delay'];
const rows = [Array(15).fill('')];
const notes = {};
const formulas = { '7:7':'=A7+1', '7:11':'=H7-G7', '7:12':'=H7+3', '7:15':'=M7-L7' };
const before = JSON.stringify(formulas), writes = [];
const sheet = {
  getLastRow: () => 7, getMaxRows: () => 100,
  getRange(row,col,count=1,width=1) { const key = `${row}:${col}`; return {
    getValues: () => row === 6 ? [headers] : rows.slice(row-7,row-7+count).map(r => r.slice(col-1,col-1+width)),
    getNotes: () => Array.from({length:count},(_,i) => [notes[`${row+i}:${col}`] || '']),
    getNote: () => notes[key] || '', setNote: value => { notes[key]=value; },
    getFormula: () => formulas[key] || '', setNumberFormat() {},
    setValue(value) { assert(![7,11,12,15].includes(col)); assert(!formulas[key]); writes.push(key); rows[row-7][col-1]=value; }
  }; }
};
const context = { SpreadsheetApp:{getActiveSpreadsheet:()=>({getSheetByName:()=>sheet}),flush(){}},LockService:{getScriptLock:()=>({waitLock(){},releaseLock(){}})} };
vm.createContext(context);
vm.runInContext(fs.readFileSync(`${__dirname}/Code.gs`,'utf8'),context);
const create = {data:{requester:'Person',company:'RKL',description:'Broken',location:'Office'},idempotencyKey:'one'};
let issue = context.saveRepairIssue('createRepairIssue',create);
assert.equal(issue.serial,'RS - 001');
const count = writes.length;
assert.equal(context.saveRepairIssue('createRepairIssue',create).serial,issue.serial);
assert.equal(writes.length,count);
issue = context.saveRepairIssue('approveRepairIssue',{id:issue.id,expectedVersion:1,data:{repairRequired:'Yes',whereToSolve:'Workshop'}});
assert(issue.approval.actual);
assert.equal(issue.repair.status,'Pending Repair');
assert.throws(()=>context.saveRepairIssue('resolveRepairIssue',{id:issue.id,expectedVersion:1,data:{remarks:'Fixed'}}),/changed/);
assert.throws(()=>context.saveRepairIssue('resolveRepairIssue',{id:issue.id,expectedVersion:2,data:{remarks:' '}}),/Remark/);
issue = context.saveRepairIssue('resolveRepairIssue',{id:issue.id,expectedVersion:2,data:{remarks:'Fixed cable'}});
assert.equal(issue.repair.remarks,'Fixed cable');
assert.equal(issue.repair.status,'Resolved');
assert(issue.repair.actual);
assert.throws(()=>context.saveRepairIssue('resolveRepairIssue',{id:issue.id,expectedVersion:3,data:{remarks:'Again'}}),/not pending/);
assert.equal(JSON.stringify(formulas),before);
headers[6]='Wrong';
assert.throws(()=>context.fetchRepairIssues(),/header mismatch/);
headers[6]='Planned';
rows[0][7]=''; rows[0][12]=''; formulas['7:10']='=1';
const prior = writes.length;
assert.throws(()=>context.saveRepairIssue('approveRepairIssue',{id:issue.id,expectedVersion:3,data:{repairRequired:'Yes',whereToSolve:'Office'}}),/protected/);
assert.equal(writes.length,prior);
console.log('PASS: Repair mapping, create/approval/resolution round-trip, remarks, idempotency, stale/duplicate validation, formula preflight and G/K/L/O preservation.');
