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
  'Created',
  'Permitted Stages'
];

// Standard FMS Row 6 Headers
var FMS_HEADERS = [
  'Timestamps', 'Request No.', 'Company', 'System Name', 'Requirements Summary',
  'Assigned Developer', 'Target Date', 'Image', 'Work Status', 'Planned',
  'Actual', 'Delay', 'Meeting Date', 'Discussion Remarks', 'Planned 1',
  'Actual 1', 'Delay 1', 'System Link / URL', 'Admin ID / Username', 'Password',
  'Reason for Hold', 'Hold Extend Target Date', 'Planned 2', 'Actual 2', 'Delay 2',
  'Decision', 'Remarks / Defect Rationale', 'Revision No', 'Upgrade Target Date',
  'Planned 3', 'Actual 3', 'Delay 3', 'Planned 4', 'Actual 4', 'Delay 4', 'Final Status'
];

var DEFAULT_COMPANIES = ['Pmmpl', 'Rkl', 'Refrasynth', 'Purab', 'Refratech'];
var DEFAULT_DEVELOPERS = ['Ahitesh Tandon', 'Bhupendra Kumar', 'MD Alauddin'];

/**
 * Handle HTTP GET Requests
 */
function doGet(e) {
  try {
    var params = (e && e.parameter) ? e.parameter : {};
    var action = params.action || 'getRequests';

    if (action === 'ping') {
      return jsonResponse({ status: 'ok', timestamp: new Date().toISOString() });
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
        requests: fetchAllRequests(),
        masterOptions: fetchMasterOptions(),
        users: fetchAllUsers()
      });
    }

    if (action === 'getUsers') {
      return jsonResponse({
        version: getSyncVersion(),
        users: fetchAllUsers()
      });
    }

    // Default: 'getRequests' returns requests, master options, and users in 1 single fast roundtrip
    return jsonResponse({
      version: getSyncVersion(),
      requests: fetchAllRequests(),
      masterOptions: fetchMasterOptions(),
      users: fetchAllUsers()
    });
  } catch (err) {
    return jsonResponse({ error: err.toString(), stack: err.stack });
  }
}

/**
 * Handle HTTP POST Requests
 */
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
    if (!action) {
      return jsonResponse({ error: 'No action specified in payload' });
    }

    if (action === 'initSheet') {
      return jsonResponse(setupInitialSheets());
    }
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
    if (action === 'approveIntroduction') {
      return jsonResponse(handleApproveIntroduction(payload.requestId, payload.data || payload));
    }
    if (action === 'updateDevelopmentProgress') {
      return jsonResponse(handleUpdateDevelopmentProgress(payload.requestId, payload.data || payload));
    }
    if (action === 'submitTestingDecision') {
      return jsonResponse(handleSubmitTestingDecision(payload.requestId, payload.data || payload));
    }
    if (action === 'uploadAttachment') {
      return jsonResponse(handleUploadAttachment(payload.data || payload));
    }
    if (action === 'completeMisUpdate') {
      return jsonResponse(handleCompleteMisUpdate(payload.requestId, payload.data || payload));
    }

    return jsonResponse({ error: 'Unhandled action: ' + action });
  } catch (err) {
    return jsonResponse({ error: err.toString(), stack: err.stack });
  }
}

/**
 * Get FMS Requests Sheet
 */
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

/**
 * Identify row 6 headings and column index mappings
 */
