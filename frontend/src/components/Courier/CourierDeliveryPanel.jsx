/**
 * CourierDeliveryPanel.jsx
 *
 * Reusable component for managing courier delivery for orders
 * Shows courier configuration status, delivery controls, and tracking info
 *
 * Usage:
 * <CourierDeliveryPanel
 *   order={order}
 *   onGenerateConsignment={handleGenerateConsignment}
 *   onSyncTracking={handleSyncTracking}
 *   isLoading={loading}
 * />
 */

import React, { useMemo } from "react";
import {
  FiTruck,
  FiRefreshCw,
  FiCheckCircle,
  FiAlertCircle,
  FiCopy,
  FiExternalLink,
} from "react-icons/fi";
import { toast } from "react-hot-toast";

const CourierDeliveryPanel = ({
  order,
  onGenerateConsignment,
  onSyncTracking,
  isLoading = false,
  errorMessage = "",
}) => {
  const courier = useMemo(() => order?.courierMeta, [order]);
  const paymentMethod = useMemo(
    () =>
      order?.payment || {
        paymentCategory: "online_payment",
      },
    [order?.payment],
  );

  const isCashOnDelivery = useMemo(
    () =>
      String(paymentMethod?.paymentCategory || "")
        .toLowerCase()
        .includes("cod") ||
      /cash[\s_-]*on[\s_-]*delivery/i.test(paymentMethod?.paymentMethod || ""),
    [paymentMethod],
  );

  const generatedBy = useMemo(
    () =>
      String(courier?.generatedBy || "")
        .trim()
        .toLowerCase(),
    [courier?.generatedBy],
  );

  const hasTracking = useMemo(
    () => Boolean(courier?.trackingNumber || courier?.consignmentId),
    [courier],
  );

  const canSyncTracking = useMemo(
    () => generatedBy === "api" && hasTracking,
    [generatedBy, hasTracking],
  );

  const copyToClipboard = (text, label) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied!`);
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 md:p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
          <FiTruck className="w-5 h-5 text-blue-600" />
        </div>
        <div>
          <h3 className="font-semibold text-black">Courier & Delivery</h3>
          <p className="text-xs text-gray-600">
            {isCashOnDelivery
              ? "Cash on Delivery - Courier required for delivery"
              : "Online Payment - Generate courier consignment for delivery"}
          </p>
        </div>
      </div>

      {/* Courier Status */}
      {courier ? (
        <div className="space-y-3 bg-gray-50 rounded-lg p-4">
          {/* Provider Name */}
          <div>
            <p className="text-xs font-semibold text-gray-600 uppercase mb-1">
              Provider
            </p>
            <p className="text-sm font-medium text-black">
              {courier.providerName || "Unknown"}
            </p>
          </div>

          {/* Consignment & Tracking */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {courier.consignmentId && (
              <div>
                <p className="text-xs font-semibold text-gray-600 uppercase mb-1">
                  Consignment ID
                </p>
                <div className="flex items-center gap-2">
                  <code className="text-sm bg-white border border-gray-200 rounded px-2 py-1 font-mono">
                    {courier.consignmentId}
                  </code>
                  <button
                    onClick={() =>
                      copyToClipboard(courier.consignmentId, "Consignment ID")
                    }
                    className="p-1.5 hover:bg-gray-200 rounded transition"
                    title="Copy consignment ID"
                  >
                    <FiCopy className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {courier.trackingNumber && (
              <div>
                <p className="text-xs font-semibold text-gray-600 uppercase mb-1">
                  Tracking Number
                </p>
                <div className="flex items-center gap-2">
                  <code className="text-sm bg-white border border-gray-200 rounded px-2 py-1 font-mono">
                    {courier.trackingNumber}
                  </code>
                  <button
                    onClick={() =>
                      copyToClipboard(courier.trackingNumber, "Tracking Number")
                    }
                    className="p-1.5 hover:bg-gray-200 rounded transition"
                    title="Copy tracking number"
                  >
                    <FiCopy className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Status */}
          {courier.status && (
            <div>
              <p className="text-xs font-semibold text-gray-600 uppercase mb-1">
                Delivery Status
              </p>
              <div className="inline-flex items-center gap-2 bg-white border border-gray-200 rounded px-3 py-1.5">
                {courier.status === "delivered" ? (
                  <FiCheckCircle className="w-4 h-4 text-green-600" />
                ) : courier.status === "created" ? (
                  <FiAlertCircle className="w-4 h-4 text-yellow-600" />
                ) : (
                  <FiTruck className="w-4 h-4 text-blue-600" />
                )}
                <span className="text-sm font-medium text-black capitalize">
                  {courier.status?.replace(/_/g, " ")}
                </span>
              </div>
            </div>
          )}

          {/* Tracking URL */}
          {courier.trackingUrl && (
            <div>
              <p className="text-xs font-semibold text-gray-600 uppercase mb-1">
                Track Online
              </p>
              <a
                href={courier.trackingUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-800 text-sm font-medium"
              >
                Open Tracking Link
                <FiExternalLink className="w-3 h-3" />
              </a>
            </div>
          )}

          {/* Last Synced */}
          {courier.lastSyncedAt && (
            <p className="text-xs text-gray-500">
              Last updated: {new Date(courier.lastSyncedAt).toLocaleString()}
            </p>
          )}
        </div>
      ) : (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-start gap-2">
            <FiAlertCircle className="w-5 h-5 text-yellow-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-yellow-900">No Courier Assigned</p>
              <p className="text-sm text-yellow-800 mt-1">
                Generate a courier consignment to assign delivery
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-2 pt-2">
        {errorMessage ? (
          <div className="w-full rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {errorMessage}
          </div>
        ) : null}
        {!hasTracking ? (
          <button
            onClick={onGenerateConsignment}
            disabled={isLoading}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-60 transition"
          >
            <FiTruck className="w-4 h-4" />
            {isLoading ? "Generating..." : "Generate Courier Consignment"}
          </button>
        ) : canSyncTracking ? (
          <button
            onClick={onSyncTracking}
            disabled={isLoading}
            className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:opacity-60 transition"
          >
            <FiRefreshCw className="w-4 h-4" />
            {isLoading ? "Syncing..." : "Sync Status"}
          </button>
        ) : (
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            Sync is available only for API-generated consignments.
          </p>
        )}
      </div>

      {/* Info Box */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
        <p className="font-medium mb-1">💡 How to deliver:</p>
        <ol className="list-decimal list-inside space-y-1 text-xs">
          <li>Click "Generate Courier Consignment"</li>
          <li>Courier API will create a consignment</li>
          <li>Tracking number is auto-generated</li>
          <li>Click "Sync Status" for API-generated consignments</li>
          <li>Customer can track via public tracking link</li>
        </ol>
      </div>
    </div>
  );
};

export default CourierDeliveryPanel;
