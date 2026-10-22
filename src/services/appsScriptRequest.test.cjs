const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(`${__dirname}/dataService.js`, 'utf8');
const start = source.indexOf('export async function callGoogleAppsScript(');
const end = source.indexOf('\n/**', start);
let delay, timeout, cleared = 0, abort = false;
const context = {
  getGoogleAppsScriptUrl: () => 'https://example.invalid/exec',
  AbortController, URLSearchParams, console,
  setTimeout: (fn, ms) => { timeout = fn; delay = ms; return 1; },
  clearTimeout: () => { cleared++; },
  fetch: async () => { if (abort) { timeout(); throw Object.assign(new Error('signal is aborted without reason'), {name:'AbortError'}); } return {ok:true,json:async()=>({success:true})}; }
};
vm.createContext(context);
vm.runInContext(source.slice(start,end).replace('export ',''),context);
(async () => {
  await context.callGoogleAppsScript('getRepairIssues', {}, 'GET');
  assert.equal(delay,60000);
  await context.callGoogleAppsScript('createRepairIssue');
  assert.equal(delay,120000);
  abort = true;
  await assert.rejects(context.callGoogleAppsScript('getRepairIssues',{},'GET'), /response timed out/);
  await assert.rejects(context.callGoogleAppsScript('createRepairIssue'), /may have completed/);
  assert.equal(cleared,4);
  console.log('PASS: read/write timeout budgets, friendly abort errors and timer cleanup.');
})().catch(err => { console.error(err); process.exitCode=1; });
