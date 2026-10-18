/**
 * Date and Time utilities for Make System (Asia/Kolkata timezone)
 */

export const TIMEZONE = 'Asia/Kolkata';

/**
 * Returns current ISO date string formatted for Asia/Kolkata
 */
export function getNowKolkataISO() {
  return new Date().toISOString();
}

/**
 * Formats a Date or ISO string in Asia/Kolkata as YYYY-MM-DD
 */
export function formatToKolkataDateString(dateInput = new Date()) {
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return '';
  
  // Format into Asia/Kolkata parts
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  return formatter.format(d); // YYYY-MM-DD
}

/**
 * Formats a date for human display (e.g., "16 Oct 2026")
 */
export function formatDisplayDate(dateInput) {
  if (!dateInput) return '-';
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return String(dateInput);

  return new Intl.DateTimeFormat('en-IN', {
    timeZone: TIMEZONE,
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  }).format(d);
}

/**
 * Formats a timestamp with time (e.g., "16 Oct 2026, 02:45 PM")
 */
export function formatDisplayDateTime(dateInput) {
  if (!dateInput) return '-';
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return String(dateInput);

  return new Intl.DateTimeFormat('en-IN', {
    timeZone: TIMEZONE,
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  }).format(d);
}

/**
 * Calculate Target Date by adding calendar days to a base date (in Asia/Kolkata)
 * @param {number} days - positive integer
 * @param {Date|string} baseDate - optional base date (defaults to now)
 * @returns {string} YYYY-MM-DD
 */
export function calculateTargetDateFromDays(days, baseDate = new Date()) {
  const d = new Date(baseDate);
  const numDays = parseInt(days, 10);
  if (isNaN(numDays) || numDays <= 0) return '';

  // Use calendar day arithmetic
  d.setDate(d.getDate() + numDays);
  return formatToKolkataDateString(d);
}

/**
 * Parses YYYY-MM-DD into a localized midnight Date object for accurate day diffing
 */
function parseDateParts(dateStr) {
  if (!dateStr) return null;
  // If full ISO, strip or extract date part
  const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    const [, year, month, day] = match;
    return new Date(parseInt(year, 10), parseInt(month, 10) - 1, parseInt(day, 10));
  }
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * Get effective target date from a request, giving priority to holdExtendTargetDate if set
 */
export function getEffectiveTargetDate(input) {
  if (!input) return null;
  if (typeof input === 'string') return input;
  return input.upgradeTargetDate || input.holdExtendTargetDate || input.extendedTargetDate || input.targetCompletionDate || null;
}

/**
 * Calculates due status for a target completion date relative to today in Asia/Kolkata
 * Accepts either a target date string or a request object (using upgradeTargetDate / holdExtendTargetDate if present).
 * 
 * Rules:
 * - Past due date: Overdue (red)
 * - Due today: Due Today (red/amber warning)
 * - 1-2 days remaining: prominent Due Soon
 * - 3 calendar days remaining: Due Soon
 * - >3 days: X days remaining
 */
export function calculateDueStatus(targetInput) {
  const targetDateStr = (targetInput && typeof targetInput === 'object')
    ? (targetInput.upgradeTargetDate || targetInput.holdExtendTargetDate || targetInput.extendedTargetDate || targetInput.targetCompletionDate)
    : targetInput;

  if (!targetDateStr) {
    return {
      type: 'none',
      label: 'No Target Date',
      daysDiff: null,
      isOverdue: false,
      isDueSoon: false
    };
  }

  const target = parseDateParts(targetDateStr);
  if (!target) {
    return {
      type: 'invalid',
      label: 'Invalid Date',
      daysDiff: null,
      isOverdue: false,
      isDueSoon: false
    };
  }

  const todayStr = formatToKolkataDateString(new Date());
  const today = parseDateParts(todayStr);

  // Difference in calendar days
  const msPerDay = 1000 * 60 * 60 * 24;
  const diffTime = target.getTime() - today.getTime();
  const diffDays = Math.round(diffTime / msPerDay);

  if (diffDays < 0) {
    const overdueDays = Math.abs(diffDays);
    return {
      type: 'overdue',
      label: overdueDays === 1 ? 'Overdue (1 day)' : `Overdue (${overdueDays} days)`,
      daysDiff: diffDays,
      isOverdue: true,
      isDueSoon: false,
      severity: 'danger'
    };
  }

  if (diffDays === 0) {
    return {
      type: 'due_today',
      label: 'Due Today',
      daysDiff: 0,
      isOverdue: false,
      isDueSoon: true,
      severity: 'warning-prominent'
    };
  }

  if (diffDays === 1 || diffDays === 2) {
    return {
      type: 'due_soon_urgent',
      label: diffDays === 1 ? 'Due Soon (1 day left)' : 'Due Soon (2 days left)',
      daysDiff: diffDays,
      isOverdue: false,
      isDueSoon: true,
      severity: 'warning-prominent'
    };
  }

  if (diffDays === 3) {
    return {
      type: 'due_soon',
      label: 'Due Soon (3 days left)',
      daysDiff: 3,
      isOverdue: false,
      isDueSoon: true,
      severity: 'warning'
    };
  }

  return {
    type: 'normal',
    label: `${diffDays} days left`,
    daysDiff: diffDays,
    isOverdue: false,
    isDueSoon: false,
    severity: 'neutral'
  };
}