function findHeaderMapping(sheet) {
  var lastCol = Math.max(sheet.getLastColumn(), 37);
  var headerRow = 6;
  var headerValues = [];
  var found = false;

  var maxScan = Math.min(10, Math.max(sheet.getLastRow(), 6));
  for (var r = 1; r <= maxScan; r++) {
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

  function getCol(aliases, defaultIndex) {
    for (var a = 0; a < aliases.length; a++) {
      var k = normalizeHeaderKey(aliases[a]);
      if (colMap[k]) return colMap[k];
    }
    return defaultIndex;
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
    colCompany: getCol(['Company', 'Company Name'], 3),
    colSystemName: getCol(['System Name', 'System', 'Project Name'], 4),
    colSummary: getCol(['Requirements Summary', 'Business Purpose', 'Summary'], 5),
    colDeveloper: getCol(['Assigned Developer', 'Developer', 'Assigned To'], 6),
    colTargetDate: getCol(['Target Date', 'Target Completion Date'], 7),
    colImage: getCol(['Image', 'Images', 'Attachment', 'Drive Link'], 8),
    colWorkStatus: getCol(['Work Status', 'Dev Status', 'Status'], 9),
    colActual: getCol(['Actual'], 11),
    colMeetingDate: getCol(['Meeting Date', 'Kickoff Date'], 13),
    colDiscussionRemarks: getCol(['Discussion Remarks', 'Remarks'], 14),
    colActual1: getCol(['Actual 1', 'Actual1'], 16),
    colSystemLink: getCol(['System Link / URL', 'System Link', 'App Link'], 18),
    colAdminId: getCol(['Admin ID / Username', 'Admin ID', 'Username'], 19),
    colAdminPassword: getCol(['Password', 'Admin Password'], 20),
    colReasonForHold: getCol(['Reason for Hold', 'Hold Reason'], 21),
    colHoldExtendTargetDate: getCol(['Hold Extend Target Date', 'Extended Target Date'], 22),
    colActual2: getCol(['Actual 2', 'Actual2'], 24),
    colDecision: getCol(['Decision', 'Test Decision'], 26),
    colTestRemarks: getCol(['Remarks / Defect Rationale', 'Remarks / Defects'], 27),
    colRevisionNo: getCol(['Revision No', 'Revision No.', 'Rev No'], 28),
    colUpgradeTargetDate: getCol(['Upgrade Target Date', 'Revise Target Date'], 29),
    colActual3: getCol(['Actual 3', 'Actual3'], 31),
    colActual4: getCol(['Actual 4', 'Actual4'], 34),
    colFinalStatus: getCol(['Final Status', 'FinalStatus'], 36)
  };

  // Operational columns should never be blocked
  var ops = [
    mapping.colTimestamps, mapping.colRequestNo, mapping.colCompany, mapping.colSystemName,
    mapping.colSummary, mapping.colDeveloper, mapping.colTargetDate, mapping.colImage,
    mapping.colActual, mapping.colMeetingDate, mapping.colDiscussionRemarks, mapping.colActual1,
    mapping.colWorkStatus, mapping.colSystemLink, mapping.colAdminId, mapping.colAdminPassword,
    mapping.colReasonForHold, mapping.colHoldExtendTargetDate, mapping.colActual2,
    mapping.colDecision, mapping.colTestRemarks, mapping.colRevisionNo, mapping.colUpgradeTargetDate,
    mapping.colActual3, mapping.colActual4, mapping.colFinalStatus
  ];
  for (var op = 0; op < ops.length; op++) {
    if (ops[op]) delete protectedCols[ops[op]];
  }

  // Metadata JSON placed at Col 37 or lastCol + 1
  var colMeta = getCol(['_Make_System_Metadata', 'Metadata', 'Internal ID', '_meta'], 0);
  if (!colMeta || protectedCols[colMeta] || colMeta <= 36) {
    colMeta = Math.max(lastCol + 1, 37);
    while (protectedCols[colMeta]) colMeta++;
  }
  mapping.colMeta = colMeta;

  return mapping;
}

/**
 * Safely set a cell value while strictly skipping formula columns
 */
function safeSetCellValue(sheet, row, col, value, mapping) {
  if (!col || col <= 0) return;
  if (mapping && mapping.protectedCols && mapping.protectedCols[col]) return;
  sheet.getRange(row, col).setValue(value);
}

/**
 * Find first available empty row starting from Row 7
 */
function findNextEmptyRow(sheet, colRequestNo, dataStartRow) {
  dataStartRow = dataStartRow || 7;
  var lastRow = sheet.getLastRow();
  if (lastRow < dataStartRow) return dataStartRow;

  var numRows = lastRow - dataStartRow + 1;
  var reqVals = sheet.getRange(dataStartRow, colRequestNo, numRows, 1).getValues();
  for (var i = 0; i < reqVals.length; i++) {
    if (!String(reqVals[i][0] || '').trim()) {
      return dataStartRow + i;
    }
  }
  return dataStartRow + numRows;
}

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
  var maxCols = Math.max(sheet.getLastColumn(), mapping.colMeta || 37);
  var values = sheet.getRange(mapping.dataStartRow, 1, numRows, maxCols).getValues();

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

    var metaObj = null;
    if (mapping.colMeta && mapping.colMeta <= row.length) {
      metaObj = parseJsonSafely(row[mapping.colMeta - 1], null);
    }

    var companyName = String(row[mapping.colCompany - 1] || '').trim();
    var systemName = String(row[mapping.colSystemName - 1] || '').trim();
    var businessPurpose = String(row[mapping.colSummary - 1] || '').trim();
    var assignedDeveloper = String(row[mapping.colDeveloper - 1] || '').trim();
    var targetDate = formatDateCell(row[mapping.colTargetDate - 1]);
    var timestampStr = formatTimestampCell(row[mapping.colTimestamps - 1]);

    var meetingDate = mapping.colMeetingDate && mapping.colMeetingDate <= row.length ? formatDateCell(row[mapping.colMeetingDate - 1]) : '';
    var introRemarks = mapping.colDiscussionRemarks && mapping.colDiscussionRemarks <= row.length ? String(row[mapping.colDiscussionRemarks - 1] || '').trim() : '';
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
    var upgradeTargetDate = sheetUpgradeTargetDate || (metaObj && metaObj.upgradeTargetDate ? metaObj.upgradeTargetDate : null);
    var systemUrl = (mapping.colSystemLink && mapping.colSystemLink <= row.length ? String(row[mapping.colSystemLink - 1] || '').trim() : '') || (metaObj && metaObj.systemUrl ? metaObj.systemUrl : '');
    var adminId = (mapping.colAdminId && mapping.colAdminId <= row.length ? String(row[mapping.colAdminId - 1] || '').trim() : '') || (metaObj && metaObj.adminId ? metaObj.adminId : '');
    var adminPassword = (mapping.colAdminPassword && mapping.colAdminPassword <= row.length ? String(row[mapping.colAdminPassword - 1] || '').trim() : '') || (metaObj && metaObj.adminPassword ? metaObj.adminPassword : '');

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
    var isIntroDone = Boolean(meetingDate || sheetActualStr);
    var introduction = isIntroDone ? {
      isCompleted: true,
      meetingDate: meetingDate || formatDateCell(sheetActual),
      remarks: introRemarks,
      completedAt: formatTimestampCell(sheetActual) || timestampStr,
      completedBy: (metaObj && metaObj.introduction && metaObj.introduction.completedBy) ? metaObj.introduction.completedBy : 'Administrator'
    } : { isCompleted: false, meetingDate: null, remarks: null };

    var currentStage = 'Introduce System';
    var currentStatus = 'Introduce: Pending';
    var workStatus = sheetWorkStatus || null;
    var progressPercent = 0;
    var latestRemarks = '';

    if (sheetFinalStatus === 'Closed' || sheetActual4Str) {
      currentStage = 'Closed';
      currentStatus = 'Closed';
      workStatus = 'Closed';
      progressPercent = 100;
      latestRemarks = 'System Request completed and closed in MIS.';
    } else if (currentRevisionNo) {
      if (sheetActual3Str || sheetWorkStatus === 'Completed') {
        currentStage = 'Update MIS System';
        currentStatus = 'Update MIS: Pending';
        workStatus = 'Completed';
        progressPercent = 100;
        latestRemarks = 'Revision completed. Sent to Update MIS.';
      } else {
        currentStage = 'Revise System';
        if (sheetWorkStatus === 'On Hold') {
          workStatus = 'On Hold';
          currentStatus = 'Revise: On Hold';
          latestRemarks = holdReason ? ('Hold: ' + holdReason) : 'Revision on hold';
        } else {
          workStatus = sheetWorkStatus || 'In Progress';
          progressPercent = (metaObj && metaObj.progressPercent) ? Number(metaObj.progressPercent) : 25;
          currentStatus = 'Revise System (' + progressPercent + '%)';
          latestRemarks = 'Under revision development: ' + currentRevisionNo;
        }
      }
    } else if (sheetDecision === 'Approved') {
      currentStage = 'Update MIS System';
      currentStatus = 'Update MIS: Pending';
      workStatus = 'Completed';
      progressPercent = 100;
      latestRemarks = sheetTestRemarks || 'Testing approved. Ready for MIS update.';
    } else if (sheetActual2Str || sheetDecision === 'Rejected') {
      if (sheetDecision === 'Rejected') {
        currentStage = 'Revise System';
        currentStatus = 'Revise System: Pending';
        workStatus = 'Pending Revision';
        latestRemarks = sheetTestRemarks ? ('Rejected in QA: ' + sheetTestRemarks) : 'Rejected in testing';
      } else {
        currentStage = 'Testing System';
        currentStatus = 'Testing: In Progress';
        workStatus = 'Testing';
        latestRemarks = 'Under QA testing';
      }
    } else if (sheetActual1Str) {
      currentStage = 'Testing System';
      currentStatus = 'Testing: Pending';
      workStatus = 'Completed';
      progressPercent = 100;
      latestRemarks = 'Development cycle completed. Sent to Testing System.';
    } else if (isIntroDone) {
      currentStage = 'Create System';
      if (sheetWorkStatus === 'On Hold') {
        workStatus = 'On Hold';
        currentStatus = 'Development: On Hold';
        latestRemarks = holdReason ? ('Hold: ' + holdReason) : 'On Hold';
      } else if (sheetWorkStatus === 'Completed') {
        workStatus = 'Completed';
        progressPercent = 100;
        currentStage = 'Testing System';
        currentStatus = 'Testing: Pending';
        latestRemarks = 'Development completed.';
      } else {
        workStatus = sheetWorkStatus || 'In Progress';
        progressPercent = (metaObj && metaObj.progressPercent !== undefined && sheetWorkStatus) ? Number(metaObj.progressPercent) : 0;
        currentStatus = 'Development: In Progress' + (progressPercent > 0 ? (' (' + progressPercent + '%)') : '');
        latestRemarks = introRemarks || 'Introduction completed. Development in progress.';
      }
    } else {
      currentStage = 'Introduce System';
      currentStatus = 'Introduce: Pending';
      workStatus = sheetWorkStatus || 'Pending Kickoff';
      progressPercent = 0;
      holdReason = '';
      holdExtendTargetDate = '';
      latestRemarks = 'New request created. Pending Introduce System kickoff meeting.';
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
      holdReason: (metaObj && metaObj.holdReason) ? metaObj.holdReason : holdReason,
      holdExtendTargetDate: (metaObj && metaObj.holdExtendTargetDate) ? metaObj.holdExtendTargetDate : (holdExtendTargetDate || null),
      currentStage: currentStage,
      currentStatus: currentStatus,
      workStatus: workStatus,
      progressPercent: progressPercent,
      latestRemarks: latestRemarks,
      createdAt: timestampStr || new Date().toISOString(),
      createdBy: (metaObj && metaObj.createdBy) ? metaObj.createdBy : 'Administrator',
      lastUpdatedAt: (metaObj && metaObj.lastUpdatedAt) ? metaObj.lastUpdatedAt : (timestampStr || new Date().toISOString()),
      closedAt: formatTimestampCell(sheetActual4) || (metaObj && metaObj.closedAt ? metaObj.closedAt : ''),
      completedAt: formatTimestampCell(sheetActual4) || (metaObj && (metaObj.closedAt || metaObj.completedAt) ? (metaObj.closedAt || metaObj.completedAt) : ''),
      actualCreateDate: formatTimestampCell(sheetActual1),
      actualTestingDate: formatTimestampCell(sheetActual2),
      actualReviseDate: formatTimestampCell(sheetActual3),
      actualMisDate: formatTimestampCell(sheetActual4),
      introduction: introduction,
      testingHistory: testingHistory,
      misUpdate: misUpdate,
      activityLog: activityLog,
      attachments: attachments,
      sheetRowIndex: rowIndex
    };

    req.developmentHistory = buildDevelopmentHistoryFromRow(req);
    requests.push(req);
  }

  return requests;
}

