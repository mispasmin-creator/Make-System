/**
 * ======================================================================================
 * MAKE SYSTEM - HIGH-PERFORMANCE GOOGLE APPS SCRIPT TWO-WAY SYNC BACKEND
 * ======================================================================================
 * - Configured for "FMS" Sheet (Row 6 Headings, Row 7+ Data Rows)
 * - Protected formula columns: Planned & Delay columns are strictly untouched
 * - Zero-lag reads: Pure in-memory parsing, no cell writes during fetch
 * - Ultra-fast sync check: PropertiesService versioning (sub-10ms)
 * - Complete 2-way sync: Requests, Login Page (Users), Master Options, Drive Attachments
 */

// Configuration Constants
var SHEET_FMS = 'FMS';
var SHEET_REQUESTS_FALLBACK = 'System_Requests';
var SHEET_MASTER = 'Master';
var SHEET_LOGIN = 'Login Page';
var SHEET_TECHNICAL_HELP = 'Technical Help';
var DRIVE_FOLDER_ID = '1m1a4pquw0Mq-H41bD2X2R8d4c46V6-4E';
var PROP_SYNC_VERSION = 'MAKE_SYSTEM_SYNC_VERSION';

// Standard Login Page Headers
var LOGIN_HEADERS = [
  'Full Name',
  'User',
  'Role',
  'Password',
  'Status',
  'Department',
  'Created'
];

// Standard FMS Row 6 Headers
var FMS_HEADERS = [
  'Timestamps', 'Request No.', 'Requester', 'Company', 'System Name', 'Requirements Summary',
  'Image', 'Work Status', 'Planned', 'Actual', 'Delay', 'Assigned Developer',
  'Target Date', 'Planned 1',
  'Actual 1', 'Delay 1', 'System Link / URL', 'Admin ID / Username', 'Password',
  'Reason for Hold', 'Hold Extend Target Date', 'Planned 2', 'Actual 2', 'Delay 2',
  'Status', 'Planned 4', 'Actual 4', 'Delay 4', 'Final Status'
];

var DEFAULT_COMPANIES = ['Pmmpl', 'Rkl', 'Refrasynth', 'Purab', 'Refratech'];
var DEFAULT_DEVELOPERS = ['Ahitesh Tandon', 'Bhupendra Kumar', 'MD Alauddin'];
var TECHNICAL_HELP_HEADERS = ['Ticket', 'Request Date (IST)', 'Company', 'Category', 'Requester', 'Application & Page', 'Problem Summary', 'What Has To Be Changed', 'System / Page URL', 'Assigned To', 'Screenshots / PDF Attachments', 'Helpdesk Ref / Ticket', 'Status', 'Planned', 'Actual', 'Delay', 'Resolved Remark'];

// Handle HTTP GET Requests
function doGet(e) {
  try {
    var params = (e && e.parameter) ? e.parameter : {};
    var action = params.action || 'getRequests';
    var requestingUser = action !== 'ping' ? authorizeAppAction(action, params.token) : null;
    if (action === 'getRequest') return jsonResponse({ request: loadRequestRecord(params.requestId, { requestNo: params.requestNo, sheetRowIndex: params.sheetRowIndex, actorName: requestingUser.fullName, actorRole: requestingUser.role }).record, version: getSyncVersion() });
    if (action === 'getSession') { delete requestingUser.password; return jsonResponse({user:requestingUser}); }
    if (action === 'getRepairIssues') return jsonResponse({ issues: scopeToUser(requestingUser, fetchRepairIssues(), function(i) { return [i.requester, i.assessment && i.assessment.assignedDeveloper, i.raisedBy]; }) });

    if (action === 'ping') {
      return jsonResponse({ status: 'ok', workflowVersion: 2, workflowBuild: 'targeted-save-v4', timestamp: new Date().toISOString() });
    }

    if (action === 'getMasterOptions') {
      return jsonResponse(fetchMasterOptions());
    }

    if (action === 'checkSync') {
      var clientVersion = params.version || '0';
      var currentVersion = getSyncVersion();
      if (clientVersion && clientVersion === currentVersion) {
        return jsonResponse({ hasChanges: false, version: currentVersion });
      }
      return jsonResponse({
        hasChanges: true,
        version: currentVersion,
        requests: scopeToUser(requestingUser, fetchAllRequests(), requestOwnerNames),
        masterOptions: fetchMasterOptions(),
        users: requestingUser.role === 'Admin' ? fetchAllUsers() : undefined
      });
    }

    if (action === 'getUsers') {
      return jsonResponse({
        version: getSyncVersion(),
        users: fetchAllUsers()
      });
    }
    if (action === 'getTechnicalTickets') return jsonResponse({ version: getSyncVersion(), tickets: scopeToUser(requestingUser, fetchTechnicalTickets(), function(t) { return [t.requester, t.assignedTo, t.raisedBy]; }) });

    // Default FMS payload stays small: users are loaded separately through getUsers.
    // Reading Login Page here made every FMS refresh slower than necessary.
    return jsonResponse({
      version: getSyncVersion(),
      requests: scopeToUser(requestingUser, fetchAllRequests(), requestOwnerNames),
      masterOptions: fetchMasterOptions()
    });
  } catch (err) {
    return jsonResponse({ error: err.toString(), stack: err.stack });
  }
}

// Handle HTTP POST Requests
function doPost(e) {
  try {
    var payload = {};
    if (e && e.postData && e.postData.contents) {
      try {
        payload = JSON.parse(e.postData.contents);
      } catch (jsonErr) {
        payload = e.parameter || {};
      }
    } else if (e && e.parameter) {
      payload = e.parameter;
    }

    var action = payload.action;
    if (action === 'login') return jsonResponse(loginAppUser(payload));
    var actor = authorizeAppAction(action, payload.token);
    // Record the real person behind every new record so User / EA can later see only their own.
    payload.actorName = actor ? actor.fullName : '';
    payload.actorRole = actor ? actor.role : '';
    if (actor && ['approveIntroduction','updateDevelopmentProgress','completeDevelopment','completeIntroduction','completeMisUpdate'].indexOf(action) !== -1) { payload.data = payload.data || {}; payload.data.updatedBy = actor.fullName; payload.data.approvedBy = actor.fullName; }
    if (actor && action === 'createRequest') { payload.data = payload.data || {}; payload.data.createdBy = actor.fullName; }
    if (actor && action === 'createTechnicalTicket') { payload.data = payload.data || {}; payload.data.raisedBy = actor.fullName; }
    if (['createRepairIssue', 'approveRepairIssue', 'resolveRepairIssue'].indexOf(action) !== -1) {
      return jsonResponse({ success: true, issue: saveRepairIssue(action, payload), version: bumpSyncVersion() });
    }
    if (!action) {
      return jsonResponse({ error: 'No action specified in payload' });
    }

    if (action === 'initSheet') {
      return jsonResponse(setupInitialSheets());
    }
    if (action === 'setupLoginPermissions') return jsonResponse(formatLoginPageSheet());
    if (action === 'getUsers') {
      return jsonResponse({ version: getSyncVersion(), users: fetchAllUsers() });
    }
    if (action === 'saveUsers') {
      return jsonResponse(handleSaveUsers(payload.users || payload.data));
    }
    if (action === 'createUser') {
      return jsonResponse(handleCreateUser(payload.userData || payload.data || payload));
    }
    if (action === 'updateUser') {
      return jsonResponse(handleUpdateUser(payload.userId || payload.id, payload.userData || payload.data || payload));
    }
    if (action === 'deleteUser') {
      return jsonResponse(handleDeleteUser(payload.userId || payload.username || payload.id));
    }
    if (action === 'createRequest') {
      return jsonResponse(handleCreateRequest(payload.data || payload));
    }
    if (action === 'createTechnicalTicket') return jsonResponse({ success: true, ticket: handleCreateTechnicalTicket(payload.data || payload), version: bumpSyncVersion() });
    if (action === 'submitTechnicalTicket') return jsonResponse({ success: true, ticket: handleSubmitTechnicalTicket(payload.ticketNo, payload.resolvedRemark), version: bumpSyncVersion() });
    if (action === 'approveIntroduction') {
      return jsonResponse(handleApproveIntroduction(payload.requestId, payload.data || payload, payload));
    }
    if (action === 'completeDevelopment') {
      payload.data = payload.data || {}; payload.data.workStatus = 'Completed';
      return jsonResponse(handleUpdateDevelopmentProgress(payload.requestId, payload.data, payload));
    }
    if (action === 'completeIntroduction') return jsonResponse(handleCompleteIntroduction(payload.requestId, payload.data || {}, payload));
    if (action === 'updateDevelopmentProgress') {
      return jsonResponse(handleUpdateDevelopmentProgress(payload.requestId, payload.data || payload, payload));
    }
    if (action === 'submitTestingDecision') {
      return jsonResponse(handleSubmitTestingDecision(payload.requestId, payload.data || payload));
    }
    if (action === 'uploadAttachment') {
      return jsonResponse(handleUploadAttachment(payload.data || payload));
    }
    if (action === 'completeMisUpdate') {
      return jsonResponse(handleCompleteMisUpdate(payload.requestId, payload.data || payload, payload));
    }

    return jsonResponse({ error: 'Unhandled action: ' + action });
  } catch (err) {
    return jsonResponse({ error: err.toString(), stack: err.stack });
  }
}

function handleSubmitTechnicalTicket(ticketNo, resolvedRemark) {
  if (!ticketNo) throw new Error('Ticket number is required.');
  if (!String(resolvedRemark || '').trim()) throw new Error('Resolved remark is required.');
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var sheet = getTechnicalHelpSheet(), columns = technicalHelpColumns(sheet), last = sheet.getLastRow();
    ['actual', 'resolvedremark', 'status'].forEach(function(key) {
      if (!columns[key]) throw new Error('Submit requires this header in Technical Help row 6: ' + key);
    });
    if (last < 7) throw new Error('Technical ticket not found.');
    var numbers = sheet.getRange(7, columns.ticket, last - 6, 1).getValues();
    var index = -1;
    for (var i = 0; i < numbers.length; i++) {
      if (String(numbers[i][0]).trim() === String(ticketNo).trim()) { index = i; break; }
    }
    if (index < 0) throw new Error('Technical ticket not found: ' + ticketNo);
    var row = index + 7;
    var actual = sheet.getRange(row, columns.actual).getValue();
    var savedRemark = sheet.getRange(row, columns.resolvedremark).getValue();
    // Preserve the original completion time on repeated submissions.
    if (!actual) {
      savedRemark = String(resolvedRemark).trim();
      writeTechnicalHelpCell(sheet, row, columns, 'Resolved Remark', savedRemark);
      actual = new Date();
      writeTechnicalHelpCell(sheet, row, columns, 'Actual', actual);
      sheet.getRange(row, columns.actual).setNumberFormat('MM/dd/yyyy HH:mm:ss');
    }
    writeTechnicalHelpCell(sheet, row, columns, 'Status', 'Resolved');
    SpreadsheetApp.flush();
    return { id:String(ticketNo), ticketNo:String(ticketNo), status:'Resolved', actualDate:actual instanceof Date ? actual.toISOString() : String(actual), resolvedRemark:String(savedRemark || '') };
  } finally { lock.releaseLock(); }
}

function getTechnicalHelpSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_TECHNICAL_HELP) || ss.insertSheet(SHEET_TECHNICAL_HELP);
  if (sheet.getMaxColumns() < TECHNICAL_HELP_HEADERS.length) sheet.insertColumnsAfter(sheet.getMaxColumns(), TECHNICAL_HELP_HEADERS.length - sheet.getMaxColumns());
  // Initialize only a completely empty sheet. Never rewrite an existing template.
  if (sheet.getLastRow() === 0) {
    sheet.getRange(6, 1, 1, TECHNICAL_HELP_HEADERS.length).setValues([TECHNICAL_HELP_HEADERS]).setFontWeight('bold');
    sheet.setFrozenRows(6);
  } else if (sheet.getLastRow() >= 6) {
    var existingHeaders = sheet.getRange(6, 1, 1, sheet.getLastColumn()).getValues()[0].map(normalizeHeaderKey);
    TECHNICAL_HELP_HEADERS.forEach(function(header) {
      if (existingHeaders.indexOf(normalizeHeaderKey(header)) === -1) {
        sheet.getRange(6, sheet.getLastColumn() + 1).setValue(header).setFontWeight('bold');
        existingHeaders.push(normalizeHeaderKey(header));
      }
    });
  }
  return sheet;
}

function technicalHelpColumns(sheet) {
  var headers = sheet.getRange(6, 1, 1, sheet.getLastColumn()).getValues()[0];
  var columns = { protectedCols: {} };
  headers.forEach(function(h, i) {
    var key = normalizeHeaderKey(h);
    if (!key) return;
    if (columns[key]) throw new Error('Duplicate Technical Help header: ' + h);
    columns[key] = i + 1;
    if (/planned|delay/.test(key)) columns.protectedCols[i + 1] = true;
  });
  // Known alternative names are mapped from the live sheet on every request.
  var aliases = {
    ticket: ['Ticket No', 'Ticket Number', 'Ticket ID'],
    requestdateist: ['Request Date', 'Created At', 'Timestamp', 'Timestamps'],
    company: ['Company Name'], category: ['Ticket Category', 'Type'], requester: ['Requested By', 'Requester Name'],
    applicationpage: ['Application and Page', 'Application / Page', 'Application'],
    problemsummary: ['Problem Description', 'Problem'],
    whathastobechanged: ['Requested Correction', 'Correction'],
    systempageurl: ['System URL', 'Page URL', 'URL'],
    assignedto: ['Assigned Developer', 'DME', 'Assignee'],
    helpdeskrefticket: ['Helpdesk Ref', 'External Help Ticket'],
    screenshotspdfattachments: ['Attachments', 'Screenshot / PDF Attachments', 'Screenshots', 'Attachment'],
    status: ['Ticket Status'], actual: ['Actual Date', 'Resolved At'],
    resolvedremark: ['Resolved Remarks', 'Resolution Remark', 'Resolution Remarks']
  };
  Object.keys(aliases).forEach(function(key) {
    if (columns[key]) return;
    aliases[key].some(function(alias) {
      var column = columns[normalizeHeaderKey(alias)];
      if (!column || columns.protectedCols[column]) return false;
      columns[key] = column;
      return true;
    });
  });
  if (!columns.ticket) throw new Error('Technical Help row 6 needs a Ticket header.');
  return columns;
}

