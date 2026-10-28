export const OVERALL = ['Pending Approval', 'Pending Repair', 'Pending Management Acknowledgement', 'No Repair Required', 'Completed'];
export const REPAIR_STAGES = [
  { key: 'approval', label: 'Approval / Problem Assessment', role: 'DME 1', stageKey: 'SRIF-1' },
  { key: 'repair', label: 'Repair', role: 'DME 2', stageKey: 'SRIF-2' },
  { key: 'management', label: 'Management Acknowledgement', role: 'Management', stageKey: 'SRIF-3' }
];

// Shift to the Kolkata calendar, advance calendar dates, then convert back to UTC.
export function addRepairWorkingDays(source, days) {
  const date = new Date(source);
  if (!Number.isFinite(date.getTime())) throw new Error('Invalid source timestamp.');
  const offset = 330 * 60 * 1000;
  const local = new Date(date.getTime() + offset);
  local.setUTCSeconds(0, 0);
  let remaining = days;
  while (remaining > 0) {
    local.setUTCDate(local.getUTCDate() + 1);
    if (local.getUTCDay() !== 0) remaining--;
  }
  return new Date(local.getTime() - offset).toISOString();
}

export function overallStatus(issue) {
  if (!issue.approval?.actual) return OVERALL[0];
  if (issue.assessment?.repairRequired === 'No') return OVERALL[3];
  if (!issue.repair?.actual) return OVERALL[1];
  if (!issue.management?.actual) return OVERALL[2];
  return OVERALL[4];
}

export function stageState(issue, key, now = Date.now()) {
  const stage = issue[key] || {};
  const applicable = key === 'approval' || issue.assessment?.repairRequired !== 'No';
  const active = key === 'approval' || (key === 'repair' ? Boolean(issue.approval?.actual && issue.assessment?.repairRequired === 'Yes') : Boolean(issue.repair?.actual));
  const planned = Date.parse(stage.planned);
  const actual = Date.parse(stage.actual);
  const hasActual = Number.isFinite(actual);
  const difference = Number.isFinite(planned) ? (hasActual ? actual : now) - planned : null;
  return {
    applicable,
    status: hasActual ? 'Completed' : !applicable || !active ? 'Not Started' : difference !== null && difference > 0 ? 'Overdue' : 'Pending',
    delayMs: difference === null || !active ? 0 : Math.max(0, difference),
    dueInMs: !hasActual && active && difference !== null ? Math.max(0, -difference) : 0
  };
}

export function durationText(ms) {
  const minutes = Math.floor(ms / 60000);
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

export function delayText(state) {
  if (!state.applicable || state.status === 'Not Started') return '—';
  return state.dueInMs > 0 ? `Due in ${durationText(state.dueInMs)}` : durationText(state.delayMs);
}

export function getMISRows(issues, now = Date.now()) {
  return issues.flatMap(issue => REPAIR_STAGES.filter(s => stageState(issue, s.key, now).applicable).map(stage => ({
    id: `${issue.id}-${stage.key}`, serial: issue.serial, requester: issue.requester, company: issue.company,
    stage: stage.label, role: stage.role, planned: issue[stage.key]?.planned, actual: issue[stage.key]?.actual,
    ...stageState(issue, stage.key, now)
  })));
}

export function getSummary(issues, now = Date.now()) {
  const counts = Object.fromEntries(OVERALL.map(status => [status, 0]));
  issues.forEach(issue => { counts[overallStatus(issue)]++; });
  return { 'Total Issues': issues.length, ...counts, Overdue: issues.filter(issue => REPAIR_STAGES.some(s => stageState(issue, s.key, now).status === 'Overdue')).length };
}

// Used only by the explicitly selected local demo adapter. Real backend must enforce the same rules.
export function transitionIssue(issue, action, data, actor, now = new Date().toISOString()) {
  const updated = structuredClone(issue);
  let stageKey;
  if (action === 'assessment') {
    if (issue.approval?.actual) throw new Error('Assessment already submitted. Refresh the record.');
    if (!['Yes', 'No'].includes(data.repairRequired)) throw new Error('Choose Yes or No.');
    if (!data.whereToSolve?.trim()) throw new Error('Where Have To Solve is required.');
    updated.assessment = { repairRequired: data.repairRequired, whereToSolve: data.whereToSolve.trim(), assignedDeveloper: data.assignedDeveloper?.trim() || '' };
    updated.approval = { ...issue.approval, actual: now };
    if (data.repairRequired === 'Yes') updated.repair = { ...issue.repair, planned: issue.repair?.planned || addRepairWorkingDays(now, 3) };
    stageKey = 'SRIF-1';
  } else if (action === 'repair') {
    if (overallStatus(issue) !== 'Pending Repair') throw new Error('Issue is not eligible for repair.');
    updated.repair = { ...issue.repair, actual: now, remarks: data.remarks?.trim() || '' };
    updated.management = { ...issue.management, planned: issue.management?.planned || addRepairWorkingDays(now, 1) };
    stageKey = 'SRIF-2';
  } else if (action === 'acknowledge') {
    if (overallStatus(issue) !== 'Pending Management Acknowledgement') throw new Error('Issue is not eligible for acknowledgement.');
    updated.management = { ...issue.management, actual: now };
    stageKey = 'SRIF-3';
  } else throw new Error('Unknown repair action.');
  updated.version = (issue.version || 0) + 1;
  updated.activity = [...(issue.activity || []), { action, stageKey, actor: actor.fullName || actor.username, actorId: actor.id, timestamp: now }];
  return updated;
}
