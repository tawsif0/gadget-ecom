import React from "react";
import { FiAlertTriangle } from "react-icons/fi";

const ConfirmModal = ({
  isOpen,
  title = "Please confirm",
  message = "",
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  onConfirm,
  onCancel,
  isDanger = false,
  isLoading = false,
}) => {
  if (!isOpen) return null;

  const iconBg = isDanger ? "bg-red-600" : "bg-black";
  const confirmBtn = isDanger
    ? "bg-red-600 hover:bg-red-700"
    : "bg-black hover:bg-gray-800";

  return (
    <div
      className="fixed inset-0 app-layer-modal bg-black/40 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      onClick={onCancel}
    >
      <div
        className="bg-white rounded-xl shadow-2xl overflow-hidden w-full max-w-md border border-gray-200"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="p-6 text-center">
          <div
            className={`mx-auto flex items-center justify-center h-12 w-12 rounded-full ${iconBg} mb-4`}
          >
            <FiAlertTriangle className="h-5 w-5 text-white" />
          </div>
          <h3 className="text-lg font-semibold text-black mb-2">{title}</h3>
          {message && (
            <p className="text-sm text-gray-700 whitespace-pre-line">
              {message}
            </p>
          )}
          <div className="mt-6 flex justify-center gap-3">
            <button
              type="button"
              onClick={onCancel}
              className="px-5 py-2.5 text-sm font-medium rounded-lg bg-gray-200 text-gray-800 hover:bg-gray-300 transition-all"
            >
              {cancelLabel}
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={isLoading}
              className={`px-5 py-2.5 text-sm font-medium rounded-lg text-white transition-all ${confirmBtn} disabled:opacity-60 disabled:cursor-not-allowed`}
            >
              {isLoading ? "Working..." : confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConfirmModal;