function writeTechnicalHelpCell(sheet, row, columns, heading, value) {
  var key = normalizeHeaderKey(heading);
  if (/planned|delay/.test(key)) throw new Error('Formula column is protected: ' + heading);
  var column = columns[key];
  if (!column) return; // Optional columns absent from the live sheet are skipped.
  if (columns.protectedCols && columns.protectedCols[column]) throw new Error('Formula column is protected: ' + heading);
  var cell = sheet.getRange(row, column);
  if (typeof cell.getFormula === 'function' && cell.getFormula()) throw new Error('Existing formula will not be overwritten: ' + heading + ', row ' + row);
  if (typeof value === 'string' && /^[=+@-]/.test(value)) value = "'" + value;
  cell.setValue(value);
}

function fetchTechnicalTickets() {
  var sheet = getTechnicalHelpSheet(), columns = technicalHelpColumns(sheet), last = sheet.getLastRow();
  if (last < 7) return [];
  var values = sheet.getRange(7, 1, last - 6, sheet.getLastColumn()).getValues();
  var techMeta = readTechnicalMeta();
  return values.map(function(r) {
    function get(h) { var column = columns[normalizeHeaderKey(h)]; return column ? r[column - 1] : ''; }
    var ticketNo = get('Ticket');
    if (!ticketNo) return null;
    var date = get('Request Date (IST)');
    var attachments = String(get('Screenshots / PDF Attachments') || '').split(/\r?\n/).filter(function(url) { return /^https?:\/\//i.test(url); }).map(function(url, i) { return { id:String(ticketNo) + '-attachment-' + i, name:'Attachment ' + (i + 1), url:url, driveUrl:url }; });
    return { id:ticketNo, ticketNo:ticketNo, createdAt:date instanceof Date ? date.toISOString() : String(date || ''), requester:get('Requester'), company:get('Company'), category:get('Category'), application:get('Application & Page'), url:get('System / Page URL'), problem:get('Problem Summary'), correction:get('What Has To Be Changed'), status:get('Status') || 'Pending', assignedTo:get('Assigned To'), helpTicketNumber:get('Helpdesk Ref / Ticket'), plannedDate:get('Planned'), actualDate:get('Actual'), delay:get('Delay'), resolvedRemark:get('Resolved Remark'), raisedBy:(techMeta[String(ticketNo)] || {}).raisedBy || '', attachments:attachments };
  }).filter(function(ticket) { return ticket !== null; });
}

// Data scope by role: Admin and DME see everything; User and EA only see records raised by them or assigned to them.
function canSeeAllData(user) {
  return Boolean(user) && (user.role === 'Admin' || user.role === 'DME');
}

function ownsName(user, name) {
  var me = String(user && user.fullName || '').trim().toLowerCase(), value = String(name || '').trim().toLowerCase();
  return Boolean(me) && Boolean(value) && (value === me || value.indexOf(me + ' (') === 0);
}

function scopeToUser(user, list, ownerNames) {
  if (!user || canSeeAllData(user)) return list;
  return list.filter(function(item) { return ownerNames(item).some(function(name) { return ownsName(user, name); }); });
}

function requestOwnerNames(request) { return [request.requester, request.createdBy, request.assignedDeveloper]; }

var TECH_META_PREFIX = 'TECHMETA_';

function readTechnicalMeta() {
  var props = PropertiesService.getScriptProperties();
  var all = typeof props.getProperties === 'function' ? (props.getProperties() || {}) : {};
  var out = {};
  Object.keys(all).forEach(function(key) {
    if (key.indexOf(TECH_META_PREFIX) === 0) out[key.slice(TECH_META_PREFIX.length)] = parseJsonSafely(all[key], {}) || {};
  });
  return out;
}

function itResolverNames() {
  var names = [];
  fetchAllUsers().forEach(function(u) {
    if (u.status === 'Active' && normalizeHeaderKey(u.department) === 'itresolver' && u.fullName && names.indexOf(u.fullName) === -1) names.push(u.fullName);
  });
  return names;
}

function handleCreateTechnicalTicket(data) {
  ['company', 'category', 'application', 'sheetPage', 'problem', 'correction'].forEach(function(key) { if (!String(data[key] || '').trim()) throw new Error(key + ' is required.'); });
  if (data.submissionType === 'On Behalf' && !String(data.onBehalfOf || '').trim()) throw new Error('On behalf name and role is required.');
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
  var sheet = getTechnicalHelpSheet(), columns = technicalHelpColumns(sheet), now = new Date();
  var attachments = Array.isArray(data.attachments) ? data.attachments : [];
  if (attachments.length && !columns.screenshotspdfattachments) throw new Error('Add Screenshots / PDF Attachments heading in Technical Help row 6.');
  var attachmentLinks = attachments.map(function(att) {
    var url = String(att.driveUrl || att.url || '').trim();
    if (!/^https?:\/\//i.test(url)) throw new Error('Attachment has not uploaded to Drive: ' + (att.name || 'file'));
    return url;
  });
  var highestNumber = 0;
  var previousAssignee = '';
  // Locate the next ticket slot, independent of prefilled formula rows.
  var rowNumber = 7;
  if (sheet.getLastRow() >= 7) {
    var tickets = sheet.getRange(7, columns.ticket, sheet.getLastRow() - 6, 1).getValues();
    var assignees = columns.assignedto ? sheet.getRange(7, columns.assignedto, sheet.getLastRow() - 6, 1).getValues() : tickets.map(function() { return ['']; });
    tickets.forEach(function(r, i) {
      if (!r[0]) return;
      rowNumber = i + 8;
      previousAssignee = String(assignees[i][0] || '').trim();
      var match = String(r[0]).match(/^TH\s*-\s*(\d{1,6})$/i);
      if (match) highestNumber = Math.max(highestNumber, Number(match[1]));
    });
  }
  var ticketNo = 'TH - ' + ('000' + (highestNumber + 1)).slice(-Math.max(3, String(highestNumber + 1).length));
  // Round-robin over active Login Page users whose Department is "IT Resolver": each new ticket goes to the next one.
  var resolvers = itResolverNames();
  var assignedTo = resolvers.length ? resolvers[(resolvers.indexOf(previousAssignee) + 1) % resolvers.length] : '';
  if (rowNumber > sheet.getMaxRows()) sheet.insertRowsAfter(sheet.getMaxRows(), rowNumber - sheet.getMaxRows());
  var fields = {
    'Request Date (IST)': now,
    'Company':data.company, 'Category':data.category, 'Requester':data.submissionType === 'On Behalf' ? data.onBehalfOf : data.requester || '',
    'Application & Page':data.application + ' / ' + data.sheetPage,
    'Problem Summary':data.problem, 'What Has To Be Changed':data.correction,
    'System / Page URL':data.url || '', 'Assigned To':assignedTo,
    'Helpdesk Ref / Ticket':data.helpTicketNumber || '', 'Status':'Pending'
  };
  if (attachmentLinks.length) fields['Screenshots / PDF Attachments'] = attachmentLinks.join('\n');
  Object.keys(fields).forEach(function(h) { writeTechnicalHelpCell(sheet, rowNumber, columns, h, fields[h]); });
  if (columns.requestdateist) sheet.getRange(rowNumber, columns.requestdateist).setNumberFormat('MM/dd/yyyy HH:mm:ss');
  writeTechnicalHelpCell(sheet, rowNumber, columns, 'Ticket', ticketNo);
  PropertiesService.getScriptProperties().setProperty(TECH_META_PREFIX + ticketNo, JSON.stringify({ raisedBy: String(data.raisedBy || '') }));
  SpreadsheetApp.flush();
  return { id: ticketNo, ticketNo: ticketNo, createdAt: now.toISOString(), requester:fields.Requester, company:data.company || '', category:data.category || '', application:fields['Application & Page'], url:data.url || '', problem:data.problem || '', correction:data.correction || '', status:'Pending', assignedTo:assignedTo, helpTicketNumber:data.helpTicketNumber || '', raisedBy:data.raisedBy || '', plannedDate:'', actualDate:'', delay:'' };
  } finally { lock.releaseLock(); }
}

// Get FMS Requests Sheet
function getRequestsSheet(ss) {
  ss = ss || SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_FMS);
  if (sheet) return sheet;

  sheet = ss.getSheetByName(SHEET_REQUESTS_FALLBACK);
  if (sheet) return sheet;

  var all = ss.getSheets();
  for (var i = 0; i < all.length; i++) {
    var name = all[i].getName().trim().toLowerCase();
    if (name === 'fms' || name === 'system_requests' || name === 'requests') {
      return all[i];
    }
  }
  return null;
}

function normalizeHeaderKey(str) {
  return String(str || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

// Identify row 6 headings and column index mappings
function findHeaderMapping(sheet) {
  var lastCol = Math.max(sheet.getLastColumn(), 1);
  var headerRow = 6;
  var headerValues = [];
  var found = false;

  // FMS has a fixed row-6 template: read it once. Scan only older templates.
  headerValues = sheet.getRange(6, 1, 1, lastCol).getValues()[0];
  found = headerValues.some(function(h) { return /^(requestno|requestnumber|reqno)$/.test(normalizeHeaderKey(h)); });
  var maxScan = Math.min(10, Math.max(sheet.getLastRow(), 6));
  for (var r = 1; !found && r <= maxScan; r++) {
    if (r === 6) continue;
    var rowVals = sheet.getRange(r, 1, 1, lastCol).getValues()[0];
    for (var c = 0; c < rowVals.length; c++) {
      var norm = normalizeHeaderKey(rowVals[c]);
      if (norm === 'requestno' || norm === 'requestnumber' || norm === 'reqno') {
        headerRow = r;
        headerValues = rowVals;
        found = true;
        break;
      }
    }
    if (found) break;
  }

  if (!found) {
    headerRow = 6;
    headerValues = sheet.getRange(headerRow, 1, 1, lastCol).getValues()[0];
  }

  var colMap = {};
  for (var i = 0; i < headerValues.length; i++) {
    var raw = String(headerValues[i] || '').trim();
    if (!raw) continue;
    var k = normalizeHeaderKey(raw);
    if (!colMap[k]) colMap[k] = i + 1;
  }

  function getCol(aliases) {
    for (var a = 0; a < aliases.length; a++) {
      var k = normalizeHeaderKey(aliases[a]);
      if (colMap[k]) return colMap[k];
    }
    // Deleted columns have no mapping. Positional fallbacks can point at another
    // field or the metadata JSON after a user deletes workflow columns.
    return 0;
  }

  // Protect Planned and Delay formula columns
  var protectedCols = {};
  for (var i = 0; i < headerValues.length; i++) {
    var rawHeader = String(headerValues[i] || '').trim().toLowerCase();
    if (rawHeader.indexOf('planned') !== -1 || rawHeader.indexOf('delay') !== -1) {
      protectedCols[i + 1] = true;
    }
  }

  var mapping = {
    headerRow: headerRow,
    dataStartRow: headerRow + 1,
    colMap: colMap,
    protectedCols: protectedCols,
    colTimestamps: getCol(['Timestamps', 'Timestamp', 'Created At'], 1),
    colRequestNo: getCol(['Request No.', 'Request No', 'Request Number', 'Req No'], 2),
    colRequester: getCol(['Requester', 'Requester Name', 'Requested By', 'Name Of Requester', 'Name of Requester']),
    colCompany: getCol(['Company', 'Company Name'], 3),
    colSystemName: getCol(['System Name', 'System', 'Project Name'], 4),
    colSummary: getCol(['Requirements Summary', 'Business Purpose', 'Summary'], 5),
    colDeveloper: getCol(['Assigned Developer', 'Developer', 'Assigned To'], 11),
    colTargetDate: getCol(['Target Date', 'Target Completion Date'], 12),
    colImage: getCol(['Image', 'Images', 'Attachment', 'Drive Link'], 6),
    colWorkStatus: getCol(['Work Status', 'Dev Status']) || (!getCol(['Actual 2', 'Actual2']) ? getCol(['Status']) : 0),
    colActual: getCol(['Actual'], 9),
    // Read legacy dates only when their header exists; never write new meeting dates.
    colMeetingDate: getCol(['Meeting Date', 'Kickoff Date'], 0),
    colDiscussionRemarks: getCol(['Discussion Remarks'], 0),
    colActual1: getCol(['Actual 1', 'Actual1'], 14),
    colSystemLink: getCol(['System Link / URL', 'System Link', 'App Link'], 16),
    colAdminId: getCol(['Admin ID / Username', 'Admin ID', 'Username'], 17),
    colAdminPassword: getCol(['Password', 'Admin Password'], 18),
    colReasonForHold: getCol(['Reason for Hold', 'Hold Reason'], 19),
    colHoldExtendTargetDate: getCol(['Hold Extend Target Date', 'Extended Target Date'], 20),
    colActual2: getCol(['Actual 2', 'Actual2'], 22),
    colIntroductionStatus: getCol(['Introduction Status', 'Introduce Status', 'Status']),
    colDecision: getCol(['Decision', 'Test Decision'], 24),
    colTestRemarks: getCol(['Remarks / Defect Rationale', 'Remarks / Defects'], 25),
    colRevisionNo: getCol(['Revision No', 'Revision No.', 'Rev No'], 26),
    colUpgradeTargetDate: getCol(['Upgrade Target Date', 'Revise Target Date'], 27),
    colActual3: getCol(['Actual 3', 'Actual3'], 29),
    colActual4: getCol(['Actual 4', 'Actual4'], 32),
    colFinalStatus: getCol(['Final Status', 'FinalStatus'], 34)
  };

  Object.keys(mapping).forEach(function(key) {
    if (/^col[A-Z]/.test(key) && typeof mapping[key] === 'number' && protectedCols[mapping[key]]) mapping[key] = 0;
  });

  // Request metadata lives in Script Properties, never in a sheet column.
  mapping.colMeta = 0;

  return mapping;
}

// Safely set a cell value while strictly skipping formula columns
function safeSetCellValue(sheet, row, col, value, mapping) {
  if (!col || col <= 0) return;
  mapping = mapping || findHeaderMapping(sheet);
  if (mapping.protectedCols && mapping.protectedCols[col]) return;
  var cell = sheet.getRange(row, col);
  // Planned/Delay columns carry formulas: skip any cell that already holds one.
  if (typeof cell.getFormula === 'function' && cell.getFormula()) return;
  cell.setValue(value);
}

// Find first available empty row starting from Row 7

/**
 * Fetch all system requests from FMS sheet (Row 7 onwards)
 * HIGH PERFORMANCE: Pure read-only operation. Zero cell writes!
 */
function fetchAllRequests() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = getRequestsSheet(ss);
  if (!sheet) return [];

  var mapping = findHeaderMapping(sheet);
  var lastRow = sheet.getLastRow();
  if (lastRow < mapping.dataStartRow) return [];

  var numRows = lastRow - mapping.dataStartRow + 1;
  var maxCols = fmsLastMappedColumn(mapping);
  var values = sheet.getRange(mapping.dataStartRow, 1, numRows, maxCols).getValues();
  var allMeta = readAllRequestMeta();

  var requests = [];
  for (var i = 0; i < values.length; i++) {
    var row = values[i];
    var rowIndex = mapping.dataStartRow + i;

    var reqNo = String(row[mapping.colRequestNo - 1] || '').trim();
    if (!reqNo) {
      var sysName = String(row[mapping.colSystemName - 1] || '').trim();
      var compName = String(row[mapping.colCompany - 1] || '').trim();
      if (!sysName && !compName) continue;
      reqNo = 'SM-' + ('0000' + (i + 1)).slice(-4);
    }

    var metaObj = allMeta[reqNo] || null;

    var companyName = String(row[mapping.colCompany - 1] || '').trim();
    var systemName = String(row[mapping.colSystemName - 1] || '').trim();
    var businessPurpose = String(row[mapping.colSummary - 1] || '').trim();
    var assignedDeveloper = String(row[mapping.colDeveloper - 1] || '').trim();
    var targetDate = formatDateCell(row[mapping.colTargetDate - 1]);
    var timestampStr = formatTimestampCell(row[mapping.colTimestamps - 1]);
    var requesterName = (mapping.colRequester && mapping.colRequester <= row.length ? String(row[mapping.colRequester - 1] || '').trim() : '') || ((metaObj && metaObj.createdBy && metaObj.createdBy !== 'Administrator') ? String(metaObj.createdBy) : '');

    var meetingDate = mapping.colMeetingDate && mapping.colMeetingDate <= row.length ? formatDateCell(row[mapping.colMeetingDate - 1]) : '';
    var introRemarks = mapping.colDiscussionRemarks && mapping.colDiscussionRemarks <= row.length ? String(row[mapping.colDiscussionRemarks - 1] || '').trim() : '';
    if (!introRemarks && metaObj && metaObj.introduction) introRemarks = metaObj.introduction.remarks || '';
    var holdReason = mapping.colReasonForHold && mapping.colReasonForHold <= row.length ? String(row[mapping.colReasonForHold - 1] || '').trim() : '';
    var holdExtendTargetDate = mapping.colHoldExtendTargetDate && mapping.colHoldExtendTargetDate <= row.length ? formatDateCell(row[mapping.colHoldExtendTargetDate - 1]) : '';

    var sheetActual = mapping.colActual && mapping.colActual <= row.length ? row[mapping.colActual - 1] : null;
    var sheetActualStr = sheetActual ? String(sheetActual).trim() : '';
    var sheetActual1 = mapping.colActual1 && mapping.colActual1 <= row.length ? row[mapping.colActual1 - 1] : null;
    var sheetActual1Str = sheetActual1 ? String(sheetActual1).trim() : '';
    var sheetWorkStatus = mapping.colWorkStatus && mapping.colWorkStatus <= row.length ? String(row[mapping.colWorkStatus - 1] || '').trim() : '';
    var sheetDecision = mapping.colDecision && mapping.colDecision <= row.length ? String(row[mapping.colDecision - 1] || '').trim() : '';
    var sheetTestRemarks = mapping.colTestRemarks && mapping.colTestRemarks <= row.length ? String(row[mapping.colTestRemarks - 1] || '').trim() : '';
    var sheetRevisionNo = mapping.colRevisionNo && mapping.colRevisionNo <= row.length ? String(row[mapping.colRevisionNo - 1] || '').trim() : '';

    if (sheetRevisionNo) {
      var revMatch = sheetRevisionNo.match(/REV-?\d+/i);
      if (revMatch) {
        var numMatch = revMatch[0].match(/\d+/);
        if (numMatch) sheetRevisionNo = 'REV-' + ('0' + parseInt(numMatch[0], 10)).slice(-2);
      }
    }

    var sheetUpgradeTargetDate = mapping.colUpgradeTargetDate && mapping.colUpgradeTargetDate <= row.length ? formatDateCell(row[mapping.colUpgradeTargetDate - 1]) : '';
    var sheetActual2 = mapping.colActual2 && mapping.colActual2 <= row.length ? row[mapping.colActual2 - 1] : null;
    var sheetActual2Str = sheetActual2 ? String(sheetActual2).trim() : '';
    var sheetActual3 = mapping.colActual3 && mapping.colActual3 <= row.length ? row[mapping.colActual3 - 1] : null;
    var sheetActual3Str = sheetActual3 ? String(sheetActual3).trim() : '';
    var sheetActual4 = mapping.colActual4 && mapping.colActual4 <= row.length ? row[mapping.colActual4 - 1] : null;
    var sheetActual4Str = sheetActual4 ? String(sheetActual4).trim() : '';
    var sheetFinalStatus = mapping.colFinalStatus && mapping.colFinalStatus <= row.length ? String(row[mapping.colFinalStatus - 1] || '').trim() : '';

    var internalId = (metaObj && metaObj.id) ? metaObj.id : ('req-' + reqNo);
    var testingHistory = (metaObj && metaObj.testingHistory) ? metaObj.testingHistory : [];
    var misUpdate = (metaObj && metaObj.misUpdate) ? metaObj.misUpdate : null;
    var activityLog = (metaObj && metaObj.activityLog) ? metaObj.activityLog : [];
    var attachments = (metaObj && metaObj.attachments) ? metaObj.attachments : [];
    var currentRevisionNo = sheetRevisionNo || (metaObj && metaObj.currentRevisionNo ? metaObj.currentRevisionNo : null);
    var upgradeTargetDate = sheetUpgradeTargetDate || (metaObj && metaObj.upgradeTargetDate ? formatDateCell(metaObj.upgradeTargetDate) : null) || null;
    // Link / login values come only from the sheet: when a cell is cleared there, the app must not bring it back from history.
    var systemUrl = mapping.colSystemLink && mapping.colSystemLink <= row.length ? String(row[mapping.colSystemLink - 1] || '').trim() : '';
    var adminId = mapping.colAdminId && mapping.colAdminId <= row.length ? String(row[mapping.colAdminId - 1] || '').trim() : '';
    var adminPassword = mapping.colAdminPassword && mapping.colAdminPassword <= row.length ? String(row[mapping.colAdminPassword - 1] || '').trim() : '';

    // Fallback for attachments if sheet has Col H populated
    if (attachments.length === 0 && mapping.colImage && mapping.colImage <= row.length) {
      var rawImgUrl = String(row[mapping.colImage - 1] || '').trim();
      if (rawImgUrl) {
        var driveUrl = rawImgUrl;
        var directUrl = rawImgUrl;
        var mId = rawImgUrl.match(/[-\w]{25,}/);
        if (mId && mId[0]) {
          driveUrl = 'https://drive.google.com/file/d/' + mId[0] + '/view?usp=sharing';
          directUrl = 'https://lh3.googleusercontent.com/d/' + mId[0];
        }
        attachments = [{
          id: 'att-sheet-' + reqNo,
          name: 'Attachment - ' + reqNo,
          url: driveUrl,
          driveUrl: driveUrl,
          directUrl: directUrl,
          previewUrl: directUrl,
          type: (rawImgUrl.toLowerCase().indexOf('.pdf') !== -1) ? 'application/pdf' : 'image/jpeg'
        }];
      }
    }

    // Determine Stage & Status directly from sheet truth
    var isIntroDone = Boolean(meetingDate || sheetActualStr || (metaObj && metaObj.introduction && metaObj.introduction.isCompleted));
    var introduction = isIntroDone ? {
      isCompleted: true,
      remarks: introRemarks,
      completedAt: formatTimestampCell(sheetActual) || timestampStr,
      completedBy: (metaObj && metaObj.introduction && metaObj.introduction.completedBy) ? metaObj.introduction.completedBy : 'Administrator'
    } : { isCompleted: false, remarks: null };

    // Derive legacy sheet state once; the current Actual 2 / Status layout is
    // applied below by the same helper used for single-record saves.
    var currentStage = 'Assign System', currentStatus = 'Assign System: Pending';
    var workStatus = sheetWorkStatus || 'Pending Assignment';
    var progressPercent = 0;
    var latestRemarks = (metaObj && metaObj.latestRemarks) || introRemarks || '';
    var closed = sheetFinalStatus === 'Closed' || sheetActual4Str || (misUpdate && misUpdate.isCompleted);
    var developed = sheetWorkStatus === 'Completed' || (currentRevisionNo ? sheetActual3Str : (sheetActual1Str || sheetActual2Str || sheetDecision === 'Approved'));
    if (closed || developed) {
      currentStage = closed ? 'Closed' : 'Update MIS System';
      currentStatus = closed ? 'Closed' : 'Update MIS: Pending';
      workStatus = closed ? 'Closed' : 'Completed';
      progressPercent = 100;
    } else if (isIntroDone || currentRevisionNo || sheetDecision === 'Rejected') {
      currentStage = 'Create System';
      workStatus = sheetWorkStatus || 'In Progress';
      progressPercent = (metaObj && metaObj.progressPercent) || 0;
      currentStatus = 'Development: ' + workStatus + (progressPercent ? ' (' + progressPercent + '%)' : '');
    }

    var req = {
      id: internalId,
      requestNo: reqNo,
      currentRevisionNo: currentRevisionNo,
      upgradeTargetDate: upgradeTargetDate,
      systemUrl: systemUrl,
      adminId: adminId,
      adminPassword: adminPassword,
      companyName: companyName,
      systemName: systemName,
      systemRequirements: systemName,
      businessPurpose: businessPurpose,
      assignedDeveloper: assignedDeveloper,
      targetCompletionDate: targetDate,
      holdReason: holdReason,
      holdExtendTargetDate: holdExtendTargetDate || null,
      currentStage: currentStage,
      currentStatus: currentStatus,
      workStatus: workStatus,
      progressPercent: progressPercent,
      latestRemarks: latestRemarks,
      createdAt: timestampStr || new Date().toISOString(),
      requester: requesterName,
      createdBy: requesterName || ((metaObj && metaObj.createdBy) ? metaObj.createdBy : 'Administrator'),
      lastUpdatedAt: (metaObj && metaObj.lastUpdatedAt) ? metaObj.lastUpdatedAt : (timestampStr || new Date().toISOString()),
      closedAt: formatTimestampCell(sheetActual4) || (metaObj && metaObj.closedAt ? metaObj.closedAt : ''),
      completedAt: formatTimestampCell(sheetActual4) || (metaObj && (metaObj.closedAt || metaObj.completedAt) ? (metaObj.closedAt || metaObj.completedAt) : ''),
      actualCreateDate: formatTimestampCell(sheetActual1),
      developmentCompletedAt: (metaObj && metaObj.developmentCompletedAt) || formatTimestampCell(sheetActual1),
      actualTestingDate: hasSheetIntroduction(mapping) ? '' : formatTimestampCell(sheetActual2),
      actualReviseDate: formatTimestampCell(sheetActual3),
      actualMisDate: formatTimestampCell(sheetActual4),
      workflowVersion: metaObj && metaObj.workflowVersion,
      systemIntroduction: metaObj && metaObj.systemIntroduction,
      introduction: introduction,
      testingHistory: testingHistory,
      misUpdate: misUpdate,
      activityLog: activityLog,
      attachments: attachments,
      sheetRowIndex: rowIndex
    };

    if (!hasSheetIntroduction(mapping) && metaObj && metaObj.workflowVersion === 2 && currentStage === 'Update MIS System' && !(metaObj.systemIntroduction && metaObj.systemIntroduction.isCompleted)) { req.currentStage = 'Introduce System'; req.currentStatus = 'Introduce System: Pending'; }
    applySheetIntroductionWorkflow(req, row, mapping);
    req.developmentHistory = buildDevelopmentHistoryFromRow(req);
    requests.push(req);
  }

  return requests;
}

// Handle Create System Request (Writes to Row 7 onwards in FMS)
function handleCreateRequest(data) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
  } catch (e) {
    throw new Error('Server busy. Please retry.');
  }

  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = getRequestsSheet(ss) || ss.insertSheet(SHEET_FMS);
    var mapping = findHeaderMapping(sheet);

    // Compute next request number
    var nextNum = 1, emptyRow = 0;
    var lastRow = sheet.getLastRow();
    if (lastRow >= mapping.dataStartRow) {
      var numRows = lastRow - mapping.dataStartRow + 1;
      var reqVals = sheet.getRange(mapping.dataStartRow, mapping.colRequestNo, numRows, 1).getValues();
      for (var i = 0; i < reqVals.length; i++) {
        if (!String(reqVals[i][0] || '').trim() && !emptyRow) emptyRow = mapping.dataStartRow + i;
        var m = String(reqVals[i][0] || '').match(/SM-(\d+)/);
        if (m) {
          var n = parseInt(m[1], 10);
          if (n >= nextNum) nextNum = n + 1;
        }
      }
    }

    var requestNo = 'SM-' + ('0000' + nextNum).slice(-4);
    var targetRow = emptyRow || Math.max(mapping.dataStartRow, lastRow + 1);
    var now = new Date();
    var nowISO = now.toISOString();
    var id = 'req-' + now.getTime();

    var systemName = data.systemName || data.systemRequirements || 'New System';
    var companyName = data.companyName || '';
    var assignedDeveloper = '';
    var targetDate = '';

    var initialActivityLog = [{
      id: 'act-' + now.getTime(),
      action: 'Request Created',
      actor: data.createdBy || 'Administrator',
      timestamp: nowISO,
      details: 'System Request ' + requestNo + ' created for ' + companyName + '.'
    }];

    // Process attachments to Google Drive
    var processedAttachments = [];
    if (data.attachments && data.attachments.length > 0) {
      for (var a = 0; a < data.attachments.length; a++) {
        var att = data.attachments[a];
        if (att && att.base64Data) {
          try {
            var folder = getAttachmentsFolder();
            var base64 = String(att.base64Data);
            var comma = base64.indexOf(',');
            if (comma !== -1) base64 = base64.substring(comma + 1);
            var blob = Utilities.newBlob(Utilities.base64Decode(base64), att.type || 'application/octet-stream', att.name || ('Attachment_' + requestNo));
            var driveFile = folder.createFile(blob);
            try { driveFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch (e) {}

            processedAttachments.push({
              id: att.id || ('att-' + now.getTime() + '-' + a),
              name: driveFile.getName(),
              size: driveFile.getSize(),
              type: att.type || '',
              url: driveFile.getUrl(),
              driveUrl: driveFile.getUrl(),
              fileId: driveFile.getId(),
              uploadedAt: nowISO
            });
          } catch (err) {
            processedAttachments.push(att);
          }
        } else if (att) {
          processedAttachments.push(att);
        }
      }
    }

    var metaObj = {
      id: id,
      requestNo: requestNo,
      currentRevisionNo: null,
      workflowVersion: 2,
      currentStage: 'Assign System',
      currentStatus: 'Assign System: Pending',
      workStatus: null,
      progressPercent: 0,
      latestRemarks: 'New request created. Pending Assign System approval.',
      createdBy: data.createdBy || 'Administrator',
      createdAt: nowISO,
      lastUpdatedAt: nowISO,
      introduction: { isCompleted: false },
      testingHistory: [],
      misUpdate: null,
      activityLog: initialActivityLog,
      attachments: processedAttachments
    };

    // Write values to FMS columns
    safeSetCellValue(sheet, targetRow, mapping.colTimestamps, now, mapping);
    safeSetCellValue(sheet, targetRow, mapping.colRequestNo, requestNo, mapping);
    safeSetCellValue(sheet, targetRow, mapping.colRequester, data.createdBy || '', mapping);
    safeSetCellValue(sheet, targetRow, mapping.colCompany, companyName, mapping);
    safeSetCellValue(sheet, targetRow, mapping.colSystemName, systemName, mapping);
    safeSetCellValue(sheet, targetRow, mapping.colSummary, data.businessPurpose || systemName, mapping);
    safeSetCellValue(sheet, targetRow, mapping.colDeveloper, assignedDeveloper, mapping);
    safeSetCellValue(sheet, targetRow, mapping.colTargetDate, targetDate, mapping);

    if (mapping.colImage && processedAttachments.length > 0) {
      safeSetCellValue(sheet, targetRow, mapping.colImage, processedAttachments[0].driveUrl || processedAttachments[0].url, mapping);
    }
    if (mapping.colWorkStatus) safeSetCellValue(sheet, targetRow, mapping.colWorkStatus, 'Pending Assignment', mapping);
    if (mapping.colFinalStatus) safeSetCellValue(sheet, targetRow, mapping.colFinalStatus, 'Open', mapping);

    // Save metadata
    writeRequestMeta(requestNo, metaObj);

    bumpSyncVersion();

    var createdReq = {
      id: id,
      requestNo: requestNo,
      companyName: companyName,
      systemName: systemName,
      systemRequirements: systemName,
      businessPurpose: data.businessPurpose || systemName,
      assignedDeveloper: assignedDeveloper,
      targetCompletionDate: targetDate,
      workflowVersion: 2,
      currentStage: 'Assign System',
      currentStatus: 'Assign System: Pending',
      workStatus: 'Pending Assignment',
      progressPercent: 0,
      latestRemarks: 'New request created. Pending Assign System approval.',
      createdAt: nowISO,
      requester: data.createdBy || '',
      createdBy: data.createdBy || 'Administrator',
      lastUpdatedAt: nowISO,
      introduction: { isCompleted: false },
      testingHistory: [],
      misUpdate: null,
      activityLog: initialActivityLog,
      attachments: processedAttachments,
      sheetRowIndex: targetRow
    };

    return {
      success: true,
      requestNo: requestNo,
      id: id,
      targetRow: targetRow,
      version: getSyncVersion(),
      request: createdReq
    };
  } finally {
    lock.releaseLock();
  }
}

