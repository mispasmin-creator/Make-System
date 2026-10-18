/**
 * ======================================================================================
 * MAKE SYSTEM - GOOGLE APPS SCRIPT TWO-WAY SYNC BACKEND (FMS COMPATIBLE)
 * ======================================================================================
 * 
 * Configured for "FMS" Sheet:
 * - Headings on Row 6:
 *   [Timestamps, Request No., Company, System Name, Requirements Summary, Assigned Developer, Target Date, Planned, Actual, Delay, Meeting Date, Discussion Remarks, Planned 1, Actual 1...]
 * - Data rows start from Row 7.
 * - Dynamic column detection based on header names.
 * - Full two-way real-time synchronization with Make System React application.
 */

// Configuration constants
var SHEET_FMS = 'FMS';
var SHEET_REQUESTS_FALLBACK = 'System_Requests';
var SHEET_MASTER = 'Master';
var SHEET_LOGIN = 'Login Page';
var DRIVE_FOLDER_ID = '1m1a4pquw0Mq-H41bD2X2R8d4c46V6-4E';
var PROP_SYNC_VERSION = 'MAKE_SYSTEM_SYNC_VERSION';
var PROP_LAST_UPDATED = 'MAKE_SYSTEM_LAST_UPDATED';

// Standard Login Page Headers (matching user sheet screenshot)
var LOGIN_HEADERS = [
  'Full Name',        // Col A (1)
  'User',             // Col B (2) - Username only
  'Role',             // Col C (3)
  'Password',         // Col D (4)
  'Status',           // Col E (5)
  'Department',       // Col F (6)
  'Created',          // Col G (7)
  'Permitted Stages'  // Col H (8)
];

// Standard FMS Row 6 Headers (Cols A to AF, 32 Columns with Work Status at Col I, Reason for Hold at Col R, Hold Extend Target Date at Col S)
var FMS_HEADERS = [
  'Timestamps',                 // Col A (1)
  'Request No.',                // Col B (2)
  'Company',                    // Col C (3)
  'System Name',                // Col D (4)
  'Requirements Summary',       // Col E (5)
  'Assigned Developer',         // Col F (6)
  'Target Date',                // Col G (7)
  'Image',                      // Col H (8)
  'Work Status',                // Col I (9) - Moved from Col R
  'Planned',                    // Col J (10) - Formula (Protected)
  'Actual',                     // Col K (11) - Introduce Timestamp
  'Delay',                      // Col L (12) - Formula (Protected)
  'Meeting Date',               // Col M (13)
  'Discussion Remarks',         // Col N (14)
  'Planned 1',                  // Col O (15) - Formula (Protected)
  'Actual 1',                   // Col P (16) - Create System Timestamp
  'Delay 1',                    // Col Q (17) - Formula (Protected)
  'System Link / URL',          // Col R (18)
  'Admin ID / Username',        // Col S (19)
  'Password',                   // Col T (20)
  'Reason for Hold',            // Col U (21)
  'Hold Extend Target Date',    // Col V (22)
  'Planned 2',                  // Col W (23) - Formula (Protected)
  'Actual 2',                   // Col X (24) - Testing Timestamp
  'Delay 2',                    // Col Y (25) - Formula (Protected)
  'Decision',                   // Col Z (26)
  'Remarks / Defect Rationale', // Col AA (27)
  'Revision No',                // Col AB (28)
  'Upgrade Target Date',        // Col AC (29) - Revision Extended Target Date
  'Planned 3',                  // Col AD (30) - Formula (Protected)
  'Actual 3',                   // Col AE (31) - Revise System Timestamp
  'Delay 3',                    // Col AF (32) - Formula (Protected)
  'Planned 4',                  // Col AG (33) - Formula (Protected)
  'Actual 4',                   // Col AH (34) - Update MIS Timestamp
  'Delay 4',                    // Col AI (35) - Formula (Protected)
  'Final Status'                // Col AJ (36)
];

