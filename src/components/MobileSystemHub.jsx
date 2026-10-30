import React, { useState } from 'react';
import {
  Layers,
  LifeBuoy,
  Wrench,
  Plus,
  ChevronDown,
  ChevronUp,
  Sparkles,
  ClipboardList,
  Handshake,
  Code2,
  Database,
  BarChart3,
  FilePlus2,
  ClipboardCheck,
  BadgeCheck
} from 'lucide-react';
import { authService } from '../services/authService';

export function MobileSystemHub({
  activePage,
  onSelectPage,
  counts = {},
  onOpenNewRequest,
  currentUser
}) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Identify which of the 3 systems is active
  const isMake = ['requests', 'introduce', 'create', 'mis'].includes(activePage);
  const isTech = ['technical-new', 'technical-all'].includes(activePage);
  const isRepair = activePage.startsWith('repair');
  const isDash = activePage === 'dashboard';

  let currentSystemName = 'Make System';
  let currentSystemSubtitle = 'Development & Request Lifecycle';
  let currentSystemBadge = 'Make Hub';

  if (isTech) {
    currentSystemName = 'Technical Help';
    currentSystemSubtitle = 'Support Tickets & Resolution';
    currentSystemBadge = 'Tech Desk';
  } else if (isRepair) {
    currentSystemName = 'Repair System';
    currentSystemSubtitle = 'Equipment & Problem FMS';
    currentSystemBadge = 'Repair FMS';
  } else if (isDash) {
    currentSystemName = 'DME Dashboard';
    currentSystemSubtitle = 'Executive KPIs & System Metrics';
    currentSystemBadge = 'Overview';
  }

  // Quick action "+ New" handler
  const handleQuickNew = () => {
    if (isTech) {
      onSelectPage('technical-new');
    } else if (isRepair) {
      onSelectPage('repair-new');
    } else {
      if (onOpenNewRequest) {
        onOpenNewRequest();
      } else {
        onSelectPage('requests');
      }
    }
  };

  // Stage options for the active system
  const makeStages = [
    { id: 'requests', label: 'Requests', count: counts.totalRequests, icon: ClipboardList },
    { id: 'introduce', label: 'Introduce', count: counts.introducePending, icon: Handshake },
    { id: 'create', label: 'Create Dev', count: counts.createPending, icon: Code2 },
    { id: 'mis', label: 'Update MIS', count: counts.misPending, icon: Database }
  ].filter(s => authService.canAccessStage(currentUser, s.id));

  const techStages = [
    { id: 'technical-all', label: 'All Tickets', icon: ClipboardList },
    { id: 'technical-new', label: '+ Raise Ticket', icon: Plus }
  ].filter(s => authService.canAccessStage(currentUser, s.id));

  const repairStages = [
    { id: 'repair-system', label: 'Approval', icon: ClipboardCheck },
    { id: 'repair-problem', label: 'Resolve', icon: BadgeCheck },
    { id: 'repair-new', label: '+ Log Issue', icon: FilePlus2 }
  ].filter(s => authService.canAccessStage(currentUser, s.id));

  const activeStages = isTech ? techStages : isRepair ? repairStages : isMake ? makeStages : [];

  return (
    <div className="lg:hidden px-3 pt-2.5 pb-1 space-y-2.5 shrink-0 select-none">
      {/* 1. Hero 3-System Gradient Card (Reference Style) */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-700 via-indigo-600 to-blue-600 p-4 text-white shadow-[0_12px_28px_-6px_rgba(79,70,229,0.35)] border border-indigo-400/20">
        {/* Soft Background Radial Glow */}
        <div className="absolute -right-12 -top-12 w-40 h-40 rounded-full bg-blue-400/20 blur-2xl pointer-events-none" />
        <div className="absolute -left-12 -bottom-12 w-40 h-40 rounded-full bg-indigo-900/30 blur-2xl pointer-events-none" />

        {/* Card Header: System Title & Collapse Chevron */}
        <div className="relative flex items-center justify-between gap-2 pb-3 border-b border-white/10">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-white/20 backdrop-blur-xs text-white">
                {currentSystemBadge}
              </span>
              <span className="text-xs text-indigo-100/90 truncate">{currentSystemSubtitle}</span>
            </div>
            <h2 className="text-lg font-extrabold tracking-tight text-white mt-0.5 truncate">
              {currentSystemName}
            </h2>
          </div>

          <button
            type="button"
            onClick={() => setIsCollapsed(prev => !prev)}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 active:bg-white/30 flex items-center justify-center transition-colors cursor-pointer shrink-0"
            title={isCollapsed ? 'Expand system switcher' : 'Collapse system switcher'}
            aria-label="Toggle system hub"
          >
            {isCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </button>
        </div>

        {/* 4 Action Circles (Make, Tech, Repair, + New) - Styled like Reference Scan/Pay/Bank/Recharge */}
        {!isCollapsed && (
          <div className="relative pt-3.5 grid grid-cols-4 gap-2">
            {/* Make System Button */}
            <button
              type="button"
              onClick={() => onSelectPage('requests')}
              className="flex flex-col items-center gap-1.5 group cursor-pointer transition-transform active:scale-95"
            >
              <div
                className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${
                  isMake
                    ? 'bg-white text-indigo-700 shadow-md shadow-black/20 ring-2 ring-white/80'
                    : 'bg-white/15 text-white hover:bg-white/25 backdrop-blur-xs border border-white/20'
                }`}
              >
                <Layers className="w-5 h-5" />
              </div>
              <span className={`text-[11px] font-semibold tracking-tight ${isMake ? 'text-white font-bold' : 'text-indigo-100'}`}>
                Make
              </span>
            </button>

            {/* Technical Help Button */}
            <button
              type="button"
              onClick={() => onSelectPage('technical-all')}
              className="flex flex-col items-center gap-1.5 group cursor-pointer transition-transform active:scale-95"
            >
              <div
                className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${
                  isTech
                    ? 'bg-white text-indigo-700 shadow-md shadow-black/20 ring-2 ring-white/80'
                    : 'bg-white/15 text-white hover:bg-white/25 backdrop-blur-xs border border-white/20'
                }`}
              >
                <LifeBuoy className="w-5 h-5" />
              </div>
              <span className={`text-[11px] font-semibold tracking-tight ${isTech ? 'text-white font-bold' : 'text-indigo-100'}`}>
                Technical
              </span>
            </button>

            {/* Repair System Button */}
            <button
              type="button"
              onClick={() => onSelectPage('repair-system')}
              className="flex flex-col items-center gap-1.5 group cursor-pointer transition-transform active:scale-95"
            >
              <div
                className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${
                  isRepair
                    ? 'bg-white text-indigo-700 shadow-md shadow-black/20 ring-2 ring-white/80'
                    : 'bg-white/15 text-white hover:bg-white/25 backdrop-blur-xs border border-white/20'
                }`}
              >
                <Wrench className="w-5 h-5" />
              </div>
              <span className={`text-[11px] font-semibold tracking-tight ${isRepair ? 'text-white font-bold' : 'text-indigo-100'}`}>
                Repair
              </span>
            </button>

            {/* Quick Create Action Button */}
            <button
              type="button"
              onClick={handleQuickNew}
              className="flex flex-col items-center gap-1.5 group cursor-pointer transition-transform active:scale-95"
            >
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/90 hover:bg-emerald-400 text-white flex items-center justify-center shadow-md shadow-emerald-950/20 border border-emerald-300/30">
                <Plus className="w-5 h-5 stroke-[2.5]" />
              </div>
              <span className="text-[11px] font-semibold tracking-tight text-emerald-100">
                + New
              </span>
            </button>
          </div>
        )}
      </div>

      {/* 2. Horizontal Stage Selector Pills (Reference "Peoples" Category Row Style) */}
      {activeStages.length > 0 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar select-none">
          {activeStages.map((stage) => {
            const isActive = activePage === stage.id;
            const Icon = stage.icon;

            return (
              <button
                key={stage.id}
                type="button"
                onClick={() => onSelectPage(stage.id)}
                className={`px-3.5 py-2 rounded-2xl text-xs font-semibold whitespace-nowrap flex items-center gap-2 transition-all cursor-pointer shrink-0 ${
                  isActive
                    ? 'bg-gradient-to-r from-indigo-600 to-indigo-700 text-white shadow-md shadow-indigo-300/40 font-bold active:scale-95'
                    : 'bg-white text-slate-700 border border-slate-200/80 hover:bg-slate-50 hover:border-indigo-200 shadow-2xs'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                <span>{stage.label}</span>
                {typeof stage.count === 'number' && (
                  <span
                    className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                      isActive ? 'bg-white/25 text-white' : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {stage.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
