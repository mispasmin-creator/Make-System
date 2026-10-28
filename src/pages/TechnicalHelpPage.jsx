import React, { useEffect, useRef, useState } from 'react';
import { Building, Layers, FileSpreadsheet, UploadCloud, PlusCircle, X, Search } from 'lucide-react';
import { Modal } from '../components/Modal';
import { technicalHelpService, getCachedTechnicalTickets, subscribeTechnicalTickets, listTechnicalTickets } from '../services/technicalHelpService';
import { dataService } from '../services/dataService';
import { loadLocalUsers } from '../services/authService';
import { SAMPLE_COMPANIES } from '../constants/stages';
import { GOOGLE_SHEETS_CONFIG } from '../config/integrationConfig';

const formatDate = value => {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString('en-US', { timeZone: 'Asia/Kolkata', hour12: false });
};

export function TechnicalHelpPage({ currentUser, onCreated, companyOptions = [] }) {
  const [open, setOpen] = useState(false);
  const [tickets, setTickets] = useState(getCachedTechnicalTickets);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(() => getCachedTechnicalTickets().length === 0);
  const [historyError, setHistoryError] = useState('');
  useEffect(() => {
    let active = true;
    const unsubscribe = subscribeTechnicalTickets(data => { if (active) setTickets(data); });
    listTechnicalTickets().then(data => { if (active) { setTickets(data); setHistoryError(''); } })
      .catch(err => { if (active) setHistoryError(err.message || 'Unable to load ticket history.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; unsubscribe(); };
  }, []);
  const companies = companyOptions.length ? companyOptions : SAMPLE_COMPANIES;
  const empty = () => ({ submissionType: 'Self', onBehalfOf: '', customOnBehalf: '', category: 'Sheet/FMS', helpTicketNumber: '', company: companies[0] || '', application: '', sheetPage: '', url: '', problem: '', correction: '' });
  const [form, setForm] = useState(empty);
  const [attachments, setAttachments] = useState([]);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const busy = useRef(false);
  const [saving, setSaving] = useState(false);
  const update = e => setForm({ ...form, [e.target.name]: e.target.value });
  async function selectFiles(e) {
    const files = Array.from(e.target.files || []); e.target.value = '';
    try {
      for (const file of files) {
        if (!GOOGLE_SHEETS_CONFIG.attachments.allowedMimeTypes.includes(file.type)) throw new Error('Choose PNG, JPG, WEBP or PDF files.');
        if (file.size > GOOGLE_SHEETS_CONFIG.attachments.maxFileSizeBytes) throw new Error(`${file.name} exceeds 10 MB.`);
      }
      const selected = await Promise.all(files.map(async file => ({ id: crypto.randomUUID(), name: file.name, type: file.type, size: file.size, base64Data: await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = () => reject(new Error('Unable to read file.')); reader.readAsDataURL(file); }) })));
      setAttachments(prev => [...prev, ...selected]); setError('');
    } catch (err) { setError(err.message); }
  }
  async function submit(e) {
    e.preventDefault(); if (busy.current) return;
    const behalf = form.onBehalfOf === 'Other' ? form.customOnBehalf.trim() : form.onBehalfOf;
    if (form.submissionType === 'On Behalf' && !behalf) { setError('Please select or enter a name and role.'); return; }
    if (form.problem.trim().length < 10) { setError('Problem description must be at least 10 characters.'); return; }
    busy.current = true; setSaving(true); setError(''); setMessage('');
    try {
      const uploaded = [];
      for (const att of attachments) {
        const result = att.base64Data ? await dataService.uploadAttachment({ ...att, previewUrl: att.base64Data }) : att;
        uploaded.push(result); setAttachments(prev => prev.map(a => a.id === att.id ? result : a));
      }
      const data = Object.fromEntries(Object.entries(form).map(([key, value]) => [key, value.trim()]));
      delete data.customOnBehalf;
      const t = await technicalHelpService.createTechnicalTicket({ ...data, onBehalfOf: form.submissionType === 'On Behalf' ? behalf : '', requester: currentUser?.fullName, attachments: uploaded });
      setMessage(`Ticket ${t.ticketNo} raised successfully.`); setForm(empty()); setAttachments([]); setOpen(false); onCreated?.(t);
    } catch (err) { setError(err.message || 'Unable to submit ticket.'); }
    finally { busy.current = false; setSaving(false); }
  }
  const inputClass = 'mt-1.5 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400';
const field = (name, label, _placeholder, required = true, textarea = false) => <label className="block text-xs font-semibold text-slate-800">{label} {required && <span className="text-red-500">*</span>}{textarea ? <textarea name={name} value={form[name]} onChange={update} required={required} rows={4} className={inputClass} /> : <input name={name} value={form[name]} onChange={update} required={required} type={name === 'url' ? 'url' : 'text'} className={inputClass} />}</label>;
  const closeForm = () => { if (!busy.current) { setOpen(false); setError(''); } };
  const rows = tickets.filter(t => JSON.stringify(t).toLowerCase().includes(q.toLowerCase()));
  return <div className="flex-1 overflow-y-auto bg-[#f7f9fc] p-4 sm:p-6"><div className="mx-auto max-w-6xl">
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-xl font-bold text-slate-900">Raise Technical Help Ticket</h1><p className="mt-1 text-xs text-slate-500"></p></div><button type="button" onClick={() => { setOpen(true); setMessage(''); setError(''); }} className="flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700"><PlusCircle className="h-4 w-4" />Raise Ticket</button></div>
    {message && <p role="status" className="mb-4 rounded-lg bg-emerald-50 p-4 text-sm text-emerald-800">{message}</p>}
    <section className="rounded-lg border border-slate-200 bg-white shadow-xs"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-4"><h2 className="text-sm font-bold text-slate-800">History <span className="ml-2 rounded-full bg-blue-50 px-2 py-1 text-xs text-blue-600">{rows.length}</span></h2><div className="relative w-full sm:w-64"><Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input aria-label="Search history" placeholder="Search tickets..." value={q} onChange={e => setQ(e.target.value)} className="w-full rounded-md border border-slate-200 py-2 pl-9 pr-3 text-xs focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100" /></div></div>
      {historyError && <p role="alert" className="m-4 rounded-lg bg-red-50 p-3 text-xs text-red-700">{historyError}</p>}
      <div className="overflow-x-auto"><table className="cards-on-phone w-full text-left text-xs"><thead className="bg-slate-50 text-slate-500"><tr>{['Ticket', 'Requester', 'Company', 'Category', 'Application', 'Problem', 'Status', 'Created', 'Resolved'].map(h => <th key={h} className="whitespace-nowrap p-3">{h}</th>)}</tr></thead><tbody>
        {rows.map(t => <tr key={t.ticketNo} className="border-t border-slate-100"><td data-label="Ticket" className="whitespace-nowrap p-3 font-semibold text-blue-700">{t.ticketNo}</td><td data-label="Requester" className="p-3">{t.onBehalfOf ? `${t.onBehalfOf} (by ${t.requester})` : t.requester}</td><td data-label="Company" className="p-3">{t.company}</td><td data-label="Category" className="p-3">{t.category}</td><td data-label="Application" className="p-3">{t.application}</td><td data-label="Problem" className="max-w-xs whitespace-pre-wrap p-3">{t.problem}</td><td data-label="Status" className="p-3">{t.status}</td><td data-label="Created" className="whitespace-nowrap p-3">{formatDate(t.createdAt)}</td><td data-label="Resolved" className="whitespace-nowrap p-3">{formatDate(t.actualDate)}</td></tr>)}
        {!rows.length && <tr><td colSpan={9} data-empty className="p-8 text-center text-slate-400">{loading ? 'Loading tickets...' : 'No technical tickets found.'}</td></tr>}
      </tbody></table></div></section>
    <Modal isOpen={open} onClose={closeForm} title="Raise Technical Help Ticket" large closeOnBackdrop={false}>
      {error && <p role="alert" className="rounded-lg bg-red-50 p-4 text-sm text-red-700">{error}</p>}
    <form onSubmit={submit}><fieldset disabled={saving} className="space-y-5 disabled:opacity-70">
      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-xs sm:p-6"><h2 className="mb-5 flex items-center gap-2 text-sm font-bold"><Building className="h-4 w-4 text-blue-500" />Requester & System Identification</h2><div className="grid gap-5 md:grid-cols-2">
        <fieldset><legend className="mb-2 text-xs font-semibold">Raising For <span className="text-red-500">*</span></legend><div className="flex flex-wrap gap-3 text-xs">{['Self', 'On Behalf'].map(type => <label key={type} className="flex items-center gap-1.5"><input type="radio" name="submissionType" value={type} checked={form.submissionType === type} onChange={update} className="accent-blue-600" />{type === 'Self' ? `By Self (${currentUser?.fullName || 'User'})` : type}</label>)}</div></fieldset>
        {form.submissionType === 'On Behalf' && <div><label className="block text-xs font-semibold">On Behalf Of (Name & Role) <span className="text-red-500">*</span><select name="onBehalfOf" value={form.onBehalfOf} onChange={update} required className={inputClass}><option value="">-- Select Person (Name & Role) --</option>{loadLocalUsers().filter(u => u.status === 'Active').map(u => <option key={u.id} value={`${u.fullName} (${u.department || u.role})`}>{u.fullName} ({u.department || u.role})</option>)}<option value="Other">Other (Type Name & Role)</option></select></label>{form.onBehalfOf === 'Other' && field('customOnBehalf', 'Name & Role', 'e.g. Ramesh Kumar (Store In-charge)')}</div>}
        <label className="block text-xs font-semibold">Company <span className="text-red-500">*</span><select name="company" value={form.company} onChange={update} required className={inputClass}>{companies.map(c => <option key={c}>{c}</option>)}</select></label>
        <label className="block text-xs font-semibold">Category <span className="text-red-500">*</span><select name="category" value={form.category} onChange={update} required className={inputClass}>{['Sheet/FMS', 'Google Forms', 'Website', 'React Application', 'Other'].map(c => <option key={c}>{c}</option>)}</select></label>
        {field('helpTicketNumber', 'External Help Ticket (Optional)', 'e.g. HD-9842', false)}
      </div></section>
      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-xs sm:p-6"><h2 className="mb-5 flex items-center gap-2 text-sm font-bold"><Layers className="h-4 w-4 text-blue-500" />Application & Target Details</h2><div className="grid gap-5 sm:grid-cols-2">{field('application', 'FMS / Application Name', 'e.g. Purchase Order FMS or Customer Portal')}{field('sheetPage', 'Sheet / Tab / Page Name', 'e.g. Vendor Inward Tab or /checkout page')}<div className="sm:col-span-2">{field('url', 'System / Page URL (Optional)', 'https://docs.google.com/spreadsheets/d/...', false)}</div></div></section>
      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-xs sm:p-6"><h2 className="mb-5 flex items-center gap-2 text-sm font-bold"><FileSpreadsheet className="h-4 w-4 text-blue-500" />Problem Description & Requested Correction</h2><div className="space-y-5">{field('problem', 'Problem Encountered', 'Explain the error message, incorrect calculation, macro failure, or form problem in detail...', true, true)}{field('correction', 'What Has To Be Changed', 'Specify the exact expected behavior, corrected formula, dropdown options to add, or column adjustments...', true, true)}<div><p className="mb-2 text-xs font-semibold">Screenshots / PDF Attachments</p><label className="relative flex min-h-28 cursor-pointer flex-col items-center justify-center gap-1 rounded-md border border-dashed border-slate-200 bg-slate-50 p-4 text-center focus-within:ring-2 focus-within:ring-blue-400"><UploadCloud className="mb-1 h-6 w-6 text-blue-500" /><span className="text-xs font-semibold">Click to upload Image or PDF</span><span className="text-[11px] text-slate-500">PNG, JPG, WEBP or PDF · Maximum 10 MB per file</span><input type="file" aria-label="Upload screenshots or PDFs" multiple accept="image/png,image/jpeg,image/webp,application/pdf" onChange={selectFiles} className="absolute inset-0 h-full w-full cursor-pointer opacity-0" /></label></div>{attachments.map(file => <div key={file.id} className="flex items-center justify-between rounded-md bg-slate-50 px-3 py-2 text-xs"><span className="truncate">{file.name}</span><button type="button" aria-label={`Remove ${file.name}`} onClick={() => setAttachments(prev => prev.filter(a => a.id !== file.id))} className="ml-3 p-1 text-slate-500 hover:text-red-600"><X className="h-4 w-4" /></button></div>)}</div></section>
      <div className="flex justify-end gap-3 pb-2"><button type="button" onClick={closeForm} className="rounded-md border border-slate-200 bg-white px-4 py-2 text-xs font-semibold">Cancel</button><button type="submit" className="flex items-center gap-2 rounded-md bg-blue-600 px-5 py-2 text-xs font-semibold text-white hover:bg-blue-700"><PlusCircle className="h-4 w-4" />{saving ? 'Submitting Ticket...' : 'Submit Ticket'}</button></div>
    </fieldset></form></Modal></div></div>;
}
