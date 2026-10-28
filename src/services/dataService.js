/**
 * Make System - Replaceable Data Service Layer
 * 
 * Provides unified interface for all lifecycle transitions and request persistence.
 * Supports:
 * 1. Live Google Sheets Mode (Two-Way Real-Time Sync via Google Apps Script Web App)
 * 2. Sample Local Mode (browser localStorage)
 */

import {
  STAGES,
  STAGE_STATUS,
  WORK_STATUS,
  TESTING_DECISION,
  CURRENT_USER,
  SAMPLE_COMPANIES,
  SAMPLE_DEVELOPERS
} from '../constants/stages';
import { getNowKolkataISO, formatToKolkataDateString } from '../utils/dateUtils';
import { normalizeSystemRequest as normalizeLegacyStage } from '../utils/systemWorkflow.mjs';
import {
  isGoogleSheetsConnected,
  getGoogleAppsScriptUrl,
  GOOGLE_SHEETS_CONFIG
} from '../config/integrationConfig';

const STORAGE_KEY_REQUESTS = 'make_system_requests_v1';
const STORAGE_KEY_MASTER = 'make_system_master_v1';
const STORAGE_KEY_SEQUENCE = 'make_system_sequence_v1';
const STORAGE_KEY_SYNC_VERSION = 'make_system_sync_version_v1';

// Internal memory cache for quick responsiveness
let cachedSyncVersion = (() => {
  try {
    return localStorage.getItem(STORAGE_KEY_SYNC_VERSION) || '0';
  } catch {
    return '0';
  }
})();

function saveSyncVersion(version) {
  if (!version) return;
  cachedSyncVersion = String(version);
  try {
    localStorage.setItem(STORAGE_KEY_SYNC_VERSION, cachedSyncVersion);
  } catch (e) {}
}

