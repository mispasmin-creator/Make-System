import React from 'react';
import { Check, Clock, AlertTriangle } from 'lucide-react';
import { STAGES } from '../constants/stages';

const WORKFLOW_STEPS = [
  { id: 'introduce', label: 'Introduce System', stage: STAGES.INTRODUCE },
  { id: 'create', label: 'Create System', stage: STAGES.CREATE },
  { id: 'testing', label: 'Testing System', stage: STAGES.TESTING },
  { id: 'mis', label: 'Update MIS', stage: STAGES.UPDATE_MIS },
  { id: 'closed', label: 'Closed', stage: STAGES.CLOSED }
];

export function WorkflowStepTracker({ currentStage, isHold = false, hasRevision = false, activePage = null }) {
  // Dynamically include Revise System step if request has revisions or is currently revising
  const isReviseFlow = hasRevision || currentStage === STAGES.REVISE || activePage === 'revise';

  const steps = isReviseFlow
    ? [
        { id: 'introduce', label: 'Introduce System', stage: STAGES.INTRODUCE },
        { id: 'create', label: 'Create System', stage: STAGES.CREATE },
        { id: 'testing', label: 'Testing System', stage: STAGES.TESTING },
        { id: 'revise', label: 'Revise System', stage: STAGES.REVISE },
        { id: 'mis', label: 'Update MIS', stage: STAGES.UPDATE_MIS },
        { id: 'closed', label: 'Closed', stage: STAGES.CLOSED }
      ]
    : [
        { id: 'introduce', label: 'Introduce System', stage: STAGES.INTRODUCE },
        { id: 'create', label: 'Create System', stage: STAGES.CREATE },
        { id: 'testing', label: 'Testing System', stage: STAGES.TESTING },
        { id: 'mis', label: 'Update MIS', stage: STAGES.UPDATE_MIS },
        { id: 'closed', label: 'Closed', stage: STAGES.CLOSED }
      ];

  // Determine index of current stage
  const getStageIndex = () => {
    switch (currentStage) {
      case STAGES.INTRODUCE:
        return steps.findIndex(s => s.id === 'introduce');
      case STAGES.CREATE:
        return steps.findIndex(s => s.id === 'create');
      case STAGES.TESTING:
        return steps.findIndex(s => s.id === 'testing');
      case STAGES.REVISE:
        return steps.findIndex(s => s.id === 'revise');
      case STAGES.UPDATE_MIS:
        return steps.findIndex(s => s.id === 'mis');
      case STAGES.CLOSED:
        return steps.findIndex(s => s.id === 'closed');
      default:
        return 0;
    }
  };

  const currentIndex = getStageIndex();

  return (
    <div className="w-full py-4 px-5 bg-white border border-slate-100/90 rounded-2xl shadow-[0_4px_16px_-2px_rgba(15,23,42,0.03)]">
      <div className="flex items-center justify-between relative">
        {steps.map((step, idx) => {
          const isDone = idx < currentIndex || currentStage === STAGES.CLOSED;
          const isCurrent = idx === currentIndex && currentStage !== STAGES.CLOSED;
          const isFuture = idx > currentIndex && currentStage !== STAGES.CLOSED;

          // Connective line to next step
          const hasLine = idx < steps.length - 1;
          const isLineDone = idx < currentIndex;

          return (
            <React.Fragment key={step.id}>
              {/* Step Circle & Label */}
              <div className="flex flex-col items-center relative z-10 group">
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                    isDone
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : isCurrent
                      ? isHold
                        ? 'bg-rose-600 text-white ring-4 ring-rose-100 shadow-xs'
                        : 'bg-indigo-600 text-white ring-4 ring-indigo-100 shadow-xs'
                      : 'bg-slate-200 text-slate-500'
                  }`}
                >
                  {isDone ? (
                    <Check className="w-3.5 h-3.5 stroke-[3]" />
                  ) : isCurrent && isHold ? (
                    <AlertTriangle className="w-3.5 h-3.5" />
                  ) : isCurrent ? (
                    <Clock className="w-3.5 h-3.5" />
                  ) : (
                    idx + 1
                  )}
                </div>

                <div className="mt-1.5 text-center">
                  <span
                    className={`block text-[11px] font-semibold whitespace-nowrap ${
                      isCurrent
                        ? isHold
                          ? 'text-rose-700 font-bold'
                          : 'text-indigo-600 font-bold'
                        : isDone
                        ? 'text-slate-800'
                        : 'text-slate-400'
                    }`}
                  >
                    {step.label}
                  </span>
                  {isCurrent && hasRevision && (step.id === 'revise' || step.id === 'create') && (
                    <span className="block text-[10px] text-rose-600 font-mono font-medium">
                      Revision Cycle
                    </span>
                  )}
                </div>
              </div>

              {/* Connecting Line */}
              {hasLine && (
                <div className="flex-1 h-0.5 mx-2 bg-slate-200 relative -top-3">
                  <div
                    className={`h-full transition-all duration-300 ${
                      isLineDone ? 'bg-emerald-500' : 'bg-slate-200'
                    }`}
                  />
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}