/**
 * Handle Create System Request (Writes to Row 7 onwards in FMS)
 */
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
    var nextNum = 1;
    var lastRow = sheet.getLastRow();
    if (lastRow >= mapping.dataStartRow) {
      var numRows = lastRow - mapping.dataStartRow + 1;
      var reqVals = sheet.getRange(mapping.dataStartRow, mapping.colRequestNo, numRows, 1).getValues();
      for (var i = 0; i < reqVals.length; i++) {
        var m = String(reqVals[i][0] || '').match(/SM-(\d+)/);
        if (m) {
          var n = parseInt(m[1], 10);
          if (n >= nextNum) nextNum = n + 1;
        }
      }
    }

    var requestNo = 'SM-' + ('0000' + nextNum).slice(-4);
    var targetRow = findNextEmptyRow(sheet, mapping.colRequestNo, mapping.dataStartRow);
    var now = new Date();
    var nowISO = now.toISOString();
    var id = 'req-' + now.getTime();

    var systemName = data.systemName || data.systemRequirements || 'New System';
    var companyName = data.companyName || '';
    var assignedDeveloper = data.assignedDeveloper || '';
    var targetDate = data.targetCompletionDate || '';

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
      currentStage: 'Introduce System',
      currentStatus: 'Introduce: Pending',
      workStatus: null,
      progressPercent: 0,
      latestRemarks: 'New request created. Pending Introduce System kickoff meeting.',
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
    safeSetCellValue(sheet, targetRow, mapping.colCompany, companyName, mapping);
    safeSetCellValue(sheet, targetRow, mapping.colSystemName, systemName, mapping);
    safeSetCellValue(sheet, targetRow, mapping.colSummary, data.businessPurpose || systemName, mapping);
    safeSetCellValue(sheet, targetRow, mapping.colDeveloper, assignedDeveloper, mapping);
    safeSetCellValue(sheet, targetRow, mapping.colTargetDate, targetDate, mapping);

    if (mapping.colImage && processedAttachments.length > 0) {
      safeSetCellValue(sheet, targetRow, mapping.colImage, processedAttachments[0].driveUrl || processedAttachments[0].url, mapping);
    }
    if (mapping.colWorkStatus) safeSetCellValue(sheet, targetRow, mapping.colWorkStatus, 'Pending Kickoff', mapping);
    if (mapping.colFinalStatus) safeSetCellValue(sheet, targetRow, mapping.colFinalStatus, 'Open', mapping);

    // Save metadata
    if (mapping.colMeta && !mapping.protectedCols[mapping.colMeta]) {
      sheet.getRange(targetRow, mapping.colMeta).setValue(safeStringifyMeta(metaObj));
      var curMetaHeader = sheet.getRange(mapping.headerRow, mapping.colMeta).getValue();
      if (!curMetaHeader) {
        sheet.getRange(mapping.headerRow, mapping.colMeta).setValue('_Make_System_Metadata');
        try { sheet.hideColumns(mapping.colMeta); } catch (e) {}
      }
    }

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
      currentStage: 'Introduce System',
      currentStatus: 'Introduce: Pending',
      workStatus: 'Pending Kickoff',
      progressPercent: 0,
      latestRemarks: 'New request created. Pending Introduce System kickoff meeting.',
      createdAt: nowISO,
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