// Seed initial realistic demo data
function getInitialSampleData() {
  const now = new Date();
  const addDays = (n) => {
    const d = new Date(now);
    d.setDate(d.getDate() + n);
    return formatToKolkataDateString(d);
  };
  const subDays = (n) => {
    const d = new Date(now);
    d.setDate(d.getDate() - n);
    return formatToKolkataDateString(d);
  };

  return [
    {
      id: 'req-001',
      requestNo: 'SM-0001',
      companyName: 'Pmmpl',
      systemName: 'Automated Invoice Reconciliation System',
      systemRequirements: 'Automated Invoice Reconciliation System with three-way matching between PO, Delivery Challan, and Vendor Invoices.',
      businessPurpose: 'Eliminate manual reconciliation bottlenecks and prevent dual payment errors across manufacturing plants.',
      assignedDeveloper: 'Rahul Sharma (Senior Full-Stack Dev)',
      targetCompletionDate: subDays(2),
      currentStage: STAGES.CREATE,
      currentStatus: 'Development: On Hold',
      isOverdueFlag: true,
      workStatus: WORK_STATUS.ON_HOLD,
      progressPercent: 35,
      currentRevisionNo: null,
      latestRemarks: 'Awaiting firewall exception and database schema approval from corporate IT security team.',
      introduction: {
        isCompleted: true,
        meetingDate: subDays(10),
        remarks: 'Initial kickoff meeting conducted with finance and warehouse managers. Scope finalized.',
        completedAt: subDays(10) + 'T11:00:00.000Z',
        completedBy: 'Anil Kumar (Admin)'
      },
      developmentHistory: [
        {
          cycleNumber: 1,
          revisionNo: null,
          status: WORK_STATUS.IN_PROGRESS,
          progressPercent: 35,
          remarks: 'Database schema drafted and REST endpoints stubbed.',
          updatedAt: subDays(6) + 'T14:30:00.000Z',
          updatedBy: 'Rahul Sharma (Senior Full-Stack Dev)'
        },
        {
          cycleNumber: 1,
          revisionNo: null,
          status: WORK_STATUS.ON_HOLD,
          progressPercent: 35,
          remarks: 'Awaiting firewall exception and database schema approval from corporate IT security team.',
          holdReason: 'Awaiting firewall exception and database schema approval from corporate IT security team.',
          updatedAt: subDays(3) + 'T16:00:00.000Z',
          updatedBy: 'Rahul Sharma (Senior Full-Stack Dev)'
        }
      ],
      testingHistory: [],
      misUpdate: null,
      attachments: [
        {
          id: 'att-1',
          name: 'Invoice_Matching_Flowchart.pdf',
          size: 1420000,
          type: 'application/pdf',
          uploadedAt: subDays(12)
        }
      ],
      createdAt: subDays(12) + 'T09:30:00.000Z',
      createdBy: 'Anil Kumar (Admin)',
      lastUpdatedAt: subDays(3) + 'T16:00:00.000Z',
      activityLog: [
        {
          id: 'act-1',
          action: 'Request Created',
          actor: 'Anil Kumar (Admin)',
          timestamp: subDays(12) + 'T09:30:00.000Z',
          details: 'System Request SM-0001 submitted.'
        },
        {
          id: 'act-2',
          action: 'Introduction Approved',
          actor: 'Anil Kumar (Admin)',
          timestamp: subDays(10) + 'T11:00:00.000Z',
          details: 'Kickoff meeting completed. Moved to Create System.'
        },
        {
          id: 'act-3',
          action: 'Development Progress',
          actor: 'Rahul Sharma (Senior Full-Stack Dev)',
          timestamp: subDays(6) + 'T14:30:00.000Z',
          details: 'Progress updated to 35%.'
        },
        {
          id: 'act-4',
          action: 'Put On Hold',
          actor: 'Rahul Sharma (Senior Full-Stack Dev)',
          timestamp: subDays(3) + 'T16:00:00.000Z',
          details: 'Hold Reason: Awaiting firewall exception and database schema approval.'
        }
      ]
    },
    {
      id: 'req-002',
      requestNo: 'SM-0002',
      companyName: 'RKL',
      systemName: 'Vendor Portal & Dispatch Gatepass System',
      systemRequirements: 'Vendor Portal & Dispatch Gatepass System with OTP authentication and QR code generation for truck drivers.',
      businessPurpose: 'Digitize gate entry/exit logging to cut turnaround time and eliminate manual paperwork at factory gates.',
      assignedDeveloper: 'Priya Patel (React & Node Dev)',
      targetCompletionDate: addDays(1),
      currentStage: STAGES.CREATE,
      currentStatus: 'Development: In Progress',
      workStatus: WORK_STATUS.IN_PROGRESS,
      progressPercent: 70,
      currentRevisionNo: null,
      latestRemarks: 'QR scanner validation tested on Android tablets; integrating SMS notification gateway today.',
      introduction: {
        isCompleted: true,
        meetingDate: subDays(7),
        remarks: 'Discussed security gate hardware and thermal printer specs. Approved.',
        completedAt: subDays(7) + 'T10:00:00.000Z',
        completedBy: 'Anil Kumar (Admin)'
      },
      developmentHistory: [
        {
          cycleNumber: 1,
          revisionNo: null,
          status: WORK_STATUS.IN_PROGRESS,
          progressPercent: 30,
          remarks: 'Core portal screens and UI components completed.',
          updatedAt: subDays(4) + 'T11:15:00.000Z',
          updatedBy: 'Priya Patel (React & Node Dev)'
        },
        {
          cycleNumber: 1,
          revisionNo: null,
          status: WORK_STATUS.IN_PROGRESS,
          progressPercent: 70,
          remarks: 'QR scanner validation tested on Android tablets; integrating SMS notification gateway today.',
          updatedAt: subDays(1) + 'T17:40:00.000Z',
          updatedBy: 'Priya Patel (React & Node Dev)'
        }
      ],
      testingHistory: [],
      misUpdate: null,
      attachments: [],
      createdAt: subDays(8) + 'T10:15:00.000Z',
      createdBy: 'Anil Kumar (Admin)',
      lastUpdatedAt: subDays(1) + 'T17:40:00.000Z',
      activityLog: [
        {
          id: 'act-21',
          action: 'Request Created',
          actor: 'Anil Kumar (Admin)',
          timestamp: subDays(8) + 'T10:15:00.000Z',
          details: 'System Request SM-0002 created.'
        },
        {
          id: 'act-22',
          action: 'Introduction Approved',
          actor: 'Anil Kumar (Admin)',
          timestamp: subDays(7) + 'T10:00:00.000Z',
          details: 'Introduction completed. Moved to Create System.'
        },
        {
          id: 'act-23',
          action: 'Development Progress',
          actor: 'Priya Patel (React & Node Dev)',
          timestamp: subDays(1) + 'T17:40:00.000Z',
          details: 'Progress updated to 70%.'
        }
      ]
    },
    {
      id: 'req-003',
      requestNo: 'SM-0003',
      companyName: 'Purab',
      systemName: 'Warehouse Inventory Barcode Tracker',
      systemRequirements: 'Warehouse Inventory Barcode Tracker for multi-bin raw material scanning and bin replenishment alarms.',
      businessPurpose: 'Prevent stock-outs of critical refractories and reduce bin audit cycle time from 3 days to 4 hours.',
      assignedDeveloper: 'Amit Verma (Backend & DB Specialist)',
      targetCompletionDate: addDays(6),
      currentStage: STAGES.CREATE,
      currentStatus: 'Revise System (In Progress)',
      workStatus: WORK_STATUS.IN_PROGRESS,
      progressPercent: 20,
      currentRevisionNo: 'REV-01',
      upgradeTargetDate: addDays(4),
      latestRejectionReason: 'Barcode scanner API fails when scanning GS1-128 multi-field codes under dim lighting conditions; camera autofocus timeout occurs.',
      latestRemarks: 'Upgraded ZXing barcode decoding library and added high-contrast threshold filter for rugged warehouse scanners.',
      introduction: {
        isCompleted: true,
        meetingDate: subDays(14),
        remarks: 'Introduced with warehouse lead and logistics coordinator.',
        completedAt: subDays(14) + 'T15:00:00.000Z',
        completedBy: 'Anil Kumar (Admin)'
      },
      developmentHistory: [
        {
          cycleNumber: 1,
          revisionNo: null,
          status: WORK_STATUS.COMPLETED,
          progressPercent: 100,
          remarks: 'Initial development finished and submitted for QA.',
          updatedAt: subDays(5) + 'T18:00:00.000Z',
          updatedBy: 'Amit Verma (Backend & DB Specialist)'
        },
        {
          cycleNumber: 2,
          revisionNo: 'REV-01',
          status: WORK_STATUS.IN_PROGRESS,
          progressPercent: 20,
          remarks: 'Upgraded ZXing barcode decoding library and added high-contrast threshold filter for rugged warehouse scanners.',
          updatedAt: subDays(1) + 'T11:20:00.000Z',
          updatedBy: 'Amit Verma (Backend & DB Specialist)'
        }
      ],
      testingHistory: [
        {
          attemptNumber: 1,
          revisionNo: null,
          decision: TESTING_DECISION.REJECTED,
          remarks: 'Barcode scanner API fails when scanning GS1-128 multi-field codes under dim lighting conditions; camera autofocus timeout occurs.',
          testedBy: 'Quality Assurance Lead',
          testedAt: subDays(3) + 'T16:45:00.000Z',
          generatedRevisionNo: 'REV-01',
          upgradeTargetDate: addDays(4)
        }
      ],
      misUpdate: null,
      attachments: [],
      createdAt: subDays(15) + 'T08:45:00.000Z',
      createdBy: 'Anil Kumar (Admin)',
      lastUpdatedAt: subDays(1) + 'T11:20:00.000Z',
      activityLog: [
        {
          id: 'act-31',
          action: 'Request Created',
          actor: 'Anil Kumar (Admin)',
          timestamp: subDays(15) + 'T08:45:00.000Z',
          details: 'System Request SM-0003 created.'
        },
        {
          id: 'act-32',
          action: 'Introduction Approved',
          actor: 'Anil Kumar (Admin)',
          timestamp: subDays(14) + 'T15:00:00.000Z',
          details: 'Introduction completed.'
        },
        {
          id: 'act-33',
          action: 'Development Completed',
          actor: 'Amit Verma (Backend & DB Specialist)',
          timestamp: subDays(5) + 'T18:00:00.000Z',
          details: 'Initial cycle completed (100%). Sent to Testing System.'
        },
        {
          id: 'act-34',
          action: 'Testing Rejected (Revise System)',
          actor: 'Quality Assurance Lead',
          timestamp: subDays(3) + 'T16:45:00.000Z',
          details: 'Rejected with remarks. Generated Revision REV-01 and transferred to Revise System.'
        },
        {
          id: 'act-35',
          action: 'Development Progress',
          actor: 'Amit Verma (Backend & DB Specialist)',
          timestamp: subDays(1) + 'T11:20:00.000Z',
          details: 'Revision 1 progress updated to 20%.'
        }
      ]
    },
    {
      id: 'req-004',
      requestNo: 'SM-0004',
      companyName: 'Refrasynth',
      systemName: 'Raw Material Quality Testing (QC) Module',
      systemRequirements: 'Raw Material Quality Testing (QC) Module for lab chemical assays, moisture percentage logging, and certificate generation.',
      businessPurpose: 'Standardize QC batch release criteria and prevent defective mineral batches from entering production kilns.',
      assignedDeveloper: 'Sneha Iyer (Frontend & UI Engineer)',
      targetCompletionDate: addDays(12),
      currentStage: STAGES.INTRODUCE,
      currentStatus: 'Introduce: Pending',
      workStatus: null,
      progressPercent: 0,
      currentRevisionNo: null,
      latestRemarks: 'Awaiting formal introduction meeting with Lab Chemist and Quality GM.',
      introduction: {
        isCompleted: false,
        meetingDate: null,
        remarks: null,
        completedAt: null,
        completedBy: null
      },
      developmentHistory: [],
      testingHistory: [],
      misUpdate: null,
      attachments: [],
      createdAt: subDays(1) + 'T09:00:00.000Z',
      createdBy: 'Anil Kumar (Admin)',
      lastUpdatedAt: subDays(1) + 'T09:00:00.000Z',
      activityLog: [
        {
          id: 'act-41',
          action: 'Request Created',
          actor: 'Anil Kumar (Admin)',
          timestamp: subDays(1) + 'T09:00:00.000Z',
          details: 'System Request SM-0004 submitted. Ready for Introduce System.'
        }
      ]
    },
    {
      id: 'req-005',
      requestNo: 'SM-0005',
      companyName: 'Refratech',
      systemName: 'Daily Production Log & Kiln Temperature Monitor',
      systemRequirements: 'Daily Production Log & Kiln Temperature Monitor with real-time SCADA sensor sync and anomaly warnings.',
      businessPurpose: 'Track furnace temperature fluctuations to reduce fuel consumption and safeguard brick lining life.',
      assignedDeveloper: 'Vikram Malhotra (Full-Stack Engineer)',
      targetCompletionDate: addDays(3),
      currentStage: STAGES.TESTING,
      currentStatus: 'Testing: Pending',
      workStatus: WORK_STATUS.COMPLETED,
      progressPercent: 100,
      currentRevisionNo: null,
      latestRemarks: 'Development completed. Deployed to staging environment for UAT and load testing.',
      developmentCompletedAt: subDays(1) + 'T16:20:00.000Z',
      introduction: {
        isCompleted: true,
        meetingDate: subDays(12),
        remarks: 'Discussed SCADA OPC-UA integration protocols and alarm thresholds.',
        completedAt: subDays(12) + 'T14:00:00.000Z',
        completedBy: 'Anil Kumar (Admin)'
      },
      developmentHistory: [
        {
          cycleNumber: 1,
          revisionNo: null,
          status: WORK_STATUS.COMPLETED,
          progressPercent: 100,
          remarks: 'All charting and OPC-UA socket listeners built and verified on test feed.',
          updatedAt: subDays(1) + 'T16:20:00.000Z',
          updatedBy: 'Vikram Malhotra (Full-Stack Engineer)'
        }
      ],
      testingHistory: [],
      misUpdate: null,
      attachments: [],
      createdAt: subDays(13) + 'T11:00:00.000Z',
      createdBy: 'Anil Kumar (Admin)',
      lastUpdatedAt: subDays(1) + 'T16:20:00.000Z',
      activityLog: [
        {
          id: 'act-51',
          action: 'Request Created',
          actor: 'Anil Kumar (Admin)',
          timestamp: subDays(13) + 'T11:00:00.000Z',
          details: 'System Request SM-0005 submitted.'
        },
        {
          id: 'act-52',
          action: 'Introduction Approved',
          actor: 'Anil Kumar (Admin)',
          timestamp: subDays(12) + 'T14:00:00.000Z',
          details: 'Introduction completed.'
        },
        {
          id: 'act-53',
          action: 'Development Completed',
          actor: 'Vikram Malhotra (Full-Stack Engineer)',
          timestamp: subDays(1) + 'T16:20:00.000Z',
          details: 'Development finished (100%). Sent to Testing System.'
        }
      ]
    },
    {
      id: 'req-006',
      requestNo: 'SM-0006',
      companyName: 'Pmmpl',
      systemName: 'Employee Shift & Attendance Punch Sync',
      systemRequirements: 'Employee Shift & Attendance Punch Sync with biometric hardware for contractual labor.',
      businessPurpose: 'Automate daily contractor muster roll calculation to ensure accurate overtime payouts and statutory compliance.',
      assignedDeveloper: 'Rahul Sharma (Senior Full-Stack Dev)',
      targetCompletionDate: subDays(1),
      currentStage: STAGES.UPDATE_MIS,
      currentStatus: 'Update MIS: Pending',
      workStatus: WORK_STATUS.COMPLETED,
      progressPercent: 100,
      currentRevisionNo: null,
      latestRemarks: 'Testing cleared successfully. Awaiting final corporate MIS table registration.',
      testingApprovedAt: subDays(1) + 'T15:30:00.000Z',
      introduction: {
        isCompleted: true,
        meetingDate: subDays(16),
        remarks: 'Agreed on biometric SDK connectivity and shift rotation rules.',
        completedAt: subDays(16) + 'T10:00:00.000Z',
        completedBy: 'Anil Kumar (Admin)'
      },
      developmentHistory: [
        {
          cycleNumber: 1,
          revisionNo: null,
          status: WORK_STATUS.COMPLETED,
          progressPercent: 100,
          remarks: 'Completed integration with eSSL biometric SDK.',
          updatedAt: subDays(4) + 'T17:00:00.000Z',
          updatedBy: 'Rahul Sharma (Senior Full-Stack Dev)'
        }
      ],
      testingHistory: [
        {
          attemptNumber: 1,
          revisionNo: null,
          decision: TESTING_DECISION.APPROVED,
          remarks: 'All 3 biometric devices synced without packet loss during stress test. Approved for rollout.',
          testedBy: 'QA Engineer',
          testedAt: subDays(1) + 'T15:30:00.000Z'
        }
      ],
      misUpdate: null,
      attachments: [],
      createdAt: subDays(18) + 'T09:00:00.000Z',
      createdBy: 'Anil Kumar (Admin)',
      lastUpdatedAt: subDays(1) + 'T15:30:00.000Z',
      activityLog: [
        {
          id: 'act-61',
          action: 'Request Created',
          actor: 'Anil Kumar (Admin)',
          timestamp: subDays(18) + 'T09:00:00.000Z',
          details: 'System Request SM-0006 created.'
        },
        {
          id: 'act-62',
          action: 'Introduction Approved',
          actor: 'Anil Kumar (Admin)',
          timestamp: subDays(16) + 'T10:00:00.000Z',
          details: 'Introduction completed.'
        },
        {
          id: 'act-63',
          action: 'Development Completed',
          actor: 'Rahul Sharma (Senior Full-Stack Dev)',
          timestamp: subDays(4) + 'T17:00:00.000Z',
          details: 'Development finished (100%).'
        },
        {
          id: 'act-64',
          action: 'Testing Approved',
          actor: 'QA Engineer',
          timestamp: subDays(1) + 'T15:30:00.000Z',
          details: 'Testing approved. Sent to Update MIS System.'
        }
      ]
    },
    {
      id: 'req-007',
      requestNo: 'SM-0007',
      companyName: 'Purab',
      systemName: 'Contractor Safety Compliance & Work Permit Portal',
      systemRequirements: 'Contractor Safety Compliance & Work Permit Portal with digital hot-work checklist.',
      businessPurpose: 'Enforce zero-accident safety protocols and instant safety induction verification before issuing high-hazard permits.',
      assignedDeveloper: 'Priya Patel (React & Node Dev)',
      targetCompletionDate: subDays(10),
      currentStage: STAGES.CLOSED,
      currentStatus: 'Closed',
      workStatus: WORK_STATUS.COMPLETED,
      progressPercent: 100,
      currentRevisionNo: null,
      latestRemarks: 'MIS system catalog updated, production cutover completed.',
      closedAt: subDays(4) + 'T16:00:00.000Z',
      introduction: {
        isCompleted: true,
        meetingDate: subDays(25),
        remarks: 'Safety committee reviewed checklists and risk assessments.',
        completedAt: subDays(25) + 'T11:00:00.000Z',
        completedBy: 'Anil Kumar (Admin)'
      },
      developmentHistory: [
        {
          cycleNumber: 1,
          revisionNo: null,
          status: WORK_STATUS.COMPLETED,
          progressPercent: 100,
          remarks: 'All permit approval workflows and safety officer signatures implemented.',
          updatedAt: subDays(12) + 'T18:00:00.000Z',
          updatedBy: 'Priya Patel (React & Node Dev)'
        }
      ],
      testingHistory: [
        {
          attemptNumber: 1,
          revisionNo: null,
          decision: TESTING_DECISION.APPROVED,
          remarks: 'Passed all safety officer acceptance criteria.',
          testedBy: 'QA Lead',
          testedAt: subDays(8) + 'T14:00:00.000Z'
        }
      ],
      misUpdate: {
        isCompleted: true,
        remarks: 'Registered under Corporate IT MIS System ID: MIS-SEC-2026-09. Access rights granted to plant safety heads.',
        updatedAt: subDays(4) + 'T16:00:00.000Z',
        updatedBy: 'Anil Kumar (Admin)'
      },
      attachments: [],
      createdAt: subDays(26) + 'T10:00:00.000Z',
      createdBy: 'Anil Kumar (Admin)',
      lastUpdatedAt: subDays(4) + 'T16:00:00.000Z',
      activityLog: [
        {
          id: 'act-71',
          action: 'Request Created',
          actor: 'Anil Kumar (Admin)',
          timestamp: subDays(26) + 'T10:00:00.000Z',
          details: 'System Request SM-0007 created.'
        },
        {
          id: 'act-72',
          action: 'Introduction Approved',
          actor: 'Anil Kumar (Admin)',
          timestamp: subDays(25) + 'T11:00:00.000Z',
          details: 'Introduction completed.'
        },
        {
          id: 'act-73',
          action: 'Development Completed',
          actor: 'Priya Patel (React & Node Dev)',
          timestamp: subDays(12) + 'T18:00:00.000Z',
          details: 'Development finished (100%).'
        },
        {
          id: 'act-74',
          action: 'Testing Approved',
          actor: 'QA Lead',
          timestamp: subDays(8) + 'T14:00:00.000Z',
          details: 'Testing approved.'
        },
        {
          id: 'act-75',
          action: 'MIS Update Completed',
          actor: 'Anil Kumar (Admin)',
          timestamp: subDays(4) + 'T16:00:00.000Z',
          details: 'MIS records registered. Request closed successfully.'
        }
      ]
    }
  ];
}

