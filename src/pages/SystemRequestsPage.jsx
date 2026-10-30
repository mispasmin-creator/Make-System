import React, { useState, useMemo } from 'react';
import {
  ClipboardList,
  Plus,
  Search,
  Filter,
  Eye,
  RefreshCw,
  X,
  LayoutGrid,
  Table as TableIcon,
  Paperclip,
  Calendar,
  Building2,
  User,
  ChevronRight,
  Layers,
  Sparkles
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

  // Mobile-specific controls
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const [mobileViewMode, setMobileViewMode] = useState('cards'); // 'cards' | 'table'

  const activeFiltersCount = (companyFilter ? 1 : 0) +
    (devFilter ? 1 : 0) +
    (stageFilter ? 1 : 0) +
    (statusFilter ? 1 : 0);

  const handleClearFilters = () => {
    setSearchTerm('');
    setCompanyFilter('');
    setDevFilter('');
    setStageFilter('');
    setStatusFilter('');
    setCurrentPage(1);
  };

  const filteredRequests = useMemo(() => {
    return requests.filter((req) => {
      if (searchTerm) {
        const query = searchTerm.toLowerCase();
        const matchNo = req.requestNo?.toLowerCase().includes(query) || (req.requester || req.createdBy || '').toLowerCase().includes(query);
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
    <div className="h-full flex flex-col bg-[#f6f8fb] space-y-2.5 sm:space-y-4 p-2.5 sm:p-5 overflow-hidden font-sans">
      {/* Desktop Sticky Page Header Pattern (Hidden on mobile to prioritize mobile fintech hub) */}
      <div className="hidden sm:flex bg-white rounded-2xl border border-slate-200/70 p-3.5 sm:p-4 shadow-[0_4px_20px_-2px_rgba(15,23,42,0.04),0_2px_6px_-1px_rgba(15,23,42,0.02)] items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-indigo-500 text-white flex items-center justify-center shadow-sm shadow-indigo-300/40 shrink-0">
            <ClipboardList className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-800 leading-tight tracking-tight">System Requests</h1>
            <p className="text-xs text-slate-500">
              • <strong>{filteredRequests.length}</strong> record{filteredRequests.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
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

      {/* Mobile Section Title (Fintech "Recent Payments" Style Header) */}
      <div className="sm:hidden flex items-center justify-between px-1 shrink-0">
        <div>
          <h2 className="text-sm font-bold text-slate-800 tracking-tight">Recent Requests</h2>
          <p className="text-[11px] text-slate-400 font-medium">{filteredRequests.length} total records</p>
        </div>

        {/* View Switcher: Cards vs Table */}
        <div className="flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200/80">
          <button
            type="button"
            onClick={() => setMobileViewMode('cards')}
            className={`p-1.5 rounded-lg transition-all cursor-pointer ${
              mobileViewMode === 'cards'
                ? 'bg-white text-indigo-700 shadow-2xs font-bold'
                : 'text-slate-500 hover:text-slate-800'
            }`}
            title="Cards Feed"
          >
            <LayoutGrid className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setMobileViewMode('table')}
            className={`p-1.5 rounded-lg transition-all cursor-pointer ${
              mobileViewMode === 'table'
                ? 'bg-white text-indigo-700 shadow-2xs font-bold'
                : 'text-slate-500 hover:text-slate-800'
            }`}
            title="Data Table"
          >
            <TableIcon className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="bg-white rounded-2xl border border-slate-200/70 p-2 sm:p-3 shadow-[0_4px_20px_-2px_rgba(15,23,42,0.04),0_2px_6px_-1px_rgba(15,23,42,0.02)] shrink-0 space-y-2">
        {/* Top Controls Row */}
        <div className="flex items-center gap-2">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search request #, requester, system..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full pl-8 pr-3 py-2 bg-slate-50/70 hover:bg-slate-50 focus:bg-white border border-slate-200/80 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 transition-all shadow-2xs"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Mobile Filter Toggle Button */}
          <button
            type="button"
            onClick={() => setShowMobileFilters(prev => !prev)}
            className={`sm:hidden inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition-all cursor-pointer shrink-0 ${
              showMobileFilters || activeFiltersCount > 0
                ? 'bg-indigo-50 text-indigo-700 border-indigo-200/80 shadow-2xs'
                : 'bg-white text-slate-700 border-slate-200/80 hover:bg-slate-50'
            }`}
          >
            <Filter className="w-3.5 h-3.5 text-indigo-600" />
            <span>Filter</span>
            {activeFiltersCount > 0 && (
              <span className="w-4 h-4 rounded-full bg-indigo-600 text-white text-[10px] flex items-center justify-center font-bold">
                {activeFiltersCount}
              </span>
            )}
          </button>

          {/* Desktop Filter Row */}
          <div className="hidden sm:flex items-center gap-2 flex-wrap flex-1">
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
              <option value="hold">On Hold</option>
              <option value="progress">In Progress</option>
              <option value="closed">Closed</option>
            </select>

            {(searchTerm || companyFilter || devFilter || stageFilter || statusFilter) && (
              <button
                type="button"
                className="bg-white border border-slate-200/80 text-slate-600 hover:bg-slate-50 hover:text-slate-800 rounded-xl text-xs font-semibold px-3 py-2 inline-flex items-center gap-1.5 cursor-pointer transition-all shadow-2xs shrink-0"
                onClick={handleClearFilters}
              >
                <X className="w-3.5 h-3.5 text-slate-400" />
                <span>Clear</span>
              </button>
            )}
          </div>
        </div>

        {/* Collapsible Mobile Filters Drawer (2x2 Grid) */}
        {showMobileFilters && (
          <div className="sm:hidden pt-2 border-t border-slate-100/90 space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <select
                className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-100"
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

              <select
                className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-100"
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

              <select
                className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-100"
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

              <select
                className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setCurrentPage(1);
                }}
              >
                <option value="">All Statuses</option>
                <option value="hold">On Hold</option>
                <option value="progress">In Progress</option>
                <option value="closed">Closed</option>
              </select>
            </div>

            {/* Clear Filters Button on Mobile */}
            {(searchTerm || companyFilter || devFilter || stageFilter || statusFilter) && (
              <div className="flex justify-end pt-1">
                <button
                  type="button"
                  onClick={handleClearFilters}
                  className="text-xs text-rose-600 font-semibold inline-flex items-center gap-1 hover:text-rose-700 py-1 px-2 rounded-lg hover:bg-rose-50"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>Clear all filters</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Main Content Area: Responsive Card View on Mobile (Default) & Table View on Desktop */}
      <div className="bg-white rounded-2xl border border-slate-200/70 shadow-[0_6px_24px_-4px_rgba(15,23,42,0.05),0_2px_8px_-1px_rgba(15,23,42,0.02)] overflow-hidden flex flex-col flex-1 min-h-0">
        
        {/* MOBILE SLIM HORIZONTAL ROWS (md:hidden when mobileViewMode === 'cards') */}
        {mobileViewMode === 'cards' && (
          <div className="md:hidden flex-1 overflow-y-auto divide-y divide-slate-100 bg-white">
            {filteredRequests.length === 0 ? (
              <div className="py-12 text-center text-slate-400 p-6">
                <ClipboardList className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="font-semibold text-slate-700 text-sm">No system requests found</p>
                <p className="text-xs text-slate-400 mt-1">Adjust filters or create a new request.</p>
              </div>
            ) : (
              filteredRequests.map((req) => {
                const isHold = req.workStatus === 'On Hold';
                const isClosed = req.currentStage === STAGES.CLOSED || req.workStatus === 'Completed';

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
                        {/* Line 1: Title + Status Tag */}
                        <div className="flex items-center gap-1.5">
                          <h4 className="text-xs font-bold text-slate-800 truncate leading-snug">
                            {req.systemName || req.systemRequirements || 'System Request'}
                          </h4>
                          <span
                            className={`px-1.5 py-0.2 rounded text-[9px] font-bold shrink-0 ${
                              isHold
                                ? 'bg-rose-100 text-rose-700'
                                : isClosed
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-indigo-100 text-indigo-700'
                            }`}
                          >
                            {req.workStatus || req.currentStatus || 'Active'}
                          </span>
                        </div>

                        {/* Line 2: Requester • Company • Date/Dev */}
                        <div className="text-[11px] text-slate-500 truncate mt-0.5 flex items-center gap-1.5">
                          <span className="font-medium text-slate-700 truncate">{req.requester || req.createdBy || '—'}</span>
                          <span>•</span>
                          <span className="truncate">{req.companyName}</span>
                          {req.targetCompletionDate && (
                            <>
                              <span>•</span>
                              <span className="text-slate-400 truncate">{formatDisplayDate(req.targetCompletionDate)}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Right: Details Action Button */}
                    <div className="shrink-0 flex items-center">
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
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* FULL DATA TABLE (Desktop always visible, Mobile visible when mobileViewMode === 'table') */}
        <div className={`overflow-x-auto overflow-y-auto flex-1 ${mobileViewMode === 'cards' ? 'hidden md:block' : 'block'}`}>
          <table className="w-full border-collapse text-left text-xs min-w-[760px] md:min-w-full">
            {/* Header */}
            <thead className="sticky top-0 bg-slate-50/90 z-20 shadow-xs border-b border-slate-200/70">
              <tr>
                <th className="sticky left-0 bg-slate-50/95 z-30 border-r border-slate-200/70 px-3.5 py-3 font-semibold text-slate-600 uppercase tracking-wider text-[11px] whitespace-nowrap">
                  Action
                </th>
                <th className="px-3.5 py-2.5 font-semibold text-slate-700 uppercase tracking-wider text-[11px] whitespace-nowrap">
                  Request No.
                </th>
                <th className="px-3.5 py-2.5 font-semibold text-slate-700 uppercase tracking-wider text-[11px] whitespace-nowrap">
                  Requester
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
                  <td colSpan={9} className="py-12 text-center text-slate-400">
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
