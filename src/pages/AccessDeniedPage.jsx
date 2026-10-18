import React from 'react';
import { ShieldAlert, ArrowLeft, Lock } from 'lucide-react';

export function AccessDeniedPage({ stageName, onNavigateAllowed }) {
  return (
    <div className="flex-1 flex items-center justify-center p-6 bg-[#f6f8fb]">
      <div className="max-w-md w-full bg-white/95 backdrop-blur-xl border border-slate-100 rounded-3xl p-8 text-center shadow-[0_20px_50px_rgba(15,23,42,0.06)] relative overflow-hidden">
        {/* Soft Decorative Glow */}
        <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600 shadow-xs">
          <ShieldAlert className="w-8 h-8" />
        </div>

        <h2 className="text-xl font-extrabold text-slate-800 tracking-tight mb-2">
          Access Restricted
        </h2>

        <p className="text-xs text-slate-500 leading-relaxed mb-6 font-medium">
          You do not have permission to view or manage the <strong className="text-slate-800 font-semibold">{stageName || 'requested module'}</strong>.
          Stage access is controlled by system administrators.
        </p>

        <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl text-left text-xs mb-6 text-slate-600 space-y-1">
          <div className="flex items-center gap-1.5 font-semibold text-slate-700">
            <Lock className="w-3.5 h-3.5 text-slate-400" />
            <span>Stage-Wise Security Policy</span>
          </div>
          <p className="text-[11px] text-slate-500">
            If you need access to this stage for your responsibilities, please request an administrator to grant stage permissions in Admin Master.
          </p>
        </div>

        {onNavigateAllowed && (
          <button
            type="button"
            onClick={onNavigateAllowed}
            className="w-full py-2.5 px-4 rounded-xl soft-btn-primary font-bold text-xs shadow-xs flex items-center justify-center gap-2 cursor-pointer transition-all hover:-translate-y-0.5"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Go to My Permitted Stages</span>
          </button>
        )}
      </div>
    </div>
  );
}