// LocalStorage helpers
// LocalStorage helpers
export function loadCachedRequests() {
  return loadStoredRequests();
}

export function loadCachedMasterOptions() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_MASTER);
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  return { companies: [...SAMPLE_COMPANIES], developers: [...SAMPLE_DEVELOPERS] };
}

export function saveCachedMasterOptions(options) {
  try {
    localStorage.setItem(STORAGE_KEY_MASTER, JSON.stringify(options));
  } catch (e) {}
}

export function getNextRequestNumber(requestsList) {
  const list = requestsList || loadStoredRequests();
  let maxNum = 0;
  (list || []).forEach(r => {
    const match = String(r.requestNo || '').match(/SM-(\d+)/);
    if (match) {
      const n = parseInt(match[1], 10);
      if (n > maxNum) maxNum = n;
    }
  });
  if (maxNum === 0) {
    const current = parseInt(localStorage.getItem(STORAGE_KEY_SEQUENCE) || '7', 10);
    return formatRequestNumber(current + 1);
  }
  return formatRequestNumber(maxNum + 1);
}

function normalizeApiRequests(payload) {
  if (Array.isArray(payload.requests)) payload.requests = payload.requests.map(normalizeLegacyStage);
  if (payload.request) payload.request = normalizeLegacyStage(payload.request);
  return payload;
}

