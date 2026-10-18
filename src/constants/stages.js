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
export const NAV_ITEMS = [
  { id: 'requests', label: 'System Requests', icon: 'file-text' },
  { id: 'introduce', label: 'Introduce System', icon: 'handshake' },
  { id: 'create', label: 'Create System', icon: 'code' },
  { id: 'revise', label: 'Revise System', icon: 'refresh-cw' },
  { id: 'testing', label: 'Testing System', icon: 'check-circle' },
  { id: 'mis', label: 'Update MIS System', icon: 'database' }
];
