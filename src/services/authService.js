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

const STORAGE_KEY_USERS = 'make_system_users_v2';
const STORAGE_KEY_SESSION = 'make_system_session_v2';
const STORAGE_KEY_AUDIT = 'make_system_audit_logs_v2';

const userListeners = new Set();

export const APP_STAGES = [
  { id: 'requests', label: 'System Requests', description: 'View, filter and register new system requests' },
  { id: 'introduce', label: 'Introduce System', description: 'Kickoff meetings and initial requirement discussions' },
  { id: 'create', label: 'Create System', description: 'Core software development progress and hold management' },
  { id: 'revise', label: 'Revise System', description: 'Post-QA defect resolutions and revision cycles' },
  { id: 'testing', label: 'Testing System', description: 'QA verification, approvals, and defect rationale logging' },
  { id: 'mis', label: 'Update MIS System', description: 'Final MIS synchronization and request lifecycle closure' }
];

export const USER_ROLES = {
  ADMIN: 'Admin',
  USER: 'User'
};

export const USER_STATUS = {
  ACTIVE: 'Active',
  INACTIVE: 'Inactive'
};

// Default Stage Permissions for Admins (Full Access)
export function getFullAdminPermissions() {
  const perms = {};
  APP_STAGES.forEach(s => {
    perms[s.id] = { view: true, edit: true, approve: true };
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
      return parsed.map(u => {
        if (u.role !== USER_ROLES.ADMIN && u.permissions) {
          const sanitized = {};
          APP_STAGES.forEach(s => {
            sanitized[s.id] = {
              view: Boolean(u.permissions[s.id]?.view),
              edit: false,
              approve: false
            };
          });
          return { ...u, permissions: sanitized };
        }
        return u;
      });
    }
  } catch (e) {
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
  } catch (e) {}
}

export function getAuditLogs() {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY_AUDIT);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
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
      return JSON.parse(raw);
    } catch (e) {
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
      permissions: user.permissions || {},
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
    if (!user || user.status !== USER_STATUS.ACTIVE) return false;
    // Admins have full access to everything (view, edit, approve, etc.)
    if (user.role === USER_ROLES.ADMIN) return true;

    // Edit, create and approve actions are strictly reserved for Admins
    if (action === 'edit' || action === 'approve' || action === 'create') {
      return false;
    }

    // Regular users can only have View access if permitted
    const perms = user.permissions || {};
    const stagePerm = perms[stageId];
    if (!stagePerm) return false;

    return Boolean(stagePerm.view);
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
    if (isGoogleSheetsConnected()) {
      try {
        const res = await callGoogleAppsScript('getUsers', {}, 'GET');
        if (res && Array.isArray(res.users) && res.users.length > 0) {
          saveLocalUsers(res.users);
          return res.users;
        } else if (res && Array.isArray(res.users) && res.users.length === 0) {
          // If sheet is empty, populate it with seed users
          const local = loadLocalUsers();
          await callGoogleAppsScript('saveUsers', { users: local }, 'POST');
          return local;
        }
      } catch (err) {
        console.warn('Live Google Sheets getUsers failed, fallback to local cache:', err);
      }
    }
    return loadLocalUsers();
  },

  /**
   * Sync all local users to Google Sheets (Initial or Manual Sync)
   */
  async syncAllUsersToSheet() {
    if (!isGoogleSheetsConnected()) {
      throw new Error('Google Sheets is not connected. Please connect Google Apps Script Web App URL first.');
    }
    const users = loadLocalUsers();
    return await callGoogleAppsScript('saveUsers', { users }, 'POST');
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
      permissions: userData.role === USER_ROLES.ADMIN 
        ? getFullAdminPermissions() 
        : (userData.permissions || {}),
      createdAt: new Date().toISOString(),
      lastLoginAt: null
    };

    const updated = [newUser, ...users];
    saveLocalUsers(updated);

    logAuditEvent(
      'User Created', 
      `Created user "${newUser.username}" (${newUser.fullName}) with role ${newUser.role}`, 
      actor
    );

    // Sync to Google Sheets "Login Page" tab
    if (isGoogleSheetsConnected()) {
      try {
        await callGoogleAppsScript('createUser', { userData: newUser }, 'POST');
      } catch (err) {
        console.warn('Google Sheets createUser sync failed:', err);
      }
    }

    return newUser;
  },

  /**
   * Update existing user details or permissions (Saves locally & syncs to Google Sheets)
   */
  async updateUser(userId, updates, actor = 'System Administrator') {
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

    // Sync to Google Sheets "Login Page" tab
    if (isGoogleSheetsConnected()) {
      try {
        await callGoogleAppsScript('updateUser', { userId, userData: updatedUser }, 'POST');
      } catch (err) {
        console.warn('Google Sheets updateUser sync failed:', err);
      }
    }

    return updatedUser;
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
    const users = loadLocalUsers();
    const user = users.find(u => u.id === userId);
    if (!user) throw new Error('User not found.');

    if (user.username === 'admin') {
      throw new Error('The primary System Administrator account cannot be deleted.');
    }

    const filtered = users.filter(u => u.id !== userId);
    saveLocalUsers(filtered);

    logAuditEvent('User Deleted', `Deleted user account "${user.username}" (${user.fullName})`, actor);

    // Sync deletion to Google Sheets "Login Page" tab
    if (isGoogleSheetsConnected()) {
      try {
        await callGoogleAppsScript('deleteUser', { userId, username: user.username }, 'POST');
      } catch (err) {
        console.warn('Google Sheets deleteUser sync failed:', err);
      }
    }

    return true;
  }
};
