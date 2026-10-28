import { STAGES, WORK_STATUS } from '../constants/stages.js';
import { normalizeDateValue } from './dateUtils.js';

const REQUEST_DATE_FIELDS = ['targetCompletionDate', 'upgradeTargetDate', 'holdExtendTargetDate', 'extendedTargetDate', 'createdAt', 'lastUpdatedAt', 'developmentCompletedAt', 'closedAt', 'completedAt', 'testingApprovedAt', 'actualCreateDate', 'actualTestingDate', 'actualReviseDate', 'actualMisDate'];

export function isSystemClosed(request) {
  return request.currentStage === STAGES.CLOSED || Boolean(request.misUpdate?.isCompleted);
}

export function isDevelopmentComplete(request) {
  return isSystemClosed(request) ||
    [STAGES.TESTING, STAGES.UPDATE_MIS].includes(request.currentStage) ||
    request.workStatus === WORK_STATUS.COMPLETED;
}

export function isMisPending(request) {
  return !isSystemClosed(request) && isDevelopmentComplete(request);
}

// Apply the current flow to both cached data and older Apps Script responses.
export function normalizeSystemRequest(request) {
  request = { ...request };
  for (const field of REQUEST_DATE_FIELDS) {
    if (field in request) request[field] = normalizeDateValue(request[field]);
  }
  if (isSystemClosed(request)) {
    return { ...request, currentStage: STAGES.CLOSED };
  }
  if (isMisPending(request)) {
    return { ...request, currentStage: STAGES.UPDATE_MIS, currentStatus: 'Update MIS: Pending', workStatus: WORK_STATUS.COMPLETED, progressPercent: 100 };
  }
  if (request.currentStage === STAGES.REVISE) {
    return { ...request, currentStage: STAGES.CREATE, currentStatus: 'Development: In Progress' };
  }
  return request;
}
