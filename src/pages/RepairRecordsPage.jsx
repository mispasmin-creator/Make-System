import { useEffect, useRef, useState } from 'react';
import { BadgeCheck, ClipboardCheck, Plus } from 'lucide-react';
import { repairService, getCachedRepairIssues, subscribeRepairIssues, getRepairMode, enableRepairDemo, canRepairAction } from '../services/repairService';
import { Pagination } from '../components/Pagination';
import { Modal } from '../components/Modal';
import { formatDisplayDateTime } from '../utils/dateUtils';

const button = 'inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-700 px-4 py-2.5 text-xs font-semibold text-white shadow-xs shadow-indigo-300/40 hover:from-indigo-500 hover:to-indigo-600 transition-all cursor-pointer disabled:opacity-50';
const control = 'mt-2 w-full rounded-xl border border-slate-200/80 bg-slate-50/70 px-3 py-2.5 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 transition-all';

function RecordsTable({ title, records, stage, onAction, canAct }) {
  const [page, setPage] = useState(1);
  const current = Math.min(page, Math.max(1, Math.ceil(records.length / 10)));
  const history = title === 'History';
  const headings = ['Sr No.', 'Name Of The Person', 'Company', 'Things Not Working', 'Location Of Problem'];
  if (stage === 'repair' || history) headings.push('Problem', 'Where Have To Solve');
  if (history) headings.push(...(stage === 'repair' ? ['Problem Resolve Remark', 'Resolved At'] : ['Approval At']));
  else headings.push('Action');
  return <section className="flex flex-1 min-h-0 flex-col overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-[0_6px_24px_-4px_rgba(15,23,42,0.05),0_2px_8px_-1px_rgba(15,23,42,0.02)]">
    <h2 className="border-b border-slate-100 px-5 py-4 text-sm font-bold text-slate-800">{title} <span className="ml-2 rounded-full bg-indigo-50 px-2 py-1 text-xs text-indigo-600">{records.length}</span></h2>
    <div className="flex-1 overflow-auto"><table className="w-full border-collapse text-left text-xs"><thead className="sticky top-0 z-10 border-b border-slate-200/70 bg-slate-50 shadow-xs"><tr>{headings.map(h => <th key={h} className="whitespace-nowrap px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-600">{h}</th>)}</tr></thead><tbody className="text-slate-600 [&>tr]:transition-colors [&>tr:hover]:bg-slate-50/80">
      {records.slice((current - 1) * 10, current * 10).map(issue => <tr key={issue.id} className="border-t border-slate-100"><td className="whitespace-nowrap px-5 py-4 font-semibold text-indigo-700">{issue.serial}</td><td className="px-5 py-4">{issue.requester}</td><td className="px-5 py-4">{issue.company}</td><td className="min-w-56 whitespace-pre-wrap px-5 py-4">{issue.description}</td><td className="px-5 py-4">{issue.location || '—'}</td>
        {(stage === 'repair' || history) && <><td className="px-5 py-4">{issue.assessment?.repairRequired || '—'}</td><td className="whitespace-pre-wrap px-5 py-4">{issue.assessment?.whereToSolve || '—'}</td></>}
        {history ? <>{stage === 'repair' && <td className="whitespace-pre-wrap px-5 py-4">{issue.repair?.remarks || '—'}</td>}<td className="whitespace-nowrap px-5 py-4">{formatDisplayDateTime(issue[stage]?.actual)}</td></> : <td className="px-5 py-4">{canAct ? <button type="button" onClick={() => onAction(issue)} className={`${button} whitespace-nowrap`}>{stage === 'approval' ? 'Approve' : 'Resolve Problem'}</button> : <span className="text-slate-400">View only</span>}</td>}
      </tr>)}
      {!records.length && <tr><td colSpan={headings.length} className="p-8 text-center text-slate-400">No {title.toLowerCase()} records.</td></tr>}
    </tbody></table></div><Pagination currentPage={current} pageSize={10} totalItems={records.length} onPageChange={setPage} />
  </section>;
}

