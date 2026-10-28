/**
 * Make System - Authentication, User Management & Stage-Wise Permissions Service
 * 
 * Provides:
 * 1. Floating Soft UI Authentication & Session Management
 * 2. User CRUD (Create, Read, Update, Deactivate, Password Reset)
 * 3. Granular Stage-Wise Permissions (view, edit, approve)
 * 4. Audit Log Trail
 * 5. Two-Way Sync with Google Sheets backend and local persistence
 */

import { isGoogleSheetsConnected } from '../config/integrationConfig';
import { callGoogleAppsScript } from './dataService';
import { SYSTEMS, normalizeAccess, hasStageAccess } from '../utils/accessPolicy.mjs';
import { applyBulkAccess } from '../utils/accessPresets.mjs';
export { SYSTEMS };

const STORAGE_KEY_USERS = 'make_system_users_v2';
const STORAGE_KEY_SESSION = 'make_system_session_v2';
const STORAGE_KEY_AUDIT = 'make_system_audit_logs_v2';

const userListeners = new Set();

export const APP_STAGES = [
  { id: 'requests', label: 'System Requests', description: 'View, filter and register new system requests' },
  { id: 'technical-new', label: 'Raise Technical Help', description: 'Submit a technical help ticket' },
  { id: 'technical-all', label: 'All Technical Tickets', description: 'View and filter technical help tickets' },
  { id: 'introduce', label: 'Introduce System', description: 'Kickoff meetings and initial requirement discussions' },
  { id: 'create', label: 'Create System', description: 'Core software development progress and hold management' },
  { id: 'mis', label: 'Update MIS System', description: 'Final MIS synchronization and request lifecycle closure' },
  { id: 'repair-new', label: 'New Issue Request', description: 'Submit new repair issue requests', repairAction: true },
  { id: 'repair-approval', label: 'Approval For Repair', description: 'Assess issues and submit repair approvals', repairAction: true },
  { id: 'repair-work', label: 'Resolve Problem', description: 'Submit resolution remarks and complete repairs', repairAction: true }
];

export const USER_ROLES = {
  ADMIN: 'Admin',
  USER: 'User',
  EA: 'EA',
  DME: 'DME'
};

export const USER_STATUS = {
  ACTIVE: 'Active',
  INACTIVE: 'Inactive'
};

// Default Stage Permissions for Admins (Full Access)
export function getFullAdminPermissions() {
  const perms = {};
  APP_STAGES.forEach(s => {
    perms[s.id] = { view: true, update: true, edit: true, approve: true };
  });
  return perms;
}

// Default Seed Users
const SEED_USERS = [
  {
    id: 'usr-admin-01',
    username: 'admin',
    password: 'password123', // Demo credentials: admin / password123
    fullName: 'System Administrator',
    email: 'admin@makesystem.local',
    employeeId: 'ADM-001',
    role: USER_ROLES.ADMIN,
    status: USER_STATUS.ACTIVE,
    department: 'IT & Infrastructure',
    permissions: getFullAdminPermissions(),
    createdAt: '2026-10-01T09:00:00.000Z',
    lastLoginAt: null
  },
  {
    id: 'usr-dev-01',
    username: 'ahitesh',
    password: 'password123', // Demo credentials: ahitesh / password123
    fullName: 'Ahitesh Tandon',
    email: 'ahitesh@company.local',
    employeeId: 'DEV-101',
    role: USER_ROLES.USER,
    status: USER_STATUS.ACTIVE,
    department: 'Engineering',
    permissions: {
      requests: { view: true, edit: false, approve: false },
      introduce: { view: false, edit: false, approve: false },
      create: { view: true, edit: false, approve: false },
      revise: { view: true, edit: false, approve: false },
      testing: { view: false, edit: false, approve: false },
      mis: { view: false, edit: false, approve: false }
    },
    createdAt: '2026-10-05T10:30:00.000Z',
    lastLoginAt: null
  },
  {
    id: 'usr-qa-01',
    username: 'bhupendra',
    password: 'password123', // Demo credentials: bhupendra / password123
    fullName: 'Bhupendra Kumar',
    email: 'bhupendra@company.local',
    employeeId: 'QA-201',
    role: USER_ROLES.USER,
    status: USER_STATUS.ACTIVE,
    department: 'Quality Assurance',
    permissions: {
      requests: { view: true, edit: false, approve: false },
      introduce: { view: false, edit: false, approve: false },
      create: { view: false, edit: false, approve: false },
      revise: { view: false, edit: false, approve: false },
      testing: { view: true, edit: false, approve: false },
      mis: { view: false, edit: false, approve: false }
    },
    createdAt: '2026-10-08T11:15:00.000Z',
    lastLoginAt: null
  },
  {
    id: 'usr-lead-01',
    username: 'alauddin',
    password: 'password123', // Demo credentials: alauddin / password123
    fullName: 'MD Alauddin',
    email: 'alauddin@company.local',
    employeeId: 'ENG-301',
    role: USER_ROLES.USER,
    status: USER_STATUS.ACTIVE,
    department: 'Operations & MIS',
    permissions: {
      requests: { view: true, edit: false, approve: false },
      introduce: { view: true, edit: false, approve: false },
      create: { view: true, edit: false, approve: false },
      revise: { view: false, edit: false, approve: false },
      testing: { view: false, edit: false, approve: false },
      mis: { view: true, edit: false, approve: false }
    },
    createdAt: '2026-10-10T14:20:00.000Z',
    lastLoginAt: null
  }
];

