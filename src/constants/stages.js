/**
 * Make System - Constants and Lifecycle Definitions
 */

export const STAGES = {
  INTRODUCE: 'Introduce System',
  CREATE: 'Create System',
  REVISE: 'Revise System',
  TESTING: 'Testing System',
  UPDATE_MIS: 'Update MIS System',
  CLOSED: 'Closed'
};

export const STAGE_STATUS = {
  PENDING: 'Pending',
  COMPLETED: 'Completed'
};

export const WORK_STATUS = {
  IN_PROGRESS: 'In Progress',
  ON_HOLD: 'On Hold',
  COMPLETED: 'Completed'
};

export const TESTING_DECISION = {
  APPROVED: 'Approved',
  REJECTED: 'Rejected'
};

// Demo user used for auditing created/updated actions
export const CURRENT_USER = {
  id: 'usr_demo_admin',
  name: 'Anil Kumar (Admin)',
  role: 'System Administrator',
  email: 'anil.kumar@company.local'
};

// Sample Companies (as specified: Pmmpl, RKL, Purab, Refrasynth, Refratech)
export const SAMPLE_COMPANIES = [
  'Pmmpl',
  'RKL',
  'Purab',
  'Refrasynth',
  'Refratech'
];

// Sample Assigned Developers (Matching Master sheet DME)
export const SAMPLE_DEVELOPERS = [
  'Ahitesh Tandon',
  'Bhupendra Kumar',
  'MD Alauddin'
];

// Business Timezone
export const TIMEZONE = 'Asia/Kolkata';

// Navigation Items
export const REPAIR_NAV_ITEMS = [
  { id: 'repair-new', label: 'New Issue Request', view: 'new' },
  { id: 'repair-system', label: 'Approval For Repair', view: 'records' },
  { id: 'repair-problem', label: 'Resolve Problem', view: 'records' }
];

export const NAV_ITEMS = [
  { id: 'repair-system', label: 'Repair System', icon: 'wrench' },
  { id: 'requests', label: 'System Requests', icon: 'file-text' },
  { id: 'technical-new', label: 'Raise Technical Help', icon: 'life-buoy' },
  { id: 'technical-all', label: 'All Technical Tickets', icon: 'clipboard-list' },
  { id: 'introduce', label: 'Introduce System', icon: 'handshake' },
  { id: 'create', label: 'Create System', icon: 'code' },
  { id: 'mis', label: 'Update MIS System', icon: 'database' }
];