export function RepairRecordsPage({ onNavigate, currentUser, stage = 'approval' }) {
  const [issues, setIssues] = useState(getCachedRepairIssues);
  const [mode, setMode] = useState(getRepairMode);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState({ repairRequired: 'Yes', whereToSolve: '', remarks: '' });
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('pending');
  const busy = useRef(false);
  const approval = stage === 'approval';
  const title = approval ? 'Approval For Repair' : 'Resolve Problem';
  const canAct = canRepairAction(currentUser, approval ? 'assessment' : 'repair');
  useEffect(() => {
    let active = true;
    let refreshing = false;
    const unsubscribe = subscribeRepairIssues(data => { if (active) setIssues(data); });
    async function refresh() {
      if (refreshing || document.hidden || busy.current || getRepairMode() === 'unconfigured') return;
      refreshing = true;
      try { await repairService.listIssues(); if (active) setError(''); }
      catch (err) { if (active) setError(err.message); }
      finally { refreshing = false; }
    }
    refresh();
    const interval = setInterval(refresh, 15000);
    window.addEventListener('focus', refresh);
    return () => { active = false; unsubscribe(); clearInterval(interval); window.removeEventListener('focus', refresh); };
  }, [mode]);

  function open(issue) {
    setSelected(issue); setForm({ repairRequired: 'Yes', whereToSolve: '', remarks: '' }); setFormError('');
  }
  async function submit(e) {
    e.preventDefault(); if (busy.current || !selected) return;
    if (approval ? !form.whereToSolve.trim() : !form.remarks.trim()) { setFormError(approval ? 'Where Have To Solve is required.' : 'Problem Resolve Remark is required.'); return; }
    busy.current = true; setSaving(true); setFormError('');
    try {
      if (approval) await repairService.submitAssessment(selected.id, form, currentUser, selected.version);
      else await repairService.completeRepair(selected.id, form, currentUser, selected.version);
      setMessage('Submitted');
      setSelected(null);
    } catch (err) { setFormError(err.message); }
    finally { busy.current = false; setSaving(false); }
  }
  const eligible = approval ? issues : issues.filter(issue => issue.approval?.actual && issue.assessment?.repairRequired === 'Yes');
  const pending = eligible.filter(issue => !issue[stage]?.actual);
  const history = eligible.filter(issue => Boolean(issue[stage]?.actual));
  return <div className="h-full flex flex-col space-y-4 overflow-hidden bg-[#f6f8fb] p-5 font-sans">
    <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200/70 bg-white p-4 shadow-[0_4px_20px_-2px_rgba(15,23,42,0.04)]"><div className="flex items-center gap-3.5"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-600 to-indigo-500 text-white shadow-sm shadow-indigo-300/40">{approval ? <ClipboardCheck className="h-5 w-5" /> : <BadgeCheck className="h-5 w-5" />}</div><div><h1 className="text-lg font-bold leading-tight tracking-tight text-slate-800">{title}</h1><p className="mt-1 text-xs text-slate-500">{approval ? ' ' : '    '}</p></div></div><button type="button" onClick={() => onNavigate('repair-new')} className={button}><Plus className="h-4 w-4" />New Issue Request</button></div>
    {mode === 'unconfigured' ? <div className="rounded-xl border border-amber-200 bg-amber-50 p-5"><p className="mb-3 text-sm text-amber-900">Repair backend configuration pending. Sheet link aur mapping dene ke baad live saving connect hogi.</p><button type="button" onClick={() => { enableRepairDemo(); setMode(getRepairMode()); }} className={button}>Open development demo</button></div> : <>
      {mode === 'demo' && <p className="rounded-lg bg-amber-50 p-3 text-xs text-amber-900">Development demo — browser-only data, not connected to Google Sheets.</p>}
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}{message && <p role="status" className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">{message}</p>}
      <div className="flex shrink-0 items-center justify-between rounded-2xl border border-slate-200/70 bg-white p-3 shadow-xs"><div className="inline-flex gap-1 rounded-xl border border-slate-200/70 bg-slate-100/80 p-1.5">{[['pending', 'Pending', pending.length], ['history', 'History', history.length]].map(([key, label, count]) => <button key={key} type="button" aria-pressed={activeTab === key} onClick={() => setActiveTab(key)} className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all cursor-pointer ${activeTab === key ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}>{label} ({count})</button>)}</div><span className="hidden text-xs text-slate-400 sm:block">{issues.length} total requests</span></div>
      <RecordsTable key={activeTab} title={activeTab === 'pending' ? 'Pending' : 'History'} records={activeTab === 'pending' ? pending : history} stage={stage} canAct={canAct} onAction={open} />
    </>}
    <Modal isOpen={Boolean(selected)} title={`${approval ? 'Approval For Repair' : 'Resolve Problem'} — ${selected?.serial || ''}`} onClose={() => { if (!busy.current) setSelected(null); }}>
      {selected && <form onSubmit={submit} className="space-y-4"><div className="rounded-lg bg-slate-50 p-3 text-xs"><p className="font-semibold">{selected.requester} · {selected.company}</p><p className="mt-2 whitespace-pre-wrap">{selected.description}</p><p className="mt-2">Location: {selected.location || '—'}</p></div><fieldset disabled={saving} className="space-y-4">
        {approval ? <><label className="block text-xs font-semibold">Problem *<select value={form.repairRequired} onChange={e => setForm({ ...form, repairRequired: e.target.value })} className={control}><option>Yes</option><option>No</option></select></label><label className="block text-xs font-semibold">Where Have To Solve *<textarea required rows={3} value={form.whereToSolve} onChange={e => setForm({ ...form, whereToSolve: e.target.value })} className={control} /></label></> : <><p className="text-xs">Where Have To Solve: {selected.assessment?.whereToSolve}</p><label className="block text-xs font-semibold">Problem Resolve Remark *<textarea required rows={4} value={form.remarks} onChange={e => setForm({ ...form, remarks: e.target.value })} className={control} /></label></>}
        {formError && <p role="alert" className="text-xs text-red-600">{formError}</p>}<div className="flex justify-end gap-2"><button type="button" onClick={() => setSelected(null)} className="rounded-lg border border-slate-200 px-4 py-2 text-xs">Cancel</button><button type="submit" className={button}>{saving ? 'Saving...' : approval ? 'Submit Approval' : 'Submit Resolution'}</button></div>
      </fieldset></form>}
    </Modal>
  </div>;
}
