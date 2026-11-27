import { STAGES, WORK_STATUS } from '../constants/stages.js';
import { normalizeDateValue } from './dateUtils.js';

const REQUEST_DATE_FIELDS = ['targetCompletionDate', 'upgradeTargetDate', 'holdExtendTargetDate', 'extendedTargetDate', 'createdAt', 'lastUpdatedAt', 'developmentCompletedAt', 'closedAt', 'completedAt', 'testingApprovedAt', 'actualCreateDate', 'actualTestingDate', 'actualReviseDate', 'actualMisDate'];

export function isSystemClosed(request) {
  // Live FMS responses explicitly mark their workflow columns as authoritative.
  // Stale audit metadata must not re-close a request that management rolled
  // back by clearing the corresponding sheet milestone.
  if (request.sheetWorkflowAuthoritative) return request.currentStage === STAGES.CLOSED;
  return request.currentStage === STAGES.CLOSED || Boolean(request.misUpdate?.isCompleted);
}

export function isDevelopmentComplete(request) {
  return isSystemClosed(request) ||
    [STAGES.INTRODUCE, STAGES.TESTING, STAGES.UPDATE_MIS].includes(request.currentStage) ||
    request.workStatus === WORK_STATUS.COMPLETED;
}

export function isMisPending(request) {
  return !isSystemClosed(request) && request.currentStage === STAGES.UPDATE_MIS;
}

// Apply the current flow to both cached data and older Apps Script responses.
export function normalizeSystemRequest(request) {
  request = { ...request };
  for (const field of REQUEST_DATE_FIELDS) {
    if (field in request) request[field] = normalizeDateValue(request[field]);
  }
  // Current FMS responses expose Actual 1 as actualCreateDate. When assignment
  // is complete but Actual 1 is blank, the row is still Create System Pending,
  // even if Work Status or old Script Properties still say Completed.
  // Checking field presence keeps older/local records without sheet columns
  // backward compatible.
  if (Object.prototype.hasOwnProperty.call(request, 'actualCreateDate') &&
      !request.actualCreateDate && request.introduction?.isCompleted) {
    const generatedRollbackRemark = /^Moved back to Create System\.?$/i.test(String(request.latestRemarks || '').trim());
    const wasActuallyRolledBack = request.sheetWorkflowRolledBack === true ||
      request.currentStage !== STAGES.CREATE ||
      [WORK_STATUS.COMPLETED, 'Closed'].includes(request.workStatus) ||
      Number(request.progressPercent) >= 100 ||
      request.systemIntroduction?.isCompleted ||
      request.misUpdate?.isCompleted;
    return {
      ...request,
      workflowVersion: 2,
      sheetWorkflowAuthoritative: true,
      currentStage: STAGES.CREATE,
      currentStatus: 'Development: In Progress',
      workStatus: WORK_STATUS.IN_PROGRESS,
      progressPercent: Math.min(Number(request.progressPercent) || 0, 99),
      latestRemarks: wasActuallyRolledBack
        ? 'Moved back to Create System.'
        : (generatedRollbackRemark ? '' : request.latestRemarks),
      systemIntroduction: request.systemIntroduction
        ? { ...request.systemIntroduction, isCompleted: false }
        : request.systemIntroduction,
      misUpdate: request.misUpdate
        ? { ...request.misUpdate, isCompleted: false }
        : request.misUpdate
    };
  }
  if (isSystemClosed(request)) {
    return { ...request, currentStage: STAGES.CLOSED };
  }
  // A versioned handoff awaiting introduction must never be promoted by an older
  // server's MIS/Testing label. Explicit introduction completion unlocks MIS.
  if (request.workflowVersion === 2 && !request.systemIntroduction?.isCompleted &&
      ([STAGES.INTRODUCE, STAGES.UPDATE_MIS, STAGES.TESTING].includes(request.currentStage) || request.workStatus === WORK_STATUS.COMPLETED)) {
    return { ...request, currentStage: STAGES.INTRODUCE, currentStatus: 'Introduce System: Pending', workStatus: WORK_STATUS.COMPLETED, progressPercent: 100 };
  }
  // Legacy introduction records are assignment records. Never overwrite their audit data.
  if (request.currentStage === STAGES.INTRODUCE && request.workflowVersion !== 2 && !request.systemIntroduction) {
    return { ...request, currentStage: STAGES.ASSIGN, currentStatus: 'Assign System: Pending' };
  }
  if (request.currentStage === STAGES.UPDATE_MIS || request.systemIntroduction?.isCompleted || request.currentStage === STAGES.TESTING) {
    return { ...request, currentStage: STAGES.UPDATE_MIS, currentStatus: 'Update MIS: Pending', workStatus: WORK_STATUS.COMPLETED, progressPercent: 100 };
  }
  if (request.workStatus === WORK_STATUS.COMPLETED) {
    return { ...request, workflowVersion: 2, currentStage: STAGES.INTRODUCE, currentStatus: 'Introduce System: Pending', progressPercent: 100 };
  }
  if (request.currentStage === STAGES.REVISE) {
    return { ...request, currentStage: STAGES.CREATE, currentStatus: 'Development: In Progress' };
  }
  return request;
}
