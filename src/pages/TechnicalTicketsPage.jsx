import React, { useEffect, useRef, useState } from 'react';
import { Search } from 'lucide-react';
import { getCachedTechnicalTickets, subscribeTechnicalTickets, listTechnicalTickets, submitTechnicalTicket } from '../services/technicalHelpService';
import { Modal } from '../components/Modal';

function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString('en-US', { timeZone: 'Asia/Kolkata', hour12: false });
}

export function TechnicalTicketsPage({ refreshKey, canSubmit = false }) {
  const [tickets, setTickets] = useState(getCachedTechnicalTickets);
  const [q, setQ] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(() => getCachedTechnicalTickets().length === 0);
  const [submitting, setSubmitting] = useState({});
  const pending = useRef(new Set());
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [resolvedRemark, setResolvedRemark] = useState('');
  const [remarkError, setRemarkError] = useState('');

  useEffect(() => {
    let active = true;
    let refreshing = false;
    const unsubscribe = subscribeTechnicalTickets(data => { if (active) setTickets(data); });
    async function refresh() {
      if (document.hidden || refreshing || pending.current.size) return;
      refreshing = true;
      try {
        const data = await listTechnicalTickets();
        if (active) { setTickets(data); setError(''); }
      } catch (err) { if (active) setError(err.message || 'Unable to sync tickets.'); }
      finally { refreshing = false; if (active) setLoading(false); }
    }
    refresh();
    const interval = setInterval(refresh, 10000);
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      active = false; unsubscribe(); clearInterval(interval);
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [refreshKey]);

  function submit(ticket) {
    if (!canSubmit) return;
    setSelectedTicket(ticket); setResolvedRemark(''); setRemarkError('');
  }

  async function confirmSubmit(e) {
    e.preventDefault();
    if (!canSubmit) return;
    const ticket = selectedTicket;
    if (!ticket) return;
    if (!resolvedRemark.trim()) { setRemarkError('Please enter a resolved remark.'); return; }
    if (pending.current.has(ticket.ticketNo) || ticket.actualDate) return;
    pending.current.add(ticket.ticketNo);
    setSubmitting(prev => ({ ...prev, [ticket.ticketNo]: true }));
    setError(''); setMessage('');
    try {
      const updated = await submitTechnicalTicket(ticket.ticketNo, resolvedRemark.trim());
      setTickets(prev => prev.map(t => t.ticketNo === ticket.ticketNo ? { ...t, ...updated } : t));
      setMessage(`${ticket.ticketNo} submitted. Actual timestamp saved.`);
      setSelectedTicket(null);
    } catch (err) { setRemarkError(err.message || 'Unable to submit ticket.'); }
    finally {
      pending.current.delete(ticket.ticketNo);
      setSubmitting(prev => ({ ...prev, [ticket.ticketNo]: false }));
    }
  }

  const rows = tickets.filter(t => JSON.stringify(t).toLowerCase().includes(q.toLowerCase()));
  return <div className="flex-1 overflow-y-auto p-4 sm:p-6">
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
      <div><h1 className="text-xl font-bold text-slate-800">All Technical Tickets</h1><p className="text-sm text-slate-500"></p></div>
      <label className="block w-full sm:w-64">
        <span className="mb-1.5 block text-xs font-semibold text-indigo-800">Search tickets</span>
        <div className="relative">
          <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-indigo-600" />
          <input aria-label="Search tickets" value={q} onChange={e => setQ(e.target.value)} className="w-full rounded-xl border border-indigo-300 bg-white py-2.5 pl-10 pr-3 text-sm text-slate-800 shadow-[0_4px_12px_rgba(25,81,220,0.14),0_1px_3px_rgba(25,81,220,0.10)] transition-[border-color,box-shadow] hover:border-indigo-400 hover:shadow-[0_6px_16px_rgba(25,81,220,0.20)] focus:border-indigo-600 focus:outline-none focus:ring-4 focus:ring-indigo-100" />
        </div>
      </label>
    </div>
    {error && <p role="alert" className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    {message && <p role="status" className="mb-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">{message}</p>}
    <div className="overflow-x-auto rounded-2xl border border-slate-100 bg-white"><table className="w-full text-left text-xs"><thead className="bg-slate-50 text-slate-500"><tr>{['Ticket', 'Requester', 'Company', 'Application', 'Problem', 'Assigned To', 'Status', 'Created', 'Actual', 'Action'].map(h => <th key={h} className="whitespace-nowrap p-3">{h}</th>)}</tr></thead><tbody>
      {rows.map(t => <tr key={t.ticketNo} className="border-t border-slate-100"><td className="whitespace-nowrap p-3 font-semibold">{t.ticketNo}</td><td className="p-3">{t.requester}</td><td className="p-3">{t.company}</td><td className="p-3">{t.application}</td><td className="max-w-xs p-3">{t.problem}</td><td className="p-3">{t.assignedTo || '—'}</td><td className="p-3">{t.status}</td><td className="whitespace-nowrap p-3">{formatDate(t.createdAt)}</td><td className="whitespace-nowrap p-3">{formatDate(t.actualDate)}</td><td className="p-3">{!canSubmit ? <span className="text-slate-400">View only</span> : <button type="button" aria-label={`Submit ${t.ticketNo}`} disabled={Boolean(t.actualDate) || submitting[t.ticketNo]} onClick={() => submit(t)} className="rounded-lg bg-indigo-600 px-3 py-2 font-semibold text-white hover:bg-indigo-700 disabled:cursor-default disabled:bg-slate-100 disabled:text-slate-500">{t.actualDate ? 'Submitted' : submitting[t.ticketNo] ? 'Saving...' : 'Submit'}</button>}</td></tr>)}
      {!rows.length && <tr><td colSpan={10} className="p-8 text-center text-slate-400">{loading ? 'Loading tickets...' : 'No technical tickets found.'}</td></tr>}
    </tbody></table></div>
    <Modal isOpen={Boolean(selectedTicket)} title={`Submit ${selectedTicket?.ticketNo || 'Ticket'}`} onClose={() => { if (!pending.current.has(selectedTicket?.ticketNo)) setSelectedTicket(null); }}>
      <form onSubmit={confirmSubmit} className="space-y-4">
        <label className="block text-xs font-semibold text-slate-700">Resolved Remark <span className="text-red-500">*</span>
          <textarea autoFocus required rows={4} value={resolvedRemark} disabled={Boolean(submitting[selectedTicket?.ticketNo])} onChange={e => { setResolvedRemark(e.target.value); setRemarkError(''); }} placeholder="Describe how the issue was resolved..." className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
        </label>
        {remarkError && <p role="alert" className="text-xs text-red-600">{remarkError}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" disabled={Boolean(submitting[selectedTicket?.ticketNo])} onClick={() => setSelectedTicket(null)} className="rounded-lg border border-slate-200 px-4 py-2 text-xs">Cancel</button>
          <button type="submit" disabled={Boolean(submitting[selectedTicket?.ticketNo])} className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white disabled:opacity-50">{submitting[selectedTicket?.ticketNo] ? 'Saving...' : 'Submit'}</button>
        </div>
      </form>
    </Modal>
  </div>;
}
