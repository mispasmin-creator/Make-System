import { Building, User, MapPin, Wrench, CheckCircle2, Clock, AlertTriangle, CircleDashed, FileText, Paperclip, ExternalLink } from 'lucide-react';
import { Modal } from './Modal';
import { REPAIR_STAGES, overallStatus, stageState, delayText } from '../utils/repairWorkflow.mjs';
import { formatDisplayDateTime } from '../utils/dateUtils';

const datetime = value => value ? formatDisplayDateTime(value) : '—';
const STAGES_SHOWN = REPAIR_STAGES.filter(stage => stage.key !== 'management');

const STATUS_STYLE = {
  Completed: { icon: CheckCircle2, ring: 'border-emerald-200 bg-emerald-50 text-emerald-700', dot: 'bg-emerald-500' },
  Pending: { icon: Clock, ring: 'border-indigo-200 bg-indigo-50 text-indigo-700', dot: 'bg-indigo-500' },
  Overdue: { icon: AlertTriangle, ring: 'border-rose-200 bg-rose-50 text-rose-700', dot: 'bg-rose-500' },
  'Not Started': { icon: CircleDashed, ring: 'border-slate-200 bg-slate-50 text-slate-500', dot: 'bg-slate-300' }
};

const OVERALL_STYLE = {
  'Pending Approval': 'border-amber-200 bg-amber-50 text-amber-700',
  'Pending Repair': 'border-indigo-200 bg-indigo-50 text-indigo-700',
  'No Repair Required': 'border-slate-200 bg-slate-100 text-slate-600',
  Completed: 'border-emerald-200 bg-emerald-50 text-emerald-700'
};

function Field({ label, children, wide }) {
  return <div className={wide ? 'sm:col-span-2' : ''}><dt className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</dt><dd className="mt-1 whitespace-pre-wrap break-words text-xs font-semibold text-slate-800">{children || '—'}</dd></div>;
}

export function RepairIssueDetailsModal({ issue, now, onClose }) {
  if (!issue) return null;
  const status = overallStatus(issue);
  return <Modal isOpen title={`Repair Issue: ${issue.serial}`} subtitle={`${issue.company || ''} • ${issue.requester || ''}`} large onClose={onClose}
    footer={<button type="button" onClick={onClose} className="cursor-pointer rounded-xl bg-slate-100 px-5 py-2 text-xs font-semibold text-slate-700 transition-all hover:-translate-y-0.5 hover:bg-slate-200/80">Close</button>}>
    <div className="space-y-4">
      <div className="space-y-3 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-lg border border-indigo-100 bg-indigo-50/80 px-2.5 py-0.5 font-mono text-base font-bold text-indigo-600">{issue.serial}</span>
          <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${OVERALL_STYLE[status] || OVERALL_STYLE['Pending Repair']}`}>{status}</span>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600">
          <span className="flex items-center gap-1 font-semibold text-slate-800"><Building className="h-3.5 w-3.5 text-slate-400" />{issue.company}</span>
          <span className="flex items-center gap-1"><User className="h-3.5 w-3.5 text-slate-400" />{issue.requester}</span>
          <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5 text-slate-400" />{issue.location || 'No location'}</span>
        </div>
        <div className="border-t border-slate-100 pt-3">
          <span className="mb-0.5 block text-[10px] font-bold uppercase tracking-wider text-slate-400">Things Not Working</span>
          <p className="whitespace-pre-wrap text-xs font-semibold leading-relaxed text-slate-800">{issue.description}</p>
        </div>
      </div>

      {Boolean(issue.attachments?.length) && <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs">
        <h3 className="mb-3 flex items-center gap-2 text-xs font-bold text-slate-800"><Paperclip className="h-4 w-4 text-indigo-500" />Photos / PDF ({issue.attachments.length})</h3>
        <ul className="space-y-2">{issue.attachments.map((file, i) => <li key={`${file.url}-${i}`}><a href={file.url || file.driveUrl} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2 text-xs font-semibold text-indigo-700 hover:bg-indigo-50"><span className="truncate">{file.name || `Attachment ${i + 1}`}</span><ExternalLink className="h-3.5 w-3.5 shrink-0" /></a></li>)}</ul>
      </div>}

      <div className="grid gap-3 sm:grid-cols-2">
        {STAGES_SHOWN.map(stage => {
          const state = stageState(issue, stage.key, now);
          const style = STATUS_STYLE[state.applicable ? state.status : 'Not Started'];
          const Icon = style.icon;
          return <div key={stage.key} className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h3 className="flex items-center gap-2 text-xs font-bold text-slate-800"><span className={`h-2 w-2 rounded-full ${style.dot}`} />{stage.key === 'approval' ? 'Approval' : 'Repair'}</h3>
              <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold ${style.ring}`}><Icon className="h-3 w-3" />{state.applicable ? state.status : 'Not Applicable'}</span>
            </div>
            <dl className="grid grid-cols-2 gap-3">
              <Field label="Planned">{datetime(issue[stage.key]?.planned)}</Field>
              <Field label="Actual">{datetime(issue[stage.key]?.actual)}</Field>
              <Field label="Delay / Due in" wide>{delayText(state)}</Field>
            </dl>
          </div>;
        })}
      </div>

      <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs">
        <h3 className="mb-3 flex items-center gap-2 text-xs font-bold text-slate-800"><Wrench className="h-4 w-4 text-indigo-500" />Assessment & Resolution</h3>
        <dl className="grid gap-3 sm:grid-cols-2">
          <Field label="Problem (Repair Required)">{issue.assessment?.repairRequired}</Field>
          <Field label="Assigned Developer">{issue.assessment?.assignedDeveloper}</Field>
          <Field label="Where Have To Solve" wide>{issue.assessment?.whereToSolve}</Field>
          <Field label="Problem Resolve Remark" wide>{issue.repair?.remarks}</Field>
          <Field label="Request Date">{datetime(issue.createdAt)}</Field>
          <Field label="Sheet Status">{issue.repair?.status}</Field>
        </dl>
      </div>

      {Boolean(issue.activity?.length) && <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs">
        <h3 className="mb-3 flex items-center gap-2 text-xs font-bold text-slate-800"><FileText className="h-4 w-4 text-indigo-500" />Activity Timeline</h3>
        <ol className="space-y-2">{issue.activity.map((event, i) => <li key={i} className="rounded-xl bg-slate-50 p-3 text-xs"><span className="font-semibold text-slate-800">{event.action}{event.stageKey ? ` (${event.stageKey})` : ''}</span><p className="mt-1 text-slate-500">{event.actor} · {datetime(event.timestamp)}</p></li>)}</ol>
      </div>}
    </div>
  </Modal>;
}
