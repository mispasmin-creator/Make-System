import { useState } from 'react';
import { Check, AlertCircle } from 'lucide-react';
import { Modal } from './Modal';
import { APP_STAGES, SYSTEMS } from '../services/authService';
import { ROLE_OPTIONS } from '../utils/accessPresets.mjs';

const MODES = [
  { id: 'add', label: 'Add these pages', hint: 'Keeps current access and grants the ticked pages.' },
  { id: 'replace', label: 'Replace access', hint: 'Users keep only the ticked pages.' },
  { id: 'remove', label: 'Remove these pages', hint: 'Takes the ticked pages away.' }
];

export function BulkAccessModal({ isOpen, onClose, users, onApply }) {
  const [mode, setMode] = useState('add');
  const [role, setRole] = useState('');
  const [stages, setStages] = useState({});
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const toggle = (id, key, checked) => setStages(prev => {
    const next = { ...(prev[id] || {}), [key]: checked };
    if (key === 'update' && checked) next.view = true;
    if (key === 'view' && !checked) next.update = false;
    return { ...prev, [id]: next };
  });

  async function submit() {
    const anyPage = Object.values(stages).some(s => s.view || s.update);
    if (!role && !anyPage) { setError('Tick at least one page or choose a role.'); return; }
    setSaving(true); setError('');
    try { await onApply({ mode: role && !anyPage ? 'add' : mode, role: role || undefined, stages }); onClose(); }
    catch (err) { setError(err.message || 'Could not update access.'); }
    finally { setSaving(false); }
  }

  return <Modal isOpen={isOpen} onClose={() => !saving && onClose()} title="Bulk Access" subtitle={`${users.length} user${users.length === 1 ? '' : 's'} selected`} large closeOnBackdrop={false}
    footer={<>
      <button type="button" disabled={saving} onClick={onClose} className="cursor-pointer rounded-xl bg-slate-100 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-200/80">Cancel</button>
      <button type="button" disabled={saving} onClick={submit} className="soft-btn-primary inline-flex cursor-pointer items-center gap-2 rounded-xl px-5 py-2 text-xs font-semibold disabled:opacity-50"><Check className="h-4 w-4" />{saving ? 'Applying...' : `Apply to ${users.length}`}</button>
    </>}>
    <div className="space-y-4">
      {error && <p role="alert" className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-700"><AlertCircle className="h-4 w-4 shrink-0" />{error}</p>}
      <div className="max-h-20 overflow-y-auto rounded-xl bg-slate-50 p-3 text-[11px] text-slate-600">{users.map(u => u.fullName || u.username).join(', ') || 'No users selected'}</div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700">Change role (optional)
          <select value={role} onChange={e => setRole(e.target.value)} className="mt-1.5 w-full cursor-pointer rounded-xl border border-slate-200/80 bg-white px-3.5 py-2.5 text-sm font-semibold normal-case text-slate-800">
            <option value="">Keep current role</option>
            {ROLE_OPTIONS.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </label>
        <div className="flex items-end">
          <button type="button" onClick={() => setStages({})} className="cursor-pointer rounded-lg bg-slate-100 px-3 py-2.5 text-[11px] font-semibold text-slate-500 hover:bg-rose-50 hover:text-rose-600">Clear ticks</button>
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        {MODES.map(m => <label key={m.id} className={`cursor-pointer rounded-xl border p-3 text-xs ${mode === m.id ? 'border-indigo-300 bg-indigo-50' : 'border-slate-200 bg-white'}`}>
          <span className="flex items-center gap-2 font-semibold text-slate-800"><input type="radio" name="bulk-mode" checked={mode === m.id} onChange={() => setMode(m.id)} />{m.label}</span>
          <span className="mt-1 block text-[11px] text-slate-500">{m.hint}</span>
        </label>)}
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-slate-100 bg-slate-50/90 text-[10px] font-bold uppercase tracking-wider text-slate-600"><tr><th className="px-3.5 py-2.5">Page</th><th className="w-24 px-3 py-2.5 text-center">View</th><th className="w-32 px-3 py-2.5 text-center">Update / Submit</th></tr></thead>
          <tbody className="divide-y divide-slate-100">
            {SYSTEMS.map(system => [
              <tr key={system.id} className="bg-slate-50/50"><td colSpan={3} className="px-3.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-indigo-600">{system.label}</td></tr>,
              ...system.stages.map(id => {
                const stage = APP_STAGES.find(s => s.id === id);
                const picked = stages[id] || {};
                return <tr key={id}>
                  <td className="px-3.5 py-2.5 font-semibold text-slate-800">{stage?.label || id}</td>
                  <td className="px-3 py-2.5 text-center"><input type="checkbox" aria-label={`${stage?.label} view`} checked={Boolean(picked.view)} onChange={e => toggle(id, 'view', e.target.checked)} className="h-4 w-4 cursor-pointer rounded border-slate-300 text-indigo-600" /></td>
                  <td className="px-3 py-2.5 text-center"><input type="checkbox" aria-label={`${stage?.label} update`} checked={Boolean(picked.update)} onChange={e => toggle(id, 'update', e.target.checked)} className="h-4 w-4 cursor-pointer rounded border-slate-300 text-indigo-600" /></td>
                </tr>;
              })
            ])}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] text-slate-500">Admin accounts always keep full access and are skipped unless you change their role.</p>
    </div>
  </Modal>;
}