// Default sample master options (used if Master sheet has no entries)
var DEFAULT_COMPANIES = ['Pmmpl', 'Rkl', 'Refrasynth', 'Purab', 'Refratech'];
var DEFAULT_DEVELOPERS = [
  'Ahitesh Tandon',
  'Bhupendra Kumar',
  'MD Alauddin'
];

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

    if (action === 'getRequests') {
      return jsonResponse({
        version: getSyncVersion(),
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

    return jsonResponse({ error: 'Unknown action: ' + action });
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
      return jsonResponse({
        version: getSyncVersion(),
        users: fetchAllUsers()
      });
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
 * Get the active requests sheet (prefers 'FMS', fallback to 'System_Requests', then first sheet)
 */
function getRequestsSheet(ss) {
  ss = ss || SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_FMS);
  if (sheet) return sheet;
  sheet = ss.getSheetByName(SHEET_REQUESTS_FALLBACK);
  if (sheet) return sheet;
  return ss.getSheets()[0];
}

/**
 * Normalize header text for fuzzy/case-insensitive matching
 */
function normalizeHeaderKey(str) {
  if (!str) return '';
  return String(str).toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Identify row 6 headings and column index mappings
 */
function findHeaderMapping(sheet) {
  var lastCol = Math.max(sheet.getLastColumn(), 16);
  var headerRow = 6;
  var headerValues = [];
  var found = false;

  // Search rows 1 to 10 for "Request No" header
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

  // If not found dynamically, default to row 6 as specified
  if (!found) {
    headerRow = 6;
    headerValues = sheet.getRange(headerRow, 1, 1, lastCol).getValues()[0];
  }

  // Build normalized column map (preserve first occurrence so Col I is prioritized for Work Status)
  var colMap = {};
  for (var i = 0; i < headerValues.length; i++) {
    var raw = String(headerValues[i] || '').trim();
    if (!raw) continue;
    var k = normalizeHeaderKey(raw);
    if (!colMap[k]) {
      colMap[k] = i + 1; // 1-based index
    }
  }

  function getCol(aliases, defaultIndex) {
    for (var a = 0; a < aliases.length; a++) {
      var k = normalizeHeaderKey(aliases[a]);
      if (colMap[k]) return colMap[k];
    }
    return defaultIndex;
  }

  // Identify and protect any Planned and Delay columns dynamically from header text:
  var protectedCols = {};
  for (var i = 0; i < headerValues.length; i++) {
    var rawHeader = String(headerValues[i] || '').trim().toLowerCase();
    // Only protect columns whose header contains 'planned' or 'delay'
    if (rawHeader.indexOf('planned') !== -1 || rawHeader.indexOf('delay') !== -1) {
      protectedCols[i + 1] = true; // 1-based index
    }
  }

  // Base Column Mappings (Make System)
  var colTimestamps = getCol(['Timestamps', 'Timestamp', 'Created At'], 1);
  var colRequestNo = getCol(['Request No.', 'Request No', 'Request Number', 'Req No'], 2);
  var colCompany = getCol(['Company', 'Company ', 'Company Name'], 3);
  var colSystemName = getCol(['System Name', 'System', 'Project Name'], 4);
  var colSummary = getCol(['Requirements Summary', 'Business Purpose', 'Requirements', 'Summary'], 5);
  var colDeveloper = getCol(['Assigned Developer', 'Developer', 'Assigned To'], 6);
  var colTargetDate = getCol(['Target Date', 'Target Completion Date', 'Target'], 7);
  var colImage = getCol(['Image', 'Images', 'Attachment', 'Attachments', 'File', 'Files', 'Attachment Link', 'Drive Link'], 8);
  var colWorkStatus = getCol(['Work Status', 'Dev Status', 'Status'], 9); // Col I (9) - Moved from Col R

  // FMS workflow stage columns
  // Stage 1: Introduce System
  var colActual = getCol(['Actual'], 11); // Col K (11) - Introduce Timestamp
  var colMeetingDate = getCol(['Meeting Date', 'Kickoff Date'], 13); // Col M (13)
  var colDiscussionRemarks = getCol(['Discussion Remarks', 'Remarks'], 14); // Col N (14)

  // Stage 2: Create System
  var colActual1 = getCol(['Actual 1', 'Actual1'], 16); // Col P (16) - Create System Timestamp
  var colSystemLink = getCol(['System Link / URL', 'System Link/URL', 'System Link', 'System URL', 'App Link', 'Live URL', 'Link', 'Deployed URL'], 18); // Col R (18)
  var colAdminId = getCol(['Admin ID / Username', 'Admin ID/Username', 'Admin ID', 'Admin Username', 'Admin Email', 'Login ID', 'Admin User', 'Username'], 19); // Col S (19)
  var colAdminPassword = getCol(['Password', 'Admin Password', 'Login Password'], 20); // Col T (20)
  var colReasonForHold = getCol(['Reason for Hold', 'ReasonforHold', 'Hold Reason', 'Hold Remarks', 'Hold Time'], 21); // Col U (21)
  var colHoldExtendTargetDate = getCol(['Hold Extend Target Date', 'HoldExtendTargetDate', 'Hold Extend Date', 'Extended Target Date', 'Extend Target Date', 'Hold Target Date'], 22); // Col V (22)

  // Stage 3: Testing System
  var colActual2 = getCol(['Actual 2', 'Actual2'], 24); // Col X (24) - Testing Timestamp
  var colDecision = getCol(['Decision', 'Test Decision', 'Testing Decision'], 26); // Col Z (26)
  var colTestRemarks = getCol(['Remarks / Defect Rationale', 'Remarks / Defec', 'Remarks / Defects', 'Testing Remarks', 'Defect Details'], 27); // Col AA (27)

  // Stage 4: Revise System
  var colRevisionNo = getCol(['Revision No', 'Revision No.', 'Rev No', 'Rev No.'], 28); // Col AB (28)
  var colUpgradeTargetDate = getCol(['Upgrade Target Date', 'UpgradeTargetDate', 'Revise Target Date', 'Revision Target Date', 'Upgrade Date'], 29); // Col AC (29)
  var colActual3 = getCol(['Actual 3', 'Actual3'], 31); // Col AE (31) - Revise System Timestamp

  // Stage 5: Update MIS System
  var colActual4 = getCol(['Actual 4', 'Actual4'], 34); // Col AH (34) - Update MIS Timestamp
  var colFinalStatus = getCol(['Final Status', 'FinalStatus', 'Final'], 36); // Col AJ (36)

  // STRICT GUARANTEE: Never allow any operational data column to be marked protected!
  var operationalCols = [
    colTimestamps, colRequestNo, colCompany, colSystemName, colSummary,
    colDeveloper, colTargetDate, colImage, colActual, colMeetingDate,
    colDiscussionRemarks, colActual1, colWorkStatus,
    colSystemLink, colAdminId, colAdminPassword,
    colReasonForHold, colHoldExtendTargetDate,
    colActual2, colDecision, colTestRemarks,
    colRevisionNo, colUpgradeTargetDate, colActual3, colActual4, colFinalStatus
  ];
  for (var op = 0; op < operationalCols.length; op++) {
    if (operationalCols[op]) {
      delete protectedCols[operationalCols[op]];
    }
  }

  // Hidden/Trailing metadata column (placed at Col 37 or beyond to guarantee no collision with user columns)
  var colMeta = getCol(['_Make_System_Metadata', 'Metadata', 'Internal ID', '_meta'], 0);
  if (!colMeta || protectedCols[colMeta] || colMeta <= 36) {
    var lastHeaderCol = 0;
    for (var h = headerValues.length - 1; h >= 0; h--) {
      if (String(headerValues[h] || '').trim()) {
        lastHeaderCol = h + 1;
        break;
      }
    }
    colMeta = Math.max(lastHeaderCol + 1, 37);
    while (protectedCols[colMeta]) {
      colMeta++;
    }
  }

  return {
    headerRow: headerRow,
    dataStartRow: headerRow + 1, // Row 7!
    colMap: colMap,
    protectedCols: protectedCols,
    colTimestamps: colTimestamps,
    colRequestNo: colRequestNo,
    colCompany: colCompany,
    colSystemName: colSystemName,
    colSummary: colSummary,
    colDeveloper: colDeveloper,
    colTargetDate: colTargetDate,
    colImage: colImage,
    colActual: colActual,
    colMeetingDate: colMeetingDate,
    colDiscussionRemarks: colDiscussionRemarks,
    colActual1: colActual1,
    colWorkStatus: colWorkStatus,
    colSystemLink: colSystemLink,
    colAdminId: colAdminId,
    colAdminPassword: colAdminPassword,
    colReasonForHold: colReasonForHold,
    colHoldExtendTargetDate: colHoldExtendTargetDate,
    colHoldTime: colReasonForHold, // backward compatibility
    colActual2: colActual2,
    colDecision: colDecision,
    colTestRemarks: colTestRemarks,
    colRevisionNo: colRevisionNo,
    colUpgradeTargetDate: colUpgradeTargetDate,
    colActual3: colActual3,
    colActual4: colActual4,
    colFinalStatus: colFinalStatus,
    colMeta: colMeta
  };
}

/**
 * Safely set a cell value while strictly skipping any Planned or Delay formula columns
 */
function safeSetCellValue(sheet, row, col, value, mapping) {
  if (!col || col <= 0) return;
  if (mapping && mapping.protectedCols && mapping.protectedCols[col]) {
    // Strictly skip overwriting: user has custom formulas in Planned / Delay columns
    return;
  }
  sheet.getRange(row, col).setValue(value);
}

/**
 * Find the first available empty row starting from Row 7
 */
function findNextEmptyRow(sheet, colRequestNo, dataStartRow) {
  dataStartRow = dataStartRow || 7;
  var lastRow = sheet.getLastRow();
  if (lastRow < dataStartRow) {
    return dataStartRow;
  }

  var numRows = lastRow - dataStartRow + 1;
  var reqVals = sheet.getRange(dataStartRow, colRequestNo, numRows, 1).getValues();

  for (var i = 0; i < reqVals.length; i++) {
    var v = String(reqVals[i][0] || '').trim();
    if (!v) {
      return dataStartRow + i; // Found empty row
    }
  }

  return dataStartRow + numRows;
}

/**
 * Fetch all system requests from FMS sheet (Row 7 onwards)
 */
function fetchAllRequests() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = getRequestsSheet(ss);
  if (!sheet) return [];

  var mapping = findHeaderMapping(sheet);
  var lastRow = sheet.getLastRow();
  if (lastRow < mapping.dataStartRow) {
    return [];
  }

  var numRows = lastRow - mapping.dataStartRow + 1;
  var maxCols = Math.max(sheet.getLastColumn(), mapping.colMeta || 15);
  var values = sheet.getRange(mapping.dataStartRow, 1, numRows, maxCols).getValues();

  var requests = [];
  for (var i = 0; i < values.length; i++) {
    var row = values[i];
    var rowIndex = mapping.dataStartRow + i;

    // Check if Request No. exists
    var reqNo = String(row[mapping.colRequestNo - 1] || '').trim();
    if (!reqNo) {
      var sysName = String(row[mapping.colSystemName - 1] || '').trim();
      var compName = String(row[mapping.colCompany - 1] || '').trim();
      if (!sysName && !compName) continue; // Skip completely empty row
      reqNo = 'SM-' + ('0000' + (i + 1)).slice(-4);
    }

    // Read metadata JSON if present in colMeta
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
        if (numMatch) {
          sheetRevisionNo = 'REV-' + ('0' + parseInt(numMatch[0], 10)).slice(-2);
        }
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
    if (currentRevisionNo) {
      var mRev2 = String(currentRevisionNo).match(/REV-?\d+/i);
      if (mRev2) {
        var nRev2 = mRev2[0].match(/\d+/);
        if (nRev2) currentRevisionNo = 'REV-' + ('0' + parseInt(nRev2[0], 10)).slice(-2);
      }
    }
    var upgradeTargetDate = sheetUpgradeTargetDate || (metaObj && metaObj.upgradeTargetDate ? metaObj.upgradeTargetDate : null);
    var systemUrl = (mapping.colSystemLink && mapping.colSystemLink <= row.length ? String(row[mapping.colSystemLink - 1] || '').trim() : '') || (metaObj && metaObj.systemUrl ? metaObj.systemUrl : '');
    var adminId = (mapping.colAdminId && mapping.colAdminId <= row.length ? String(row[mapping.colAdminId - 1] || '').trim() : '') || (metaObj && metaObj.adminId ? metaObj.adminId : '');
    var adminPassword = (mapping.colAdminPassword && mapping.colAdminPassword <= row.length ? String(row[mapping.colAdminPassword - 1] || '').trim() : '') || (metaObj && metaObj.adminPassword ? metaObj.adminPassword : '');

    // Fallback: If metadata has no attachments, but sheet has colImage populated
    if (attachments.length === 0 && mapping.colImage && mapping.colImage <= row.length) {
      var rawImgUrl = String(row[mapping.colImage - 1] || '').trim();
      if (rawImgUrl) {
        var driveUrl = rawImgUrl;
        var directUrl = rawImgUrl;
        if (rawImgUrl.indexOf('drive.google.com/file/d/') !== -1) {
          var m = rawImgUrl.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
          if (m && m[1]) {
            directUrl = 'https://lh3.googleusercontent.com/d/' + m[1];
          }
        } else if (rawImgUrl.indexOf('lh3.googleusercontent.com/d/') !== -1) {
          var m2 = rawImgUrl.match(/\/d\/([a-zA-Z0-9_-]+)/);
          if (m2 && m2[1]) {
            driveUrl = 'https://drive.google.com/file/d/' + m2[1] + '/view?usp=sharing';
            // Auto-heal sheet cell to Google Drive link
            try { sheet.getRange(rowIndex, mapping.colImage).setValue(driveUrl); } catch (e) {}
          }
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

    // GROUND TRUTH: Visible Google Sheet cells determine the active stage!
    // 1. Introduce System completion depends strictly on Meeting Date (Col M) OR Actual (Col K):
    var isIntroDone = Boolean(meetingDate || sheetActualStr);
    var introduction = null;
    if (isIntroDone) {
      introduction = {
        isCompleted: true,
        meetingDate: meetingDate || formatDateCell(sheetActual),
        remarks: introRemarks,
        completedAt: formatTimestampCell(sheetActual) || timestampStr,
        completedBy: (metaObj && metaObj.introduction && metaObj.introduction.completedBy) ? metaObj.introduction.completedBy : 'Administrator'
      };
    } else {
      introduction = {
        isCompleted: false,
        meetingDate: null,
        remarks: null
      };
    }

    // 2. Derive Stage & Status strictly from visible sheet columns:
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
      // Neither Col K nor Col M has data: cleanly reset to Introduce System Pending!
      currentStage = 'Introduce System';
      currentStatus = 'Introduce: Pending';
      workStatus = sheetWorkStatus || 'Pending Kickoff';
      progressPercent = 0;
      holdReason = '';
      holdExtendTargetDate = '';
      latestRemarks = 'New request created. Pending Introduce System kickoff meeting.';
    }

    // Auto-sync metaObj so hidden column stays in harmony with sheet cells
    if (metaObj && mapping.colMeta && !mapping.protectedCols[mapping.colMeta]) {
      metaObj.currentStage = currentStage;
      metaObj.currentStatus = currentStatus;
      metaObj.workStatus = workStatus;
      metaObj.introduction = introduction;
      metaObj.holdReason = holdReason;
      metaObj.holdExtendTargetDate = holdExtendTargetDate;
      metaObj.currentRevisionNo = currentRevisionNo;
      metaObj.upgradeTargetDate = upgradeTargetDate;
      metaObj.systemUrl = systemUrl;
      metaObj.adminId = adminId;
      metaObj.adminPassword = adminPassword;
      metaObj.progressPercent = progressPercent;
      metaObj.latestRemarks = latestRemarks;
      try {
        sheet.getRange(rowIndex, mapping.colMeta).setValue(safeStringifyMeta(metaObj));
      } catch (e) {}
    }

    var req = {
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
      id: internalId,
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
    lock.waitLock(15000);
  } catch (e) {
    throw new Error('Server is busy processing another request. Please retry in a few seconds.');
  }

  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = getRequestsSheet(ss);
    if (!sheet) {
      sheet = ss.insertSheet(SHEET_FMS);
    }

    var mapping = findHeaderMapping(sheet);

    // Calculate next sequential Request No (SM-0001, SM-0002...)
    var nextNum = 1;
    var lastRow = sheet.getLastRow();
    if (lastRow >= mapping.dataStartRow) {
      var numRows = lastRow - mapping.dataStartRow + 1;
      var reqVals = sheet.getRange(mapping.dataStartRow, mapping.colRequestNo, numRows, 1).getValues();
      for (var i = 0; i < reqVals.length; i++) {
        var val = String(reqVals[i][0] || '');
        var match = val.match(/SM-(\d+)/);
        if (match) {
          var num = parseInt(match[1], 10);
          if (num >= nextNum) nextNum = num + 1;
        }
      }
    }

    var requestNo = 'SM-' + ('0000' + nextNum).slice(-4);
    var targetRow = findNextEmptyRow(sheet, mapping.colRequestNo, mapping.dataStartRow);
    var now = new Date();
    var tz = Session.getScriptTimeZone() || 'Asia/Kolkata';
    var timestampStr = Utilities.formatDate(now, tz, 'MM/dd/yyyy HH:mm:ss');
    var nowISO = now.toISOString();
    var id = 'req-' + now.getTime() + '-' + Math.floor(Math.random() * 1000);

    var systemName = data.systemName || data.systemRequirements || 'New System';
    var companyName = data.companyName || '';
    var assignedDeveloper = data.assignedDeveloper || '';
    var targetDate = data.targetCompletionDate || '';

    var initialActivityLog = [
      {
        id: 'act-' + now.getTime(),
        action: 'Request Created',
        actor: data.createdBy || 'Administrator',
        timestamp: nowISO,
        details: 'System Request ' + requestNo + ' created for ' + companyName + '. Assigned to ' + assignedDeveloper + '.'
      }
    ];

    // Process attachments: Save PDF/images directly to Google Drive Folder (1m1a4pquw0Mq-H41bD2X2R8d4c46V6-4E)
    var processedAttachments = [];
    if (data.attachments && data.attachments.length > 0) {
      for (var a = 0; a < data.attachments.length; a++) {
        var att = data.attachments[a];
        if (att && att.base64Data) {
          try {
            var folder = DriveApp.getFolderById(DRIVE_FOLDER_ID);
            var base64Content = String(att.base64Data);
            var commaIdx = base64Content.indexOf(',');
            if (commaIdx !== -1) {
              base64Content = base64Content.substring(commaIdx + 1);
            }
            var decodedBytes = Utilities.base64Decode(base64Content);
            var mimeType = att.type || 'application/octet-stream';
            var fileName = att.name || ('Attachment_' + requestNo + '_' + (a + 1));
            var blob = Utilities.newBlob(decodedBytes, mimeType, fileName);
            var driveFile = folder.createFile(blob);
            try {
              driveFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
            } catch (shareErr) {}

            processedAttachments.push({
              id: att.id || ('att-' + new Date().getTime() + '-' + a),
              name: fileName,
              size: att.size || driveFile.getSize(),
              type: mimeType,
              url: driveFile.getUrl(),
              driveUrl: driveFile.getUrl(),
              fileId: driveFile.getId(),
              uploadedAt: nowISO
            });
          } catch (driveErr) {
            processedAttachments.push({
              id: att.id || ('att-' + new Date().getTime() + '-' + a),
              name: att.name || 'Attachment',
              size: att.size || 0,
              type: att.type || '',
              error: driveErr.toString(),
              uploadedAt: nowISO
            });
          }
        } else if (att) {
          processedAttachments.push(att);
        }
      }
    }

    if (processedAttachments.length > 0) {
      initialActivityLog.push({
        id: 'act-' + (now.getTime() + 1),
        action: 'Attachments Saved to Google Drive',
        actor: data.createdBy || 'Administrator',
        timestamp: nowISO,
        details: processedAttachments.length + ' file(s) saved to Google Drive folder.'
      });
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

    // 1. Write visible human-readable values to Row 7+ in exact columns (Never touching Planned or Delay):
    safeSetCellValue(sheet, targetRow, mapping.colTimestamps, new Date(), mapping);
    safeSetCellValue(sheet, targetRow, mapping.colRequestNo, requestNo, mapping);
    safeSetCellValue(sheet, targetRow, mapping.colCompany, companyName, mapping);
    safeSetCellValue(sheet, targetRow, mapping.colSystemName, systemName, mapping);
    safeSetCellValue(sheet, targetRow, mapping.colSummary, data.businessPurpose || systemName, mapping);
    safeSetCellValue(sheet, targetRow, mapping.colDeveloper, assignedDeveloper, mapping);
    safeSetCellValue(sheet, targetRow, mapping.colTargetDate, targetDate, mapping);

    // If FMS sheet has Image/Attachment column, write Google Drive sharing link
    if (mapping.colImage && processedAttachments && processedAttachments.length > 0) {
      var firstAtt = processedAttachments[0];
      var attLink = '';
      if (firstAtt.driveUrl) {
        attLink = firstAtt.driveUrl;
      } else if (firstAtt.fileId) {
        attLink = 'https://drive.google.com/file/d/' + firstAtt.fileId + '/view?usp=sharing';
      } else if (firstAtt.url) {
        attLink = firstAtt.url;
        if (attLink.indexOf('lh3.googleusercontent.com/d/') !== -1) {
          var mAtt = attLink.match(/\/d\/([a-zA-Z0-9_-]+)/);
          if (mAtt && mAtt[1]) attLink = 'https://drive.google.com/file/d/' + mAtt[1] + '/view?usp=sharing';
        }
      }
      if (attLink) {
        safeSetCellValue(sheet, targetRow, mapping.colImage, attLink, mapping);
      }
    }

    if (mapping.colWorkStatus) {
      safeSetCellValue(sheet, targetRow, mapping.colWorkStatus, 'Pending Kickoff', mapping);
    }
    if (mapping.colFinalStatus) {
      safeSetCellValue(sheet, targetRow, mapping.colFinalStatus, 'Open', mapping);
    }

    // NOTE: Planned & Delay columns are strictly preserved and NEVER overwritten so user formulas remain intact.

    // 2. Save metadata JSON (Guaranteed to be clean and under 50,000 characters)
    if (mapping.colMeta && !mapping.protectedCols[mapping.colMeta]) {
      sheet.getRange(targetRow, mapping.colMeta).setValue(safeStringifyMeta(metaObj));
      var curMetaHeader = sheet.getRange(mapping.headerRow, mapping.colMeta).getValue();
      if (!curMetaHeader) {
        sheet.getRange(mapping.headerRow, mapping.colMeta).setValue('_Make_System_Metadata');
        try { sheet.hideColumns(mapping.colMeta); } catch (e) {}
      }
    }

    bumpSyncVersion();

    return {
      success: true,
      requestNo: requestNo,
      id: id,
      targetRow: targetRow,
      version: getSyncVersion()
    };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Handle Approve Introduction (FMS Meeting Date & Discussion Remarks)
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
      details: 'Meeting held on ' + (data.meetingDate || '') + '. Remarks: "' + (data.remarks || '') + '". Moved to Create System.'
    });

    return rowObj;
  });
}

/**
 * Handle Update Development Progress (In Progress, On Hold, Completed)
 */
function handleUpdateDevelopmentProgress(requestId, data) {
  return updateRequestRow(requestId, function(rowObj) {
    var nowISO = new Date().toISOString();
    var workStatus = data.workStatus || 'In Progress';

    rowObj.workStatus = workStatus;
    rowObj.lastUpdatedAt = nowISO;
    if (data.upgradeTargetDate) {
      rowObj.upgradeTargetDate = data.upgradeTargetDate;
    }

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
        details: 'Progress updated to ' + pct + '%. Remarks: "' + (data.remarks || '') + '"'
      });
    } else if (workStatus === 'On Hold') {
      rowObj.latestRemarks = data.holdReason || 'Put on hold.';
      rowObj.holdReason = data.holdReason || '';
      rowObj.currentStage = rowObj.currentRevisionNo ? 'Revise System' : 'Create System';
      rowObj.currentStatus = rowObj.currentRevisionNo ? 'Revise: On Hold' : 'Development: On Hold';

      var extDate = data.holdExtendTargetDate || data.extendedTargetDate || null;
      if (extDate) {
        rowObj.holdExtendTargetDate = extDate;
      }
      // CRITICAL: rowObj.targetCompletionDate (Col G) is strictly preserved and NEVER modified!

      var dateChangeNote = rowObj.holdExtendTargetDate ? (' Hold Extend Target Date: ' + rowObj.holdExtendTargetDate + '.') : '';
      rowObj.activityLog.push({
        id: 'act-' + new Date().getTime(),
        action: 'Development Put On Hold',
        actor: data.updatedBy || 'Administrator',
        timestamp: nowISO,
        details: 'Reason for Hold: "' + (data.holdReason || '') + '".' + dateChangeNote + ' (Preserved progress: ' + (rowObj.progressPercent || 0) + '%)'
      });
    } else if (workStatus === 'Completed') {
      rowObj.progressPercent = 100;
      var linkNote = data.systemUrl ? (' System Link: ' + data.systemUrl + '.') : '';

      if (rowObj.currentRevisionNo) {
        rowObj.latestRemarks = data.remarks || 'Revision completed. Sent to Update MIS System.';
        rowObj.currentStage = 'Update MIS System';
        rowObj.currentStatus = 'Update MIS: Pending';

        rowObj.activityLog.push({
          id: 'act-' + new Date().getTime(),
          action: 'Revision Completed',
          actor: data.updatedBy || 'Administrator',
          timestamp: nowISO,
          details: 'Revision ' + rowObj.currentRevisionNo + ' completed (100%).' + linkNote + ' Sent to Update MIS System.'
        });
      } else {
        rowObj.latestRemarks = data.remarks || 'Development completed. Released for Testing.';
        rowObj.currentStage = 'Testing System';
        rowObj.currentStatus = 'Testing: Pending';

        rowObj.activityLog.push({
          id: 'act-' + new Date().getTime(),
          action: 'Development Completed',
          actor: data.updatedBy || 'Administrator',
          timestamp: nowISO,
          details: 'Cycle completed (100%).' + linkNote + ' Sent to Testing System.'
        });
      }
    }

    return rowObj;
  });
}