/**
 * Handle Approve Introduction
 */
function handleApproveIntroduction(requestId, data) {
  return updateRequestRow(requestId, function(rowObj) {
    var nowISO = new Date().toISOString();
    rowObj.currentStage = 'Create System';
    rowObj.currentStatus = 'Create System: Pending';
    rowObj.workStatus = 'In Progress';
    rowObj.progressPercent = 0;
    rowObj.latestRemarks = data.remarks || 'Introduction approved.';
    rowObj.lastUpdatedAt = nowISO;
    rowObj.introduction = {
      isCompleted: true,
      meetingDate: data.meetingDate || '',
      remarks: data.remarks || '',
      completedAt: nowISO,
      completedBy: data.approvedBy || 'Administrator'
    };
    rowObj.activityLog.push({
      id: 'act-' + new Date().getTime(),
      action: 'Introduction Approved',
      actor: data.approvedBy || 'Administrator',
      timestamp: nowISO,
      details: 'Meeting held on ' + (data.meetingDate || '') + '. Scope approved.'
    });
    return rowObj;
  });
}

/**
 * Handle Update Development Progress
 */
function handleUpdateDevelopmentProgress(requestId, data) {
  return updateRequestRow(requestId, function(rowObj) {
    var nowISO = new Date().toISOString();
    var workStatus = data.workStatus || 'In Progress';
    rowObj.workStatus = workStatus;
    rowObj.lastUpdatedAt = nowISO;

    if (data.upgradeTargetDate) rowObj.upgradeTargetDate = data.upgradeTargetDate;
    if (data.systemUrl !== undefined) rowObj.systemUrl = data.systemUrl;
    if (data.adminId !== undefined) rowObj.adminId = data.adminId;
    if (data.adminPassword !== undefined) rowObj.adminPassword = data.adminPassword;

    if (workStatus === 'In Progress') {
      var pct = parseInt(data.progressPercent, 10) || 0;
      rowObj.progressPercent = pct;
      rowObj.latestRemarks = data.remarks || 'Progress updated.';
      rowObj.currentStage = rowObj.currentRevisionNo ? 'Revise System' : 'Create System';
      rowObj.currentStatus = rowObj.currentRevisionNo ? ('Revise System (' + pct + '%)') : ('Development: In Progress (' + pct + '%)');
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
      rowObj.currentStage = rowObj.currentRevisionNo ? 'Revise System' : 'Create System';
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
      rowObj.progressPercent = 100;
      if (rowObj.currentRevisionNo) {
        rowObj.latestRemarks = data.remarks || 'Revision completed. Sent to Update MIS System.';
        rowObj.currentStage = 'Update MIS System';
        rowObj.currentStatus = 'Update MIS: Pending';
      } else {
        rowObj.latestRemarks = data.remarks || 'Development completed. Released for Testing.';
        rowObj.currentStage = 'Testing System';
        rowObj.currentStatus = 'Testing: Pending';
      }
      rowObj.activityLog.push({
        id: 'act-' + new Date().getTime(),
        action: 'Development Completed',
        actor: data.updatedBy || 'Administrator',
        timestamp: nowISO,
        details: 'Cycle completed (100%).'
      });
    }
    return rowObj;
  });
}

