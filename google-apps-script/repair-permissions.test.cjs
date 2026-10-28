const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const grid = [['Full Name','User','Role','Password','Status','Department','Created','Permitted Stages','Custom Column']];
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
grid[1]=Array(9).fill('');grid[1][8]='preserve me';
context.handleSaveUsers([user]);
let loaded=context.fetchAllUsers()[0];
assert.equal(loaded.permissions['repair-new'].update,true);
assert.equal(loaded.permissions['repair-approval'].view,true);
assert.equal(loaded.permissions['repair-approval'].update,false);
assert.equal(loaded.permissions.requests.view,false);
assert.equal(grid[1][8],'preserve me');
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
context.handleSaveUsers([{username:'restricted',fullName:'Restricted',role:'Admin',password:'PMMPL123',permissions:{requests:{view:true}}}]);
loaded=context.fetchAllUsers()[0];
assert(loaded.technicalOnly);
assert.equal(loaded.permissions['technical-new'].update,true);
assert.equal(loaded.permissions['technical-all'].update,false);
assert.equal(loaded.permissions.requests.view,false);
const restricted=context.loginAppUser({username:'restricted',password:'PMMPL123'});
context.authorizeAppAction('createTechnicalTicket',restricted.token);
assert.throws(()=>context.authorizeAppAction('submitTechnicalTicket',restricted.token),/denied/);
assert.throws(()=>context.authorizeAppAction('updateUser',restricted.token),/Only Admin/);
console.log('PASS: named system/stage columns, View/Update persistence, custom data preservation, sheet edits, live login, session expiry, admin-only editing and PMMPL policy.');