/**
 * Handle Submit Testing Decision (Approved or Rejected)
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
        details: 'Testing approved. Moved to Update MIS System.'
      });
    } else {
      // Rejection: Generate Revision No strictly formatted as REV-01, REV-02
      var rejections = rowObj.testingHistory.filter(function(t) { return t.decision === 'Rejected'; });
      var revNum = rejections.length + 1;
      var newRevNo = 'REV-' + ('0' + revNum).slice(-2);

      var upgradeDate = data.upgradeTargetDate || data.extendedTargetDate || null;
      if (upgradeDate) {
        rowObj.upgradeTargetDate = upgradeDate;
      }

      var dateChangeNote = upgradeDate ? (' Upgrade Target Date: ' + upgradeDate + '.') : '';

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
      rowObj.upgradeTargetDate = upgradeDate || rowObj.upgradeTargetDate || null;
      rowObj.workStatus = 'In Progress';
      rowObj.progressPercent = 0;
      rowObj.latestRemarks = 'Testing Rejected: ' + (data.remarks || '') + (dateChangeNote ? (' (' + dateChangeNote.trim() + ')') : '');
      rowObj.lastUpdatedAt = nowISO;

      rowObj.activityLog.push({
        id: 'act-' + new Date().getTime(),
        action: 'Testing Rejected (' + newRevNo + ')',
        actor: data.testedBy || 'QA Lead',
        timestamp: nowISO,
        details: 'Rejected with remarks: "' + (data.remarks || '') + '". Generated ' + newRevNo + '.' + dateChangeNote + ' Transferred to Revise System queue.'
      });
    }

    return rowObj;
  });
}

/**
 * Handle Complete MIS Update & Close Request
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
      details: 'MIS update submitted: "' + (data.remarks || '') + '". Request closed.'
    });

    return rowObj;
  });
}

/**
 * Safely stringify metadata JSON so it NEVER exceeds the 50,000 character cell limit
 */
