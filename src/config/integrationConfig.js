/**
 * Make System - Google Sheets Integration Configuration
 * 
 * Centralized configuration for Google Sheets Apps Script Web App connection.
 * Supports dynamic configuration via UI, localStorage, and environment variables.
 */

const STORAGE_KEY_APPSCRIPT_URL = 'make_system_appscript_url';

export const GOOGLE_SHEETS_CONFIG = {
  // Backend Apps Script Web App endpoint URL
  backendEndpoint: (typeof window !== 'undefined' && window.localStorage.getItem(STORAGE_KEY_APPSCRIPT_URL)) ||
    (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_GOOGLE_APPS_SCRIPT_URL) ||
    'https://script.google.com/macros/s/AKfycbyg_RCZS-549mAZLhzXskzBquvkTKZ0mrTczzNyx6CsnYNFU-A9oaw-07DX4dmcG_30rQ/exec',

  // Sheet Names within the workbook
  sheetNames: {
    systemRequests: 'FMS',
    fallbackRequests: 'System_Requests',
    masterOptions: 'Master'
  },

  // Polling interval in milliseconds for background real-time sync from Sheets to React
  realTimeSyncIntervalMs: 30000,

  // Workflow & Reference Attachment Upload Settings
  attachments: {
    maxFileSizeBytes: 10 * 1024 * 1024, // 10MB limit
    allowedMimeTypes: [
      'application/pdf',
      'image/png',
      'image/jpeg',
      'image/jpg',
      'image/webp'
    ]
  }
};

/**
 * Check if the live Google Sheets Apps Script integration is connected
 */
export function isGoogleSheetsConnected() {
  const url = getGoogleAppsScriptUrl();
  return Boolean(url && url.startsWith('http'));
}

/**
 * Get current configured Apps Script URL
 */
export function getGoogleAppsScriptUrl() {
  if (typeof window !== 'undefined') {
    const saved = window.localStorage.getItem(STORAGE_KEY_APPSCRIPT_URL);
    if (saved) return saved.trim();
  }
  return GOOGLE_SHEETS_CONFIG.backendEndpoint ? GOOGLE_SHEETS_CONFIG.backendEndpoint.trim() : '';
}

/**
 * Save Apps Script URL dynamically
 */
export function setGoogleAppsScriptUrl(url) {
  const cleanUrl = url ? url.trim() : '';
  GOOGLE_SHEETS_CONFIG.backendEndpoint = cleanUrl;
  if (typeof window !== 'undefined') {
    if (cleanUrl) {
      window.localStorage.setItem(STORAGE_KEY_APPSCRIPT_URL, cleanUrl);
    } else {
      window.localStorage.removeItem(STORAGE_KEY_APPSCRIPT_URL);
    }
  }
}

/**
 * Return current connection summary for UI display
 */
export function getIntegrationStatusSummary() {
  if (isGoogleSheetsConnected()) {
    const url = getGoogleAppsScriptUrl();
    const shortUrl = url.length > 45 ? url.substring(0, 42) + '...' : url;
    return {
      connected: true,
      label: 'Google Sheets Connected',
      detail: `Real-time Two-Way Sync Active • ${shortUrl}`
    };
  }
  return {
    connected: false,
    label: 'Demo Mode — Google Sheets not connected',
    detail: 'Using local storage. Connect Google Apps Script Web App URL for real-time two-way synchronization.'
  };
}
