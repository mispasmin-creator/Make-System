import { useEffect, useRef, useState } from 'react';
import { FilePlus2, Plus, Eye } from 'lucide-react';
import { Modal } from '../components/Modal';
import { Pagination } from '../components/Pagination';
import { repairService, getRepairMode, enableRepairDemo, getCachedRepairIssues, subscribeRepairIssues, canRepairAction } from '../services/repairService';
import { OVERALL, REPAIR_STAGES, overallStatus, stageState, delayText, getSummary, getMISRows } from '../utils/repairWorkflow.mjs';
import { formatDisplayDateTime, formatToKolkataDateString } from '../utils/dateUtils';

const control = 'mt-2 w-full rounded-xl border border-slate-200/80 bg-slate-50/70 px-3 py-2.5 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 transition-all';
const button = 'inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-700 px-4 py-2.5 text-xs font-semibold text-white shadow-xs shadow-indigo-300/40 hover:from-indigo-500 hover:to-indigo-600 transition-all cursor-pointer disabled:opacity-50';
const datetime = value => value ? formatDisplayDateTime(value) : '—';

function Field({ label, children }) { return <label className="block text-xs font-semibold text-slate-700">{label}{children}</label>; }

function StageTable({ issue, now }) {
  return <div className="overflow-x-auto"><table className="w-full text-left text-xs"><thead><tr>{['Stage', 'Planned', 'Actual', 'Status', 'Delay / Due in'].map(h => <th key={h} className="p-2">{h}</th>)}</tr></thead><tbody>{REPAIR_STAGES.map(s => { const state = stageState(issue, s.key, now); return <tr key={s.key} className="border-t border-slate-100"><td className="p-2">{s.label}</td><td className="p-2">{datetime(issue[s.key]?.planned)}</td><td className="p-2">{datetime(issue[s.key]?.actual)}</td><td className="p-2">{state.applicable ? state.status : 'Not Applicable'}</td><td className="p-2">{delayText(state)}</td></tr>; })}</tbody></table></div>;
}

