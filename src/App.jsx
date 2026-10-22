import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  Info
} from 'lucide-react';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { NewRequestModal } from './components/NewRequestModal';
import { RequestDetailsModal } from './components/RequestDetailsModal';

import { SystemRequestsPage } from './pages/SystemRequestsPage';
import { IntroduceSystemPage } from './pages/IntroduceSystemPage';
import { CreateSystemPage } from './pages/CreateSystemPage';
import { ReviseSystemPage } from './pages/ReviseSystemPage';
import { TestingSystemPage } from './pages/TestingSystemPage';
import { UpdateMisSystemPage } from './pages/UpdateMisSystemPage';
import { AdminMasterPage } from './pages/AdminMasterPage';
import { LoginPage } from './pages/LoginPage';
import { AccessDeniedPage } from './pages/AccessDeniedPage';
import { TechnicalHelpPage } from './pages/TechnicalHelpPage';
import { TechnicalTicketsPage } from './pages/TechnicalTicketsPage';
import { RepairSystemPage } from './pages/RepairSystemPage';
import { RepairRecordsPage } from './pages/RepairRecordsPage';
import { REPAIR_NAV_ITEMS } from './constants/stages';

import { dataService } from './services/dataService';
import { repairService, getRepairMode } from './services/repairService';
import { listTechnicalTickets } from './services/technicalHelpService';
import { authService, APP_STAGES, SYSTEMS } from './services/authService';
import { STAGES, WORK_STATUS } from './constants/stages';
import { calculateDueStatus } from './utils/dateUtils';
import { GOOGLE_SHEETS_CONFIG, isGoogleSheetsConnected } from './config/integrationConfig';

