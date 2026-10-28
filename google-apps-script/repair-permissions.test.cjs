const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const grid = [['Full Name','User','Role','Password','Status','Department','Created','Custom Column']];
const sessions = new Map();
let uuid = 0;
const sheet = {
  getLastRow:()=>grid.length, getLastColumn:()=>grid[0].length, getMaxRows:()=>100, getMaxColumns:()=>100,
  getRange(row,col=1,count=1,width=1) { return {
    getValues:()=>Array.from({length:count},(_,r)=>Array.from({length:width},(_,c)=>grid[row-1+r]?.[col-1+c] ?? '')),
    setValues(values){ values.forEach((r,i)=>r.forEach((v,j)=>{grid[row-1+i] ||= []; grid[row-1+i][col-1+j]=v;})); return this; },
    setValue(value){ return this.setValues([[value]]); },setFontWeight(){ return this; },
    clearContent(){ for(let r=0;r<count;r++)for(let c=0;c<width;c++){grid[row-1+r] ||= [];grid[row-1+r][col-1+c]='';} }
  }; }
};
const crypto = require('node:crypto');
let secret = '';
const b64 = b => Buffer.from(b).toString('base64url');
const context = {Date,Utilities:{formatDate:()=> 'today',getUuid:()=>String(++uuid),base64EncodeWebSafe:v=>b64(v),base64DecodeWebSafe:v=>Buffer.from(v,'base64url'),computeHmacSha256Signature:(v,k)=>crypto.createHmac('sha256',k).update(v).digest(),newBlob:bytes=>({getDataAsString:()=>Buffer.from(bytes).toString()})},CacheService:{getScriptCache:()=>({put:(k,v)=>sessions.set(k,v),get:k=>sessions.get(k)})},PropertiesService:{getScriptProperties:()=>({setProperty(k,v){ if(k==='SESSION_SECRET') secret=v; },getProperty:k=>k==='SESSION_SECRET'?secret:'1'})}};
vm.createContext(context);
vm.runInContext(fs.readFileSync(`${__dirname}/Code.gs`,'utf8'),context);
context.getLoginSheet=()=>sheet;
const user={username:'worker',fullName:'Worker',role:'User',status:'Active',password:'secret123',permissions:{'repair-new':{view:true,update:true},'repair-approval':{view:true},'repair-work':{view:false}}};
grid[1]=Array(8).fill('');grid[1][7]='preserve me';
context.handleSaveUsers([user]);
let loaded=context.fetchAllUsers()[0];
assert.equal(loaded.permissions['repair-new'].update,true);
assert.equal(loaded.permissions['repair-approval'].view,true);
assert.equal(loaded.permissions['repair-approval'].update,false);
assert.equal(loaded.permissions.requests.view,false);
assert.equal(grid[1][7],'preserve me');
assert(!grid[0].includes('Permitted Stages'),'The removed Permitted Stages column must not come back');
for(const heading of ['Make System Access','Technical Help Access','Repair System Access','Resolve Problem View','Resolve Problem Update']) assert(grid[0].includes(heading));
loaded.permissions['repair-approval'].view=false;
loaded.permissions['repair-work']={view:true,update:true};
context.handleSaveUsers([loaded]);
loaded=context.fetchAllUsers()[0];
assert.equal(loaded.permissions['repair-approval'].view,false);
assert.equal(loaded.permissions['repair-work'].update,true);
const login=context.loginAppUser({username:'worker',password:'secret123'});
assert(!('password' in login.user));
assert.throws(()=>context.authorizeAppAction('updateUser',login.token),/Only Admin/);
assert.throws(()=>context.authorizeAppAction('getTechnicalTickets',login.token),/No access/);
context.authorizeAppAction('resolveRepairIssue',login.token);
assert.throws(()=>context.authorizeAppAction('resolveRepairIssue','fake'),/Session expired/);
assert.throws(()=>context.authorizeAppAction('resolveRepairIssue',login.token.slice(0,-2)+'xx'),/Session expired/);
const realNow=Date.now; Date.now=()=>realNow()+29*24*3600*1000; context.authorizeAppAction('resolveRepairIssue',login.token);
Date.now=()=>realNow()+31*24*3600*1000; assert.throws(()=>context.authorizeAppAction('resolveRepairIssue',login.token),/Session expired/); Date.now=realNow;
grid[1][grid[0].indexOf('Repair System Access')]='No';
assert.throws(()=>context.authorizeAppAction('resolveRepairIssue',login.token),/denied/);
assert.throws(()=>context.loginAppUser({username:'worker',password:'wrong'}),/Invalid/);
// A PMMPL-prefixed password is just a password: access follows the saved permissions only.
context.handleSaveUsers([
  {username:'pmmpl1',fullName:'Plant One',role:'User',password:'PMMPL-1',permissions:{requests:{view:true,update:true}}},
  {username:'pmmpladmin',fullName:'Plant Admin',role:'Admin',password:'PMMPL123',permissions:{}}
]);
loaded=context.fetchAllUsers();
assert(!('technicalOnly' in loaded[0]));
assert.equal(loaded[0].permissions.requests.update,true);
assert.equal(loaded[0].permissions['technical-new'].view,false);
const plant=context.loginAppUser({username:'pmmpl1',password:'PMMPL-1'});
context.authorizeAppAction('createRequest',plant.token);
assert.throws(()=>context.authorizeAppAction('createTechnicalTicket',plant.token),/denied/);
context.authorizeAppAction('updateUser',context.loginAppUser({username:'pmmpladmin',password:'PMMPL123'}).token);
// Roles: User / EA / DME / Admin are kept as-is on the Login Page sheet; only Admin gets full access automatically.
context.handleSaveUsers([
  {username:'ea1',fullName:'EA One',role:'EA',status:'Active',password:'ea123',permissions:{requests:{view:true,update:true},introduce:{view:true,update:true}}},
  {username:'dme1',fullName:'DME One',role:'DME',status:'Active',password:'dme123',permissions:{create:{view:true,update:true},'repair-work':{view:true,update:true}}},
  {username:'boss',fullName:'Boss',role:'admin',status:'Active',password:'boss123',permissions:{}}
]);
const roleRows=context.fetchAllUsers();
assert.equal(roleRows.map(u=>u.role).join(','),'EA,DME,Admin');
assert.equal(grid[1][2],'EA');
assert.equal(grid[2][2],'DME');
const ea=context.loginAppUser({username:'ea1',password:'ea123'});
context.authorizeAppAction('approveIntroduction',ea.token);
assert.throws(()=>context.authorizeAppAction('updateDevelopmentProgress',ea.token),/denied/);
assert.throws(()=>context.authorizeAppAction('updateUser',ea.token),/Only Admin/);
const dme=context.loginAppUser({username:'dme1',password:'dme123'});
context.authorizeAppAction('updateDevelopmentProgress',dme.token);
context.authorizeAppAction('resolveRepairIssue',dme.token);
assert.throws(()=>context.authorizeAppAction('approveIntroduction',dme.token),/denied/);
context.authorizeAppAction('updateUser',context.loginAppUser({username:'boss',password:'boss123'}).token);
// Live layout after deleting "Permitted Stages": the access columns start right after Created (column H).
grid.length = 0;
grid.push(['Full Name','User','Role','Password','Status','Department','Created','Make System Access','Technical Help Access','Repair System Access','System Requests View','System Requests Update']);
grid.push(['Admin','admin','ADMIN','admin1234','ACTIVE','General','2026-10-22','Yes','Yes','Yes','Yes','Yes']);
grid.push(['Plant One','plantone','USER','PMMPL-1','ACTIVE','General','2026-10-22','No','Yes','No','','']);
const live=context.fetchAllUsers();
assert.equal(live.length,2);
assert.equal(live[1].department,'General');
assert.equal(live[1].systemAccess.technical,true);
assert.equal(live[1].systemAccess.make,false);
context.handleSaveUsers(live.map(u=>({...u})));
assert.equal(grid[0][7],'Make System Access','Column H keeps its Access heading');
assert.equal(grid[0].filter(h=>h==='Make System Access').length,1);
assert.equal(grid[2][7],'No');
assert.equal(grid[2][3],'PMMPL-1');
assert.equal(grid[1][2],'ADMIN');
// Data scope: Admin and DME see everything; User and EA only see records raised by or assigned to them.
const adminUser={role:'Admin',fullName:'Boss'}, dmeUser={role:'DME',fullName:'Dev One'}, eaUser={role:'EA',fullName:'Asha EA'}, plainUser={role:'User',fullName:'Ravi'};
const tickets=[{requester:'Ravi',assignedTo:'Dev One'},{requester:'Someone',assignedTo:'Dev One'},{requester:'Asha EA (IT)',assignedTo:'Dev Two'},{requester:'Kiran',assignedTo:'Ravi',raisedBy:'Kiran'},{requester:'Meena (Plant)',assignedTo:'Dev One',raisedBy:'Ravi'}];
const ownerNames=t=>[t.requester,t.assignedTo,t.raisedBy];
assert.equal(context.scopeToUser(adminUser,tickets,ownerNames).length,5);
assert.equal(context.scopeToUser(dmeUser,tickets,ownerNames).length,5);
assert.equal(context.scopeToUser(plainUser,tickets,ownerNames).length,3,'own request, assigned task and raised-on-behalf');
assert.equal(context.scopeToUser(eaUser,tickets,ownerNames).length,1,'EA sees only their own record');
assert.equal(context.scopeToUser({role:'User',fullName:'Rav'},tickets,ownerNames).length,0,'A name prefix is not a match');
const reqs=[{requestNo:'SM-1',createdBy:'Ravi'},{requestNo:'SM-2',createdBy:'Administrator',assignedDeveloper:'Ravi'},{requestNo:'SM-3',createdBy:'Other'}];
assert.equal(context.scopeToUser(plainUser,reqs,context.requestOwnerNames).map(r=>r.requestNo).join(),'SM-1,SM-2');
console.log('PASS: named system/stage columns, View/Update persistence, custom data preservation, sheet edits, live login, session expiry, admin-only editing, roles and the Login Page layout without Permitted Stages.');
