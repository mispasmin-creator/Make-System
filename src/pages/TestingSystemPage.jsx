import React, { useState, useMemo } from 'react';
import {
  CheckCircle2,
  XCircle,
  PlayCircle,
  Eye,
  Check,
  X,
  ExternalLink
} from 'lucide-react';
import { StatusBadge } from '../components/StatusBadge';
import { Pagination } from '../components/Pagination';
import { ImageAttachmentCell } from '../components/ImageAttachmentCell';
import { formatDisplayDateTime } from '../utils/dateUtils';
import { STAGES, TESTING_DECISION } from '../constants/stages';
import { TestingActionModal } from '../components/TestingActionModal';

export function TestingSystemPage({
  requests = [],
  onSubmitDecision,
  onViewDetails,
  canApprove = true
}) {
  const [activeTab, setActiveTab] = useState('pending'); // 'pending' | 'completed'
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const pendingRequests = useMemo(() => {
    return requests.filter(r => r.currentStage === STAGES.TESTING);
  }, [requests]);

  const completedTestAttempts = useMemo(() => {
    const list = [];
    requests.forEach(req => {
      if (req.testingHistory && req.testingHistory.length > 0) {
        req.testingHistory.forEach(test => {
          list.push({
            id: `${req.id}-${test.attemptNumber}`,
            request: req,
            attempt: test
          });
        });
      }
    });
    return list.sort((a, b) => new Date(b.attempt.testedAt) - new Date(a.attempt.testedAt));
  }, [requests]);

  const paginatedPending = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return pendingRequests.slice(start, start + pageSize);
  }, [pendingRequests, currentPage, pageSize]);

  const paginatedCompleted = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return completedTestAttempts.slice(start, start + pageSize);
  }, [completedTestAttempts, currentPage, pageSize]);

  return (
    <div className="h-full flex flex-col bg-[#f6f8fb] space-y-4 p-5 overflow-hidden font-sans">
      {/* Sticky Page Header */}
      <div className="bg-white rounded-2xl border border-slate-200/70 p-4 shadow-[0_4px_20px_-2px_rgba(15,23,42,0.04),0_2px_6px_-1px_rgba(15,23,42,0.02)] flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-indigo-500 text-white flex items-center justify-center shadow-sm shadow-indigo-300/40 shrink-0">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-800 leading-tight tracking-tight">Testing System</h1>
            <p className="text-xs text-slate-500">
              Quality assurance validation, user acceptance decisions, and revision dispatch • <strong>{pendingRequests.length}</strong> awaiting testing
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
            Pending QA ({pendingRequests.length})
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
            Test Attempts ({completedTestAttempts.length})
          </button>
        </div>
      </div>

      {/* Main Table Card */}
      <div className="bg-white rounded-2xl border border-slate-200/70 shadow-[0_6px_24px_-4px_rgba(15,23,42,0.05),0_2px_8px_-1px_rgba(15,23,42,0.02)] overflow-hidden flex flex-col flex-1 min-h-0">
        <div className="overflow-x-auto overflow-y-auto flex-1">
          <table className="w-full border-collapse text-left text-xs">
            <thead className="sticky top-0 bg-slate-50/90 z-20 shadow-xs border-b border-slate-200/70">
              <tr>
                {/* Sticky Left Action Column */}
                <th className="sticky left-0 bg-slate-50/95 z-30 border-r border-slate-200/70 px-3.5 py-3 font-semibold text-slate-600 uppercase tracking-wider text-[11px] whitespace-nowrap">
                  Action
                </th>
                <th className="px-3.5 py-2.5 font-semibold text-slate-700 uppercase tracking-wider text-[11px] whitespace-nowrap">
                  Request No.
                </th>
                <th className="px-3.5 py-2.5 font-semibold text-slate-700 uppercase tracking-wider text-[11px] whitespace-nowrap">
                  {activeTab === 'pending' ? 'Revision' : 'Attempt / Revision'}
                </th>
                <th className="px-3.5 py-2.5 font-semibold text-slate-700 uppercase tracking-wider text-[11px] whitespace-nowrap">
                  Company
                </th>
                <th className="px-3.5 py-2.5 font-semibold text-slate-700 uppercase tracking-wider text-[11px] whitespace-nowrap text-center">
                  Image
                </th>
                <th className="px-3.5 py-2.5 font-semibold text-slate-700 uppercase tracking-wider text-[11px] whitespace-nowrap">
                  Assigned Developer
                </th>
                {activeTab === 'pending' ? (
                  <>
                    <th className="px-3.5 py-2.5 font-semibold text-slate-700 uppercase tracking-wider text-[11px] whitespace-nowrap">
                      Dev Completed At
                    </th>
                    <th className="px-3.5 py-2.5 font-semibold text-slate-700 uppercase tracking-wider text-[11px] whitespace-nowrap">
                      Testing Status
                    </th>
                  </>
                ) : (
                  <>
                    <th className="px-3.5 py-2.5 font-semibold text-slate-700 uppercase tracking-wider text-[11px] whitespace-nowrap">
                      Decision
                    </th>
                    <th className="px-3.5 py-2.5 font-semibold text-slate-700 uppercase tracking-wider text-[11px] whitespace-nowrap">
                      Remarks / Defect Rationale
                    </th>
                    <th className="px-3.5 py-2.5 font-semibold text-slate-700 uppercase tracking-wider text-[11px] whitespace-nowrap">
                      Tested By & Timestamp
                    </th>
                  </>
                )}
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100 text-xs text-slate-600">
              {activeTab === 'pending' ? (
                paginatedPending.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-400">
                      <div className="flex flex-col items-center gap-2">
                        <CheckCircle2 className="w-8 h-8 text-slate-300" />
                        <span className="font-semibold text-slate-700">No requests pending QA testing</span>
                        <span className="text-[11px]">When developers mark development completed, requests appear here.</span>
                      </div>
                    </td>
                  </tr>
                ) : (
                  paginatedPending.map((req) => (
                    <tr key={req.id} className="hover:bg-slate-50/80 transition-colors">
                      {/* Sticky Left Action */}
                      <td className="sticky left-0 bg-white group-hover:bg-slate-50/90 z-10 border-r border-slate-100 px-3 py-2 text-center shadow-xs whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          {canApprove && (
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedRequest(req);
                                setIsModalOpen(true);
                              }}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs shadow-indigo-300/40 hover:shadow-sm hover:-translate-y-0.5 transition-all cursor-pointer"
                            >
                              <Check className="w-3 h-3" />
                              <span>Execute Decision</span>
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

                      <td className="px-3.5 py-2.5 whitespace-nowrap">
                        {req.currentRevisionNo ? (
                          <StatusBadge type="revision" value={req.currentRevisionNo} />
                        ) : (
                          <span className="text-slate-300 font-mono text-[11px]">Base Build</span>
                        )}
                      </td>

                      <td className="px-3.5 py-2.5 font-semibold text-slate-800 whitespace-nowrap">
                        {req.companyName}
                      </td>

                      <ImageAttachmentCell
                        attachments={req.attachments}
                        onViewDetails={() => onViewDetails(req)}
                      />

                      <td className="px-3.5 py-2.5 whitespace-nowrap text-slate-700">
                        {req.assignedDeveloper}
                      </td>

                      <td className="px-3.5 py-2.5 whitespace-nowrap text-slate-600">
                        {formatDisplayDateTime(req.developmentCompletedAt || req.lastUpdatedAt)}
                      </td>

                      <td className="px-3.5 py-2.5 whitespace-nowrap">
                        <div className="flex flex-col gap-1 items-start">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                            Ready for QA
                          </span>
                          {req.systemUrl && (
                            <a
                              href={req.systemUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 hover:underline"
                              title={req.adminId ? `Admin ID: ${req.adminId}` : 'Open deployed system'}
                            >
                              <ExternalLink className="w-3 h-3 text-indigo-500" />
                              <span>Open App</span>
                            </a>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )
              ) : (
                paginatedCompleted.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-slate-400">
                      <div className="flex flex-col items-center gap-2">
                        <CheckCircle2 className="w-8 h-8 text-slate-300" />
                        <span className="font-semibold text-slate-700">No testing attempts logged yet</span>
                        <span className="text-[11px]">Approved and rejected QA decisions will be archived here.</span>
                      </div>
                    </td>
                  </tr>
                ) : (
                  paginatedCompleted.map(({ id, request: req, attempt: test }) => {
                    const isApprove = test.decision === TESTING_DECISION.APPROVED;
                    return (
                      <tr
                        key={id}
                        className={`hover:bg-slate-50/80 transition-colors ${
                          !isApprove ? 'bg-rose-50/30' : ''
                        }`}
                      >
                        <td className="sticky left-0 bg-white group-hover:bg-slate-50/80 z-10 border-r border-slate-200 px-3 py-2 text-center shadow-xs whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => onViewDetails(req)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold rounded-lg bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 transition-all cursor-pointer"
                          >
                            <Eye className="w-3 h-3 text-slate-400" />
                            <span>Details</span>
                          </button>
                        </td>

                        <td className="px-3.5 py-2.5 font-mono font-bold text-indigo-600 whitespace-nowrap">
                          {req.requestNo}
                        </td>

                        <td className="px-3.5 py-2.5 whitespace-nowrap">
                          <div className="flex flex-col gap-0.5">
                            <span className="font-semibold text-slate-700 text-xs">Attempt #{test.attemptNumber}</span>
                            {test.revisionNo && <StatusBadge type="revision" value={test.revisionNo} />}
                            {test.generatedRevisionNo && (
                              <span className="text-[10px] text-rose-600 font-mono font-semibold">
                                Generated: {test.generatedRevisionNo}
                              </span>
                            )}
                          </div>
                        </td>

                        <td className="px-3.5 py-2.5 font-semibold text-slate-800 whitespace-nowrap">
                          {req.companyName}
                        </td>

                        <ImageAttachmentCell
                          attachments={req.attachments}
                          onViewDetails={() => onViewDetails(req)}
                        />

                        <td className="px-3.5 py-2.5 whitespace-nowrap text-slate-700">
                          {req.assignedDeveloper}
                        </td>

                        <td className="px-3.5 py-2.5 whitespace-nowrap">
                          {isApprove ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <Check className="w-3 h-3 text-emerald-600" />
                              <span>Approved</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                              <X className="w-3 h-3 text-rose-600" />
                              <span>Rejected</span>
                            </span>
                          )}
                        </td>

                        <td className="px-3.5 py-2.5 max-w-xs truncate" title={test.remarks}>
                          <span className={!isApprove ? 'text-rose-700 font-medium' : 'text-slate-600'}>
                            {test.remarks}
                          </span>
                        </td>

                        <td className="px-3.5 py-2.5 whitespace-nowrap text-slate-500">
                          <div>{test.testedBy}</div>
                          <span className="text-[10px] text-slate-400">{formatDisplayDateTime(test.testedAt)}</span>
                        </td>
                      </tr>
                    );
                  })
                )
              )}
            </tbody>
          </table>
        </div>

        <Pagination
          currentPage={currentPage}
          pageSize={pageSize}
          totalItems={activeTab === 'pending' ? pendingRequests.length : completedTestAttempts.length}
          onPageChange={setCurrentPage}
          onPageSizeChange={(newSize) => {
            setPageSize(newSize);
            setCurrentPage(1);
          }}
        />
      </div>

      {selectedRequest && (
        <TestingActionModal
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setSelectedRequest(null);
          }}
          request={selectedRequest}
          onSubmit={onSubmitDecision}
        />
      )}
    </div>
  );
}
