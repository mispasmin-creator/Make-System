import React, { useState, useEffect, useMemo } from 'react';
import {
  BarChart3,
  Layers,
  LifeBuoy,
  Wrench,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Calendar,
  Building,
  User,
  Search,
  Download,
  Upload,
  Printer,
  RotateCcw,
  ExternalLink,
  ChevronRight,
  TrendingUp,
  FileSpreadsheet,
  FileText,
  X,
  Filter,
  Eye,
  Check
} from 'lucide-react';

import { dataService } from '../services/dataService';
import { technicalHelpService, getCachedTechnicalTickets, subscribeTechnicalTickets, listTechnicalTickets } from '../services/technicalHelpService';
import { repairService, getCachedRepairIssues, subscribeRepairIssues, enableRepairDemo, getRepairMode } from '../services/repairService';
import { overallStatus, stageState } from '../utils/repairWorkflow.mjs';
import { formatDisplayDate, formatDisplayDateTime } from '../utils/dateUtils';
import { exportDmeReportToExcel, exportDmeReportToCsv, printDmeReport, parseImportFile } from '../utils/reportExportUtils';
import { Modal } from '../components/Modal';
import { RequestDetailsModal } from '../components/RequestDetailsModal';
import { TechnicalTicketDetailsModal } from '../components/TechnicalTicketDetailsModal';
import { RepairIssueDetailsModal } from '../components/RepairIssueDetailsModal';