export function RepairSystemPage({ currentUser, companyOptions = [], view = 'overview' }) {
  const [issues, setIssues] = useState(getCachedRepairIssues);
  const [mode, setMode] = useState(getRepairMode);
  const tab = view;
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [now, setNow] = useState(() => Date.now());
  const [filters, setFilters] = useState({ search: '', company: '', status: '', dateField: 'createdAt', from: '', to: '' });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [dialog, setDialog] = useState(null);
  const [detail, setDetail] = useState(null);
  const [actionData, setActionData] = useState({ repairRequired: 'Yes', whereToSolve: '', remarks: '' });
  const [actionError, setActionError] = useState('');
  const [saving, setSaving] = useState(false);
  const busy = useRef(false);
  const createKey = useRef(crypto.randomUUID());
  const [form, setForm] = useState({ requester: currentUser.fullName || '', company: '', description: '', location: '' });
  const companies = [...new Set(companyOptions.map(name => String(name).trim()).filter(Boolean))];


  useEffect(() => {
    let active = true;
    let syncing = false;
    const unsubscribe = subscribeRepairIssues(data => { if (active) setIssues(data); });
    async function sync() {
      if (document.hidden || syncing || busy.current || getRepairMode() === 'unconfigured') return;
      syncing = true;
      try { await repairService.listIssues(); if (active) setError(''); }
      catch (err) { if (active) setError(err.message); }
      finally { syncing = false; }
    }
    sync();
    const timer = setInterval(() => { setNow(Date.now()); sync(); }, 15000);
    window.addEventListener('focus', sync);
    return () => { active = false; unsubscribe(); clearInterval(timer); window.removeEventListener('focus', sync); };
  }, [mode]);

  function filter(name, value) { setFilters(prev => ({ ...prev, [name]: value })); setPage(1); }
  function openAction(issue, stage) {
    setDialog({ issue, stage }); setActionError('');
    setActionData({ repairRequired: 'Yes', whereToSolve: '', remarks: '' });
  }
  async function viewDetails(issue) {
    try { const result = await repairService.getIssueDetails(issue.id); if (!result) throw new Error('Issue not found.'); setDetail(result); }
    catch (err) { setError(err.message); }
  }
  async function create(e) {
    e.preventDefault(); if (busy.current) return;
    busy.current = true; setSaving(true); setError('');
    try {
      await repairService.createIssue(form, currentUser, createKey.current);
      createKey.current = crypto.randomUUID();
      setForm({ requester: currentUser.fullName || '', company: '', description: '', location: '' });
      setNotice('Submitted');
    } catch (err) { setError(err.message); }
    finally { busy.current = false; setSaving(false); }
  }
  async function complete(e) {
    e.preventDefault(); if (busy.current || !dialog) return;
    busy.current = true; setSaving(true); setActionError('');
    try {
      const { issue, stage } = dialog;
      if (stage === 'approval') await repairService.submitAssessment(issue.id, actionData, currentUser, issue.version);
      else if (stage === 'repair') await repairService.completeRepair(issue.id, actionData, currentUser, issue.version);
      else await repairService.acknowledgeCompletion(issue.id, currentUser, issue.version);
      setNotice('Submitted'); setDialog(null);
    } catch (err) { setActionError(err.message); }
    finally { busy.current = false; setSaving(false); }
  }

  const summary = getSummary(issues, now);
  const selectedStage = REPAIR_STAGES.find(s => s.key === tab);
  const queueStatus = { approval: 'Pending Approval', repair: 'Pending Repair', management: 'Pending Management Acknowledgement' };
  const permissionAction = { approval: 'assessment', repair: 'repair', management: 'acknowledge' };
  const actionLabels = { approval: 'Assess Issue', repair: 'Mark Repair Done', management: 'Acknowledge' };
  const filtered = issues.filter(issue => {
    if (selectedStage && overallStatus(issue) !== queueStatus[tab]) return false;
    if (filters.company && issue.company !== filters.company) return false;
    if (filters.status && overallStatus(issue) !== filters.status) return false;
    if (filters.search && ![issue.serial, issue.requester, issue.company, issue.description, issue.location].join(' ').toLowerCase().includes(filters.search.toLowerCase())) return false;
    const [stage, field] = filters.dateField.split('.');
    const value = field ? issue[stage]?.[field] : issue[stage];
    if ((filters.from || filters.to) && !value) return false;
    const date = value ? formatToKolkataDateString(value) : '';
    return (!filters.from || date >= filters.from) && (!filters.to || date <= filters.to);
  });
  const mis = getMISRows(filtered, now);
  const total = tab === 'mis' ? mis.length : filtered.length;
  const currentPage = Math.min(page, Math.max(1, Math.ceil(total / pageSize)));
  const start = (currentPage - 1) * pageSize;

  return <div className="h-full overflow-y-auto bg-[#f6f8fb] p-5 font-sans [&_form]:rounded-2xl [&_form]:border-slate-200/70 [&_form]:shadow-[0_6px_24px_-4px_rgba(15,23,42,0.05)]">
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200/70 bg-white p-4 shadow-[0_4px_20px_-2px_rgba(15,23,42,0.04)]"><div className="flex items-center gap-3.5"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-600 to-indigo-500 text-white shadow-sm shadow-indigo-300/40"><FilePlus2 className="h-5 w-5" /></div><div><h1 className="text-lg font-bold leading-tight tracking-tight text-slate-800">{tab === 'new' ? 'New Issue Request' : 'Repair System'}</h1><p className="mt-1 text-xs text-slate-500">Report an issue for approval and repair.</p></div></div></div>
    {mode === 'unconfigured' ? <div className="rounded-xl border border-amber-200 bg-amber-50 p-6"><h2 className="font-semibold text-amber-900">Repair backend configuration required</h2><p className="my-3 text-sm text-amber-800">Google Sheet link, tab name, headers aur column mapping abhi configure nahi hain. Live records save nahi honge.</p><button type="button" className={button} onClick={() => { enableRepairDemo(); setMode(getRepairMode()); }}>Open development demo</button><p className="mt-2 text-xs text-amber-800">Demo data sirf is browser mein save hota hai; Google Sheet se connected nahi hai.</p></div> : <>
      {mode === 'demo' && <p role="status" className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">Development demo mode — browser-only data. Live Google Sheets integration is not configured.</p>}
      {error && <p role="alert" className="mb-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {notice && <p role="status" className="mb-3 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p>}
{tab === 'overview' ? <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{Object.entries(summary).map(([label, count]) => <div key={label} className="rounded-xl border border-slate-100 bg-white p-5 shadow-xs"><p className="text-xs text-slate-500">{label}</p><p className="mt-2 text-3xl font-bold text-indigo-700">{count}</p></div>)}</div> : tab === 'new' ? <form onSubmit={create} className="mx-auto w-full max-w-4xl space-y-6 rounded-2xl border border-slate-200/70 bg-white p-6 sm:p-8"><div className="border-b border-slate-100 pb-5"><p className="text-[11px] font-semibold uppercase tracking-widest text-indigo-600">Repair request</p><h2 className="mt-2 text-lg font-bold text-slate-800">Tell us what needs fixing</h2><p className="mt-1 text-xs leading-5 text-slate-500">Enter the issue details below. Fields marked * are required.</p></div><fieldset disabled={saving || !canRepairAction(currentUser, 'create')} className="space-y-6"><div className="grid gap-5 sm:grid-cols-2"><Field label="Name Of The Person *"><input required value={form.requester} onChange={e => setForm({ ...form, requester: e.target.value })} className={control} /></Field><Field label="Company *"><select required value={form.company} onChange={e => setForm({ ...form, company: e.target.value })} className={control}><option value="">Select company</option>{companies.map(c => <option key={c}>{c}</option>)}</select></Field></div><Field label="Things Not Working *"><textarea required rows={4} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className={control} /></Field><Field label="Location Of Problem (Optional)"><input value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} className={control} /></Field><div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-5"><span className="text-xs text-slate-400">{canRepairAction(currentUser, 'create') ? 'Your request will be sent for approval.' : 'View only. Update access is required to submit.'}</span><button type="submit" className={button}><Plus className="h-4 w-4" />{saving ? 'Saving...' : 'Submit Request'}</button></div></fieldset></form> : <>
        <div className="mb-4 grid gap-3 rounded-xl border border-slate-100 bg-white p-4 sm:grid-cols-3 xl:grid-cols-6"><Field label="Search"><input value={filters.search} onChange={e => filter('search', e.target.value)} placeholder="Serial, requester, issue..." className={control} /></Field><Field label="Company"><select value={filters.company} onChange={e => filter('company', e.target.value)} className={control}><option value="">All companies</option>{companies.map(c => <option key={c}>{c}</option>)}</select></Field><Field label="Overall Status"><select value={filters.status} onChange={e => filter('status', e.target.value)} className={control}><option value="">All statuses</option>{OVERALL.map(s => <option key={s}>{s}</option>)}</select></Field><Field label="Date field (IST)"><select value={filters.dateField} onChange={e => filter('dateField', e.target.value)} className={control}>{[['createdAt', 'Request Date'], ['approval.planned', 'Approval Planned'], ['approval.actual', 'Approval Actual'], ['repair.planned', 'Repair Planned'], ['repair.actual', 'Repair Actual'], ['management.planned', 'Management Planned'], ['management.actual', 'Management Actual']].map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></Field><Field label="From"><input type="date" value={filters.from} onChange={e => filter('from', e.target.value)} className={control} /></Field><Field label="To"><input type="date" value={filters.to} min={filters.from || undefined} onChange={e => filter('to', e.target.value)} className={control} /></Field><button type="button" onClick={() => { setFilters({ search: '', company: '', status: '', dateField: 'createdAt', from: '', to: '' }); setPage(1); }} className="text-left text-xs text-indigo-600">Clear filters</button></div>
        <div className="overflow-hidden rounded-xl border border-slate-100 bg-white"><div className="overflow-x-auto"><table className="w-full text-left text-xs"><thead className="bg-slate-50 text-slate-500"><tr>{(tab === 'mis' ? ['Issue', 'Requester', 'Company', 'Stage', 'Responsible Role', 'Planned', 'Actual', 'Delay / Due in', 'Status'] : ['Issue', 'Requester', 'Company', 'Things Not Working', 'Location', 'Where Have To Solve', ...(tab === 'management' ? ['Repair Remarks', 'Repair Completed'] : []), 'Planned', 'Status', 'Delay / Due in', 'Action']).map(h => <th key={h} className="whitespace-nowrap p-3">{h}</th>)}</tr></thead><tbody>
          {tab === 'mis' ? mis.slice(start, start + pageSize).map(row => <tr key={row.id} className="border-t border-slate-100">{[row.serial, row.requester, row.company, row.stage, row.role, datetime(row.planned), datetime(row.actual), delayText(row), row.status].map((v, i) => <td key={i} className="p-3">{v}</td>)}</tr>) : filtered.slice(start, start + pageSize).map(issue => {
            const stage = selectedStage || REPAIR_STAGES.find(s => stageState(issue, s.key, now).status !== 'Completed' && stageState(issue, s.key, now).applicable) || REPAIR_STAGES[2];
            const state = stageState(issue, stage.key, now);
            return <tr key={issue.id} className="border-t border-slate-100"><td className="whitespace-nowrap p-3 font-semibold">{issue.serial}</td><td className="p-3">{issue.requester}</td><td className="p-3">{issue.company}</td><td className="min-w-48 p-3">{issue.description}</td><td className="p-3">{issue.location || '—'}</td><td className="p-3">{issue.assessment?.whereToSolve || '—'}</td>{tab === 'management' && <><td className="p-3">{issue.repair?.remarks || '—'}</td><td className="p-3">{datetime(issue.repair?.actual)}</td></>}<td className="p-3">{datetime(issue[stage.key]?.planned)}</td><td className="p-3">{selectedStage ? state.status : overallStatus(issue)}</td><td className="p-3">{delayText(state)}</td><td className="p-3"><div className="flex items-center gap-2"><button type="button" onClick={() => viewDetails(issue)} aria-label={`View ${issue.serial}`} className="rounded p-2 text-indigo-600 hover:bg-indigo-50"><Eye className="h-4 w-4" /></button>{selectedStage && canRepairAction(currentUser, permissionAction[tab]) && <button type="button" onClick={() => openAction(issue, tab)} className={`${button} whitespace-nowrap`}>{actionLabels[tab]}</button>}</div></td></tr>;
          })}
          {!total && <tr><td colSpan={12} className="p-10 text-center text-slate-400">No matching issues. Submit a new issue to begin.</td></tr>}
        </tbody></table></div><Pagination currentPage={currentPage} totalItems={total} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={size => { setPageSize(size); setPage(1); }} /></div>
        {selectedStage && !canRepairAction(currentUser, permissionAction[tab]) && <p className="mt-3 text-xs text-slate-500">View only. This action requires the {selectedStage.role} responsibility or Admin access.</p>}
      </>}
    </>}
    <Modal isOpen={Boolean(dialog)} title={dialog ? `${actionLabels[dialog.stage]} — ${dialog.issue.serial}` : ''} onClose={() => { if (!busy.current) setDialog(null); }}>
      {dialog && <form onSubmit={complete} className="space-y-4"><dl className="rounded-lg bg-slate-50 p-3 text-xs"><dt className="font-semibold">{dialog.issue.serial} · {dialog.issue.requester} · {dialog.issue.company}</dt><dd className="mt-2 whitespace-pre-wrap">{dialog.issue.description}</dd><dd className="mt-2">Location: {dialog.issue.location || '—'}</dd></dl><fieldset disabled={saving} className="space-y-4">{dialog.stage === 'approval' ? <><Field label="Problem / Repair Required *"><select value={actionData.repairRequired} onChange={e => setActionData({ ...actionData, repairRequired: e.target.value })} className={control}><option>Yes</option><option>No</option></select></Field><Field label="Where Have To Solve *"><textarea required rows={3} value={actionData.whereToSolve} onChange={e => setActionData({ ...actionData, whereToSolve: e.target.value })} className={control} /></Field></> : <><p className="text-xs">Assessment: {dialog.issue.assessment?.whereToSolve}</p>{dialog.stage === 'repair' ? <Field label="Repair Remarks (Optional)"><textarea rows={3} value={actionData.remarks} onChange={e => setActionData({ ...actionData, remarks: e.target.value })} className={control} /></Field> : <><p className="text-xs">Repair remarks: {dialog.issue.repair?.remarks || '—'}</p><p className="text-xs">Repair completed: {datetime(dialog.issue.repair?.actual)}</p><p className="text-xs">Management planned: {datetime(dialog.issue.management?.planned)}</p><p className="text-sm">Acknowledge completion of this repair?</p></>}</>}{actionError && <p role="alert" className="text-xs text-red-600">{actionError}</p>}<button type="submit" className={button}>{saving ? 'Saving...' : actionLabels[dialog.stage]}</button></fieldset></form>}
    </Modal>
    <Modal isOpen={Boolean(detail)} title={detail ? `Issue Details — ${detail.serial}` : ''} large onClose={() => setDetail(null)}>{detail && <><dl className="grid gap-3 text-xs sm:grid-cols-2">{[['Requester', detail.requester], ['Company', detail.company], ['Request Date', datetime(detail.createdAt)], ['Overall Status', overallStatus(detail)], ['Things Not Working', detail.description], ['Location', detail.location], ['Repair Required', detail.assessment?.repairRequired], ['Where Have To Solve', detail.assessment?.whereToSolve], ['Repair Remarks', detail.repair?.remarks]].map(([label, value]) => <div key={label}><dt className="font-semibold text-slate-500">{label}</dt><dd className="mt-1 whitespace-pre-wrap">{value || '—'}</dd></div>)}</dl><StageTable issue={detail} now={now} /><h3 className="font-semibold">Activity Timeline</h3><ol className="space-y-2">{(detail.activity || []).map((event, i) => <li key={i} className="rounded-lg bg-slate-50 p-3 text-xs"><span className="font-semibold">{event.action} {event.stageKey && `(${event.stageKey})`}</span><p className="mt-1 text-slate-500">{event.actor} · {datetime(event.timestamp)}</p></li>)}</ol></>}</Modal>
  </div>;
}
