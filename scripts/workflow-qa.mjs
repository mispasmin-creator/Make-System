import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const output = mkdtempSync(join(tmpdir(), 'make-ui-qa-'));
const browser = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
  '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  '--remote-debugging-port=0', `--user-data-dir=${join(output, 'profile')}`, 'about:blank',
], { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] });
let socket;
try {
  const endpoint = await new Promise((resolve, reject) => {
    let log = '';
    const timer = setTimeout(() => reject(new Error('Chrome did not start')), 20000);
    browser.on('error', reject);
    browser.stderr.on('data', chunk => {
      log += chunk;
      const match = log.match(/DevTools listening on (ws:\/\/\S+)/);
      if (match) { clearTimeout(timer); resolve(match[1]); }
    });
  });
  socket = new WebSocket(endpoint);
  await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
  let sequence = 0;
  const runtimeErrors = [];
  const pending = new Map();
  socket.onmessage = event => {
    const data = JSON.parse(event.data);
    if (data.method === 'Runtime.exceptionThrown') runtimeErrors.push(data.params.exceptionDetails.exception?.description || data.params.exceptionDetails.text);
    const listener = pending.get(data.id);
    if (!listener) return;
    pending.delete(data.id);
    if (data.error) listener.reject(new Error(JSON.stringify(data.error)));
    else listener.resolve(data.result);
  };
  function send(method, params = {}, sessionId) {
    const id = ++sequence;
    return new Promise((resolve, reject) => {
      pending.set(id, { resolve, reject });
      socket.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
    });
  }
  const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
  const cdp = (method, params) => send(method, params, sessionId);
  await cdp('Page.enable');
  await cdp('Runtime.enable');
  await cdp('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
  async function evaluate(expression) {
    const result = await cdp('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
    return result.result.value;
  }
  async function until(expression) {
    const deadline = Date.now() + 15000;
    while (Date.now() < deadline) {
      if (runtimeErrors.length) throw new Error(runtimeErrors.join('\n'));
      if (await evaluate(expression)) return;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    throw new Error(`Timed out: ${expression}`);
  }
  await cdp('Page.addScriptToEvaluateOnNewDocument', { source: `
    const user={id:'qa',fullName:'Workflow QA',username:'qa',role:'Admin',status:'Active',token:'qa-only'};
    localStorage.setItem('make_system_session_v2',JSON.stringify(user));
    localStorage.setItem('make_system_cache_owner','qa');
    window.qaActions=[];
    const stages=['Assign System','Create System','Introduce System','Update MIS System','Closed'];
    window.qaRequests=stages.map((stage,i)=>({id:'qa-'+i,requestNo:'SM-QA-'+i,sheetRowIndex:i+7,companyName:'Test Company',systemName:'QA '+stage,businessPurpose:'Workflow check',requester:'Workflow QA',assignedDeveloper:'QA Developer',targetCompletionDate:'2026-12-15',currentStage:stage,workflowVersion:2,currentStatus:stage+': Pending',workStatus:i>1?'Completed':'In Progress',progressPercent:i>1?100:10,introduction:{isCompleted:i>0,remarks:'Assignment retained'},systemIntroduction:{isCompleted:i>2,remarks:i>2?'Introduced earlier':''},misUpdate:i===4?{isCompleted:true}:null,developmentHistory:[],activityLog:[],attachments:[],createdAt:'2026-11-27T05:00:00Z'}));
    const originalFetch=window.fetch.bind(window);
    window.fetch=(url,options)=>{
      if(!String(url).includes('script.google.com')) return originalFetch(url,options);
      const payload=options?.body?JSON.parse(options.body):{action:new URL(url).searchParams.get('action')};
      window.qaActions.push(payload);
      let request;
      if(payload.action==='completeDevelopment'){
        request=window.qaRequests.find(r=>r.id===payload.requestId);
        request.currentStage='Update MIS System'; // Exercise compatibility with an older stage label.
        request.currentStatus='Update MIS: Pending';request.workStatus='Completed';request.progressPercent=100;
        request.systemIntroduction={isCompleted:false};
        window.qaSheetIntroductionStatus='Pending';
      }
      if(payload.action==='completeIntroduction'){
        request=window.qaRequests.find(r=>r.id===payload.requestId);
        if(request.currentStage!=='Introduce System')throw Error('Wrong workflow stage');
        request.systemIntroduction={isCompleted:true,remarks:payload.data.remarks,completedBy:'Workflow QA',completedAt:'2026-11-27T06:00:00Z'};
        request.currentStage='Update MIS System';request.currentStatus='Update MIS: Pending';
      }
      if(payload.action==='completeMisUpdate'){
        request=window.qaRequests.find(r=>r.id===payload.requestId);
        if(request.currentStage!=='Update MIS System' || !request.systemIntroduction.isCompleted)throw Error('Introduction must complete before MIS');
        request.misUpdate={isCompleted:true,remarks:payload.data.remarks,updatedBy:'Workflow QA',updatedAt:'2026-11-27T07:00:00Z'};
        request.currentStage='Closed';request.currentStatus='Closed';request.closedAt='2026-11-27T07:00:00Z';
        window.qaSheetFinalStatus='Closed';window.qaSheetActual4=request.closedAt;
      }
      return Promise.resolve(new Response(JSON.stringify({user,request,success:true,hasChanges:true,version:'qa',requests:window.qaRequests,tickets:[],issues:[],masterOptions:{companies:['Test Company'],developers:['QA Developer']}}),{headers:{'Content-Type':'application/json'}}));
    };
  ` });
  await cdp('Page.navigate',{url:'http://127.0.0.1:4173/'});
  await until('!!document.querySelector("main table")');
  const nav=await evaluate('Array.from(document.querySelectorAll(".premium-sidebar nav button")).map(b=>b.textContent.trim())');
  const labels=['System Requests','Assign System','Create System','Introduce System','Update in MIS System'];
  let previous=-1;
  for(const label of labels){const next=nav.findIndex(text=>text.startsWith(label));assert(next>previous,label+' must be in workflow order');previous=next;}
  const clickPage=async label=>{await evaluate(`Array.from(document.querySelectorAll('.premium-sidebar button')).find(b=>b.textContent.trim().startsWith(${JSON.stringify(label)})).click()`);await until(`document.querySelector('main h1')?.textContent === ${JSON.stringify(label)}`);};
  await clickPage('Assign System');
  assert((await evaluate('document.querySelector("main tbody").textContent')).includes('SM-QA-0'));
  await evaluate('Array.from(document.querySelectorAll("main tbody button")).find(b=>b.textContent.includes("Approve")).click()');
  await until('!!document.querySelector("[role=dialog]")');
  assert((await evaluate('document.querySelector("[role=dialog]").textContent')).includes('Assign System'));
  assert(await evaluate('!!document.querySelector("#targetCompletionDate")'));
  await evaluate('Array.from(document.querySelectorAll("[role=dialog] button")).find(b=>b.textContent.trim()==="Cancel").click()');
  await clickPage('Create System');
  const development=await evaluate('document.querySelector("main tbody").textContent');
  assert(development.includes('SM-QA-1'));assert(!development.includes('SM-QA-2'));
  await evaluate('Array.from(document.querySelectorAll("main tbody button")).find(b=>b.textContent.trim()==="Update").click()');
  await until('!!document.querySelector("#workStatusSelect")');
  await evaluate('document.querySelector("#workStatusSelect").value="Completed"; document.querySelector("#workStatusSelect").dispatchEvent(new Event("change",{bubbles:true}))');
  await until('!!document.querySelector("#systemUrlInput")');
  await evaluate('document.querySelector("#systemUrlInput").focus()');
  await cdp('Input.insertText',{text:'https://example.test/finished-system'});
  await evaluate('Array.from(document.querySelectorAll("[role=dialog] button")).find(b=>b.textContent.includes("Send to Introduce System")).click()');
  await until('!document.querySelector("[role=dialog]")');
  assert.equal(await evaluate('window.qaSheetIntroductionStatus'),'Pending');
  assert.equal(await evaluate('window.qaActions.filter(a=>a.action==="completeDevelopment").length'),1);
  assert.equal(await evaluate('window.qaActions.find(a=>a.action==="completeDevelopment").requestNo'),'SM-QA-1');
  assert.equal(await evaluate('window.qaActions.find(a=>a.action==="completeDevelopment").sheetRowIndex'),8);
  assert(!(await evaluate('document.querySelector("main tbody").textContent')).includes('SM-QA-1'));
  await clickPage('Introduce System');
  assert((await evaluate('document.querySelector("main tbody").textContent')).includes('SM-QA-1'));
  console.log('PASS: Completed development form closes without the old error and the saved request appears in Introduce System.');
  const pendingRows=await evaluate('document.querySelector("main tbody").textContent');
  assert(pendingRows.includes('SM-QA-2'));assert(!pendingRows.includes('SM-QA-0'));assert(!pendingRows.includes('SM-QA-3'));
  await evaluate('Array.from(document.querySelectorAll("main tbody tr")).find(r=>r.textContent.includes("SM-QA-2")).querySelector("button").click()');
  await until('!!document.querySelector("#introductionRemarks")');
  await evaluate('document.querySelector("#introductionRemarks").focus()');
  await cdp('Input.insertText',{text:'Walkthrough and handover complete'});
  await evaluate('Array.from(document.querySelectorAll("[role=dialog] button")).find(b=>b.textContent.includes("Complete & Send")).click()');
  await until('!document.querySelector("[role=dialog]")');
  assert(!(await evaluate('document.querySelector("main tbody").textContent')).includes('SM-QA-2'));
  assert.equal(await evaluate('window.qaActions.filter(a=>a.action==="completeIntroduction").length'),1);
  await evaluate('Array.from(document.querySelectorAll("main button")).find(b=>b.textContent.trim().startsWith("Completed")).click()');
  assert((await evaluate('document.querySelector("main tbody").textContent')).includes('Walkthrough and handover complete'));
  await clickPage('Update in MIS System');
  assert((await evaluate('document.querySelector("main tbody").textContent')).includes('SM-QA-2'));
  console.log('PASS: browser desktop navigation order, assignment form, development queue, introduction submission/history and MIS queue with mocked integration.');
  await evaluate('Array.from(document.querySelectorAll("main tbody tr")).find(r=>r.textContent.includes("SM-QA-2")).querySelector("button").click()');
  await until('!!document.querySelector("#misRemarks")');
  await evaluate('document.querySelector("#misRemarks").focus()');
  await cdp('Input.insertText',{text:'Final MIS registration complete'});
  await evaluate('Array.from(document.querySelectorAll("[role=dialog] button")).find(b=>b.textContent.includes("Submit & Close Request")).click()');
  await until('!document.querySelector("[role=dialog]")');
  assert(!(await evaluate('document.querySelector("main tbody").textContent')).includes('SM-QA-2'));
  assert.equal(await evaluate('window.qaActions.filter(a=>a.action==="completeMisUpdate").length'),1);
  assert.equal(await evaluate('window.qaSheetFinalStatus'),'Closed');
  assert(await evaluate('!!window.qaSheetActual4'));
  await evaluate('Array.from(document.querySelectorAll("main button")).find(b=>b.textContent.trim().startsWith("Completed")).click()');
  const finalRow=await evaluate('Array.from(document.querySelectorAll("main tbody tr")).find(r=>r.textContent.includes("SM-QA-2")).textContent');
  assert(finalRow.includes('Final MIS registration complete'));
  assert(finalRow.includes('Closed'));
  console.log('PASS: Introduce -> MIS -> Submit & Close moves the request to Completed history and saves final status and completion date.');
  assert.equal(await evaluate('window.qaActions.filter(a=>a.action==="getRequests").length'),1,'Page changes and saves must reuse the loaded dataset');
  assert.equal(await evaluate('window.qaActions.filter(a=>a.action==="getRequest").length'),0,'Normal saves return the updated row without a follow-up fetch');
  console.log('PASS: all saves send Request No. / row hints; workflow navigation triggers no full-dataset reloads.');
  await cdp('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
  assert(await evaluate('document.documentElement.scrollWidth <= innerWidth'));
  await evaluate('Array.from(document.querySelectorAll("main tbody button")).find(b=>b.textContent.includes("Details")).click()');
  await until('!!document.querySelector("[role=dialog]")');
  const details=await evaluate('document.querySelector("[role=dialog]").textContent');
  for(const label of ['System Request','Assign System','Create System','Introduce System','Update in MIS System'])assert(details.includes(label));
  assert(await evaluate('document.documentElement.scrollWidth <= innerWidth'));
  console.log('PASS: 390px mobile view and five-step details tracker keep content within the viewport.');
  const screenshot=await cdp('Page.captureScreenshot',{format:'png'});
  writeFileSync(join(output,'make-workflow-mobile.png'),Buffer.from(screenshot.data,'base64'));
  assert.equal(runtimeErrors.length,0);
  console.log('Screenshot: '+join(output,'make-workflow-mobile.png'));
} finally {
  if(socket?.readyState===WebSocket.OPEN)socket.close();
  browser.kill();
}