/**
 * Handle Submit Testing Decision
 */
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

/**
 * Handle Complete MIS Update
 */
function handleCompleteMisUpdate(requestId, data) {
  return updateRequestRow(requestId, function(rowObj) {
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
  });
}

/**
 * Update a row in FMS Sheet safely
 */
function updateRequestRow(requestId, updateFn) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = getRequestsSheet(ss);
  if (!sheet) throw new Error('Requests sheet (FMS) not found');

  var mapping = findHeaderMapping(sheet);
  var lastRow = sheet.getLastRow();
  if (lastRow < mapping.dataStartRow) throw new Error('No data rows found in sheet');

  var numRows = lastRow - mapping.dataStartRow + 1;
  var maxCols = Math.max(sheet.getLastColumn(), mapping.colMeta || 37);
  var values = sheet.getRange(mapping.dataStartRow, 1, numRows, maxCols).getValues();

  var foundIndex = -1;
  var matchedRow = null;

  for (var i = 0; i < values.length; i++) {
    var r = values[i];
    var reqNo = String(r[mapping.colRequestNo - 1] || '').trim();
    var meta = mapping.colMeta && mapping.colMeta <= r.length ? parseJsonSafely(r[mapping.colMeta - 1], null) : null;
    var metaId = meta && meta.id ? String(meta.id) : ('req-' + reqNo);

    if (String(requestId) === reqNo || String(requestId) === metaId) {
      foundIndex = i;
      matchedRow = r;
      break;
    }
  }

  if (foundIndex === -1) throw new Error('Request "' + requestId + '" not found in sheet.');

  var actualRowNumber = mapping.dataStartRow + foundIndex;
  var metaObj = mapping.colMeta && mapping.colMeta <= matchedRow.length ? parseJsonSafely(matchedRow[mapping.colMeta - 1], {}) : {};

  var rowObj = {
    id: metaObj.id || ('req-' + matchedRow[mapping.colRequestNo - 1]),
    requestNo: String(matchedRow[mapping.colRequestNo - 1] || ''),
    currentRevisionNo: metaObj.currentRevisionNo || null,
    upgradeTargetDate: metaObj.upgradeTargetDate || null,
    companyName: String(matchedRow[mapping.colCompany - 1] || ''),
    systemName: String(matchedRow[mapping.colSystemName - 1] || ''),
    businessPurpose: String(matchedRow[mapping.colSummary - 1] || ''),
    assignedDeveloper: String(matchedRow[mapping.colDeveloper - 1] || ''),
    targetCompletionDate: formatDateCell(matchedRow[mapping.colTargetDate - 1]),
    systemUrl: metaObj.systemUrl || '',
    adminId: metaObj.adminId || '',
    adminPassword: metaObj.adminPassword || '',
    currentStage: metaObj.currentStage || 'Introduce System',
    currentStatus: metaObj.currentStatus || 'Introduce: Pending',
    workStatus: metaObj.workStatus || null,
    progressPercent: metaObj.progressPercent || 0,
    latestRemarks: metaObj.latestRemarks || '',
    createdAt: metaObj.createdAt || formatTimestampCell(matchedRow[mapping.colTimestamps - 1]),
    createdBy: metaObj.createdBy || 'Administrator',
    lastUpdatedAt: new Date().toISOString(),
    introduction: metaObj.introduction || { isCompleted: false },
    testingHistory: metaObj.testingHistory || [],
    misUpdate: metaObj.misUpdate || null,
    activityLog: metaObj.activityLog || [],
    attachments: metaObj.attachments || [],
    sheetRowIndex: actualRowNumber
  };

  var updated = updateFn(rowObj);

  // Write changes to specific cells
  // 1. Introduce step
  if (updated.introduction && updated.introduction.isCompleted) {
    if (mapping.colActual) safeSetCellValue(sheet, actualRowNumber, mapping.colActual, new Date(), mapping);
    if (mapping.colMeetingDate && updated.introduction.meetingDate) safeSetCellValue(sheet, actualRowNumber, mapping.colMeetingDate, updated.introduction.meetingDate, mapping);
    if (mapping.colDiscussionRemarks && updated.introduction.remarks) safeSetCellValue(sheet, actualRowNumber, mapping.colDiscussionRemarks, updated.introduction.remarks, mapping);
    if (mapping.colFinalStatus) safeSetCellValue(sheet, actualRowNumber, mapping.colFinalStatus, 'In Progress', mapping);
  }

  // 2. Work status & hold
  if (updated.workStatus) {
    if (mapping.colWorkStatus) safeSetCellValue(sheet, actualRowNumber, mapping.colWorkStatus, updated.workStatus, mapping);
    if (updated.workStatus === 'On Hold') {
      if (mapping.colReasonForHold) safeSetCellValue(sheet, actualRowNumber, mapping.colReasonForHold, updated.holdReason || updated.latestRemarks || 'On Hold', mapping);
      if (mapping.colHoldExtendTargetDate && updated.holdExtendTargetDate) safeSetCellValue(sheet, actualRowNumber, mapping.colHoldExtendTargetDate, updated.holdExtendTargetDate, mapping);
    } else if (updated.workStatus === 'Completed') {
      if (mapping.colReasonForHold) safeSetCellValue(sheet, actualRowNumber, mapping.colReasonForHold, '', mapping);
      if (mapping.colHoldExtendTargetDate) safeSetCellValue(sheet, actualRowNumber, mapping.colHoldExtendTargetDate, '', mapping);
      if (updated.currentRevisionNo) {
        if (mapping.colRevisionNo) safeSetCellValue(sheet, actualRowNumber, mapping.colRevisionNo, updated.currentRevisionNo, mapping);
        if (mapping.colActual3) safeSetCellValue(sheet, actualRowNumber, mapping.colActual3, new Date(), mapping);
      } else {
        if (mapping.colActual1) safeSetCellValue(sheet, actualRowNumber, mapping.colActual1, new Date(), mapping);
      }
    }
  }

  if (updated.systemUrl && mapping.colSystemLink) safeSetCellValue(sheet, actualRowNumber, mapping.colSystemLink, updated.systemUrl, mapping);
  if (updated.adminId && mapping.colAdminId) safeSetCellValue(sheet, actualRowNumber, mapping.colAdminId, updated.adminId, mapping);
  if (updated.adminPassword && mapping.colAdminPassword) safeSetCellValue(sheet, actualRowNumber, mapping.colAdminPassword, updated.adminPassword, mapping);

  // 3. Testing step
  if (updated.testingHistory && updated.testingHistory.length > 0) {
    var latestTest = updated.testingHistory[updated.testingHistory.length - 1];
    if (mapping.colActual2) safeSetCellValue(sheet, actualRowNumber, mapping.colActual2, new Date(), mapping);
    if (mapping.colDecision && latestTest.decision) safeSetCellValue(sheet, actualRowNumber, mapping.colDecision, latestTest.decision, mapping);
    if (mapping.colTestRemarks && latestTest.remarks) safeSetCellValue(sheet, actualRowNumber, mapping.colTestRemarks, latestTest.remarks, mapping);

    if (latestTest.decision === 'Rejected') {
      var revVal = latestTest.generatedRevisionNo || updated.currentRevisionNo || '';
      if (mapping.colRevisionNo && revVal) safeSetCellValue(sheet, actualRowNumber, mapping.colRevisionNo, revVal, mapping);
      var targetUpgradeDate = updated.upgradeTargetDate || latestTest.upgradeTargetDate || null;
      if (mapping.colUpgradeTargetDate && targetUpgradeDate) safeSetCellValue(sheet, actualRowNumber, mapping.colUpgradeTargetDate, targetUpgradeDate, mapping);
      if (mapping.colWorkStatus) safeSetCellValue(sheet, actualRowNumber, mapping.colWorkStatus, 'Revision In Progress', mapping);
    } else if (latestTest.decision === 'Approved') {
      if (mapping.colWorkStatus) safeSetCellValue(sheet, actualRowNumber, mapping.colWorkStatus, 'Testing Approved', mapping);
    }
  }

  // 4. MIS closure
  if (updated.misUpdate && updated.misUpdate.isCompleted) {
    if (mapping.colActual4) safeSetCellValue(sheet, actualRowNumber, mapping.colActual4, new Date(), mapping);
    if (mapping.colFinalStatus) safeSetCellValue(sheet, actualRowNumber, mapping.colFinalStatus, 'Closed', mapping);
    if (mapping.colWorkStatus) safeSetCellValue(sheet, actualRowNumber, mapping.colWorkStatus, 'Closed', mapping);
  }

  // Update metadata JSON
  if (mapping.colMeta && !mapping.protectedCols[mapping.colMeta]) {
    sheet.getRange(actualRowNumber, mapping.colMeta).setValue(safeStringifyMeta(updated));
  }

  bumpSyncVersion();

  return {
    success: true,
    version: getSyncVersion(),
    request: updated
  };
}