function loadStoredRequests() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_REQUESTS);
    if (!raw) {
      const initial = getInitialSampleData().map(normalizeLegacyStage);
      saveStoredRequests(initial);
      localStorage.setItem(STORAGE_KEY_SEQUENCE, '7');
      return initial;
    }
    return JSON.parse(raw).map(normalizeLegacyStage);
  } catch (err) {
    console.error('Failed to load stored requests:', err);
    return getInitialSampleData().map(normalizeLegacyStage);
  }
}

function saveStoredRequests(requests) {
  try {
    localStorage.setItem(STORAGE_KEY_REQUESTS, JSON.stringify(requests));
  } catch (err) {
    console.error('Failed to save requests:', err);
  }
}

function getNextSequenceNumber() {
  try {
    const current = parseInt(localStorage.getItem(STORAGE_KEY_SEQUENCE) || '7', 10);
    const next = current + 1;
    localStorage.setItem(STORAGE_KEY_SEQUENCE, String(next));
    return next;
  } catch {
    return Math.floor(Math.random() * 1000) + 10;
  }
}

export function formatRequestNumber(num) {
  return `SM-${String(num).padStart(4, '0')}`;
}

const delay = (ms = 40) => new Promise(res => setTimeout(res, ms));

/**
 * Universal API Client for Google Apps Script Web App
 * Uses text/plain payload to prevent browser CORS preflight blocking
 */