function safeStringifyMeta(obj) {
  if (!obj) return '{}';
  try {
    var clone = JSON.parse(JSON.stringify(obj));
    if (clone.attachments && clone.attachments.length > 0) {
      for (var i = 0; i < clone.attachments.length; i++) {
        delete clone.attachments[i].base64Data;
        delete clone.attachments[i].previewUrl;
        delete clone.attachments[i].fileRef;
      }
    }
    var str = JSON.stringify(clone);
    if (str.length > 45000) {
      if (clone.activityLog && clone.activityLog.length > 5) {
        clone.activityLog = clone.activityLog.slice(-5);
      }
      str = JSON.stringify(clone);
    }
    return str;
  } catch (e) {
    return '{}';
  }
}

/**
 * Handle direct file upload to Google Drive
 */
function handleUploadAttachment(data) {
  try {
    var folder = null;

    // 1. Try specified folder ID
    if (typeof DRIVE_FOLDER_ID !== 'undefined' && DRIVE_FOLDER_ID && DRIVE_FOLDER_ID !== 'YOUR_FOLDER_ID') {
      try {
        folder = DriveApp.getFolderById(DRIVE_FOLDER_ID);
      } catch (fErr) {
        Logger.log('Drive folder ID not found or inaccessible, fallback to folder search/create: ' + fErr);
      }
    }

    // 2. If folder not found, look for or create "Make System Attachments" folder in root Drive
    if (!folder) {
      var folderName = 'Make System Attachments';
      var existingFolders = DriveApp.getFoldersByName(folderName);
      if (existingFolders.hasNext()) {
        folder = existingFolders.next();
      } else {
        folder = DriveApp.createFolder(folderName);
      }
    }

    var base64Content = String(data.base64Data || '');
    var commaIdx = base64Content.indexOf(',');
    if (commaIdx !== -1) {
      base64Content = base64Content.substring(commaIdx + 1);
    }
    var decodedBytes = Utilities.base64Decode(base64Content);
    var mimeType = data.type || 'application/octet-stream';
    var fileName = data.name || ('Attachment_' + new Date().getTime());
    var blob = Utilities.newBlob(decodedBytes, mimeType, fileName);
    var driveFile = folder.createFile(blob);

    try {
      driveFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    } catch (permErr) {}

    var fileId = driveFile.getId();
    var driveViewUrl = 'https://drive.google.com/file/d/' + fileId + '/view?usp=sharing';
    var directImgUrl = 'https://lh3.googleusercontent.com/d/' + fileId;
    var previewEmbedUrl = 'https://drive.google.com/file/d/' + fileId + '/preview';

    return {
      success: true,
      fileId: fileId,
      name: fileName,
      size: driveFile.getSize(),
      type: mimeType,
      url: driveViewUrl,
      directUrl: directImgUrl,
      thumbnailUrl: 'https://drive.google.com/thumbnail?id=' + fileId + '&sz=w600',
      previewUrl: previewEmbedUrl,
      driveUrl: driveViewUrl,
      uploadedAt: new Date().toISOString()
    };
  } catch (err) {
    var errMsg = err.toString();
    if (errMsg.indexOf('DriveApp') !== -1 || errMsg.indexOf('permission') !== -1) {
      errMsg = 'Google Drive Authorization Needed: Please run function "authorizeDriveAndSheets" once inside Apps Script editor and click Allow. Details: ' + errMsg;
    }
    return {
      success: false,
      error: errMsg
    };
  }
}

/**
 * ONE-CLICK AUTHORIZATION HELPER:
 * Run this function once in Apps Script editor to grant Google Drive + Sheets permissions!
 */
function authorizeDriveAndSheets() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  Logger.log('Spreadsheets permission verified: ' + ss.getName());

  var folderName = 'Make System Attachments';
  var folder;
  var existingFolders = DriveApp.getFoldersByName(folderName);
  if (existingFolders.hasNext()) {
    folder = existingFolders.next();
  } else {
    folder = DriveApp.createFolder(folderName);
  }

  Logger.log('Drive permission verified: Folder created/found with ID ' + folder.getId());
  SpreadsheetApp.getActiveSpreadsheet().toast('Google Drive & Sheets permissions successfully authorized!', 'Success', 5);
  return { success: true, folderId: folder.getId() };
}

/**
 * ONE-CLICK REPAIR & RESYNC HELPER:
 * Run this function in Apps Script editor to auto-repair any empty Actual timestamps
 * or missing columns in the FMS sheet!
 */
function repairAndSyncFmsSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = getRequestsSheet(ss);
  if (!sheet) {
    throw new Error('FMS sheet not found');
  }

  var mapping = findHeaderMapping(sheet);
  var lastRow = sheet.getLastRow();
  var repairedCount = 0;

  if (lastRow >= mapping.dataStartRow) {
    var numRows = lastRow - mapping.dataStartRow + 1;
    for (var i = 0; i < numRows; i++) {
      var rowIndex = mapping.dataStartRow + i;
      var row = sheet.getRange(rowIndex, 1, 1, Math.max(sheet.getLastColumn(), 32)).getValues()[0];
      var reqNo = String(row[mapping.colRequestNo - 1] || '').trim();
      if (!reqNo) continue;

      var meetingDate = mapping.colMeetingDate && mapping.colMeetingDate <= row.length ? row[mapping.colMeetingDate - 1] : null;
      var curActual = mapping.colActual && mapping.colActual <= row.length ? row[mapping.colActual - 1] : null;

      // 1. If Meeting Date exists but Actual timestamp is blank, generate it!
      if (meetingDate && (!curActual || String(curActual).trim() === '')) {
        var genDate = (meetingDate instanceof Date) ? meetingDate : new Date();
        sheet.getRange(rowIndex, mapping.colActual).setValue(genDate);
        repairedCount++;
      }

      // 2. Convert any raw lh3 image URLs in Col H to Google Drive sharing links:
      if (mapping.colImage && mapping.colImage <= row.length) {
        var curImgUrl = String(row[mapping.colImage - 1] || '').trim();
        if (curImgUrl.indexOf('lh3.googleusercontent.com/d/') !== -1) {
          var mImg = curImgUrl.match(/\/d\/([a-zA-Z0-9_-]+)/);
          if (mImg && mImg[1]) {
            var driveLink = 'https://drive.google.com/file/d/' + mImg[1] + '/view?usp=sharing';
            sheet.getRange(rowIndex, mapping.colImage).setValue(driveLink);
            repairedCount++;
          }
        }
      }
    }
  }

  bumpSyncVersion();
  ss.toast('Successfully repaired ' + repairedCount + ' request row(s) in FMS sheet!', 'Repair Complete', 5);
  return { success: true, repairedCount: repairedCount };
}

/**
 * Helper to update a row in FMS Sheet safely
 */
function updateRequestRow(requestId, updateFn) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = getRequestsSheet(ss);
  if (!sheet) {
    throw new Error('Requests sheet (FMS) not found');
  }

  var mapping = findHeaderMapping(sheet);
  var lastRow = sheet.getLastRow();
  if (lastRow < mapping.dataStartRow) {
    throw new Error('No data rows found in sheet');
  }

  var numRows = lastRow - mapping.dataStartRow + 1;
  var maxCols = Math.max(sheet.getLastColumn(), mapping.colMeta || 15);
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

  if (foundIndex === -1) {
    throw new Error('Request with ID or No "' + requestId + '" not found in sheet.');
  }

  var actualRowNumber = mapping.dataStartRow + foundIndex;
  var metaObj = mapping.colMeta && mapping.colMeta <= matchedRow.length ? parseJsonSafely(matchedRow[mapping.colMeta - 1], {}) : {};

  var rowObj = {
    requestNo: String(matchedRow[mapping.colRequestNo - 1] || ''),
    currentRevisionNo: metaObj.currentRevisionNo || null,
    upgradeTargetDate: metaObj.upgradeTargetDate || (mapping.colUpgradeTargetDate && mapping.colUpgradeTargetDate <= matchedRow.length ? formatDateCell(matchedRow[mapping.colUpgradeTargetDate - 1]) : null),
    companyName: String(matchedRow[mapping.colCompany - 1] || ''),
    systemName: String(matchedRow[mapping.colSystemName - 1] || ''),
    businessPurpose: String(matchedRow[mapping.colSummary - 1] || ''),
    assignedDeveloper: String(matchedRow[mapping.colDeveloper - 1] || ''),
    targetCompletionDate: formatDateCell(matchedRow[mapping.colTargetDate - 1]),
    systemUrl: metaObj.systemUrl || (mapping.colSystemLink && mapping.colSystemLink <= matchedRow.length ? String(matchedRow[mapping.colSystemLink - 1] || '') : ''),
    adminId: metaObj.adminId || (mapping.colAdminId && mapping.colAdminId <= matchedRow.length ? String(matchedRow[mapping.colAdminId - 1] || '') : ''),
    adminPassword: metaObj.adminPassword || (mapping.colAdminPassword && mapping.colAdminPassword <= matchedRow.length ? String(matchedRow[mapping.colAdminPassword - 1] || '') : ''),
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
    id: metaObj.id || ('req-' + matchedRow[mapping.colRequestNo - 1])
  };

  var updated = updateFn(rowObj);

  // Write updated human-readable values to FMS columns (Never touching Planned or Delay formula columns)
  // CRITICAL: Col G (Target Date) is the original baseline date and is NEVER overwritten when updating development!
  var existingTargetDateVal = matchedRow[mapping.colTargetDate - 1];
  if (!existingTargetDateVal && updated.targetCompletionDate) {
    safeSetCellValue(sheet, actualRowNumber, mapping.colTargetDate, updated.targetCompletionDate, mapping);
  }

  // 1. Introduce System Step: Write Actual timestamp, Meeting Date, Remarks, Work Status, Final Status
  if (updated.introduction && updated.introduction.isCompleted) {
    if (mapping.colActual) {
      safeSetCellValue(sheet, actualRowNumber, mapping.colActual, new Date(), mapping);
    }
    if (mapping.colMeetingDate && updated.introduction.meetingDate) {
      safeSetCellValue(sheet, actualRowNumber, mapping.colMeetingDate, updated.introduction.meetingDate, mapping);
    }
    if (mapping.colDiscussionRemarks && updated.introduction.remarks) {
      safeSetCellValue(sheet, actualRowNumber, mapping.colDiscussionRemarks, updated.introduction.remarks, mapping);
    }
    if (mapping.colFinalStatus) {
      safeSetCellValue(sheet, actualRowNumber, mapping.colFinalStatus, 'In Progress', mapping);
    }
  }

  // 2. Create System & Revise System Step: Work Status, Reason for Hold (Col R), Hold Extend Target Date (Col S), and Completion Timestamps
  if (updated.workStatus) {
    if (mapping.colWorkStatus) {
      safeSetCellValue(sheet, actualRowNumber, mapping.colWorkStatus, updated.workStatus, mapping);
    }
    if (updated.workStatus === 'On Hold') {
      if (mapping.colReasonForHold) {
        safeSetCellValue(sheet, actualRowNumber, mapping.colReasonForHold, updated.holdReason || updated.latestRemarks || 'On Hold', mapping);
      }
      if (mapping.colHoldExtendTargetDate && updated.holdExtendTargetDate) {
        safeSetCellValue(sheet, actualRowNumber, mapping.colHoldExtendTargetDate, updated.holdExtendTargetDate, mapping);
      }
    } else if (updated.workStatus === 'Completed') {
      if (mapping.colReasonForHold) {
        safeSetCellValue(sheet, actualRowNumber, mapping.colReasonForHold, '', mapping);
      }
      if (mapping.colHoldExtendTargetDate) {
        safeSetCellValue(sheet, actualRowNumber, mapping.colHoldExtendTargetDate, '', mapping);
      }
      // If this completion is in Revise System:
      if (updated.currentRevisionNo) {
        if (mapping.colRevisionNo) {
          safeSetCellValue(sheet, actualRowNumber, mapping.colRevisionNo, updated.currentRevisionNo, mapping);
        }
        if (mapping.colActual3) {
          safeSetCellValue(sheet, actualRowNumber, mapping.colActual3, new Date(), mapping);
        }
      } else {
        // Initial Create System completion:
        if (mapping.colActual1) {
          safeSetCellValue(sheet, actualRowNumber, mapping.colActual1, new Date(), mapping);
        }
      }
    }
  }

  // 2b. Write System Link & Admin Credentials if columns exist
  if (updated.systemUrl && mapping.colSystemLink) {
    safeSetCellValue(sheet, actualRowNumber, mapping.colSystemLink, updated.systemUrl, mapping);
  }
  if (updated.adminId && mapping.colAdminId) {
    safeSetCellValue(sheet, actualRowNumber, mapping.colAdminId, updated.adminId, mapping);
  }
  if (updated.adminPassword && mapping.colAdminPassword) {
    safeSetCellValue(sheet, actualRowNumber, mapping.colAdminPassword, updated.adminPassword, mapping);
  }

  // 3. Testing System Step: Write Actual 2 timestamp, Decision, Defects / Remarks, and Revision No if Rejected
  if (updated.testingHistory && updated.testingHistory.length > 0) {
    var latestTest = updated.testingHistory[updated.testingHistory.length - 1];
    if (mapping.colActual2) {
      safeSetCellValue(sheet, actualRowNumber, mapping.colActual2, new Date(), mapping);
    }
    if (mapping.colDecision && latestTest.decision) {
      safeSetCellValue(sheet, actualRowNumber, mapping.colDecision, latestTest.decision, mapping);
    }
    if (mapping.colTestRemarks && latestTest.remarks) {
      safeSetCellValue(sheet, actualRowNumber, mapping.colTestRemarks, latestTest.remarks, mapping);
    }
    if (latestTest.decision === 'Rejected') {
      var revVal = latestTest.generatedRevisionNo || updated.currentRevisionNo || '';
      if (revVal) {
        var mRev = String(revVal).match(/REV-?\d+/i);
        if (mRev) {
          var nRev = mRev[0].match(/\d+/);
          if (nRev) revVal = 'REV-' + ('0' + parseInt(nRev[0], 10)).slice(-2);
        }
      }
      if (mapping.colRevisionNo) {
        safeSetCellValue(sheet, actualRowNumber, mapping.colRevisionNo, revVal, mapping);
      }
      var targetUpgradeDate = updated.upgradeTargetDate || latestTest.upgradeTargetDate || latestTest.extendedTargetDate || null;
      if (mapping.colUpgradeTargetDate && targetUpgradeDate) {
        safeSetCellValue(sheet, actualRowNumber, mapping.colUpgradeTargetDate, targetUpgradeDate, mapping);
      }
      if (mapping.colWorkStatus) {
        safeSetCellValue(sheet, actualRowNumber, mapping.colWorkStatus, 'Revision In Progress', mapping);
      }
    } else if (latestTest.decision === 'Approved') {
      if (mapping.colWorkStatus) {
        safeSetCellValue(sheet, actualRowNumber, mapping.colWorkStatus, 'Testing Approved', mapping);
      }
    }
  }

  // 4. Revise System explicit check: Ensure Revision No (strictly REV-01) and Upgrade Target Date are synced if set
  if (updated.currentRevisionNo && mapping.colRevisionNo) {
    var pureRev = updated.currentRevisionNo;
    var m = String(pureRev).match(/REV-?\d+/i);
    if (m) {
      var n = m[0].match(/\d+/);
      if (n) pureRev = 'REV-' + ('0' + parseInt(n[0], 10)).slice(-2);
    }
    safeSetCellValue(sheet, actualRowNumber, mapping.colRevisionNo, pureRev, mapping);
  }
  if (updated.upgradeTargetDate && mapping.colUpgradeTargetDate) {
    safeSetCellValue(sheet, actualRowNumber, mapping.colUpgradeTargetDate, updated.upgradeTargetDate, mapping);
  }

  // 5. Update MIS System Step: Write Actual 4 timestamp, Final Status Closed, Work Status Closed
  if (updated.misUpdate && updated.misUpdate.isCompleted) {
    if (mapping.colActual4) {
      safeSetCellValue(sheet, actualRowNumber, mapping.colActual4, new Date(), mapping);
    }
    if (mapping.colFinalStatus) {
      safeSetCellValue(sheet, actualRowNumber, mapping.colFinalStatus, 'Closed', mapping);
    }
    if (mapping.colWorkStatus) {
      safeSetCellValue(sheet, actualRowNumber, mapping.colWorkStatus, 'Closed', mapping);
    }
  }

  // Update metadata JSON (Protected against 50,000 char cell overflow)
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
 * Helper to get the Master sheet safely
 */
