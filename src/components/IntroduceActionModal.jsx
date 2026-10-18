import React, { useState, useEffect } from 'react';
import { Calendar, Check, AlertCircle } from 'lucide-react';
import { Modal } from './Modal';
import { formatToKolkataDateString } from '../utils/dateUtils';

export function IntroduceActionModal({ isOpen, onClose, request, onSubmit }) {
  const [meetingDate, setMeetingDate] = useState('');
  const [remarks, setRemarks] = useState('');
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setMeetingDate(formatToKolkataDateString(new Date()));
      setRemarks('');
      setErrors({});
      setIsSubmitting(false);
    }
  }, [isOpen]);

  if (!request) return null;

  function validate() {
    const errs = {};
    if (!meetingDate) errs.meetingDate = 'Meeting Date is required';
    if (!remarks.trim()) errs.remarks = 'Discussion / Follow-up Remarks are required';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!validate()) return;

    setIsSubmitting(true);
    try {
      await onSubmit(request.id, {
        meetingDate,
        remarks: remarks.trim()
      });
      onClose();
    } catch (err) {
      setErrors({ form: err.message || 'Failed to approve introduction' });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Introduce System — Approve: ${request.requestNo}`}
      subtitle={`${request.companyName} • Kickoff Scoping Approval`}
      footer={
        <>
          <button
            type="button"
            className="bg-slate-100 hover:bg-slate-200/80 text-slate-700 rounded-xl text-xs font-semibold px-4 py-2 cursor-pointer transition-all hover:-translate-y-0.5"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button
            type="button"
            className="soft-btn-primary font-semibold text-xs rounded-xl shadow-xs px-4 py-2 inline-flex items-center gap-2 cursor-pointer disabled:opacity-50 transition-all hover:-translate-y-0.5"
            onClick={handleSubmit}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Approving...</span>
              </>
            ) : (
              <>
                <Check className="w-4 h-4" />
                <span>Approve & Submit</span>
              </>
            )}
          </button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Context snippet */}
        <div className="p-3.5 bg-slate-50/80 border border-slate-100 rounded-xl text-xs space-y-1.5">
          <div>
            <strong className="text-slate-900">Request:</strong>{' '}
            <span className="font-mono text-indigo-600 font-bold">{request.requestNo}</span> ({request.companyName})
          </div>
          <div><strong className="text-slate-900">Developer:</strong> {request.assignedDeveloper}</div>
          <div className="text-slate-700 truncate font-medium"><strong className="text-slate-900">System Name:</strong> {request.systemName || request.systemRequirements}</div>
        </div>

        {errors.form && (
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs font-semibold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errors.form}</span>
          </div>
        )}

        <div>
          <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5" htmlFor="meetingDate">
            Meeting Date <span className="text-rose-500">*</span>
          </label>
          <input
            id="meetingDate"
            type="date"
            className="w-full px-3.5 py-2.5 bg-white border border-slate-200/80 rounded-xl text-slate-800 text-sm focus:outline-none focus:ring-4 focus:ring-indigo-100/60 focus:border-indigo-400 shadow-2xs transition-all cursor-pointer"
            value={meetingDate}
            onChange={(e) => {
              setMeetingDate(e.target.value);
              if (errors.meetingDate) setErrors(prev => ({ ...prev, meetingDate: '' }));
            }}
          />
          {errors.meetingDate && <span className="text-[11px] text-rose-600 font-semibold mt-1 block">{errors.meetingDate}</span>}
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5" htmlFor="introRemarks">
            Discussion / Follow-up Remarks <span className="text-rose-500">*</span>
          </label>
          <textarea
            id="introRemarks"
            rows={4}
            placeholder="Document kickoff meeting attendees, architectural alignment, milestones, or follow-up action items..."
            value={remarks}
            onChange={(e) => {
              setRemarks(e.target.value);
              if (errors.remarks) setErrors(prev => ({ ...prev, remarks: '' }));
            }}
            className="w-full px-3.5 py-2.5 bg-white border border-slate-200/80 rounded-xl text-slate-800 text-sm placeholder-slate-400 focus:outline-none focus:ring-4 focus:ring-indigo-100/60 focus:border-indigo-400 shadow-2xs transition-all"
          />
          {errors.remarks && <span className="text-[11px] text-rose-600 font-semibold mt-1 block">{errors.remarks}</span>}
        </div>
      </form>
    </Modal>
  );
}