export function DashboardPage({
  requests = [],
  masterOptions = { companies: [], developers: [] },
  currentUser,
  onNavigateTo
}) {
  // Tab Navigation: 'make' (Make System), 'technical' (Technical Help), 'repair' (Repair System)
  const [activeTab, setActiveTab] = useState('make');

  // Live state from Technical Help & Repair System
  const [technicalTickets, setTechnicalTickets] = useState(getCachedTechnicalTickets);
  const [repairIssues, setRepairIssues] = useState(getCachedRepairIssues);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCompany, setSelectedCompany] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All'); // 'All', 'On-Time', 'Delayed', 'In Process', 'Pending'

  // Modals
  const [showImportModal, setShowImportModal] = useState(false);
  const [importedData, setImportedData] = useState(null);
  const [importError, setImportError] = useState('');
  const [activeRequestDetails, setActiveRequestDetails] = useState(null);
  const [activeTicketDetails, setActiveTicketDetails] = useState(null);
  const [activeRepairDetails, setActiveRepairDetails] = useState(null);
  const [exportNotice, setExportNotice] = useState('');

  // Subscribe to live Technical Tickets and Repair Issues
  useEffect(() => {
    let active = true;
    const unsubTech = subscribeTechnicalTickets(data => {
      if (active) setTechnicalTickets(data);
    });
    listTechnicalTickets()
      .then(data => {
        if (active && Array.isArray(data)) setTechnicalTickets(data);
      })
      .catch(() => { });

    const unsubRepair = subscribeRepairIssues(data => {
      if (active) setRepairIssues(data);
    });
    if (getRepairMode() === 'unconfigured') {
      enableRepairDemo();
    }

    return () => {
      active = false;
      unsubTech();
      unsubRepair();
    };
  }, []);

  // --- MAKE SYSTEM METRICS ---
  const makeMetrics = useMemo(() => {
    const list = requests || [];
    let completed = 0;
    let onTime = 0;
    let delayed = 0;
    let inProcess = 0;
    let pending = 0;

    const normalizedRecords = list.map(req => {
      const isClosed = req.currentStage === 'closed' || req.workStatus === 'Completed' || req.progressPercent === 100;
      const targetDate = req.upgradeTargetDate || req.holdExtendTargetDate || req.targetCompletionDate;
      const actualDate = req.closedAt || req.actualMisDate || req.completedAt || (isClosed ? req.lastUpdatedAt : null);

      let onTimeStatus = 'In Process';
      let delayDays = 0;

      if (isClosed) {
        completed++;
        if (targetDate && actualDate) {
          const t = new Date(targetDate).getTime();
          const a = new Date(actualDate).getTime();
          if (a <= t + 86400000) {
            onTime++;
            onTimeStatus = 'On-Time';
          } else {
            delayed++;
            onTimeStatus = 'Delayed';
            delayDays = Math.max(1, Math.round((a - t) / 86400000));
          }
        } else {
          onTime++;
          onTimeStatus = 'On-Time';
        }
      } else {
        const isPendingStage = req.currentStage === 'requests' || req.currentStage === 'introduce' || req.workStatus === 'Planned' || !req.workStatus;
        if (isPendingStage) {
          pending++;
          onTimeStatus = 'Pending';
        } else {
          inProcess++;
          if (targetDate && new Date(targetDate).getTime() < Date.now()) {
            onTimeStatus = 'Delayed';
            delayDays = Math.max(1, Math.round((Date.now() - new Date(targetDate).getTime()) / 86400000));
          } else {
            onTimeStatus = 'In Process';
          }
        }
      }

      return {
        system: 'Make System',
        id: req.requestNo,
        company: req.companyName || '—',
        title: req.systemName || req.systemRequirements || 'Internal System',
        requester: req.requester || req.createdBy || '—',
        assignedTo: req.assignedDeveloper || 'Unassigned',
        status: req.workStatus || req.currentStage || 'Pending',
        plannedDate: targetDate ? formatDisplayDate(targetDate) : '—',
        actualDate: actualDate ? formatDisplayDate(actualDate) : '—',
        onTimeStatus,
        delay: delayDays > 0 ? `${delayDays}d` : '0',
        raw: req
      };
    });

    const onTimeRate = completed > 0 ? Math.round((onTime / completed) * 100) : 100;

    return {
      total: list.length,
      pending,
      inProcess,
      completed,
      onTime,
      delayed,
      onTimeRate,
      records: normalizedRecords
    };
  }, [requests]);

  // --- TECHNICAL HELP METRICS ---
  const technicalMetrics = useMemo(() => {
    const list = technicalTickets || [];
    let completed = 0;
    let onTime = 0;
    let delayed = 0;
    let inProcess = 0;
    let pending = 0;

    const normalizedRecords = list.map(t => {
      const isResolved = Boolean(t.actualDate) || /^resolved$/i.test(String(t.status || '').trim());
      const planned = t.plannedDate ? new Date(t.plannedDate).getTime() : null;
      const actual = t.actualDate ? new Date(t.actualDate).getTime() : null;

      let onTimeStatus = 'In Process';
      let delayDays = 0;

      if (isResolved) {
        completed++;
        if (planned && actual) {
          if (actual <= planned + 86400000) {
            onTime++;
            onTimeStatus = 'On-Time';
          } else {
            delayed++;
            onTimeStatus = 'Delayed';
            delayDays = Math.max(1, Math.round((actual - planned) / 86400000));
          }
        } else {
          onTime++;
          onTimeStatus = 'On-Time';
        }
      } else {
        if (!t.status || t.status === 'Pending') {
          pending++;
          onTimeStatus = 'Pending';
        } else {
          inProcess++;
          if (planned && planned < Date.now()) {
            onTimeStatus = 'Delayed';
            delayDays = Math.max(1, Math.round((Date.now() - planned) / 86400000));
          } else {
            onTimeStatus = 'In Process';
          }
        }
      }

      return {
        system: 'Technical Help',
        id: t.ticketNo,
        company: t.company || '—',
        title: t.application ? `${t.application} - ${t.problem?.slice(0, 45) || 'Ticket'}` : t.problem?.slice(0, 50) || 'Technical Issue',
        requester: t.onBehalfOf ? `${t.onBehalfOf} (by ${t.requester})` : t.requester || '—',
        assignedTo: t.assignedTo || 'Unassigned',
        status: t.status || (isResolved ? 'Resolved' : 'Pending'),
        plannedDate: t.plannedDate ? formatDisplayDate(t.plannedDate) : '—',
        actualDate: t.actualDate ? formatDisplayDate(t.actualDate) : '—',
        onTimeStatus,
        delay: delayDays > 0 ? `${delayDays}d` : t.delay || '0',
        raw: t
      };
    });

    const onTimeRate = completed > 0 ? Math.round((onTime / completed) * 100) : 100;

    return {
      total: list.length,
      pending,
      inProcess,
      completed,
      onTime,
      delayed,
      onTimeRate,
      records: normalizedRecords
    };
  }, [technicalTickets]);

  // --- REPAIR SYSTEM METRICS ---
  const repairMetrics = useMemo(() => {
    const list = repairIssues || [];
    let completed = 0;
    let onTime = 0;
    let delayed = 0;
    let inProcess = 0;
    let pending = 0;

    const normalizedRecords = list.map(issue => {
      const status = overallStatus(issue);
      const isCompleted = status === 'Completed' || status === 'No Repair Required';
      const repairStage = issue.repair || {};
      const planned = repairStage.planned ? new Date(repairStage.planned).getTime() : null;
      const actual = repairStage.actual ? new Date(repairStage.actual).getTime() : null;

      let onTimeStatus = 'In Process';
      let delayDays = 0;

      if (isCompleted) {
        completed++;
        if (planned && actual) {
          if (actual <= planned + 86400000) {
            onTime++;
            onTimeStatus = 'On-Time';
          } else {
            delayed++;
            onTimeStatus = 'Delayed';
            delayDays = Math.max(1, Math.round((actual - planned) / 86400000));
          }
        } else {
          onTime++;
          onTimeStatus = 'On-Time';
        }
      } else {
        if (status === 'Pending Approval') {
          pending++;
          onTimeStatus = 'Pending';
        } else {
          inProcess++;
          const repairState = stageState(issue, 'repair');
          if (repairState.status === 'Overdue') {
            onTimeStatus = 'Delayed';
            delayDays = Math.max(1, Math.round(repairState.delayMs / 86400000));
          } else {
            onTimeStatus = 'In Process';
          }
        }
      }

      return {
        system: 'Repair System',
        id: issue.serial || issue.id,
        company: issue.company || '—',
        title: issue.description ? issue.description.slice(0, 50) : 'Repair Issue',
        requester: issue.requester || '—',
        assignedTo: issue.assessment?.assignedDeveloper || 'Unassigned',
        status,
        plannedDate: repairStage.planned ? formatDisplayDate(repairStage.planned) : '—',
        actualDate: repairStage.actual ? formatDisplayDate(repairStage.actual) : '—',
        onTimeStatus,
        delay: delayDays > 0 ? `${delayDays}d` : '0',
        raw: issue
      };
    });

    const onTimeRate = completed > 0 ? Math.round((onTime / completed) * 100) : 100;

    return {
      total: list.length,
      pending,
      inProcess,
      completed,
      onTime,
      delayed,
      onTimeRate,
      records: normalizedRecords
    };
  }, [repairIssues]);

  // --- CONSOLIDATED DME REPORT DATA ---
  const dmeSummary = useMemo(() => {
    const total = makeMetrics.total + technicalMetrics.total + repairMetrics.total;
    const pending = makeMetrics.pending + technicalMetrics.pending + repairMetrics.pending;
    const inProcess = makeMetrics.inProcess + technicalMetrics.inProcess + repairMetrics.inProcess;
    const completed = makeMetrics.completed + technicalMetrics.completed + repairMetrics.completed;
    const onTimeCompleted = makeMetrics.onTime + technicalMetrics.onTime + repairMetrics.onTime;
    const delayedCompleted = makeMetrics.delayed + technicalMetrics.delayed + repairMetrics.delayed;
    const onTimeRate = completed > 0 ? Math.round((onTimeCompleted / completed) * 100) : 100;

    const allRecords = [
      ...makeMetrics.records,
      ...technicalMetrics.records,
      ...repairMetrics.records
    ];

    // System breakdown array
    const systemBreakdown = [
      { name: 'Make System', ...makeMetrics },
      { name: 'Technical Help', ...technicalMetrics },
      { name: 'Repair System', ...repairMetrics }
    ];

    // Company breakdown array
    const companies = ['Pmmpl', 'RKL', 'Refrasynth', 'Purab', 'Refratech'];
    const companyBreakdown = companies.map(company => {
      const compRecords = allRecords.filter(r => r.company.toLowerCase().includes(company.toLowerCase()));
      const compCompleted = compRecords.filter(r => r.onTimeStatus === 'On-Time' || (r.status.toLowerCase().includes('completed') || r.status.toLowerCase().includes('resolved'))).length;
      const compOnTime = compRecords.filter(r => r.onTimeStatus === 'On-Time').length;
      const compPending = compRecords.filter(r => r.onTimeStatus === 'Pending').length;
      const compInProcess = compRecords.filter(r => r.onTimeStatus === 'In Process').length;
      const compRate = compCompleted > 0 ? Math.round((compOnTime / compCompleted) * 100) : 100;

      return {
        company,
        total: compRecords.length,
        completed: compCompleted,
        onTime: compOnTime,
        pending: compPending,
        inProcess: compInProcess,
        onTimeRate: compRate
      };
    });

    return {
      total,
      pending,
      inProcess,
      completed,
      onTimeCompleted,
      delayedCompleted,
      onTimeRate,
      systemBreakdown,
      companyBreakdown,
      records: allRecords
    };
  }, [makeMetrics, technicalMetrics, repairMetrics]);

  // Current records according to active tab
  const currentTabRecords = useMemo(() => {
    if (activeTab === 'make') return makeMetrics.records;
    if (activeTab === 'technical') return technicalMetrics.records;
    if (activeTab === 'repair') return repairMetrics.records;
    return makeMetrics.records;
  }, [activeTab, makeMetrics, technicalMetrics, repairMetrics]);

  // Filtered records
  const filteredRecords = useMemo(() => {
    return currentTabRecords.filter(r => {
      // Company filter
      if (selectedCompany !== 'All' && !r.company.toLowerCase().includes(selectedCompany.toLowerCase())) {
        return false;
      }
      // Status filter
      if (statusFilter !== 'All') {
        if (statusFilter === 'On-Time' && r.onTimeStatus !== 'On-Time') return false;
        if (statusFilter === 'Delayed' && r.onTimeStatus !== 'Delayed') return false;
        if (statusFilter === 'In Process' && r.onTimeStatus !== 'In Process') return false;
        if (statusFilter === 'Pending' && r.onTimeStatus !== 'Pending') return false;
      }
      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const str = `${r.id} ${r.company} ${r.title} ${r.requester} ${r.assignedTo} ${r.status}`.toLowerCase();
        if (!str.includes(q)) return false;
      }
      return true;
    });
  }, [currentTabRecords, selectedCompany, statusFilter, searchQuery]);

  // Export handlers
  const handleExportExcel = () => {
    exportDmeReportToExcel(dmeSummary, `${activeTab.toUpperCase()}_System_Report`);
    setExportNotice('Excel report generated and downloaded successfully!');
    setTimeout(() => setExportNotice(''), 3500);
  };

  const handleExportCsv = () => {
    exportDmeReportToCsv(filteredRecords, `${activeTab.toUpperCase()}_Records`);
    setExportNotice('CSV records exported successfully!');
    setTimeout(() => setExportNotice(''), 3500);
  };

  const handlePrintPdf = () => {
    printDmeReport();
  };

  // Import handler
  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportError('');
    try {
      const parsed = await parseImportFile(file);
      setImportedData(parsed);
    } catch (err) {
      setImportError(err.message || 'Failed to read file. Please upload a valid CSV or Excel file.');
    }
  };

  // Row click inspector
  const handleRowClick = (record) => {
    if (record.system === 'Make System') {
      setActiveRequestDetails(record.raw);
    } else if (record.system === 'Technical Help') {
      setActiveTicketDetails(record.raw);
    } else if (record.system === 'Repair System') {
      setActiveRepairDetails(record.raw);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto bg-[#f8fafc] text-slate-800 print:bg-white print:p-0">
      {/* 1. TOP STICKY HEADER WITH CENTERED THREE SYSTEMS BUTTONS */}
      <div className="sticky top-0 z-20 bg-white/95 backdrop-blur-md border-b border-slate-200/90 shadow-xs px-4 sm:px-6 py-3 print:hidden">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-3">
          {/* Left Title / Badge */}
          <div className="flex items-center gap-2.5 shrink-0 self-start md:self-auto">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center shadow-md">
              <BarChart3 className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight flex items-center gap-2">
                <span>Executive Dashboard</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 uppercase tracking-wider">
                  Overview
                </span>
              </h1>
              <p className="text-[11px] text-slate-400">  </p>
            </div>
          </div>

          {/* CENTER: THREE INDEPENDENT SYSTEM BUTTONS */}
          <div className="flex items-center justify-center w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
            <div className="flex items-center gap-2 sm:gap-2.5">
              {/* 1. Make System Button */}
              <button
                type="button"
                onClick={() => setActiveTab('make')}
                className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs transition-all cursor-pointer ${activeTab === 'make'
                    ? 'bg-blue-600 text-white font-bold shadow-md shadow-blue-500/25 ring-2 ring-blue-500/30'
                    : 'bg-white text-slate-700 hover:text-slate-900 hover:bg-slate-50 font-medium border border-slate-200/90 shadow-2xs'
                  }`}
              >
                <Layers className={`w-3.5 h-3.5 ${activeTab === 'make' ? 'text-white' : 'text-blue-600'}`} />
                <span>Make System</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${activeTab === 'make' ? 'bg-white/25 text-white' : 'bg-slate-100 text-slate-600'
                    }`}
                >
                  {makeMetrics.total}
                </span>
              </button>

              {/* 2. Technical Help Button */}
              <button
                type="button"
                onClick={() => setActiveTab('technical')}
                className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs transition-all cursor-pointer ${activeTab === 'technical'
                    ? 'bg-indigo-600 text-white font-bold shadow-md shadow-indigo-500/25 ring-2 ring-indigo-500/30'
                    : 'bg-white text-slate-700 hover:text-slate-900 hover:bg-slate-50 font-medium border border-slate-200/90 shadow-2xs'
                  }`}
              >
                <LifeBuoy className={`w-3.5 h-3.5 ${activeTab === 'technical' ? 'text-white' : 'text-indigo-600'}`} />
                <span>Technical Help</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${activeTab === 'technical' ? 'bg-white/25 text-white' : 'bg-slate-100 text-slate-600'
                    }`}
                >
                  {technicalMetrics.total}
                </span>
              </button>

              {/* 3. Repair System Button */}
              <button
                type="button"
                onClick={() => setActiveTab('repair')}
                className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs transition-all cursor-pointer ${activeTab === 'repair'
                    ? 'bg-cyan-700 text-white font-bold shadow-md shadow-cyan-600/25 ring-2 ring-cyan-500/30'
                    : 'bg-white text-slate-700 hover:text-slate-900 hover:bg-slate-50 font-medium border border-slate-200/90 shadow-2xs'
                  }`}
              >
                <Wrench className={`w-3.5 h-3.5 ${activeTab === 'repair' ? 'text-white' : 'text-cyan-600'}`} />
                <span>Repair System</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${activeTab === 'repair' ? 'bg-white/25 text-white' : 'bg-slate-100 text-slate-600'
                    }`}
                >
                  {repairMetrics.total}
                </span>
              </button>
            </div>
          </div>

          {/* Right Action Buttons: Import Excel, Export Excel, Export PDF */}
          <div className="flex items-center gap-2 shrink-0 self-end md:self-auto">
            {/* Import Button */}
            <button
              type="button"
              onClick={() => {
                setShowImportModal(true);
                setImportedData(null);
                setImportError('');
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 shadow-2xs hover:shadow-xs transition-all cursor-pointer"
              title="Import Excel or CSV dataset"
            >
              <Upload className="w-3.5 h-3.5 text-blue-600" />
              <span className="hidden sm:inline">Import Excel</span>
            </button>

            {/* Export Excel Button */}
            <button
              type="button"
              onClick={handleExportExcel}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 shadow-2xs hover:shadow-xs transition-all cursor-pointer"
              title="Download formatted Excel (.xls) report with multi-sheet scorecard"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
              <span className="hidden sm:inline">Export Excel</span>
            </button>

            {/* Export / Print PDF Button */}
            <button
              type="button"
              onClick={handlePrintPdf}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white shadow-2xs hover:shadow-xs transition-all cursor-pointer"
              title="Export as PDF / Print report"
            >
              <Printer className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Print / PDF</span>
            </button>
          </div>
        </div>

        {/* Export confirmation notice */}
        {exportNotice && (
          <div className="max-w-7xl mx-auto mt-2">
            <p className="text-xs bg-emerald-50 border border-emerald-200 text-emerald-800 px-3 py-1.5 rounded-xl flex items-center gap-2 animate-in fade-in duration-200">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>{exportNotice}</span>
            </p>
          </div>
        )}
      </div>

      {/* 2. MAIN DASHBOARD CONTENT CONTAINER */}
      <div className="max-w-7xl mx-auto p-4 sm:p-6 space-y-6">
        {/* Printable Report Header (only visible when printing / saving PDF) */}
        <div className="hidden print:block border-b-2 border-slate-800 pb-4 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">MAKE SYSTEM - EXECUTIVE REPORT</h1>
              <p className="text-xs text-slate-500 mt-1">Multi-System Performance & Completion Analysis</p>
            </div>
            <div className="text-right text-xs text-slate-500">
              <p>Generated: {new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}</p>
              <p>Executive: {currentUser?.fullName || 'Management'}</p>
            </div>
          </div>
        </div>


        {/* 4. FOUR CORE KPI SUMMARY CARDS */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {/* Card 1: Total Volume */}
          <div className="p-4 sm:p-5 bg-white border border-slate-200/90 rounded-2xl shadow-xs hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Total Volume</span>
              <div className="p-2 rounded-xl bg-blue-50 text-blue-600">
                <BarChart3 className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-slate-900">
              {activeTab === 'make'
                ? makeMetrics.total
                : activeTab === 'technical'
                  ? technicalMetrics.total
                  : repairMetrics.total}
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              {activeTab === 'make'
                ? 'Make System Requests'
                : activeTab === 'technical'
                  ? 'Technical Help Tickets'
                  : 'Repair Issues'}
            </p>
          </div>

          {/* Card 2: Total Pending */}
          <div className="p-4 sm:p-5 bg-white border border-slate-200/90 rounded-2xl shadow-xs hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-amber-600">Total Pending</span>
              <div className="p-2 rounded-xl bg-amber-50 text-amber-600">
                <Clock className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-amber-600">
              {activeTab === 'dme'
                ? dmeSummary.pending
                : activeTab === 'make'
                  ? makeMetrics.pending
                  : activeTab === 'technical'
                    ? technicalMetrics.pending
                    : repairMetrics.pending}
            </div>
            <p className="text-[11px] text-slate-500 mt-1">Awaiting approval or kickoff</p>
          </div>

          {/* Card 3: Total In Process */}
          <div className="p-4 sm:p-5 bg-white border border-slate-200/90 rounded-2xl shadow-xs hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-blue-600">Total In Process</span>
              <div className="p-2 rounded-xl bg-blue-50 text-blue-600">
                <TrendingUp className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-blue-600">
              {activeTab === 'dme'
                ? dmeSummary.inProcess
                : activeTab === 'make'
                  ? makeMetrics.inProcess
                  : activeTab === 'technical'
                    ? technicalMetrics.inProcess
                    : repairMetrics.inProcess}
            </div>
            <p className="text-[11px] text-slate-500 mt-1">Active development & repair</p>
          </div>

          {/* Card 4: Total Completed */}
          <div className="p-4 sm:p-5 bg-white border border-slate-200/90 rounded-2xl shadow-xs hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-600">Total Completed</span>
              <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
                <CheckCircle2 className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-emerald-600">
              {activeTab === 'dme'
                ? dmeSummary.completed
                : activeTab === 'make'
                  ? makeMetrics.completed
                  : activeTab === 'technical'
                    ? technicalMetrics.completed
                    : repairMetrics.completed}
            </div>
            <p className="text-[11px] text-slate-500 mt-1">Successfully closed & verified</p>
          </div>
        </section>


        {/* 7. DETAILED FILTERABLE DATA RECORDS TABLE */}
        <section className="bg-white border border-slate-200/90 rounded-2xl shadow-xs overflow-hidden">
          {/* Table Header Controls */}
          <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <span>
                  {activeTab === 'make'
                    ? 'Make System Records'
                    : activeTab === 'technical'
                      ? 'Technical Help Tickets'
                      : 'Repair System Records'}
                </span>
                <span className="text-xs px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full font-bold">
                  {filteredRecords.length}
                </span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">Click any row to view complete details, URLs, and attachments</p>
            </div>

            {/* Filter controls */}
            <div className="flex flex-wrap items-center gap-2.5">
              {/* Search */}
              <div className="relative min-w-[180px] sm:min-w-[220px]">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search records..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full text-xs pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400"
                />
              </div>

              {/* Company Filter */}
              <select
                value={selectedCompany}
                onChange={e => setSelectedCompany(e.target.value)}
                className="text-xs px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-100"
              >
                <option value="All">All Companies</option>
                <option value="Pmmpl">Pmmpl</option>
                <option value="RKL">RKL</option>
                <option value="Purab">Purab</option>
                <option value="Refrasynth">Refrasynth</option>
                <option value="Refratech">Refratech</option>
              </select>

              {/* Status Filter */}
              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
                className="text-xs px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-100"
              >
                <option value="All">All Statuses</option>
                <option value="On-Time">On-Time</option>
                <option value="Delayed">Delayed</option>
                <option value="In Process">In Process</option>
                <option value="Pending">Pending</option>
              </select>

              {/* Quick CSV Export */}
              <button
                type="button"
                onClick={handleExportCsv}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
                title="Download current filtered list as CSV"
              >
                <Download className="w-3.5 h-3.5" />
                <span>CSV</span>
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200/80">
                <tr>
                  <th className="p-3">System</th>
                  <th className="p-3">ID</th>
                  <th className="p-3">Company</th>
                  <th className="p-3">Title / Problem</th>
                  <th className="p-3">Requester</th>
                  <th className="p-3">Assigned To</th>
                  <th className="p-3">Planned Target</th>
                  <th className="p-3">Actual Date</th>
                  <th className="p-3 text-center">On-Time Status</th>
                  <th className="p-3 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredRecords.map((r, i) => (
                  <tr
                    key={`${r.system}-${r.id}-${i}`}
                    onClick={() => handleRowClick(r)}
                    className="hover:bg-blue-50/40 transition-colors cursor-pointer group"
                  >
                    <td className="p-3">
                      <span
                        className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${r.system === 'Make System'
                            ? 'bg-blue-50 text-blue-700 border-blue-200'
                            : r.system === 'Technical Help'
                              ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                              : 'bg-cyan-50 text-cyan-700 border-cyan-200'
                          }`}
                      >
                        {r.system}
                      </span>
                    </td>
                    <td className="p-3 font-mono font-bold text-slate-900 group-hover:text-blue-600">{r.id}</td>
                    <td className="p-3 font-medium text-slate-800">{r.company}</td>
                    <td className="p-3 max-w-xs truncate text-slate-700 font-medium" title={r.title}>
                      {r.title}
                    </td>
                    <td className="p-3 text-slate-600 truncate max-w-[130px]" title={r.requester}>
                      {r.requester}
                    </td>
                    <td className="p-3 text-slate-600 truncate max-w-[120px]">{r.assignedTo}</td>
                    <td className="p-3 font-medium text-slate-600">{r.plannedDate}</td>
                    <td className="p-3 font-medium text-slate-600">{r.actualDate}</td>
                    <td className="p-3 text-center">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border inline-flex items-center gap-1 ${r.onTimeStatus === 'On-Time'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : r.onTimeStatus === 'Delayed'
                              ? 'bg-rose-50 text-rose-700 border-rose-200'
                              : r.onTimeStatus === 'Pending'
                                ? 'bg-amber-50 text-amber-700 border-amber-200'
                                : 'bg-blue-50 text-blue-700 border-blue-200'
                          }`}
                      >
                        {r.onTimeStatus === 'On-Time' && <CheckCircle2 className="w-3 h-3 text-emerald-600" />}
                        {r.onTimeStatus === 'Delayed' && <AlertTriangle className="w-3 h-3 text-rose-600" />}
                        {r.onTimeStatus === 'In Process' && <TrendingUp className="w-3 h-3 text-blue-600" />}
                        {r.onTimeStatus === 'Pending' && <Clock className="w-3 h-3 text-amber-600" />}
                        <span>{r.onTimeStatus}</span>
                      </span>
                    </td>
                    <td className="p-3 text-center">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRowClick(r);
                        }}
                        className="p-1 rounded-lg hover:bg-blue-100 text-slate-400 hover:text-blue-600 transition-colors cursor-pointer"
                        title="View details"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
                {!filteredRecords.length && (
                  <tr>
                    <td colSpan={10} className="p-8 text-center text-slate-400">
                      No records found matching the selected filter criteria.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {/* 8. IMPORT EXCEL / CSV DATASET MODAL */}
      <Modal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        title="Import Excel or CSV Dataset"
        subtitle="Upload report sheets to inspect or verify records"
        large
        footer={
          <div className="flex items-center justify-between w-full">
            <span className="text-xs text-slate-400">
              {importedData ? `${importedData.count} records loaded` : 'Supports .csv, .xls, .xlsx'}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowImportModal(false)}
                className="px-4 py-2 border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-xl text-xs font-semibold cursor-pointer"
              >
                Close
              </button>
              {importedData && (
                <button
                  type="button"
                  onClick={() => {
                    setExportNotice(`Imported ${importedData.count} records previewed successfully!`);
                    setShowImportModal(false);
                  }}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-xs cursor-pointer"
                >
                  Confirm & Inspect
                </button>
              )}
            </div>
          </div>
        }
      >
        <div className="space-y-4">
          {/* Upload Dropzone */}
          <div className="p-6 border-2 border-dashed border-slate-200 hover:border-blue-400 bg-slate-50/70 rounded-2xl text-center space-y-2 transition-colors">
            <Upload className="w-8 h-8 text-blue-500 mx-auto" />
            <div className="space-y-1">
              <p className="text-xs font-bold text-slate-800">Select or Drag Excel / CSV file here</p>
              <p className="text-[11px] text-slate-400">Standard spreadsheet files with headers (.csv, .txt, .xls)</p>
            </div>
            <label className="inline-block mt-2">
              <span className="px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-semibold shadow-2xs cursor-pointer transition-colors">
                Browse File
              </span>
              <input
                type="file"
                accept=".csv, .txt, .xls, .xlsx"
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>
          </div>

          {importError && (
            <p className="text-xs bg-rose-50 text-rose-700 border border-rose-200 p-3 rounded-xl">{importError}</p>
          )}

          {/* Imported Data Preview */}
          {importedData && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-900">
                  Preview: {importedData.fileName} ({importedData.count} rows)
                </span>
                <span className="text-[11px] text-emerald-600 font-semibold flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> File validated
                </span>
              </div>

              <div className="max-h-60 overflow-y-auto border border-slate-200 rounded-xl overflow-x-auto">
                <table className="w-full text-[11px] text-left">
                  <thead className="bg-slate-100 text-slate-600 font-semibold sticky top-0">
                    <tr>
                      {importedData.headers.map((h, i) => (
                        <th key={i} className="p-2 whitespace-nowrap">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {importedData.rows.slice(0, 8).map((row, rIdx) => (
                      <tr key={rIdx} className="hover:bg-slate-50">
                        {row.map((cell, cIdx) => (
                          <td key={cIdx} className="p-2 whitespace-nowrap text-slate-700">
                            {cell}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {importedData.rows.length > 8 && (
                <p className="text-[10px] text-slate-400 text-right">Showing first 8 of {importedData.count} records</p>
              )}
            </div>
          )}
        </div>
      </Modal>

      {/* 9. CONNECTED DETAILS MODALS (For inspecting rows directly from the dashboard) */}
      <RequestDetailsModal
        isOpen={Boolean(activeRequestDetails)}
        request={activeRequestDetails}
        onClose={() => setActiveRequestDetails(null)}
      />

      <TechnicalTicketDetailsModal
        isOpen={Boolean(activeTicketDetails)}
        ticket={activeTicketDetails}
        onClose={() => setActiveTicketDetails(null)}
      />

      <RepairIssueDetailsModal
        issue={activeRepairDetails}
        onClose={() => setActiveRepairDetails(null)}
      />
    </div>
  );
}
