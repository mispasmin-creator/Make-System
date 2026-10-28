import React, { useState, useMemo } from 'react';
import { Database, Check, Eye } from 'lucide-react';
import { StatusBadge } from '../components/StatusBadge';
import { Pagination } from '../components/Pagination';
import { ImageAttachmentCell } from '../components/ImageAttachmentCell';
import { formatDisplayDateTime } from '../utils/dateUtils';
import { MisActionModal } from '../components/MisActionModal';
import { isMisPending, isSystemClosed } from '../utils/systemWorkflow.mjs';

export function UpdateMisSystemPage({
  requests = [],
  onSubmitMisUpdate,
  onViewDetails,
  canEdit = true
}) {
  const [activeTab, setActiveTab] = useState('pending'); // 'pending' | 'completed'
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const pendingRequests = useMemo(() => {
    return requests.filter(isMisPending);
  }, [requests]);

  const completedRequests = useMemo(() => {
    return requests.filter(isSystemClosed);
  }, [requests]);

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
            <Database className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-800 leading-tight tracking-tight">Update MIS System</h1>
            <p className="text-xs text-slate-500">

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
            Pending MIS ({pendingRequests.length})
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
            Completed & Closed ({completedRequests.length})
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
                {activeTab === 'pending' ? (
                  <>
                    <th className="px-3.5 py-3 font-semibold text-slate-600 uppercase tracking-wider text-[11px] whitespace-nowrap">
                      Development Completed At
                    </th>
                    <th className="px-3.5 py-3 font-semibold text-slate-600 uppercase tracking-wider text-[11px] whitespace-nowrap">
                      MIS Status
                    </th>
                  </>
                ) : (
                  <>
                    <th className="px-3.5 py-3 font-semibold text-slate-600 uppercase tracking-wider text-[11px] whitespace-nowrap">
                      MIS Remarks
                    </th>
                    <th className="px-3.5 py-3 font-semibold text-slate-600 uppercase tracking-wider text-[11px] whitespace-nowrap">
                      Closed By & Timestamp
                    </th>
                    <th className="px-3.5 py-3 font-semibold text-slate-600 uppercase tracking-wider text-[11px] whitespace-nowrap">
                      Final Status
                    </th>
                  </>
                )}
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100 text-xs text-slate-600">
              {paginatedList.length === 0 ? (
                <tr>
                  <td colSpan={activeTab === 'pending' ? 9 : 10} className="py-12 text-center text-slate-400">
                    <div className="flex flex-col items-center gap-2">
                      <Database className="w-8 h-8 text-slate-300" />
                      <span className="font-semibold text-slate-700">
                        {activeTab === 'pending' ? 'No requests pending MIS update' : 'No closed requests found'}
                      </span>
                      <span className="text-[11px]">
                        {activeTab === 'pending'
                          ? 'Requests appear here when development is marked Completed in Create System.'
                          : 'Requests with submitted MIS details will be archived here.'}
                      </span>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedList.map((req) => (
                  <tr key={req.id} className="hover:bg-indigo-50/20 transition-colors">
                    {/* Sticky Action Column */}
                    <td className="sticky left-0 bg-white group-hover:bg-slate-50/90 z-10 border-r border-slate-100 px-3 py-2 text-center shadow-xs whitespace-nowrap">
                      <div className="inline-flex items-center gap-1.5">
                        {activeTab === 'pending' && canEdit && (
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedRequest(req);
                              setIsModalOpen(true);
                            }}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs shadow-indigo-300/40 hover:shadow-sm hover:-translate-y-0.5 transition-all cursor-pointer"
                          >
                            <Check className="w-3 h-3" />
                            <span>Update MIS</span>
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
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span>{req.requestNo}</span>
                        {req.currentRevisionNo && (
                          <StatusBadge type="revision" value={req.currentRevisionNo} />
                        )}
                      </div>
                    </td>

                    <td className="px-3.5 py-2.5 font-medium text-slate-700 whitespace-nowrap">
                      {req.requester || req.createdBy || '—'}
                    </td>

                    <td className="px-3.5 py-2.5 font-semibold text-slate-800 whitespace-nowrap">
                      {req.companyName}
                    </td>

                    <td className="px-3.5 py-2.5 max-w-xs truncate font-medium text-slate-800" title={req.systemName || req.systemRequirements}>
                      {req.systemName || req.systemRequirements}
                    </td>

                    <ImageAttachmentCell
                      attachments={req.attachments}
                      onViewDetails={() => onViewDetails(req)}
                    />

                    <td className="px-3.5 py-2.5 whitespace-nowrap text-slate-700">
                      {req.assignedDeveloper}
                    </td>

                    {activeTab === 'pending' ? (
                      <>
                        <td className="px-3.5 py-2.5 whitespace-nowrap text-slate-600">
                          {formatDisplayDateTime(req.developmentCompletedAt || req.lastUpdatedAt)}
                        </td>
                        <td className="px-3.5 py-2.5 whitespace-nowrap">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                            Awaiting MIS Entry
                          </span>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="px-3.5 py-2.5 max-w-xs truncate text-slate-700" title={req.misUpdate?.remarks}>
                          {req.misUpdate?.remarks || req.latestRemarks}
                        </td>
                        <td className="px-3.5 py-2.5 whitespace-nowrap text-slate-500">
                          <div>{req.misUpdate?.updatedBy || req.createdBy}</div>
                          <span className="text-[10px] text-slate-400">
                            {formatDisplayDateTime(req.closedAt || req.misUpdate?.updatedAt || req.lastUpdatedAt)}
                          </span>
                        </td>
                        <td className="px-3.5 py-2.5 whitespace-nowrap">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <Check className="w-3 h-3 text-emerald-600" />
                            <span>Closed</span>
                          </span>
                        </td>
                      </>
                    )}
                  </tr>
                ))
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
        <MisActionModal
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setSelectedRequest(null);
          }}
          request={selectedRequest}
          onSubmit={onSubmitMisUpdate}
        />
      )}
    </div>
  );
}
