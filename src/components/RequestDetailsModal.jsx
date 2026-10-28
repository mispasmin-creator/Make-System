import React, { useState } from 'react';
import {
  Globe,
  ExternalLink,
  Lock,
  User,
  Copy,
  Check,
  Eye,
  EyeOff,
  AlertTriangle,
  RefreshCw,
  CheckCircle2,
  Clock,
  Calendar,
  Building,
  FileText,
  Layers,
  ChevronRight
} from 'lucide-react';
import { Modal } from './Modal';
import { StatusBadge } from './StatusBadge';
import { WorkflowStepTracker } from './WorkflowStepTracker';
import { ImageAttachmentCell } from './ImageAttachmentCell';
import { formatDisplayDate, formatDisplayDateTime } from '../utils/dateUtils';
import { WORK_STATUS, STAGES } from '../constants/stages';

export function RequestDetailsModal({ isOpen, onClose, request, activePage = 'requests' }) {
  const [showPassword, setShowPassword] = useState(false);
  const [copiedField, setCopiedField] = useState(null);
  const [copyError, setCopyError] = useState('');

  if (!isOpen || !request) return null;

  const isHold = request.workStatus === WORK_STATUS.ON_HOLD;
  const isClosed = request.currentStage === STAGES.CLOSED;
  const hasRevision = Boolean(request.currentRevisionNo) || (Array.isArray(request.testingHistory) && request.testingHistory.some(t => t && t.decision === 'Rejected'));

  // Calculate actual completion date
  const completedDate =
    request.closedAt ||
    request.completedAt ||
    request.misUpdate?.updatedAt ||
    (isClosed ? request.lastUpdatedAt : null) ||
    request.testingApprovedAt ||
    request.actualMisDate ||
    (request.workStatus === WORK_STATUS.COMPLETED && request.progressPercent === 100
      ? (request.actualCreateDate || request.developmentHistory?.slice(-1)[0]?.updatedAt || null)
      : null);

  // Rejection/Revision reason
  const revisionReason =
    request.latestRejectionReason ||
    (Array.isArray(request.testingHistory) && request.testingHistory.length > 0 && request.testingHistory.slice(-1)[0]?.remarks) ||
    (hasRevision ? request.latestRemarks : null);

  const copyToClipboard = async (text, field) => {
    if (!text) return;
    setCopyError('');
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    } catch {
      setCopyError('Copy is unavailable. Select the text to copy it manually.');
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`System Request: ${request.requestNo}`}
      subtitle={`${request.companyName || ''} • ${request.systemName || request.systemRequirements || 'Internal System'}`}
      large
      footer={
        <button
          type="button"
          className="bg-slate-100 hover:bg-slate-200/80 text-slate-700 rounded-xl text-xs font-semibold px-5 py-2 cursor-pointer transition-all hover:-translate-y-0.5"
          onClick={onClose}
        >
          Close Dialog
        </button>
      }
    >
      <div className="space-y-4">
        {copyError && <p role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">{copyError}</p>}
        {/* 1. Horizontal Workflow Step Tracker */}
        <WorkflowStepTracker
          currentStage={request.currentStage}
          isHold={isHold}
          hasRevision={hasRevision}
          activePage={activePage}
        />

        {/* 2. Executive System & Stage Status Card */}
        <div className="p-4 bg-white border border-slate-200/80 rounded-2xl shadow-xs space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono font-bold text-base text-indigo-600 bg-indigo-50/80 px-2.5 py-0.5 rounded-lg border border-indigo-100">
                  {request.requestNo}
                </span>
                <StatusBadge label={request.currentStage} />
                {request.workStatus && (
                  <StatusBadge type="workStatus" value={request.workStatus} />
                )}
                {request.currentRevisionNo && (
                  <StatusBadge type="revision" value={request.currentRevisionNo} />
                )}
              </div>
              <div className="text-xs text-slate-600 flex items-center gap-2 pt-0.5">
                <span className="flex items-center gap-1 font-semibold text-slate-800">
                  <Building className="w-3.5 h-3.5 text-slate-400" />
                  {request.companyName}
                </span>
                <span className="text-slate-300">•</span>
                <span className="flex items-center gap-1 text-slate-700">
                  <User className="w-3.5 h-3.5 text-slate-400" />
                  Developer: <strong className="text-slate-900">{request.assignedDeveloper || 'Unassigned'}</strong>
                </span>
              </div>
            </div>

            {/* Development / Progress Indicator */}
            <div className="min-w-[140px] text-right">
              <div className="flex justify-between text-[11px] font-semibold mb-1">
                <span className="text-slate-500">Progress</span>
                <span className="text-slate-900 font-mono font-bold">{request.progressPercent || 0}%</span>
              </div>
              <div className="w-36 h-2 bg-slate-100 rounded-full overflow-hidden p-0.5 ml-auto border border-slate-200/60">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${isHold
                    ? 'bg-rose-500'
                    : request.progressPercent === 100
                      ? 'bg-emerald-500'
                      : 'bg-indigo-600'
                    }`}
                  style={{ width: `${request.progressPercent || 0}%` }}
                />
              </div>
            </div>
          </div>

          {/* System Name Header */}
          <div className="pt-2 border-t border-slate-100">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">
              System Name & Purpose
            </span>
            <p className="text-xs font-semibold text-slate-800 leading-relaxed">
              {request.systemName || request.systemRequirements}
            </p>
            {request.businessPurpose && (
              <p className="text-[11px] text-slate-500 mt-1 leading-normal">
                {request.businessPurpose}
              </p>
            )}
          </div>
        </div>

        {/* 3. CONDITIONAL ALERT: Reason for Hold (Only if On Hold) */}
        {isHold && (
          <div className="p-4 bg-rose-50/90 border border-rose-200/90 rounded-2xl text-rose-950 space-y-2 shadow-[0_4px_16px_rgba(244,63,94,0.06)] animate-fadeIn">
            <div className="flex items-center gap-2 font-bold text-xs text-rose-800 uppercase tracking-wider">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>System Is On Hold</span>
            </div>
            <div className="text-xs bg-white/80 p-3 rounded-xl border border-rose-100 space-y-1">
              <div>
                <strong className="text-rose-900">Reason for Hold:</strong>{' '}
                <span className="text-rose-800 font-medium">{request.holdReason || request.latestRemarks || 'No specific reason provided.'}</span>
              </div>
              {request.holdExtendTargetDate && (
                <div className="text-[11px] font-semibold text-rose-700 pt-1 border-t border-rose-100/80">
                  Hold Extend Target Date  : <strong>{formatDisplayDate(request.holdExtendTargetDate)}</strong>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 4. CONDITIONAL ALERT: Reason for Revision (Only if Under Revision) */}
        {hasRevision && (
          <div className="p-4 bg-amber-50/90 border border-amber-200/90 rounded-2xl text-amber-950 space-y-2 shadow-[0_4px_16px_rgba(245,158,11,0.06)] animate-fadeIn">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-bold text-xs text-amber-900 uppercase tracking-wider">
                <RefreshCw className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Revision in Progress ({request.currentRevisionNo || 'REV-01'})</span>
              </div>
              {request.upgradeTargetDate && (
                <span className="text-[11px] font-bold text-purple-700 bg-purple-50 px-2.5 py-0.5 rounded-lg border border-purple-200/80">
                  Upgrade Target Date: {formatDisplayDate(request.upgradeTargetDate)}
                </span>
              )}
            </div>
            <div className="text-xs bg-white/80 p-3 rounded-xl border border-amber-100 space-y-1">
              <div>
                <strong className="text-amber-950">Revision Reason / QA Defect Feedback:</strong>
                <p className="mt-1 font-medium text-amber-900 leading-relaxed">
                  {revisionReason || 'Defect resolution and enhancements requested by QA.'}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* 5. DATES SUMMARY CARD (Original Target, Upgrade Target, Hold Extended, Completion Date) */}
        <div className="p-4 bg-white border border-slate-200/80 rounded-2xl shadow-xs">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 uppercase tracking-wider mb-3">
            <Calendar className="w-4 h-4 text-indigo-600" />
            <span>Timeline & Target Dates</span>
          </div>

          <div className={`grid grid-cols-2 gap-3 ${hasRevision && request.upgradeTargetDate ? 'sm:grid-cols-4' : 'sm:grid-cols-3'}`}>
            {/* Target Completion Date */}
            <div className="p-2.5 bg-slate-50/80 border border-slate-100 rounded-xl">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
                Target Completion
              </span>
              <span className="text-xs font-bold text-slate-800 block mt-0.5">
                {formatDisplayDate(request.targetCompletionDate) || '—'}
              </span>
            </div>

            {/* Upgrade Target Date (If Revision) */}
            {hasRevision && request.upgradeTargetDate && <div className="p-2.5 bg-purple-50/60 border border-purple-100 rounded-xl">
              <span className="text-[10px] text-purple-700 font-bold uppercase tracking-wider block">
                Upgrade Target Date
              </span>
              <span className="text-xs font-bold text-purple-900 block mt-0.5">
                {request.upgradeTargetDate ? formatDisplayDate(request.upgradeTargetDate) : 'Not Revised'}
              </span>
            </div>}

            {/* Hold Extend Date (If Hold) */}
            <div className="p-2.5 bg-rose-50/60 border border-rose-100 rounded-xl">
              <span className="text-[10px] text-rose-700 font-bold uppercase tracking-wider block">
                Hold Extend Date
              </span>
              <span className="text-xs font-bold text-rose-900 block mt-0.5">
                {request.holdExtendTargetDate ? formatDisplayDate(request.holdExtendTargetDate) : 'None'}
              </span>
            </div>

            {/* System Completed Date */}
            <div className={`p-2.5 rounded-xl border ${completedDate ? 'bg-emerald-50/70 border-emerald-200/80' : 'bg-slate-50/80 border-slate-100'}`}>
              <span className="text-[10px] font-bold uppercase tracking-wider block text-emerald-800">
                Completed Date
              </span>
              {completedDate ? (
                <div className="mt-0.5 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span className="text-xs font-bold text-emerald-900 truncate">
                    {formatDisplayDate(completedDate)}
                  </span>
                </div>
              ) : (
                <span className="text-xs font-medium text-slate-400 block mt-0.5 italic">
                  In Progress
                </span>
              )}
            </div>
          </div>
        </div>

        {/* 6. DEPLOYED SYSTEM LINK & USER CREDENTIALS (High-Visibility Single Card) */}
        {(request.systemUrl || request.adminId || request.adminPassword) ? (
          <div className="p-4 bg-gradient-to-br from-indigo-50/80 via-white to-blue-50/60 border border-indigo-200/80 rounded-2xl shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-indigo-600 text-white rounded-lg shadow-2xs">
                  <Globe className="w-4 h-4" />
                </div>
                <div>
                  <span className="font-bold text-xs uppercase tracking-wider text-indigo-950 block">
                    Deployed System & Credentials
                  </span>
                  <span className="text-[10px] text-slate-500">
                    Live system access for testing and production usage
                  </span>
                </div>
              </div>

              {request.systemUrl && (
                <a
                  href={request.systemUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white shadow-2xs transition-all hover:-translate-y-0.5 cursor-pointer"
                >
                  <span>Open System</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}
            </div>

            {/* URL Display */}
            {request.systemUrl && (
              <div className="p-2.5 bg-white/90 border border-indigo-100 rounded-xl flex items-center justify-between gap-2 text-xs">
                <div className="min-w-0 flex items-center gap-2">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider shrink-0">
                    URL:
                  </span>
                  <a
                    href={request.systemUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="font-medium text-indigo-600 hover:underline truncate"
                  >
                    {request.systemUrl}
                  </a>
                </div>
                <button
                  type="button"
                  onClick={() => copyToClipboard(request.systemUrl, 'url')}
                  className="shrink-0 p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors cursor-pointer"
                  title="Copy URL"
                >
                  {copiedField === 'url' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            )}

            {/* Credentials Row: Admin ID & Password */}
            {(request.adminId || request.adminPassword) && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {/* Admin ID / Username */}
                {request.adminId && (
                  <div className="p-2.5 bg-white/90 border border-indigo-100 rounded-xl flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
                        Admin ID / Username
                      </span>
                      <span className="font-mono font-bold text-slate-800 text-xs select-all">
                        {request.adminId}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(request.adminId, 'id')}
                      className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                      title="Copy Username"
                    >
                      {copiedField === 'id' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                )}

                {/* Password */}
                {request.adminPassword && (
                  <div className="p-2.5 bg-white/90 border border-indigo-100 rounded-xl flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
                        Password
                      </span>
                      <span className="font-mono font-bold text-slate-800 text-xs select-all">
                        {showPassword ? request.adminPassword : '••••••••••••'}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                        title={showPassword ? 'Hide Password' : 'Show Password'}
                      >
                        {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                      <button
                        type="button"
                        onClick={() => copyToClipboard(request.adminPassword, 'pass')}
                        className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                        title="Copy Password"
                      >
                        {copiedField === 'pass' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="p-3 bg-slate-50 border border-dashed border-slate-200 rounded-xl text-center text-xs text-slate-400">

          </div>
        )}

        {/* 7. Attachments (Clean & Compact, only if attachments exist) */}
        {Array.isArray(request.attachments) && request.attachments.length > 0 && (
          <div className="p-3.5 bg-white border border-slate-200/80 rounded-2xl space-y-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
              Attachments ({request.attachments.length})
            </span>
            <div className="space-y-1.5">
              {request.attachments.map((att) => (
                <div key={att.id} className="flex items-center justify-between p-2 bg-slate-50/80 border border-slate-100 rounded-xl text-xs gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <ImageAttachmentCell attachments={[att]} showAsTd={false} />
                    <span className="font-semibold text-slate-800 truncate">{att.name}</span>
                  </div>
                  {att.url || att.driveUrl ? (
                    <a
                      href={att.url || att.driveUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 transition-all"
                    >
                      <span>Drive</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

