import {
  ClipboardList,
  Handshake,
  Code2,
  Database,
  ShieldCheck,
  LogOut,
  LifeBuoy,
  Wrench,
  FilePlus2,
  ClipboardCheck,
  BadgeCheck
} from 'lucide-react';
import { NAV_ITEMS, REPAIR_NAV_ITEMS } from '../constants/stages';
import { authService } from '../services/authService';

const ICON_MAP = {
  requests: ClipboardList,
  introduce: Handshake,
  create: Code2,
  mis: Database,
  admin: ShieldCheck,
  'repair-system': Wrench
  , 'technical-new': LifeBuoy, 'technical-all': ClipboardList
};

const REPAIR_ICONS = { 'repair-new': FilePlus2, 'repair-system': ClipboardCheck, 'repair-problem': BadgeCheck };

export function Sidebar({
  activePage,
  onSelectPage,
  isCollapsed,
  counts = {},
  isMobileOpen,
  onCloseMobile,
  currentUser,
  onLogout
}) {
  const isAdmin = authService.isAdmin(currentUser);

  // Filter stages based on current user permissions
  const visibleNavItems = NAV_ITEMS.filter((item) =>
    authService.canAccessStage(currentUser, item.id)
  );

  return (
    <>
      {/* Mobile Backdrop */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-slate-500/20 backdrop-blur-[2px] z-40 lg:hidden"
          onClick={onCloseMobile}
        />
      )}

      <aside
        className={`premium-sidebar fixed lg:static top-0 bottom-0 left-0 z-40 bg-white border-r border-slate-100/90 shadow-[1px_0_12px_rgba(15,23,42,0.02)] flex flex-col select-none transition-transform duration-200 ease-out ${
          isCollapsed ? 'w-16' : 'w-64 max-lg:w-72 max-lg:max-w-[85vw]'
        } ${isMobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
        aria-label="Main sidebar navigation"
      >
        {/* Top Logo / Brand area */}
        <div className="premium-sidebar-brand h-16 flex items-center px-4 border-b border-slate-100/80 gap-3 shrink-0">
          <div className="w-9 h-9 rounded-xl bg-white border border-slate-200/90 flex items-center justify-center shadow-xs overflow-hidden shrink-0 p-1">
            <img src="/logo.png" alt="Make System Logo" className="w-full h-full object-contain" />
          </div>
          {!isCollapsed && (
            <div className="leading-tight overflow-hidden">
              <span className="block text-sm font-bold text-slate-800 tracking-tight truncate">Make System</span>
            </div>
          )}
        </div>

        {/* Navigation items */}
        <nav className="p-3 space-y-1.5 flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
          {!isCollapsed && visibleNavItems.some(item => ['requests','introduce','create','mis'].includes(item.id)) && <div className="px-3 pb-1 pt-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">Make System</div>}
          {visibleNavItems.map((item) => {
            if (item.id === 'repair-system') return null;
            if (item.id === 'technical-new' || item.id === 'technical-all') return null;
            const isActive = activePage === item.id;
            const Icon = ICON_MAP[item.id] || ClipboardList;

            let count = 0;
            let isDanger = false;

            if (item.id === 'requests') count = counts.totalRequests || 0;
            else if (item.id === 'introduce') count = counts.introducePending || 0;
            else if (item.id === 'create') count = counts.createPending || 0;
            else if (item.id === 'mis') count = counts.misPending || 0;

            return (
              <button
                key={item.id}
                type="button"
                aria-current={isActive ? 'page' : undefined}
                onClick={() => {
                  onSelectPage(item.id);
                  if (onCloseMobile) onCloseMobile();
                }}
                title={isCollapsed ? item.label : undefined}
                className={`w-full flex items-center justify-between px-3 py-2.5 text-xs rounded-xl border transition-colors duration-150 cursor-pointer ${
                  isActive
                    ? 'bg-indigo-50/90 text-indigo-700 shadow-xs border-indigo-100/90 font-semibold'
                    : 'border-transparent text-slate-600 hover:bg-slate-50/80 hover:text-slate-900 font-semibold'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Icon className={`w-4 h-4 shrink-0 transition-colors ${isActive ? 'text-indigo-600' : 'text-slate-400'}`} />
                  {!isCollapsed && <span className="truncate">{item.label}</span>}
                </div>

                {!isCollapsed && count > 0 && (
                  <span
                    className={`ml-2 px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 transition-colors ${
                      isActive
                        ? 'bg-indigo-100 text-indigo-700'
                        : isDanger
                        ? 'bg-rose-100 text-rose-700 font-bold'
                        : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}

          {visibleNavItems.some(item => item.id.startsWith('technical-')) && <div className="pt-3 mt-2 border-t border-slate-100">
            {!isCollapsed && <div className="px-3 pb-1 text-[10px] font-bold uppercase tracking-wider text-indigo-400">Technical Help</div>}
            {visibleNavItems.filter(item => item.id === 'technical-new' || item.id === 'technical-all').map((item) => {
              const isActive = activePage === item.id;
              const Icon = ICON_MAP[item.id] || ClipboardList;
              return (
                <button key={item.id} type="button" aria-current={isActive ? 'page' : undefined} onClick={() => { onSelectPage(item.id); if (onCloseMobile) onCloseMobile(); }} title={isCollapsed ? item.label : undefined}
                  className={`w-full flex items-center px-3 py-2.5 text-xs rounded-xl border transition-colors duration-150 cursor-pointer ${isActive ? 'bg-indigo-50/90 text-indigo-700 shadow-xs border-indigo-100/90 font-semibold' : 'border-transparent text-slate-600 hover:bg-slate-50/80 hover:text-slate-900 font-semibold'}`}>
                  <div className="flex items-center gap-3 min-w-0"><Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-indigo-600' : 'text-slate-400'}`} />{!isCollapsed && <span className="truncate">{item.label}</span>}</div>
                </button>
              );
            })}
          </div>}

          {REPAIR_NAV_ITEMS.some(item => authService.canAccessStage(currentUser, item.id)) && <div className="pt-3 mt-2 border-t border-slate-100">
            {!isCollapsed && <div className="px-3 pb-1 text-[10px] font-bold uppercase tracking-wider text-indigo-400">System Repair FMS</div>}
            {REPAIR_NAV_ITEMS.filter(item => authService.canAccessStage(currentUser, item.id)).map(item => { const Icon = REPAIR_ICONS[item.id]; return <button key={item.id} type="button" aria-current={activePage === item.id ? 'page' : undefined} title={item.label} onClick={() => { onSelectPage(item.id); onCloseMobile?.(); }} className={`w-full flex items-center gap-3 px-3 py-2.5 text-xs rounded-xl border font-semibold ${activePage === item.id ? 'bg-indigo-50 text-indigo-700 border-indigo-100' : 'border-transparent text-slate-600 hover:bg-slate-50'}`}><Icon className="w-4 h-4 shrink-0" />{!isCollapsed && <span className="truncate">{item.label}</span>}</button>; })}
          </div>}

          {/* Admin Master Navigation Item (Only for Authorized Administrators) */}
          {isAdmin && (
            <div className="pt-2 mt-2 border-t border-slate-100">
              <button
                type="button"
                aria-current={activePage === 'admin' ? 'page' : undefined}
                onClick={() => {
                  onSelectPage('admin');
                  if (onCloseMobile) onCloseMobile();
                }}
                title={isCollapsed ? 'Admin Master' : undefined}
                className={`w-full flex items-center justify-between px-3 py-2.5 text-xs rounded-xl border transition-colors duration-150 cursor-pointer ${
                  activePage === 'admin'
                    ? 'bg-purple-50/90 text-purple-700 shadow-xs border-purple-200/90 font-semibold'
                    : 'border-transparent text-slate-600 hover:bg-purple-50/50 hover:text-purple-900 font-semibold'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <ShieldCheck className={`w-4 h-4 shrink-0 transition-colors ${activePage === 'admin' ? 'text-purple-600' : 'text-slate-400'}`} />
                  {!isCollapsed && <span className="truncate">Admin Master</span>}
                </div>
                {!isCollapsed && (
                  <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-purple-100 text-purple-700 uppercase tracking-wider">
                    Secured
                  </span>
                )}
              </button>
            </div>
          )}
        </nav>

        {/* Sidebar Footer User Info & Logout */}
        <div className="premium-sidebar-footer p-3 border-t border-slate-100/80 bg-slate-50/40 shrink-0">
          {currentUser && (
            <div className={`flex items-center ${isCollapsed ? 'flex-col justify-center' : 'justify-between'} gap-2`}>
              <div title={`${currentUser.fullName || 'User'} (${currentUser.role})`} className={`flex items-center min-w-0 ${isCollapsed ? 'justify-center' : 'gap-2.5 flex-1'}`}>
                <div className="w-8 h-8 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-700 font-bold text-xs flex items-center justify-center shrink-0">
                  {currentUser.fullName ? currentUser.fullName.charAt(0).toUpperCase() : 'U'}
                </div>
                {!isCollapsed && (
                  <div className="leading-tight min-w-0">
                    <span className="block text-xs font-bold text-slate-800 truncate">
                      {currentUser.fullName}
                    </span>
                    <span className="block text-[10px] text-slate-400 font-medium truncate">
                      {currentUser.role} • @{currentUser.username}
                    </span>
                  </div>
                )}
              </div>

              {onLogout && (
                <button
                  type="button"
                  onClick={onLogout}
                  className="shrink-0 p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                  title="Sign out of Make System"
                  aria-label="Logout"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              )}
            </div>
          )}

        </div>
      </aside>
    </>
  );
}
