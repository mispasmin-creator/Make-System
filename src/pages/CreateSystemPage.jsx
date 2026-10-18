import React, { useState, useMemo } from 'react';
import {
  Code2,
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

export function CreateSystemPage({
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

  const pendingRequests = useMemo(() => {
    return requests.filter(r => r.introduction?.isCompleted && r.currentStage === STAGES.CREATE && !r.currentRevisionNo);
  }, [requests]);

  const completedRequests = useMemo(() => {
    return requests.filter(r =>
      r.currentStage === STAGES.TESTING ||
      r.currentStage === STAGES.UPDATE_MIS ||
      r.currentStage === STAGES.CLOSED ||
      (r.workStatus === WORK_STATUS.COMPLETED && r.currentStage !== STAGES.CREATE)
    );
  }, [requests]);

  const urgentSummary = useMemo(() => {
    let overdue = 0;
    let dueSoon = 0;
    pendingRequests.forEach(r => {
      const due = calculateDueStatus(r.holdExtendTargetDate || r.targetCompletionDate);
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
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-indigo-500 text-white flex items-center justify-center shadow-sm shadow-indigo-300/40 shrink-0">
            <Code2 className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-800 leading-tight tracking-tight">Create System</h1>
            <p className="text-xs text-slate-500">
              Active engineering cycles, milestones, hold states, and QA revisions • <strong>{pendingRequests.length}</strong> active
            </p>
          </div>
        </div>

        {/* Tab Switcher Pills */}
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
            Pending Dev ({pendingRequests.length})
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
            Completed ({completedRequests.length})
          </button>
        </div>
      </div>

      {/* In-app reminder banner */}
      {(urgentSummary.overdue > 0 || urgentSummary.dueSoon > 0) && (
        <div
          className={`p-3.5 rounded-2xl border flex items-center justify-between text-xs shrink-0 shadow-2xs ${
            urgentSummary.overdue > 0
              ? 'bg-rose-50/90 border-rose-200/70 text-rose-800'
              : 'bg-amber-50/90 border-amber-200/70 text-amber-800'
          }`}
        >
          <div className="flex items-center gap-2 font-medium">
            {urgentSummary.overdue > 0 ? (
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            ) : (
              <Clock className="w-4 h-4 text-amber-600 shrink-0" />
            )}
            <span>
              <strong>Development Priority Alert:</strong>{' '}
              {urgentSummary.overdue > 0 && `${urgentSummary.overdue} request(s) are Overdue past target date. `}
              {urgentSummary.dueSoon > 0 && `${urgentSummary.dueSoon} request(s) are Due Soon (1–3 calendar days remaining).`}
            </span>
          </div>
          <span className="text-[11px] font-bold opacity-75">Asia/Kolkata</span>
        </div>
      )}

      {/* Main Table Card */}
      <div className="bg-white rounded-2xl border border-slate-200/70 shadow-[0_6px_24px_-4px_rgba(15,23,42,0.05),0_2px_8px_-1px_rgba(15,23,42,0.02)] overflow-hidden flex flex-col flex-1 min-h-0">
        <div className="overflow-x-auto overflow-y-auto flex-1">
          <table className="w-full border-collapse text-left text-xs">
            <thead className="sticky top-0 bg-slate-50/90 z-20 shadow-xs border-b border-slate-200/70">
              <tr>
                {/* Sticky Left Action */}
                <th className="sticky left-0 bg-slate-50/95 z-30 border-r border-slate-200/70 px-3.5 py-3 font-semibold text-slate-600 uppercase tracking-wider text-[11px] whitespace-nowrap">
                  Action
                </th>
                <th className="px-3.5 py-3 font-semibold text-slate-600 uppercase tracking-wider text-[11px] whitespace-nowrap">
                  Request No.
                </th>
                <th className="px-3.5 py-3 font-semibold text-slate-600 uppercase tracking-wider text-[11px] whitespace-nowrap">
                  Company
                </th>
                <th className="px-3.5 py-3 font-semibold text-slate-600 uppercase tracking-wider text-[11px] whitespace-nowrap">
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
                <th className="px-3.5 py-3 font-semibold text-slate-600 uppercase tracking-wider text-[11px] whitespace-nowrap">
                  Due Status
                </th>
                <th className="px-3.5 py-3 font-semibold text-slate-600 uppercase tracking-wider text-[11px] whitespace-nowrap">
                  Work Status
                </th>
                <th className="px-3.5 py-3 font-semibold text-slate-600 uppercase tracking-wider text-[11px] whitespace-nowrap">
                  Progress
                </th>
                <th className="px-3.5 py-3 font-semibold text-slate-600 uppercase tracking-wider text-[11px] whitespace-nowrap">
                  Latest Remarks
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100 text-xs text-slate-600">
              {paginatedList.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-12 text-center text-slate-400">
                    <div className="flex flex-col items-center gap-2">
                      <Code2 className="w-8 h-8 text-slate-300" />
                      <span className="font-semibold text-slate-700">
                        {activeTab === 'pending' ? 'No active development requests' : 'No completed development requests'}
                      </span>
                      <span className="text-[11px]">
                        {activeTab === 'pending'
                          ? 'Approve an introduction or return a request from QA to begin development.'
                          : 'Completed development requests will appear here.'}
                      </span>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedList.map((req) => {
                  const isHold = req.workStatus === WORK_STATUS.ON_HOLD;
                  const effectiveTarget = req.holdExtendTargetDate || req.targetCompletionDate;
                  const dueInfo = calculateDueStatus(effectiveTarget);

                  return (
                    <tr
                      key={req.id}
                      className={`hover:bg-slate-50/80 transition-colors ${
                        isHold ? 'bg-rose-50/40' : dueInfo.isOverdue ? 'bg-rose-50/20' : ''
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
                                isHold
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

                      <td className="px-3.5 py-2.5 font-mono font-bold text-indigo-600 whitespace-nowrap">
                        {req.requestNo}
                      </td>

                      <td className="px-3.5 py-2.5 font-semibold text-slate-800 whitespace-nowrap">
                        {req.companyName}
                      </td>

                      <td className="px-3.5 py-2.5 max-w-xs truncate font-medium text-slate-800" title={req.systemName || req.systemRequirements}>
                        <div>{req.systemName || req.systemRequirements}</div>
                        {req.latestRejectionReason && (
                          <div className="text-[10px] text-rose-600 font-medium truncate mt-0.5" title={req.latestRejectionReason}>
                            <strong>Feedback:</strong> {req.latestRejectionReason}
                          </div>
                        )}
                      </td>

                      <ImageAttachmentCell
                        attachments={req.attachments}
                        onViewDetails={() => onViewDetails(req)}
                      />

                      <td className="px-3.5 py-2.5 whitespace-nowrap text-slate-700">
                        {req.assignedDeveloper}
                      </td>

                      <td className="px-3.5 py-2.5 whitespace-nowrap font-medium text-slate-800">
                        <div>{formatDisplayDate(req.targetCompletionDate)}</div>
                        {req.holdExtendTargetDate && (
                          <div className="text-[10px] text-amber-700 font-semibold bg-amber-50 border border-amber-200/80 rounded px-1.5 py-0.5 mt-0.5 inline-block" title={`Extended for Hold: ${req.holdReason || ''}`}>
                            Ext: {formatDisplayDate(req.holdExtendTargetDate)}
                          </div>
                        )}
                      </td>

                      <td className="px-3.5 py-2.5 whitespace-nowrap">
                        <StatusBadge
                          type="due"
                          targetDate={req.targetCompletionDate}
                          holdExtendTargetDate={req.holdExtendTargetDate}
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
                                isHold ? 'bg-rose-500' : 'bg-indigo-600'
                              }`}
                              style={{ width: `${req.progressPercent || 0}%` }}
                            />
                          </div>
                          <span className="font-mono font-bold text-[11px] text-slate-800 w-7 text-right">
                            {req.progressPercent || 0}%
                          </span>
                        </div>
                      </td>

                      <td className="px-3.5 py-2.5 max-w-xs truncate text-slate-600" title={req.holdReason || req.latestRemarks}>
                        {isHold && req.holdReason ? (
                          <span className="text-rose-700 font-medium">Hold: {req.holdReason}</span>
                        ) : (
                          req.latestRemarks || '—'
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

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
