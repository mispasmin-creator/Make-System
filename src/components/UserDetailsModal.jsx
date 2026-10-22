import React, { useState } from 'react';
import {
  User,
  Mail,
  Shield,
  Key,
  Calendar,
  Building,
  CheckCircle2,
  XCircle,
  Clock,
  Edit2,
  Power,
  Trash2,
  Lock
} from 'lucide-react';
import { Modal } from './Modal';
import { APP_STAGES, USER_ROLES, USER_STATUS } from '../services/authService';
import { formatDisplayDateTime } from '../utils/dateUtils';

export function UserDetailsModal({
  isOpen,
  onClose,
  user,
  onEdit,
  onToggleStatus,
  onResetPassword,
  onDelete
}) {
  const [newPassword, setNewPassword] = useState('');
  const [isResettingPass, setIsResettingPass] = useState(false);
  const [passMessage, setPassMessage] = useState('');

  if (!user) return null;

  const isActive = user.status === USER_STATUS.ACTIVE;
  const isAdmin = user.role === USER_ROLES.ADMIN && !user.technicalOnly;

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    if (!newPassword.trim() || newPassword.trim().length < 4) {
      setPassMessage('Password must be at least 4 characters.');
      return;
    }
    try {
      await onResetPassword(user.id, newPassword.trim());
      setPassMessage('Password reset successfully!');
      setNewPassword('');
      setTimeout(() => {
        setIsResettingPass(false);
        setPassMessage('');
      }, 1500);
    } catch (err) {
      setPassMessage(err.message || 'Failed to reset password');
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="User Profile & Stage Access Details"
      large
      footer={
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-2">
            {user.username !== 'admin' && (
              <button
                type="button"
                onClick={() => onToggleStatus(user.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold border flex items-center gap-1.5 cursor-pointer transition-all ${
                  isActive 
                    ? 'border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700' 
                    : 'border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-emerald-700'
                }`}
              >
                <Power className="w-3.5 h-3.5" />
                <span>{isActive ? 'Deactivate Account' : 'Activate Account'}</span>
              </button>
            )}

            {user.username !== 'admin' && (
              <button
                type="button"
                onClick={() => {
                  if (window.confirm(`Are you sure you want to delete user "${user.username}"?`)) {
                    onDelete(user.id);
                    onClose();
                  }
                }}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold border border-slate-200 bg-white hover:bg-rose-50 text-slate-500 hover:text-rose-600 transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                onClose();
                onEdit(user);
              }}
              className="soft-btn-primary font-semibold text-xs rounded-xl shadow-xs px-4 py-2 flex items-center gap-1.5 cursor-pointer hover:-translate-y-0.5 transition-all"
            >
              <Edit2 className="w-3.5 h-3.5" />
              <span>Edit User & Permissions</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold px-4 py-2 cursor-pointer transition-all"
            >
              Close
            </button>
          </div>
        </div>
      }
    >
      <div className="space-y-5">
        {/* User Hero Banner */}
        <div className="flex items-start justify-between p-4 bg-gradient-to-r from-slate-50 via-indigo-50/30 to-purple-50/30 border border-slate-100 rounded-2xl">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white font-bold text-lg flex items-center justify-center shadow-md shadow-indigo-500/20">
              {user.fullName ? user.fullName.charAt(0).toUpperCase() : 'U'}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900 leading-tight">
                  {user.fullName}
                </h3>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                  isAdmin 
                    ? 'bg-purple-100 text-purple-800 border border-purple-200' 
                    : 'bg-indigo-100 text-indigo-800 border border-indigo-200'
                }`}>
                  {user.role}
                </span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                  isActive
                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                    : 'bg-rose-100 text-rose-800 border border-rose-200'
                }`}>
                  {user.status}
                </span>
              </div>
              <span className="text-xs text-slate-500 font-mono mt-0.5 block">
                @{user.username} {user.employeeId && `• ID: ${user.employeeId}`}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsResettingPass(prev => !prev)}
            className="px-3 py-1.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-semibold rounded-xl flex items-center gap-1.5 shadow-2xs transition-all cursor-pointer"
          >
            <Key className="w-3.5 h-3.5 text-indigo-600" />
            <span>Reset Password</span>
          </button>
        </div>

        {/* Quick Password Reset Box */}
        {isResettingPass && (
          <form onSubmit={handlePasswordSubmit} className="p-3.5 bg-indigo-50/60 border border-indigo-100 rounded-2xl flex items-center gap-3">
            <div className="relative flex-1">
              <Lock className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="password"
                placeholder="Enter new password (min 4 chars)..."
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-white border border-indigo-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-200 shadow-2xs"
              />
            </div>
            <button
              type="submit"
              className="px-3 py-1.5 soft-btn-primary text-xs font-semibold rounded-xl cursor-pointer shadow-xs"
            >
              Update Password
            </button>
            {passMessage && (
              <span className={`text-xs font-medium ${passMessage.includes('success') ? 'text-emerald-600' : 'text-rose-600'}`}>
                {passMessage}
              </span>
            )}
          </form>
        )}

        {/* Account Details Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3.5 bg-slate-50/80 border border-slate-100 rounded-2xl text-xs">
          <div>
            <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-bold">Username</span>
            <span className="font-semibold text-slate-800 truncate block">@{user.username}</span>
          </div>
          <div>
            <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-bold">Department</span>
            <span className="font-semibold text-slate-800 truncate block">{user.department || 'General'}</span>
          </div>
          <div>
            <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-bold">Created Date</span>
            <span className="font-semibold text-slate-800 truncate block">{formatDisplayDateTime(user.createdAt)}</span>
          </div>
          <div>
            <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-bold">Last Activity</span>
            <span className="font-semibold text-slate-800 truncate block">
              {user.lastLoginAt ? formatDisplayDateTime(user.lastLoginAt) : 'Never'}
            </span>
          </div>
        </div>

        {/* Stage-Wise Permissions Breakdown */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Permitted Workflow Stages
            </span>
            <span className="text-[11px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-lg border border-amber-200">
              {isAdmin ? 'Full Admin Access (View & Edit)' : 'Stage-wise View / Update (User editing: Admin only)'}
            </span>
          </div>

          <div className="border border-slate-200/80 rounded-2xl overflow-hidden shadow-2xs bg-white">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50/90 text-slate-600 font-bold uppercase tracking-wider text-[10px] border-b border-slate-100">
                <tr>
                  <th className="py-2.5 px-3.5">Stage</th>
                  <th className="py-2.5 px-3 text-center w-36">View Access</th>
                  <th className="py-2.5 px-3 text-center w-36">Update / Submit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {APP_STAGES.map((stg) => {
                  const perm = user.permissions?.[stg.id] || { view: false };
                  const canView = isAdmin || Boolean(perm.view);

                  return (
                    <tr key={stg.id} className="hover:bg-slate-50/50">
                      <td className="py-2.5 px-3.5">
                        <span className="font-semibold text-slate-800 block text-xs">{stg.label}</span>
                        <span className="text-[10px] text-slate-400">{stg.description}</span>
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        {canView ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-lg border border-emerald-100">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            <span>Allowed</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-400 bg-slate-50 px-2.5 py-0.5 rounded-lg border border-slate-100">
                            <XCircle className="w-3 h-3 text-slate-400" />
                            <span>Denied</span>
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        {isAdmin ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-purple-700 bg-purple-50 px-2.5 py-0.5 rounded-lg border border-purple-100">
                            <CheckCircle2 className="w-3 h-3 text-purple-600" />
                            <span>Full Admin Access</span>
                          </span>
                        ) : (
                          <span className="text-[11px] font-medium text-slate-400 bg-slate-50 px-2.5 py-0.5 rounded-lg border border-slate-200/60">
                            {perm.update ? 'Update Allowed' : 'View Only'}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </Modal>
  );
}