// Helper: Load Users
export function loadLocalUsers() {
  if (typeof window === 'undefined') return SEED_USERS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY_USERS);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY_USERS, JSON.stringify(SEED_USERS));
      return SEED_USERS;
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      // Sanitize: regular users only have view permissions; edit/approve is admin only
      return parsed.map(normalizeAccess);
    }
  } catch {
    return SEED_USERS;
  }
  return SEED_USERS;
}

// Helper: Save Users
function saveLocalUsers(users) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY_USERS, JSON.stringify(users));
  } catch (e) {
    console.error('Failed to save users locally:', e);
  }
}

// Helper: Audit Logging
export function logAuditEvent(action, details, actor = 'System') {
  if (typeof window === 'undefined') return;
  try {
    const raw = localStorage.getItem(STORAGE_KEY_AUDIT) || '[]';
    const logs = JSON.parse(raw);
    const newLog = {
      id: `audit-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      action,
      details,
      actor,
      timestamp: new Date().toISOString()
    };
    logs.unshift(newLog);
    // Keep last 250 logs
    if (logs.length > 250) logs.pop();
    localStorage.setItem(STORAGE_KEY_AUDIT, JSON.stringify(logs));
  } catch { /* Audit storage may be unavailable. */ }
}

export function getAuditLogs() {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY_AUDIT);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export const authService = {
  /**
   * Get currently active session user
   */
  getCurrentUser() {
    if (typeof window === 'undefined') return null;
    try {
      const raw = localStorage.getItem(STORAGE_KEY_SESSION) || sessionStorage.getItem(STORAGE_KEY_SESSION);
      if (!raw) return null;
      const session = JSON.parse(raw);
      if (isGoogleSheetsConnected() && !session.token) return null;
      const fresh = session.token ? null : loadLocalUsers().find(user => user.username === session.username);
      const safe = normalizeAccess(fresh ? { ...session, ...fresh } : session);
      delete safe.password;
      return safe;
    } catch {
      return null;
    }
  },

  /**
   * Authenticate user with username/email and password
   */
  async login(usernameOrEmail, password, rememberMe = true) {
    const query = String(usernameOrEmail || '').trim().toLowerCase();
    const pass = String(password || '').trim();

    if (!query || !pass) {
      throw new Error('Please enter both username/email and password.');
    }

    if (isGoogleSheetsConnected()) {
      const result = await callGoogleAppsScript('login', { username:query, password:pass });
      if (!result.user || !result.token) throw new Error('Login API unavailable. Deploy the updated Apps Script.');
      const session = { ...normalizeAccess(result.user), token:result.token };
      (rememberMe ? localStorage : sessionStorage).setItem(STORAGE_KEY_SESSION, JSON.stringify(session));
      return session;
    }

    const users = loadLocalUsers();
    const user = users.find(u => 
      (u.username?.toLowerCase() === query || u.email?.toLowerCase() === query)
    );

    if (!user) {
      logAuditEvent('Login Failed', `Failed login attempt for unknown user: "${query}"`, 'Anonymous');
      throw new Error('Invalid username/email or password.');
    }

    if (user.status === USER_STATUS.INACTIVE) {
      logAuditEvent('Login Blocked', `Account "${user.username}" is inactive`, user.fullName);
      throw new Error('This account has been deactivated. Please contact your administrator.');
    }

    if (user.password !== pass) {
      logAuditEvent('Login Failed', `Incorrect password attempt for user: "${user.username}"`, user.fullName);
      throw new Error('Invalid username/email or password.');
    }

    // Update lastLoginAt
    const nowISO = new Date().toISOString();
    user.lastLoginAt = nowISO;
    const updatedUsers = users.map(u => u.id === user.id ? { ...u, lastLoginAt: nowISO } : u);
    saveLocalUsers(updatedUsers);

    // Create session payload (without plain password)
    const sessionUser = {
      id: user.id,
      username: user.username,
      fullName: user.fullName,
      email: user.email,
      employeeId: user.employeeId || '',
      role: user.role,
      department: user.department || '',
      permissions: normalizeAccess(user).permissions,
      systemAccess: normalizeAccess(user).systemAccess,
      status: user.status,
      loginAt: nowISO
    };

    if (rememberMe) {
      localStorage.setItem(STORAGE_KEY_SESSION, JSON.stringify(sessionUser));
    } else {
      sessionStorage.setItem(STORAGE_KEY_SESSION, JSON.stringify(sessionUser));
    }

    logAuditEvent('User Login', `User "${user.username}" logged in successfully`, user.fullName);

    return sessionUser;
  },

  /**
   * Terminate current session
   */
  logout() {
    const user = this.getCurrentUser();
    if (user) {
      logAuditEvent('User Logout', `User "${user.username}" signed out`, user.fullName);
    }
    localStorage.removeItem(STORAGE_KEY_SESSION);
    sessionStorage.removeItem(STORAGE_KEY_SESSION);
  },

  /**
   * Check if a user has permission for a specific stage and action
   */
  canAccessStage(user, stageId, action = 'view') {
    return hasStageAccess(user, stageId, action);
  },

  async refreshSession() {
    const current = this.getCurrentUser();
    if (!current?.token || !isGoogleSheetsConnected()) return current;
    const result = await callGoogleAppsScript('getSession', {}, 'GET');
    if (!result.user) throw new Error('Session unavailable. Please log in again.');
    const session = { ...normalizeAccess(result.user), token:current.token };
    (localStorage.getItem(STORAGE_KEY_SESSION) ? localStorage : sessionStorage).setItem(STORAGE_KEY_SESSION, JSON.stringify(session));
    return session;
  },

  /**
   * Check if user is an Administrator
   */
  isAdmin(user) {
    return Boolean(user && user.role === USER_ROLES.ADMIN && user.status === USER_STATUS.ACTIVE);
  },

  /**
   * List all managed users (fetches live from Google Sheets if connected)
   */
  async listUsers(forceLive = false) {
    if (!this.isAdmin(this.getCurrentUser())) throw new Error('Only Admin can manage users.');
    if (isGoogleSheetsConnected()) {
      try {
        const res = await callGoogleAppsScript('getUsers', {}, 'GET');
        if (res && Array.isArray(res.users) && res.users.length > 0) {
          saveLocalUsers(res.users);
          return res.users;
        } else if (res && Array.isArray(res.users) && res.users.length === 0) {
          saveLocalUsers([]);
          return [];
        }
      } catch (err) {
        if (forceLive) throw err;
        console.warn('Live Google Sheets getUsers failed, fallback to local cache:', err);
      }
    }
    return loadLocalUsers();
  },

  /**
   * Sync all local users to Google Sheets (Initial or Manual Sync)
   */
  async syncAllUsersToSheet() {
    if (!this.isAdmin(this.getCurrentUser())) throw new Error('Only Admin can manage users.');
    if (!isGoogleSheetsConnected()) {
      throw new Error('Google Sheets is not connected. Please connect Google Apps Script Web App URL first.');
    }
    // Read current sheet users on the server before extending permission columns.
    return await callGoogleAppsScript('setupLoginPermissions', {}, 'POST');
  },

  /**
   * Background sync receiver when Google Sheets changes
   */
  syncUsersFromSheet(sheetUsers) {
    if (!Array.isArray(sheetUsers) || sheetUsers.length === 0) return;
    saveLocalUsers(sheetUsers);
    userListeners.forEach(listener => {
      try {
        listener(sheetUsers);
      } catch (err) {
        console.warn('User listener error:', err);
      }
    });
  },

  /**
   * Subscribe to real-time user updates
   */
  subscribeToUserUpdates(callback) {
    userListeners.add(callback);
    return () => userListeners.delete(callback);
  },

  /**
   * Create a new User (Saves locally & syncs to Google Sheets "Login Page")
   */
  async createUser(userData, actor = 'System Administrator') {
    if (!this.isAdmin(this.getCurrentUser())) throw new Error('Only Admin can manage users.');
    const users = loadLocalUsers();
    const cleanUsername = String(userData.username || '').trim().toLowerCase();

    if (!cleanUsername) throw new Error('Username is required.');
    if (!userData.fullName?.trim()) throw new Error('Full Name is required.');
    if (!userData.password?.trim()) throw new Error('Password is required for new accounts.');

    // Duplicate check
    const exists = users.some(u => u.username?.toLowerCase() === cleanUsername);
    if (exists) {
      throw new Error(`Username "${cleanUsername}" already exists. Please choose a unique username.`);
    }

    const newUser = {
      id: `usr-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      username: cleanUsername,
      password: userData.password.trim(),
      fullName: userData.fullName.trim(),
      email: `${cleanUsername}@company.local`,
      employeeId: userData.employeeId?.trim() || '',
      role: userData.role || USER_ROLES.USER,
      status: userData.status || USER_STATUS.ACTIVE,
      department: userData.department?.trim() || 'General',
      systemAccess: userData.systemAccess,
      permissions: userData.role === USER_ROLES.ADMIN 
        ? getFullAdminPermissions() 
        : (userData.permissions || {}),
      createdAt: new Date().toISOString(),
      lastLoginAt: null
    };

    if (isGoogleSheetsConnected()) await callGoogleAppsScript('createUser', { userData:newUser });
    const updated = [newUser, ...users];
    saveLocalUsers(updated);

    logAuditEvent(
      'User Created', 
      `Created user "${newUser.username}" (${newUser.fullName}) with role ${newUser.role}`, 
      actor
    );


    return newUser;
  },

  /**
   * Update existing user details or permissions (Saves locally & syncs to Google Sheets)
   */
  async updateUser(userId, updates, actor = 'System Administrator') {
    if (!this.isAdmin(this.getCurrentUser())) throw new Error('Only Admin can manage users.');
    const users = loadLocalUsers();
    const index = users.findIndex(u => u.id === userId);
    if (index === -1) throw new Error('User not found.');

    const current = users[index];

    // Check duplicate username if changed
    if (updates.username && updates.username.trim().toLowerCase() !== current.username.toLowerCase()) {
      const cleanUser = updates.username.trim().toLowerCase();
      const duplicate = users.some(u => u.id !== userId && u.username.toLowerCase() === cleanUser);
      if (duplicate) throw new Error(`Username "${cleanUser}" is already taken.`);
      updates.username = cleanUser;
    }

    const updatedUser = {
      ...current,
      ...updates,
      // If role changed to Admin, ensure full permissions
      permissions: (updates.role === USER_ROLES.ADMIN || (!updates.role && current.role === USER_ROLES.ADMIN))
        ? getFullAdminPermissions()
        : (updates.permissions !== undefined ? updates.permissions : current.permissions),
      lastUpdatedAt: new Date().toISOString()
    };

    if (isGoogleSheetsConnected()) await callGoogleAppsScript('updateUser', { userId, userData:updatedUser });
    users[index] = updatedUser;
    saveLocalUsers(users);

    // If current session is this user, refresh session
    const currentSession = this.getCurrentUser();
    if (currentSession && currentSession.id === userId) {
      const refreshedSession = {
        ...currentSession,
        fullName: updatedUser.fullName,
        email: updatedUser.email,
        role: updatedUser.role,
        permissions: updatedUser.permissions,
        systemAccess: updatedUser.systemAccess,
        status: updatedUser.status
      };
      if (localStorage.getItem(STORAGE_KEY_SESSION)) {
        localStorage.setItem(STORAGE_KEY_SESSION, JSON.stringify(refreshedSession));
      } else {
        sessionStorage.setItem(STORAGE_KEY_SESSION, JSON.stringify(refreshedSession));
      }
    }

    logAuditEvent(
      'User Updated', 
      `Updated user profile & permissions for "${updatedUser.username}"`, 
      actor
    );


    return updatedUser;
  },

  /**
   * Bulk access: apply one access change (and optionally a role) to many users with a single sheet save.
   * change = { role?, mode: 'add' | 'replace' | 'remove', stages: { [stageId]: { view, update } } }
   */
  async bulkUpdateAccess(userIds, change, actor = 'System Administrator') {
    if (!this.isAdmin(this.getCurrentUser())) throw new Error('Only Admin can manage users.');
    const ids = new Set(userIds);
    // Start from the live sheet so a stale local cache never overwrites newer edits.
    const users = isGoogleSheetsConnected() ? await this.listUsers(true) : loadLocalUsers();
    let changed = 0;
    const updated = users.map(user => {
      if (!ids.has(user.id)) return user;
      const result = applyBulkAccess(user, change);
      if (!result) return user;
      changed++;
      return { ...user, ...result, lastUpdatedAt: new Date().toISOString() };
    });
    if (isGoogleSheetsConnected()) await callGoogleAppsScript('saveUsers', { users: updated });
    saveLocalUsers(updated);
    logAuditEvent('Bulk Access Updated', `Updated access for ${changed} user(s) (${change.mode}${change.role ? `, role ${change.role}` : ''})`, actor);
    return { changed, skipped: ids.size - changed };
  },

  /**
   * Toggle User Active/Inactive status
   */
  async toggleUserStatus(userId, actor = 'System Administrator') {
    const users = loadLocalUsers();
    const user = users.find(u => u.id === userId);
    if (!user) throw new Error('User not found.');

    const newStatus = user.status === USER_STATUS.ACTIVE ? USER_STATUS.INACTIVE : USER_STATUS.ACTIVE;
    return this.updateUser(userId, { status: newStatus }, actor);
  },

  /**
   * Reset User Password
   */
  async resetPassword(userId, newPassword, actor = 'System Administrator') {
    if (!newPassword || newPassword.trim().length < 4) {
      throw new Error('Password must be at least 4 characters.');
    }
    const updated = await this.updateUser(userId, { password: newPassword.trim() }, actor);
    logAuditEvent('Password Reset', `Password reset for user "${updated.username}"`, actor);
    return updated;
  },

  /**
   * Delete a User (Removes locally & syncs to Google Sheets "Login Page")
   */
  async deleteUser(userId, actor = 'System Administrator') {
    if (!this.isAdmin(this.getCurrentUser())) throw new Error('Only Admin can manage users.');
    const users = loadLocalUsers();
    const user = users.find(u => u.id === userId);
    if (!user) throw new Error('User not found.');

    if (user.username === 'admin') {
      throw new Error('The primary System Administrator account cannot be deleted.');
    }

    if (isGoogleSheetsConnected()) {
      await callGoogleAppsScript('deleteUser', { userId, username: user.username }, 'POST');
    }
    const filtered = users.filter(u => u.id !== userId);
    saveLocalUsers(filtered);

    logAuditEvent('User Deleted', `Deleted user account "${user.username}" (${user.fullName})`, actor);

    return true;
  }
};
