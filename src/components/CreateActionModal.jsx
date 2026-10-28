import React, { useState, useEffect } from 'react';
import { Check, PauseCircle, PlayCircle, AlertCircle, Globe, User, Lock, Eye, EyeOff } from 'lucide-react';
import { Modal } from './Modal';
import { WORK_STATUS } from '../constants/stages';

export function CreateActionModal({ isOpen, onClose, request, onSubmit }) {
  const [workStatus, setWorkStatus] = useState(WORK_STATUS.IN_PROGRESS);
  const [progressPercent, setProgressPercent] = useState('25');
  const [remarks, setRemarks] = useState('');
  const [holdReason, setHoldReason] = useState('');
  const [extendedTargetDate, setExtendedTargetDate] = useState('');
  const [systemUrl, setSystemUrl] = useState('');
  const [adminId, setAdminId] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen && request) {
      const initialStatus = request.workStatus || WORK_STATUS.IN_PROGRESS;
      setWorkStatus(initialStatus);
      const reqPct = Number(request.progressPercent);
      setProgressPercent([25, 50, 75, 100].includes(reqPct) ? String(reqPct) : '25');
      setRemarks('');
      setHoldReason(request.workStatus === WORK_STATUS.ON_HOLD ? (request.holdReason || request.latestRemarks || '') : (request.holdReason || ''));
      setExtendedTargetDate(request.holdExtendTargetDate || '');
      setSystemUrl(request.systemUrl || '');
      setAdminId(request.adminId || '');
      setAdminPassword(request.adminPassword || '');
      setShowPassword(false);
      setErrors({});
      setIsSubmitting(false);
    }
  }, [isOpen, request]);

  if (!request) return null;

  function validate() {
    const errs = {};
    if (workStatus === WORK_STATUS.IN_PROGRESS) {
      if (!remarks.trim()) errs.remarks = 'Progress Remarks are required when status is In Progress';
    } else if (workStatus === WORK_STATUS.ON_HOLD) {
      if (!holdReason.trim()) errs.holdReason = 'Reason for Hold is required when putting on hold';
    } else if (workStatus === WORK_STATUS.COMPLETED) {
      if (!systemUrl.trim()) errs.systemUrl = 'Please paste the link / URL of the completed system';
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!validate()) return;

    setIsSubmitting(true);
    try {
      await onSubmit(request.id, {
        workStatus,
        progressPercent: workStatus === WORK_STATUS.COMPLETED ? 100 : parseInt(progressPercent, 10),
        remarks: remarks.trim(),
        holdReason: holdReason.trim(),
        holdExtendTargetDate: (workStatus === WORK_STATUS.ON_HOLD && extendedTargetDate) ? extendedTargetDate : null,
        extendedTargetDate: (workStatus === WORK_STATUS.ON_HOLD && extendedTargetDate) ? extendedTargetDate : null,
        systemUrl: systemUrl.trim(),
        adminId: adminId.trim(),
        adminPassword: adminPassword.trim()
      });
      onClose();
    } catch (err) {
      setErrors({ form: err.message || 'Failed to update development status' });
    } finally {
      setIsSubmitting(false);
    }
  }

  const isHold = workStatus === WORK_STATUS.ON_HOLD;
  const isDone = workStatus === WORK_STATUS.COMPLETED;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Update Development: ${request.requestNo}`}
      subtitle={`${request.companyName} • ${request.currentRevisionNo || 'Base Development'}`}
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
              isHold
                ? 'bg-rose-600 hover:bg-rose-700 text-white shadow-rose-200'
                : isDone
                ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-200'
                : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-200'
            }`}
          >
            {isSubmitting ? (
              <>
                <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Saving...</span>
              </>
            ) : isDone ? (
              <>
                <Check className="w-4 h-4" />
                <span>Complete &amp; Send to Update MIS</span>
              </>
            ) : isHold ? (
              <>
                <PauseCircle className="w-4 h-4" />
                <span>Save & Put On Hold</span>
              </>
            ) : (
              <>
                <PlayCircle className="w-4 h-4" />
                <span>Save Progress Update</span>
              </>
            )}
          </button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Context info */}
        <div className="p-3.5 bg-slate-50/80 border border-slate-100 rounded-xl text-xs space-y-1.5">
          <div className="flex justify-between items-center">
            <span>
              <strong className="text-slate-900">Request:</strong>{' '}
              <span className="font-mono text-indigo-600 font-bold">{request.requestNo}</span>
              {request.currentRevisionNo && (
                <span className="ml-2 font-mono font-bold text-rose-700 bg-rose-50 border border-rose-200 px-1.5 py-0.5 rounded text-[11px]">
                  {request.currentRevisionNo}
                </span>
              )}
            </span>
            <div className="text-right">
              <div><strong className="text-slate-900">Target Date:</strong> {request.targetCompletionDate}</div>
              {request.upgradeTargetDate && (
                <div className="text-purple-700 font-bold text-[11px]">Upgrade: {request.upgradeTargetDate}</div>
              )}
            </div>
          </div>
          <div><strong className="text-slate-900">Developer:</strong> {request.assignedDeveloper}</div>
          {request.latestRejectionReason && (
            <div className="mt-1.5 p-2.5 bg-rose-50/80 border border-rose-100 rounded-lg text-rose-700">
              <strong>Revision Feedback:</strong> {request.latestRejectionReason}
            </div>
          )}
        </div>

        {errors.form && (
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs font-semibold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errors.form}</span>
          </div>
        )}

        {/* Work Status Selector */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5" htmlFor="workStatusSelect">
            Work Status <span className="text-rose-500">*</span>
          </label>
          <select
            id="workStatusSelect"
            value={workStatus}
            onChange={(e) => {
              setWorkStatus(e.target.value);
              setErrors({});
            }}
            className="w-full px-3.5 py-2.5 bg-white border border-slate-200/80 rounded-xl text-slate-800 text-sm focus:outline-none focus:ring-4 focus:ring-indigo-100/60 focus:border-indigo-400 shadow-2xs cursor-pointer transition-all"
          >
            <option value={WORK_STATUS.IN_PROGRESS}>In Progress</option>
            <option value={WORK_STATUS.ON_HOLD}>On Hold</option>
            <option value={WORK_STATUS.COMPLETED}>Completed</option>
          </select>
        </div>

        {/* Condition A: In Progress */}
        {workStatus === WORK_STATUS.IN_PROGRESS && (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5" htmlFor="progressSelect">
                Progress Percentage (%) <span className="text-rose-500">*</span>
              </label>
              <select
                id="progressSelect"
                value={progressPercent}
                onChange={(e) => setProgressPercent(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-white border border-slate-200/80 rounded-xl text-slate-800 text-sm focus:outline-none focus:ring-4 focus:ring-indigo-100/60 focus:border-indigo-400 shadow-2xs cursor-pointer transition-all"
              >
                {[25, 50, 75, 100].map((pct) => (
                  <option key={pct} value={pct}>{pct}%</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5" htmlFor="progressRemarks">
                Progress Remarks <span className="text-rose-500">*</span>
              </label>
              <textarea
                id="progressRemarks"
                rows={3}
                placeholder="Detail current accomplishments, components finished, and next steps..."
                value={remarks}
                onChange={(e) => {
                  setRemarks(e.target.value);
                  if (errors.remarks) setErrors(prev => ({ ...prev, remarks: '' }));
                }}
                className="w-full px-3.5 py-2.5 bg-white border border-slate-200/80 rounded-xl text-slate-800 text-sm placeholder-slate-400 focus:outline-none focus:ring-4 focus:ring-indigo-100/60 focus:border-indigo-400 shadow-2xs transition-all"
              />
              {errors.remarks && <span className="text-[11px] text-rose-600 font-semibold mt-1 block">{errors.remarks}</span>}
            </div>
          </div>
        )}

        {/* Condition B: On Hold */}
        {workStatus === WORK_STATUS.ON_HOLD && (
          <div className="p-4 bg-rose-50/50 border border-rose-100 rounded-xl space-y-3">
            <div>
              <label className="block text-xs font-bold text-rose-700 uppercase tracking-wider mb-1.5" htmlFor="holdReasonInput">
                Reason for Hold <span className="text-rose-600">* (Mandatory)</span>
              </label>
              <textarea
                id="holdReasonInput"
                rows={3}
                placeholder="Specify the blocker, required dependency, missing approvals, or third-party delay..."
                value={holdReason}
                onChange={(e) => {
                  setHoldReason(e.target.value);
                  if (errors.holdReason) setErrors(prev => ({ ...prev, holdReason: '' }));
                }}
                className="w-full px-3.5 py-2.5 bg-white border border-rose-200 rounded-xl text-slate-800 text-sm placeholder-slate-400 focus:outline-none focus:ring-4 focus:ring-rose-100 focus:border-rose-400 shadow-2xs transition-all"
              />
              {errors.holdReason && <span className="text-[11px] text-rose-600 font-semibold mt-1 block">{errors.holdReason}</span>}
            </div>

            {/* Hold Extend Target Date Option */}
            <div className="p-3 bg-white border border-rose-100 rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider" htmlFor="extendedTargetDateInput">
                  Hold Extend Target Date <span className="text-slate-400 font-normal lowercase">(Col S)</span>
                </label>
                <span className="text-[11px] text-slate-500">
                  Original Target (Col G): <strong className="text-slate-700">{request.targetCompletionDate || 'Not set'}</strong>
                </span>
              </div>
              <div className="flex items-center gap-2">
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
                {extendedTargetDate && (
                  <button
                    type="button"
                    onClick={() => setExtendedTargetDate('')}
                    className="text-xs text-rose-600 hover:text-rose-800 px-3 py-2 bg-rose-50 hover:bg-rose-100 rounded-xl border border-rose-200 font-medium shrink-0 cursor-pointer transition-colors"
                    title="Clear extended target date"
                  >
                    Clear
                  </button>
                )}
              </div>
              {errors.extendedTargetDate && (
                <span className="text-[11px] text-rose-600 font-semibold block">{errors.extendedTargetDate}</span>
              )}
            </div>
          </div>
        )}

        {/* Condition C: Completed */}
        {workStatus === WORK_STATUS.COMPLETED && (
          <div className="p-4 bg-emerald-50/50 border border-emerald-100 rounded-2xl space-y-3.5">
            <div className="text-xs font-bold text-emerald-800 flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-600" />
                <span>Development Complete (100% Progress)</span>
              </span>
              <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-100/70 px-2 py-0.5 rounded-md">
                Ready for Testing
              </span>
            </div>

            {/* System Link / URL Field */}
            <div>
              <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-1.5" htmlFor="systemUrlInput">
                System Link / URL <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Globe className="w-4 h-4 text-indigo-500" />
                </div>
                <input
                  type="url"
                  id="systemUrlInput"
                  placeholder="https://... (Paste deployed system link, web app URL, or Google Sheet link)"
                  value={systemUrl}
                  onChange={(e) => {
                    setSystemUrl(e.target.value);
                    if (errors.systemUrl) setErrors(prev => ({ ...prev, systemUrl: '' }));
                  }}
                  className={`w-full pl-10 pr-3.5 py-2.5 bg-white border rounded-xl text-slate-800 text-sm placeholder-slate-400 focus:outline-none focus:ring-4 shadow-2xs transition-all ${
                    errors.systemUrl
                      ? 'border-rose-300 focus:ring-rose-100 focus:border-rose-400'
                      : 'border-slate-200/90 focus:ring-indigo-100 focus:border-indigo-400'
                  }`}
                />
              </div>
              {errors.systemUrl && (
                <span className="text-[11px] text-rose-600 font-semibold mt-1 block">{errors.systemUrl}</span>
              )}
            </div>

            {/* Admin Credentials: ID & Password Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5" htmlFor="adminIdInput">
                  Admin ID / Username
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <User className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    id="adminIdInput"
                    placeholder=""
                    value={adminId}
                    onChange={(e) => setAdminId(e.target.value)}
                    className="w-full pl-10 pr-3.5 py-2.5 bg-white border border-slate-200/90 rounded-xl text-slate-800 text-sm placeholder-slate-400 focus:outline-none focus:ring-4 focus:ring-indigo-100 focus:border-indigo-400 shadow-2xs transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5" htmlFor="adminPasswordInput">
                  Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    id="adminPasswordInput"
                    placeholder="Admin password for testing"
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    className="w-full pl-10 pr-10 py-2.5 bg-white border border-slate-200/90 rounded-xl text-slate-800 text-sm placeholder-slate-400 focus:outline-none focus:ring-4 focus:ring-indigo-100 focus:border-indigo-400 shadow-2xs transition-all font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                    title={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>

            {/* Optional Completion Remarks */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1" htmlFor="completionRemarks">
                Completion Remarks (Optional)
              </label>
              <textarea
                id="completionRemarks"
                rows={2}
                placeholder="Deployment details, staging build version, or testing instructions for QA..."
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                className="w-full px-3.5 py-2 bg-white border border-slate-200/80 rounded-xl text-slate-800 text-sm focus:outline-none focus:ring-4 focus:ring-emerald-100 focus:border-emerald-400 shadow-2xs transition-all"
              />
            </div>
          </div>
        )}
      </form>
    </Modal>
  );
}
