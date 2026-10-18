import React, { useState, useEffect, useMemo } from 'react';
import {
  Shield,
  Users,
  UserPlus,
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  MoreVertical,
  Key,
  Edit,
  Power,
  Trash2,
  Lock,
  Layers,
  History,
  AlertCircle,
  Check,
  ChevronRight,
  ShieldCheck,
  RefreshCw
} from 'lucide-react';
import {
  authService,
  APP_STAGES,
  USER_ROLES,
  USER_STATUS,
  getAuditLogs
} from '../services/authService';
import { isGoogleSheetsConnected } from '../config/integrationConfig';
import { UserFormModal } from '../components/UserFormModal';
import { UserDetailsModal } from '../components/UserDetailsModal';
import { formatDisplayDateTime } from '../utils/dateUtils';

export function AdminMasterPage({ currentUser, showToast }) {
  const [activeTab, setActiveTab] = useState('users'); // 'users' | 'audit'
  const [users, setUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Modals
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [userToEdit, setUserToEdit] = useState(null);
  const [selectedUserDetails, setSelectedUserDetails] = useState(null);

  // Audit Logs
  const [auditLogs, setAuditLogs] = useState([]);

  // Load users from service (Google Sheets or local cache)
  const loadUsers = async () => {
    try {
      setIsLoading(true);
      const list = await authService.listUsers();
      setUsers(list);
      setAuditLogs(getAuditLogs());
    } catch (err) {
      if (showToast) showToast('Failed to load users: ' + err.message, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();

    // Subscribe to live two-way updates from Google Sheets background sync
    const unsubscribe = authService.subscribeToUserUpdates((liveUsers) => {
      setUsers(liveUsers);
    });
    return () => unsubscribe();
  }, []);

  const handleManualSheetSync = async () => {
    try {
      setIsSyncing(true);
      if (isGoogleSheetsConnected()) {
        await authService.syncAllUsersToSheet();
        const updated = await authService.listUsers(true);
        setUsers(updated);
        if (showToast) showToast('Users synced with Google Sheet "Login Page" successfully!', 'success');
      } else {
        await loadUsers();
        if (showToast) showToast('Loaded cached users. Connect Google Sheets for live sync.', 'info');
      }
    } catch (err) {
      if (showToast) showToast('Sync failed: ' + err.message, 'error');
    } finally {
      setIsSyncing(false);
    }
  };

  // Filtered Users
  const filteredUsers = useMemo(() => {
    return users.filter(u => {
      if (roleFilter !== 'ALL' && u.role !== roleFilter) return false;
      if (statusFilter !== 'ALL' && u.status !== statusFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = u.fullName?.toLowerCase().includes(q);
        const matchUser = u.username?.toLowerCase().includes(q);
        const matchEmail = u.email?.toLowerCase().includes(q);
        const matchDept = u.department?.toLowerCase().includes(q);
        return matchName || matchUser || matchEmail || matchDept;
      }
      return true;
    });
  }, [users, roleFilter, statusFilter, searchQuery]);

  // Handlers
  const handleCreateUser = async (newUserData) => {
    try {
      await authService.createUser(newUserData, currentUser?.fullName || 'System Administrator');
      await loadUsers();
      if (showToast) showToast(`User "${newUserData.username}" created successfully!`, 'success');
    } catch (err) {
      if (showToast) showToast(err.message, 'error');
      throw err;
    }
  };

  const handleUpdateUser = async (updatedData) => {
    if (!userToEdit) return;
    try {
      await authService.updateUser(userToEdit.id, updatedData, currentUser?.fullName || 'System Administrator');
      await loadUsers();
      if (showToast) showToast(`User "${updatedData.username || userToEdit.username}" updated!`, 'success');
    } catch (err) {
      if (showToast) showToast(err.message, 'error');
      throw err;
    }
  };

  const handleToggleStatus = async (userId) => {
    try {
      const updated = await authService.toggleUserStatus(userId, currentUser?.fullName || 'System Administrator');
      await loadUsers();
      if (showToast) showToast(`User account status updated to ${updated.status}.`, 'info');
    } catch (err) {
      if (showToast) showToast(err.message, 'error');
    }
  };

  const handleResetPassword = async (userId, newPass) => {
    try {
      await authService.resetPassword(userId, newPass, currentUser?.fullName || 'System Administrator');
      await loadUsers();
      if (showToast) showToast('Password reset successfully.', 'success');
    } catch (err) {
      if (showToast) showToast(err.message, 'error');
      throw err;
    }
  };

  const handleDeleteUser = async (userId) => {
    try {
      await authService.deleteUser(userId, currentUser?.fullName || 'System Administrator');
      await loadUsers();
      if (showToast) showToast('User removed from system.', 'info');
    } catch (err) {
      if (showToast) showToast(err.message, 'error');
    }
  };

  // Top Banner / Actions Area
  return (
    <div className="flex-1 flex flex-col h-full bg-[#f6f8fb] overflow-hidden select-text">
      {/* Top Banner / Actions Area */}
      <div className="p-6 pb-0 flex flex-col gap-4 shrink-0">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-indigo-50 border border-indigo-200/70 flex items-center justify-center text-indigo-700 shadow-2xs">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">
                Admin Master
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-800 border border-indigo-200 uppercase tracking-wider">
                Access Control & Security
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium mt-1">
              Centralized user provisioning, role assignments, and granular stage access management.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={handleManualSheetSync}
              disabled={isSyncing}
              className="bg-white hover:bg-slate-50 border border-slate-200/90 text-slate-700 font-bold text-xs rounded-xl shadow-2xs px-3.5 py-2.5 inline-flex items-center gap-2 cursor-pointer transition-all hover:-translate-y-0.5 disabled:opacity-60"
              title="Sync users with Google Sheet 'Login Page' tab"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-indigo-600 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>{isSyncing ? 'Syncing...' : 'Sync Sheet'}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setUserToEdit(null);
                setIsFormModalOpen(true);
              }}
              className="soft-btn-primary font-bold text-xs rounded-xl shadow-xs px-4 py-2.5 inline-flex items-center gap-2 cursor-pointer transition-all hover:-translate-y-0.5"
            >
              <UserPlus className="w-4 h-4" />
              <span>Create New User</span>
            </button>
          </div>
        </div>

        {/* Tab Navigation Pill Bar */}
        <div className="flex items-center gap-2 border-b border-slate-200/70 pt-2">
          <button
            type="button"
            onClick={() => setActiveTab('users')}
            className={`pb-3 px-3 text-xs font-bold transition-all relative flex items-center gap-2 cursor-pointer ${
              activeTab === 'users'
                ? 'text-indigo-600 border-b-2 border-indigo-600'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>User Management ({users.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('audit')}
            className={`pb-3 px-3 text-xs font-bold transition-all relative flex items-center gap-2 cursor-pointer ${
              activeTab === 'audit'
                ? 'text-indigo-600 border-b-2 border-indigo-600'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <History className="w-4 h-4" />
            <span>Security Audit Log ({auditLogs.length})</span>
          </button>
        </div>
      </div>

      {/* Main Tab Content */}
      <div className="flex-1 p-6 overflow-y-auto">
        {/* Tab 1: User Management */}
        {activeTab === 'users' && (
          <div className="space-y-4">
            {/* Filter / Search Bar */}
            <div className="p-3.5 bg-white border border-slate-200/80 rounded-2xl shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="relative w-full sm:w-72">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Search by name, user, department..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200/80 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400"
                />
              </div>

              <div className="flex items-center gap-2.5 w-full sm:w-auto">
                <select
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value)}
                  className="px-3 py-1.5 bg-white border border-slate-200/80 text-xs font-semibold text-slate-700 rounded-xl shadow-2xs cursor-pointer focus:outline-none focus:border-indigo-400"
                >
                  <option value="ALL">All Roles</option>
                  <option value={USER_ROLES.ADMIN}>Admins</option>
                  <option value={USER_ROLES.USER}>Users</option>
                </select>

                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="px-3 py-1.5 bg-white border border-slate-200/80 text-xs font-semibold text-slate-700 rounded-xl shadow-2xs cursor-pointer focus:outline-none focus:border-indigo-400"
                >
                  <option value="ALL">All Statuses</option>
                  <option value={USER_STATUS.ACTIVE}>Active</option>
                  <option value={USER_STATUS.INACTIVE}>Inactive</option>
                </select>
              </div>
            </div>

            {/* Users Table */}
            <div className="bg-white border border-slate-200/80 rounded-2xl shadow-2xs overflow-hidden">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50/90 text-slate-600 font-bold uppercase tracking-wider text-[10px] border-b border-slate-100">
                  <tr>
                    <th className="py-3 px-4">User</th>
                    <th className="py-3 px-3">Role</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-3">Permitted Stages</th>
                    <th className="py-3 px-3">Department</th>
                    <th className="py-3 px-3">Created</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-400 italic">
                        No users match the search criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.map((user) => {
                      const isAdmin = user.role === USER_ROLES.ADMIN;
                      const isActive = user.status === USER_STATUS.ACTIVE;
                      const permittedStages = isAdmin 
                        ? APP_STAGES 
                        : APP_STAGES.filter(s => user.permissions?.[s.id]?.view);

                      return (
                        <tr key={user.id} className="hover:bg-slate-50/60 transition-colors">
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-700 font-bold flex items-center justify-center text-xs shrink-0">
                                {user.fullName ? user.fullName.charAt(0).toUpperCase() : 'U'}
                              </div>
                              <div className="min-w-0">
                                <span className="font-bold text-slate-900 block truncate text-xs hover:text-indigo-600 cursor-pointer" onClick={() => setSelectedUserDetails(user)}>
                                  {user.fullName}
                                </span>
                                <span className="text-[11px] text-slate-400 font-mono block truncate">
                                  @{user.username}
                                </span>
                              </div>
                            </div>
                          </td>

                          <td className="py-3 px-3">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                              isAdmin
                                ? 'bg-purple-50 text-purple-700 border border-purple-200'
                                : 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                            }`}>
                              {user.role}
                            </span>
                          </td>

                          <td className="py-3 px-3">
                            <button
                              type="button"
                              onClick={() => user.username !== 'admin' && handleToggleStatus(user.id)}
                              disabled={user.username === 'admin'}
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider inline-flex items-center gap-1 transition-all ${
                                isActive
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 cursor-pointer'
                                  : 'bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 cursor-pointer'
                              } disabled:cursor-not-allowed`}
                            >
                              <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                              <span>{user.status}</span>
                            </button>
                          </td>

                          <td className="py-3 px-3">
                            {isAdmin ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-purple-50 text-purple-700 border border-purple-200">
                                All Stages (Admin Full Access)
                              </span>
                            ) : permittedStages.length === 0 ? (
                              <span className="text-slate-400 text-xs italic">No stages assigned</span>
                            ) : (
                              <div className="flex flex-wrap gap-1 max-w-[280px]">
                                {permittedStages.map(s => (
                                  <span
                                    key={s.id}
                                    className="inline-flex items-center px-2 py-0.5 rounded-lg text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200/80 shadow-2xs"
                                    title={s.description}
                                  >
                                    {s.label}
                                  </span>
                                ))}
                              </div>
                            )}
                          </td>

                          <td className="py-3 px-3 text-slate-600 font-medium">
                            {user.department || 'General'}
                          </td>

                          <td className="py-3 px-3 text-slate-400 text-[11px]">
                            {formatDisplayDateTime(user.createdAt)}
                          </td>

                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                type="button"
                                onClick={() => setSelectedUserDetails(user)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                                title="View User Details"
                              >
                                <ChevronRight className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setUserToEdit(user);
                                  setIsFormModalOpen(true);
                                }}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                                title="Edit User & Permissions"
                              >
                                <Edit className="w-3.5 h-3.5" />
                              </button>
                              {user.username !== 'admin' && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (window.confirm(`Delete account for "${user.username}"?`)) {
                                      handleDeleteUser(user.id);
                                    }
                                  }}
                                  className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                                  title="Delete User"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 2: Audit Log */}
        {activeTab === 'audit' && (
          <div className="bg-white border border-slate-200/80 rounded-2xl shadow-2xs overflow-hidden">
            <div className="p-4 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900">Security & Administrative Audit Trail</h3>
              <p className="text-xs text-slate-500 font-medium">Chronological record of user accounts, role changes, and security events.</p>
            </div>
            <div className="divide-y divide-slate-100 max-h-[500px] overflow-y-auto">
              {auditLogs.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-xs italic">
                  No administrative events recorded yet.
                </div>
              ) : (
                auditLogs.map((log) => (
                  <div key={log.id} className="p-3.5 px-4 flex items-center justify-between text-xs hover:bg-slate-50/60 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-7 h-7 rounded-lg bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center shrink-0">
                        <History className="w-3.5 h-3.5" />
                      </div>
                      <div>
                        <span className="font-bold text-slate-800 block text-xs">{log.action}</span>
                        <span className="text-[11px] text-slate-500">{log.details}</span>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-[10px] text-slate-400 block font-mono">
                        {formatDisplayDateTime(log.timestamp)}
                      </span>
                      <span className="text-[10px] font-semibold text-slate-600">
                        By: {log.actor}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* User Create/Edit Modal */}
      <UserFormModal
        isOpen={isFormModalOpen}
        onClose={() => {
          setIsFormModalOpen(false);
          setUserToEdit(null);
        }}
        onSubmit={userToEdit ? handleUpdateUser : handleCreateUser}
        userToEdit={userToEdit}
      />

      {/* User Details Modal */}
      <UserDetailsModal
        isOpen={Boolean(selectedUserDetails)}
        onClose={() => setSelectedUserDetails(null)}
        user={selectedUserDetails}
        onEdit={(u) => {
          setUserToEdit(u);
          setIsFormModalOpen(true);
        }}
        onToggleStatus={handleToggleStatus}
        onResetPassword={handleResetPassword}
        onDelete={handleDeleteUser}
      />
    </div>
  );
}
