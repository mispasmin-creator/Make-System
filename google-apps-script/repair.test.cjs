const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
// Live layout: Assign Developer inserted at L, Time Delay moved next to the approval Actual.
const headers = ['Timestamp','Sr No.','Name Of The Person','Company','Things Not Working','Location Of Problem','Image','Planned','Actual','Time Delay','Problem','Where Have To Solve','Assign Developer','Planned','Actual','Time Delay','Status'];
const col = (name, n = 0) => headers.reduce((acc, h, i) => h === name ? [...acc, i + 1] : acc, [])[n];
const rows = [Array(17).fill('')];
const notes = {};
const props = {};
const formulaCols = [8, 10, 14, 16]; // H, J, N, P: Planned / Time Delay
const formulas = Object.fromEntries(formulaCols.map(c => [`7:${c}`, '=1+1']));
const before = JSON.stringify(formulas), writes = [];
const sheet = {
  getLastRow: () => 7, getLastColumn: () => 17, getMaxRows: () => 100,
  getRange(row,c,count=1,width=1) { const key = `${row}:${c}`; return {
    getValues: () => row === 6 ? [headers] : rows.slice(row-7,row-7+count).map(r => r.slice(c-1,c-1+width)),
    getNotes: () => Array.from({length:count},(_,i) => [notes[`${row+i}:${c}`] || '']),
    getNote: () => notes[key] || '', setNote: value => { notes[key]=value; },
    getFormula: () => formulas[key] || '', setNumberFormat() {},
    setValue(value) { assert(!formulaCols.includes(c), 'formula column written: ' + c); assert(!formulas[key]); writes.push(key); rows[row-7][c-1]=value; }
  }; }
};
const context = {
  SpreadsheetApp:{getActiveSpreadsheet:()=>({getSheetByName:()=>sheet}),flush(){}},
  LockService:{getScriptLock:()=>({waitLock(){},releaseLock(){}})},
  PropertiesService:{getScriptProperties:()=>({getProperty:k=>props[k]||null,setProperty:(k,v)=>{props[k]=v;},getProperties:()=>({...props})})}
};
vm.createContext(context);
vm.runInContext(fs.readFileSync(`${__dirname}/Code.gs`,'utf8'),context);
context.fetchMasterOptions = () => ({ companies:['RKL'], developers:['Ahitesh Tandon'] });
const create = {data:{requester:'Person',company:'RKL',description:'Broken',location:'Office',attachments:[{name:'photo.jpg',type:'image/jpeg',url:'https://drive.google.com/file/d/abc/view?usp=sharing'}]},idempotencyKey:'one',actorName:'Person'};
let issue = context.saveRepairIssue('createRepairIssue',create);
assert.equal(issue.serial,'RS - 001');
assert.equal(issue.attachments.length,1,'Drive link kept with the issue');
assert.equal(issue.attachments[0].url,'https://drive.google.com/file/d/abc/view?usp=sharing');
assert.equal(issue.raisedBy,'Person');
const count = writes.length;
assert.equal(context.saveRepairIssue('createRepairIssue',create).serial,issue.serial);
assert.equal(writes.length,count);
assert.throws(()=>context.saveRepairIssue('approveRepairIssue',{id:issue.id,expectedVersion:1,data:{repairRequired:'Yes',whereToSolve:'Workshop',assignedDeveloper:'Nobody'}}),/Master/);
issue = context.saveRepairIssue('approveRepairIssue',{id:issue.id,expectedVersion:1,data:{repairRequired:'Yes',whereToSolve:'Workshop',assignedDeveloper:'Ahitesh Tandon'}});
assert.equal(issue.assessment.assignedDeveloper,'Ahitesh Tandon');
assert.equal(rows[0][col('Assign Developer')-1],'Ahitesh Tandon', 'Developer is saved in the Assign Developer column');
assert.equal(rows[0][col('Where Have To Solve')-1],'Workshop');
assert.equal(col('Image'),7);
assert.equal(rows[0][6],'https://drive.google.com/file/d/abc/view?usp=sharing','Photo / PDF link is saved in column G (Image)');
assert.equal(rows[0][col('Assign Developer')-1],'Ahitesh Tandon');
assert.equal(rows[0][16],'Pending Repair','Status is column Q');
assert(issue.approval.actual);
assert.equal(issue.repair.status,'Pending Repair');
assert.throws(()=>context.saveRepairIssue('resolveRepairIssue',{id:issue.id,expectedVersion:1,data:{remarks:'Fixed'}}),/changed/);
assert.throws(()=>context.saveRepairIssue('resolveRepairIssue',{id:issue.id,expectedVersion:2,data:{remarks:' '}}),/Remark/);
issue = context.saveRepairIssue('resolveRepairIssue',{id:issue.id,expectedVersion:2,data:{remarks:'Fixed cable'}});
assert.equal(issue.repair.remarks,'Fixed cable');
assert.equal(issue.repair.status,'Resolved');
assert.equal(rows[0][16],'Resolved');
assert(rows[0][14] instanceof Date || rows[0][14],'Repair Actual is column O');
assert(issue.repair.actual);
assert.throws(()=>context.saveRepairIssue('resolveRepairIssue',{id:issue.id,expectedVersion:3,data:{remarks:'Again'}}),/not pending/);
// Photos / PDFs: links land in the optional Attachments column; a link that is not a Drive URL is rejected before any write.
assert.throws(()=>context.saveRepairIssue('createRepairIssue',{data:{requester:'P',company:'RKL',description:'x',attachments:[{name:'a.png',url:'data:image/png;base64,AAAA'}]},idempotencyKey:'bad'}),/not uploaded/);
assert.equal(context.repairAttachments('', {attachments:[{name:'a.pdf',url:'https://drive.google.com/file/d/1/view'}]})[0].name,'a.pdf');
assert.equal(context.repairAttachments('https://drive.google.com/file/d/2/view\nhttps://drive.google.com/file/d/3/view',{}).length,2);
assert.equal(context.repairAttachments('https://drive.google.com/file/d/9/view',{attachments:[{name:'cable.jpg',type:'image/jpeg',url:'https://drive.google.com/file/d/9/view'}]})[0].type,'image/jpeg');
assert.equal(context.repairAttachments('https://drive.google.com/file/d/9/view',{})[0].name,'Attachment 1');
assert.equal(JSON.stringify(formulas),before);
// Version/idempotency/remarks live in Script Properties; the Sr No. cell never keeps a note.
assert(Object.keys(notes).every(k => !notes[k]), 'No cell note may be left behind');
assert.equal(JSON.parse(props['REPAIRMETA_RS - 001']).version,3);

// A legacy note is still read, then removed on the next save and by the menu cleanup.
notes['7:2'] = JSON.stringify({version:3,idempotencyKey:'one',remarks:'legacy'});
delete props['REPAIRMETA_RS - 001'];
assert.equal(context.fetchRepairIssues()[0].version,3);
assert.equal(context.clearRepairNotes().cleared,1);
assert.equal(notes['7:2'],'');
assert.equal(JSON.parse(props['REPAIRMETA_RS - 001']).remarks,'legacy');

headers[7]='Wrong';
assert.throws(()=>context.fetchRepairIssues(),/missing the heading/);
headers[7]='Planned';
rows[0][8]=''; rows[0][14]=''; formulas['7:11']='=1';
const prior = writes.length;
assert.throws(()=>context.saveRepairIssue('approveRepairIssue',{id:issue.id,expectedVersion:3,data:{repairRequired:'Yes',whereToSolve:'Office'}}),/protected/);
assert.equal(writes.length,prior);
console.log('PASS: Repair heading-based mapping with Assign Developer column, no cell notes, create/approval/resolution round-trip, idempotency, stale validation and Planned/Time Delay formula preservation.');
