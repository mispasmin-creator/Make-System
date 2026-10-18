import React, { useState, useEffect } from 'react';
import { Check, X, AlertTriangle, AlertCircle, RefreshCw, Calendar, Globe, ExternalLink } from 'lucide-react';
import { Modal } from './Modal';
import { TESTING_DECISION } from '../constants/stages';

export function TestingActionModal({ isOpen, onClose, request, onSubmit }) {
  const [decision, setDecision] = useState(TESTING_DECISION.APPROVED);
  const [remarks, setRemarks] = useState('');
  const [shouldExtendTargetDate, setShouldExtendTargetDate] = useState(false);
  const [extendedTargetDate, setExtendedTargetDate] = useState('');
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen && request) {
      setDecision(TESTING_DECISION.APPROVED);
      setRemarks('');
      setShouldExtendTargetDate(false);
      setExtendedTargetDate(request.targetCompletionDate || '');
      setErrors({});
      setIsSubmitting(false);
    }
  }, [isOpen, request]);

  if (!request) return null;

  const rejectionCount = (request.testingHistory?.filter(t => t.decision === TESTING_DECISION.REJECTED).length || 0) + 1;
  const nextRevisionNo = `REV-${String(rejectionCount).padStart(2, '0')}`;
  const isReject = decision === TESTING_DECISION.REJECTED;

  function validate() {
    const errs = {};
    if (isReject) {
      if (!remarks.trim()) {
        errs.remarks = 'Revision remarks detailing required changes are mandatory.';
      }
      if (shouldExtendTargetDate && (!extendedTargetDate || !extendedTargetDate.trim())) {
        errs.extendedTargetDate = 'Please select a new target completion date.';
      }
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!validate()) return;

    setIsSubmitting(true);
    try {
      const finalUpgradeDate = (isReject && shouldExtendTargetDate && extendedTargetDate)
        ? extendedTargetDate
        : undefined;

      await onSubmit(request.id, {
        decision,
        remarks: remarks.trim(),
        upgradeTargetDate: finalUpgradeDate,
        extendedTargetDate: finalUpgradeDate
      });
      onClose();
    } catch (err) {
      setErrors({ form: err.message || 'Failed to submit testing decision' });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Testing Decision: ${request.requestNo}`}
      subtitle={`${request.companyName} • ${request.currentRevisionNo || 'Initial Development Build'}`}
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
            disabled={isSubmitting}
            onClick={handleSubmit}
            className={`font-semibold text-xs rounded-xl shadow-xs px-4 py-2 inline-flex items-center gap-2 cursor-pointer disabled:opacity-50 transition-all hover:-translate-y-0.5 ${
              isReject
                ? 'bg-rose-600 hover:bg-rose-700 text-white shadow-rose-200'
                : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-200'
            }`}
          >
            {isSubmitting ? (
              <>
                <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Submitting...</span>
              </>
            ) : isReject ? (
              <>
                <RefreshCw className="w-4 h-4" />
                <span>Reject & Generate {nextRevisionNo}</span>
              </>
            ) : (
              <>
                <Check className="w-4 h-4" />
                <span>Approve Testing & Move to MIS</span>
              </>
            )}
          </button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Context info banner */}
        <div className="p-3.5 bg-slate-50/80 border border-slate-100 rounded-xl text-xs space-y-1.5">
          <div className="flex justify-between items-center">
            <div>
              <strong className="text-slate-900">Request:</strong>{' '}
              <span className="font-mono text-indigo-600 font-bold">{request.requestNo}</span> ({request.companyName})
            </div>
            <div className="text-slate-600">
              <strong className="text-slate-900">Target Date:</strong> {request.targetCompletionDate || 'Not set'}
            </div>
          </div>
          <div><strong className="text-slate-900">Developer:</strong> {request.assignedDeveloper}</div>
          <div className="text-slate-700 truncate font-medium">
            <strong className="text-slate-900">System Name:</strong> {request.systemName || request.systemRequirements}
          </div>
          {request.currentRevisionNo && (
            <div className="font-mono font-semibold text-indigo-600">
              Tested Revision: {request.currentRevisionNo}
            </div>
          )}
        </div>

        {/* System Link & Credentials for QA Testing */}
        {(request.systemUrl || request.adminId) && (
          <div className="p-3.5 bg-indigo-50/60 border border-indigo-100 rounded-xl space-y-2 text-xs">
            <div className="font-bold text-indigo-900 flex items-center justify-between">
              <span className="flex items-center gap-1.5 uppercase tracking-wider text-[11px]">
                <Globe className="w-3.5 h-3.5 text-indigo-600" />
                <span>Deployed System for QA Validation</span>
              </span>
              {request.systemUrl && (
                <a
                  href={request.systemUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-indigo-600 text-white hover:bg-indigo-700 shadow-xs cursor-pointer transition-all"
                >
                  <span>Open System</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>

            {(request.adminId || request.adminPassword) && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 border-t border-indigo-100/70">
                {request.adminId && (
                  <div className="bg-white/80 p-2 rounded-lg border border-indigo-100/80">
                    <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Admin ID / User</span>
                    <span className="font-semibold text-slate-800 font-mono select-all">{request.adminId}</span>
                  </div>
                )}
                {request.adminPassword && (
                  <div className="bg-white/80 p-2 rounded-lg border border-indigo-100/80">
                    <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Admin Password</span>
                    <span className="font-semibold text-slate-800 font-mono select-all">{request.adminPassword}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {errors.form && (
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs font-semibold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errors.form}</span>
          </div>
        )}

        {/* Testing Decision Selector */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
            Testing Decision <span className="text-rose-500">*</span>
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label
              className={`p-3.5 rounded-xl border flex items-center gap-2.5 cursor-pointer transition-all ${
                decision === TESTING_DECISION.APPROVED
                  ? 'bg-emerald-50/70 border-emerald-200 ring-2 ring-emerald-500/20 text-emerald-950 font-semibold shadow-xs'
                  : 'bg-white border-slate-200/80 text-slate-700 hover:bg-slate-50/60 shadow-2xs'
              }`}
            >
              <input
                type="radio"
                name="testDecision"
                value={TESTING_DECISION.APPROVED}
                checked={decision === TESTING_DECISION.APPROVED}
                onChange={() => setDecision(TESTING_DECISION.APPROVED)}
                className="accent-emerald-600"
              />
              <Check className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Approve Testing</span>
            </label>

            <label
              className={`p-3.5 rounded-xl border flex items-center gap-2.5 cursor-pointer transition-all ${
                decision === TESTING_DECISION.REJECTED
                  ? 'bg-rose-50/70 border-rose-200 ring-2 ring-rose-500/20 text-rose-950 font-semibold shadow-xs'
                  : 'bg-white border-slate-200/80 text-slate-700 hover:bg-slate-50/60 shadow-2xs'
              }`}
            >
              <input
                type="radio"
                name="testDecision"
                value={TESTING_DECISION.REJECTED}
                checked={decision === TESTING_DECISION.REJECTED}
                onChange={() => setDecision(TESTING_DECISION.REJECTED)}
                className="accent-rose-600"
              />
              <X className="w-4 h-4 text-rose-600 shrink-0" />
              <span>Reject (Send Revision)</span>
            </label>
          </div>
        </div>

        {isReject ? (
          <div className="p-4 bg-rose-50/50 border border-rose-100 rounded-xl space-y-3.5">
            {/* Revision Remarks / Required Changes */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-bold text-rose-900 uppercase tracking-wider" htmlFor="rejectRemarks">
                  Revision Remarks / Required Changes <span className="text-rose-600">*</span>
                </label>
                <span className="text-[11px] font-semibold text-rose-600">Mandatory</span>
              </div>
              <textarea
                id="rejectRemarks"
                rows={3}
                placeholder="Specify the required bug fixes, adjustments, or changes for this revision..."
                value={remarks}
                onChange={(e) => {
                  setRemarks(e.target.value);
                  if (errors.remarks) setErrors(prev => ({ ...prev, remarks: '' }));
                }}
                className="w-full px-3.5 py-2.5 bg-white border border-rose-200 rounded-xl text-slate-800 text-sm placeholder-slate-400 focus:outline-none focus:ring-4 focus:ring-rose-100 focus:border-rose-400 shadow-2xs transition-all"
              />
              {errors.remarks && <span className="text-[11px] text-rose-600 font-semibold mt-1 block">{errors.remarks}</span>}
            </div>

            {/* Target Date Extension Option */}
            <div className="p-3 bg-white border border-rose-100 rounded-xl space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={shouldExtendTargetDate}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setShouldExtendTargetDate(checked);
                      if (!checked) {
                        setExtendedTargetDate(request.targetCompletionDate || '');
                      }
                    }}
                    className="w-4 h-4 text-rose-600 rounded border-slate-300 focus:ring-rose-500 cursor-pointer accent-rose-600"
                  />
                  <span className="text-xs font-bold text-slate-800">
                    Upgrade Target Date (Col Z) - Revision Extended Date
                  </span>
                </label>
                <span className="text-[11px] text-slate-500">
                  Current Target: <strong className="text-slate-700">{request.targetCompletionDate || 'Not set'}</strong>
                </span>
              </div>

              {shouldExtendTargetDate && (
                <div className="pt-2 border-t border-slate-100 space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider" htmlFor="extendedTargetDateInput">
                    New Upgrade Target Date (Col Z) <span className="text-rose-600">*</span>
                  </label>
                  <input
                    type="date"
                    id="extendedTargetDateInput"
                    value={extendedTargetDate}
                    onChange={(e) => {
                      setExtendedTargetDate(e.target.value);
                      if (errors.extendedTargetDate) setErrors(prev => ({ ...prev, extendedTargetDate: '' }));
                    }}
                    className="w-full px-3.5 py-2 bg-slate-50/50 border border-slate-200 rounded-xl text-slate-800 text-sm focus:outline-none focus:ring-4 focus:ring-rose-100 focus:border-rose-400 focus:bg-white cursor-pointer transition-all"
                  />
                  {errors.extendedTargetDate && (
                    <span className="text-[11px] text-rose-600 font-semibold block">{errors.extendedTargetDate}</span>
                  )}
                  {extendedTargetDate && (
                    <div className="text-[11px] text-indigo-700 font-medium bg-indigo-50/70 px-3 py-2 rounded-lg border border-indigo-100/80 flex items-center gap-2">
                      <Calendar className="w-3.5 h-3.5 shrink-0" />
                      <span>
                        Upgrade Target Date set to <strong>{extendedTargetDate}</strong> for <strong>{nextRevisionNo}</strong> (will save to Sheet Column Z).
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="p-4 bg-emerald-50/50 border border-emerald-100 rounded-xl space-y-2">
            <label className="block text-xs font-semibold text-emerald-800 uppercase tracking-wider" htmlFor="approveRemarks">
              Approval Remarks (Optional)
            </label>
            <textarea
              id="approveRemarks"
              rows={3}
              placeholder="Test suite passed, UAT confirmed, ready for MIS update..."
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-white border border-slate-200/80 rounded-xl text-slate-800 text-sm focus:outline-none focus:ring-4 focus:ring-emerald-100 focus:border-emerald-400 shadow-2xs transition-all"
            />
          </div>
        )}
      </form>
    </Modal>
  );
}