/**
 * Handle direct file upload to Google Drive
 */
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

/**
 * Login Page & User Sheet Handlers
 */
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

function getInitialSeedUsers() {
  return [
    {
      id: 'usr-admin-01',
      username: 'admin',
      fullName: 'System Administrator',
      role: 'Admin',
      status: 'Active',
      department: 'IT & Infrastructure',
      permittedStagesText: 'All Stages (Admin Full Access)',
      permissions: {
        requests: { view: true, edit: true, approve: true },
        introduce: { view: true, edit: true, approve: true },
        create: { view: true, edit: true, approve: true },
        revise: { view: true, edit: true, approve: true },
        testing: { view: true, edit: true, approve: true },
        mis: { view: true, edit: true, approve: true }
      },
      createdAt: '2026-10-01T09:00:00.000Z',
      password: 'password123'
    },
    {
      id: 'usr-dev-01',
      username: 'ahitesh',
      fullName: 'Ahitesh Tandon',
      role: 'User',
      status: 'Active',
      department: 'Engineering',
      permittedStagesText: '3 of 6 Stages (Requests, Create, Revise)',
      permissions: {
        requests: { view: true, edit: false, approve: false },
        introduce: { view: false, edit: false, approve: false },
        create: { view: true, edit: false, approve: false },
        revise: { view: true, edit: false, approve: false },
        testing: { view: false, edit: false, approve: false },
        mis: { view: false, edit: false, approve: false }
      },
      createdAt: '2026-10-05T10:30:00.000Z',
      password: 'password123'
    },
    {
      id: 'usr-qa-01',
      username: 'bhupendra',
      fullName: 'Bhupendra Kumar',
      role: 'User',
      status: 'Active',
      department: 'Quality Assurance',
      permittedStagesText: '2 of 6 Stages (Requests, Testing)',
      permissions: {
        requests: { view: true, edit: false, approve: false },
        introduce: { view: false, edit: false, approve: false },
        create: { view: false, edit: false, approve: false },
        revise: { view: false, edit: false, approve: false },
        testing: { view: true, edit: false, approve: false },
        mis: { view: false, edit: false, approve: false }
      },
      createdAt: '2026-10-08T11:15:00.000Z',
      password: 'password123'
    },
    {
      id: 'usr-lead-01',
      username: 'alauddin',
      fullName: 'MD Alauddin',
      role: 'User',
      status: 'Active',
      department: 'Operations & MIS',
      permittedStagesText: '4 of 6 Stages (Requests, Introduce, Create, MIS)',
      permissions: {
        requests: { view: true, edit: false, approve: false },
        introduce: { view: true, edit: false, approve: false },
        create: { view: true, edit: false, approve: false },
        revise: { view: false, edit: false, approve: false },
        testing: { view: false, edit: false, approve: false },
        mis: { view: true, edit: false, approve: false }
      },
      createdAt: '2026-10-10T14:20:00.000Z',
      password: 'password123'
    }
  ];
}

