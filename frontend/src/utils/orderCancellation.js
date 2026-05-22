export const getCancellationActionLabel = (cancellation = {}) => {
  if (cancellation.requestStatus === "pending") {
    return "Cancellation Requested";
  }
  if (cancellation.actionType === "request_cancel") {
    return "Request Cancellation";
  }
  if (cancellation.actionType === "direct_cancel") {
    return "Cancel Order";
  }
  return "Cancel Unavailable";
};

export const canSubmitCancellation = (cancellation = {}) =>
  cancellation.actionType === "direct_cancel" ||
  cancellation.actionType === "request_cancel";

export const getCancellationStatusTone = (cancellation = {}) => {
  if (cancellation.requestStatus === "pending") {
    return "border-amber-200 bg-amber-50 text-amber-800";
  }
  if (cancellation.requestStatus === "approved" || cancellation.actionType === "direct_cancel") {
    return "border-emerald-200 bg-emerald-50 text-emerald-800";
  }
  if (cancellation.requestStatus === "rejected" || cancellation.disabledReason) {
    return "border-rose-200 bg-rose-50 text-rose-800";
  }
  return "border-slate-200 bg-slate-50 text-slate-700";
};