function getMasterSheet(ss) {
  var sheetNames = ['Master', 'master', 'Master ', 'Master_Data', 'Master Data'];
  for (var i = 0; i < sheetNames.length; i++) {
    var sh = ss.getSheetByName(sheetNames[i]);
    if (sh) return sh;
  }
  var all = ss.getSheets();
  for (var j = 0; j < all.length; j++) {
    var name = all[j].getName().trim().toLowerCase();
    if (name === 'master' || name === 'master_data' || name === 'master data') {
      return all[j];
    }
  }
  return null;
}

/**
 * Fetch master options:
 * - Master Sheet Col A (Firm Name) -> Company name
 * - Master Sheet Col B (DME) -> Assigned Developer
 */
function fetchMasterOptions() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var masterSheet = getMasterSheet(ss);

  var companies = [];
  var developers = [];

  // 1. Fetch from Master sheet (Row 2 onwards: Col A = Firm Name / Company, Col B = DME / Assigned Developer)
  if (masterSheet && masterSheet.getLastRow() >= 2) {
    var numRows = masterSheet.getLastRow() - 1;
    var values = masterSheet.getRange(2, 1, numRows, 2).getValues();
    for (var i = 0; i < values.length; i++) {
      var firm = values[i][0] ? String(values[i][0]).trim() : '';
      var dme = values[i][1] ? String(values[i][1]).trim() : '';
      if (firm && companies.indexOf(firm) === -1) {
        companies.push(firm);
      }
      if (dme && developers.indexOf(dme) === -1) {
        developers.push(dme);
      }
    }
  }

  // 2. If companies list is empty, fallback to FMS sheet Column C or DEFAULT_COMPANIES
  if (companies.length === 0) {
    var fmsSheet = getRequestsSheet(ss);
    if (fmsSheet) {
      var mapping = findHeaderMapping(fmsSheet);
      var lastRow = fmsSheet.getLastRow();
      if (lastRow >= mapping.dataStartRow) {
        var numRowsFms = lastRow - mapping.dataStartRow + 1;
        var fmsVals = fmsSheet.getRange(mapping.dataStartRow, mapping.colCompany, numRowsFms, 1).getValues();
        for (var j = 0; j < fmsVals.length; j++) {
          var comp = String(fmsVals[j][0] || '').trim();
          if (comp && companies.indexOf(comp) === -1) companies.push(comp);
        }
      }
    }
    for (var k = 0; k < DEFAULT_COMPANIES.length; k++) {
      if (companies.indexOf(DEFAULT_COMPANIES[k]) === -1) companies.push(DEFAULT_COMPANIES[k]);
    }
  }

  // 3. If developers list is empty, fallback to FMS sheet Column F or DEFAULT_DEVELOPERS
  if (developers.length === 0) {
    var fmsSheetDev = getRequestsSheet(ss);
    if (fmsSheetDev) {
      var mapDev = findHeaderMapping(fmsSheetDev);
      var lastRowDev = fmsSheetDev.getLastRow();
      if (lastRowDev >= mapDev.dataStartRow) {
        var numRowsDev = lastRowDev - mapDev.dataStartRow + 1;
        var devVals = fmsSheetDev.getRange(mapDev.dataStartRow, mapDev.colDeveloper, numRowsDev, 1).getValues();
        for (var m = 0; m < devVals.length; m++) {
          var dev = String(devVals[m][0] || '').trim();
          if (dev && developers.indexOf(dev) === -1) developers.push(dev);
        }
      }
    }
    for (var d = 0; d < DEFAULT_DEVELOPERS.length; d++) {
      if (developers.indexOf(DEFAULT_DEVELOPERS[d]) === -1) developers.push(DEFAULT_DEVELOPERS[d]);
    }
  }

  return {
    companies: companies,
    developers: developers
  };
}

/**
 * Setup / Initialize Sheets structure
 */
function setupInitialSheets() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  var fmsSheet = ss.getSheetByName(SHEET_FMS);
  if (!fmsSheet) {
    fmsSheet = ss.insertSheet(SHEET_FMS);
  }

  // If row 6 has no headers, set standard headers
  var curA6 = fmsSheet.getRange(6, 1).getValue();
  if (!curA6) {
    fmsSheet.getRange(6, 1, 1, FMS_HEADERS.length).setValues([FMS_HEADERS]);
    fmsSheet.getRange(6, 1, 1, FMS_HEADERS.length).setFontWeight('bold').setBackground('#0284c7').setFontColor('#ffffff');
    fmsSheet.setFrozenRows(6);
  }

  bumpSyncVersion();

  return {
    success: true,
    message: 'Google Sheets FMS table initialized successfully.'
  };
}

/**
 * Trigger called on any manual edit in Google Sheets
 */
function onEdit(e) {
  try {
    bumpSyncVersion();
  } catch (err) {
    // Ignore trigger errors
  }
}

/**
 * Compute real-time MD5 fingerprint of all visible operational cells in FMS Sheet
 */
function getSheetChangeFingerprint() {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = getRequestsSheet(ss);
    if (!sheet) return '0';
    var lastRow = sheet.getLastRow();
    var mapping = findHeaderMapping(sheet);
    if (lastRow < mapping.dataStartRow) return '0';

    var numRows = lastRow - mapping.dataStartRow + 1;
    var maxCol = Math.max(sheet.getLastColumn(), 37);
    var values = sheet.getRange(mapping.dataStartRow, 1, numRows, maxCol).getValues();

    var rawParts = [];
    for (var i = 0; i < values.length; i++) {
      var r = values[i];
      var reqNo = String(r[mapping.colRequestNo - 1] || '').trim();
      if (!reqNo) continue;
      var wStatus = mapping.colWorkStatus && mapping.colWorkStatus <= r.length ? String(r[mapping.colWorkStatus - 1] || '').trim() : '';
      var act = mapping.colActual && mapping.colActual <= r.length ? String(r[mapping.colActual - 1] || '').trim() : '';
      var mDate = mapping.colMeetingDate && mapping.colMeetingDate <= r.length ? String(r[mapping.colMeetingDate - 1] || '').trim() : '';
      var act1 = mapping.colActual1 && mapping.colActual1 <= r.length ? String(r[mapping.colActual1 - 1] || '').trim() : '';
      var sLink = mapping.colSystemLink && mapping.colSystemLink <= r.length ? String(r[mapping.colSystemLink - 1] || '').trim() : '';
      var admId = mapping.colAdminId && mapping.colAdminId <= r.length ? String(r[mapping.colAdminId - 1] || '').trim() : '';
      var admPass = mapping.colAdminPassword && mapping.colAdminPassword <= r.length ? String(r[mapping.colAdminPassword - 1] || '').trim() : '';
      var hReason = mapping.colReasonForHold && mapping.colReasonForHold <= r.length ? String(r[mapping.colReasonForHold - 1] || '').trim() : '';
      var hDate = mapping.colHoldExtendTargetDate && mapping.colHoldExtendTargetDate <= r.length ? String(r[mapping.colHoldExtendTargetDate - 1] || '').trim() : '';
      var act2 = mapping.colActual2 && mapping.colActual2 <= r.length ? String(r[mapping.colActual2 - 1] || '').trim() : '';
      var dec = mapping.colDecision && mapping.colDecision <= r.length ? String(r[mapping.colDecision - 1] || '').trim() : '';
      var rev = mapping.colRevisionNo && mapping.colRevisionNo <= r.length ? String(r[mapping.colRevisionNo - 1] || '').trim() : '';
      var upgDate = mapping.colUpgradeTargetDate && mapping.colUpgradeTargetDate <= r.length ? String(r[mapping.colUpgradeTargetDate - 1] || '').trim() : '';
      var act3 = mapping.colActual3 && mapping.colActual3 <= r.length ? String(r[mapping.colActual3 - 1] || '').trim() : '';
      var act4 = mapping.colActual4 && mapping.colActual4 <= r.length ? String(r[mapping.colActual4 - 1] || '').trim() : '';
      var fStat = mapping.colFinalStatus && mapping.colFinalStatus <= r.length ? String(r[mapping.colFinalStatus - 1] || '').trim() : '';

      rawParts.push([reqNo, wStatus, act, mDate, act1, sLink, admId, admPass, hReason, hDate, act2, dec, rev, upgDate, act3, act4, fStat].join('~'));
    }

    var fingerprintStr = rawParts.join(';;');
    return Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, fingerprintStr));
  } catch (e) {
    return '0';
  }
}