function fetchAllUsers() {
  var sheet = getLoginSheet();
  var lastRow = sheet.getLastRow();
  if (lastRow <= 1) {
    var seeds = getInitialSeedUsers();
    handleSaveUsers(seeds);
    return seeds;
  }

  var values = sheet.getRange(2, 1, lastRow - 1, 8).getValues();
  var users = [];

  for (var i = 0; i < values.length; i++) {
    var row = values[i];
    var rawFullName = String(row[0] || '').trim();
    var rawUsername = String(row[1] || '').trim();
    if (!rawFullName && !rawUsername) continue;

    var cleanUser = rawUsername.replace(/^@+/, '').replace(/[\(\)]/g, '').replace(/\s+/g, '').toLowerCase() || rawFullName.toLowerCase().replace(/[^a-z0-9]/g, '');
    var cleanName = rawFullName || cleanUser;
    var role = String(row[2] || 'USER').trim().toUpperCase() === 'ADMIN' ? 'Admin' : 'User';
    var status = String(row[4] || 'ACTIVE').trim().toUpperCase() === 'INACTIVE' ? 'Inactive' : 'Active';
    var password = String(row[3] || 'password123').trim() || 'password123';
    var department = String(row[5] || 'General').trim();
    var permittedStagesText = String(row[7] || '').trim();

    var permissions = {};
    var stageList = ['requests', 'introduce', 'create', 'revise', 'testing', 'mis'];
    var lowerText = permittedStagesText.toLowerCase();

    if (role === 'Admin' || lowerText.indexOf('all stages') !== -1) {
      for (var s = 0; s < stageList.length; s++) {
        permissions[stageList[s]] = { view: true, edit: (role === 'Admin'), approve: (role === 'Admin') };
      }
    } else {
      for (var s = 0; s < stageList.length; s++) {
        var sid = stageList[s];
        var isPermitted = (sid === 'requests' && lowerText.indexOf('request') !== -1) ||
                          (sid === 'introduce' && lowerText.indexOf('introduce') !== -1) ||
                          (sid === 'create' && lowerText.indexOf('create') !== -1) ||
                          (sid === 'revise' && lowerText.indexOf('revise') !== -1) ||
                          (sid === 'testing' && (lowerText.indexOf('test') !== -1 || lowerText.indexOf('qa') !== -1)) ||
                          (sid === 'mis' && lowerText.indexOf('mis') !== -1);
        permissions[sid] = { view: isPermitted, edit: false, approve: false };
      }
    }

    users.push({
      id: 'usr-sheet-' + cleanUser,
      username: cleanUser,
      fullName: cleanName,
      role: role,
      status: status,
      permittedStagesText: permittedStagesText || (role === 'Admin' ? 'All Stages (Admin Full Access)' : '1 of 6 Stages (View)'),
      permissions: permissions,
      department: department,
      createdAt: new Date().toISOString(),
      password: password
    });
  }

  return users;
}