// Handle Approve Introduction
function handleApproveIntroduction(requestId, data, reference) {
  return updateRequestRow(requestId, function(rowObj) {
    var nowISO = new Date().toISOString();
    rowObj.currentStage = 'Create System';
    rowObj.currentStatus = 'Create System: Pending';
    rowObj.workStatus = 'In Progress';
    rowObj.progressPercent = 0;
    rowObj.workflowVersion = 2;
    rowObj.latestRemarks = data.remarks || 'Assignment approved.';
    rowObj.assignedDeveloper = data.assignedDeveloper || rowObj.assignedDeveloper || '';
    rowObj.targetCompletionDate = data.targetCompletionDate || rowObj.targetCompletionDate || '';
    rowObj.lastUpdatedAt = nowISO;
    rowObj.introduction = {
      isCompleted: true,
      remarks: data.remarks || '',
      completedAt: nowISO,
      completedBy: data.approvedBy || 'Administrator'
    };
    rowObj.activityLog.push({
      id: 'act-' + new Date().getTime(),
      action: 'Assignment Approved',
      actor: data.approvedBy || 'Administrator',
      timestamp: nowISO,
      details: 'Assignment approved. Scope approved.'
    });
    return rowObj;
  }, reference);
}

// Handle Update Development Progress
function handleUpdateDevelopmentProgress(requestId, data, reference) {
  return updateRequestRow(requestId, function(rowObj) {
    var nowISO = new Date().toISOString();
    var workStatus = data.workStatus || 'In Progress';
    rowObj.workStatus = workStatus;
    rowObj.lastUpdatedAt = nowISO;

    if (data.upgradeTargetDate) rowObj.upgradeTargetDate = data.upgradeTargetDate;
    // System link and admin login belong to a finished system: In Progress / On Hold submissions never save them.
    if (workStatus === 'Completed') {
      if (data.systemUrl !== undefined) rowObj.systemUrl = data.systemUrl;
      if (data.adminId !== undefined) rowObj.adminId = data.adminId;
      if (data.adminPassword !== undefined) rowObj.adminPassword = data.adminPassword;
    }

    if (workStatus === 'In Progress') {
      var pct = parseInt(data.progressPercent, 10) || 0;
      rowObj.progressPercent = pct;
      rowObj.latestRemarks = data.remarks || 'Progress updated.';
      rowObj.currentStage = 'Create System';
      rowObj.currentStatus = 'Development: In Progress (' + pct + '%)';
      rowObj.activityLog.push({
        id: 'act-' + new Date().getTime(),
        action: 'Development Progress',
        actor: data.updatedBy || 'Administrator',
        timestamp: nowISO,
        details: 'Progress updated to ' + pct + '%.'
      });
    } else if (workStatus === 'On Hold') {
      rowObj.latestRemarks = data.holdReason || 'Put on hold.';
      rowObj.holdReason = data.holdReason || '';
      rowObj.currentStage = 'Create System';
      rowObj.currentStatus = rowObj.currentRevisionNo ? 'Revise: On Hold' : 'Development: On Hold';
      var extDate = data.holdExtendTargetDate || data.extendedTargetDate || null;
      if (extDate) rowObj.holdExtendTargetDate = extDate;
      rowObj.activityLog.push({
        id: 'act-' + new Date().getTime(),
        action: 'Development Put On Hold',
        actor: data.updatedBy || 'Administrator',
        timestamp: nowISO,
        details: 'Reason: "' + (data.holdReason || '') + '".'
      });
    } else if (workStatus === 'Completed') {
      rowObj.workflowVersion = 2;
      rowObj.systemIntroduction = { isCompleted: false };
      rowObj.progressPercent = 100;
      if (rowObj.currentRevisionNo) {
        rowObj.latestRemarks = data.remarks || 'Revision completed. Sent to Introduce System.';
        rowObj.currentStage = 'Introduce System';
        rowObj.currentStatus = 'Introduce System: Pending';
      } else {
        rowObj.latestRemarks = data.remarks || 'Development completed. Sent to Introduce System.';
        rowObj.currentStage = 'Introduce System';
        rowObj.currentStatus = 'Introduce System: Pending';
      }
      rowObj.developmentCompletedAt = nowISO;
      rowObj.activityLog.push({
        id: 'act-' + new Date().getTime(),
        action: 'Development Completed',
        actor: data.updatedBy || 'Administrator',
        timestamp: nowISO,
        details: 'Cycle completed (100%).'
      });
    }
    return rowObj;
  }, reference);
}

