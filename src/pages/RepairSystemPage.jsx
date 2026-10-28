import { useEffect, useRef, useState } from 'react';
import { FilePlus2, Plus, Eye, Search, UploadCloud, X, Paperclip } from 'lucide-react';
import { Modal } from '../components/Modal';
import { Pagination } from '../components/Pagination';
import { RepairIssueDetailsModal } from '../components/RepairIssueDetailsModal';
import { ImageAttachmentCell } from '../components/ImageAttachmentCell';
import { dataService } from '../services/dataService';
import { GOOGLE_SHEETS_CONFIG } from '../config/integrationConfig';
import { repairService, getRepairMode, enableRepairDemo, getCachedRepairIssues, subscribeRepairIssues, canRepairAction } from '../services/repairService';
import { OVERALL, REPAIR_STAGES, overallStatus, stageState, delayText, getSummary, getMISRows } from '../utils/repairWorkflow.mjs';
import { formatDisplayDateTime, formatToKolkataDateString } from '../utils/dateUtils';

const control = 'mt-2 w-full rounded-xl border border-slate-200/80 bg-slate-50/70 px-3 py-2.5 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 transition-all';
const button = 'inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-700 px-4 py-2.5 text-xs font-semibold text-white shadow-xs shadow-indigo-300/40 hover:from-indigo-500 hover:to-indigo-600 transition-all cursor-pointer disabled:opacity-50';
const datetime = value => value ? formatDisplayDateTime(value) : '—';

