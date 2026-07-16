import React from 'react';
import { AlertTriangle, X } from 'lucide-react';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning';
  showCancel?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'danger',
  showCancel = true,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onCancel}
      />
      {/* Dialog */}
      <div className="relative bg-white dark:bg-[#1a1a1e] rounded-xl shadow-2xl border border-gray-200 dark:border-white/10 w-full max-w-md mx-4 overflow-hidden">
        {/* Header */}
        <div className={`flex items-center gap-3 px-5 py-4 border-b ${
          variant === 'danger'
            ? 'border-red-100 dark:border-red-900/30'
            : 'border-amber-100 dark:border-amber-900/30'
        }`}>
          <div className={`p-2 rounded-lg ${
            variant === 'danger'
              ? 'bg-red-50 dark:bg-red-900/20 text-red-500'
              : 'bg-amber-50 dark:bg-amber-900/20 text-amber-500'
          }`}>
            <AlertTriangle className="w-5 h-5" />
          </div>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 flex-1">
            {title}
          </h3>
          <button
            onClick={onCancel}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        {/* Body */}
        <div className="px-5 py-4">
          <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
            {message}
          </p>
        </div>
        {/* Footer */}
        <div className="flex justify-end gap-2 px-5 py-3 bg-gray-50 dark:bg-white/5 border-t border-gray-100 dark:border-white/5">
          {showCancel && (
            <button
              onClick={onCancel}
              className="px-4 py-2 text-xs font-semibold text-gray-600 dark:text-gray-400 bg-white dark:bg-transparent border border-gray-200 dark:border-white/10 rounded-lg hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
            >
              {cancelLabel}
            </button>
          )}
          <button
            onClick={onConfirm}
            className={`px-4 py-2 text-xs font-semibold text-white rounded-lg transition-colors ${
              variant === 'danger'
                ? 'bg-red-600 hover:bg-red-700'
                : 'bg-amber-600 hover:bg-amber-700'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