// Handle Submit Testing Decision
function handleSubmitTestingDecision(requestId, data) {
  return updateRequestRow(requestId, function(rowObj) {
    var nowISO = new Date().toISOString();
    var decision = data.decision || 'Approved';
    var attemptNum = (rowObj.testingHistory.length || 0) + 1;

    if (decision === 'Approved') {
      rowObj.currentStage = 'Update MIS System';
      rowObj.currentStatus = 'Update MIS: Pending';
      rowObj.latestRemarks = data.remarks || 'Testing Approved. Ready for MIS update.';
      rowObj.lastUpdatedAt = nowISO;
      rowObj.testingHistory.push({
        attemptNumber: attemptNum,
        revisionNo: rowObj.currentRevisionNo,
        decision: 'Approved',
        remarks: data.remarks || 'Passed testing.',
        testedBy: data.testedBy || 'QA Lead',
        testedAt: nowISO
      });
      rowObj.activityLog.push({
        id: 'act-' + new Date().getTime(),
        action: 'Testing Approved',
        actor: data.testedBy || 'QA Lead',
        timestamp: nowISO,
        details: 'Passed testing.'
      });
    } else {
      var rejections = rowObj.testingHistory.filter(function(t) { return t.decision === 'Rejected'; });
      var revNum = rejections.length + 1;
      var newRevNo = 'REV-' + ('0' + revNum).slice(-2);
      var upgradeDate = data.upgradeTargetDate || data.extendedTargetDate || null;
      if (upgradeDate) rowObj.upgradeTargetDate = upgradeDate;

      rowObj.testingHistory.push({
        attemptNumber: attemptNum,
        revisionNo: rowObj.currentRevisionNo,
        decision: 'Rejected',
        remarks: data.remarks || 'Testing rejected.',
        testedBy: data.testedBy || 'QA Lead',
        testedAt: nowISO,
        generatedRevisionNo: newRevNo,
        extendedTargetDate: upgradeDate,
        upgradeTargetDate: upgradeDate
      });

      rowObj.currentStage = 'Revise System';
      rowObj.currentStatus = 'Revise System (Pending)';
      rowObj.currentRevisionNo = newRevNo;
      rowObj.workStatus = 'In Progress';
      rowObj.progressPercent = 0;
      rowObj.latestRemarks = 'Testing Rejected: ' + (data.remarks || '');
      rowObj.lastUpdatedAt = nowISO;

      rowObj.activityLog.push({
        id: 'act-' + new Date().getTime(),
        action: 'Testing Rejected (' + newRevNo + ')',
        actor: data.testedBy || 'QA Lead',
        timestamp: nowISO,
        details: 'Rejected with remarks: "' + (data.remarks || '') + '".'
      });
    }
    return rowObj;
  });
}

// Handle Complete MIS Update
function handleCompleteMisUpdate(requestId, data, reference) {
  if (!String(data.remarks || '').trim()) throw new Error('MIS update remarks are required.');
  return updateRequestRow(requestId, function(rowObj) {
    if (rowObj.workflowVersion === 2 && (rowObj.currentStage !== 'Update MIS System' || !(rowObj.systemIntroduction && rowObj.systemIntroduction.isCompleted))) throw new Error('Complete system introduction before updating MIS.');
    var nowISO = new Date().toISOString();
    rowObj.currentStage = 'Closed';
    rowObj.currentStatus = 'Closed';
    rowObj.latestRemarks = 'MIS Updated: ' + (data.remarks || '');
    rowObj.lastUpdatedAt = nowISO;
    rowObj.misUpdate = {
      isCompleted: true,
      remarks: data.remarks || '',
      updatedAt: nowISO,
      updatedBy: data.updatedBy || 'Administrator'
    };
    rowObj.activityLog.push({
      id: 'act-' + new Date().getTime(),
      action: 'MIS Update Completed (Closed)',
      actor: data.updatedBy || 'Administrator',
      timestamp: nowISO,
      details: 'Request closed.'
    });
    return rowObj;
  }, reference);
}

// Update a row in FMS Sheet safely
function updateRequestRow(requestId, updateFn, reference) {
  var lock = typeof LockService !== 'undefined' ? LockService.getScriptLock() : null;
  if (lock) lock.waitLock(10000);
  try {
    var loaded = loadRequestRecord(requestId, reference);
    var sheet = loaded.sheet, mapping = loaded.mapping, row = loaded.row, rowNumber = loaded.rowNumber;
    var record = loaded.record;
    function get(column) { return column ? row[column - 1] : ''; }
    var updated = updateFn(record), changes = {};
    function plan(column, value, onlyBlank, dateOnly) {
      if (!column || mapping.protectedCols[column] || (onlyBlank && get(column))) return;
      var old = get(column);
      var same = dateOnly ? formatDateCell(old) === formatDateCell(value) : old instanceof Date && value instanceof Date ? old.getTime() === value.getTime() : String(old == null ? '' : old) === String(value == null ? '' : value);
      if (!same) changes[column] = value;
    }
    if (updated.introduction && updated.introduction.isCompleted) {
      plan(mapping.colDeveloper, updated.assignedDeveloper);
      plan(mapping.colTargetDate, updated.targetCompletionDate, false, true);
      plan(mapping.colActual, new Date(updated.introduction.completedAt || Date.now()), true);
      plan(mapping.colFinalStatus, 'In Progress');
    }
    if (updated.workStatus) plan(mapping.colWorkStatus, updated.workStatus);
    if (updated.workStatus === 'On Hold') {
      plan(mapping.colReasonForHold, updated.holdReason || updated.latestRemarks || 'On Hold');
      if (updated.holdExtendTargetDate) plan(mapping.colHoldExtendTargetDate, updated.holdExtendTargetDate, false, true);
    }
    if (updated.workStatus === 'Completed') {
      plan(updated.currentRevisionNo && mapping.colActual3 ? mapping.colActual3 : mapping.colActual1, new Date(updated.developmentCompletedAt || Date.now()), true);
      plan(mapping.colSystemLink, updated.systemUrl); plan(mapping.colAdminId, updated.adminId); plan(mapping.colAdminPassword, updated.adminPassword);
    }
    if (hasSheetIntroduction(mapping)) {
      if (updated.systemIntroduction && updated.systemIntroduction.isCompleted) {
        plan(mapping.colActual2, new Date(updated.systemIntroduction.completedAt || Date.now()), true);
        plan(mapping.colIntroductionStatus, 'Completed');
      } else if (updated.currentStage === 'Introduce System') plan(mapping.colIntroductionStatus, 'Pending');
    }
    if (updated.misUpdate && updated.misUpdate.isCompleted) {
      plan(mapping.colActual4, new Date(updated.misUpdate.updatedAt || Date.now()), true);
      plan(mapping.colFinalStatus, 'Closed'); plan(mapping.colWorkStatus, 'Closed');
      updated.closedAt = formatTimestampCell(get(mapping.colActual4)) || updated.misUpdate.updatedAt;
      updated.workStatus = 'Closed';
    }
    // Read formulas only for cells that actually need changing. Never rewrite a
    // full row: that would overwrite Planned/Delay and other users' formulas.
    var pending = Object.keys(changes).map(function(column) {
      var cell = sheet.getRange(rowNumber, Number(column));
      if (typeof cell.getFormula === 'function' && cell.getFormula()) throw new Error('Existing formula will not be overwritten in column ' + column + '.');
      return { cell: cell, value: changes[column] };
    });
    pending.forEach(function(change) { change.cell.setValue(change.value); });
    writeRequestMeta(updated.requestNo, updated);
    return { success: true, version: bumpSyncVersion(), request: updated };
  } finally { if (lock) lock.releaseLock(); }
}

