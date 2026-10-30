import { useEffect, useRef, useState } from 'react';
import { BadgeCheck, ClipboardCheck, Plus, Eye, CheckCircle } from 'lucide-react';
import { repairService, getCachedRepairIssues, subscribeRepairIssues, getRepairMode, enableRepairDemo, canRepairAction } from '../services/repairService';
import { Pagination } from '../components/Pagination';
import { Modal } from '../components/Modal';
import { ImageAttachmentCell } from '../components/ImageAttachmentCell';
import { formatDisplayDateTime } from '../utils/dateUtils';

const button = 'inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-700 px-4 py-2.5 text-xs font-semibold text-white shadow-xs shadow-indigo-300/40 hover:from-indigo-500 hover:to-indigo-600 transition-all cursor-pointer disabled:opacity-50';
const control = 'mt-2 w-full rounded-xl border border-slate-200/80 bg-slate-50/70 px-3 py-2.5 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 transition-all';

function RecordsTable({ title, records, stage, onAction, canAct }) {
  const [page, setPage] = useState(1);
  const current = Math.min(page, Math.max(1, Math.ceil(records.length / 10)));
  const history = title === 'History';
  const headings = ['Sr No.', 'Name of Requester', 'Company', 'Things Not Working', 'Location Of Problem', 'Image'];
  if (stage === 'repair' || history) headings.push('Problem', 'Where Have To Solve', 'Assigned Developer');
  if (history) headings.push(...(stage === 'repair' ? ['Problem Resolve Remark', 'Resolved At'] : ['Approval At']));
  else headings.push('Action');

  const pagedRecords = records.slice((current - 1) * 10, current * 10);

  return (
    <section className="flex flex-1 min-h-0 flex-col overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-[0_6px_24px_-4px_rgba(15,23,42,0.05),0_2px_8px_-1px_rgba(15,23,42,0.02)]">
      <div className="flex items-center justify-between border-b border-slate-100 px-4 sm:px-5 py-3 sm:py-4">
        <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
          <span>{title}</span>
          <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-bold text-indigo-600 border border-indigo-100">
            {records.length}
          </span>
        </h2>
      </div>

      {/* MOBILE SLIM HORIZONTAL ROWS (md:hidden) */}
      <div className="md:hidden flex-1 overflow-y-auto divide-y divide-slate-100 bg-white">
        {records.length === 0 ? (
          <div className="p-8 text-center text-slate-400">
            No {title.toLowerCase()} records.
          </div>
        ) : (
          records.map((issue) => {
            const isCompleted = Boolean(issue[stage]?.actual);

            return (
              <div
                key={issue.id}
                onClick={() => onAction(issue)}
                className="px-3 py-2.5 hover:bg-slate-50/80 active:bg-slate-100/70 flex items-center justify-between gap-2.5 transition-colors cursor-pointer"
              >
                {/* Left: Serial Badge & Text info */}
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <span className="font-mono font-bold text-xs text-indigo-700 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-lg shrink-0">
                    {issue.serial}
                  </span>

                  <div className="min-w-0 flex-1">
                    {/* Line 1: Title & Status */}
                    <div className="flex items-center gap-1.5">
                      <h4 className="text-xs font-bold text-slate-800 truncate leading-snug">
                        {issue.description || 'No description'}
                      </h4>
                      <span
                        className={`px-1.5 py-0.2 rounded text-[9px] font-bold shrink-0 ${
                          isCompleted
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {isCompleted ? 'Done' : 'Pending'}
                      </span>
                    </div>

                    {/* Line 2: Requester • Company • Location */}
                    <div className="text-[11px] text-slate-500 truncate mt-0.5 flex items-center gap-1.5">
                      <span className="font-medium text-slate-700 truncate">{issue.requester || '—'}</span>
                      <span>•</span>
                      <span className="truncate">{issue.company || '—'}</span>
                      {issue.location && (
                        <>
                          <span>•</span>
                          <span className="text-slate-400 truncate">{issue.location}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right: Action Button */}
                <div className="shrink-0 flex items-center">
                  {!isCompleted && canAct ? (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onAction(issue);
                      }}
                      className="px-3 py-1.5 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-xs active:scale-95 transition-all whitespace-nowrap cursor-pointer"
                    >
                      {stage === 'approval' ? 'Approve' : 'Resolve'}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onAction(issue);
                      }}
                      className="px-2.5 py-1.5 rounded-xl text-xs font-semibold text-slate-600 bg-slate-50 hover:bg-slate-100 border border-slate-200/80 active:scale-95 transition-all whitespace-nowrap cursor-pointer inline-flex items-center gap-1"
                    >
                      <Eye className="w-3 h-3 text-indigo-600" />
                      <span>Details</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* DESKTOP DATA TABLE (hidden on mobile) */}
      <div className="hidden md:block flex-1 overflow-auto">
        <table className="w-full border-collapse text-left text-xs">
          <thead className="sticky top-0 z-10 border-b border-slate-200/70 bg-slate-50 shadow-xs">
            <tr>
              {headings.map(h => (
                <th key={h} className="whitespace-nowrap px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-600">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="text-slate-600 [&>tr]:transition-colors [&>tr:hover]:bg-slate-50/80">
            {pagedRecords.map(issue => (
              <tr key={issue.id} className="border-t border-slate-100">
                <td className="whitespace-nowrap px-5 py-4 font-semibold text-indigo-700">{issue.serial}</td>
                <td className="px-5 py-4">{issue.requester}</td>
                <td className="px-5 py-4">{issue.company}</td>
                <td className="min-w-56 whitespace-pre-wrap px-5 py-4">{issue.description}</td>
                <td className="px-5 py-4">{issue.location || '—'}</td>
                <td className="px-5 py-4"><ImageAttachmentCell attachments={issue.attachments} showAsTd={false} /></td>
                {(stage === 'repair' || history) && (
                  <>
                    <td className="px-5 py-4">{issue.assessment?.repairRequired || '—'}</td>
                    <td className="whitespace-pre-wrap px-5 py-4">{issue.assessment?.whereToSolve || '—'}</td>
                    <td className="px-5 py-4">{issue.assessment?.assignedDeveloper || '—'}</td>
                  </>
                )}
                {history ? (
                  <>
                    {stage === 'repair' && <td className="whitespace-pre-wrap px-5 py-4">{issue.repair?.remarks || '—'}</td>}
                    <td className="whitespace-nowrap px-5 py-4">{formatDisplayDateTime(issue[stage]?.actual)}</td>
                  </>
                ) : (
                  <td className="px-5 py-4">
                    {canAct ? (
                      <button type="button" onClick={() => onAction(issue)} className={`${button} whitespace-nowrap`}>
                        {stage === 'approval' ? 'Approve' : 'Resolve Problem'}
                      </button>
                    ) : (
                      <span className="text-slate-400">View only</span>
                    )}
                  </td>
                )}
              </tr>
            ))}
            {!records.length && (
              <tr>
                <td colSpan={headings.length} className="p-8 text-center text-slate-400">
                  No {title.toLowerCase()} records.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Pagination currentPage={current} pageSize={10} totalItems={records.length} onPageChange={setPage} />
    </section>
  );
}

export function RepairRecordsPage({ onNavigate, currentUser, stage = 'approval', developerOptions = [] }) {
  const [issues, setIssues] = useState(getCachedRepairIssues);
  const [mode, setMode] = useState(getRepairMode);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState({ repairRequired: 'Yes', whereToSolve: '', assignedDeveloper: '', remarks: '' });
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
    setSelected(issue); setForm({ repairRequired: 'Yes', whereToSolve: '', assignedDeveloper: '', remarks: '' }); setFormError('');
  }

  async function submit(e) {
    e.preventDefault(); if (busy.current || !selected) return;
    if (approval && form.repairRequired === 'Yes' && !form.assignedDeveloper) { setFormError('Please assign a developer.'); return; }
    if (approval ? !form.whereToSolve.trim() : !form.remarks.trim()) { setFormError(approval ? 'Where Have To Solve is required.' : 'Problem Resolve Remark is required.'); return; }
    busy.current = true; setSaving(true); setFormError('');
    try {
      if (approval) await repairService.submitAssessment(selected.id, form, currentUser, selected.version);
      else await repairService.completeRepair(selected.id, form, currentUser, selected.version);
      setMessage('Submitted successfully');
      setSelected(null);
    } catch (err) { setFormError(err.message); }
    finally { busy.current = false; setSaving(false); }
  }

  const eligible = approval ? issues : issues.filter(issue => issue.approval?.actual && issue.assessment?.repairRequired === 'Yes');
  const pending = eligible.filter(issue => !issue[stage]?.actual);
  const history = eligible.filter(issue => Boolean(issue[stage]?.actual));

  return (
    <div className="h-full flex flex-col space-y-3 sm:space-y-4 overflow-hidden bg-[#f6f8fb] p-3 sm:p-5 font-sans">
      {/* Header */}
      <div className="flex shrink-0 flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 rounded-2xl border border-slate-200/70 bg-white p-3.5 sm:p-4 shadow-[0_4px_20px_-2px_rgba(15,23,42,0.04)]">
        <div className="flex items-center gap-3.5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-600 to-indigo-500 text-white shadow-sm shadow-indigo-300/40">
            {approval ? <ClipboardCheck className="h-5 w-5" /> : <BadgeCheck className="h-5 w-5" />}
          </div>
          <div>
            <h1 className="text-base sm:text-lg font-bold leading-tight tracking-tight text-slate-800">{title}</h1>
            <p className="mt-0.5 text-xs text-slate-500">System Repair FMS</p>
          </div>
        </div>
        <button type="button" onClick={() => onNavigate('repair-new')} className={`${button} justify-center w-full sm:w-auto`}>
          <Plus className="h-4 w-4" />
          <span>New Issue Request</span>
        </button>
      </div>

      {mode === 'unconfigured' ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-5">
          <p className="mb-3 text-sm text-amber-900">Repair backend configuration pending. Sheet link aur mapping dene ke baad live saving connect hogi.</p>
          <button type="button" onClick={() => { enableRepairDemo(); setMode(getRepairMode()); }} className={button}>
            Open development demo
          </button>
        </div>
      ) : (
        <>
          {mode === 'demo' && (
            <p className="rounded-lg bg-amber-50 p-2.5 text-xs text-amber-900">Development demo — browser-only data, not connected to Google Sheets.</p>
          )}
          {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
          {message && <p role="status" className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">{message}</p>}

          {/* Tab Selector */}
          <div className="flex shrink-0 items-center justify-between rounded-2xl border border-slate-200/70 bg-white p-2 sm:p-3 shadow-xs">
            <div className="inline-flex gap-1 rounded-xl border border-slate-200/70 bg-slate-100/80 p-1">
              {[['pending', 'Pending', pending.length], ['history', 'History', history.length]].map(([key, label, count]) => (
                <button
                  key={key}
                  type="button"
                  aria-pressed={activeTab === key}
                  onClick={() => setActiveTab(key)}
                  className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
                    activeTab === key
                      ? 'bg-white text-indigo-700 shadow-xs font-bold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {label} ({count})
                </button>
              ))}
            </div>
            <span className="hidden text-xs text-slate-400 sm:block">{issues.length} total requests</span>
          </div>

          <RecordsTable
            key={activeTab}
            title={activeTab === 'pending' ? 'Pending' : 'History'}
            records={activeTab === 'pending' ? pending : history}
            stage={stage}
            canAct={canAct}
            onAction={open}
          />
        </>
      )}

      {/* Action / Details Modal */}
      <Modal
        isOpen={Boolean(selected)}
        title={`${approval ? 'Approval For Repair' : 'Resolve Problem'} — ${selected?.serial || ''}`}
        onClose={() => { if (!busy.current) setSelected(null); }}
      >
        {selected && (
          selected[stage]?.actual ? (
            /* Read-only Details View for History records */
            <div className="space-y-3 text-xs">
              <div className="rounded-xl bg-slate-50 border border-slate-200/80 p-3.5 space-y-1.5">
                <p className="font-bold text-slate-800 text-sm">{selected.requester} · {selected.company}</p>
                <p className="text-slate-700 whitespace-pre-wrap">{selected.description}</p>
                <p className="text-slate-500">Location: {selected.location || '—'}</p>
              </div>

              <div className="p-3.5 bg-emerald-50/80 rounded-xl border border-emerald-200/80 space-y-1.5 text-emerald-950">
                <p className="font-bold text-emerald-900 flex items-center gap-1.5">
                  <CheckCircle className="w-4 h-4 text-emerald-600" />
                  <span>{approval ? 'Approved Record' : 'Resolved Record'}</span>
                </p>
                <p className="text-[11px] text-emerald-800">
                  Completed At: {formatDisplayDateTime(selected[stage]?.actual)}
                </p>
                {selected.assessment?.assignedDeveloper && (
                  <p><strong>Assigned Developer:</strong> {selected.assessment.assignedDeveloper}</p>
                )}
                {selected.assessment?.whereToSolve && (
                  <p><strong>Where To Solve:</strong> {selected.assessment.whereToSolve}</p>
                )}
                {selected.repair?.remarks && (
                  <p><strong>Resolution Remarks:</strong> {selected.repair.remarks}</p>
                )}
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setSelected(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-xl text-xs font-semibold text-slate-700 cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          ) : (
            /* Action form for Pending records */
            <form onSubmit={submit} className="space-y-4">
              <div className="rounded-xl bg-slate-50 border border-slate-200/70 p-3 text-xs space-y-1">
                <p className="font-bold text-slate-800">{selected.requester} · {selected.company}</p>
                <p className="text-slate-700 whitespace-pre-wrap">{selected.description}</p>
                <p className="text-slate-500">Location: {selected.location || '—'}</p>
              </div>
              <fieldset disabled={saving} className="space-y-4">
                {approval ? (
                  <>
                    <label className="block text-xs font-semibold text-slate-700">
                      Repair Required *
                      <select
                        value={form.repairRequired}
                        onChange={e => setForm({ ...form, repairRequired: e.target.value })}
                        className={control}
                      >
                        <option>Yes</option>
                        <option>No</option>
                      </select>
                    </label>
                    {form.repairRequired === 'Yes' && (
                      <label className="block text-xs font-semibold text-slate-700">
                        Assign Developer *
                        <select
                          required
                          value={form.assignedDeveloper}
                          onChange={e => setForm({ ...form, assignedDeveloper: e.target.value })}
                          className={control}
                        >
                          <option value="">Select developer</option>
                          {developerOptions.map(d => <option key={d} value={d}>{d}</option>)}
                        </select>
                      </label>
                    )}
                    <label className="block text-xs font-semibold text-slate-700">
                      Where Have To Solve *
                      <textarea
                        required
                        rows={3}
                        value={form.whereToSolve}
                        onChange={e => setForm({ ...form, whereToSolve: e.target.value })}
                        className={control}
                        placeholder="Specify location / file / system area"
                      />
                    </label>
                  </>
                ) : (
                  <>
                    <div className="p-2.5 bg-indigo-50/60 rounded-xl border border-indigo-100 text-xs space-y-1">
                      <p className="text-slate-700"><strong className="text-indigo-900">Where Have To Solve:</strong> {selected.assessment?.whereToSolve || '—'}</p>
                      <p className="text-slate-700"><strong className="text-indigo-900">Assigned Developer:</strong> {selected.assessment?.assignedDeveloper || '—'}</p>
                    </div>
                    <label className="block text-xs font-semibold text-slate-700">
                      Problem Resolve Remark *
                      <textarea
                        required
                        rows={4}
                        value={form.remarks}
                        onChange={e => setForm({ ...form, remarks: e.target.value })}
                        className={control}
                        placeholder="Enter resolution notes and steps taken"
                      />
                    </label>
                  </>
                )}
                {formError && <p role="alert" className="text-xs text-red-600 font-semibold">{formError}</p>}
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setSelected(null)}
                    className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold hover:bg-slate-50 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button type="submit" className={button}>
                    {saving ? 'Saving...' : approval ? 'Submit Approval' : 'Submit Resolution'}
                  </button>
                </div>
              </fieldset>
            </form>
          )
        )}
      </Modal>
    </div>
  );
}
