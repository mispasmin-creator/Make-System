import { Download } from 'lucide-react';
import { exportRowsToCsv } from '../utils/csvExport';

export function CsvExportButton({ rows = [], filename = 'export', label = 'Export CSV', className = '' }) {
  return <button
    type="button"
    disabled={!rows.length}
    onClick={() => exportRowsToCsv(rows, filename)}
    className={`inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-xs font-bold text-emerald-700 shadow-xs transition-all hover:-translate-y-0.5 hover:bg-emerald-100 disabled:cursor-default disabled:opacity-50 disabled:hover:translate-y-0 ${className}`}
    title={rows.length ? `Export ${rows.length} filtered records to CSV` : 'No records to export'}
  >
    <Download className="h-3.5 w-3.5" />
    <span>{label}</span>
  </button>;
}
