import React from 'react';
import {
  Layers,
  LifeBuoy,
  Wrench,
  BarChart3,
  Menu
} from 'lucide-react';
import { authService } from '../services/authService';

export function MobileBottomDock({
  activePage,
  onSelectPage,
  onOpenSidebar,
  currentUser
}) {
  const isMake = ['requests', 'introduce', 'create', 'mis'].includes(activePage);
  const isTech = ['technical-new', 'technical-all'].includes(activePage);
  const isRepair = activePage.startsWith('repair');
  const isDash = activePage === 'dashboard';

  const canMake = authService.canAccessStage(currentUser, 'requests');
  const canTech = authService.canAccessStage(currentUser, 'technical-all') || authService.canAccessStage(currentUser, 'technical-new');
  const canRepair = authService.canAccessStage(currentUser, 'repair-approval') || authService.canAccessStage(currentUser, 'repair-work') || authService.canAccessStage(currentUser, 'repair-new');
  const canDash = authService.canAccessStage(currentUser, 'dashboard');

  return (
    <div className="lg:hidden fixed bottom-3 left-3 right-3 z-40 max-w-md mx-auto pointer-events-none select-none">
      <nav
        aria-label="Mobile Navigation Dock"
        className="pointer-events-auto backdrop-blur-xl bg-white/95 border border-slate-200/80 rounded-3xl p-1.5 shadow-[0_12px_36px_rgba(15,23,42,0.14),0_2px_8px_rgba(15,23,42,0.06)] flex items-center justify-around gap-1"
      >
        {/* Make System Tab */}
        {canMake && (
          <button
            type="button"
            onClick={() => onSelectPage('requests')}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-2xl text-xs font-bold transition-all duration-200 cursor-pointer ${
              isMake
                ? 'bg-gradient-to-r from-indigo-600 to-indigo-700 text-white shadow-md shadow-indigo-500/30'
                : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100/70'
            }`}
          >
            <Layers className="w-4 h-4 shrink-0" />
            {isMake && <span>Make</span>}
          </button>
        )}

        {/* Technical Help Tab */}
        {canTech && (
          <button
            type="button"
            onClick={() => onSelectPage('technical-all')}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-2xl text-xs font-bold transition-all duration-200 cursor-pointer ${
              isTech
                ? 'bg-gradient-to-r from-indigo-600 to-indigo-700 text-white shadow-md shadow-indigo-500/30'
                : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100/70'
            }`}
          >
            <LifeBuoy className="w-4 h-4 shrink-0" />
            {isTech && <span>Tech</span>}
          </button>
        )}

        {/* Repair System Tab */}
        {canRepair && (
          <button
            type="button"
            onClick={() => onSelectPage('repair-system')}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-2xl text-xs font-bold transition-all duration-200 cursor-pointer ${
              isRepair
                ? 'bg-gradient-to-r from-indigo-600 to-indigo-700 text-white shadow-md shadow-indigo-500/30'
                : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100/70'
            }`}
          >
            <Wrench className="w-4 h-4 shrink-0" />
            {isRepair && <span>Repair</span>}
          </button>
        )}

        {/* Dashboard Tab */}
        {canDash && (
          <button
            type="button"
            onClick={() => onSelectPage('dashboard')}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-2xl text-xs font-bold transition-all duration-200 cursor-pointer ${
              isDash
                ? 'bg-gradient-to-r from-indigo-600 to-indigo-700 text-white shadow-md shadow-indigo-500/30'
                : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100/70'
            }`}
          >
            <BarChart3 className="w-4 h-4 shrink-0" />
            {isDash && <span>Dash</span>}
          </button>
        )}

        {/* Sidebar / More Drawer Button */}
        <button
          type="button"
          onClick={onOpenSidebar}
          className="flex items-center justify-center p-2 rounded-2xl text-slate-500 hover:text-slate-800 hover:bg-slate-100/70 transition-all cursor-pointer"
          title="Open Menu"
          aria-label="Open Menu"
        >
          <Menu className="w-4 h-4" />
        </button>
      </nav>
    </div>
  );
}
