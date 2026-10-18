import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Image as ImageIcon,
  FileText,
  ExternalLink,
  X
} from 'lucide-react';
import { getAttachmentLinks } from '../utils/attachmentUtils';

export function ImageAttachmentCell({
  attachments = [],
  onViewDetails,
  showAsTd = true,
  className = ''
}) {
  const [previewImage, setPreviewImage] = useState(null);
  const [useIframeViewer, setUseIframeViewer] = useState(false);

  const atts = Array.isArray(attachments)
    ? attachments
    : attachments
    ? [attachments]
    : [];
  const firstAtt = atts.length > 0 ? atts[0] : null;
  const links = firstAtt ? getAttachmentLinks(firstAtt) : null;

  const handleOpenPreview = (linkItem) => {
    setPreviewImage(linkItem);
    // If it's a PDF or we have a drive embed url without a local blob, default to drive iframe
    setUseIframeViewer(Boolean(linkItem?.isPdf || (linkItem?.embedUrl && !linkItem?.localPreview)));
  };

  const handleClosePreview = () => {
    setPreviewImage(null);
    setUseIframeViewer(false);
  };

  const renderContent = () => {
    if (!links) {
      return <span className="text-slate-300 font-mono text-xs select-none">—</span>;
    }

    if (links.isImage) {
      return (
        <div className="inline-flex items-center justify-center relative group">
          <img
            src={links.thumbnailUrl || links.directUrl}
            alt={links.name || 'Attachment'}
            onClick={() => handleOpenPreview(links)}
            className="w-9 h-9 rounded-lg object-cover border border-slate-200/90 shadow-2xs hover:shadow-md hover:scale-110 transition-all cursor-pointer bg-slate-50"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
              if (e.currentTarget.nextSibling) {
                e.currentTarget.nextSibling.style.display = 'inline-flex';
              }
            }}
          />
          <button
            type="button"
            style={{ display: 'none' }}
            onClick={() => handleOpenPreview(links)}
            className="w-9 h-9 rounded-lg bg-indigo-50 hover:bg-indigo-100 border border-indigo-200/80 text-indigo-600 items-center justify-center cursor-pointer shadow-2xs"
            title={links.name}
          >
            <ImageIcon className="w-4 h-4" />
          </button>
          {atts.length > 1 && (
            <span
              onClick={(e) => {
                e.stopPropagation();
                if (onViewDetails) onViewDetails();
                else handleOpenPreview(links);
              }}
              className="absolute -top-1.5 -right-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-[9px] font-bold rounded-full px-1.5 py-0.2 border border-white shadow-2xs cursor-pointer transition-transform hover:scale-110"
              title={`${atts.length} attachments (click to view)`}
            >
              +{atts.length - 1}
            </span>
          )}
        </div>
      );
    }

    // PDF or other document
    return (
      <div className="inline-flex items-center justify-center gap-1">
        <button
          type="button"
          onClick={() => handleOpenPreview(links)}
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200/70 text-[10px] font-bold shadow-2xs transition-all hover:scale-105 cursor-pointer"
          title={links.name}
        >
          <FileText className="w-3.5 h-3.5" />
          <span>PDF</span>
        </button>
        {atts.length > 1 && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (onViewDetails) onViewDetails();
              else handleOpenPreview(links);
            }}
            className="text-[10px] text-indigo-600 hover:underline font-bold ml-0.5"
            title="View all attachments"
          >
            +{atts.length - 1}
          </button>
        )}
      </div>
    );
  };

  const modal = previewImage && typeof document !== 'undefined'
    ? createPortal(
        <div
          className="fixed inset-0 z-[9999] bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 animate-in fade-in duration-200"
          onClick={handleClosePreview}
        >
          <div
            className="bg-white rounded-2xl max-w-4xl w-full max-h-[92vh] flex flex-col p-4 shadow-2xl border border-slate-200 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 shrink-0 gap-2">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                  {previewImage.isPdf ? (
                    <FileText className="w-4 h-4 text-rose-600" />
                  ) : (
                    <ImageIcon className="w-4 h-4" />
                  )}
                </div>
                <div className="min-w-0">
                  <span className="font-bold text-slate-900 text-sm truncate block max-w-md">
                    {previewImage.name || 'Attachment Preview'}
                  </span>
                  <span className="text-[11px] text-slate-400">
                    {previewImage.isPdf ? 'PDF Document' : 'Image File'}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {previewImage.embedUrl && (
                  <button
                    type="button"
                    onClick={() => setUseIframeViewer((prev) => !prev)}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-all cursor-pointer"
                    title="Toggle Viewer Mode"
                  >
                    {useIframeViewer ? '🖼️ Direct View' : '🔍 Drive Viewer'}
                  </button>
                )}

                {previewImage.driveUrl && (
                  <a
                    href={previewImage.driveUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200/80 transition-all shadow-2xs"
                  >
                    <span>Open in Drive</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}

                <button
                  type="button"
                  onClick={handleClosePreview}
                  className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition-colors cursor-pointer"
                  title="Close preview"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Direct preview content */}
            <div className="flex-1 min-h-[350px] max-h-[74vh] flex items-center justify-center bg-slate-950/5 rounded-xl overflow-hidden relative mt-3">
              {useIframeViewer || previewImage.isPdf || (!previewImage.localPreview && previewImage.embedUrl) ? (
                <iframe
                  src={previewImage.embedUrl || previewImage.driveUrl}
                  title={previewImage.name}
                  className="w-full h-[70vh] border-0 rounded-xl"
                  allow="autoplay"
                />
              ) : (
                <img
                  src={previewImage.directUrl || previewImage.thumbnailUrl}
                  alt={previewImage.name || 'Preview'}
                  className="max-h-[70vh] w-auto max-w-full rounded-lg object-contain shadow-sm"
                  onError={() => {
                    if (previewImage.embedUrl) {
                      setUseIframeViewer(true);
                    }
                  }}
                />
              )}
            </div>
          </div>
        </div>,
        document.body
      )
    : null;

  if (!showAsTd) {
    return (
      <>
        {renderContent()}
        {modal}
      </>
    );
  }

  return (
    <td className={`px-3 py-2 text-center whitespace-nowrap ${className}`}>
      {renderContent()}
      {modal}
    </td>
  );
}
