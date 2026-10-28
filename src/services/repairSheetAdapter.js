import { callGoogleAppsScript } from './dataService';
import { isGoogleSheetsConnected } from '../config/integrationConfig';
import { sortNewestFirst } from '../utils/sortUtils';

async function listIssues() {
  const result = await callGoogleAppsScript('getRepairIssues', {}, 'GET');
  if (!Array.isArray(result.issues)) throw new Error('Repair API unavailable. Deploy the updated Apps Script first.');
  return sortNewestFirst(result.issues, 'createdAt', 'serial');
}
async function write(action, payload) {
  const result = await callGoogleAppsScript(action, payload);
  if (!result.issue?.serial) throw new Error('Repair record was not saved. Check Apps Script deployment.');
  return result.issue;
}
export const repairSheetAdapter = {
  listIssues,
  async getIssueDetails(id) { return (await listIssues()).find(issue => issue.id === id); },
  createIssue: payload => write('createRepairIssue', payload),
  submitAssessment: payload => write('approveRepairIssue', payload),
  completeRepair: payload => write('resolveRepairIssue', payload),
  async acknowledgeCompletion() { throw new Error('Management acknowledgement is not part of the Repair template.'); }
};
export const repairSheetConnected = isGoogleSheetsConnected;
