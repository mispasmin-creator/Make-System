import React from 'react';
import { calculateDueStatus } from '../utils/dateUtils';
import { WORK_STATUS } from '../constants/stages';
import {
  Clock,
  AlertTriangle,
  CheckCircle2,
  PauseCircle,
  PlayCircle,
  RefreshCw,
  AlertCircle
} from 'lucide-react';

/**
 * StatusBadge component following the exact design system:
 * bg-X-50 text-X-700 border border-X-200 pill combo:
 * - emerald = success / completed / approved / done
 * - amber = pending / warning / awaiting action
 * - rose = error / rejected / danger / on hold / overdue
 * - teal = secondary workflow actions
 * - indigo = primary actions / links / active states
 */
export function StatusBadge({ type, value, label, subtext, targetDate, holdExtendTargetDate, upgradeTargetDate }) {
  // Due Date status
  if (type === 'due') {
    const effectiveDate = upgradeTargetDate || holdExtendTargetDate || targetDate;
    const dueInfo = calculateDueStatus(effectiveDate);
    if (!dueInfo.label) return null;

    let titleText = `Target Date: ${effectiveDate || ''}`;
    if (upgradeTargetDate && targetDate && upgradeTargetDate !== targetDate) {
      titleText = `Original: ${targetDate} | Upgrade Target Date: ${upgradeTargetDate}`;
    } else if (holdExtendTargetDate && targetDate && holdExtendTargetDate !== targetDate) {
      titleText = `Original: ${targetDate} | Extended (Hold): ${holdExtendTargetDate}`;
    }

    if (dueInfo.type === 'overdue') {
      return (
        <span
          className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg text-[11px] font-semibold bg-rose-50/90 text-rose-700 border border-rose-200/70 shadow-2xs"
          title={titleText}
        >
          <AlertTriangle className="w-3 h-3 text-rose-600 shrink-0" />
          <span>{dueInfo.label}</span>
        </span>
      );
    }

    if (dueInfo.type === 'due_today') {
      return (
        <span
          className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg text-[11px] font-semibold bg-rose-50/90 text-rose-700 border border-rose-200/70 font-bold shadow-2xs"
          title={titleText}
        >
          <Clock className="w-3 h-3 text-rose-600 shrink-0" />
          <span>Due Today</span>
        </span>
      );
    }

    if (dueInfo.type === 'due_soon_urgent' || dueInfo.type === 'due_soon') {
      return (
        <span
          className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg text-[11px] font-semibold bg-amber-50/90 text-amber-700 border border-amber-200/70 font-semibold shadow-2xs"
          title={titleText}
        >
          <Clock className="w-3 h-3 text-amber-600 shrink-0" />
          <span>{dueInfo.label}</span>
        </span>
      );
    }

    return (
      <span
        className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg text-[11px] font-medium bg-slate-50/90 text-slate-600 border border-slate-200/70 shadow-2xs"
        title={titleText}
      >
        <Clock className="w-3 h-3 text-slate-400 shrink-0" />
        <span>{dueInfo.label}</span>
      </span>
    );
  }

  // Work Status (In Progress, On Hold, Completed)
  if (type === 'workStatus') {
    if (value === WORK_STATUS.ON_HOLD) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg text-[11px] font-bold bg-rose-50/90 text-rose-700 border border-rose-200/70 shadow-2xs">
          <PauseCircle className="w-3 h-3 text-rose-600 shrink-0" />
          <span>On Hold</span>
        </span>
      );
    }
    if (value === WORK_STATUS.COMPLETED) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg text-[11px] font-semibold bg-emerald-50/90 text-emerald-700 border border-emerald-200/70 shadow-2xs">
          <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
          <span>Completed</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg text-[11px] font-semibold bg-indigo-50/90 text-indigo-700 border border-indigo-200/70 shadow-2xs">
        <PlayCircle className="w-3 h-3 text-indigo-600 shrink-0" />
        <span>In Progress</span>
      </span>
    );
  }

  // Revision Code Pill
  if (type === 'revision') {
    if (!value) return null;
    const match = String(value).match(/REV-?(\d+)/i);
    const displayLabel = match ? `REV-${String(match[1]).padStart(2, '0')}` : value;
    return (
      <span
        className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg font-mono text-[11px] font-bold bg-indigo-50/90 text-indigo-700 border border-indigo-200/70 shadow-2xs"
        title={value}
      >
        <RefreshCw className="w-2.5 h-2.5 text-indigo-600 shrink-0" />
        <span>{displayLabel}</span>
      </span>
    );
  }

  // Revise System badge (returned from QA)
  if (type === 'reviseNotice') {
    return (
      <span
        className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg text-[11px] font-bold bg-rose-50/90 text-rose-700 border border-rose-200/70 shadow-2xs"
        title="Returned from testing for revision"
      >
        <AlertCircle className="w-3 h-3 text-rose-600 shrink-0" />
        <span>Revise System</span>
      </span>
    );
  }

  // Generic / Lifecycle Stage badge
  const str = String(value || label || '').toLowerCase();

  let colorClasses = 'bg-slate-50/90 text-slate-700 border-slate-200/70 shadow-2xs';
  let IconComponent = Clock;

  if (str.includes('hold') || str.includes('reject') || str.includes('danger')) {
    colorClasses = 'bg-rose-50/90 text-rose-700 border-rose-200/70 font-bold shadow-2xs';
    IconComponent = AlertTriangle;
  } else if (str.includes('closed') || str.includes('approved') || str.includes('completed') || str.includes('done')) {
    colorClasses = 'bg-emerald-50/90 text-emerald-700 border-emerald-200/70 font-semibold shadow-2xs';
    IconComponent = CheckCircle2;
  } else if (str.includes('pending') || str.includes('awaiting') || str.includes('soon')) {
    colorClasses = 'bg-amber-50/90 text-amber-700 border-amber-200/70 font-semibold shadow-2xs';
    IconComponent = Clock;
  } else if (str.includes('progress') || str.includes('create') || str.includes('introduce')) {
    colorClasses = 'bg-indigo-50/90 text-indigo-700 border-indigo-200/70 font-semibold shadow-2xs';
    IconComponent = PlayCircle;
  }

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg text-[11px] border ${colorClasses}`}>
      <IconComponent className="w-3 h-3 shrink-0 opacity-80" />
      <span>{label || value}</span>
      {subtext && <span className="opacity-75 font-normal ml-0.5">({subtext})</span>}
    </span>
  );
}
