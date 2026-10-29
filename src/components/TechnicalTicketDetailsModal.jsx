import React, { useState } from 'react';
import {
  Globe,
  ExternalLink,
  Copy,
  Check,
  FileText,
  Image as ImageIcon,
  Building,
  User,
  Layers,
  AlertCircle,
  Wrench,
  Calendar,
  CheckCircle2,
  Clock,
  Eye,
  X
} from 'lucide-react';
import { Modal } from './Modal';
import { formatDisplayDateTime } from '../utils/dateUtils';
import { getAttachmentLinks } from '../utils/attachmentUtils';

/**
 * Normalizes ticket attachments whether they are:
 * - array of objects { name, url, driveUrl, type, base64Data, previewUrl }
 * - array of url strings
 * - newline / comma separated string of urls
 * - JSON string
 */
export function normalizeTicketAttachments(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) {
    return raw
      .map((item, idx) => {
        if (!item) return null;
        if (typeof item === 'string') {
          const trimmed = item.trim();
          if (!trimmed) return null;
          const fileName = trimmed.split('/').pop()?.split('?')[0] || `Attachment ${idx + 1}`;
          return {
            id: `att-${idx}`,
            name: decodeURIComponent(fileName),
            url: trimmed,
            driveUrl: trimmed
          };
        }
        return {
          id: item.id || `att-${idx}`,
          name: item.name || `Attachment ${idx + 1}`,
          url: item.url || item.driveUrl || '',
          driveUrl: item.driveUrl || item.url || '',
          type: item.type || '',
          base64Data: item.base64Data || '',
          previewUrl: item.previewUrl || ''
        };
      })
      .filter(Boolean);
  }

  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed) return [];
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) return normalizeTicketAttachments(parsed);
      } catch {
        // Fall back to line/comma splitting
      }
    }
    const lines = trimmed.split(/[\r\n,]+/).map(s => s.trim()).filter(Boolean);
    return lines.map((url, idx) => {
      const fileName = url.split('/').pop()?.split('?')[0] || `Attachment ${idx + 1}`;
      return {
        id: `att-${idx}`,
        name: decodeURIComponent(fileName),
        url,
        driveUrl: url
      };
    });
  }

  return [];
}