/**
 * Helpers for sync version and timestamps
 */
function getSyncVersion() {
  var props = PropertiesService.getScriptProperties();
  var v = props.getProperty(PROP_SYNC_VERSION) || '1';
  var fp = getSheetChangeFingerprint();
  return v + '_' + fp;
}

function bumpSyncVersion() {
  var props = PropertiesService.getScriptProperties();
  var v = String(new Date().getTime());
  props.setProperty(PROP_SYNC_VERSION, v);
  props.setProperty(PROP_LAST_UPDATED, new Date().toISOString());
  return v;
}

function jsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function parseJsonSafely(str, fallback) {
  if (!str) return fallback;
  try {
    return JSON.parse(str);
  } catch (e) {
    return fallback;
  }
}

function formatDateCell(cellValue) {
  if (!cellValue) return '';
  if (cellValue instanceof Date) {
    var tz = Session.getScriptTimeZone() || 'Asia/Kolkata';
    return Utilities.formatDate(cellValue, tz, 'yyyy-MM-dd');
  }
  return String(cellValue);
}

function formatTimestampCell(cellValue) {
  if (!cellValue) return '';
  if (cellValue instanceof Date) {
    var tz = Session.getScriptTimeZone() || 'Asia/Kolkata';
    return Utilities.formatDate(cellValue, tz, 'MM/dd/yyyy HH:mm:ss');
  }
  return String(cellValue);
}

function buildDevelopmentHistoryFromRow(req) {
  if (req.activityLog && req.activityLog.length > 0) {
    return req.activityLog
      .filter(function(a) { return a.action.indexOf('Development') !== -1 || a.action.indexOf('Hold') !== -1; })
      .map(function(a, idx) {
        return {
          cycleNumber: idx + 1,
          revisionNo: req.currentRevisionNo,
          status: req.workStatus,
          progressPercent: req.progressPercent,
          remarks: a.details,
          updatedAt: a.timestamp,
          updatedBy: a.actor
        };
      });
  }
  return [];
}

/**
 * ======================================================================================
 * LOGIN PAGE & USER AUTHENTICATION SHEET HANDLERS (2-WAY SYNC)
 * ======================================================================================
 */

/**
 * Get or create "Login Page" Sheet
 */
function getLoginSheet(ss) {
  ss = ss || SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_LOGIN);
  if (sheet) return sheet;

  // Search case-insensitively
  var allSheets = ss.getSheets();
  for (var i = 0; i < allSheets.length; i++) {
    var sName = allSheets[i].getName().trim().toLowerCase();
    if (sName === 'login page' || sName === 'login' || sName === 'users') {
      return allSheets[i];
    }
  }

  // Create new sheet if missing
  sheet = ss.insertSheet(SHEET_LOGIN);
  sheet.getRange(1, 1, 1, LOGIN_HEADERS.length).setValues([LOGIN_HEADERS]);
  sheet.getRange(1, 1, 1, LOGIN_HEADERS.length).setFontWeight('bold');
  return sheet;
}

/**
 * Default Seed Users to populate sheet if currently empty
 */
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

/**
 * Fetch all users from "Login Page" Sheet
 */
function fetchAllUsers() {
  var sheet = getLoginSheet();
  var lastRow = sheet.getLastRow();

  // If sheet is empty or only has header row, populate with initial users
  if (lastRow <= 1) {
    var seeds = getInitialSeedUsers();
    handleSaveUsers(seeds);
    return seeds;
  }

  var lastCol = Math.max(sheet.getLastColumn(), 8);
  var headerValues = sheet.getRange(1, 1, 1, lastCol).getValues()[0];

  // Dynamic header mapping
  var colMap = {
    fullName: 0,       // Col A
    username: 1,       // Col B
    role: 2,           // Col C
    password: 3,       // Col D
    status: 4,         // Col E
    department: 5,     // Col F
    created: 6,        // Col G
    permittedStages: 7 // Col H
  };

  for (var c = 0; c < headerValues.length; c++) {
    var h = String(headerValues[c] || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
    if (h === 'fullname' || h === 'name') colMap.fullName = c;
    else if (h === 'user' || h === 'username') colMap.username = c;
    else if (h === 'role') colMap.role = c;
    else if (h === 'password' || h === 'pass') colMap.password = c;
    else if (h === 'status') colMap.status = c;
    else if (h === 'department' || h === 'dept') colMap.department = c;
    else if (h === 'created' || h === 'date') colMap.created = c;
    else if (h === 'permittedstages' || h === 'stages' || h === 'permitted') colMap.permittedStages = c;
  }

  var values = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
  var users = [];
  var needsAutoAlign = false;

  for (var i = 0; i < values.length; i++) {
    var row = values[i];
    var rawFullName = String(row[colMap.fullName] || '').trim();
    var rawUsername = String(row[colMap.username] || '').trim();

    // Check if sheet row is missing Full Name in Col A, or has combined string in Col B
    if (!rawFullName || rawUsername.indexOf('(') !== -1 || rawUsername.indexOf('@') !== -1) {
      needsAutoAlign = true;
    }

    var extractedName = rawFullName;
    var extractedUser = rawUsername;

    // Extract if username cell has format "Full Name (@username)"
    var userParenMatch = rawUsername.match(/^(.*?)\s*\(+@?([^\)]+)\)+/);
    if (userParenMatch) {
      if (!extractedName) extractedName = userParenMatch[1].trim();
      extractedUser = userParenMatch[2].trim();
    }

    // Extract if fullName cell has format "Full Name (@username)"
    var nameParenMatch = rawFullName.match(/^(.*?)\s*\(+@?([^\)]+)\)+/);
    if (nameParenMatch) {
      extractedName = nameParenMatch[1].trim();
      if (!extractedUser || extractedUser === rawFullName) {
        extractedUser = nameParenMatch[2].trim();
      }
    }

    // Clean pure username: no @, no parens, no whitespace, lowercase
    var cleanUsername = String(extractedUser || '')
      .replace(/^@+/, '')
      .replace(/[\(\)]/g, '')
      .replace(/\s+/g, '')
      .toLowerCase();

    // Clean pure full name: Name only, no username or parens
    var cleanFullName = String(extractedName || cleanUsername)
      .replace(/\s*\(+@?.*?\)+/g, '')
      .replace(/^@+/, '')
      .trim();

    if (!cleanFullName) cleanFullName = cleanUsername;
    if (!cleanUsername) cleanUsername = cleanFullName.toLowerCase().replace(/[^a-z0-9_.-]/g, '');

    // Skip empty row
    if (!cleanUsername && !cleanFullName) continue;

    var role = String(row[colMap.role] || 'USER').trim().toUpperCase() === 'ADMIN' ? 'Admin' : 'User';
    var rawStatus = String(row[colMap.status] || 'ACTIVE').trim().toUpperCase();
    var status = (rawStatus === 'INACTIVE' || rawStatus === 'DISABLED') ? 'Inactive' : 'Active';
    var password = String(row[colMap.password] || 'password123').trim() || 'password123';
    var department = String(row[colMap.department] || 'General').trim();
    var createdRaw = row[colMap.created];
    var permittedStagesText = String(row[colMap.permittedStages] || '').trim();

    // Parse stage permissions
    var permissions = {};
    var stageList = ['requests', 'introduce', 'create', 'revise', 'testing', 'mis'];
    var lowerText = permittedStagesText.toLowerCase();

    if (role === 'Admin' || lowerText.indexOf('all stages') !== -1 || lowerText.indexOf('full access') !== -1) {
      for (var s = 0; s < stageList.length; s++) {
        permissions[stageList[s]] = { view: true, edit: (role === 'Admin'), approve: (role === 'Admin') };
      }
    } else {
      for (var s = 0; s < stageList.length; s++) {
        var sid = stageList[s];
        var isPermitted = false;
        if (sid === 'requests' && lowerText.indexOf('request') !== -1) isPermitted = true;
        if (sid === 'introduce' && lowerText.indexOf('introduce') !== -1) isPermitted = true;
        if (sid === 'create' && lowerText.indexOf('create') !== -1) isPermitted = true;
        if (sid === 'revise' && lowerText.indexOf('revise') !== -1) isPermitted = true;
        if (sid === 'testing' && (lowerText.indexOf('test') !== -1 || lowerText.indexOf('qa') !== -1)) isPermitted = true;
        if (sid === 'mis' && lowerText.indexOf('mis') !== -1) isPermitted = true;

        permissions[sid] = { view: isPermitted, edit: false, approve: false };
      }
      var hasAny = false;
      for (var k in permissions) { if (permissions[k].view) hasAny = true; }
      if (!hasAny) {
        permissions.requests = { view: true, edit: false, approve: false };
      }
    }

    var createdAtISO = '';
    if (createdRaw instanceof Date) {
      createdAtISO = createdRaw.toISOString();
    } else if (createdRaw) {
      createdAtISO = String(createdRaw);
    } else {
      createdAtISO = new Date().toISOString();
    }

    users.push({
      id: 'usr-sheet-' + cleanUsername,
      username: cleanUsername,
      fullName: cleanFullName,
      role: role,
      status: status,
      permittedStagesText: permittedStagesText || (role === 'Admin' ? 'All Stages (Admin Full Access)' : '1 of 6 Stages (View)'),
      permissions: permissions,
      department: department,
      createdAt: createdAtISO,
      password: password
    });
  }

  // Auto-align sheet in place if columns were missing or had combined values
  if (needsAutoAlign && users.length > 0) {
    try {
      handleSaveUsers(users);
    } catch (alignErr) {
      Logger.log('Auto-align sheet warning: ' + alignErr);
    }
  }

  return users;
}

