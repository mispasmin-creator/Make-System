import { useState } from 'react';
import {
  Check,
  AlertCircle
} from 'lucide-react';
import { Modal } from './Modal';
import {
  APP_STAGES,
  SYSTEMS,
  USER_ROLES,
  USER_STATUS,
  getFullAdminPermissions
} from '../services/authService';

export function UserFormModal({
  isOpen,
  onClose,
  onSubmit,
  userToEdit = null
}) {
  const isEditing = Boolean(userToEdit);

  const [formData, setFormData] = useState({
    fullName: userToEdit?.fullName || '',
    username: userToEdit?.username || '',
    employeeId: userToEdit?.employeeId || '',
    department: userToEdit?.department || '',
    role: userToEdit?.role || USER_ROLES.USER,
    status: userToEdit?.status || USER_STATUS.ACTIVE,
    password: ''
  });

  const [permissions, setPermissions] = useState(() => userToEdit?.permissions || {});
  const [systemAccess, setSystemAccess] = useState(() => Object.fromEntries(SYSTEMS.map(system => [system.id, userToEdit?.systemAccess?.[system.id] ?? system.stages.some(id => userToEdit?.permissions?.[id]?.view)])));
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);


  // When Role changes to Admin, automatically check all permissions
  const handleRoleChange = (newRole) => {
    setFormData(prev => ({ ...prev, role: newRole }));
    if (newRole === USER_ROLES.ADMIN) {
      setPermissions(getFullAdminPermissions());
    }
  };

  // Toggle stage view access checkbox
  const handleToggleStageAccess = (stageId) => {
    if (formData.role === USER_ROLES.ADMIN) return; // Admins always have full access

    setPermissions(prev => {
      const current = prev[stageId]?.view || false;
      return {
        ...prev,
        [stageId]: {
          view: !current,
          update: false,
          edit: false,
          approve: false
        }
      };
    });
  };

  // Preset Shortcuts
  const applyPreset = (presetType) => {
    if (formData.role === USER_ROLES.ADMIN) return;

    const newPerms = {};
    APP_STAGES.forEach(s => {
      newPerms[s.id] = {
        view: presetType === 'all',
        edit: false,
        approve: false
      };
    });

    setPermissions(newPerms);
    setSystemAccess(Object.fromEntries(SYSTEMS.map(system => [system.id, presetType === 'all'])));
  };

  const validate = () => {
    const errs = {};
    if (!formData.fullName.trim()) errs.fullName = 'Full Name is required';
    if (!formData.username.trim()) errs.username = 'Username is required';
    if (!isEditing && !formData.password.trim()) {
      errs.password = 'Password is required for new accounts';
    } else if (formData.password && formData.password.trim().length < 4) {
      errs.password = 'Password must be at least 4 characters';
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setIsSubmitting(true);
    try {
      const cleanUsername = formData.username.trim().toLowerCase();
      const isAdminRole = formData.role === USER_ROLES.ADMIN;

      // Construct permissions: non-admins only receive view access; edit/approve is admin only
      const finalPerms = {};
      APP_STAGES.forEach(s => {
        const enabled = isAdminRole || systemAccess[SYSTEMS.find(system => system.stages.includes(s.id)).id];
        finalPerms[s.id] = {
          view: Boolean(enabled && (isAdminRole || permissions[s.id]?.view)),
          update: Boolean(enabled && (isAdminRole || (permissions[s.id]?.view && permissions[s.id]?.update))),
          edit: isAdminRole,
          approve: isAdminRole
        };
      });

      const payload = {
        fullName: formData.fullName.trim(),
        username: cleanUsername,
        email: `${cleanUsername}@company.local`,
        employeeId: formData.employeeId.trim(),
        department: formData.department.trim(),
        role: formData.role,
        status: formData.status,
        permissions: isAdminRole ? getFullAdminPermissions() : finalPerms,
        systemAccess: Object.fromEntries(SYSTEMS.map(system => [system.id, isAdminRole || Boolean(systemAccess[system.id])])),
        permittedStagesText: isAdminRole ? 'All Stages (Admin Full Access)' : `Stages: ${APP_STAGES.filter(stage => finalPerms[stage.id]?.view).map(stage => stage.label).join(', ') || 'None'}`
      };

      if (formData.password?.trim()) {
        payload.password = formData.password.trim();
      }

      await onSubmit(payload);
      onClose();
    } catch (err) {
      setErrors({ form: err.message || 'Failed to save user' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Count active stages
  const activeStagesCount = Object.keys(permissions).filter(k => permissions[k]?.view).length;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? `Edit User: ${userToEdit.fullName}` : 'Create User'}
      large
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className="bg-slate-100 hover:bg-slate-200/80 text-slate-700 rounded-xl text-xs font-semibold px-4 py-2 cursor-pointer transition-all"
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="soft-btn-primary font-semibold text-xs rounded-xl shadow-xs px-5 py-2 inline-flex items-center gap-2 cursor-pointer disabled:opacity-50 transition-all hover:-translate-y-0.5"
          >
            {isSubmitting ? (
              <>
                <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Saving User...</span>
              </>
            ) : (
              <>
                <Check className="w-4 h-4" />
                <span>{isEditing ? 'Save Changes' : 'Create User'}</span>
              </>
            )}
          </button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {errors.form && (
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs font-semibold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errors.form}</span>
          </div>
        )}

        {/* User Details Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5" htmlFor="fieldFullName">
              Full Name <span className="text-rose-500">*</span>
            </label>
            <input
              id="fieldFullName"
              type="text"
              placeholder="e.g. Ramesh Chandra"
              value={formData.fullName}
              onChange={(e) => setFormData(prev => ({ ...prev, fullName: e.target.value }))}
              className={`w-full px-3.5 py-2.5 bg-white border rounded-xl text-slate-800 text-sm placeholder-slate-400 focus:outline-none focus:ring-4 focus:ring-indigo-100/60 focus:border-indigo-400 transition-all shadow-2xs ${
                errors.fullName ? 'border-rose-400 ring-2 ring-rose-100' : 'border-slate-200/80 hover:border-slate-300'
              }`}
            />
            {errors.fullName && <span className="text-[11px] text-rose-600 font-medium mt-1 block">{errors.fullName}</span>}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5" htmlFor="fieldUsername">
              Username <span className="text-rose-500">*</span>
            </label>
            <input
              id="fieldUsername"
              type="text"
              placeholder="e.g. ramesh"
              value={formData.username}
              onChange={(e) => setFormData(prev => ({ ...prev, username: e.target.value }))}
              className={`w-full px-3.5 py-2.5 bg-white border rounded-xl text-slate-800 text-sm placeholder-slate-400 focus:outline-none focus:ring-4 focus:ring-indigo-100/60 focus:border-indigo-400 transition-all shadow-2xs ${
                errors.username ? 'border-rose-400 ring-2 ring-rose-100' : 'border-slate-200/80 hover:border-slate-300'
              }`}
            />
            {errors.username && <span className="text-[11px] text-rose-600 font-medium mt-1 block">{errors.username}</span>}
          </div>
        </div>

        {/* Password & Department */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5" htmlFor="fieldPassword">
              {isEditing ? 'New Password (leave blank to keep current)' : 'Password'} {!isEditing && <span className="text-rose-500">*</span>}
            </label>
            <input
              id="fieldPassword"
              type="password"
              placeholder={isEditing ? '••••••••' : 'Set account password...'}
              value={formData.password}
              onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
              className={`w-full px-3.5 py-2.5 bg-white border rounded-xl text-slate-800 text-sm placeholder-slate-400 focus:outline-none focus:ring-4 focus:ring-indigo-100/60 focus:border-indigo-400 transition-all shadow-2xs ${
                errors.password ? 'border-rose-400 ring-2 ring-rose-100' : 'border-slate-200/80 hover:border-slate-300'
              }`}
            />
            {errors.password && <span className="text-[11px] text-rose-600 font-medium mt-1 block">{errors.password}</span>}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5" htmlFor="fieldDept">
              Department
            </label>
            <input
              id="fieldDept"
              type="text"
              placeholder="e.g. Engineering / Quality"
              value={formData.department}
              onChange={(e) => setFormData(prev => ({ ...prev, department: e.target.value }))}
              className="w-full px-3.5 py-2.5 bg-white border border-slate-200/80 hover:border-slate-300 rounded-xl text-slate-800 text-sm placeholder-slate-400 focus:outline-none focus:ring-4 focus:ring-indigo-100/60 focus:border-indigo-400 transition-all shadow-2xs"
            />
          </div>
        </div>

        {/* Role & Status */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Role
            </label>
            <select
              value={formData.role}
              onChange={(e) => handleRoleChange(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-white border border-slate-200/80 hover:border-slate-300 rounded-xl text-slate-800 text-sm focus:outline-none focus:ring-4 focus:ring-indigo-100/60 focus:border-indigo-400 transition-all shadow-2xs cursor-pointer font-semibold"
            >
              <option value={USER_ROLES.USER}>User</option>
              <option value={USER_ROLES.ADMIN}>Admin</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Account Status
            </label>
            <select
              value={formData.status}
              onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value }))}
              className="w-full px-3.5 py-2.5 bg-white border border-slate-200/80 hover:border-slate-300 rounded-xl text-slate-800 text-sm focus:outline-none focus:ring-4 focus:ring-indigo-100/60 focus:border-indigo-400 transition-all shadow-2xs cursor-pointer font-semibold"
            >
              <option value={USER_STATUS.ACTIVE}>Active</option>
              <option value={USER_STATUS.INACTIVE}>Inactive</option>
            </select>
          </div>
        </div>

        {/* Section: Stage-Wise Permissions */}
        <div className="pt-3 border-t border-slate-100">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="block text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Permissions ({activeStagesCount}/{APP_STAGES.length})
                </span>
              </div>
            </div>

            {formData.role !== USER_ROLES.ADMIN && (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => applyPreset('all')}
                  className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-semibold rounded-lg transition-colors cursor-pointer"
                >
                  Select All Views
                </button>
                <button
                  type="button"
                  onClick={() => applyPreset('clear')}
                  className="px-2.5 py-1 bg-slate-100 hover:bg-rose-50 text-slate-500 hover:text-rose-600 text-[10px] font-semibold rounded-lg transition-colors cursor-pointer"
                >
                  Clear All
                </button>
              </div>
            )}
          </div>

          {/* Permissions Table Matrix */}
          <div className="mb-4 grid gap-3 sm:grid-cols-3">
            {SYSTEMS.map(system => <label key={system.id} className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs font-semibold text-slate-700"><input type="checkbox" aria-label={`${system.label} system access`} disabled={formData.role === USER_ROLES.ADMIN} checked={formData.role === USER_ROLES.ADMIN || Boolean(systemAccess[system.id])} onChange={e => { const enabled = e.target.checked; setSystemAccess(prev => ({ ...prev, [system.id]: enabled })); if (!enabled) setPermissions(prev => ({ ...prev, ...Object.fromEntries(system.stages.map(id => [id, { view:false, update:false, edit:false, approve:false }])) })); }} />{system.label}</label>)}
          </div>
          <div className="border border-slate-200/80 rounded-2xl overflow-hidden shadow-2xs bg-white">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50/90 text-slate-600 font-bold uppercase tracking-wider text-[10px] border-b border-slate-100">
                <tr>
                  <th className="py-2.5 px-3.5">Stage</th>
                  <th className="py-2.5 px-3 text-center w-36">View</th>
                  <th className="py-2.5 px-3 text-center w-32">Update / Submit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {APP_STAGES.filter(stage => formData.role === USER_ROLES.ADMIN || systemAccess[SYSTEMS.find(system => system.stages.includes(stage.id)).id]).map((stg) => {
                  const perm = permissions[stg.id] || { view: false };
                  const isAdminRole = formData.role === USER_ROLES.ADMIN;
                  const isChecked = isAdminRole || Boolean(perm.view);

                  return (
                    <tr key={stg.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-2.5 px-3.5">
                        <span className="font-semibold text-slate-800 block text-xs">{stg.label}</span>
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <label className="inline-flex items-center justify-center cursor-pointer p-1">
                          <input
                            type="checkbox"
                            disabled={isAdminRole}
                            checked={isChecked}
                            onChange={() => handleToggleStageAccess(stg.id)}
                            className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 cursor-pointer disabled:opacity-70"
                          />
                        </label>
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        {isAdminRole ? (
                          <span className="text-[10px] font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-200">
                            Admin Full Access
                          </span>
                        ) : (
                          <input type="checkbox" aria-label={`${stg.label} update access`} disabled={!perm.view} checked={Boolean(perm.view && perm.update)} onChange={e => setPermissions(prev => ({ ...prev, [stg.id]: { ...prev[stg.id], update:e.target.checked, edit:false, approve:e.target.checked } }))} className="w-4 h-4 rounded border-slate-300 text-indigo-600 disabled:opacity-40" />
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </form>
    </Modal>
  );
}