function Field({ label, children }) { return <label className="block text-xs font-semibold text-slate-700">{label}{children}</label>; }

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
  const [newOpen, setNewOpen] = useState(false);
  const [attachments, setAttachments] = useState([]);
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
  // The row is already in the synced list, so open instantly instead of re-reading the whole sheet.
  function viewDetails(issue) { setDetail(issue); }
  async function selectFiles(e) {
    const files = Array.from(e.target.files || []); e.target.value = '';
    try {
      if (attachments.length + files.length > 5) throw new Error('You can attach up to 5 files.');
      for (const file of files) {
        if (!GOOGLE_SHEETS_CONFIG.attachments.allowedMimeTypes.includes(file.type)) throw new Error('Choose PNG, JPG, WEBP or PDF files.');
        if (file.size > GOOGLE_SHEETS_CONFIG.attachments.maxFileSizeBytes) throw new Error(`${file.name} exceeds 10 MB.`);
      }
      const read = file => new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = () => reject(new Error('Unable to read file.')); reader.readAsDataURL(file); });
      const selected = await Promise.all(files.map(async file => ({ id: crypto.randomUUID(), name: file.name, type: file.type, size: file.size, base64Data: await read(file) })));
      setAttachments(prev => [...prev, ...selected]); setError('');
    } catch (err) { setError(err.message); }
  }
  async function create(e) {
    e.preventDefault(); if (busy.current) return;
    busy.current = true; setSaving(true); setError('');
    try {
      // Files go to the shared Drive folder first; only their links are saved with the issue.
      const uploaded = [];
      for (const att of attachments) {
        const result = att.base64Data ? await dataService.uploadAttachment({ ...att, previewUrl: att.base64Data }) : att;
        uploaded.push({ name: result.name || att.name, url: result.driveUrl || result.url, type: result.type || att.type, fileId: result.fileId });
      }
      await repairService.createIssue({ ...form, attachments: uploaded }, currentUser, createKey.current);
      createKey.current = crypto.randomUUID();
      setForm({ requester: currentUser.fullName || '', company: '', description: '', location: '' });
      setAttachments([]);
      setNotice('Submitted'); setNewOpen(false);
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
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200/70 bg-white p-4 shadow-[0_4px_20px_-2px_rgba(15,23,42,0.04)]"><div className="flex items-center gap-3.5"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-600 to-indigo-500 text-white shadow-sm shadow-indigo-300/40"><FilePlus2 className="h-5 w-5" /></div><div><h1 className="text-lg font-bold leading-tight tracking-tight text-slate-800">{tab === 'new' ? 'New Issue Request' : 'Repair System'}</h1><p className="mt-1 text-xs text-slate-500"></p></div></div>{tab === 'new' && <button type="button" onClick={() => { setNotice(''); setError(''); setNewOpen(true); }} className={button}><Plus className="h-4 w-4" />New Issue Request</button>}</div>
    {mode === 'unconfigured' ? <div className="rounded-xl border border-amber-200 bg-amber-50 p-6"><h2 className="font-semibold text-amber-900">Repair backend configuration required</h2><p className="my-3 text-sm text-amber-800">Google Sheet link, tab name, headers aur column mapping abhi configure nahi hain. Live records save nahi honge.</p><button type="button" className={button} onClick={() => { enableRepairDemo(); setMode(getRepairMode()); }}>Open development demo</button><p className="mt-2 text-xs text-amber-800">Demo data sirf is browser mein save hota hai; Google Sheet se connected nahi hai.</p></div> : <>
      {mode === 'demo' && <p role="status" className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">Development demo mode — browser-only data. Live Google Sheets integration is not configured.</p>}
      {error && <p role="alert" className="mb-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {notice && <p role="status" className="mb-3 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p>}
      {tab === 'overview' ? <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{Object.entries(summary).map(([label, count]) => <div key={label} className="rounded-xl border border-slate-100 bg-white p-5 shadow-xs"><p className="text-xs text-slate-500">{label}</p><p className="mt-2 text-3xl font-bold text-indigo-700">{count}</p></div>)}</div> : tab === 'new' ? (() => { const rows = issues.filter(i => !filters.search || [i.serial, i.requester, i.company, i.description, i.location].join(' ').toLowerCase().includes(filters.search.toLowerCase())); return <div className="rounded-xl border border-slate-100 bg-white"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-4"><h2 className="text-sm font-bold text-slate-800">History <span className="ml-2 rounded-full bg-indigo-50 px-2 py-1 text-xs text-indigo-600">{rows.length}</span></h2><div className="relative w-full sm:w-64"><Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input aria-label="Search history" value={filters.search} onChange={e => filter('search', e.target.value)} placeholder="Search serial, requester, issue..." className="w-full rounded-xl border border-slate-200/80 bg-slate-50/70 py-2 pl-9 pr-3 text-xs" /></div></div><div className="overflow-x-auto"><table className="cards-on-phone w-full text-left text-xs"><thead className="bg-slate-50 text-slate-500"><tr>{['Issue', 'Requester', 'Company', 'Things Not Working', 'Location', 'Image', 'Where Have To Solve', 'Assigned Developer', 'Status', 'Request Date', 'Action'].map(h => <th key={h} className="whitespace-nowrap p-3">{h}</th>)}</tr></thead><tbody>{rows.slice((Math.min(page, Math.max(1, Math.ceil(rows.length / pageSize))) - 1) * pageSize).slice(0, pageSize).map(issue => <tr key={issue.id} className="border-t border-slate-100"><td data-label="Issue" className="whitespace-nowrap p-3 font-semibold">{issue.serial}</td><td data-label="Requester" className="p-3">{issue.requester}</td><td data-label="Company" className="p-3">{issue.company}</td><td data-label="Problem" className="min-w-48 whitespace-pre-wrap p-3">{issue.description}</td><td data-label="Location" className="p-3">{issue.location || '—'}</td><td data-label="Image" className="p-3"><ImageAttachmentCell attachments={issue.attachments} showAsTd={false} /></td><td data-label="Where To Solve" className="p-3">{issue.assessment?.whereToSolve || '—'}</td><td data-label="Assigned Developer" className="p-3">{issue.assessment?.assignedDeveloper || '—'}</td><td data-label="Status" className="p-3">{overallStatus(issue)}</td><td data-label="Request Date" className="whitespace-nowrap p-3">{datetime(issue.createdAt)}</td><td data-label="Action" className="p-3"><button type="button" onClick={() => viewDetails(issue)} aria-label={`View ${issue.serial}`} className="rounded p-2 text-indigo-600 hover:bg-indigo-50"><Eye className="h-4 w-4" /></button></td></tr>)}{!rows.length && <tr><td colSpan={11} className="p-10 text-center text-slate-400">No issue requests yet.</td></tr>}</tbody></table></div><Pagination currentPage={Math.min(page, Math.max(1, Math.ceil(rows.length / pageSize)))} totalItems={rows.length} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={size => { setPageSize(size); setPage(1); }} /></div>; })() : <>
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
    <Modal isOpen={newOpen} title="New Issue Request" subtitle="    " closeOnBackdrop={false} onClose={() => { if (!busy.current) setNewOpen(false); }}>{error && <p role="alert" className="mb-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}<form onSubmit={create} className="space-y-6"><fieldset disabled={saving || !canRepairAction(currentUser, 'create')} className="space-y-6"><div className="grid gap-5 sm:grid-cols-2"><Field label="Name of Requester *"><input required value={form.requester} onChange={e => setForm({ ...form, requester: e.target.value })} className={control} /></Field><Field label="Company *"><select required value={form.company} onChange={e => setForm({ ...form, company: e.target.value })} className={control}><option value="">Select company</option>{companies.map(c => <option key={c}>{c}</option>)}</select></Field></div><Field label="Things Not Working *"><textarea required rows={4} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className={control} /></Field><Field label="Location Of Problem (Optional)"><input value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} className={control} /></Field><div><p className="text-xs font-semibold text-slate-700">Photos / PDF (Optional)</p><label className="relative mt-2 flex min-h-24 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-slate-300 bg-slate-50/70 p-4 text-center focus-within:ring-2 focus-within:ring-indigo-200"><UploadCloud className="h-6 w-6 text-indigo-500" /><span className="text-xs font-semibold text-slate-700">Click to upload image or PDF</span><span className="text-[11px] text-slate-500">PNG, JPG, WEBP or PDF · up to 5 files · 10 MB each</span><input type="file" multiple aria-label="Upload photos or PDFs" accept="image/png,image/jpeg,image/webp,application/pdf" onChange={selectFiles} className="absolute inset-0 h-full w-full cursor-pointer opacity-0" /></label>{attachments.map(file => <div key={file.id} className="mt-2 flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2 text-xs"><span className="flex min-w-0 items-center gap-2"><Paperclip className="h-3.5 w-3.5 shrink-0 text-slate-400" /><span className="truncate">{file.name}</span></span><button type="button" aria-label={`Remove ${file.name}`} onClick={() => setAttachments(prev => prev.filter(a => a.id !== file.id))} className="ml-3 p-1 text-slate-500 hover:text-rose-600"><X className="h-4 w-4" /></button></div>)}</div><div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-5"><span className="text-xs text-slate-400">{canRepairAction(currentUser, 'create') ? 'Your request will be sent for approval.' : 'View only. Update access is required to submit.'}</span><button type="submit" className={button}><Plus className="h-4 w-4" />{saving ? (attachments.length ? 'Uploading & saving...' : 'Saving...') : 'Submit Request'}</button></div></fieldset></form></Modal>
    <Modal isOpen={Boolean(dialog)} title={dialog ? `${actionLabels[dialog.stage]} — ${dialog.issue.serial}` : ''} onClose={() => { if (!busy.current) setDialog(null); }}>
      {dialog && <form onSubmit={complete} className="space-y-4"><dl className="rounded-lg bg-slate-50 p-3 text-xs"><dt className="font-semibold">{dialog.issue.serial} · {dialog.issue.requester} · {dialog.issue.company}</dt><dd className="mt-2 whitespace-pre-wrap">{dialog.issue.description}</dd><dd className="mt-2">Location: {dialog.issue.location || '—'}</dd></dl><fieldset disabled={saving} className="space-y-4">{dialog.stage === 'approval' ? <><Field label="Problem / Repair Required *"><select value={actionData.repairRequired} onChange={e => setActionData({ ...actionData, repairRequired: e.target.value })} className={control}><option>Yes</option><option>No</option></select></Field><Field label="Where Have To Solve *"><textarea required rows={3} value={actionData.whereToSolve} onChange={e => setActionData({ ...actionData, whereToSolve: e.target.value })} className={control} /></Field></> : <><p className="text-xs">Assessment: {dialog.issue.assessment?.whereToSolve}</p>{dialog.stage === 'repair' ? <Field label="Repair Remarks (Optional)"><textarea rows={3} value={actionData.remarks} onChange={e => setActionData({ ...actionData, remarks: e.target.value })} className={control} /></Field> : <><p className="text-xs">Repair remarks: {dialog.issue.repair?.remarks || '—'}</p><p className="text-xs">Repair completed: {datetime(dialog.issue.repair?.actual)}</p><p className="text-xs">Management planned: {datetime(dialog.issue.management?.planned)}</p><p className="text-sm">Acknowledge completion of this repair?</p></>}</>}{actionError && <p role="alert" className="text-xs text-red-600">{actionError}</p>}<button type="submit" className={button}>{saving ? 'Saving...' : actionLabels[dialog.stage]}</button></fieldset></form>}
    </Modal>
    {detail && <RepairIssueDetailsModal issue={detail} now={now} onClose={() => setDetail(null)} />}
  </div>;
}