/**
 * Save / Overwrite full list of users to "Login Page" Sheet
 * Format:
 * Col A: Full Name (Name bas aana chahiye - e.g. "System Administrator", "Ahitesh Tandon")
 * Col B: User (Username only - e.g. "admin", "ahitesh")
 * Col C: Role (ADMIN / USER)
 * Col D: Password (e.g. "password123")
 * Col E: Status (ACTIVE / INACTIVE)
 * Col F: Department (e.g. "IT & Infrastructure")
 * Col G: Created (e.g. "01 Oct 2026, 2:30 PM")
 * Col H: Permitted Stages (e.g. "All Stages (Admin Full Access)", "3 of 6 Stages (Requests, Create, Revise)")
 */
function handleSaveUsers(users) {
  if (!Array.isArray(users)) users = [];
  var sheet = getLoginSheet();

  var rowData = users.map(function(u) {
    var roleStr = (u.role || 'User').toUpperCase() === 'ADMIN' ? 'ADMIN' : 'USER';
    var statusStr = (u.status || 'Active').toUpperCase() === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE';

    var permText = '';
    if (roleStr === 'ADMIN') {
      permText = 'All Stages (Admin Full Access)';
    } else {
      var perms = u.permissions || {};
      var stageShortNames = [];
      if (perms.requests && perms.requests.view) stageShortNames.push('Requests');
      if (perms.introduce && perms.introduce.view) stageShortNames.push('Introduce');
      if (perms.create && perms.create.view) stageShortNames.push('Create');
      if (perms.revise && perms.revise.view) stageShortNames.push('Revise');
      if (perms.testing && perms.testing.view) stageShortNames.push('Testing');
      if (perms.mis && perms.mis.view) stageShortNames.push('MIS');

      if (stageShortNames.length === 6) {
        permText = 'All Stages (Admin Full Access)';
      } else if (stageShortNames.length === 0) {
        permText = '0 of 6 Stages (None)';
      } else {
        permText = stageShortNames.length + ' of 6 Stages (' + stageShortNames.join(', ') + ')';
      }
    }

    var createdDisplay = '';
    try {
      var d = u.createdAt ? new Date(u.createdAt) : new Date();
      createdDisplay = Utilities.formatDate(d, 'Asia/Kolkata', "dd MMM yyyy, h:mm a");
    } catch(e) {
      createdDisplay = String(u.createdAt || '');
    }

    // Clean username: Pure username ONLY (no @, no parens, no spaces)
    var cleanUser = String(u.username || '')
      .replace(/^@+/, '')
      .replace(/[\(\)]/g, '')
      .replace(/\s+/g, '')
      .trim()
      .toLowerCase();

    // Full Name: Pure Name ONLY (no username in parens, no @)
    var cleanName = String(u.fullName || '')
      .replace(/\s*\(+@?.*?\)+/g, '')
      .replace(/^@+/, '')
      .trim() || cleanUser;

    return [
      cleanName,                         // Col A: Full Name (Name bas)
      cleanUser,                         // Col B: User (Username only)
      roleStr,                           // Col C: Role (ADMIN / USER)
      u.password || 'password123',       // Col D: Password
      statusStr,                         // Col E: Status (ACTIVE / INACTIVE)
      u.department || 'General',         // Col F: Department
      createdDisplay,                    // Col G: Created
      permText                           // Col H: Permitted Stages
    ];
  });

  // Clear existing content below header
  var lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    sheet.getRange(2, 1, lastRow - 1, Math.max(sheet.getLastColumn(), 8)).clearContent();
  }

  // Ensure headers on Row 1
  sheet.getRange(1, 1, 1, LOGIN_HEADERS.length).setValues([LOGIN_HEADERS]);
  sheet.getRange(1, 1, 1, LOGIN_HEADERS.length).setFontWeight('bold');

  // Write new rows
  if (rowData.length > 0) {
    sheet.getRange(2, 1, rowData.length, rowData[0].length).setValues(rowData);
  }

  bumpSyncVersion();
  return { success: true, count: rowData.length, version: getSyncVersion() };
}

/**
 * One-click utility function to format & align the "Login Page" sheet.
 * Can be run from Apps Script editor (Select "formatLoginPageSheet" -> Run)
 * or from Google Sheets menu: "⚡ Make System" -> "🔄 Format & Align Login Page"
 */
function formatLoginPageSheet() {
  var users = fetchAllUsers();
  handleSaveUsers(users);
  SpreadsheetApp.getActiveSpreadsheet().toast('Login Page formatted successfully! Col A: Full Name, Col B: User', 'Make System', 5);
  return { success: true, count: users.length };
}

/**
 * Custom Menu inside Google Sheets
 */
function onOpen() {
  try {
    SpreadsheetApp.getUi()
      .createMenu('⚡ Make System')
      .addItem('🔑 Authorize Google Drive & Sheets', 'authorizeDriveAndSheets')
      .addItem('🔄 Format & Align Login Page', 'formatLoginPageSheet')
      .addItem('📋 Re-sync All Users', 'formatLoginPageSheet')
      .addToUi();
  } catch (err) {
    Logger.log('onOpen menu error: ' + err);
  }
}

/**
 * Create a new user in "Login Page" Sheet
 */
function handleCreateUser(userData) {
  var users = fetchAllUsers();
  var cleanUsername = String(userData.username || '').trim().toLowerCase();
  if (!cleanUsername) throw new Error('Username is required.');

  for (var i = 0; i < users.length; i++) {
    if (users[i].username === cleanUsername) {
      throw new Error('Username "' + cleanUsername + '" already exists in sheet.');
    }
  }

  var newUser = {
    id: userData.id || ('usr-sheet-' + cleanUsername),
    username: cleanUsername,
    fullName: userData.fullName ? userData.fullName.trim() : cleanUsername,
    role: (userData.role || 'User').toUpperCase() === 'ADMIN' ? 'Admin' : 'User',
    status: (userData.status || 'Active').toUpperCase() === 'INACTIVE' ? 'Inactive' : 'Active',
    department: userData.department ? userData.department.trim() : 'General',
    permissions: userData.permissions || {},
    createdAt: userData.createdAt || new Date().toISOString(),
    password: userData.password ? userData.password.trim() : 'password123'
  };

  users.push(newUser);
  handleSaveUsers(users);
  return newUser;
}

/**
 * Update an existing user in "Login Page" Sheet
 */
function handleUpdateUser(userId, userData) {
  var users = fetchAllUsers();
  var foundIndex = -1;
  var target = String(userData.username || userId || '').trim().toLowerCase();

  for (var i = 0; i < users.length; i++) {
    if (users[i].id === userId || users[i].username.toLowerCase() === target) {
      foundIndex = i;
      break;
    }
  }

  if (foundIndex === -1) {
    return handleCreateUser(userData);
  }

  var existing = users[foundIndex];
  var updated = {
    id: existing.id,
    username: userData.username ? String(userData.username).trim().toLowerCase() : existing.username,
    fullName: userData.fullName !== undefined ? userData.fullName.trim() : existing.fullName,
    role: userData.role !== undefined ? (String(userData.role).toUpperCase() === 'ADMIN' ? 'Admin' : 'User') : existing.role,
    status: userData.status !== undefined ? (String(userData.status).toUpperCase() === 'INACTIVE' ? 'Inactive' : 'Active') : existing.status,
    department: userData.department !== undefined ? String(userData.department).trim() : existing.department,
    permissions: userData.permissions !== undefined ? userData.permissions : existing.permissions,
    createdAt: existing.createdAt,
    password: userData.password ? String(userData.password).trim() : existing.password
  };

  users[foundIndex] = updated;
  handleSaveUsers(users);
  return updated;
}

/**
 * Delete a user from "Login Page" Sheet
 */
function handleDeleteUser(userIdOrUsername) {
  var users = fetchAllUsers();
  var target = String(userIdOrUsername || '').trim().toLowerCase();

  var filtered = users.filter(function(u) {
    return u.id !== userIdOrUsername && u.username.toLowerCase() !== target;
  });

  handleSaveUsers(filtered);
  return { success: true, remaining: filtered.length, version: getSyncVersion() };
}