// Handle direct file upload to Google Drive
function handleUploadAttachment(data) {
  try {
    var folder = getAttachmentsFolder();
    var base64 = String(data.base64Data || '');
    var comma = base64.indexOf(',');
    if (comma !== -1) base64 = base64.substring(comma + 1);

    var decoded = Utilities.base64Decode(base64);
    var mimeType = data.type || 'application/octet-stream';
    var fileName = data.name || ('Attachment_' + new Date().getTime());
    var blob = Utilities.newBlob(decoded, mimeType, fileName);
    var driveFile = folder.createFile(blob);

    try { driveFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch (e) {}

    var fileId = driveFile.getId();
    var driveViewUrl = 'https://drive.google.com/file/d/' + fileId + '/view?usp=sharing';
    var directImgUrl = 'https://lh3.googleusercontent.com/d/' + fileId;

    return {
      success: true,
      fileId: fileId,
      name: fileName,
      size: driveFile.getSize(),
      type: mimeType,
      url: driveViewUrl,
      directUrl: directImgUrl,
      driveUrl: driveViewUrl,
      uploadedAt: new Date().toISOString()
    };
  } catch (err) {
    return { success: false, error: err.toString() };
  }
}

function getAttachmentsFolder() {
  if (DRIVE_FOLDER_ID && DRIVE_FOLDER_ID !== 'YOUR_FOLDER_ID') {
    try { return DriveApp.getFolderById(DRIVE_FOLDER_ID); } catch (e) {}
  }
  var folderName = 'Make System Attachments';
  var it = DriveApp.getFoldersByName(folderName);
  return it.hasNext() ? it.next() : DriveApp.createFolder(folderName);
}

// Login Page & User Sheet Handlers
function getLoginSheet(ss) {
  ss = ss || SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_LOGIN);
  if (sheet) return sheet;

  var all = ss.getSheets();
  for (var i = 0; i < all.length; i++) {
    var n = all[i].getName().trim().toLowerCase();
    if (n === 'login page' || n === 'login' || n === 'users') return all[i];
  }

  sheet = ss.insertSheet(SHEET_LOGIN);
  sheet.getRange(1, 1, 1, LOGIN_HEADERS.length).setValues([LOGIN_HEADERS]).setFontWeight('bold');
  return sheet;
}

function userStageLabels() {
  return { requests:'System Requests', 'technical-new':'Raise Technical Help', 'technical-all':'All Technical Tickets', assign:'Assign System', create:'Create System', introduce:'Introduce System', mis:'Update in MIS System', 'repair-new':'New Issue Request', 'repair-approval':'Approval For Repair', 'repair-work':'Resolve Problem' };
}

// Roles: Admin has full access; User / EA / DME get the pages ticked for them on the Login Page sheet.
function normalizeRole(value) {
  var role = String(value || '').trim().toUpperCase();
  return role === 'ADMIN' ? 'Admin' : role === 'EA' ? 'EA' : role === 'DME' ? 'DME' : 'User';
}

function loginSystems() {
  return { make:{ label:'Make System', stages:['requests','assign','create','introduce','mis'] }, technical:{ label:'Technical Help', stages:['technical-new','technical-all'] }, repair:{ label:'Repair System', stages:['repair-new','repair-approval','repair-work'] } };
}

function loginAppUser(payload) {
  var username = String(payload.username || '').trim().toLowerCase();
  var user = fetchAllUsers(username)[0];
  if (!user || user.status !== 'Active' || user.password !== String(payload.password || '').trim()) throw new Error('Invalid username/password or inactive account.');
  var token = signSessionToken(user.username);
  delete user.password;
  return {user:user, token:token};
}

// Stateless signed sessions: CacheService entries are evicted early and capped at 6h, which logged users out repeatedly.
var SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

function sessionSecret() {
  var props = PropertiesService.getScriptProperties();
  var secret = props.getProperty('SESSION_SECRET');
  if (!secret) { secret = Utilities.getUuid() + Utilities.getUuid(); props.setProperty('SESSION_SECRET', secret); }
  return secret;
}

function signSessionToken(username) {
  var payload = Utilities.base64EncodeWebSafe(username + '|' + (Date.now() + SESSION_TTL_MS));
  return payload + '.' + Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(payload, sessionSecret()));
}

function verifySessionToken(token) {
  var parts = String(token || '').split('.');
  if (parts.length !== 2) return '';
  var expected = Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(parts[0], sessionSecret()));
  if (expected !== parts[1]) return '';
  var decoded = Utilities.newBlob(Utilities.base64DecodeWebSafe(parts[0])).getDataAsString();
  var cut = decoded.lastIndexOf('|');
  if (cut < 0 || Number(decoded.slice(cut + 1)) < Date.now()) return '';
  return decoded.slice(0, cut);
}

function authorizeAppAction(action, token) {
  var username = verifySessionToken(token);
  if (!username) throw new Error('Session expired. Please log in again.');
  var user = fetchAllUsers(username)[0];
  if (!user || user.status !== 'Active') throw new Error('Account inactive or removed.');
  var admin = user.role === 'Admin';
  var adminActions = ['getUsers','saveUsers','createUser','updateUser','deleteUser','initSheet','setupLoginPermissions'];
  if (adminActions.indexOf(action) !== -1) { if (!admin) throw new Error('Only Admin can manage users and permissions.'); return user; }
  if (action === 'getSession' || action === 'getMasterOptions' || action === 'ping' || admin) return user;
  var reads = {getRequest:['requests','assign','create','introduce','mis'],getTechnicalTickets:['technical-all'],getRepairIssues:['repair-new','repair-approval','repair-work'],getRequests:['requests','assign','create','introduce','mis'],checkSync:['requests','assign','create','introduce','mis']};
  var writes = {createTechnicalTicket:'technical-new',submitTechnicalTicket:'technical-all',createRepairIssue:'repair-new',approveRepairIssue:'repair-approval',resolveRepairIssue:'repair-work',createRequest:'requests',approveIntroduction:'assign',completeIntroduction:'introduce',submitTestingDecision:'testing',completeMisUpdate:'mis'};
  if (reads[action]) {
    if (!reads[action].some(function(id) { return user.permissions[id] && user.permissions[id].view; })) throw new Error('No access to this system.');
    return user;
  }
  var ids = (action === 'updateDevelopmentProgress' || action === 'completeDevelopment') ? ['create'] : action === 'uploadAttachment' ? ['requests','technical-new','repair-new'] : [writes[action]];
  if (!ids.some(function(id) { return id && user.permissions[id] && user.permissions[id].view && user.permissions[id].update; })) throw new Error('Update access denied.');
  return user;
}

// Login Page core columns are found by heading (A..G by default). "Permitted Stages" is optional and never required:
// access comes from the Access / View / Update columns.
function loginCoreColumns(sheet, headerValues) {
  var headers = (headerValues || sheet.getRange(1, 1, 1, Math.max(7, sheet.getLastColumn())).getValues()[0]).map(normalizeHeaderKey);
  function find(names, fallback) {
    for (var i = 0; i < names.length; i++) { var at = headers.indexOf(normalizeHeaderKey(names[i])); if (at !== -1) return at + 1; }
    return fallback;
  }
  return {
    fullName: find(['Full Name', 'Name'], 1), user: find(['User', 'Username', 'User Name'], 2), role: find(['Role'], 3),
    password: find(['Password'], 4), status: find(['Status'], 5), department: find(['Department'], 6), created: find(['Created', 'Created At'], 7),
    permitted: find(['Permitted Stages'], 0)
  };
}

function loginAccessColumns(sheet, ensure, headerValues) {
  var labels = userStageLabels(), systems = loginSystems();
  var headers = headerValues || sheet.getRange(1,1,1,Math.max(7,sheet.getLastColumn())).getValues()[0];
  // Match headings ignoring case, spaces and punctuation so small sheet edits do not drop access flags.
  var headerKeys = headers.map(normalizeHeaderKey);
  var expected = [];
  Object.keys(systems).forEach(function(key) { expected.push(systems[key].label + ' Access'); });
  Object.keys(labels).forEach(function(key) { expected.push(labels[key] + ' View', labels[key] + ' Update'); });
  var mapping = {};
  expected.forEach(function(name) {
    var column = headerKeys.indexOf(normalizeHeaderKey(name)) + 1;
    if (!column && !ensure && name.indexOf('Assign System ') === 0) column = headerKeys.indexOf(normalizeHeaderKey(name.replace('Assign System ', 'Introduce System '))) + 1;
    if (!column && !ensure && name.indexOf('Update in MIS System ') === 0) column = headerKeys.indexOf(normalizeHeaderKey(name.replace('Update in MIS System ', 'Update MIS System '))) + 1;
    if (!column && ensure) {
      column = headers.length + 1;
      if (column > sheet.getMaxColumns()) sheet.insertColumnsAfter(sheet.getMaxColumns(), column - sheet.getMaxColumns());
      sheet.getRange(1,column).setValue(name).setFontWeight('bold');
      headers.push(name);
      headerKeys.push(normalizeHeaderKey(name));
    }
    if (column) mapping[name] = column;
  });
  return mapping;
}

function fetchAllUsers(username) {
  var sheet = getLoginSheet();
  var lastRow = sheet.getLastRow();
  if (lastRow <= 1) {
    return [];
  }

  var width = Math.max(7, sheet.getLastColumn());
  var headers = sheet.getRange(1, 1, 1, width).getValues()[0];
  var core = loginCoreColumns(sheet, headers);
  var accessColumns = loginAccessColumns(sheet, false, headers);
  var values;
  if (username) {
    var located = findRecordRow(sheet, core.user, username, 2, width, null, function(value) { return String(value || '').replace(/^@+/, '').replace(/[()\s]/g, '').toLowerCase(); });
    if (!located) {
      // Old Login rows without a User value derive their username from Full Name.
      var byName = findRecordRow(sheet, core.fullName, username, 2, width, null, function(value) { return String(value || '').toLowerCase().replace(/[^a-z0-9]/g, ''); });
      if (byName && !String(byName.values[core.user - 1] || '').trim()) located = byName;
    }
    if (!located) return [];
    values = [located.values];
  } else values = sheet.getRange(2, 1, lastRow - 1, width).getValues();
  var users = [];

  for (var i = 0; i < values.length; i++) {
    var row = values[i];
    var rawFullName = String(row[core.fullName - 1] || '').trim();
    var rawUsername = String(row[core.user - 1] || '').trim();
    if (!rawFullName && !rawUsername) continue;

    var cleanUser = rawUsername.replace(/^@+/, '').replace(/[\(\)]/g, '').replace(/\s+/g, '').toLowerCase() || rawFullName.toLowerCase().replace(/[^a-z0-9]/g, '');
    var cleanName = rawFullName || cleanUser;
    var role = normalizeRole(row[core.role - 1]);
    var status = String(row[core.status - 1] || 'ACTIVE').trim().toUpperCase() === 'INACTIVE' ? 'Inactive' : 'Active';
    var password = String(row[core.password - 1] || 'password123').trim() || 'password123';
    var department = String(row[core.department - 1] || 'General').trim();
    var permittedStagesText = core.permitted ? String(row[core.permitted - 1] || '').trim() : '';

    var permissions = {};
    var stageLabels = userStageLabels();
    var stageList = Object.keys(stageLabels);
    var lowerText = permittedStagesText.toLowerCase();
    var explicitStages = /^stages:\s*/i.test(permittedStagesText) ? permittedStagesText.replace(/^stages:\s*/i, '').toLowerCase().split(',').map(function(label) { return label.trim(); }) : null;

    if (role === 'Admin' || lowerText.indexOf('all stages') !== -1) {
      for (var s = 0; s < stageList.length; s++) {
        permissions[stageList[s]] = { view: true, edit: (role === 'Admin'), approve: (role === 'Admin') };
      }
    } else {
      for (var s = 0; s < stageList.length; s++) {
        var sid = stageList[s];
        if (explicitStages) {
          var allowed = explicitStages.indexOf(stageLabels[sid].toLowerCase()) !== -1;
          if (sid === 'assign') allowed = allowed || explicitStages.indexOf('introduce system') !== -1;
          if (sid === 'mis') allowed = allowed || explicitStages.indexOf('update mis system') !== -1;
          permissions[sid] = { view:allowed, edit:false, approve:false };
          continue;
        }
        var isPermitted = (sid === 'requests' && lowerText.indexOf('request') !== -1) ||
                          (sid === 'assign' && /assign|introduce/.test(lowerText)) ||
                          (sid === 'introduce' && lowerText.indexOf('introduce') !== -1) ||
                          (sid === 'create' && lowerText.indexOf('create') !== -1) ||
                          (sid === 'revise' && lowerText.indexOf('revise') !== -1) ||
                          (sid === 'testing' && (lowerText.indexOf('test') !== -1 || lowerText.indexOf('qa') !== -1)) ||
                          (sid === 'mis' && lowerText.indexOf('mis') !== -1) ||
                          (sid === 'repair-new' && lowerText.indexOf('new issue request') !== -1) ||
                          (sid === 'repair-approval' && lowerText.indexOf('approval for repair') !== -1) ||
                          (sid === 'repair-work' && lowerText.indexOf('resolve problem') !== -1) ||
                          (sid === 'technical-new' && lowerText.indexOf('raise technical help') !== -1) ||
                          (sid === 'technical-all' && lowerText.indexOf('all technical tickets') !== -1);
        permissions[sid] = { view: isPermitted, edit: false, approve: false };
      }
    }

    var systemAccess = {};
    var systems = loginSystems();
    function yes(value) { return value === true || /^(yes|true|1|allowed|view|update)$/i.test(String(value).trim()); }
    Object.keys(systems).forEach(function(key) {
      var system = systems[key], systemCol = accessColumns[system.label + ' Access'];
      var explicitSystem = systemCol && String(row[systemCol-1]).trim() !== '';
      systemAccess[key] = role === 'Admin' || (explicitSystem ? yes(row[systemCol-1]) : system.stages.some(function(id) { return permissions[id].view; }));
      system.stages.forEach(function(id) {
        var viewCol = accessColumns[stageLabels[id] + ' View'], updateCol = accessColumns[stageLabels[id] + ' Update'];
        var view = role === 'Admin' || (viewCol && String(row[viewCol-1]).trim() !== '' ? yes(row[viewCol-1]) : permissions[id].view);
        var update = role === 'Admin' || Boolean(updateCol && yes(row[updateCol-1]));
        permissions[id] = { view:systemAccess[key] && view, update:systemAccess[key] && view && update, edit:role === 'Admin', approve:systemAccess[key] && view && update };
      });
    });
    var grantedLabels = stageList.filter(function(id) { return permissions[id] && permissions[id].view; }).map(function(id) { return stageLabels[id]; });
    users.push({
      systemAccess: systemAccess,
      id: 'usr-sheet-' + cleanUser,
      username: cleanUser,
      fullName: cleanName,
      role: role,
      status: status,
      permittedStagesText: role === 'Admin' ? 'All Stages (Admin Full Access)' : 'Stages: ' + (grantedLabels.join(', ') || 'None'),
      permissions: permissions,
      department: department,
      createdAt: row[core.created - 1] instanceof Date ? row[core.created - 1].toISOString() : String(row[core.created - 1] || ''),
      password: password
    });
  }

  return users;
}