export async function callGoogleAppsScript(action, payload = {}, method = 'POST') {
  let token = '';
  try { token = JSON.parse(localStorage.getItem('make_system_session_v2') || sessionStorage.getItem('make_system_session_v2') || '{}').token || ''; } catch { /* No active session. */ }
  payload = { ...payload, token };
  const url = getGoogleAppsScriptUrl();
  if (!url) throw new Error('Google Apps Script URL is not configured.');

  const controller = new AbortController();
  // Apps Script cold starts, spreadsheet locks and redirects can exceed 8 seconds.
  const timeoutMs = method === 'GET' ? 60000 : 120000;
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    if (method === 'GET') {
      const queryParams = new URLSearchParams({ action, ...payload });
      const fullUrl = `${url}${url.includes('?') ? '&' : '?'}${queryParams.toString()}`;
      const res = await fetch(fullUrl, {
        method: 'GET',
        redirect: 'follow',
        signal: controller.signal
      });
      if (!res.ok) throw new Error(`Google Apps Script responded with HTTP ${res.status}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      return normalizeApiRequests(data);
    }

    // POST using text/plain to avoid CORS preflight options
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8'
      },
      body: JSON.stringify({
        action,
        ...payload
      }),
      signal: controller.signal
    });

    if (!res.ok) throw new Error(`Google Apps Script responded with HTTP ${res.status}`);
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    return normalizeApiRequests(data);
  } catch (err) {
    if (controller.signal.aborted || err?.name === 'AbortError' || err?.name === 'TimeoutError') {
      throw new Error(method === 'GET'
        ? 'Google Sheet response timed out. Please refresh and try again.'
        : 'Google Sheet save response timed out. The save may have completed; refresh records before retrying.');
    }
    console.error(`Google Apps Script [${action}] failed:`, err);
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Data Service API - Unified for both Live Google Sheets & Sample Mode
 */
export const dataService = {
  /**
   * Health check / ping Google Apps Script
   */
  async ping() {
    if (!isGoogleSheetsConnected()) return { connected: false, mode: 'sample' };
    const res = await callGoogleAppsScript('ping', {}, 'GET');
    return { connected: true, mode: 'live', timestamp: res.timestamp };
  },

  /**
   * Initialize Google Sheets headers and tabs (1-click setup)
   */
  async initSheetStructure() {
    if (!isGoogleSheetsConnected()) {
      throw new Error('Please configure and connect a valid Google Apps Script Web App URL first.');
    }
    return await callGoogleAppsScript('initSheet', {});
  },

  /**
   * Check for Real-Time Changes from Google Sheets (Lightweight polling)
   */
  async checkSync() {
    if (!isGoogleSheetsConnected()) {
      return { hasChanges: false, mode: 'sample' };
    }

    try {
      const res = await callGoogleAppsScript('checkSync', { version: cachedSyncVersion }, 'GET');
      if (res.hasChanges) {
        saveSyncVersion(res.version);
        if (res.requests) {
          saveStoredRequests(res.requests);
        }
        return {
          hasChanges: true,
          version: res.version,
          requests: res.requests,
          masterOptions: res.masterOptions,
          users: res.users
        };
      }
      return { hasChanges: false, version: res.version };
    } catch (err) {
      return { hasChanges: false, error: err.message };
    }
  },

  /**
   * Force sync fresh data from Google Sheets immediately (bypasses cache)
   */
  async forceSyncFromSheets() {
    if (isGoogleSheetsConnected()) {
      saveSyncVersion('0');
      const res = await callGoogleAppsScript('getRequests', {}, 'GET');
      if (res && res.requests) {
        saveSyncVersion(res.version || cachedSyncVersion);
        saveStoredRequests(res.requests);
        return {
          requests: res.requests,
          masterOptions: res.masterOptions,
          users: res.users
        };
      }
    }
    const local = loadStoredRequests();
    return { requests: local };
  },

  /**
   * High-Performance Unified Data Loader (1 single fast network request)
   */
  async loadAllData() {
    if (isGoogleSheetsConnected()) {
      try {
        const sync = await this.checkSync();
        if (sync.hasChanges && sync.requests) {
          const masterOptions = sync.masterOptions?.developers?.length
            ? sync.masterOptions
            : await this.getMasterOptions();
          return {
            requests: sync.requests,
            masterOptions,
            users: sync.users || [],
            nextRequestNo: getNextRequestNumber(sync.requests)
          };
        }

        const cached = loadStoredRequests();
        const masterOptions = await this.getMasterOptions();
        return {
          requests: cached,
          masterOptions,
          users: [],
          nextRequestNo: getNextRequestNumber(cached)
        };
      } catch (err) {
        console.warn('Live Google Sheets loadAllData failed, serving cached:', err);
      }
    }

    const cached = loadStoredRequests();
    return {
      requests: cached,
      masterOptions: loadCachedMasterOptions(),
      users: [],
      nextRequestNo: getNextRequestNumber(cached)
    };
  },

  /**
   * Load Master dropdown options (uses local cache instantly)
   */
  async getMasterOptions() {
    const cached = loadCachedMasterOptions();
    if (isGoogleSheetsConnected()) {
      try {
        const res = await callGoogleAppsScript('getMasterOptions', {}, 'GET');
        if (res && (res.companies || res.developers)) {
          const opts = {
            companies: Array.isArray(res.companies) && res.companies.length ? res.companies : (cached.companies?.length ? cached.companies : SAMPLE_COMPANIES),
            developers: Array.isArray(res.developers) && res.developers.length ? res.developers : (cached.developers?.length ? cached.developers : SAMPLE_DEVELOPERS),
            isLiveGoogleSheets: true
          };
          saveCachedMasterOptions(opts);
          return opts;
        }
      } catch (err) {
        console.warn('Falling back to local master options due to network error:', err);
      }
    }
    return { ...cached, isLiveGoogleSheets: false };
  },

  /**
   * Preview the next auto-generated System Request No (Instant in-memory, 0ms)
   */
  async peekNextRequestNumber(requestsList) {
    return getNextRequestNumber(requestsList);
  },

  getNextRequestNumber(requestsList) {
    return getNextRequestNumber(requestsList);
  },

  /**
   * List all system requests
   */
  async listRequests() {
    if (isGoogleSheetsConnected()) {
      try {
        const res = await callGoogleAppsScript('getRequests', {}, 'GET');
        if (res.requests) {
          cachedSyncVersion = res.version || cachedSyncVersion;
          saveStoredRequests(res.requests);
          return res.requests;
        }
      } catch (err) {
        console.warn('Live Google Sheets fetch failed, serving cached data:', err);
      }
    }

    await delay(80);
    const requests = loadStoredRequests();
    return [...requests].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  },

  /**
   * Get single request by ID
   */
  async getRequestById(id) {
    const requests = await this.listRequests();
    return requests.find(r => r.id === id || r.requestNo === id) || null;
  },

  /**
   * Upload an attachment directly to Google Drive Folder: 1m1a4pquw0Mq-H41bD2X2R8d4c46V6-4E
   */
  async uploadAttachment(fileItem) {
    if (isGoogleSheetsConnected() && fileItem.base64Data) {
      const res = await callGoogleAppsScript('uploadAttachment', {
        data: {
          name: fileItem.name,
          type: fileItem.type,
          size: fileItem.size,
          base64Data: fileItem.base64Data
        }
      });
      if (res && res.success) {
        const fileId = res.fileId || fileItem.id;
        const driveUrl = res.driveUrl || (fileId ? `https://drive.google.com/file/d/${fileId}/view?usp=sharing` : (res.url || ''));
        const directUrl = fileId ? `https://lh3.googleusercontent.com/d/${fileId}` : (fileItem.previewUrl || res.url || '');
        return {
          id: fileId,
          fileId: fileId,
          name: res.name || fileItem.name,
          size: res.size || fileItem.size,
          type: res.type || fileItem.type,
          previewUrl: fileItem.previewUrl || directUrl,
          url: driveUrl,
          directUrl: directUrl,
          driveUrl: driveUrl,
          uploadedAt: res.uploadedAt || new Date().toISOString()
        };
      }
      if (res && res.error) {
        throw new Error(res.error);
      }
    }
    return {
      id: fileItem.id,
      name: fileItem.name,
      size: fileItem.size,
      type: fileItem.type,
      url: fileItem.url || fileItem.previewUrl || null,
      uploadedAt: formatToKolkataDateString(new Date())
    };
  },

  /**
   * Create a new System Request (Syncs to Google Sheets & localStorage)
   */
  async createRequest({
    companyName,
    systemName,
    systemRequirements,
    businessPurpose,
    assignedDeveloper,
    targetCompletionDate,
    attachments = []
  }) {
    const safeName = systemName || systemRequirements || 'New System';

    if (isGoogleSheetsConnected()) {
      const res = await callGoogleAppsScript('createRequest', {
        data: {
          companyName,
          systemName: safeName,
          businessPurpose,
          assignedDeveloper,
          targetCompletionDate,
          attachments,
          createdBy: CURRENT_USER.name
        }
      });

      if (res.version) cachedSyncVersion = res.version;
      const currentList = loadStoredRequests();
      const newReq = res.request || {
        id: res.id || `req-${Date.now()}`,
        requestNo: res.requestNo,
        companyName,
        systemName: safeName,
        systemRequirements: safeName,
        businessPurpose,
        assignedDeveloper,
        targetCompletionDate,
        currentStage: STAGES.INTRODUCE,
        currentStatus: 'Introduce: Pending',
        workStatus: 'Pending Kickoff',
        progressPercent: 0,
        introduction: { isCompleted: false },
        testingHistory: [],
        misUpdate: null,
        activityLog: [{
          id: `act-${Date.now()}`,
          action: 'Request Created',
          actor: CURRENT_USER.name,
          timestamp: new Date().toISOString(),
          details: `System Request ${res.requestNo} created.`
        }],
        attachments,
        createdAt: new Date().toISOString(),
        createdBy: CURRENT_USER.name,
        lastUpdatedAt: new Date().toISOString()
      };

      const allRequests = [newReq, ...currentList.filter(r => r.requestNo !== newReq.requestNo && r.id !== newReq.id)];
      saveStoredRequests(allRequests);
      return Object.assign(newReq, { allRequests, newReq });
    }

    // Local sample mode
    await delay(30);
    const nextSeq = getNextSequenceNumber();
    const requestNo = formatRequestNumber(nextSeq);
    const nowISO = getNowKolkataISO();
    const id = `req-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;

    const safeAttachments = attachments.map((att, idx) => ({
      id: att.id || `att-${Date.now()}-${idx}`,
      name: att.name,
      size: att.size || 0,
      type: att.type || 'document',
      url: att.url || att.driveUrl || att.previewUrl || null,
      uploadedAt: formatToKolkataDateString(new Date())
    }));

    const newRequest = {
      id,
      requestNo,
      companyName,
      systemName: safeName,
      systemRequirements: safeName,
      businessPurpose,
      assignedDeveloper,
      targetCompletionDate,
      currentStage: STAGES.INTRODUCE,
      currentStatus: 'Introduce: Pending',
      workStatus: null,
      progressPercent: 0,
      currentRevisionNo: null,
      latestRemarks: 'New request created. Pending Introduce System kickoff meeting.',
      introduction: {
        isCompleted: false,
        meetingDate: null,
        remarks: null,
        completedAt: null,
        completedBy: null
      },
      developmentHistory: [],
      testingHistory: [],
      misUpdate: null,
      attachments: safeAttachments,
      createdAt: nowISO,
      createdBy: CURRENT_USER.name,
      lastUpdatedAt: nowISO,
      activityLog: [
        {
          id: `act-${Date.now()}-1`,
          action: 'Request Created',
          actor: CURRENT_USER.name,
          timestamp: nowISO,
          details: `System Request ${requestNo} created for ${companyName}. Assigned to ${assignedDeveloper}.`
        }
      ]
    };

    const requests = loadStoredRequests();
    requests.unshift(newRequest);
    saveStoredRequests(requests);
    return Object.assign(newRequest, { allRequests: requests, newReq: newRequest });
  },

  /**
   * Introduce System - Approve & Submit
   */
  async approveIntroduction(requestId, { assignedDeveloper, targetCompletionDate, remarks }) {
    if (isGoogleSheetsConnected()) {
      const res = await callGoogleAppsScript('approveIntroduction', {
        requestId,
        data: {
          assignedDeveloper,
          targetCompletionDate,
          remarks,
          approvedBy: CURRENT_USER.name
        }
      });
      if (res.version) cachedSyncVersion = res.version;
      const currentList = loadStoredRequests();
      const updatedReq = res.request || {
        ...currentList.find(r => r.id === requestId || r.requestNo === requestId),
        currentStage: STAGES.CREATE,
        currentStatus: 'Create System: Pending',
        workStatus: WORK_STATUS.IN_PROGRESS,
        progressPercent: 0,
        latestRemarks: remarks,
        assignedDeveloper,
        targetCompletionDate,
        introduction: {
          isCompleted: true,
          remarks,
          completedAt: new Date().toISOString(),
          completedBy: CURRENT_USER.name
        }
      };
      const allRequests = currentList.map(r => (r.id === requestId || r.requestNo === requestId) ? { ...r, ...updatedReq } : r);
      saveStoredRequests(allRequests);
      return Object.assign(updatedReq, { allRequests, updatedReq });
    }

    // Local sample mode
    await delay(30);
    const requests = loadStoredRequests();
    const req = requests.find(r => r.id === requestId || r.requestNo === requestId);
    if (!req) throw new Error('Request not found');

    const nowISO = getNowKolkataISO();
    req.introduction = {
      isCompleted: true,
      remarks,
      completedAt: nowISO,
      completedBy: CURRENT_USER.name
    };
    req.assignedDeveloper = assignedDeveloper;
    req.targetCompletionDate = targetCompletionDate;

    req.currentStage = STAGES.CREATE;
    req.currentStatus = 'Create System: Pending';
    req.workStatus = WORK_STATUS.IN_PROGRESS;
    req.progressPercent = 0;
    req.latestRemarks = remarks;
    req.lastUpdatedAt = nowISO;

    req.developmentHistory.push({
      cycleNumber: 1,
      revisionNo: null,
      status: WORK_STATUS.IN_PROGRESS,
      progressPercent: 0,
      remarks: `Introduction approved. ${remarks}`,
      updatedAt: nowISO,
      updatedBy: CURRENT_USER.name
    });

    req.activityLog.push({
      id: `act-${Date.now()}`,
      action: 'Introduction Approved',
      actor: CURRENT_USER.name,
      timestamp: nowISO,
      details: `Introduction approved. Remarks: "${remarks}". Moved to Create System: Pending.`
    });

    saveStoredRequests(requests);
    return Object.assign(req, { allRequests: requests, updatedReq: req });
  },

  /**
   * Create System - Update Development Progress
   */
  async updateDevelopmentProgress(requestId, { workStatus, progressPercent, remarks, holdReason, extendedTargetDate, holdExtendTargetDate, systemUrl, adminId, adminPassword }) {
    const finalHoldExtendDate = holdExtendTargetDate || extendedTargetDate || null;
    if (isGoogleSheetsConnected()) {
      const res = await callGoogleAppsScript('updateDevelopmentProgress', {
        requestId,
        data: {
          workStatus,
          progressPercent,
          remarks,
          holdReason,
          holdExtendTargetDate: finalHoldExtendDate,
          extendedTargetDate: finalHoldExtendDate,
          systemUrl: systemUrl || '',
          adminId: adminId || '',
          adminPassword: adminPassword || '',
          updatedBy: CURRENT_USER.name
        }
      });
      if (res.version) cachedSyncVersion = res.version;
      const currentList = loadStoredRequests();
      const updatedReq = res.request || currentList.find(r => r.id === requestId || r.requestNo === requestId);
      const allRequests = currentList.map(r => (r.id === requestId || r.requestNo === requestId) ? { ...r, ...updatedReq } : r);
      saveStoredRequests(allRequests);
      return Object.assign(updatedReq, { allRequests, updatedReq });
    }

    // Local sample mode
    await delay(30);
    const requests = loadStoredRequests();
    const req = requests.find(r => r.id === requestId || r.requestNo === requestId);
    if (!req) throw new Error('Request not found');

    const nowISO = getNowKolkataISO();
    const currentCycle = req.developmentHistory.length > 0 
      ? Math.max(...req.developmentHistory.map(h => h.cycleNumber || 1))
      : 1;

    let finalProgress = req.progressPercent || 0;
    let activityAction = 'Development Progress';
    let activityDetails = '';

    if (systemUrl !== undefined) req.systemUrl = systemUrl;
    if (adminId !== undefined) req.adminId = adminId;
    if (adminPassword !== undefined) req.adminPassword = adminPassword;

    if (workStatus === WORK_STATUS.IN_PROGRESS) {
      finalProgress = parseInt(progressPercent, 10);
      req.workStatus = WORK_STATUS.IN_PROGRESS;
      req.progressPercent = finalProgress;
      req.latestRemarks = remarks;
      req.currentStage = STAGES.CREATE;
      req.currentStatus = req.currentRevisionNo 
        ? `Revise System (${finalProgress}%)` 
        : `Development: In Progress (${finalProgress}%)`;

      activityDetails = `Progress updated to ${finalProgress}%. Remarks: "${remarks}"`;

      req.developmentHistory.push({
        cycleNumber: currentCycle,
        revisionNo: req.currentRevisionNo,
        status: WORK_STATUS.IN_PROGRESS,
        progressPercent: finalProgress,
        remarks,
        updatedAt: nowISO,
        updatedBy: CURRENT_USER.name
      });
    } else if (workStatus === WORK_STATUS.ON_HOLD) {
      req.workStatus = WORK_STATUS.ON_HOLD;
      req.holdReason = holdReason;
      req.latestRemarks = holdReason;
      req.currentStage = STAGES.CREATE;
      req.currentStatus = req.currentRevisionNo ? 'Revise: On Hold' : 'Development: On Hold';

      let dateChangeNote = '';
      if (finalHoldExtendDate) {
        req.holdExtendTargetDate = finalHoldExtendDate;
        dateChangeNote = ` Hold Extend Target Date set to ${finalHoldExtendDate}.`;
      }

      activityAction = 'Development Put On Hold';
      activityDetails = `Reason for Hold: "${holdReason}".${dateChangeNote} (Preserved progress: ${finalProgress}%)`;

      req.developmentHistory.push({
        cycleNumber: currentCycle,
        revisionNo: req.currentRevisionNo,
        status: WORK_STATUS.ON_HOLD,
        progressPercent: finalProgress,
        remarks: holdReason + (dateChangeNote ? ` (${dateChangeNote.trim()})` : ''),
        holdReason,
        holdExtendTargetDate: finalHoldExtendDate,
        extendedTargetDate: finalHoldExtendDate,
        updatedAt: nowISO,
        updatedBy: CURRENT_USER.name
      });
    } else if (workStatus === WORK_STATUS.COMPLETED) {
      finalProgress = 100;
      req.workStatus = WORK_STATUS.COMPLETED;
      req.progressPercent = 100;
      req.developmentCompletedAt = nowISO;

      const linkNote = systemUrl ? ` System Link: ${systemUrl}.` : '';

      if (req.currentRevisionNo) {
        req.currentStage = STAGES.UPDATE_MIS;
        req.currentStatus = 'Update MIS: Pending';
        req.latestRemarks = remarks || 'Revision completed. Transferred to Update MIS System.';
        activityAction = 'Revision Completed';
        activityDetails = `Revision ${req.currentRevisionNo} completed (100%).${linkNote} Sent to Update MIS System.`;
      } else {
        req.currentStage = STAGES.UPDATE_MIS;
        req.currentStatus = 'Update MIS: Pending';
        req.latestRemarks = remarks || 'Development completed. Sent to Update MIS System.';
        activityAction = 'Development Completed';
        activityDetails = `Cycle ${currentCycle} completed (100%).${linkNote} Sent to Update MIS System.`;
      }

      req.developmentHistory.push({
        cycleNumber: currentCycle,
        revisionNo: req.currentRevisionNo,
        status: WORK_STATUS.COMPLETED,
        progressPercent: 100,
        remarks: remarks || (req.currentRevisionNo ? 'Revision completed.' : 'Development completed.'),
        systemUrl: req.systemUrl || '',
        adminId: req.adminId || '',
        updatedAt: nowISO,
        updatedBy: CURRENT_USER.name
      });
    }

    req.lastUpdatedAt = nowISO;
    req.activityLog.push({
      id: `act-${Date.now()}`,
      action: activityAction,
      actor: CURRENT_USER.name,
      timestamp: nowISO,
      details: activityDetails
    });

    saveStoredRequests(requests);
    return Object.assign(req, { allRequests: requests, updatedReq: req });
  },

  /**
   * Testing System - Submit Testing Decision (Approved or Rejected)
   */
  async submitTestingDecision(requestId, { decision, remarks, extendedTargetDate, upgradeTargetDate }) {
    const finalUpgradeDate = upgradeTargetDate || extendedTargetDate || null;
    if (isGoogleSheetsConnected()) {
      const res = await callGoogleAppsScript('submitTestingDecision', {
        requestId,
        data: {
          decision,
          remarks,
          extendedTargetDate: finalUpgradeDate,
          upgradeTargetDate: finalUpgradeDate,
          testedBy: CURRENT_USER.name
        }
      });
      if (res.version) cachedSyncVersion = res.version;
      const currentList = loadStoredRequests();
      const updatedReq = res.request || currentList.find(r => r.id === requestId || r.requestNo === requestId);
      const allRequests = currentList.map(r => (r.id === requestId || r.requestNo === requestId) ? { ...r, ...updatedReq } : r);
      saveStoredRequests(allRequests);
      return Object.assign(updatedReq, { allRequests, updatedReq });
    }

    // Local sample mode
    await delay(30);
    const requests = loadStoredRequests();
    const req = requests.find(r => r.id === requestId || r.requestNo === requestId);
    if (!req) throw new Error('Request not found');

    const nowISO = getNowKolkataISO();
    const attemptNumber = req.testingHistory.length + 1;

    if (decision === TESTING_DECISION.APPROVED) {
      req.currentStage = STAGES.UPDATE_MIS;
      req.currentStatus = 'Update MIS: Pending';
      req.testingApprovedAt = nowISO;
      req.latestRemarks = remarks || 'Testing Approved. Ready for MIS update.';

      req.testingHistory.push({
        attemptNumber,
        revisionNo: req.currentRevisionNo,
        decision: TESTING_DECISION.APPROVED,
        remarks: remarks || 'Testing approved with no blockers.',
        testedBy: CURRENT_USER.name,
        testedAt: nowISO
      });

      req.activityLog.push({
        id: `act-${Date.now()}`,
        action: 'Testing Approved',
        actor: CURRENT_USER.name,
        timestamp: nowISO,
        details: `Testing approved. Moved to Update MIS System: Pending.`
      });
    } else if (decision === TESTING_DECISION.REJECTED) {
      if (!remarks || !remarks.trim()) throw new Error('Rejection remarks are required.');

      const rejectionCount = req.testingHistory.filter(t => t.decision === TESTING_DECISION.REJECTED).length + 1;
      const revisionNo = `REV-${String(rejectionCount).padStart(2, '0')}`;

      req.upgradeTargetDate = finalUpgradeDate;

      let dateChangeNote = '';
      if (finalUpgradeDate) {
        dateChangeNote = ` Upgrade Target Date set to ${finalUpgradeDate}.`;
      }

      req.testingHistory.push({
        attemptNumber,
        revisionNo: req.currentRevisionNo,
        decision: TESTING_DECISION.REJECTED,
        remarks: remarks.trim(),
        testedBy: CURRENT_USER.name,
        testedAt: nowISO,
        generatedRevisionNo: revisionNo,
        extendedTargetDate: finalUpgradeDate,
        upgradeTargetDate: finalUpgradeDate
      });

      req.currentStage = STAGES.REVISE;
      req.currentStatus = 'Revise System (Pending)';
      req.currentRevisionNo = revisionNo;
      req.latestRejectionReason = remarks.trim();
      req.workStatus = WORK_STATUS.IN_PROGRESS;
      req.progressPercent = 0;
      req.latestRemarks = `Testing Rejected: ${remarks.trim()}${dateChangeNote ? ` (${dateChangeNote.trim()})` : ''}`;

      const nextCycleNumber = (Math.max(0, ...req.developmentHistory.map(h => h.cycleNumber || 1))) + 1;
      req.developmentHistory.push({
        cycleNumber: nextCycleNumber,
        revisionNo,
        status: WORK_STATUS.IN_PROGRESS,
        progressPercent: 0,
        remarks: `Returned from testing for revision (${revisionNo}). Reason: ${remarks.trim()}${dateChangeNote ? ` (${dateChangeNote.trim()})` : ''}`,
        updatedAt: nowISO,
        updatedBy: CURRENT_USER.name
      });

      req.activityLog.push({
        id: `act-${Date.now()}`,
        action: `Testing Rejected (${revisionNo})`,
        actor: CURRENT_USER.name,
        timestamp: nowISO,
        details: `Testing rejected. Generated ${revisionNo}.${dateChangeNote} Returned to Revise System queue.`
      });
    }

    req.lastUpdatedAt = nowISO;
    saveStoredRequests(requests);
    return Object.assign(req, { allRequests: requests, updatedReq: req });
  },

  /**
   * Update MIS System - Submit MIS Update Remarks
   */
  async completeMisUpdate(requestId, { remarks }) {
    if (isGoogleSheetsConnected()) {
      const res = await callGoogleAppsScript('completeMisUpdate', {
        requestId,
        data: {
          remarks,
          updatedBy: CURRENT_USER.name
        }
      });
      if (res.version) cachedSyncVersion = res.version;
      const currentList = loadStoredRequests();
      const updatedReq = res.request || currentList.find(r => r.id === requestId || r.requestNo === requestId);
      const allRequests = currentList.map(r => (r.id === requestId || r.requestNo === requestId) ? { ...r, ...updatedReq } : r);
      saveStoredRequests(allRequests);
      return Object.assign(updatedReq, { allRequests, updatedReq });
    }

    // Local sample mode
    await delay(30);
    const requests = loadStoredRequests();
    const req = requests.find(r => r.id === requestId || r.requestNo === requestId);
    if (!req) throw new Error('Request not found');

    const nowISO = getNowKolkataISO();
    req.misUpdate = {
      isCompleted: true,
      remarks: remarks.trim(),
      updatedAt: nowISO,
      updatedBy: CURRENT_USER.name
    };

    req.currentStage = STAGES.CLOSED;
    req.currentStatus = 'Closed';
    req.closedAt = nowISO;
    req.lastUpdatedAt = nowISO;
    req.latestRemarks = `MIS Updated: ${remarks.trim()}`;

    req.activityLog.push({
      id: `act-${Date.now()}`,
      action: 'MIS Update Completed (Request Closed)',
      actor: CURRENT_USER.name,
      timestamp: nowISO,
      details: `MIS update submitted: "${remarks.trim()}". Request closed.`
    });

    saveStoredRequests(requests);
  },

  /**
   * Reset data to initial sample set
   */
  async resetToSampleData() {
    await delay(120);
    const initial = getInitialSampleData();
    saveStoredRequests(initial);
    localStorage.setItem(STORAGE_KEY_SEQUENCE, '7');
    return initial;
  }
};
