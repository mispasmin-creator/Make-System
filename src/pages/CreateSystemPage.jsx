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
import { isDevelopmentComplete } from '../utils/systemWorkflow.mjs';

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
    return requests.filter(r => r.introduction?.isCompleted && r.currentStage === STAGES.CREATE && !isDevelopmentComplete(r));
  }, [requests]);

  const completedRequests = useMemo(() => {
    return requests.filter(isDevelopmentComplete);
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
    <div className="h-full flex flex-col bg-[#f6f8fb] space-y-3 sm:space-y-4 p-3 sm:p-5 overflow-hidden font-sans">
      {/* Sticky Page Header */}
      <div className="bg-white rounded-2xl border border-slate-200/70 p-3.5 sm:p-4 shadow-[0_4px_20px_-2px_rgba(15,23,42,0.04),0_2px_6px_-1px_rgba(15,23,42,0.02)] flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-indigo-500 text-white flex items-center justify-center shadow-sm shadow-indigo-300/40 shrink-0">
            <Code2 className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-800 leading-tight tracking-tight">Create System</h1>
            <p className="text-xs text-slate-500">
              • <strong>{pendingRequests.length}</strong> active
            </p>
          </div>
        </div>

        {/* Tab Switcher Pills */}
        <div className="flex items-center bg-slate-100/80 p-1.5 rounded-xl border border-slate-200/70 text-xs font-semibold">
          <button
            type="button"
            className={`px-3.5 py-1.5 rounded-lg transition-all cursor-pointer ${activeTab === 'pending'
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
            className={`px-3.5 py-1.5 rounded-lg transition-all cursor-pointer ${activeTab === 'completed'
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
          className={`p-3.5 rounded-2xl border flex items-center justify-between text-xs shrink-0 shadow-2xs ${urgentSummary.overdue > 0
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
        
        {/* MOBILE SLIM HORIZONTAL ROWS (md:hidden) */}
        <div className="md:hidden flex-1 overflow-y-auto divide-y divide-slate-100 bg-white">
          {activeList.length === 0 ? (
            <div className="p-8 text-center text-slate-400">
              <Code2 className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="font-semibold text-slate-700 text-sm">
                {activeTab === 'pending' ? 'No active development requests' : 'No completed development requests'}
              </p>
            </div>
          ) : (
            activeList.map((req) => {
              const isHold = req.workStatus === WORK_STATUS.ON_HOLD;
              const effectiveTarget = req.holdExtendTargetDate || req.targetCompletionDate;

              return (
                <div
                  key={req.id}
                  onClick={() => onViewDetails(req)}
                  className="px-3 py-2.5 hover:bg-slate-50/80 active:bg-slate-100/70 flex items-center justify-between gap-2.5 transition-colors cursor-pointer"
                >
                  {/* Left: Request No & Info */}
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <span className="font-mono font-bold text-xs text-indigo-700 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-lg shrink-0">
                      {req.requestNo}
                    </span>

                    <div className="min-w-0 flex-1">
                      {/* Line 1: System Name + Progress / Status Badge */}
                      <div className="flex items-center gap-1.5">
                        <h4 className="text-xs font-bold text-slate-800 truncate leading-snug">
                          {req.systemName || req.systemRequirements || 'System Request'}
                        </h4>
                        <span
                          className={`px-1.5 py-0.2 rounded text-[9px] font-bold shrink-0 ${
                            isHold
                              ? 'bg-rose-100 text-rose-800'
                              : activeTab === 'completed'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-indigo-100 text-indigo-800'
                          }`}
                        >
                          {isHold ? 'On Hold' : activeTab === 'completed' ? 'Done' : `${req.progressPercent || 0}%`}
                        </span>
                      </div>

                      {/* Line 2: Requester • Company • Dev • Target Date */}
                      <div className="text-[11px] text-slate-500 truncate mt-0.5 flex items-center gap-1.5">
                        <span className="font-medium text-slate-700 truncate">{req.requester || req.createdBy || '—'}</span>
                        <span>•</span>
                        <span className="truncate">{req.companyName}</span>
                        <span>•</span>
                        <span className="text-indigo-600 truncate font-medium">{req.assignedDeveloper || 'Dev'}</span>
                        {effectiveTarget && (
                          <>
                            <span>•</span>
                            <span className="text-slate-400 truncate">{formatDisplayDate(effectiveTarget)}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right: Action or Details Button */}
                  <div className="shrink-0 flex items-center">
                    {activeTab === 'pending' && canEdit ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedRequest(req);
                          setIsModalOpen(true);
                        }}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold text-white shadow-xs active:scale-95 transition-all whitespace-nowrap cursor-pointer ${
                          isHold
                            ? 'bg-rose-600 hover:bg-rose-700'
                            : 'bg-indigo-600 hover:bg-indigo-700'
                        }`}
                      >
                        Update
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onViewDetails(req);
                        }}
                        className="px-2.5 py-1.5 rounded-xl text-xs font-semibold text-slate-600 bg-slate-50 hover:bg-slate-100 border border-slate-200/80 active:scale-95 transition-all whitespace-nowrap cursor-pointer inline-flex items-center gap-1"
                      >
                        <Eye className="w-3 h-3 text-indigo-600" />
                        <span>Details</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* DESKTOP DATA TABLE (hidden on mobile) */}
        <div className="hidden md:block overflow-x-auto overflow-y-auto flex-1">
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
                  Requester
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
                  <td colSpan={12} className="py-12 text-center text-slate-400">
                    <div className="flex flex-col items-center gap-2">
                      <Code2 className="w-8 h-8 text-slate-300" />
                      <span className="font-semibold text-slate-700">
                        {activeTab === 'pending' ? 'No active development requests' : 'No completed development requests'}
                      </span>
                      <span className="text-[11px]">
                        {activeTab === 'pending'
                          ? 'Approve an introduction to begin development.'
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
                      className={`hover:bg-slate-50/80 transition-colors ${isHold ? 'bg-rose-50/40' : dueInfo.isOverdue ? 'bg-rose-50/20' : ''
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
                              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold rounded-xl text-white shadow-xs hover:shadow-sm hover:-translate-y-0.5 transition-all cursor-pointer ${isHold
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

                    <td className="px-3.5 py-2.5 font-medium text-slate-700 whitespace-nowrap">
                      {req.requester || req.createdBy || '—'}
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
                              className={`h-full rounded-full transition-all duration-300 ${isHold ? 'bg-rose-500' : 'bg-indigo-600'
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
