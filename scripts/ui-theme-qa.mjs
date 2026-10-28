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
  await cdp('Page.navigate', { url: 'http://127.0.0.1:5173/' });
  await until('!!document.querySelector("[data-cursor-float]")');
  assert.match(await evaluate('getComputedStyle(document.body).fontFamily'), /Calibri/);
  const login = await evaluate('(() => { const r=document.querySelector("[data-cursor-float]").getBoundingClientRect(); return {x:r.x,y:r.y,width:r.width,height:r.height}; })()');
  await cdp('Input.dispatchMouseEvent', { type: 'mouseMoved', x: login.x + 30, y: login.y + 30 });
  await until('!!document.querySelector("[data-cursor-floating=true]")');
  const firstLight = await evaluate('getComputedStyle(document.querySelector("[data-cursor-float]")).backgroundImage');
  await cdp('Input.dispatchMouseEvent', { type: 'mouseMoved', x: login.x + login.width - 35, y: login.y + 50 });
  await until(`getComputedStyle(document.querySelector('[data-cursor-float]')).backgroundImage !== ${JSON.stringify(firstLight)}`);
  assert.equal(await evaluate('getComputedStyle(document.querySelector("[data-cursor-float]")).transform'), 'none');
  console.log('PASS: Chrome login uses Calibri; cursor moves the floating light without transforming the card.');
  await evaluate('document.querySelector("input").focus()');
  await cdp('Input.dispatchMouseEvent', { type: 'mouseMoved', x: login.x + 40, y: login.y + 40 });
  await until('!document.querySelector("[data-cursor-floating=true]")');
  await evaluate('document.activeElement.blur()');
  await cdp('Input.dispatchMouseEvent', { type: 'mouseMoved', x: login.x + 60, y: login.y + 40 });
  await until('!!document.querySelector("[data-cursor-floating=true]")');
  await cdp('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 0, y: 0 });
  await until('!document.querySelector("[data-cursor-floating=true]")');
  console.log('PASS: typing focus holds the form steady; leaving a card resets floating.');
  await cdp('Page.addScriptToEvaluateOnNewDocument', { source: `
    const qaUser={id:'qa',fullName:'UI Preview',username:'qa',role:'Admin',status:'Active',token:'qa-only',technicalOnly:false};
    localStorage.setItem('make_system_session_v2',JSON.stringify(qaUser));
    localStorage.setItem('make_system_requests_v1','[]');
    localStorage.setItem('make_system_master_v1',JSON.stringify({companies:['PMMPL'],developers:['QA Developer']}));
    const originalFetch=window.fetch.bind(window);
    window.fetch=(url,options)=>String(url).includes('script.google.com')
      ? Promise.resolve(new Response(JSON.stringify({user:qaUser,success:true,hasChanges:true,version:'qa',requests:[],tickets:[{ticketNo:'QA-101',requester:'QA User',problem:'First sample ticket'},{ticketNo:'QA-202',requester:'QA User',problem:'Second sample ticket'}],masterOptions:{companies:['PMMPL'],developers:['QA Developer']}}),{headers:{'Content-Type':'application/json'}}))
      : originalFetch(url,options);
  ` });
  await cdp('Page.reload');
  await until('!!document.querySelector("main table")');
  const requestHeaders = await evaluate('Array.from(document.querySelectorAll("main thead th")).map(e=>e.textContent.trim())');
  assert.equal(requestHeaders.length, 8);
  assert(!requestHeaders.includes('Revision'));
  console.log('PASS: System Requests table has 8 columns and no Revision column.');
  await evaluate(`Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === 'Introduce System').click()`);
  await until('document.querySelector("main")?.textContent.includes("No requests pending introduction")');
  const card = await evaluate('(() => { const r=document.querySelector("main .bg-white.rounded-2xl.border").getBoundingClientRect(); return {x:r.x,y:r.y,width:r.width}; })()');
  await cdp('Input.dispatchMouseEvent', { type: 'mouseMoved', x: card.x + card.width * 0.75, y: card.y + 25 });
  await until('!!document.querySelector("main [data-cursor-floating=true]")');
  const palette = await evaluate('getComputedStyle(document.documentElement).getPropertyValue("--color-indigo-600").trim()');
  assert.equal(palette, '#1951dc');
  await until(`getComputedStyle(document.querySelector('.premium-sidebar [aria-current="page"]')).color === 'rgb(255, 255, 255)'`);
  const menuTheme = await evaluate(`(() => {const aside=document.querySelector('.premium-sidebar');const active=aside.querySelector('[aria-current="page"]');return {background:getComputedStyle(aside).backgroundColor,activeText:getComputedStyle(active).color,activeFill:getComputedStyle(active).backgroundImage,shadow:getComputedStyle(active).boxShadow};})()`);
  assert.equal(menuTheme.background, 'rgb(248, 250, 255)');
  assert.equal(menuTheme.activeText, 'rgb(255, 255, 255)');
  assert(menuTheme.activeFill.includes('linear-gradient'));
  assert.notEqual(menuTheme.shadow, 'none');
  console.log('PASS: sidebar matches the light workspace; selected menu has white text, blue gradient and depth highlight.');
  const screenshot = await cdp('Page.captureScreenshot', { format: 'png' });
  const screenshotPath = join(output, 'royal-blue-desktop.png');
  writeFileSync(screenshotPath, Buffer.from(screenshot.data, 'base64'));
  await cdp('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
  await until('!document.querySelector("[data-cursor-floating=true]")');
  assert.equal(await evaluate('getComputedStyle(document.querySelector("main .cursor-float-surface")).transform'), 'none');
  console.log('PASS: dashboard icy-white/royal-blue palette, page-card cursor float and reduced-motion reset.');
  await cdp('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  assert(await evaluate('document.documentElement.scrollWidth <= innerWidth'), 'Mobile page must not overflow the viewport');
  console.log('PASS: 390px mobile viewport has no page-wide horizontal overflow.');
  await cdp('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
  await evaluate(`Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === 'All Technical Tickets').click()`);
  await until(`!!document.querySelector('input[aria-label="Search tickets"]') && document.querySelector('tbody')?.textContent.includes('QA-202')`);
  const searchStyle = await evaluate(`(() => { const s=getComputedStyle(document.querySelector('input[aria-label="Search tickets"]')); return {background:s.backgroundColor,border:s.borderColor,shadow:s.boxShadow}; })()`);
  assert.equal(searchStyle.background, 'rgb(255, 255, 255)');
  assert.notEqual(searchStyle.shadow, 'none');
  assert.notEqual(searchStyle.border, 'rgba(0, 0, 0, 0)');
  const searchScreenshot = await cdp('Page.captureScreenshot', { format: 'png' });
  const searchScreenshotPath = join(output, 'ticket-search.png');
  writeFileSync(searchScreenshotPath, Buffer.from(searchScreenshot.data, 'base64'));
  await evaluate(`document.querySelector('input[aria-label="Search tickets"]').focus()`);
  await cdp('Input.insertText', { text: 'QA-101' });
  await until('document.querySelector("tbody")?.textContent.includes("QA-101") && !document.querySelector("tbody")?.textContent.includes("QA-202")');
  console.log('PASS: ticket search has a white fill, visible border/shadow and filters matching tickets.');
  console.log(`Search screenshot: ${searchScreenshotPath}`);
  console.log(`Screenshot: ${screenshotPath}`);
  if (process.argv.includes('--scroll') || process.argv.includes('--details')) {
    await cdp('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }] });
    await cdp('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });
    await cdp('Page.addScriptToEvaluateOnNewDocument', { source: `
      const qaRequests=Array.from({length:90},(_,i)=>({
        id:'qa-request-'+i,requestNo:'SM-'+String(i+1).padStart(4,'0'),companyName:'PMMPL',
        systemName:'QA System '+i,systemRequirements:'QA System '+i,
        businessPurpose:'Test business purpose with enough content to verify table scrolling. '.repeat(5),
        currentStage:['Introduce System','Create System','Update MIS System','Closed'][i%4],
        workStatus:i%4>=2?'Completed':'In Progress',progressPercent:i%4>=2?100:20,
        assignedDeveloper:'QA Developer',targetCompletionDate:'2026-11-15',
        upgradeTargetDate: i%4===2?JSON.stringify({id:'req-SM-0003',requestNo:'SM-0003',currentRevisionNo:null}):null,
        holdExtendTargetDate:i%4===1?{invalidDate:true}:null,
        introduction:{isCompleted:i%4!==0},developmentHistory:[],testingHistory:[],activityLog:[],attachments:[],
        misUpdate:i%4===3?{isCompleted:true,updatedAt:'2026-10-28T11:00:00Z'}:null,
        createdAt:'2026-10-28T10:00:00Z'
      }));
      const qaUsers=Array.from({length:307},(_,i)=>({id:'qa-user-'+i,username:'qa'+i,fullName:'QA User '+i,
        role:i===0?'Admin':'User',status:'Active',department:'General',technicalOnly:false,
        systemAccess:{make:true,technical:true,repair:true},permissions:{},createdAt:'2026-10-28T10:00:00Z'}));
      const qaIssues=Array.from({length:30},(_,i)=>({id:'qa-issue-'+i,serial:'RS - '+i,requester:'QA User',
        company:'PMMPL',description:'Repair issue for scrolling verification. '.repeat(10),location:'QA location',version:1,
        approval:i%2?{actual:'2026-10-28T10:00:00Z'}:{},assessment:{repairRequired:'Yes',whereToSolve:'Workshop'},repair:{},management:{},activity:[]}));
      localStorage.setItem('make_system_requests_v1',JSON.stringify(qaRequests));
      localStorage.setItem('make_system_users_v2',JSON.stringify(qaUsers));
      window.fetch=(url,options)=>String(url).includes('script.google.com')
        ? Promise.resolve(new Response(JSON.stringify({user:qaUser,success:true,hasChanges:true,version:'qa-scroll',
          requests:qaRequests,users:qaUsers,issues:qaIssues,tickets:Array.from({length:80},(_,i)=>({ticketNo:'QA-'+i,requester:'QA User',problem:'Test ticket '+i})),
          masterOptions:{companies:['PMMPL'],developers:['QA Developer']}}),{headers:{'Content-Type':'application/json'}}))
        : originalFetch(url,options);
    ` });
    await cdp('Page.reload');
    await until('document.querySelector("main tbody")?.textContent.includes("SM-0001")');
    const routes = [
      ['System Requests', 'System Requests'], ['Introduce System', 'Introduce System'],
      ['Create System', 'Create System'], ['Update MIS System', 'Update MIS System'],
      ['Raise Technical Help', 'Raise Technical Help Ticket'], ['All Technical Tickets', 'All Technical Tickets'],
      ['New Issue Request', 'New Issue Request'], ['Approval For Repair', 'Approval For Repair'],
      ['Resolve Problem', 'Resolve Problem'], ['Admin Master', 'Admin Master'],
    ];
    for (const [label, heading] of routes) {
      await cdp('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 0, y: 0 });
      await evaluate(`Array.from(document.querySelectorAll('aside button, nav button, button')).find(b => Array.from(b.querySelectorAll('span')).some(s => s.textContent.trim() === ${JSON.stringify(label)})).click()`);
      await until(`document.querySelector('main h1')?.textContent.trim() === ${JSON.stringify(heading)}`);
      if (label === 'Admin Master') await until('document.querySelector("main tbody")?.querySelectorAll("tr").length >= 100');
      if(process.argv.includes('--details') && label === 'System Requests') {
        await evaluate('document.querySelector("main input").focus()');
        await cdp('Input.insertText', {text:'SM-0001'});
        await until(`Array.from(document.querySelectorAll('main button')).some(b=>b.textContent.trim()==='Clear')`);
        await evaluate(`Array.from(document.querySelectorAll('main button')).find(b=>b.textContent.trim()==='Clear').click()`);
        await until('document.querySelector("main input").value === "" && document.querySelectorAll("main tbody tr").length > 1');
        assert(await evaluate(`!Array.from(document.querySelectorAll('main select option')).some(o=>['Testing System','Revise System'].includes(o.textContent))`));
        console.log('PASS: System Requests search and Clear work without a crash; removed workflow stages are absent from filters.');
      }
      if (process.argv.includes('--details') && ['System Requests','Introduce System','Create System','Update MIS System','Admin Master'].includes(label)) {
        async function checkDetails(tab) {
          const expected = await evaluate(`(() => {const row=document.querySelector('main tbody tr');return row.textContent.match(/SM-\\d+/)?.[0] || row.querySelector('td')?.textContent.trim();})()`);
          await evaluate(`Array.from(document.querySelectorAll('main tbody button')).find(b=>/^(View Details|Details)$/.test(b.textContent.trim())||b.title==='View User Details').click()`);
          await until('!!document.querySelector("[role=dialog]")');
          const details = await evaluate('document.querySelector("[role=dialog]").textContent');
          assert(!details.includes('"requestNo":') && !details.includes('[object Object]'), `${label}: raw metadata must never appear in date fields`);
          if(label === 'Admin Master') assert(details.includes('QA User'), 'User details must contain the selected user');
          else {assert(details.includes(expected), `${label}: correct request must be shown`);assert(details.includes('System Name & Purpose'));assert(details.includes('Timeline & Target Dates'));}
          const box = await evaluate(`(() => {const r=document.querySelector('[role=dialog] [data-cursor-float]').getBoundingClientRect();return {width:r.width,height:r.height};})()`);
          assert(box.width > 200 && box.height > 150, 'Details must be visibly rendered');
          if(label === 'System Requests') {
            const capture = await cdp('Page.captureScreenshot', { format: 'png' });
            writeFileSync(join(output, 'request-details.png'), Buffer.from(capture.data, 'base64'));
            await cdp('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
            assert(await evaluate(`(() => {const r=document.querySelector('[role=dialog] [data-cursor-float]').getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&r.height>150;})()`), 'Details must remain visible on mobile');
            await cdp('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });
          }
          await evaluate(`document.querySelector('[role=dialog] button[aria-label="Close dialog"]').click()`);
          await until('!document.querySelector("[role=dialog]")');
          console.log(`PASS: ${label} ${tab}: Details opens correct populated content and closes without a runtime error.`);
        }
        await checkDetails('Pending/list');
        if(['Introduce System','Create System','Update MIS System'].includes(label)) {
          await evaluate(`Array.from(document.querySelectorAll('main button')).find(b=>b.textContent.trim().startsWith('Completed')).click()`);
          await until('!!document.querySelector("main tbody tr button")');
          await checkDetails('Completed');
          await evaluate(`Array.from(document.querySelectorAll('main button')).find(b=>b.textContent.trim().startsWith('Pending')).click()`);
          await until('!!document.querySelector("main tbody tr button")');
        }
      }
      await evaluate('document.activeElement?.blur()');
      await evaluate(`new Promise(resolve=>setTimeout(resolve,300))`);
      await evaluate(`window.__qaSnapshot=()=>Array.from(new Set([document.documentElement,document.body,document.querySelector('main'),...document.querySelectorAll('main *')])).filter(e=>e && (e===document.documentElement||e===document.body||e.tagName==='MAIN'||e.tagName==='TABLE'||e.classList.contains('rounded-2xl')||/(auto|scroll)/.test(getComputedStyle(e).overflow))).map(e=>({e,top:e.scrollTop,left:e.scrollLeft,sw:e.scrollWidth,sh:e.scrollHeight,cw:e.clientWidth,ch:e.clientHeight,width:e.getBoundingClientRect().width,height:e.getBoundingClientRect().height})); window.__qaBefore=window.__qaSnapshot(); void 0;`);
      for (const [x,y] of [[400,200],[1100,210],[650,360],[1050,580],[400,500],[900,340]]) {
        await cdp('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y });
        await evaluate('new Promise(resolve=>setTimeout(resolve,100))');
      }
      await evaluate('new Promise(resolve=>setTimeout(resolve,300))');
      const changed = await evaluate(`window.__qaBefore.flatMap(b=>{const e=b.e,r=e.getBoundingClientRect();const a={top:e.scrollTop,left:e.scrollLeft,sw:e.scrollWidth,sh:e.scrollHeight,cw:e.clientWidth,ch:e.clientHeight,width:r.width,height:r.height};const keys=Object.keys(a).filter(k=>Math.abs(a[k]-b[k])>0.1);return keys.length?[{tag:e.tagName,classes:e.className,keys,before:keys.map(k=>b[k]),after:keys.map(k=>a[k])}]:[]}).slice(0,4)`);
      assert.deepEqual(changed, [], `${label}: moving the cursor must not change scroll offsets or layout dimensions`);
      const scrollTarget = await evaluate(`(() => { window.__qaScroller=Array.from(document.querySelectorAll('main,main *')).filter(e=>/(auto|scroll)/.test(getComputedStyle(e).overflowY)&&e.scrollHeight>e.clientHeight+5&&e.clientHeight>50).sort((a,b)=>(b.scrollHeight-b.clientHeight)-(a.scrollHeight-a.clientHeight))[0]; if(!window.__qaScroller)return null;window.__qaScroller.scrollTop=0;const r=window.__qaScroller.getBoundingClientRect();return {x:Math.max(280,Math.min(1100,r.x+r.width/2)),y:Math.max(100,Math.min(650,r.y+Math.min(r.height/2,150)))};})()`);
      if (scrollTarget) {
        await cdp('Input.dispatchMouseEvent', { type: 'mouseWheel', x: scrollTarget.x, y: scrollTarget.y, deltaX: 0, deltaY: 250 });
        await until('window.__qaScroller.scrollTop > 0');
        await evaluate('new Promise(resolve=>setTimeout(resolve,250))');
        await evaluate('window.__qaScrollTop=window.__qaScroller.scrollTop; void 0;');
        for (const [x,y] of [[450,300],[1000,550],[700,400]]) {
          await cdp('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y });
          await evaluate('new Promise(resolve=>setTimeout(resolve,80))');
        }
        assert(await evaluate('window.__qaScroller.scrollTop === window.__qaScrollTop'), `${label}: cursor must preserve an already-scrolled position`);
      }
      const horizontal = await evaluate(`(() => { window.__qaHorizontal=Array.from(document.querySelectorAll('main *')).find(e=>/(auto|scroll)/.test(getComputedStyle(e).overflowX)&&e.scrollWidth>e.clientWidth+5&&e.getBoundingClientRect().bottom>100&&e.getBoundingClientRect().top<600);if(!window.__qaHorizontal)return null;window.__qaHorizontal.scrollLeft=0;const r=window.__qaHorizontal.getBoundingClientRect();return {x:Math.max(300,Math.min(1100,r.x+r.width/2)),y:Math.max(100,Math.min(600,r.y+40))};})()`);
      if (horizontal) {
        await cdp('Input.dispatchMouseEvent', { type: 'mouseWheel', x: horizontal.x, y: horizontal.y, deltaX: 180, deltaY: 0 });
        await until('window.__qaHorizontal.scrollLeft > 0');
      }
      console.log(`PASS: ${label}: cursor leaves scroll/layout stable; ${scrollTarget ? 'wheel scrolling works' : 'no vertical overflow'}.`);
    }
    const adminScreenshot = await cdp('Page.captureScreenshot', { format: 'png' });
    writeFileSync(join(output, 'admin-scroll-stability.png'), Buffer.from(adminScreenshot.data, 'base64'));
    await evaluate(`Array.from(document.querySelectorAll('button')).find(b=>b.textContent.trim()==='Create New User').click()`);
    await until('!!document.querySelector("[role=dialog]")');
    const dialogBefore = await evaluate(`(() => {document.activeElement?.blur();const e=document.querySelector('[role=dialog] [data-cursor-float]'),r=e.getBoundingClientRect();return {width:r.width,height:r.height,x:r.x,y:r.y};})()`);
    for (const [x,y] of [[400,150],[900,300],[500,500]]) await cdp('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y });
    const dialogAfter = await evaluate(`(() => {const r=document.querySelector('[role=dialog] [data-cursor-float]').getBoundingClientRect();return {width:r.width,height:r.height,x:r.x,y:r.y};})()`);
    assert.deepEqual(dialogAfter, dialogBefore, 'Modal must remain anchored while pointer moves');
    const modalScroll = await evaluate(`(() => {window.__qaModalScroll=Array.from(document.querySelectorAll('[role=dialog] *')).find(e=>getComputedStyle(e).overflowY==='auto'&&e.scrollHeight>e.clientHeight);if(!window.__qaModalScroll)return null;const r=window.__qaModalScroll.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+100};})()`);
    if(modalScroll){await cdp('Input.dispatchMouseEvent',{type:'mouseWheel',x:modalScroll.x,y:modalScroll.y,deltaX:0,deltaY:200});await until('window.__qaModalScroll.scrollTop>0');}
    console.log('PASS: Admin form modal stays anchored and its overflowing content scrolls normally.');
    console.log('PASS: all 10 authenticated pages checked with populated mock records, including 307 admin users.');
  }
} finally {
  if (socket?.readyState === WebSocket.OPEN) socket.close();
  browser.kill();
}
