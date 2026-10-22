// Register a trusted backend adapter through configureRepairAdapter when mapping is supplied.
// No spreadsheet URL, tab name or headers are assumed for Repair System.
export const REPAIR_CONFIG = {
  timezone: 'Asia/Kolkata',
  companies: ['RKL', 'PMMPL', 'PURAB', 'REFRASYNTH', 'PASMIN', 'LLP', 'REFRATECH'],
  permissionStages: { assessment: 'repair-approval', repair: 'repair-work', acknowledge: 'repair-management' }
};
