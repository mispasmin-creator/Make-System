import React, { useState, useMemo } from 'react';
import {
  ClipboardList,
  Plus,
  Search,
  Filter,
  Eye,
  RefreshCw,
  X
} from 'lucide-react';
import { StatusBadge } from '../components/StatusBadge';
import { Pagination } from '../components/Pagination';
import { ImageAttachmentCell } from '../components/ImageAttachmentCell';
import { formatDisplayDate } from '../utils/dateUtils';
import { STAGES } from '../constants/stages';

export function SystemRequestsPage({
  requests = [],
  companyOptions = [],
  developerOptions = [],
  onOpenNewRequest,
  onViewDetails,
  canCreate = true
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [companyFilter, setCompanyFilter] = useState('');
  const [devFilter, setDevFilter] = useState('');
  const [stageFilter, setStageFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const filteredRequests = useMemo(() => {
    return requests.filter((req) => {
      if (searchTerm) {
        const query = searchTerm.toLowerCase();
        const matchNo = req.requestNo?.toLowerCase().includes(query);
        const matchRev = req.currentRevisionNo?.toLowerCase().includes(query);
        const matchComp = req.companyName?.toLowerCase().includes(query);
        const matchDev = req.assignedDeveloper?.toLowerCase().includes(query);
        const matchReqs = req.systemRequirements?.toLowerCase().includes(query);
        if (!matchNo && !matchRev && !matchComp && !matchDev && !matchReqs) return false;
      }
      if (companyFilter && req.companyName !== companyFilter) return false;
      if (devFilter && req.assignedDeveloper !== devFilter) return false;
      if (stageFilter && req.currentStage !== stageFilter) return false;
      if (statusFilter) {
        if (statusFilter === 'hold' && req.workStatus !== 'On Hold') return false;
        if (statusFilter === 'progress' && req.workStatus !== 'In Progress') return false;
        if (statusFilter === 'closed' && req.currentStage !== STAGES.CLOSED) return false;
      }
      return true;
    });
  }, [requests, searchTerm, companyFilter, devFilter, stageFilter, statusFilter]);

  const paginatedRequests = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredRequests.slice(start, start + pageSize);
  }, [filteredRequests, currentPage, pageSize]);

  return (
    <div className="h-full flex flex-col bg-[#f6f8fb] space-y-4 p-5 overflow-hidden font-sans">
      {/* Sticky Page Header Pattern */}
      <div className="bg-white rounded-2xl border border-slate-200/70 p-4 shadow-[0_4px_20px_-2px_rgba(15,23,42,0.04),0_2px_6px_-1px_rgba(15,23,42,0.02)] flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-indigo-500 text-white flex items-center justify-center shadow-sm shadow-indigo-300/40 shrink-0">
            <ClipboardList className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-800 leading-tight tracking-tight">System Requests</h1>
            <p className="text-xs text-slate-500">
              Master registry of all software requests • <strong>{filteredRequests.length}</strong> record{filteredRequests.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Primary CTA */}
          {canCreate && (
            <button
              type="button"
              onClick={onOpenNewRequest}
              className="bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white font-semibold text-xs rounded-xl shadow-xs shadow-indigo-300/40 hover:shadow-md hover:shadow-indigo-300/50 px-4 py-2.5 inline-flex items-center gap-2 cursor-pointer transition-all hover:-translate-y-0.5 active:translate-y-0"
            >
              <Plus className="w-4 h-4" />
              <span>New System Request</span>
            </button>
          )}
        </div>
      </div>

      {/* Filter / Search Bar */}
      <div className="bg-white rounded-2xl border border-slate-200/70 p-3 shadow-[0_4px_20px_-2px_rgba(15,23,42,0.04),0_2px_6px_-1px_rgba(15,23,42,0.02)] flex flex-wrap items-center justify-between gap-2.5 shrink-0">
        <div className="flex flex-wrap items-center gap-2.5 flex-1">
          {/* Search */}
          <div className="relative min-w-56 flex-1 max-w-xs">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search request #, company, dev..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full pl-8 pr-3 py-2 bg-slate-50/70 hover:bg-slate-50 focus:bg-white border border-slate-200/80 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 transition-all shadow-2xs"
            />
          </div>

          {/* Company filter */}
          <select
            className="px-3 py-2 bg-slate-50/70 hover:bg-slate-50 focus:bg-white border border-slate-200/80 rounded-xl text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 cursor-pointer transition-all shadow-2xs"
            value={companyFilter}
            onChange={(e) => {
              setCompanyFilter(e.target.value);
              setCurrentPage(1);
            }}
          >
            <option value="">All Companies</option>
            {companyOptions.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>

          {/* Developer filter */}
          <select
            className="px-3 py-2 bg-slate-50/70 hover:bg-slate-50 focus:bg-white border border-slate-200/80 rounded-xl text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 cursor-pointer transition-all shadow-2xs"
            value={devFilter}
            onChange={(e) => {
              setDevFilter(e.target.value);
              setCurrentPage(1);
            }}
          >
            <option value="">All Developers</option>
            {developerOptions.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>

          {/* Stage filter */}
          <select
            className="px-3 py-2 bg-slate-50/70 hover:bg-slate-50 focus:bg-white border border-slate-200/80 rounded-xl text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 cursor-pointer transition-all shadow-2xs"
            value={stageFilter}
            onChange={(e) => {
              setStageFilter(e.target.value);
              setCurrentPage(1);
            }}
          >
            <option value="">All Stages</option>
            {[STAGES.INTRODUCE, STAGES.CREATE, STAGES.UPDATE_MIS, STAGES.CLOSED].map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>

          {/* Status filter */}
          <select
            className="px-3 py-2 bg-slate-50/70 hover:bg-slate-50 focus:bg-white border border-slate-200/80 rounded-xl text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 cursor-pointer transition-all shadow-2xs"
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setCurrentPage(1);
            }}
          >
            <option value="">All Statuses</option>
            <option value="hold">On Hold (Rose)</option>
            <option value="progress">In Progress</option>
            <option value="closed">Closed</option>
          </select>
        </div>

        {(searchTerm || companyFilter || devFilter || stageFilter || statusFilter) && (
          <button
            type="button"
            className="bg-white border border-slate-200/80 text-slate-600 hover:bg-slate-50 hover:text-slate-800 rounded-xl text-xs font-semibold px-3 py-2 inline-flex items-center gap-1.5 cursor-pointer transition-all shadow-2xs shrink-0"
            onClick={() => {
              setSearchTerm('');
              setCompanyFilter('');
              setDevFilter('');
              setStageFilter('');
              setStatusFilter('');
              setCurrentPage(1);
            }}
          >
            <X className="w-3.5 h-3.5 text-slate-400" />
            <span>Clear</span>
          </button>
        )}
      </div>

      {/* Main Table: Sticky Header, Sticky-Left Action Column, Scrollable Body */}
      <div className="bg-white rounded-2xl border border-slate-200/70 shadow-[0_6px_24px_-4px_rgba(15,23,42,0.05),0_2px_8px_-1px_rgba(15,23,42,0.02)] overflow-hidden flex flex-col flex-1 min-h-0">
        <div className="overflow-x-auto overflow-y-auto flex-1">
          <table className="w-full border-collapse text-left text-xs">
            {/* Header */}
            <thead className="sticky top-0 bg-slate-50/90 z-20 shadow-xs border-b border-slate-200/70">
              <tr>
                {/* First Action column is sticky-left */}
                <th className="sticky left-0 bg-slate-50/95 z-30 border-r border-slate-200/70 px-3.5 py-3 font-semibold text-slate-600 uppercase tracking-wider text-[11px] whitespace-nowrap">
                  Action
                </th>
                <th className="px-3.5 py-2.5 font-semibold text-slate-700 uppercase tracking-wider text-[11px] whitespace-nowrap">
                  Request No.
                </th>
                <th className="px-3.5 py-2.5 font-semibold text-slate-700 uppercase tracking-wider text-[11px] whitespace-nowrap">
                  Company
                </th>
                <th className="px-3.5 py-2.5 font-semibold text-slate-700 uppercase tracking-wider text-[11px] whitespace-nowrap">
                  System Name
                </th>
                <th className="px-3.5 py-2.5 font-semibold text-slate-700 uppercase tracking-wider text-[11px] whitespace-nowrap text-center">
                  Image
                </th>
                <th className="px-3.5 py-2.5 font-semibold text-slate-700 uppercase tracking-wider text-[11px] whitespace-nowrap">
                  Assigned Developer
                </th>
                <th className="px-3.5 py-2.5 font-semibold text-slate-700 uppercase tracking-wider text-[11px] whitespace-nowrap">
                  Target Date
                </th>
                <th className="px-3.5 py-2.5 font-semibold text-slate-700 uppercase tracking-wider text-[11px] whitespace-nowrap">
                  Current Status
                </th>
              </tr>
            </thead>

            {/* Rows */}
            <tbody className="divide-y divide-slate-100 text-xs text-slate-600">
              {paginatedRequests.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <div className="flex flex-col items-center gap-2">
                      <ClipboardList className="w-8 h-8 text-slate-300" />
                      <span className="font-semibold text-slate-700">No system requests found</span>
                      <span className="text-[11px]">Adjust filters or create a new system request to begin.</span>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedRequests.map((req) => {
                  const isHold = req.workStatus === 'On Hold';

                  return (
                    <tr
                      key={req.id}
                      className={`hover:bg-slate-50/80 transition-colors ${
                        isHold ? 'bg-rose-50/40' : ''
                      }`}
                    >
                      {/* Sticky-Left Action Column */}
                      <td className="sticky left-0 bg-white group-hover:bg-slate-50/80 z-10 border-r border-slate-200 px-3 py-2 text-center shadow-xs">
                        <button
                          type="button"
                          onClick={() => onViewDetails(req)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold rounded-xl bg-indigo-50/80 text-indigo-700 hover:bg-indigo-100/80 border border-indigo-200/70 shadow-2xs hover:shadow-xs hover:-translate-y-0.5 transition-all cursor-pointer whitespace-nowrap"
                        >
                          <Eye className="w-3 h-3 text-indigo-600" />
                          <span>View Details</span>
                        </button>
                      </td>

                      <td className="px-3.5 py-2.5 font-mono font-bold text-indigo-600 whitespace-nowrap">
                        {req.requestNo}
                      </td>

                      <td className="px-3.5 py-2.5 font-semibold text-slate-800 whitespace-nowrap">
                        {req.companyName}
                      </td>

                      <td className="px-3.5 py-2.5 max-w-xs truncate font-medium text-slate-800" title={req.systemName || req.systemRequirements}>
                        {req.systemName || req.systemRequirements}
                      </td>

                      {/* Image / Attachment Column */}
                      <ImageAttachmentCell
                        attachments={req.attachments}
                        onViewDetails={() => onViewDetails(req)}
                      />

                      <td className="px-3.5 py-2.5 whitespace-nowrap text-slate-700">
                        {req.assignedDeveloper}
                      </td>

                      <td className="px-3.5 py-2.5 whitespace-nowrap">
                        <div className="flex flex-col gap-0.5">
                          <span className="font-medium text-slate-700">{formatDisplayDate(req.targetCompletionDate)}</span>
                          <StatusBadge type="due" targetDate={req.targetCompletionDate} />
                        </div>
                      </td>

                      <td className="px-3.5 py-2.5 whitespace-nowrap">
                        <StatusBadge label={req.currentStatus} value={req.workStatus} />
                      </td>

                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Bottom Pagination */}
        <Pagination
          currentPage={currentPage}
          pageSize={pageSize}
          totalItems={filteredRequests.length}
          onPageChange={setCurrentPage}
          onPageSizeChange={(newSize) => {
            setPageSize(newSize);
            setCurrentPage(1);
          }}
        />
      </div>
    </div>
  );
}