export function TechnicalTicketDetailsModal({
  isOpen,
  onClose,
  ticket,
  onResolveClick,
  canSubmit = false
}) {
  const [copiedKey, setCopiedKey] = useState(null);
  const [activePreview, setActivePreview] = useState(null);

  if (!isOpen || !ticket) return null;

  const isResolved = Boolean(ticket.actualDate) || /^resolved$/i.test(String(ticket.status || '').trim());
  const attachments = normalizeTicketAttachments(ticket.attachments);

  const copyToClipboard = async (text, key) => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2000);
    } catch {
      // Ignore clipboard write failure
    }
  };

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title={`Technical Ticket: ${ticket.ticketNo}`}
        subtitle={`${ticket.company || 'Technical Help'} • ${ticket.category || 'General'}`}
        large
        footer={
          <div className="flex items-center justify-between w-full">
            <div className="text-xs text-slate-400">
              {ticket.createdAt ? `Raised: ${formatDisplayDateTime(ticket.createdAt)}` : ''}
            </div>
            <div className="flex items-center gap-2">
              {canSubmit && !isResolved && onResolveClick && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onResolveClick(ticket);
                  }}
                  className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-700 shadow-xs cursor-pointer"
                >
                  Resolve / Submit Ticket
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                className="cursor-pointer rounded-xl bg-slate-100 hover:bg-slate-200/80 px-5 py-2 text-xs font-semibold text-slate-700 transition-all hover:-translate-y-0.5"
              >
                Close Dialog
              </button>
            </div>
          </div>
        }
      >
        <div className="space-y-4">
          {/* 1. Header Overview & Status Card */}
          <div className="p-4 bg-white border border-slate-200/80 rounded-2xl shadow-xs space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono font-bold text-base text-blue-700 bg-blue-50/80 px-2.5 py-1 rounded-lg border border-blue-200/80">
                  {ticket.ticketNo}
                </span>
                <span
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${
                    isResolved
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-amber-50 text-amber-700 border-amber-200'
                  }`}
                >
                  {isResolved ? (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Resolved</span>
                    </>
                  ) : (
                    <>
                      <Clock className="w-3.5 h-3.5 text-amber-600" />
                      <span>{ticket.status || 'Pending'}</span>
                    </>
                  )}
                </span>
                {ticket.category && (
                  <span className="rounded-full bg-slate-100 text-slate-700 border border-slate-200 px-3 py-1 text-xs font-medium">
                    {ticket.category}
                  </span>
                )}
                {ticket.helpTicketNumber && (
                  <span className="rounded-full bg-purple-50 text-purple-700 border border-purple-200 px-2.5 py-0.5 text-xs font-semibold">
                    Ref: {ticket.helpTicketNumber}
                  </span>
                )}
              </div>

              <button
                type="button"
                onClick={() =>
                  copyToClipboard(
                    `Ticket: ${ticket.ticketNo}\nCompany: ${ticket.company}\nRequester: ${ticket.requester}\nApplication: ${ticket.application}\nProblem: ${ticket.problem}`,
                    'ticket'
                  )
                }
                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                title="Copy Ticket Summary"
              >
                {copiedKey === 'ticket' ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    <span className="text-emerald-600">Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy Info</span>
                  </>
                )}
              </button>
            </div>

            {/* Requester & Company Meta */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-100 text-xs">
              <div className="flex items-center gap-2 text-slate-700">
                <Building className="w-4 h-4 text-slate-400 shrink-0" />
                <span className="text-slate-500">Company:</span>
                <strong className="text-slate-900">{ticket.company || '—'}</strong>
              </div>

              <div className="flex items-center gap-2 text-slate-700">
                <User className="w-4 h-4 text-slate-400 shrink-0" />
                <span className="text-slate-500">Requester:</span>
                <strong className="text-slate-900">
                  {ticket.onBehalfOf ? `${ticket.onBehalfOf} (by ${ticket.requester})` : ticket.requester || '—'}
                </strong>
              </div>

              <div className="flex items-center gap-2 text-slate-700">
                <Layers className="w-4 h-4 text-slate-400 shrink-0" />
                <span className="text-slate-500">Application:</span>
                <strong className="text-slate-900">{ticket.application || '—'}</strong>
              </div>

              {ticket.sheetPage && (
                <div className="flex items-center gap-2 text-slate-700">
                  <FileText className="w-4 h-4 text-slate-400 shrink-0" />
                  <span className="text-slate-500">Sheet / Page:</span>
                  <strong className="text-slate-900">{ticket.sheetPage}</strong>
                </div>
              )}

              {ticket.assignedTo && (
                <div className="flex items-center gap-2 text-slate-700 sm:col-span-2">
                  <User className="w-4 h-4 text-indigo-500 shrink-0" />
                  <span className="text-slate-500">Assigned Resolver:</span>
                  <strong className="text-indigo-900">{ticket.assignedTo}</strong>
                </div>
              )}
            </div>
          </div>

          {/* 2. URL & System Access Card */}
          <div className="p-4 bg-gradient-to-br from-blue-50/70 via-white to-indigo-50/50 border border-blue-200/80 rounded-2xl shadow-xs space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-blue-600 text-white rounded-lg shadow-2xs">
                  <Globe className="w-4 h-4" />
                </div>
                <div>
                  <span className="font-bold text-xs uppercase tracking-wider text-blue-950 block">
                    System / Page URL
                  </span>
                  <span className="text-[11px] text-slate-500">
                    Direct access link to the sheet, application, or affected page
                  </span>
                </div>
              </div>

              {ticket.url && (
                <a
                  href={ticket.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-2xs transition-all hover:-translate-y-0.5 cursor-pointer shrink-0"
                >
                  <span>Open URL</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}
            </div>

            {ticket.url ? (
              <div className="p-2.5 bg-white border border-blue-100 rounded-xl flex items-center justify-between gap-2 text-xs">
                <a
                  href={ticket.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-blue-700 hover:underline break-all truncate"
                >
                  {ticket.url}
                </a>
                <button
                  type="button"
                  onClick={() => copyToClipboard(ticket.url, 'url')}
                  className="shrink-0 p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                  title="Copy URL"
                >
                  {copiedKey === 'url' ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            ) : (
              <div className="p-3 bg-white/70 border border-dashed border-slate-200 rounded-xl text-xs text-slate-400 italic">
                No system URL was provided for this ticket.
              </div>
            )}
          </div>

          {/* 3. Problem Description & Requested Correction */}
          <div className="grid gap-3 sm:grid-cols-2">
            {/* Problem Card */}
            <div className="p-4 bg-white border border-slate-200/80 rounded-2xl shadow-xs space-y-2">
              <div className="flex items-center gap-2 text-rose-700 font-bold text-xs uppercase tracking-wider">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>Problem Description</span>
              </div>
              <p className="whitespace-pre-wrap text-xs text-slate-800 leading-relaxed font-medium bg-slate-50/80 p-3 rounded-xl border border-slate-100 min-h-[90px]">
                {ticket.problem || 'No description provided.'}
              </p>
            </div>

            {/* What Has To Be Changed Card */}
            <div className="p-4 bg-white border border-slate-200/80 rounded-2xl shadow-xs space-y-2">
              <div className="flex items-center gap-2 text-indigo-700 font-bold text-xs uppercase tracking-wider">
                <Wrench className="w-4 h-4 shrink-0 text-indigo-600" />
                <span>What Has To Be Changed</span>
              </div>
              <p className="whitespace-pre-wrap text-xs text-slate-800 leading-relaxed font-medium bg-slate-50/80 p-3 rounded-xl border border-slate-100 min-h-[90px]">
                {ticket.correction || '—'}
              </p>
            </div>
          </div>

          {/* 4. PDF & Screenshot Attachments Section */}
          <div className="p-4 bg-white border border-slate-200/80 rounded-2xl shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-800">
                <FileText className="w-4 h-4 text-blue-600" />
                <span>Screenshots & PDF Attachments ({attachments.length})</span>
              </div>
              {attachments.length > 0 && (
                <span className="text-[11px] text-slate-400">Click to preview or open in new tab</span>
              )}
            </div>

            {attachments.length > 0 ? (
              <div className="grid gap-2.5 sm:grid-cols-2">
                {attachments.map((att, idx) => {
                  const links = getAttachmentLinks(att);
                  const isPdf = links.isPdf || att.type === 'application/pdf' || /\.pdf$/i.test(att.name || att.url || '');
                  const targetUrl = att.url || att.driveUrl || links.driveUrl || links.directUrl;

                  return (
                    <div
                      key={att.id || idx}
                      className="p-3 bg-slate-50/90 hover:bg-blue-50/50 border border-slate-200/80 hover:border-blue-300 rounded-xl transition-all flex items-center justify-between gap-3 group"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                            isPdf ? 'bg-rose-100 text-rose-700' : 'bg-blue-100 text-blue-700'
                          }`}
                        >
                          {isPdf ? <FileText className="w-5 h-5" /> : <ImageIcon className="w-5 h-5" />}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-slate-800 truncate" title={att.name}>
                            {att.name || `Attachment ${idx + 1}`}
                          </p>
                          <span className="text-[10px] text-slate-500 font-medium">
                            {isPdf ? 'PDF Document' : 'Image / Screenshot'}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => setActivePreview({ ...links, ...att, isPdf, name: att.name || `Attachment ${idx + 1}` })}
                          className="px-2.5 py-1.5 rounded-lg text-[11px] font-semibold bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 shadow-2xs transition-all cursor-pointer flex items-center gap-1"
                          title="Preview"
                        >
                          <Eye className="w-3 h-3 text-slate-500" />
                          <span>Preview</span>
                        </button>

                        {targetUrl && (
                          <a
                            href={targetUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-2.5 py-1.5 rounded-lg text-[11px] font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-2xs transition-all cursor-pointer flex items-center gap-1"
                            title="Open Link"
                          >
                            <span>Open</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-4 bg-slate-50 border border-dashed border-slate-200 rounded-xl text-center text-xs text-slate-400">
                No screenshots or PDF files attached to this ticket.
              </div>
            )}
          </div>

          {/* 5. Resolution & Timeline Details */}
          <div className="p-4 bg-white border border-slate-200/80 rounded-2xl shadow-xs space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-800">
              <Calendar className="w-4 h-4 text-indigo-600" />
              <span>Timeline & Resolution</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
              <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Created (IST)</span>
                <span className="font-semibold text-slate-800 block mt-0.5">
                  {formatDisplayDateTime(ticket.createdAt) || '—'}
                </span>
              </div>

              <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Planned</span>
                <span className="font-semibold text-slate-800 block mt-0.5">
                  {formatDisplayDateTime(ticket.plannedDate) || '—'}
                </span>
              </div>

              <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Actual / Resolved</span>
                <span className="font-semibold text-emerald-800 block mt-0.5">
                  {formatDisplayDateTime(ticket.actualDate) || '—'}
                </span>
              </div>

              <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Delay</span>
                <span className="font-semibold text-slate-800 block mt-0.5">
                  {ticket.delay || '—'}
                </span>
              </div>
            </div>

            {/* Resolved Remark Card */}
            {ticket.resolvedRemark && (
              <div className="p-3.5 bg-emerald-50/80 border border-emerald-200/80 rounded-xl space-y-1">
                <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-900">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Resolution Remark</span>
                </div>
                <p className="text-xs text-emerald-950 font-medium whitespace-pre-wrap leading-relaxed pl-5">
                  {ticket.resolvedRemark}
                </p>
              </div>
            )}
          </div>
        </div>
      </Modal>

      {/* Standalone Attachment Preview Modal */}
      {activePreview && (
        <div
          className="fixed inset-0 z-[9999] bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 animate-in fade-in duration-200"
          onClick={() => setActivePreview(null)}
        >
          <div
            className="bg-white rounded-2xl max-w-4xl w-full max-h-[92vh] flex flex-col p-4 shadow-2xl border border-slate-200 overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 shrink-0 gap-2">
              <div className="flex items-center gap-2.5 min-w-0">
                <div
                  className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                    activePreview.isPdf ? 'bg-rose-100 text-rose-700' : 'bg-blue-100 text-blue-700'
                  }`}
                >
                  {activePreview.isPdf ? <FileText className="w-4 h-4" /> : <ImageIcon className="w-4 h-4" />}
                </div>
                <div className="min-w-0">
                  <span className="font-bold text-slate-900 text-sm truncate block max-w-md">
                    {activePreview.name}
                  </span>
                  <span className="text-[11px] text-slate-400">
                    {activePreview.isPdf ? 'PDF Document' : 'Image Preview'}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {(activePreview.url || activePreview.driveUrl) && (
                  <a
                    href={activePreview.driveUrl || activePreview.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 transition-all shadow-2xs"
                  >
                    <span>Open in New Tab</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
                <button
                  type="button"
                  onClick={() => setActivePreview(null)}
                  className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition-colors cursor-pointer"
                  title="Close preview"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="flex-1 min-h-[350px] max-h-[74vh] flex items-center justify-center bg-slate-950/5 rounded-xl overflow-hidden relative mt-3">
              {activePreview.isPdf || activePreview.embedUrl ? (
                <iframe
                  src={activePreview.embedUrl || activePreview.driveUrl || activePreview.url}
                  title={activePreview.name}
                  className="w-full h-[70vh] border-0 rounded-xl"
                  allow="autoplay"
                />
              ) : (
                <img
                  src={activePreview.previewUrl || activePreview.directUrl || activePreview.url}
                  alt={activePreview.name || 'Preview'}
                  className="max-h-[70vh] w-auto max-w-full rounded-lg object-contain shadow-sm"
                  onError={e => {
                    if (activePreview.embedUrl) {
                      e.currentTarget.style.display = 'none';
                    }
                  }}
                />
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