function handleSaveUsers(users) {
  if (!Array.isArray(users)) users = [];
  var sheet = getLoginSheet();
  var accessColumns = loginAccessColumns(sheet, true);
  var core = loginCoreColumns(sheet);
  var labels = userStageLabels(), systems = loginSystems();
  var accessRows = [];
  var rowData = users.map(function(u) {
    var roleStr = normalizeRole(u.role).toUpperCase();
    var statusStr = (u.status || 'Active').toUpperCase() === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE';
    var permText = roleStr === 'ADMIN' ? 'All Stages (Admin Full Access)' : (u.permittedStagesText || '1 of 6 Stages (View)');
    if (roleStr !== 'ADMIN' && u.permissions) {
      var granted = Object.keys(labels).filter(function(key) { return u.permissions[key] && u.permissions[key].view; }).map(function(key) { return labels[key]; });
      permText = 'Stages: ' + (granted.length ? granted.join(', ') : 'None');
    }
    var access = {}, allowedLabels = [];
    Object.keys(systems).forEach(function(key) {
      var system = systems[key];
      var enabled = roleStr === 'ADMIN' || (u.systemAccess && u.systemAccess[key] !== undefined ? Boolean(u.systemAccess[key]) : system.stages.some(function(id) { return u.permissions && u.permissions[id] && u.permissions[id].view; }));
      access[system.label + ' Access'] = enabled ? 'Yes' : 'No';
      system.stages.forEach(function(id) {
        var p = u.permissions && (u.permissions[id] || (id === 'assign' ? u.permissions.introduce : null)) || {};
        var view = enabled && (roleStr === 'ADMIN' || p.view);
        var update = view && (roleStr === 'ADMIN' || p.update);
        access[labels[id] + ' View'] = view ? 'Yes' : 'No';
        access[labels[id] + ' Update'] = update ? 'Yes' : 'No';
        if (view) allowedLabels.push(labels[id]);
      });
    });
    accessRows.push(access);
    if (roleStr !== 'ADMIN') permText = 'Stages: ' + (allowedLabels.join(', ') || 'None');

    return [
      u.fullName || u.username,
      String(u.username || '').replace(/^@+/, '').replace(/\s+/g, '').toLowerCase(),
      roleStr,
      u.password || 'password123',
      statusStr,
      u.department || 'General',
      u.createdAt || Utilities.formatDate(new Date(), 'Asia/Kolkata', "dd MMM yyyy, h:mm a"),
      permText
    ];
  });

  // Core fields: [name, user, role, password, status, department, created, permitted]
  var coreKeys = ['fullName', 'user', 'role', 'password', 'status', 'department', 'created', 'permitted'];
  var lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    coreKeys.forEach(function(key) { if (core[key]) sheet.getRange(2, core[key], lastRow - 1, 1).clearContent(); });
    Object.keys(accessColumns).forEach(function(name) { sheet.getRange(2, accessColumns[name], lastRow - 1, 1).clearContent(); });
  }

  if (rowData.length > 0) {
    if (rowData.length + 1 > sheet.getMaxRows()) sheet.insertRowsAfter(sheet.getMaxRows(), rowData.length + 1 - sheet.getMaxRows());
    coreKeys.forEach(function(key, index) {
      if (!core[key]) return;
      sheet.getRange(2, core[key], rowData.length, 1).setValues(rowData.map(function(r) { return [r[index]]; }));
    });
    Object.keys(accessColumns).forEach(function(name) { sheet.getRange(2, accessColumns[name], accessRows.length, 1).setValues(accessRows.map(function(access) { return [access[name]]; })); });
  }

  bumpSyncVersion();
  return { success: true, count: rowData.length, version: getSyncVersion() };
}

function handleCreateUser(userData) {
  var users = fetchAllUsers();
  var cleanUsername = String(userData.username || '').trim().toLowerCase();
  if (!cleanUsername) throw new Error('Username is required.');

  users.push({
    id: userData.id || ('usr-sheet-' + cleanUsername),
    username: cleanUsername,
    fullName: userData.fullName ? userData.fullName.trim() : cleanUsername,
    role: normalizeRole(userData.role),
    status: (userData.status || 'Active').toUpperCase() === 'INACTIVE' ? 'Inactive' : 'Active',
    department: userData.department ? userData.department.trim() : 'General',
    permissions: userData.permissions || {},
    systemAccess: userData.systemAccess,
    createdAt: new Date().toISOString(),
    password: userData.password ? userData.password.trim() : 'password123'
  });

  handleSaveUsers(users);
  return userData;
}

function handleUpdateUser(userId, userData) {
  var users = fetchAllUsers();
  var found = false;
  var target = String(userData.username || userId || '').trim().toLowerCase();

  for (var i = 0; i < users.length; i++) {
    if (users[i].id === userId || users[i].username.toLowerCase() === target) {
      users[i] = {
        id: users[i].id,
        username: userData.username ? String(userData.username).trim().toLowerCase() : users[i].username,
        fullName: userData.fullName !== undefined ? userData.fullName.trim() : users[i].fullName,
        role: userData.role !== undefined ? normalizeRole(userData.role) : users[i].role,
        status: userData.status !== undefined ? ((String(userData.status).toUpperCase() === 'INACTIVE') ? 'Inactive' : 'Active') : users[i].status,
        department: userData.department !== undefined ? String(userData.department).trim() : users[i].department,
        permissions: userData.permissions !== undefined ? userData.permissions : users[i].permissions,
        systemAccess: userData.systemAccess !== undefined ? userData.systemAccess : users[i].systemAccess,
        createdAt: users[i].createdAt,
        password: userData.password ? String(userData.password).trim() : users[i].password
      };
      found = true;
      break;
    }
  }

  if (!found) return handleCreateUser(userData);
  handleSaveUsers(users);
  return userData;
}

function handleDeleteUser(userIdOrUsername) {
  var users = fetchAllUsers();
  var target = String(userIdOrUsername || '').trim().toLowerCase();
  var filtered = users.filter(function(u) {
    return u.id !== userIdOrUsername && u.username.toLowerCase() !== target;
  });
  handleSaveUsers(filtered);
  return { success: true, remaining: filtered.length, version: getSyncVersion() };
}

// Master Dropdown Options (Companies & Developers)
function fetchMasterOptions() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var masterSheet = ss.getSheetByName(SHEET_MASTER);
  if (!masterSheet) {
    ss.getSheets().some(function(sheet) {
      if (sheet.getName().trim().toLowerCase() === SHEET_MASTER.toLowerCase()) { masterSheet = sheet; return true; }
      return false;
    });
  }
  var companies = [];
  var developers = [];

  // Master sheet: column A = Firm Name (company), column B = DME (developer), data from row 2.
  if (masterSheet && masterSheet.getLastRow() >= 2) {
    var vals = masterSheet.getRange(2, 1, masterSheet.getLastRow() - 1, 2).getDisplayValues();
    for (var i = 0; i < vals.length; i++) {
      var f = String(vals[i][0] || '').trim();
      var d = String(vals[i][1] || '').trim();
      if (f && companies.indexOf(f) === -1) companies.push(f);
      if (d && developers.indexOf(d) === -1) developers.push(d);
    }
  }

  return { companies: companies, developers: developers };
}

// Setup Initial Sheets
function setupInitialSheets() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var fms = ss.getSheetByName(SHEET_FMS) || ss.insertSheet(SHEET_FMS);
  if (!fms.getRange(6, 1).getValue()) {
    fms.getRange(6, 1, 1, FMS_HEADERS.length).setValues([FMS_HEADERS]);
    fms.getRange(6, 1, 1, FMS_HEADERS.length).setFontWeight('bold').setBackground('#0284c7').setFontColor('#ffffff');
    fms.setFrozenRows(6);
  }
  getLoginSheet(ss);
  bumpSyncVersion();
  return { success: true, message: 'FMS and Login Page sheets ready.' };
}

// Ultra-Fast Sync Version Management (<10ms)
// Repair template: row 6 headings (found by name, so inserted columns such as Assign Developer are fine), row 7+ data.
// Planned and Time Delay columns are formula-owned and are never written.
var REPAIR_META_PREFIX = 'REPAIRMETA_';

function repairColumns(sheet) {
  var headers = sheet.getRange(6, 1, 1, Math.max(sheet.getLastColumn(), 15)).getValues()[0];
  var seen = {}, cols = { protectedCols: {} };
  headers.forEach(function(h, i) {
    var key = normalizeHeaderKey(h);
    if (!key) return;
    (seen[key] = seen[key] || []).push(i + 1);
    if (/planned|delay/.test(key)) cols.protectedCols[i + 1] = true;
  });
  function first(names, n) {
    for (var a = 0; a < names.length; a++) { var list = seen[normalizeHeaderKey(names[a])]; if (list && list[n || 0]) return list[n || 0]; }
    return 0;
  }
  var map = {
    timestamp: first(['Timestamp', 'Timestamps']), serial: first(['Sr No.', 'Sr No', 'Serial']),
    requester: first(['Name Of The Person']), company: first(['Company']),
    description: first(['Things Not Working']), location: first(['Location Of Problem']),
    approvalPlanned: first(['Planned'], 0), approvalActual: first(['Actual'], 0), approvalDelay: first(['Time Delay', 'Delay'], 0),
    problem: first(['Problem']), whereToSolve: first(['Where Have To Solve']),
    developer: first(['Assign Developer', 'Assigned Developer', 'Developer', 'DME']),
    repairPlanned: first(['Planned'], 1), repairActual: first(['Actual'], 1), status: first(['Status']), repairDelay: first(['Time Delay', 'Delay'], 1),
    remark: first(['Problem Resolve Remark', 'Resolve Remark', 'Resolved Remark', 'Resolution Remark']),
    attachments: first(['Photos / PDF', 'Screenshots / PDF Attachments', 'Attachments', 'Attachment', 'Image', 'Images', 'Photo'])
  };
  ['timestamp', 'serial', 'requester', 'company', 'description', 'location', 'approvalPlanned', 'approvalActual', 'problem', 'whereToSolve', 'repairPlanned', 'repairActual', 'status'].forEach(function(k) {
    if (!map[k]) throw new Error('Repair sheet row 6 is missing the heading for: ' + k);
  });
  Object.keys(map).forEach(function(k) { cols[k] = map[k]; });
  cols.width = Math.max.apply(null, Object.keys(map).map(function(k) { return map[k]; }));
  return cols;
}

function repairSheet() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Repair');
  if (!sheet) throw new Error('Repair sheet not found.');
  return sheet;
}

function readRepairMeta(serial, legacyNote) {
  var raw = PropertiesService.getScriptProperties().getProperty(REPAIR_META_PREFIX + serial);
  var meta = parseJsonSafely(raw, null);
  if (meta && typeof meta === 'object') return meta;
  var legacy = parseJsonSafely(legacyNote, null); // older rows still carry JSON in the Sr No. cell note
  return legacy && typeof legacy === 'object' ? legacy : {};
}

function writeRepairMeta(serial, meta) {
  PropertiesService.getScriptProperties().setProperty(REPAIR_META_PREFIX + serial, JSON.stringify(meta));
}

