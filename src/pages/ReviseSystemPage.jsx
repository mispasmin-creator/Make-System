import React, { useState, useMemo } from 'react';
import {
  RefreshCw,
  AlertTriangle,
  Clock,
  Edit3,
  Eye,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { StatusBadge } from '../components/StatusBadge';
import { Pagination } from '../components/Pagination';
import { ImageAttachmentCell } from '../components/ImageAttachmentCell';
import { formatDisplayDate, calculateDueStatus } from '../utils/dateUtils';
import { STAGES, WORK_STATUS } from '../constants/stages';
import { CreateActionModal } from '../components/CreateActionModal';

function formatRevisionLabel(rev) {
  if (!rev) return '-';
  const match = String(rev).match(/REV-?(\d+)/i);
  return match ? `REV-${String(match[1]).padStart(2, '0')}` : rev;
}

export function ReviseSystemPage({
  requests = [],
  onUpdateProgress,
  onViewDetails,
  canEdit = true
}) {
  const [activeTab, setActiveTab] = useState('pending'); // 'pending' | 'completed'
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Pending Revisions: Any request with an active revision that is currently in revision development
  const pendingRequests = useMemo(() => {
    return requests.filter(r => {
      const hasRevision = Boolean(r.currentRevisionNo) || (r.testingHistory && r.testingHistory.some(t => t.decision === 'Rejected'));
      const isPendingRevision = r.currentStage === STAGES.REVISE || (r.currentStage === STAGES.CREATE && Boolean(r.currentRevisionNo));
      return hasRevision && isPendingRevision && r.workStatus !== WORK_STATUS.COMPLETED;
    });
  }, [requests]);

  // Completed Revisions: Any request that underwent revisions and completed revision development
  const completedRequests = useMemo(() => {
    return requests.filter(r => {
      const hasRevision = Boolean(r.currentRevisionNo) || (r.testingHistory && r.testingHistory.some(t => t.decision === 'Rejected'));
      const isPastRevision = r.currentStage === STAGES.TESTING || r.currentStage === STAGES.UPDATE_MIS || r.currentStage === STAGES.CLOSED;
      return hasRevision && (isPastRevision || (r.workStatus === WORK_STATUS.COMPLETED && r.currentStage !== STAGES.REVISE));
    });
  }, [requests]);

  const urgentSummary = useMemo(() => {
    let overdue = 0;
    let dueSoon = 0;
    pendingRequests.forEach(r => {
      const due = calculateDueStatus(r.upgradeTargetDate || r.holdExtendTargetDate || r.targetCompletionDate);
      if (due.isOverdue) overdue++;
      else if (due.isDueSoon) dueSoon++;
    });
    return { overdue, dueSoon };
  }, [pendingRequests]);

  const activeList = activeTab === 'pending' ? pendingRequests : completedRequests;

  const paginatedList = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return activeList.slice(start, start + pageSize);
  }, [activeList, currentPage, pageSize]);

  return (
    <div className="h-full flex flex-col bg-[#f6f8fb] space-y-4 p-5 overflow-hidden font-sans">
      {/* Sticky Page Header */}
      <div className="bg-white rounded-2xl border border-slate-200/70 p-4 shadow-[0_4px_20px_-2px_rgba(15,23,42,0.04),0_2px_6px_-1px_rgba(15,23,42,0.02)] flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-amber-400 text-white flex items-center justify-center shadow-sm shadow-amber-300/40 shrink-0">
            <RefreshCw className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-800 leading-tight tracking-tight">Revise System</h1>
            <p className="text-xs text-slate-500">
              Defect resolution, revision development queue, and re-submission to QA testing • <strong>{pendingRequests.length}</strong> active revisions
            </p>
          </div>
        </div>

        {/* Tab Switcher & Urgent Badges */}
        <div className="flex items-center gap-3">
          {activeTab === 'pending' && (urgentSummary.overdue > 0 || urgentSummary.dueSoon > 0) && (
            <div className="flex items-center gap-2">
              {urgentSummary.overdue > 0 && (
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-rose-50/90 text-rose-700 border border-rose-200/70 flex items-center gap-1.5 shadow-2xs">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  {urgentSummary.overdue} Overdue
                </span>
              )}
              {urgentSummary.dueSoon > 0 && (
                <span className="px-3 py-1 rounded-full text-xs font-semibold bg-amber-50/90 text-amber-700 border border-amber-200/70 flex items-center gap-1.5 shadow-2xs">
                  <Clock className="w-3.5 h-3.5" />
                  {urgentSummary.dueSoon} Due Soon
                </span>
              )}
            </div>
          )}

          <div className="flex items-center bg-slate-100/80 p-1.5 rounded-xl border border-slate-200/70 text-xs font-semibold">
            <button
              type="button"
              className={`px-3.5 py-1.5 rounded-lg transition-all cursor-pointer ${
                activeTab === 'pending'
                  ? 'bg-white text-indigo-700 shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              onClick={() => {
                setActiveTab('pending');
                setCurrentPage(1);
              }}
            >
              Pending Revisions ({pendingRequests.length})
            </button>
            <button
              type="button"
              className={`px-3.5 py-1.5 rounded-lg transition-all cursor-pointer ${
                activeTab === 'completed'
                  ? 'bg-white text-indigo-700 shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              onClick={() => {
                setActiveTab('completed');
                setCurrentPage(1);
              }}
            >
              Completed Revisions ({completedRequests.length})
            </button>
          </div>
        </div>
      </div>

      {/* Main Table Card */}
      <div className="flex-1 bg-white border border-slate-200/70 rounded-2xl shadow-[0_6px_24px_-4px_rgba(15,23,42,0.05),0_2px_8px_-1px_rgba(15,23,42,0.02)] overflow-hidden flex flex-col min-h-0">
        <div className="flex-1 overflow-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="sticky top-0 bg-slate-50/90 z-20 shadow-xs border-b border-slate-200/70">
              <tr>
                {/* Sticky Left Action Column */}
                <th className="sticky left-0 bg-slate-50/95 z-30 border-r border-slate-200/70 px-3.5 py-3 font-semibold text-slate-600 uppercase tracking-wider text-[11px] whitespace-nowrap">
                  Action
                </th>
                <th className="px-3.5 py-3 font-semibold text-slate-600 uppercase tracking-wider text-[11px] whitespace-nowrap">
                  Request No.
                </th>
                <th className="px-3.5 py-3 font-semibold text-slate-600 uppercase tracking-wider text-[11px] whitespace-nowrap">
                  Revision No.
                </th>
                <th className="px-3.5 py-3 font-semibold text-slate-600 uppercase tracking-wider text-[11px] whitespace-nowrap">
                  Company
                </th>
                <th className="px-3.5 py-3 font-semibold text-slate-600 uppercase tracking-wider text-[11px] min-w-[200px]">
                  System Name
                </th>
                <th className="px-3.5 py-3 font-semibold text-slate-600 uppercase tracking-wider text-[11px] whitespace-nowrap text-center">
                  Image
                </th>
                <th className="px-3.5 py-3 font-semibold text-slate-600 uppercase tracking-wider text-[11px] whitespace-nowrap">
                  Assigned Developer
                </th>
                <th className="px-3.5 py-3 font-semibold text-slate-600 uppercase tracking-wider text-[11px] whitespace-nowrap">
                  Target Date
                </th>
                {activeTab === 'pending' ? (
                  <>
                    <th className="px-3.5 py-3 font-semibold text-slate-600 uppercase tracking-wider text-[11px] whitespace-nowrap">
                      Due Status
                    </th>
                    <th className="px-3.5 py-3 font-semibold text-slate-600 uppercase tracking-wider text-[11px] whitespace-nowrap">
                      Work Status
                    </th>
                    <th className="px-3.5 py-3 font-semibold text-slate-600 uppercase tracking-wider text-[11px] whitespace-nowrap">
                      Progress
                    </th>
                    <th className="px-3.5 py-3 font-semibold text-slate-600 uppercase tracking-wider text-[11px] min-w-[220px]">
                      Revision Feedback / Remarks
                    </th>
                  </>
                ) : (
                  <>
                    <th className="px-3.5 py-3 font-semibold text-slate-600 uppercase tracking-wider text-[11px] whitespace-nowrap">
                      Current Stage
                    </th>
                    <th className="px-3.5 py-3 font-semibold text-slate-600 uppercase tracking-wider text-[11px] min-w-[220px]">
                      Outcome / Latest Remarks
                    </th>
                  </>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs text-slate-600">
              {paginatedList.length === 0 ? (
                <tr>
                  <td colSpan={activeTab === 'pending' ? 12 : 10} className="py-12 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <CheckCircle2 className="w-8 h-8 text-slate-300 stroke-[1.5]" />
                      <span className="font-semibold text-sm">
                        {activeTab === 'pending'
                          ? 'No pending revisions. All QA test cycles are currently clear!'
                          : 'No completed revisions found.'}
                      </span>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedList.map((req) => {
                  const isOnHold = req.workStatus === WORK_STATUS.ON_HOLD;
                  const isDone = req.workStatus === WORK_STATUS.COMPLETED;

                  return (
                    <tr
                      key={req.id}
                      className={`hover:bg-slate-50/80 transition-colors ${
                        isOnHold ? 'bg-rose-50/40' : ''
                      }`}
                    >
                      {/* Sticky Left Action Column */}
                      <td className="sticky left-0 bg-white group-hover:bg-slate-50/90 z-10 border-r border-slate-100 px-3 py-2 text-center shadow-xs whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          {activeTab === 'pending' && canEdit && (
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedRequest(req);
                                setIsModalOpen(true);
                              }}
                              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold rounded-xl text-white shadow-xs hover:shadow-sm hover:-translate-y-0.5 transition-all cursor-pointer ${
                                isOnHold
                                  ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-300/40'
                                  : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-300/40'
                              }`}
                            >
                              <Edit3 className="w-3 h-3" />
                              <span>Update</span>
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => onViewDetails(req)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-semibold rounded-xl bg-white border border-slate-200/80 text-slate-600 hover:bg-slate-50 hover:text-slate-900 shadow-2xs hover:-translate-y-0.5 transition-all cursor-pointer"
                          >
                            <Eye className="w-3 h-3 text-slate-400" />
                            <span>Details</span>
                          </button>
                        </div>
                      </td>

                      {/* Request No */}
                      <td className="px-3.5 py-2.5 whitespace-nowrap">
                        <span className="font-mono font-bold text-indigo-600">
                          {req.requestNo}
                        </span>
                      </td>

                      {/* Revision No */}
                      <td className="px-3.5 py-2.5 whitespace-nowrap">
                        {req.currentRevisionNo ? (
                          <StatusBadge type="revision" value={req.currentRevisionNo} />
                        ) : (
                          <span className="text-slate-400 font-mono text-xs">-</span>
                        )}
                      </td>

                      {/* Company Name */}
                      <td className="px-3.5 py-2.5 whitespace-nowrap font-semibold text-slate-800">
                        {req.companyName}
                      </td>

                      {/* System Name */}
                      <td className="px-3.5 py-2.5 text-slate-800 max-w-xs truncate">
                        <div className="font-semibold line-clamp-1">
                          {req.systemName || req.systemRequirements}
                        </div>
                        {req.businessPurpose && (
                          <div className="text-[11px] text-slate-500 line-clamp-1">
                            {req.businessPurpose}
                          </div>
                        )}
                      </td>

                      <ImageAttachmentCell
                        attachments={req.attachments}
                        onViewDetails={() => onViewDetails(req)}
                      />

                      {/* Developer */}
                      <td className="px-3.5 py-2.5 whitespace-nowrap text-slate-700">
                        {req.assignedDeveloper}
                      </td>

                      {/* Target Date */}
                      <td className="px-3.5 py-2.5 whitespace-nowrap font-medium text-slate-800">
                        <div>{formatDisplayDate(req.targetCompletionDate)}</div>
                        {req.upgradeTargetDate && (
                          <div className="text-[10px] text-purple-700 font-semibold bg-purple-50 border border-purple-200/80 rounded px-1.5 py-0.5 mt-0.5 inline-block" title="Upgrade Target Date (Col Z)">
                            Upgrade: {formatDisplayDate(req.upgradeTargetDate)}
                          </div>
                        )}
                        {req.holdExtendTargetDate && !req.upgradeTargetDate && (
                          <div className="text-[10px] text-amber-700 font-semibold bg-amber-50 border border-amber-200/80 rounded px-1.5 py-0.5 mt-0.5 inline-block" title={`Extended for Hold: ${req.holdReason || ''}`}>
                            Hold Ext: {formatDisplayDate(req.holdExtendTargetDate)}
                          </div>
                        )}
                      </td>

                      {/* Pending Tab: Due Status, Work Status, Progress & Feedback */}
                      {activeTab === 'pending' && (
                        <>
                          <td className="px-3.5 py-2.5 whitespace-nowrap">
                            <StatusBadge
                              type="due"
                              targetDate={req.targetCompletionDate}
                              holdExtendTargetDate={req.holdExtendTargetDate}
                              upgradeTargetDate={req.upgradeTargetDate}
                            />
                          </td>

                          <td className="px-3.5 py-2.5 whitespace-nowrap">
                            <StatusBadge type="workStatus" value={req.workStatus} />
                          </td>

                          <td className="px-3.5 py-2.5 whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full transition-all duration-300 ${
                                    isOnHold
                                      ? 'bg-rose-500'
                                      : isDone
                                      ? 'bg-emerald-500'
                                      : 'bg-indigo-600'
                                  }`}
                                  style={{ width: `${req.progressPercent || 0}%` }}
                                />
                              </div>
                              <span className="font-mono font-bold text-[11px] text-slate-800 w-7 text-right">
                                {req.progressPercent || 0}%
                              </span>
                            </div>
                          </td>

                          <td className="px-3.5 py-2.5 max-w-xs text-slate-700" title={req.latestRejectionReason || req.latestRemarks}>
                            <div className="text-xs line-clamp-2 font-medium text-rose-800 bg-rose-50/80 p-1.5 rounded-lg border border-rose-100">
                              {req.latestRejectionReason || req.latestRemarks || 'Pending revision development'}
                            </div>
                          </td>
                        </>
                      )}

                      {/* Completed Tab: Current Stage & Outcome */}
                      {activeTab === 'completed' && (
                        <>
                          <td className="px-3.5 py-2.5 whitespace-nowrap">
                            <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              {req.currentStage}
                            </span>
                          </td>

                          <td className="px-3.5 py-2.5 text-slate-700 max-w-xs">
                            <div className="text-xs line-clamp-2 text-slate-600">
                              {req.latestRemarks || 'Revision cycle completed and verified.'}
                            </div>
                          </td>
                        </>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination bar */}
        <Pagination
          currentPage={currentPage}
          pageSize={pageSize}
          totalItems={activeList.length}
          onPageChange={setCurrentPage}
          onPageSizeChange={(newSize) => {
            setPageSize(newSize);
            setCurrentPage(1);
          }}
        />
      </div>

      {/* Progress & Development Update Modal */}
      {selectedRequest && (
        <CreateActionModal
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setSelectedRequest(null);
          }}
          request={selectedRequest}
          onSubmit={onUpdateProgress}
        />
      )}
    </div>
  );
}
