import React, { useState, useEffect } from 'react';
import {
  Upload,
  Trash2,
  FileText,
  AlertCircle,
  Check
} from 'lucide-react';
import { Modal } from './Modal';
import { SearchableSelect } from './SearchableSelect';
import { formatToKolkataDateString } from '../utils/dateUtils';
import { GOOGLE_SHEETS_CONFIG } from '../config/integrationConfig';
import { dataService } from '../services/dataService';

export function NewRequestModal({
  isOpen,
  onClose,
  onSubmit,
  companyOptions = [],
  developerOptions = [],
  nextRequestNo = 'SM-0008'
}) {
  const [formData, setFormData] = useState({
    companyName: '',
    systemName: '',
    businessPurpose: '',
    assignedDeveloper: '',
    targetCompletionDate: ''
  });

  const [attachments, setAttachments] = useState([]);
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittingStatus, setSubmittingStatus] = useState('');
  const [attachmentError, setAttachmentError] = useState('');

  // Default date to +14 days from today
  useEffect(() => {
    if (isOpen) {
      const defaultDate = new Date();
      defaultDate.setDate(defaultDate.getDate() + 14);

      setFormData({
        companyName: '',
        systemName: '',
        businessPurpose: '',
        assignedDeveloper: '',
        targetCompletionDate: formatToKolkataDateString(defaultDate)
      });
      setAttachments([]);
      setErrors({});
      setAttachmentError('');
      setIsSubmitting(false);
    }
  }, [isOpen]);

  function validate() {
    const errs = {};
    if (!formData.companyName) errs.companyName = 'Company is required';
    if (!formData.systemName.trim()) errs.systemName = 'System name is required';
    if (!formData.businessPurpose.trim()) errs.businessPurpose = 'Business purpose is required';
    if (!formData.assignedDeveloper) errs.assignedDeveloper = 'Developer assignment is required';
    if (!formData.targetCompletionDate) errs.targetCompletionDate = 'Target completion date is required';

    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleFileSelect(e) {
    setAttachmentError('');
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const allowedMimeTypes = GOOGLE_SHEETS_CONFIG.attachments.allowedMimeTypes;
    const maxSizeBytes = GOOGLE_SHEETS_CONFIG.attachments.maxFileSizeBytes;

    const validNewFiles = [];

    for (const file of files) {
      if (!allowedMimeTypes.includes(file.type)) {
        setAttachmentError(`Unsupported file "${file.name}". PDF or Images only.`);
        return;
      }
      if (file.size > maxSizeBytes) {
        setAttachmentError(`File "${file.name}" exceeds 10 MB limit.`);
        return;
      }

      const isImg = file.type.startsWith('image/');
      const previewUrl = isImg ? URL.createObjectURL(file) : null;

      try {
        const base64Data = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = (err) => reject(err);
          reader.readAsDataURL(file);
        });

        validNewFiles.push({
          id: `file-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
          name: file.name,
          size: file.size,
          type: file.type,
          previewUrl,
          base64Data
        });
      } catch (err) {
        setAttachmentError(`Failed to process "${file.name}".`);
      }
    }

    setAttachments(prev => [...prev, ...validNewFiles]);
    e.target.value = '';
  }

  function removeAttachment(id) {
    setAttachments(prev => prev.filter(att => att.id !== id));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!validate()) return;

    setIsSubmitting(true);
    setSubmittingStatus('Processing...');
    try {
      const uploadedAttachments = [];
      for (let i = 0; i < attachments.length; i++) {
        const att = attachments[i];
        if (att.base64Data) {
          setSubmittingStatus(`Uploading ${att.name} to Drive...`);
          const uploaded = await dataService.uploadAttachment(att);
          uploadedAttachments.push(uploaded);
        } else {
          uploadedAttachments.push(att);
        }
      }

      setSubmittingStatus('Saving Request...');
      await onSubmit({
        companyName: formData.companyName,
        systemName: formData.systemName.trim(),
        systemRequirements: formData.systemName.trim(),
        businessPurpose: formData.businessPurpose.trim(),
        assignedDeveloper: formData.assignedDeveloper,
        targetCompletionDate: formData.targetCompletionDate,
        attachments: uploadedAttachments
      });
      onClose();
    } catch (err) {
      setErrors({ form: err.message || 'Failed to submit request' });
    } finally {
      setIsSubmitting(false);
      setSubmittingStatus('');
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Create New System Request"
      large
      footer={
        <>
          <button
            type="button"
            className="bg-slate-100 hover:bg-slate-200/80 text-slate-700 rounded-xl text-xs font-semibold px-4 py-2 cursor-pointer transition-all hover:-translate-y-0.5"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button
            type="button"
            className="soft-btn-primary font-semibold text-xs rounded-xl shadow-xs px-5 py-2 inline-flex items-center gap-2 cursor-pointer disabled:opacity-50 transition-all hover:-translate-y-0.5"
            onClick={handleSubmit}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>{submittingStatus || 'Creating Request...'}</span>
              </>
            ) : (
              <>
                <Check className="w-4 h-4" />
                <span>Submit System Request</span>
              </>
            )}
          </button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {errors.form && (
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs font-semibold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errors.form}</span>
          </div>
        )}

        {/* Row 1: System Request No (Read-only) & Company Name */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5" htmlFor="requestNoField">
              System Request No.
            </label>
            <input
              id="requestNoField"
              type="text"
              className="w-full px-3.5 py-2.5 bg-slate-100/70 border border-slate-200/80 rounded-xl text-indigo-700 font-mono font-bold text-sm cursor-not-allowed select-none"
              value={nextRequestNo}
              readOnly
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5" htmlFor="companySelect">
              Company Name <span className="text-rose-500">*</span>
            </label>
            <SearchableSelect
              id="companySelect"
              value={formData.companyName}
              options={companyOptions}
              placeholder="Select company..."
              isInvalid={Boolean(errors.companyName)}
              onChange={(val) => {
                setFormData(prev => ({ ...prev, companyName: val }));
                if (errors.companyName) setErrors(prev => ({ ...prev, companyName: '' }));
              }}
            />
            {errors.companyName && <span className="text-[11px] text-rose-600 font-medium mt-1 block">{errors.companyName}</span>}
          </div>
        </div>

        {/* Row 2: Assigned Developer & Target Completion Date (ONLY Date picker!) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5" htmlFor="devSelect">
              Assigned Developer <span className="text-rose-500">*</span>
            </label>
            <SearchableSelect
              id="devSelect"
              value={formData.assignedDeveloper}
              options={developerOptions}
              placeholder="Select developer..."
              isInvalid={Boolean(errors.assignedDeveloper)}
              onChange={(val) => {
                setFormData(prev => ({ ...prev, assignedDeveloper: val }));
                if (errors.assignedDeveloper) setErrors(prev => ({ ...prev, assignedDeveloper: '' }));
              }}
            />
            {errors.assignedDeveloper && <span className="text-[11px] text-rose-600 font-medium mt-1 block">{errors.assignedDeveloper}</span>}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5" htmlFor="targetCompletionDate">
              Target Completion Date <span className="text-rose-500">*</span>
            </label>
            <input
              id="targetCompletionDate"
              type="date"
              className={`w-full px-3.5 py-2.5 bg-white border rounded-xl text-slate-800 text-sm focus:outline-none focus:ring-4 focus:ring-indigo-100/60 focus:border-indigo-400 transition-all shadow-2xs cursor-pointer ${
                errors.targetCompletionDate ? 'border-rose-400 ring-2 ring-rose-100' : 'border-slate-200/80 hover:border-slate-300'
              }`}
              value={formData.targetCompletionDate}
              min={formatToKolkataDateString(new Date())}
              onChange={(e) => {
                setFormData(prev => ({ ...prev, targetCompletionDate: e.target.value }));
                if (errors.targetCompletionDate) setErrors(prev => ({ ...prev, targetCompletionDate: '' }));
              }}
            />
            {errors.targetCompletionDate && <span className="text-[11px] text-rose-600 font-medium mt-1 block">{errors.targetCompletionDate}</span>}
          </div>
        </div>

        {/* Row 3: System Name (Direct, Clean Single-line Input) */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5" htmlFor="systemName">
            System Name <span className="text-rose-500">*</span>
          </label>
          <input
            id="systemName"
            type="text"
            placeholder="Enter system name (e.g. Automated Invoice Reconciliation System)..."
            value={formData.systemName}
            onChange={(e) => {
              setFormData(prev => ({ ...prev, systemName: e.target.value }));
              if (errors.systemName) setErrors(prev => ({ ...prev, systemName: '' }));
            }}
            className={`w-full px-3.5 py-2.5 bg-white border rounded-xl text-slate-800 text-sm placeholder-slate-400 focus:outline-none focus:ring-4 focus:ring-indigo-100/60 focus:border-indigo-400 transition-all shadow-2xs ${
              errors.systemName ? 'border-rose-400 ring-2 ring-rose-100' : 'border-slate-200/80 hover:border-slate-300'
            }`}
          />
          {errors.systemName && <span className="text-[11px] text-rose-600 font-medium mt-1 block">{errors.systemName}</span>}
        </div>

        {/* Row 4: Business Purpose & Justification */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5" htmlFor="businessPurpose">
            Business Purpose & Justification <span className="text-rose-500">*</span>
          </label>
          <textarea
            id="businessPurpose"
            rows={2}
            placeholder="Explain why the system is needed, operational benefits, or ROI..."
            value={formData.businessPurpose}
            onChange={(e) => {
              setFormData(prev => ({ ...prev, businessPurpose: e.target.value }));
              if (errors.businessPurpose) setErrors(prev => ({ ...prev, businessPurpose: '' }));
            }}
            className={`w-full px-3.5 py-2.5 bg-white border rounded-xl text-slate-800 text-sm placeholder-slate-400 focus:outline-none focus:ring-4 focus:ring-indigo-100/60 focus:border-indigo-400 transition-all shadow-2xs ${
              errors.businessPurpose ? 'border-rose-400 ring-2 ring-rose-100' : 'border-slate-200/80 hover:border-slate-300'
            }`}
          />
          {errors.businessPurpose && <span className="text-[11px] text-rose-600 font-medium mt-1 block">{errors.businessPurpose}</span>}
        </div>

        {/* Row 5: Attachments (Upload PDF / Image only, directly saved to Drive) */}
        <div className="pt-2 border-t border-slate-100/90">
          <div className="flex items-center justify-between">
            <label
              htmlFor="compactFileInput"
              className="inline-flex items-center gap-2 px-3.5 py-2 bg-white hover:bg-slate-50 border border-slate-200/90 hover:border-slate-300 text-slate-700 text-xs font-semibold rounded-xl cursor-pointer transition-all shadow-2xs hover:-translate-y-0.5"
            >
              <Upload className="w-3.5 h-3.5 text-indigo-600" />
              <span>Upload PDF / Image</span>
            </label>
            <input
              id="compactFileInput"
              type="file"
              multiple
              accept="application/pdf,image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={handleFileSelect}
            />
            {attachments.length > 0 && (
              <span className="text-xs text-slate-500 font-medium">
                {attachments.length} {attachments.length === 1 ? 'file' : 'files'} selected
              </span>
            )}
          </div>

          {attachmentError && (
            <span className="text-[11px] text-rose-600 font-medium mt-1.5 block">
              {attachmentError}
            </span>
          )}

          {/* Attached files list */}
          {attachments.length > 0 && (
            <div className="mt-2.5 space-y-1.5">
              {attachments.map((file) => (
                <div key={file.id} className="flex items-center justify-between px-3 py-2 bg-slate-50/80 border border-slate-100 rounded-xl text-xs">
                  <div className="flex items-center gap-2 min-w-0">
                    <FileText className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                    <span className="font-semibold text-slate-800 truncate max-w-sm">{file.name}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeAttachment(file.id)}
                    className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                    aria-label={`Remove ${file.name}`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </form>
    </Modal>
  );
}
