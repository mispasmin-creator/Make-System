import React, { useState } from 'react';
import {
  Menu,
  RotateCcw,
  AlertTriangle,
  Info,
  Clock,
  Sparkles,
  Link2,
  CheckCircle2,
  RefreshCw,
  Database,
  ExternalLink,
  ShieldCheck,
  Trash2,
  LogOut
} from 'lucide-react';
import {
  isGoogleSheetsConnected,
  getGoogleAppsScriptUrl,
  setGoogleAppsScriptUrl,
  getIntegrationStatusSummary,
  GOOGLE_SHEETS_CONFIG
} from '../config/integrationConfig';
import { CURRENT_USER } from '../constants/stages';
import { Modal } from './Modal';
import { dataService } from '../services/dataService';

export function Header({
  isSidebarCollapsed,
  onToggleSidebar,
  activeReminders = { overdue: 0, dueSoon: 0 },
  onResetSampleData,
  onNavigateTo,
  onRefreshData,
  showToast,
  currentUser,
  onLogout,
  isSyncing,
  onForceSync
}) {
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [inputUrl, setInputUrl] = useState(getGoogleAppsScriptUrl());
  const [isTesting, setIsTesting] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [initResult, setInitResult] = useState(null);

  const statusSummary = getIntegrationStatusSummary();
  const totalUrgent = activeReminders.overdue + activeReminders.dueSoon;
  const isConnected = isGoogleSheetsConnected();

  const handleOpenModal = () => {
    setInputUrl(getGoogleAppsScriptUrl());
    setTestResult(null);
    setInitResult(null);
    setShowConfigModal(true);
  };

  // Test current or typed URL
  const handleTestConnection = async () => {
    const targetUrl = (inputUrl || '').trim();
    if (!targetUrl) {
      setTestResult({ success: false, message: 'Please enter a valid Google Apps Script Web App URL.' });
      return;
    }
    setIsTesting(true);
    setTestResult(null);
    const startTime = Date.now();
    try {
      // Temporarily test the provided URL
      const pingUrl = `${targetUrl}${targetUrl.includes('?') ? '&' : '?'}action=ping`;
      const res = await fetch(pingUrl, { method: 'GET', headers: { 'Accept': 'application/json' } });
      const elapsed = Date.now() - startTime;
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data.status === 'ok') {
        setTestResult({
          success: true,
          message: `Connection successful (${elapsed}ms). Google Apps Script is responding!`
        });
      } else {
        throw new Error(data.error || 'Invalid response from Web App');
      }
    } catch (err) {
      setTestResult({
        success: false,
        message: `Connection failed: ${err.message}. Ensure deployment has "Execute as: Me" and "Who has access: Anyone".`
      });
    } finally {
      setIsTesting(false);
    }
  };

  // Save URL and connect
  const handleSaveAndConnect = async () => {
    const clean = (inputUrl || '').trim();
    if (!clean) {
      setTestResult({ success: false, message: 'Please enter a valid Web App URL.' });
      return;
    }
    if (!clean.startsWith('https://script.google.com/')) {
      if (!window.confirm('The URL does not start with https://script.google.com/. Do you want to continue anyway?')) {
        return;
      }
    }

    setGoogleAppsScriptUrl(clean);
    setTestResult({ success: true, message: 'Google Sheets URL saved. Connecting...' });
    if (showToast) showToast('Google Sheets URL saved! Fetching live data...', 'info');

    if (onRefreshData) {
      await onRefreshData();
    }
    setShowConfigModal(false);
  };

  // Disconnect and switch back to demo mode
  const handleDisconnect = async () => {
    if (window.confirm('Disconnect from Google Sheets and return to local Demo mode?')) {
      setGoogleAppsScriptUrl('');
      setInputUrl('');
      setTestResult(null);
      setInitResult(null);
      if (showToast) showToast('Disconnected from Google Sheets. Running in Demo mode.', 'info');
      if (onRefreshData) {
        await onRefreshData();
      }
      setShowConfigModal(false);
    }
  };

  // Initialize sheet tabs and columns
  const handleInitSheet = async () => {
    if (!isConnected) {
      setInitResult({ success: false, message: 'Connect your Google Sheets URL first before initializing.' });
      return;
    }
    setIsInitializing(true);
    setInitResult(null);
    try {
      const res = await dataService.initSheetStructure();
      setInitResult({
        success: true,
        message: `Sheet initialized successfully! Tabs "${res.requestsSheet || 'System_Requests'}" & "${res.masterSheet || 'Master_Data'}" are ready with formatted columns.`
      });
      if (showToast) showToast('Google Sheet initialized with headers & master lists!', 'success');
      if (onRefreshData) await onRefreshData();
    } catch (err) {
      setInitResult({
        success: false,
        message: `Initialization failed: ${err.message}`
      });
    } finally {
      setIsInitializing(false);
    }
  };

  return (
    <>
      <header className="h-16 bg-white border-b border-slate-100/90 shadow-[0_2px_12px_rgba(15,23,42,0.02)] px-6 flex items-center justify-between sticky top-0 z-30 shrink-0">
        <div className="flex items-center gap-3.5">
          <button
            type="button"
            onClick={onToggleSidebar}
            className="w-9 h-9 rounded-xl border border-slate-200/70 flex items-center justify-center text-slate-500 hover:text-slate-800 hover:bg-slate-50/80 shadow-2xs hover:shadow-xs hover:-translate-y-0.5 transition-all cursor-pointer"
            title={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-label="Toggle navigation menu"
          >
            <Menu className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-2.5">
            {isSidebarCollapsed && (
              <div className="w-8 h-8 rounded-lg bg-white border border-slate-200/90 flex items-center justify-center p-1 shadow-2xs">
                <img src="/logo.png" alt="Make System Logo" className="w-full h-full object-contain" />
              </div>
            )}
            <span className="text-sm font-bold text-slate-800 tracking-tight">Make System</span>
          </div>
        </div>

        {/* Center / Status Badges */}
        <div className="flex items-center gap-2.5">
          {/* Sync Sheet Live Button */}
          {isConnected && (
            <button
              type="button"
              onClick={onForceSync}
              disabled={isSyncing}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-white border border-slate-200/90 text-slate-700 hover:bg-slate-50 hover:text-indigo-600 shadow-2xs hover:shadow-xs hover:-translate-y-0.5 transition-all cursor-pointer disabled:opacity-60"
              title="Click to immediately pull live updates from Google Sheet"
            >
              <RefreshCw className={`w-3 h-3 text-indigo-600 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>{isSyncing ? 'Syncing...' : 'Sync Sheet'}</span>
            </button>
          )}

          {/* Overdue / Due Soon Alert Pill */}
          {totalUrgent > 0 && (
            <button
              type="button"
              onClick={() => onNavigateTo('create')}
              className={`hidden md:inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold border cursor-pointer transition-all duration-200 shadow-2xs hover:shadow-xs hover:-translate-y-0.5 ${
                activeReminders.overdue > 0
                  ? 'bg-rose-50/90 text-rose-700 border-rose-200/70 hover:bg-rose-100/80'
                  : 'bg-amber-50/90 text-amber-700 border-amber-200/70 hover:bg-amber-100/80'
              }`}
              title="Click to open Create System development queue"
            >
              {activeReminders.overdue > 0 ? (
                <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
              ) : (
                <Clock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
              )}
              <span>
                {activeReminders.overdue > 0
                  ? `${activeReminders.overdue} Overdue Development`
                  : `${activeReminders.dueSoon} Due Soon`}
              </span>
            </button>
          )}
        </div>

        {/* Right side: User Badge */}
        <div className="flex items-center gap-3">
          <div
            className="flex items-center gap-2.5"
            title={currentUser ? `${currentUser.fullName} (${currentUser.role})` : 'User Profile'}
          >
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-600 to-indigo-500 text-white font-bold text-xs flex items-center justify-center shadow-xs shadow-indigo-300">
              {currentUser?.fullName ? currentUser.fullName.charAt(0).toUpperCase() : 'U'}
            </div>
            <div className="hidden lg:block text-left leading-tight">
              <span className="block text-xs font-bold text-slate-800">
                {currentUser?.fullName || 'User'}
              </span>
              <span className="block text-[10px] text-slate-400 font-medium">
                {currentUser?.role === 'Admin' ? 'System Administrator' : `${currentUser?.department || 'User'}`}
              </span>
            </div>

            {onLogout && (
              <button
                type="button"
                onClick={onLogout}
                className="ml-1 p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                title="Sign out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Integration Configuration Details Modal */}
      <Modal
        isOpen={showConfigModal}
        onClose={() => setShowConfigModal(false)}
        title="Google Sheets ↔ React Real-Time Sync"
        subtitle="Automatic two-way synchronization via Google Apps Script"
        maxWidth="max-w-2xl"
        footer={
          <div className="flex items-center justify-between w-full">
            <div>
              {isConnected && (
                <button
                  type="button"
                  onClick={handleDisconnect}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg cursor-pointer transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Disconnect Sheet
                </button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="px-4 py-2 border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-lg text-xs font-semibold cursor-pointer"
                onClick={() => setShowConfigModal(false)}
              >
                Close
              </button>
              <button
                type="button"
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs rounded-lg shadow-sm px-4 py-2 cursor-pointer transition-colors"
                onClick={handleSaveAndConnect}
              >
                Save & Connect
              </button>
            </div>
          </div>
        }
      >
        <div className="space-y-4 text-xs">
          {/* Status Alert Banner */}
          {isConnected ? (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-900 flex items-start gap-2.5">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              <div className="space-y-0.5 leading-relaxed">
                <div className="font-bold text-emerald-950 flex items-center gap-2">
                  <span>Google Sheets Connected & Live</span>
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-200/60 text-emerald-900">
                    2-Way Real-Time
                  </span>
                </div>
                <p className="text-emerald-800 text-[11px]">
                  React actions automatically write to Google Sheets. Sheet updates sync back to React in the background every 5 seconds.
                </p>
              </div>
            </div>
          ) : (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 flex items-start gap-2.5">
              <Sparkles className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="space-y-0.5 leading-relaxed">
                <div className="font-bold text-amber-950">Currently in Replaceable Demo Mode</div>
                <p className="text-amber-800 text-[11px]">
                  All records are currently stored locally. Connect your Google Apps Script Web App URL below to start real-time two-way synchronization.
                </p>
              </div>
            </div>
          )}

          {/* Web App URL Configuration */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-800">
              Google Apps Script Web App URL <span className="text-indigo-600">*</span>
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  type="url"
                  value={inputUrl}
                  onChange={(e) => setInputUrl(e.target.value)}
                  placeholder="https://script.google.com/macros/s/AKfycb.../exec"
                  className="w-full pl-8 pr-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-slate-800 placeholder-slate-400"
                />
                <Link2 className="w-4 h-4 text-slate-400 absolute left-2.5 top-2.5 pointer-events-none" />
              </div>
              <button
                type="button"
                onClick={handleTestConnection}
                disabled={isTesting}
                className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-lg border border-slate-300 cursor-pointer disabled:opacity-50 shrink-0 flex items-center gap-1.5 transition-colors"
                title="Test connection to Google Apps Script"
              >
                {isTesting ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-slate-600" />
                ) : (
                  <ShieldCheck className="w-3.5 h-3.5 text-slate-600" />
                )}
                <span>{isTesting ? 'Testing...' : 'Test Connection'}</span>
              </button>
            </div>
          </div>

          {/* Test / Init Result Feedback */}
          {testResult && (
            <div
              className={`p-2.5 rounded-lg border text-xs flex items-center gap-2 ${
                testResult.success
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                  : 'bg-rose-50 text-rose-800 border-rose-200'
              }`}
            >
              {testResult.success ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              )}
              <span>{testResult.message}</span>
            </div>
          )}

          {initResult && (
            <div
              className={`p-2.5 rounded-lg border text-xs flex items-center gap-2 ${
                initResult.success
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                  : 'bg-rose-50 text-rose-800 border-rose-200'
              }`}
            >
              {initResult.success ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              )}
              <span>{initResult.message}</span>
            </div>
          )}

          {/* Setup Actions Card */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                <Database className="w-4 h-4 text-indigo-600" />
                <span>Spreadsheet Setup & Tools</span>
              </span>
              <button
                type="button"
                onClick={handleInitSheet}
                disabled={isInitializing || !isConnected}
                className="px-2.5 py-1 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg cursor-pointer disabled:opacity-40 flex items-center gap-1.5 transition-colors"
                title="Automatically create tabs and format columns in your Google Sheet"
              >
                {isInitializing ? (
                  <RefreshCw className="w-3 h-3 animate-spin text-indigo-600" />
                ) : (
                  <Sparkles className="w-3 h-3 text-indigo-600" />
                )}
                <span>1-Click Initialize Sheet</span>
              </button>
            </div>

            <p className="text-[11px] text-slate-600 leading-relaxed">
              <strong>1-Click Initialize Sheet</strong> creates the required tabs (<code className="bg-white px-1 py-0.5 rounded border border-slate-200 font-mono text-[10px]">System_Requests</code> & <code className="bg-white px-1 py-0.5 rounded border border-slate-200 font-mono text-[10px]">Master_Data</code>) with styled headers and default company/developer dropdowns in your Google Sheet.
            </p>
          </div>

          {/* Quick Setup Checklist */}
          <div className="border border-slate-200 rounded-xl p-3.5 space-y-2 bg-white">
            <span className="block font-bold text-slate-800 text-xs">
              Quick 4-Step Setup Guide
            </span>
            <ol className="list-decimal pl-4 space-y-1.5 text-[11px] text-slate-600 leading-relaxed">
              <li>
                In your Google Sheet, click <strong>Extensions → Apps Script</strong>.
              </li>
              <li>
                Copy and paste the code from <code className="bg-slate-100 px-1 py-0.5 rounded border font-mono text-[10px]">google-apps-script/Code.gs</code> and click <strong>Save</strong>.
              </li>
              <li>
                Click <strong>Deploy → New deployment</strong>, select <strong>Web app</strong>, set <em>Execute as:</em> <strong>Me</strong> and <em>Who has access:</em> <strong>Anyone</strong>.
              </li>
              <li>
                Copy the Web App URL, paste it into the field above, and click <strong>Save & Connect</strong>.
              </li>
            </ol>
          </div>
        </div>
      </Modal>
    </>
  );
}