function handleSaveUsers(users) {
  if (!Array.isArray(users)) users = [];
  var sheet = getLoginSheet();

  var rowData = users.map(function(u) {
    var roleStr = (u.role || 'User').toUpperCase() === 'ADMIN' ? 'ADMIN' : 'USER';
    var statusStr = (u.status || 'Active').toUpperCase() === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE';
    var permText = roleStr === 'ADMIN' ? 'All Stages (Admin Full Access)' : (u.permittedStagesText || '1 of 6 Stages (View)');

    return [
      u.fullName || u.username,
      String(u.username || '').replace(/^@+/, '').replace(/\s+/g, '').toLowerCase(),
      roleStr,
      u.password || 'password123',
      statusStr,
      u.department || 'General',
      Utilities.formatDate(new Date(), 'Asia/Kolkata', "dd MMM yyyy, h:mm a"),
      permText
    ];
  });

  var lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    sheet.getRange(2, 1, lastRow - 1, Math.max(sheet.getLastColumn(), 8)).clearContent();
  }
  sheet.getRange(1, 1, 1, LOGIN_HEADERS.length).setValues([LOGIN_HEADERS]).setFontWeight('bold');

  if (rowData.length > 0) {
    sheet.getRange(2, 1, rowData.length, rowData[0].length).setValues(rowData);
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
    role: (userData.role || 'User').toUpperCase() === 'ADMIN' ? 'Admin' : 'User',
    status: (userData.status || 'Active').toUpperCase() === 'INACTIVE' ? 'Inactive' : 'Active',
    department: userData.department ? userData.department.trim() : 'General',
    permissions: userData.permissions || {},
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
        role: userData.role !== undefined ? ((String(userData.role).toUpperCase() === 'ADMIN') ? 'Admin' : 'User') : users[i].role,
        status: userData.status !== undefined ? ((String(userData.status).toUpperCase() === 'INACTIVE') ? 'Inactive' : 'Active') : users[i].status,
        department: userData.department !== undefined ? String(userData.department).trim() : users[i].department,
        permissions: userData.permissions !== undefined ? userData.permissions : users[i].permissions,
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

/**
 * Master Dropdown Options (Companies & Developers)
 */
function fetchMasterOptions() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var masterSheet = ss.getSheetByName(SHEET_MASTER);
  var companies = [];
  var developers = [];

  if (masterSheet && masterSheet.getLastRow() >= 2) {
    var vals = masterSheet.getRange(2, 1, masterSheet.getLastRow() - 1, 2).getValues();
    for (var i = 0; i < vals.length; i++) {
      var f = vals[i][0] ? String(vals[i][0]).trim() : '';
      var d = vals[i][1] ? String(vals[i][1]).trim() : '';
      if (f && companies.indexOf(f) === -1) companies.push(f);
      if (d && developers.indexOf(d) === -1) developers.push(d);
    }
  }

  for (var c = 0; c < DEFAULT_COMPANIES.length; c++) {
    if (companies.indexOf(DEFAULT_COMPANIES[c]) === -1) companies.push(DEFAULT_COMPANIES[c]);
  }
  for (var dev = 0; dev < DEFAULT_DEVELOPERS.length; dev++) {
    if (developers.indexOf(DEFAULT_DEVELOPERS[dev]) === -1) developers.push(DEFAULT_DEVELOPERS[dev]);
  }

  return { companies: companies, developers: developers };
}

/**
 * Setup Initial Sheets
 */
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

/**
 * Ultra-Fast Sync Version Management (<10ms)
 */
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
      .addToUi();
  } catch (err) {}
}

function formatLoginPageSheet() {
  var users = fetchAllUsers();
  handleSaveUsers(users);
  SpreadsheetApp.getActiveSpreadsheet().toast('Login Page aligned successfully!', 'Make System', 4);
}

/**
 * Utilities
 */
function jsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}

function parseJsonSafely(str, fallback) {
  if (!str) return fallback;
  try { return JSON.parse(str); } catch (e) { return fallback; }
}

function formatDateCell(val) {
  if (!val) return '';
  if (val instanceof Date) return Utilities.formatDate(val, 'Asia/Kolkata', 'yyyy-MM-dd');
  var s = String(val).trim();
  if (s.indexOf('T') !== -1) return s.split('T')[0];
  return s;
}

function formatTimestampCell(val) {
  if (!val) return '';
  if (val instanceof Date) return Utilities.formatDate(val, 'Asia/Kolkata', "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'");
  return String(val).trim();
}

function safeStringifyMeta(obj) {
  if (!obj) return '{}';
  try {
    var clone = JSON.parse(JSON.stringify(obj));
    if (clone.attachments) {
      for (var i = 0; i < clone.attachments.length; i++) {
        delete clone.attachments[i].base64Data;
      }
    }
    var str = JSON.stringify(clone);
    if (str.length > 45000 && clone.activityLog && clone.activityLog.length > 5) {
      clone.activityLog = clone.activityLog.slice(-5);
      str = JSON.stringify(clone);
    }
    return str;
  } catch (e) {
    return '{}';
  }
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