function repairAttachments(cellValue, meta) {
  var saved = Array.isArray(meta.attachments) ? meta.attachments : [];
  var urls = String(cellValue || '').split(/\r?\n/).map(function(url) { return url.trim(); }).filter(function(url) { return /^https?:\/\//i.test(url); });
  if (!urls.length) return saved;
  // The sheet cell only holds links; names and file types saved at upload time are merged back in.
  return urls.map(function(url, i) {
    var known = saved.filter(function(file) { return file.url === url; })[0] || {};
    return { id:'att-' + i, name:known.name || 'Attachment ' + (i + 1), type:known.type || '', url:url, driveUrl:url };
  });
}

function repairRows(sheet, targetRow, suppliedCols, suppliedValues) {
  var lastRow = sheet.getLastRow();
  if (lastRow < 7 || (targetRow && targetRow > lastRow)) return [];
  var cols = suppliedCols || repairColumns(sheet);
  var firstRow = targetRow || 7;
  var count = targetRow ? 1 : lastRow - 6;
  var values = suppliedValues || sheet.getRange(firstRow, 1, count, cols.width).getValues();
  var notes = sheet.getRange(firstRow, cols.serial, count, 1).getNotes();
  // Script Properties is a remote Apps Script service. Reading every row with
  // getProperty() made large Repair sheets progressively slower. One bulk read
  // keeps the same data contract with a single service call.
  var allMeta = targetRow ? null : PropertiesService.getScriptProperties().getProperties();
  return values.map(function(r, i) {
    function get(k) { return cols[k] ? r[cols[k] - 1] : ''; }
    if (!get('serial')) return null;
    var serial = String(get('serial'));
    var meta = targetRow ? readRepairMeta(serial, notes[i][0]) : parseJsonSafely(allMeta[REPAIR_META_PREFIX + serial], null);
    if (!meta || typeof meta !== 'object') meta = parseJsonSafely(notes[i][0], {}) || {};
    function date(v) { return v instanceof Date ? v.toISOString() : String(v || ''); }
    return { id:serial, serial:serial, requester:get('requester'), company:get('company'), description:get('description'), location:get('location'), createdAt:date(get('timestamp')), version:meta.version || 1, idempotencyKey:meta.idempotencyKey || '', approval:{ planned:date(get('approvalPlanned')), actual:date(get('approvalActual')), delay:get('approvalDelay') }, raisedBy:meta.raisedBy || '', attachments:repairAttachments(get('attachments'), meta), assessment:{ repairRequired:get('problem'), whereToSolve:get('whereToSolve'), assignedDeveloper:String(get('developer') || meta.assignedDeveloper || '') }, repair:{ planned:date(get('repairPlanned')), actual:date(get('repairActual')), status:get('status'), delay:get('repairDelay'), remarks:String(get('remark') || meta.remarks || '') }, management:{}, activity:[], sheetRow:firstRow + i };
  }).filter(function(r) { return r !== null; });
}

function fetchRepairIssues() {
  var sheet = repairSheet(), cols = repairColumns(sheet);
  return repairRows(sheet, 0, cols);
}

/** Menu action: moves JSON notes from the Sr No. cells into Script Properties and removes the notes. */
function clearRepairNotes() {
  var sheet = repairSheet(), cols = repairColumns(sheet);
  if (sheet.getLastRow() < 7) return { cleared: 0 };
  var count = sheet.getLastRow() - 6;
  var serials = sheet.getRange(7, cols.serial, count, 1).getValues();
  var notes = sheet.getRange(7, cols.serial, count, 1).getNotes();
  var cleared = 0;
  notes.forEach(function(n, i) {
    var serial = String(serials[i][0] || '').trim();
    if (!n[0]) return;
    var meta = parseJsonSafely(n[0], null);
    if (serial && meta && typeof meta === 'object') writeRepairMeta(serial, meta);
    sheet.getRange(7 + i, cols.serial).setNote('');
    cleared++;
  });
  try { SpreadsheetApp.getActiveSpreadsheet().toast('Repair notes cleared (' + cleared + ').', 'Make System', 4); } catch (e) {}
  return { cleared: cleared };
}

function saveRepairIssue(action, payload) {
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var sheet = repairSheet(), cols = repairColumns(sheet), data = payload.data || {}, row, issue;
    var meta = {};
    var writes = []; // [columnKey, value]
    var serialValue = '';
    if (action === 'createRepairIssue') {
      var issues = repairRows(sheet, 0, cols);
      ['requester', 'company', 'description'].forEach(function(k) { if (!String(data[k] || '').trim()) throw new Error(k + ' is required.'); });
      if (!payload.idempotencyKey) throw new Error('Submission key required.');
      for (var i = 0; i < issues.length; i++) if (issues[i].idempotencyKey === payload.idempotencyKey) return issues[i];
      var highest = 0;
      row = 7;
      issues.forEach(function(item) { row = Math.max(row, item.sheetRow + 1); var match = item.serial.match(/^RS\s*-\s*(\d+)$/); if (match) highest = Math.max(highest, Number(match[1])); });
      if (row > sheet.getMaxRows()) sheet.insertRowsAfter(sheet.getMaxRows(), row - sheet.getMaxRows());
      serialValue = 'RS - ' + ('000' + (highest + 1)).slice(-Math.max(3, String(highest + 1).length));
      meta = { version:1, idempotencyKey:payload.idempotencyKey, raisedBy:String(payload.actorName || '') };
      // Photos / PDFs were already uploaded to the Drive folder; keep only their links (max 5).
      var files = (Array.isArray(data.attachments) ? data.attachments : []).slice(0, 5).map(function(att) { return { name:String(att.name || ''), type:String(att.type || ''), url:String(att.driveUrl || att.url || '').trim() }; });
      files.forEach(function(file) { if (!/^https?:\/\//i.test(file.url)) throw new Error('Attachment has not uploaded to Drive: ' + (file.name || 'file')); });
      writes = [['timestamp',new Date()], ['requester',String(data.requester).trim()], ['company',String(data.company).trim()], ['description',String(data.description).trim()], ['location',String(data.location || '').trim()], ['status','Pending Approval'], ['serial',serialValue]];
      if (files.length) { meta.attachments = files; if (cols.attachments) writes.push(['attachments', files.map(function(f) { return f.url; }).join('\n')]); }
    } else {
      var located = findRecordRow(sheet, cols.serial, String(payload.id), 7, cols.width, payload.sheetRow);
      issue = located ? repairRows(sheet, located.row, cols, [located.values])[0] : null;
      if (!issue) throw new Error('Repair issue not found.');
      if (issue.version !== payload.expectedVersion) throw new Error('This issue changed. Refresh and retry.');
      row = issue.sheetRow;
      serialValue = issue.serial;
      meta = readRepairMeta(issue.serial, sheet.getRange(row, cols.serial).getNote());
      meta.version = issue.version + 1;
      if (action === 'approveRepairIssue') {
        if (issue.approval.actual) throw new Error('Issue already assessed.');
        if (['Yes','No'].indexOf(data.repairRequired) < 0 || !String(data.whereToSolve || '').trim()) throw new Error('Problem Yes/No and Where Have To Solve are required.');
        var developer = String(data.assignedDeveloper || '').trim();
        if (developer && fetchMasterOptions().developers.indexOf(developer) === -1) throw new Error('Choose a developer from the Master sheet.');
        writes = [['problem',data.repairRequired], ['whereToSolve',String(data.whereToSolve).trim()], ['status',data.repairRequired === 'Yes' ? 'Pending Repair' : 'No Repair Required'], ['approvalActual',new Date()]];
        if (developer) { if (cols.developer) writes.push(['developer', developer]); else meta.assignedDeveloper = developer; }
      } else {
        if (!issue.approval.actual || issue.assessment.repairRequired !== 'Yes' || issue.repair.actual) throw new Error('Issue is not pending repair.');
        if (!String(data.remarks || '').trim()) throw new Error('Problem Resolve Remark required.');
        var remark = String(data.remarks).trim();
        if (cols.remark) writes.push(['remark', remark]); else meta.remarks = remark;
        writes.push(['status','Resolved'], ['repairActual',new Date()]);
      }
    }
    // Preflight ALL targets before writing; never overwrite Planned/Time Delay columns or any existing formula.
    var formulaRange = sheet.getRange(row, 1, 1, cols.width);
    var rowFormulas = typeof formulaRange.getFormulas === 'function' ? formulaRange.getFormulas()[0] : null;
    writes.forEach(function(w) {
      var column = cols[w[0]];
      var existingFormula = column && (rowFormulas ? rowFormulas[column - 1] : sheet.getRange(row, column).getFormula());
      if (!column || cols.protectedCols[column] || existingFormula) throw new Error('Repair formula protected at column ' + column);
    });
    writes.forEach(function(w) { var value = w[1]; if (typeof value === 'string' && /^[=+@-]/.test(value)) value = "'" + value; sheet.getRange(row, cols[w[0]]).setValue(value); });
    writeRepairMeta(serialValue, meta);
    try { sheet.getRange(row, cols.serial).setNote(''); } catch (e) {}
    ['timestamp','approvalActual','repairActual'].forEach(function(key) { if (writes.some(function(w) { return w[0] === key; })) sheet.getRange(row, cols[key]).setNumberFormat('MM/dd/yyyy HH:mm:ss'); });
    SpreadsheetApp.flush();
    return repairRows(sheet, row, cols)[0];
  } finally { lock.releaseLock(); }
}

function getSyncVersion() {
  return PropertiesService.getScriptProperties().getProperty(PROP_SYNC_VERSION) || '1';
}

function bumpSyncVersion() {
  var v = String(new Date().getTime());
  PropertiesService.getScriptProperties().setProperty(PROP_SYNC_VERSION, v);
  return v;
}

function onEdit(e) {
  try { bumpSyncVersion(); } catch (err) {}
}

function onOpen() {
  try {
    SpreadsheetApp.getUi()
      .createMenu('⚡ Make System')
      .addItem('🔄 Format & Align Login Page', 'formatLoginPageSheet')
      .addItem('📋 Re-sync All Users', 'formatLoginPageSheet')
      .addItem('🧹 Clear legacy metadata column', 'clearLegacyMetadataColumn')
      .addItem('🧹 Clear Repair cell notes', 'clearRepairNotes')
      .addItem('🧹 Remove history of deleted rows', 'cleanOrphanHistory')
      .addToUi();
  } catch (err) {}
}

function formatLoginPageSheet() {
  var users = fetchAllUsers();
  var result = handleSaveUsers(users);
  SpreadsheetApp.getActiveSpreadsheet().toast('Login Page access columns updated. Users and passwords preserved.', 'Make System', 4);
  return result;
}

// Utilities
function jsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}

function parseJsonSafely(str, fallback) {
  if (!str) return fallback;
  try { return JSON.parse(str); } catch (e) { return fallback; }
}

function formatDateCell(val) {
  if (!val) return '';
  if (val instanceof Date) return isNaN(val.getTime()) ? '' : Utilities.formatDate(val, 'Asia/Kolkata', 'yyyy-MM-dd');
  if (typeof val !== 'string') return '';
  var s = String(val).trim();
  if (!/^\d{4}-\d{2}-\d{2}(?:$|[T ])/.test(s) && !/^\d{1,2}\/\d{1,2}\/\d{4}(?:$|[ T])/.test(s)) return '';
  if (isNaN(new Date(s).getTime())) return '';
  if (s.indexOf('T') !== -1) return s.split('T')[0];
  return s;
}

function formatTimestampCell(val) {
  if (!val) return '';
  if (val instanceof Date) return isNaN(val.getTime()) ? '' : val.toISOString();
  if (typeof val !== 'string') return '';
  var s = val.trim();
  if (/^[\[{]/.test(s) || isNaN(new Date(s).getTime())) return '';
  return s;
}

// Request history/progress is kept in Script Properties so no helper column is needed in the FMS sheet.
var REQUEST_META_PREFIX = 'REQMETA_';

function fmsLastMappedColumn(mapping) {
  var max = 1;
  Object.keys(mapping).forEach(function(key) {
    if (/^col/.test(key) && typeof mapping[key] === 'number' && mapping[key] > max) max = mapping[key];
  });
  return max;
}

function readAllRequestMeta() {
  var props = PropertiesService.getScriptProperties().getProperties() || {};
  var out = {};
  Object.keys(props).forEach(function(key) {
    if (key.indexOf(REQUEST_META_PREFIX) !== 0) return;
    var meta = parseJsonSafely(props[key], null);
    if (meta && typeof meta === 'object') out[key.slice(REQUEST_META_PREFIX.length)] = meta;
  });
  return out;
}

function compactRequestMeta(obj) {
  var clone = JSON.parse(JSON.stringify(obj || {}));
  delete clone.developmentHistory;
  delete clone.sheetRowIndex;
  (clone.attachments || []).forEach(function(att) { delete att.base64Data; delete att.previewUrl; });
  if (clone.activityLog && clone.activityLog.length > 8) clone.activityLog = clone.activityLog.slice(-8);
  var str = JSON.stringify(clone);
  if (str.length > 8500) { clone.activityLog = (clone.activityLog || []).slice(-3); clone.testingHistory = (clone.testingHistory || []).slice(-2); str = JSON.stringify(clone); }
  return str.length > 8500 ? '{}' : str;
}

function writeRequestMeta(requestNo, obj) {
  if (!requestNo) return;
  var properties = PropertiesService.getScriptProperties();
  properties.setProperty(REQUEST_META_PREFIX + requestNo, compactRequestMeta(obj));
  if (obj && obj.id && properties.getProperty('REQID_' + obj.id) !== requestNo) properties.setProperty('REQID_' + obj.id, requestNo);
}

/**
 * One-time cleanup: moves any old _Make_System_Metadata column into Script Properties, then clears it.
 * Run from the "Make System" menu. Planned/Delay columns are never touched.
 */
function clearLegacyMetadataColumn() {
  var sheet = getRequestsSheet();
  if (!sheet) return { cleared: 0 };
  var mapping = findHeaderMapping(sheet);
  var lastCol = sheet.getLastColumn(), last = sheet.getLastRow();
  var headers = sheet.getRange(mapping.headerRow, 1, 1, lastCol).getValues()[0];
  var cleared = 0;
  headers.forEach(function(h, i) {
    var key = normalizeHeaderKey(h), col = i + 1;
    if (['makesystemmetadata', 'metadata', 'internalid', 'meta'].indexOf(key) === -1 || mapping.protectedCols[col] || last < mapping.dataStartRow) return;
    var count = last - mapping.dataStartRow + 1;
    var metas = sheet.getRange(mapping.dataStartRow, col, count, 1).getValues();
    var nos = sheet.getRange(mapping.dataStartRow, mapping.colRequestNo, count, 1).getValues();
    metas.forEach(function(m, r) {
      var meta = parseJsonSafely(m[0], null), no = String(nos[r][0] || '').trim();
      if (meta && typeof meta === 'object' && no) writeRequestMeta(no, meta);
    });
    sheet.getRange(mapping.dataStartRow, col, count, 1).clearContent();
    sheet.getRange(mapping.headerRow, col).clearContent();
    cleared++;
  });
  try { SpreadsheetApp.getActiveSpreadsheet().toast('Legacy metadata column cleared (' + cleared + ').', 'Make System', 4); } catch (e) {}
  return { cleared: cleared };
}

/**
 * Menu action: after demo / test rows are deleted from the sheets, removes the history that was kept for them
 * (Script Properties), so nothing from a deleted record can come back on a new one. Sheet data is never touched.
 */
function cleanOrphanHistory() {
  var props = PropertiesService.getScriptProperties();
  var keep = {};
  var fms = getRequestsSheet();
  if (fms) {
    var mapping = findHeaderMapping(fms), last = fms.getLastRow();
    if (last >= mapping.dataStartRow) fms.getRange(mapping.dataStartRow, mapping.colRequestNo, last - mapping.dataStartRow + 1, 1).getValues().forEach(function(r) { if (r[0]) keep[REQUEST_META_PREFIX + String(r[0]).trim()] = true; });
  }
  try { repairRows(repairSheet()).forEach(function(i) { keep[REPAIR_META_PREFIX + i.serial] = true; }); } catch (e) {}
  try { fetchTechnicalTickets().forEach(function(t) { keep[TECH_META_PREFIX + String(t.ticketNo)] = true; }); } catch (e) {}
  var removed = 0;
  var all = typeof props.getProperties === 'function' ? props.getProperties() : {};
  Object.keys(all).forEach(function(key) {
    if (key.indexOf('REQID_') === 0) { if (!keep[REQUEST_META_PREFIX + all[key]]) { props.deleteProperty(key); removed++; } return; }
    var isHistory = key.indexOf(REQUEST_META_PREFIX) === 0 || key.indexOf(REPAIR_META_PREFIX) === 0 || key.indexOf(TECH_META_PREFIX) === 0;
    if (isHistory && !keep[key]) { props.deleteProperty(key); removed++; }
  });
  try { bumpSyncVersion(); SpreadsheetApp.getActiveSpreadsheet().toast('Removed history of deleted rows: ' + removed, 'Make System', 4); } catch (e) {}
  return { removed: removed };
}

function buildDevelopmentHistoryFromRow(req) {
  if (req.activityLog && req.activityLog.length > 0) {
    return req.activityLog
      .filter(function(a) { return a.action && a.action.toLowerCase().indexOf('progress') !== -1; })
      .map(function(a) {
        return {
          cycleNumber: 1,
          status: req.workStatus || 'In Progress',
          progressPercent: req.progressPercent || 0,
          remarks: a.details || req.latestRemarks,
          updatedAt: a.timestamp,
          updatedBy: a.actor
        };
      });
  }
  return [];
}

function hintCache(key, value) {
  if (typeof CacheService === 'undefined' || key.length > 240) return null;
  var cache = CacheService.getScriptCache();
  if (value !== undefined) { cache.put(key, String(value), 300); return value; }
  return cache.get(key);
}

function sheetHintKey(sheet, column, value) {
  var book = typeof sheet.getParent === 'function' ? sheet.getParent().getId() : 'local';
  var tab = typeof sheet.getSheetId === 'function' ? sheet.getSheetId() : 'sheet';
  return 'record-row:' + book + ':' + tab + ':' + column + ':' + value;
}

function findRecordRow(sheet, column, value, firstRow, width, rowHint, normalize) {
  normalize = normalize || function(v) { return String(v || '').trim(); };
  var wanted = normalize(value), last = sheet.getLastRow();
  var cacheKey = sheetHintKey(sheet, column, wanted);
  var hint = Number(rowHint || hintCache(cacheKey));
  function read(row) {
    var data = sheet.getRange(row, 1, 1, width).getValues()[0];
    return normalize(data[column - 1]) === wanted ? { row: row, values: data } : null;
  }
  if (Number.isInteger(hint) && hint >= firstRow && hint <= last) {
    var verified = read(hint);
    if (verified) return verified;
  }
  if (last < firstRow) return null;
  var idRange = sheet.getRange(firstRow, column, last - firstRow + 1, 1);
  var matches = [];
  if (typeof idRange.createTextFinder === 'function') {
    matches = idRange.createTextFinder(String(value)).matchCase(false).matchEntireCell(true).findAll().map(function(cell) { return cell.getRow(); });
  }
  // Compatibility for older username formatting and lightweight test adapters:
  // inspect the identifier column only, never all columns of the data table.
  if (!matches.length) {
    idRange.getValues().forEach(function(entry, i) { if (normalize(entry[0]) === wanted) matches.push(firstRow + i); });
  }
  if (matches.length > 1) throw new Error('Duplicate record identifier: ' + value);
  if (!matches.length) return null;
  var result = read(matches[0]);
  if (result) hintCache(cacheKey, matches[0]);
  return result;
}

function hasSheetIntroduction(mapping) {
  return Boolean(mapping.colActual2 && mapping.colIntroductionStatus && mapping.colIntroductionStatus !== mapping.colWorkStatus);
}

function applySheetIntroductionWorkflow(request, row, mapping) {
  if (!hasSheetIntroduction(mapping)) return request;
  var prior = request.systemIntroduction || {};
  var priorMis = request.misUpdate || {};
  var priorAssignment = request.introduction || {};
  var priorStage = String(request.currentStage || '');
  var priorWorkStatus = String(request.workStatus || '');
  var actual = formatTimestampCell(row[mapping.colActual2 - 1]);
  var status = String(row[mapping.colIntroductionStatus - 1] || '').trim();
  var introduced = Boolean(actual || /^(completed|done|introduced|approved|yes)$/i.test(status));
  var work = mapping.colWorkStatus ? String(row[mapping.colWorkStatus - 1] || '').trim() : '';
  var assigned = Boolean(mapping.colActual && row[mapping.colActual - 1]);
  var developed = Boolean(mapping.colActual1 && row[mapping.colActual1 - 1]);
  var closed = Boolean(
    (mapping.colActual4 && row[mapping.colActual4 - 1]) ||
    (mapping.colFinalStatus && /^closed$/i.test(String(row[mapping.colFinalStatus - 1] || '').trim()))
  );
  request.workflowVersion = 2;
  // The current FMS workflow columns are authoritative. Metadata is audit
  // history only; it must never resurrect a stage after its sheet cell is
  // cleared or moved back by management.
  request.sheetWorkflowAuthoritative = true;
  request.sheetWorkflowRolledBack = false;
  request.introduction = {
    isCompleted: assigned,
    remarks: priorAssignment.remarks || '',
    completedAt: assigned ? (formatTimestampCell(row[mapping.colActual - 1]) || priorAssignment.completedAt || '') : null,
    completedBy: priorAssignment.completedBy || (assigned ? 'Administrator' : '')
  };
  request.actualIntroductionDate = actual;
  request.systemIntroduction = { isCompleted: introduced, remarks: prior.remarks || '', completedAt: introduced ? (actual || prior.completedAt || '') : null, completedBy: prior.completedBy || (introduced ? 'Administrator' : '') };
  request.misUpdate = Object.assign({}, priorMis, { isCompleted: closed });

  // Enforce the exact sequence. The first missing Actual milestone decides
  // the pending stage, so stale downstream metadata/cells cannot skip it.
  if (!assigned) {
    request.currentStage = 'Assign System';
    request.currentStatus = 'Assign System: Pending';
    request.workStatus = 'Pending Assignment';
    request.progressPercent = 0;
    if (priorStage && priorStage !== 'Assign System') {
      request.sheetWorkflowRolledBack = true;
      request.latestRemarks = 'Moved back to Assign System.';
    }
  } else if (!developed) {
    request.currentStage = 'Create System';
    request.currentStatus = 'Development: ' + (/^(completed|closed)$/i.test(work) ? 'In Progress' : (work || 'In Progress'));
    request.workStatus = /^(completed|closed)$/i.test(work) ? 'In Progress' : (work || 'In Progress');
    request.progressPercent = Math.min(Number(request.progressPercent) || 0, 99);
    if (priorStage !== 'Create System' || /^(completed|closed)$/i.test(priorWorkStatus) || prior.isCompleted || priorMis.isCompleted) {
      request.sheetWorkflowRolledBack = true;
      request.latestRemarks = 'Moved back to Create System.';
    }
  } else if (!introduced) {
    request.currentStage = 'Introduce System';
    request.currentStatus = 'Introduce System: Pending';
    request.workStatus = 'Completed';
    request.progressPercent = 100;
    if (['Update MIS System', 'Closed'].indexOf(priorStage) !== -1 || prior.isCompleted || priorMis.isCompleted) {
      request.sheetWorkflowRolledBack = true;
      request.latestRemarks = 'Moved back to Introduce System.';
    }
  } else if (!closed) {
    request.currentStage = 'Update MIS System';
    request.currentStatus = 'Update MIS: Pending';
    request.workStatus = 'Completed';
    request.progressPercent = 100;
    if (priorStage === 'Closed' || priorMis.isCompleted) {
      request.sheetWorkflowRolledBack = true;
      request.latestRemarks = 'Moved back to Update in MIS System.';
    }
  } else {
    request.currentStage = 'Closed';
    request.currentStatus = 'Closed';
    request.workStatus = 'Closed';
    request.progressPercent = 100;
  }
  return request;
}

function handleCompleteIntroduction(requestId, data, reference) {
  if (!String(data.remarks || '').trim()) throw new Error('Introduction remarks are required.');
  return updateRequestRow(requestId, function(request) {
    if (request.currentStage !== 'Introduce System' || request.workflowVersion !== 2) throw new Error('Only systems pending introduction can be introduced.');
    var now = new Date().toISOString();
    request.systemIntroduction = { isCompleted: true, remarks: String(data.remarks).trim(), completedAt: now, completedBy: data.updatedBy || 'Administrator' };
    request.currentStage = 'Update MIS System'; request.currentStatus = 'Update MIS: Pending';
    request.latestRemarks = request.systemIntroduction.remarks; request.lastUpdatedAt = now;
    request.activityLog.push({ id: 'act-' + Date.now(), action: 'System Introduced', actor: request.systemIntroduction.completedBy, timestamp: now, details: request.latestRemarks + '. Sent to Update in MIS System.' });
    return request;
  }, reference);
}

function syncPendingIntroductionStatus() {
  var sheet = getRequestsSheet(), mapping = findHeaderMapping(sheet), repaired = 0;
  if (!hasSheetIntroduction(mapping)) throw new Error('Actual 2 and introduction Status headings are required.');
  var properties = PropertiesService.getScriptProperties();
  fetchAllRequests().forEach(function(request) {
    if (request.currentStage !== 'Introduce System') return;
    var status = sheet.getRange(request.sheetRowIndex, mapping.colIntroductionStatus).getValues()[0][0];
    if (String(status || '').trim()) return;
    safeSetCellValue(sheet, request.sheetRowIndex, mapping.colIntroductionStatus, 'Pending', mapping);
    var meta = parseJsonSafely(properties.getProperty(REQUEST_META_PREFIX + request.requestNo), {}) || {};
    meta.workflowVersion = 2; meta.currentStage = 'Introduce System'; meta.currentStatus = 'Introduce System: Pending'; meta.systemIntroduction = request.systemIntroduction;
    writeRequestMeta(request.requestNo, meta); repaired++;
  });
  if (repaired) bumpSyncVersion();
  return { success: true, repaired: repaired };
}

function loadRequestRecord(requestId, reference) {
  reference = reference || {};
  var sheet = getRequestsSheet();
  if (!sheet) throw new Error('Requests sheet (FMS) not found');
  var mapping = findHeaderMapping(sheet), width = fmsLastMappedColumn(mapping);
  if (!mapping.colRequestNo) throw new Error('FMS needs a Request No. heading before records can be updated.');
  var properties = PropertiesService.getScriptProperties();
  var number = String(reference.requestNo || (/^(?:req-)?SM-/i.test(requestId) ? String(requestId).replace(/^req-/i, '') : '')).trim();
  if (!number) number = properties.getProperty('REQID_' + requestId) || '';
  // Legacy clients with an old internal ID have no row hint. Resolve only the
  // Request No. column and individual metadata records, without a table read.
  if (!number) {
    var count = sheet.getLastRow() - mapping.dataStartRow + 1;
    var numbers = count > 0 ? sheet.getRange(mapping.dataStartRow, mapping.colRequestNo, count, 1).getValues() : [];
    for (var i = 0; i < numbers.length; i++) {
      var candidate = String(numbers[i][0] || '').trim();
      if (candidate && (parseJsonSafely(properties.getProperty(REQUEST_META_PREFIX + candidate), {}) || {}).id === requestId) { number = candidate; break; }
    }
  }
  if (!number) throw new Error('Request not found. Refresh records before retrying.');
  var located = findRecordRow(sheet, mapping.colRequestNo, number, mapping.dataStartRow, width, reference.sheetRowIndex);
  if (!located) throw new Error('Request "' + requestId + '" not found in sheet.');
  var row = located.values, rowNumber = located.row;
  var meta = parseJsonSafely(properties.getProperty(REQUEST_META_PREFIX + number), {}) || {};
  if (String(requestId) !== number && String(requestId) !== 'req-' + number && String(meta.id) !== String(requestId)) throw new Error('Request identifier changed. Refresh records before retrying.');
  function get(column) { return column ? row[column - 1] : ''; }
  var record = Object.assign({}, meta, {
    id: meta.id || 'req-' + number, requestNo: number, sheetRowIndex: rowNumber,
    companyName: String(get(mapping.colCompany) || ''), systemName: String(get(mapping.colSystemName) || ''),
    businessPurpose: String(get(mapping.colSummary) || ''), assignedDeveloper: String(get(mapping.colDeveloper) || ''),
    targetCompletionDate: formatDateCell(get(mapping.colTargetDate)), systemUrl: String(get(mapping.colSystemLink) || ''),
    adminId: String(get(mapping.colAdminId) || ''), adminPassword: String(get(mapping.colAdminPassword) || ''),
    holdReason: String(get(mapping.colReasonForHold) || ''), holdExtendTargetDate: formatDateCell(get(mapping.colHoldExtendTargetDate)),
    requester: String(get(mapping.colRequester) || ''), createdBy: String(get(mapping.colRequester) || meta.createdBy || 'Administrator'),
    createdAt: meta.createdAt || formatTimestampCell(get(mapping.colTimestamps)),
    currentStage: meta.currentStage || (get(mapping.colActual1) ? 'Update MIS System' : get(mapping.colActual) ? 'Create System' : 'Assign System'),
    currentStatus: meta.currentStatus || 'Assign System: Pending', workStatus: String(get(mapping.colWorkStatus) || meta.workStatus || ''),
    progressPercent: meta.progressPercent || 0, introduction: meta.introduction || { isCompleted: Boolean(get(mapping.colActual)) },
    testingHistory: meta.testingHistory || [], activityLog: meta.activityLog || [], attachments: meta.attachments || []
  });
  if (reference.actorRole && !canSeeAllData({ role: reference.actorRole }) && !requestOwnerNames(record).some(function(name) { return ownsName({ fullName: reference.actorName }, name); })) throw new Error('This request is not assigned to your account.');
  applySheetIntroductionWorkflow(record, row, mapping);
  record.developmentHistory = buildDevelopmentHistoryFromRow(record);
  return { sheet: sheet, mapping: mapping, row: row, rowNumber: rowNumber, record: record };
}