export default function App() {
  const [currentUser, setCurrentUser] = useState(() => authService.getCurrentUser());
  const [activePage, setActivePage] = useState('requests');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [technicalRefreshKey, setTechnicalRefreshKey] = useState(0);

  // Instant 0ms initial load directly from local cache
  const [requests, setRequests] = useState(() => (dataService.loadCachedRequests ? dataService.loadCachedRequests() : []));
  const [masterOptions, setMasterOptions] = useState(() => (dataService.loadCachedMasterOptions ? dataService.loadCachedMasterOptions() : { companies: [], developers: [] }));
  const [nextRequestNo, setNextRequestNo] = useState(() => (dataService.getNextRequestNumber ? dataService.getNextRequestNumber() : 'SM-0008'));
  // Never block the whole app on the network. Cached/empty state renders immediately
  // while live Google Sheets data is refreshed in the background.
  const [isLoading, setIsLoading] = useState(false);

  // Modals
  const [isNewRequestModalOpen, setIsNewRequestModalOpen] = useState(false);
  const [detailsRequest, setDetailsRequest] = useState(null);

  // Toast notifications
  const [toast, setToast] = useState(null);

  const showToast = useCallback((message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(prev => (prev?.message === message ? null : prev));
    }, 4500);
  }, []);

  // Stage label & default helper
  const getStageLabel = useCallback((pageId) => {
    if (pageId === 'admin') return 'Admin Master';
    const found = APP_STAGES.find(s => s.id === pageId);
    return found ? found.label : pageId;
  }, []);

  const getFirstAllowedStage = useCallback((user) => {
    if (!user) return 'requests';
    if (authService.isAdmin(user)) return 'requests';
    const allowed = APP_STAGES.find(s => authService.canAccessStage(user, s.id));
    return allowed ? ({ 'repair-approval':'repair-system', 'repair-work':'repair-problem' }[allowed.id] || allowed.id) : 'requests';
  }, []);

  // Fetch initial fresh data in 1 single fast roundtrip
  const loadData = useCallback(async () => {
    try {
      const user = authService.getCurrentUser();
      const makeAccess = SYSTEMS[0].stages.some(id => authService.canAccessStage(user, id));
      const data = makeAccess ? await dataService.loadAllData() : { masterOptions:await dataService.getMasterOptions() };
      if (data.requests) setRequests(data.requests);
      if (data.masterOptions) setMasterOptions(data.masterOptions);
      if (data.nextRequestNo) setNextRequestNo(data.nextRequestNo);
      if (data.users && data.users.length > 0) {
        authService.syncUsersFromSheet(data.users);
      }
    } catch (err) {
      console.warn('Background data sync check:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (currentUser) {
      loadData();
    }
  }, [currentUser, loadData]);

  const [isSyncing, setIsSyncing] = useState(false);

  const handleForceSync = useCallback(async () => {
    try {
      setIsSyncing(true);
      const user = await authService.refreshSession();
      setCurrentUser(user);
      const [res] = await Promise.all([
        SYSTEMS[0].stages.some(id => authService.canAccessStage(user,id)) ? dataService.forceSyncFromSheets() : dataService.getMasterOptions().then(masterOptions => ({masterOptions})),
        SYSTEMS[2].stages.some(id => authService.canAccessStage(user,id)) && getRepairMode() !== 'unconfigured' ? repairService.listIssues() : Promise.resolve(),
        authService.canAccessStage(user,'technical-all') ? listTechnicalTickets() : Promise.resolve()
      ]);
      if (res.requests) {
        setRequests(res.requests);
        setNextRequestNo(dataService.getNextRequestNumber(res.requests));
      }
      if (res.masterOptions) {
        setMasterOptions(res.masterOptions);
      }
      if (res.users) {
        authService.syncUsersFromSheet(res.users);
      }
      showToast('Live data synced from Google Sheet!', 'success');
    } catch (err) {
      showToast(`Sync failed: ${err.message}`, 'error');
    } finally {
      setIsSyncing(false);
    }
  }, [showToast]);

  // Automatic Background Two-Way Sync (Google Sheets → React)
  // Protected against overlapping requests and paused on inactive tabs
  useEffect(() => {
    let isCancelled = false;
    let isSyncingActive = false;

    const performSyncCheck = async () => {
      if (typeof document !== 'undefined' && document.hidden) return;
      if (!isGoogleSheetsConnected() || !currentUser || isSyncingActive) return;

      try {
        isSyncingActive = true;
        const fresh = await authService.refreshSession();
        if (!isCancelled && JSON.stringify([fresh?.permissions,fresh?.systemAccess,fresh?.status,fresh?.role]) !== JSON.stringify([currentUser.permissions,currentUser.systemAccess,currentUser.status,currentUser.role])) setCurrentUser(fresh);
        if (!SYSTEMS[0].stages.some(id => authService.canAccessStage(fresh,id))) return;
        const syncResult = await dataService.checkSync();
        if (!isCancelled && syncResult.hasChanges) {
          if (syncResult.requests) {
            setRequests(syncResult.requests);
            setNextRequestNo(dataService.getNextRequestNumber(syncResult.requests));
          }
          if (syncResult.masterOptions) {
            setMasterOptions(syncResult.masterOptions);
          }
          if (syncResult.users) {
            authService.syncUsersFromSheet(syncResult.users);
          }
        }
      } catch (err) {
        console.warn('Background sync check note:', err);
      } finally {
        isSyncingActive = false;
      }
    };

    const intervalMs = GOOGLE_SHEETS_CONFIG.realTimeSyncIntervalMs || 12000;
    const intervalId = setInterval(performSyncCheck, intervalMs);

    const handleFocus = () => {
      performSyncCheck();
    };
    window.addEventListener('focus', handleFocus);

    return () => {
      isCancelled = true;
      clearInterval(intervalId);
      window.removeEventListener('focus', handleFocus);
    };
  }, [currentUser]);

  // Derived counts for sidebar and header
  const counts = useMemo(() => {
    const result = {
      totalRequests: requests.length,
      introducePending: 0,
      createPending: 0,
      revisePending: 0,
      testingPending: 0,
      misPending: 0
    };

    requests.forEach(r => {
      if (!r.introduction?.isCompleted) result.introducePending++;
      if (r.introduction?.isCompleted && r.currentStage === STAGES.CREATE && !r.currentRevisionNo) {
        result.createPending++;
      }

      const hasRevision = Boolean(r.currentRevisionNo) || (r.testingHistory && r.testingHistory.some(t => t.decision === 'Rejected'));
      const isPendingRevision = r.currentStage === STAGES.REVISE || (r.currentStage === STAGES.CREATE && Boolean(r.currentRevisionNo));
      if (hasRevision && isPendingRevision && r.workStatus !== WORK_STATUS.COMPLETED) result.revisePending++;
      if (r.currentStage === STAGES.TESTING) result.testingPending++;
      if (r.currentStage === STAGES.UPDATE_MIS) result.misPending++;
    });

    return result;
  }, [requests]);

  // Active reminders in Create System
  const activeReminders = useMemo(() => {
    let overdue = 0;
    let dueSoon = 0;
    requests.forEach(r => {
      if (r.currentStage === STAGES.CREATE && r.introduction?.isCompleted) {
        const due = calculateDueStatus(r.holdExtendTargetDate || r.targetCompletionDate);
        if (due.isOverdue) overdue++;
        else if (due.isDueSoon) dueSoon++;
      }
    });
    return { overdue, dueSoon };
  }, [requests]);

  // Auth Handlers
  const handleLoginSuccess = (user) => {
    setCurrentUser(user);
    showToast(`Welcome back, ${user.fullName}!`, 'success');
    // Ensure activePage is permitted
    if (activePage === 'admin' && !authService.isAdmin(user)) {
      setActivePage(getFirstAllowedStage(user));
    } else if (activePage !== 'admin' && !authService.canAccessStage(user, activePage)) {
      setActivePage(getFirstAllowedStage(user));
    }
  };

  const handleLogout = () => {
    authService.logout();
    setCurrentUser(null);
    showToast('Signed out of Make System.', 'info');
  };

  // Handler: Create Request
  const handleCreateRequest = async (formData) => {
    const res = await dataService.createRequest(formData);
    const updated = res.allRequests || (await dataService.listRequests());
    const nextNo = dataService.getNextRequestNumber(updated);
    setRequests(updated);
    setNextRequestNo(nextNo);
    const targetNo = res.requestNo || res.newReq?.requestNo || 'New';
    showToast(`Request ${targetNo} created successfully! Added to Introduce System: Pending.`, 'success');
  };

  // Handler: Introduce System Approve
  const handleApproveIntroduction = async (requestId, introData) => {
    const res = await dataService.approveIntroduction(requestId, introData);
    const updated = res.allRequests || (await dataService.listRequests());
    setRequests(updated);
    const targetNo = res.requestNo || res.updatedReq?.requestNo || requestId;
    showToast(`Introduction approved for ${targetNo}. Transferred to Create System: Pending.`, 'success');
  };

  // Handler: Update Development Progress
  const handleUpdateProgress = async (requestId, devData) => {
    const res = await dataService.updateDevelopmentProgress(requestId, devData);
    const updated = res.allRequests || (await dataService.listRequests());
    setRequests(updated);
    const targetReq = res.updatedReq || res;

    if (devData.workStatus === WORK_STATUS.COMPLETED) {
      if (targetReq.currentRevisionNo) {
        showToast(`Revision completed (100%) for ${targetReq.requestNo}. Transferred to Update MIS System: Pending.`, 'success');
      } else {
        showToast(`Development completed (100%) for ${targetReq.requestNo}. Sent to Testing System: Pending.`, 'success');
      }
    } else if (devData.workStatus === WORK_STATUS.ON_HOLD) {
      const dateMsg = devData.extendedTargetDate ? ` (Target date extended to ${devData.extendedTargetDate})` : '';
      showToast(`Request ${targetReq.requestNo} placed On Hold${dateMsg}.`, 'error');
    } else {
      showToast(`Progress updated to ${devData.progressPercent}% for ${targetReq.requestNo}.`, 'success');
    }
  };

  // Handler: Testing Decision
  const handleSubmitTestingDecision = async (requestId, testData) => {
    const res = await dataService.submitTestingDecision(requestId, testData);
    const updated = res.allRequests || (await dataService.listRequests());
    setRequests(updated);
    const targetReq = res.updatedReq || res;

    if (testData.decision === 'Approved') {
      showToast(`Testing Approved for ${targetReq.requestNo}. Transferred to Update MIS System: Pending.`, 'success');
    } else {
      const dateMsg = testData.extendedTargetDate ? ` (Target date extended to ${testData.extendedTargetDate})` : '';
      showToast(
        `Testing Rejected for ${targetReq.requestNo}. Revision ${targetReq.currentRevisionNo} generated${dateMsg}. Transferred to Revise System: Pending.`,
        'error'
      );
    }
  };

  // Handler: Complete MIS Update
  const handleCompleteMisUpdate = async (requestId, misData) => {
    const res = await dataService.completeMisUpdate(requestId, misData);
    const updated = res.allRequests || (await dataService.listRequests());
    setRequests(updated);
    const targetReq = res.updatedReq || res;
    showToast(`MIS updated for ${targetReq.requestNo}. Request is now Closed!`, 'success');
  };

  // Handler: Reset Sample Data
  const handleResetSampleData = async () => {
    if (window.confirm('Are you sure you want to restore the default sample dataset?')) {
      await dataService.resetToSampleData();
      await loadData();
      showToast('Sample dataset restored successfully.', 'info');
    }
  };

  // If user is not authenticated, render Floating Soft UI Login Page
  if (!currentUser) {
    return (
      <>
        <LoginPage onLoginSuccess={handleLoginSuccess} />
        {toast && (
          <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 pointer-events-none">
            <div className="pointer-events-auto px-4 py-3 bg-white text-slate-800 rounded-2xl shadow-[0_12px_36px_-4px_rgba(15,23,42,0.12)] border border-slate-100 text-xs font-semibold flex items-center gap-3 max-w-md animate-in slide-in-from-bottom-3 duration-200">
              <div className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 ${
                toast.type === 'error' ? 'bg-rose-50 text-rose-600 border border-rose-100' :
                toast.type === 'info' ? 'bg-indigo-50 text-indigo-600 border border-indigo-100' :
                'bg-emerald-50 text-emerald-600 border border-emerald-100'
              }`}>
                {toast.type === 'error' ? <AlertTriangle className="w-4 h-4" /> : toast.type === 'info' ? <Info className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
              </div>
              <span className="leading-tight text-slate-700 font-medium">{toast.message}</span>
            </div>
          </div>
        )}
      </>
    );
  }

  return (
    <div className="h-screen w-screen flex bg-[#f6f8fb] overflow-hidden font-sans select-text">
      {/* Sidebar Navigation */}
      <Sidebar
        activePage={activePage}
        onSelectPage={setActivePage}
        isCollapsed={isSidebarCollapsed}
        counts={counts}
        isMobileOpen={isMobileOpen}
        onCloseMobile={() => setIsMobileOpen(false)}
        currentUser={currentUser}
        onLogout={handleLogout}
      />

      {/* Main Content Area: Fixed Header + Scrollable Inner Page Container */}
      <div className="flex-1 flex flex-col h-full min-w-0 overflow-hidden">
        <Header
          isSidebarCollapsed={isSidebarCollapsed}
          onToggleSidebar={() => setIsSidebarCollapsed(prev => !prev)}
          activeReminders={activeReminders}
          onResetSampleData={handleResetSampleData}
          onNavigateTo={(page) => setActivePage(page)}
          onRefreshData={loadData}
          showToast={showToast}
          currentUser={currentUser}
          onLogout={handleLogout}
          isSyncing={isSyncing}
          onForceSync={handleForceSync}
        />

        {isLoading ? (
          <div className="flex-1 flex items-center justify-center gap-3 text-slate-500 text-sm">
            <span className="w-6 h-6 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin" />
            <span className="font-semibold">Loading Make System...</span>
          </div>
        ) : (
          <main className="flex-1 h-[calc(100vh-3.5rem)] overflow-hidden flex flex-col">
            {/* Stage Access Guard / Router */}
            {activePage === 'admin' ? (
              authService.isAdmin(currentUser) ? (
                <AdminMasterPage currentUser={currentUser} showToast={showToast} />
              ) : (
                <AccessDeniedPage
                  stageName="Admin Master"
                  onNavigateAllowed={() => setActivePage(getFirstAllowedStage(currentUser))}
                />
              )
            ) : !authService.canAccessStage(currentUser, activePage) ? (
              <AccessDeniedPage
                stageName={getStageLabel(activePage)}
                onNavigateAllowed={() => setActivePage(getFirstAllowedStage(currentUser))}
              />
            ) : (
              <>
                {activePage === 'requests' && (
                  <SystemRequestsPage
                    requests={requests}
                    companyOptions={masterOptions.companies}
                    developerOptions={masterOptions.developers}
                    onOpenNewRequest={() => setIsNewRequestModalOpen(true)}
                    onViewDetails={(req) => setDetailsRequest(req)}
                    canCreate={authService.canAccessStage(currentUser, 'requests', 'update')}
                  />
                )}

                {activePage === 'technical-new' && (authService.canAccessStage(currentUser, 'technical-new', 'update') ? <TechnicalHelpPage currentUser={currentUser} companyOptions={masterOptions.companies} onCancel={() => setActivePage(getFirstAllowedStage(currentUser))} onCreated={() => setTechnicalRefreshKey(v => v + 1)} /> : <div className="p-6 text-sm text-slate-500">View only. Submission access is not enabled.</div>)}
                {activePage === 'technical-all' && <TechnicalTicketsPage refreshKey={technicalRefreshKey} canSubmit={authService.canAccessStage(currentUser, 'technical-all', 'update')} />}
                {['repair-system', 'repair-problem'].includes(activePage) && <RepairRecordsPage key={activePage} stage={activePage === 'repair-problem' ? 'repair' : 'approval'} currentUser={currentUser} onNavigate={setActivePage} />}
                {REPAIR_NAV_ITEMS.filter(item => item.view !== 'records').map(item => activePage === item.id && <RepairSystemPage key={item.id} view={item.view} onNavigate={setActivePage} currentUser={currentUser} companyOptions={masterOptions.companies} />)}

                {activePage === 'introduce' && (
                  <IntroduceSystemPage
                    requests={requests}
                    onApproveIntroduction={handleApproveIntroduction}
                    onViewDetails={(req) => setDetailsRequest(req)}
                    canApprove={authService.canAccessStage(currentUser, 'introduce', 'update')}
                  />
                )}

                {activePage === 'create' && (
                  <CreateSystemPage
                    requests={requests}
                    onUpdateProgress={handleUpdateProgress}
                    onViewDetails={(req) => setDetailsRequest(req)}
                    canEdit={authService.canAccessStage(currentUser, 'create', 'update')}
                  />
                )}

                {activePage === 'revise' && (
                  <ReviseSystemPage
                    requests={requests}
                    onUpdateProgress={handleUpdateProgress}
                    onViewDetails={(req) => setDetailsRequest(req)}
                    canEdit={authService.canAccessStage(currentUser, 'revise', 'update')}
                  />
                )}

                {activePage === 'testing' && (
                  <TestingSystemPage
                    requests={requests}
                    onSubmitDecision={handleSubmitTestingDecision}
                    onViewDetails={(req) => setDetailsRequest(req)}
                    canApprove={authService.canAccessStage(currentUser, 'testing', 'update')}
                  />
                )}

                {activePage === 'mis' && (
                  <UpdateMisSystemPage
                    requests={requests}
                    onSubmitMisUpdate={handleCompleteMisUpdate}
                    onViewDetails={(req) => setDetailsRequest(req)}
                    canEdit={authService.canAccessStage(currentUser, 'mis', 'update')}
                  />
                )}
              </>
            )}
          </main>
        )}
      </div>

      {/* Global New System Request Modal */}
      {isNewRequestModalOpen && (
        <NewRequestModal
          isOpen
          onClose={() => setIsNewRequestModalOpen(false)}
          onSubmit={handleCreateRequest}
          companyOptions={masterOptions.companies}
          developerOptions={masterOptions.developers}
          nextRequestNo={nextRequestNo}
        />
      )}

      {/* View Request Details Modal */}
      {detailsRequest && (
        <RequestDetailsModal
          isOpen={Boolean(detailsRequest)}
          onClose={() => setDetailsRequest(null)}
          request={detailsRequest}
          activePage={activePage}
        />
      )}

      {/* Toast Notification Container */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 pointer-events-none">
          <div
            className="pointer-events-auto px-4 py-3 bg-white text-slate-800 rounded-2xl shadow-[0_12px_36px_-4px_rgba(15,23,42,0.12)] border border-slate-100 text-xs font-semibold flex items-center gap-3 max-w-md animate-in slide-in-from-bottom-3 duration-200"
          >
            <div
              className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 ${
                toast.type === 'error'
                  ? 'bg-rose-50 text-rose-600 border border-rose-100'
                  : toast.type === 'info'
                  ? 'bg-indigo-50 text-indigo-600 border border-indigo-100'
                  : 'bg-emerald-50 text-emerald-600 border border-emerald-100'
              }`}
            >
              {toast.type === 'error' ? (
                <AlertTriangle className="w-4 h-4" />
              ) : toast.type === 'info' ? (
                <Info className="w-4 h-4" />
              ) : (
                <CheckCircle2 className="w-4 h-4" />
              )}
            </div>
            <span className="leading-tight text-slate-700 font-medium">{toast.message}</span>
          </div>
        </div>
      )}
    </div>
  );
}
