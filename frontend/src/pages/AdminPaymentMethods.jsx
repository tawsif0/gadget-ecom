/* eslint-disable no-unused-vars */
import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import toast from "react-hot-toast";
import {
  FiCheckCircle,
  FiCreditCard,
  FiRefreshCw,
  FiTrash2,
} from "react-icons/fi";
import ConfirmModal from "../components/ConfirmModal";
import SearchableSelect from "../components/SearchableSelect";
import { useAuth } from "../hooks/useAuth";
import { useThemeColors } from "../hooks/useThemeColors";

const baseUrl = import.meta.env.VITE_API_URL;

const channelOptions = [
  {
    value: "manual",
    label: "Manual Payment",
    description:
      "Use this for bank transfer or any wallet/account collection that needs manual verification.",
  },
  {
    value: "cod",
    label: "Cash on Delivery",
    description:
      "Customer pays after delivery. No transaction ID or gateway setup is required.",
  },
  {
    value: "sslcommerz",
    label: "SSLCommerz",
    description:
      "Redirect customers to SSLCommerz checkout with store credentials.",
  },
  {
    value: "bkash",
    label: "bKash",
    description:
      "Use bKash tokenized checkout so the order is marked paid automatically after successful payment.",
  },
  {
    value: "nagad",
    label: "Nagad",
    description:
      "Use Nagad checkout API so the order is marked paid automatically after successful payment verification.",
  },
];

const createGatewayConfig = () => ({
  merchantId: "",
  merchantNumber: "",
  username: "",
  password: "",
  apiBaseUrl: "",
  apiKey: "",
  appKey: "",
  appSecret: "",
  apiSecret: "",
  callbackBaseUrl: "",
  merchantPrivateKey: "",
  gatewayPublicKey: "",
  brandLogoUrl: "",
  clientType: "PC_WEB",
  apiVersion: "v-0.2.0",
  currency: "BDT",
  successUrl: "",
  cancelUrl: "",
  sandbox: true,
  storeId: "",
  storePassword: "",
  failUrl: "",
  ipnUrl: "",
});

const createInitialForm = () => ({
  code: "",
  type: "",
  channelType: "manual",
  accountNo: "",
  instructions: "",
  requiresTransactionProof: true,
  displayOrder: 0,
  isActive: true,
  gatewayConfig: createGatewayConfig(),
});

const getAuthHeaders = () => {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const sanitizeCode = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

const isGatewayChannel = (channelType) =>
  ["sslcommerz", "bkash", "nagad"].includes(
    String(channelType || "")
      .trim()
      .toLowerCase(),
  );

const getChannelMeta = (channelType) =>
  channelOptions.find((entry) => entry.value === channelType) ||
  channelOptions[0];

const AdminPaymentMethods = () => {
  const { themeColor } = useThemeColors();
  const { user } = useAuth();
  const isAdmin = user?.userType === "admin";

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [form, setForm] = useState(createInitialForm());
  const [editingId, setEditingId] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const channelMeta = useMemo(
    () => getChannelMeta(form.channelType),
    [form.channelType],
  );
  const isManual = form.channelType === "manual";
  const isCod = form.channelType === "cod";
  const isSslCommerz = form.channelType === "sslcommerz";
  const isBkash = form.channelType === "bkash";
  const isNagad = form.channelType === "nagad";
  const isGateway = isGatewayChannel(form.channelType);

  const loadPaymentMethods = async () => {
    try {
      setLoading(true);
      const response = await axios.get(
        `${baseUrl}/auth/admin/payment-methods`,
        {
          headers: getAuthHeaders(),
        },
      );
      setPaymentMethods(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      toast.error(
        error.response?.data?.error || "Failed to load payment methods",
      );
      setPaymentMethods([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin) {
      loadPaymentMethods();
    }
  }, [isAdmin]);

  useEffect(() => {
    if (!isManual && form.requiresTransactionProof) {
      setForm((prev) => ({
        ...prev,
        requiresTransactionProof: false,
      }));
    }
  }, [form.requiresTransactionProof, isManual]);

  const resetForm = () => {
    setForm(createInitialForm());
    setEditingId("");
  };

  const updateGatewayConfig = (name, value) => {
    setForm((prev) => ({
      ...prev,
      gatewayConfig: {
        ...prev.gatewayConfig,
        [name]: value,
      },
    }));
  };

  const handleFormChange = (event) => {
    const { name, value, type, checked } = event.target;
    const nextValue = type === "checkbox" ? checked : value;

    if (name === "channelType") {
      const nextChannel = String(value || "manual")
        .trim()
        .toLowerCase();
      setForm((prev) => {
        const nextChannelMeta = getChannelMeta(nextChannel);
        const previousChannelMeta = getChannelMeta(prev.channelType);
        const currentType = String(prev.type || "").trim();
        const shouldAutoFillType =
          !currentType || currentType === previousChannelMeta.label;

        return {
          ...prev,
          channelType: nextChannel,
          type: shouldAutoFillType ? nextChannelMeta.label : prev.type,
          accountNo: nextChannel === "manual" ? prev.accountNo : "",
          requiresTransactionProof: nextChannel === "manual",
        };
      });
      return;
    }

    if (name === "code") {
      setForm((prev) => ({ ...prev, code: sanitizeCode(nextValue) }));
      return;
    }

    setForm((prev) => ({ ...prev, [name]: nextValue }));
  };

  const validateForm = () => {
    if (!String(form.type || "").trim()) {
      toast.error("Payment method name is required");
      return false;
    }

    if (isManual && !String(form.accountNo || "").trim()) {
      toast.error("Account number/details are required for manual payment");
      return false;
    }

    if (form.isActive && isSslCommerz) {
      if (
        !String(form.gatewayConfig.storeId || "").trim() ||
        !String(form.gatewayConfig.storePassword || "").trim()
      ) {
        toast.error("SSLCommerz store ID and store password are required");
        return false;
      }
    }

    if (form.isActive && isBkash) {
      if (
        !String(form.gatewayConfig.apiBaseUrl || "").trim() ||
        !String(form.gatewayConfig.appKey || "").trim() ||
        !String(form.gatewayConfig.appSecret || "").trim() ||
        !String(form.gatewayConfig.username || "").trim() ||
        !String(form.gatewayConfig.password || "").trim()
      ) {
        toast.error(
          "bKash API base URL, app key, app secret, username, and password are required",
        );
        return false;
      }
    }

    if (form.isActive && isNagad) {
      if (
        !String(form.gatewayConfig.merchantId || "").trim() ||
        !String(form.gatewayConfig.merchantPrivateKey || "").trim() ||
        !String(form.gatewayConfig.gatewayPublicKey || "").trim()
      ) {
        toast.error(
          "Nagad merchant ID, merchant private key, and gateway public key are required",
        );
        return false;
      }
    }

    return true;
  };

  const buildGatewayPayload = () => {
    if (isSslCommerz) {
      return {
        storeId: String(form.gatewayConfig.storeId || "").trim(),
        storePassword: String(form.gatewayConfig.storePassword || "").trim(),
        sandbox: Boolean(form.gatewayConfig.sandbox),
        currency: String(form.gatewayConfig.currency || "BDT").trim() || "BDT",
        successUrl: String(form.gatewayConfig.successUrl || "").trim(),
        failUrl: String(form.gatewayConfig.failUrl || "").trim(),
        cancelUrl: String(form.gatewayConfig.cancelUrl || "").trim(),
        ipnUrl: String(form.gatewayConfig.ipnUrl || "").trim(),
      };
    }

    if (isBkash) {
      return {
        apiBaseUrl: String(form.gatewayConfig.apiBaseUrl || "").trim(),
        appKey: String(form.gatewayConfig.appKey || "").trim(),
        appSecret: String(form.gatewayConfig.appSecret || "").trim(),
        username: String(form.gatewayConfig.username || "").trim(),
        password: String(form.gatewayConfig.password || "").trim(),
        callbackBaseUrl: String(
          form.gatewayConfig.callbackBaseUrl || "",
        ).trim(),
        sandbox: Boolean(form.gatewayConfig.sandbox),
        currency: String(form.gatewayConfig.currency || "BDT").trim() || "BDT",
        successUrl: String(form.gatewayConfig.successUrl || "").trim(),
        failUrl: String(form.gatewayConfig.failUrl || "").trim(),
        cancelUrl: String(form.gatewayConfig.cancelUrl || "").trim(),
      };
    }

    if (isNagad) {
      return {
        merchantId: String(form.gatewayConfig.merchantId || "").trim(),
        merchantPrivateKey: String(
          form.gatewayConfig.merchantPrivateKey || "",
        ).trim(),
        gatewayPublicKey: String(
          form.gatewayConfig.gatewayPublicKey || "",
        ).trim(),
        apiBaseUrl: String(form.gatewayConfig.apiBaseUrl || "").trim(),
        callbackBaseUrl: String(
          form.gatewayConfig.callbackBaseUrl || "",
        ).trim(),
        brandLogoUrl: String(form.gatewayConfig.brandLogoUrl || "").trim(),
        clientType: String(form.gatewayConfig.clientType || "PC_WEB").trim(),
        apiVersion: String(form.gatewayConfig.apiVersion || "v-0.2.0").trim(),
        sandbox: Boolean(form.gatewayConfig.sandbox),
        currency: String(form.gatewayConfig.currency || "BDT").trim() || "BDT",
        successUrl: String(form.gatewayConfig.successUrl || "").trim(),
        failUrl: String(form.gatewayConfig.failUrl || "").trim(),
        cancelUrl: String(form.gatewayConfig.cancelUrl || "").trim(),
      };
    }

    return {};
  };

  const buildPayload = () => ({
    code: sanitizeCode(form.code) || sanitizeCode(form.type),
    type: String(form.type || "").trim(),
    channelType: String(form.channelType || "manual")
      .trim()
      .toLowerCase(),
    accountNo: isManual ? String(form.accountNo || "").trim() : "",
    instructions: String(form.instructions || "").trim(),
    requiresTransactionProof: isManual
      ? Boolean(form.requiresTransactionProof)
      : false,
    displayOrder: Number(form.displayOrder || 0),
    isActive: Boolean(form.isActive),
    gatewayConfig: buildGatewayPayload(),
  });

  const findExistingGatewayMethod = (channelType) =>
    paymentMethods.find(
      (method) =>
        String(method?.channelType || "")
          .trim()
          .toLowerCase() ===
          String(channelType || "")
            .trim()
            .toLowerCase() &&
        ["sslcommerz", "bkash", "nagad"].includes(
          String(method?.channelType || "")
            .trim()
            .toLowerCase(),
        ),
    );

  const handleSave = async (event) => {
    event.preventDefault();
    if (!validateForm()) return;

    try {
      setSaving(true);
      const payload = buildPayload();
      const existingGatewayMethod =
        !editingId && isGateway
          ? findExistingGatewayMethod(form.channelType)
          : null;

      if (editingId || existingGatewayMethod?._id) {
        const targetId = editingId || String(existingGatewayMethod._id || "");
        await axios.put(
          `${baseUrl}/auth/admin/payment-methods/${targetId}`,
          payload,
          {
            headers: getAuthHeaders(),
          },
        );
        toast.success("Payment method updated");
      } else {
        await axios.post(`${baseUrl}/auth/admin/payment-methods`, payload, {
          headers: getAuthHeaders(),
        });
        toast.success("Payment method created");
      }

      resetForm();
      loadPaymentMethods();
    } catch (error) {
      toast.error(
        error.response?.data?.error || "Failed to save payment method",
      );
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (method) => {
    const channelType = String(method?.channelType || "manual")
      .trim()
      .toLowerCase();
    const gatewayConfig =
      method?.gatewayConfig && typeof method.gatewayConfig === "object"
        ? method.gatewayConfig
        : {};

    setEditingId(String(method?._id || ""));
    setForm({
      code: method?.code || "",
      type: method?.type || "",
      channelType,
      accountNo: method?.accountNo || "",
      instructions: method?.instructions || "",
      requiresTransactionProof:
        channelType === "manual"
          ? method?.requiresTransactionProof === undefined
            ? true
            : Boolean(method?.requiresTransactionProof)
          : false,
      displayOrder: Number(method?.displayOrder || 0),
      isActive: method?.isActive !== false,
      gatewayConfig: {
        ...createGatewayConfig(),
        ...gatewayConfig,
      },
    });
  };

  const confirmDelete = async () => {
    if (!deleteConfirm?._id) return;

    try {
      setIsDeleting(true);
      await axios.delete(
        `${baseUrl}/auth/admin/payment-methods/${deleteConfirm._id}`,
        {
          headers: getAuthHeaders(),
        },
      );
      toast.success("Payment method deleted");
      if (editingId === String(deleteConfirm._id)) {
        resetForm();
      }
      setDeleteConfirm(null);
      loadPaymentMethods();
    } catch (error) {
      toast.error(
        error.response?.data?.error || "Failed to delete payment method",
      );
    } finally {
      setIsDeleting(false);
    }
  };

  if (!isAdmin) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-8 text-center">
        <h2 className="mb-2 text-xl font-semibold text-black">
          Admin Access Required
        </h2>
        <p className="text-gray-600">Only admin can manage payment methods.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl bg-linear-to-r from-zinc-900 to-black p-6 text-white md:p-8">
        <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full bg-white/10">
          <FiCreditCard className="h-6 w-6" />
        </div>
        <h1 className="text-2xl font-bold">Payment Methods</h1>
        <p className="mt-1 max-w-3xl text-sm text-zinc-200 md:text-base">
          Manage all five checkout methods here: SSLCommerz, manual payment,
          cash on delivery, bKash API, and Nagad API.
        </p>
      </div>

      <form
        onSubmit={handleSave}
        className="space-y-4 rounded-xl border border-gray-200 bg-white p-5 md:p-6"
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-black">
              {editingId ? "Edit Payment Method" : "Create Payment Method"}
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              {channelMeta.description}
            </p>
          </div>
          <div className="rounded-full border border-gray-200 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-gray-600">
            {channelMeta.label}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          <SearchableSelect
            value={form.channelType}
            onChange={(value) =>
              handleFormChange({ target: { name: "channelType", value } })
            }
            options={channelOptions}
            placeholder="Channel type"
            searchable={false}
            showOptionDescriptions={false}
            className="min-w-0"
            buttonClassName="rounded-lg border border-gray-200 px-3 py-2.5 text-sm"
            menuClassName="rounded-xl"
          />

          <input
            name="type"
            value={form.type}
            onChange={handleFormChange}
            placeholder="Payment method name"
            className="rounded-lg border border-gray-200 px-3 py-2.5 text-sm"
          />
        </div>

        <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full bg-black px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-white">
              {channelMeta.label}
            </span>
            {isManual ? (
              <>
                <span className="rounded-full bg-white px-3 py-1 text-[11px] font-semibold text-gray-700 ring-1 ring-black/5">
                  bKash
                </span>
                <span className="rounded-full bg-white px-3 py-1 text-[11px] font-semibold text-gray-700 ring-1 ring-black/5">
                  Nagad
                </span>
                <span className="rounded-full bg-white px-3 py-1 text-[11px] font-semibold text-gray-700 ring-1 ring-black/5">
                  Bank Transfer
                </span>
              </>
            ) : null}
            {isBkash ? (
              <span className="rounded-full bg-white px-3 py-1 text-[11px] font-semibold text-gray-700 ring-1 ring-black/5">
                Auto Paid
              </span>
            ) : null}
            {isNagad ? (
              <span className="rounded-full bg-white px-3 py-1 text-[11px] font-semibold text-gray-700 ring-1 ring-black/5">
                Auto Paid
              </span>
            ) : null}
            {isGateway ? (
              <span className="rounded-full bg-white px-3 py-1 text-[11px] font-semibold text-gray-700 ring-1 ring-black/5">
                Redirect Checkout
              </span>
            ) : null}
          </div>
          <p className="mt-3 text-sm text-gray-600">
            {channelMeta.description}
          </p>
        </div>

        {isManual ? (
          <div className="space-y-3">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <input
                name="accountNo"
                value={form.accountNo}
                onChange={handleFormChange}
                placeholder="Account / wallet number / bank details"
                className="rounded-lg border border-gray-200 px-3 py-2.5 text-sm"
              />
              <label className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2.5 text-sm text-gray-700">
                <input
                  type="checkbox"
                  name="requiresTransactionProof"
                  checked={Boolean(form.requiresTransactionProof)}
                  onChange={handleFormChange}
                  style={{ accentColor: themeColor }}
                />
                Require transaction ID in checkout
              </label>
            </div>
          </div>
        ) : null}

        {isSslCommerz ? (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <input
              value={form.gatewayConfig.storeId}
              onChange={(event) =>
                updateGatewayConfig("storeId", event.target.value)
              }
              placeholder="SSLCommerz store ID"
              className="rounded-lg border border-gray-200 px-3 py-2.5 text-sm"
            />
            <input
              value={form.gatewayConfig.storePassword}
              onChange={(event) =>
                updateGatewayConfig("storePassword", event.target.value)
              }
              placeholder="SSLCommerz store password"
              className="rounded-lg border border-gray-200 px-3 py-2.5 text-sm"
            />
            <input
              value={form.gatewayConfig.currency}
              onChange={(event) =>
                updateGatewayConfig("currency", event.target.value)
              }
              placeholder="Currency"
              className="rounded-lg border border-gray-200 px-3 py-2.5 text-sm uppercase"
            />
            <label className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2.5 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={Boolean(form.gatewayConfig.sandbox)}
                onChange={(event) =>
                  updateGatewayConfig("sandbox", event.target.checked)
                }
                style={{ accentColor: themeColor }}
              />
              Use sandbox mode
            </label>
            <input
              value={form.gatewayConfig.successUrl}
              onChange={(event) =>
                updateGatewayConfig("successUrl", event.target.value)
              }
              placeholder="Success URL (optional)"
              className="rounded-lg border border-gray-200 px-3 py-2.5 text-sm"
            />
            <input
              value={form.gatewayConfig.failUrl}
              onChange={(event) =>
                updateGatewayConfig("failUrl", event.target.value)
              }
              placeholder="Fail URL (optional)"
              className="rounded-lg border border-gray-200 px-3 py-2.5 text-sm"
            />
            <input
              value={form.gatewayConfig.cancelUrl}
              onChange={(event) =>
                updateGatewayConfig("cancelUrl", event.target.value)
              }
              placeholder="Cancel URL (optional)"
              className="rounded-lg border border-gray-200 px-3 py-2.5 text-sm"
            />
            <input
              value={form.gatewayConfig.ipnUrl}
              onChange={(event) =>
                updateGatewayConfig("ipnUrl", event.target.value)
              }
              placeholder="IPN URL (optional)"
              className="rounded-lg border border-gray-200 px-3 py-2.5 text-sm"
            />
          </div>
        ) : null}

        {isBkash ? (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <input
              value={form.gatewayConfig.apiBaseUrl}
              onChange={(event) =>
                updateGatewayConfig("apiBaseUrl", event.target.value)
              }
              placeholder="bKash API base URL"
              className="rounded-lg border border-gray-200 px-3 py-2.5 text-sm"
            />
            <input
              value={form.gatewayConfig.appKey}
              onChange={(event) =>
                updateGatewayConfig("appKey", event.target.value)
              }
              placeholder="bKash app key"
              className="rounded-lg border border-gray-200 px-3 py-2.5 text-sm"
            />
            <input
              value={form.gatewayConfig.appSecret}
              onChange={(event) =>
                updateGatewayConfig("appSecret", event.target.value)
              }
              placeholder="bKash app secret"
              className="rounded-lg border border-gray-200 px-3 py-2.5 text-sm"
            />
            <input
              value={form.gatewayConfig.username}
              onChange={(event) =>
                updateGatewayConfig("username", event.target.value)
              }
              placeholder="bKash username"
              className="rounded-lg border border-gray-200 px-3 py-2.5 text-sm"
            />
            <input
              value={form.gatewayConfig.password}
              onChange={(event) =>
                updateGatewayConfig("password", event.target.value)
              }
              placeholder="bKash password"
              className="rounded-lg border border-gray-200 px-3 py-2.5 text-sm"
            />
            <label className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2.5 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={Boolean(form.gatewayConfig.sandbox)}
                onChange={(event) =>
                  updateGatewayConfig("sandbox", event.target.checked)
                }
                style={{ accentColor: themeColor }}
              />
              Use sandbox mode
            </label>
            <input
              value={form.gatewayConfig.callbackBaseUrl}
              onChange={(event) =>
                updateGatewayConfig("callbackBaseUrl", event.target.value)
              }
              placeholder="Public backend base URL (optional override)"
              className="rounded-lg border border-gray-200 px-3 py-2.5 text-sm"
            />
            <input
              value={form.gatewayConfig.currency}
              onChange={(event) =>
                updateGatewayConfig("currency", event.target.value)
              }
              placeholder="Currency"
              className="rounded-lg border border-gray-200 px-3 py-2.5 text-sm uppercase"
            />
            <input
              value={form.gatewayConfig.successUrl}
              onChange={(event) =>
                updateGatewayConfig("successUrl", event.target.value)
              }
              placeholder="Success redirect URL (optional)"
              className="rounded-lg border border-gray-200 px-3 py-2.5 text-sm"
            />
            <input
              value={form.gatewayConfig.failUrl}
              onChange={(event) =>
                updateGatewayConfig("failUrl", event.target.value)
              }
              placeholder="Fail redirect URL (optional)"
              className="rounded-lg border border-gray-200 px-3 py-2.5 text-sm"
            />
            <input
              value={form.gatewayConfig.cancelUrl}
              onChange={(event) =>
                updateGatewayConfig("cancelUrl", event.target.value)
              }
              placeholder="Cancel redirect URL (optional)"
              className="rounded-lg border border-gray-200 px-3 py-2.5 text-sm"
            />
          </div>
        ) : null}

        {isNagad ? (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <input
              value={form.gatewayConfig.merchantId}
              onChange={(event) =>
                updateGatewayConfig("merchantId", event.target.value)
              }
              placeholder="Nagad merchant ID"
              className="rounded-lg border border-gray-200 px-3 py-2.5 text-sm"
            />
            <input
              value={form.gatewayConfig.apiBaseUrl}
              onChange={(event) =>
                updateGatewayConfig("apiBaseUrl", event.target.value)
              }
              placeholder="Nagad API base URL (optional)"
              className="rounded-lg border border-gray-200 px-3 py-2.5 text-sm"
            />
            <textarea
              value={form.gatewayConfig.merchantPrivateKey}
              onChange={(event) =>
                updateGatewayConfig("merchantPrivateKey", event.target.value)
              }
              rows={4}
              placeholder="Merchant private key"
              className="rounded-lg border border-gray-200 px-3 py-2.5 text-sm"
            />
            <textarea
              value={form.gatewayConfig.gatewayPublicKey}
              onChange={(event) =>
                updateGatewayConfig("gatewayPublicKey", event.target.value)
              }
              rows={4}
              placeholder="Nagad gateway public key"
              className="rounded-lg border border-gray-200 px-3 py-2.5 text-sm"
            />
            <input
              value={form.gatewayConfig.callbackBaseUrl}
              onChange={(event) =>
                updateGatewayConfig("callbackBaseUrl", event.target.value)
              }
              placeholder="Public backend base URL (optional override)"
              className="rounded-lg border border-gray-200 px-3 py-2.5 text-sm"
            />
            <input
              value={form.gatewayConfig.brandLogoUrl}
              onChange={(event) =>
                updateGatewayConfig("brandLogoUrl", event.target.value)
              }
              placeholder="Brand logo URL (optional)"
              className="rounded-lg border border-gray-200 px-3 py-2.5 text-sm"
            />
            <input
              value={form.gatewayConfig.clientType}
              onChange={(event) =>
                updateGatewayConfig("clientType", event.target.value)
              }
              placeholder="Client type"
              className="rounded-lg border border-gray-200 px-3 py-2.5 text-sm uppercase"
            />
            <input
              value={form.gatewayConfig.apiVersion}
              onChange={(event) =>
                updateGatewayConfig("apiVersion", event.target.value)
              }
              placeholder="API version"
              className="rounded-lg border border-gray-200 px-3 py-2.5 text-sm"
            />
            <label className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2.5 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={Boolean(form.gatewayConfig.sandbox)}
                onChange={(event) =>
                  updateGatewayConfig("sandbox", event.target.checked)
                }
                style={{ accentColor: themeColor }}
              />
              Use sandbox mode
            </label>
            <input
              value={form.gatewayConfig.currency}
              onChange={(event) =>
                updateGatewayConfig("currency", event.target.value)
              }
              placeholder="Currency"
              className="rounded-lg border border-gray-200 px-3 py-2.5 text-sm uppercase"
            />
            <input
              value={form.gatewayConfig.successUrl}
              onChange={(event) =>
                updateGatewayConfig("successUrl", event.target.value)
              }
              placeholder="Success redirect URL (optional)"
              className="rounded-lg border border-gray-200 px-3 py-2.5 text-sm"
            />
            <input
              value={form.gatewayConfig.failUrl}
              onChange={(event) =>
                updateGatewayConfig("failUrl", event.target.value)
              }
              placeholder="Fail redirect URL (optional)"
              className="rounded-lg border border-gray-200 px-3 py-2.5 text-sm"
            />
            <input
              value={form.gatewayConfig.cancelUrl}
              onChange={(event) =>
                updateGatewayConfig("cancelUrl", event.target.value)
              }
              placeholder="Cancel redirect URL (optional)"
              className="rounded-lg border border-gray-200 px-3 py-2.5 text-sm"
            />
          </div>
        ) : null}

        <textarea
          name="instructions"
          value={form.instructions}
          onChange={handleFormChange}
          rows={3}
          placeholder={
            isCod
              ? "Optional COD instructions shown to customer"
              : isGateway
                ? "Optional gateway instructions shown in checkout"
                : "Optional checkout instructions"
          }
          className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm"
        />

        <div className="space-y-3">
          <label className="inline-flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              name="isActive"
              checked={Boolean(form.isActive)}
              onChange={handleFormChange}
              style={{ accentColor: themeColor }}
            />
            Active in checkout
          </label>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-black px-5 py-2.5 font-medium text-white disabled:opacity-60"
            >
              {saving
                ? "Saving..."
                : editingId
                  ? "Update Method"
                  : "Create Method"}
            </button>
            {editingId ? (
              <button
                type="button"
                onClick={resetForm}
                className="rounded-lg border border-gray-300 px-5 py-2.5"
              >
                Cancel
              </button>
            ) : null}
          </div>
        </div>
      </form>

      <div className="rounded-xl border border-gray-200 bg-white p-5 md:p-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-black">
              Configured Methods ({paymentMethods.length})
            </h2>
            <p className="text-sm text-gray-500">
              You can now manage manual, COD, SSLCommerz, bKash, and Nagad
              payment methods from one place.
            </p>
          </div>
          <button
            type="button"
            onClick={loadPaymentMethods}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm"
          >
            <FiRefreshCw
              className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
            />
            Refresh
          </button>
        </div>

        {loading ? (
          <p className="text-sm text-gray-600">Loading payment methods...</p>
        ) : paymentMethods.length === 0 ? (
          <p className="text-sm text-gray-600">
            No payment methods configured yet.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            {paymentMethods.map((method) => {
              const channelType = String(method?.channelType || "manual")
                .trim()
                .toLowerCase();
              const isMethodManual = channelType === "manual";
              const isMethodCod = channelType === "cod";
              const methodMeta = getChannelMeta(channelType);

              return (
                <div
                  key={method._id}
                  className="rounded-xl border border-gray-200 p-4 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold text-black">
                          {method.type}
                        </p>
                        <span className="rounded-full bg-gray-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-600">
                          {methodMeta.label}
                        </span>
                        {method.isActive === false ? (
                          <span className="rounded-full bg-rose-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-rose-700">
                            Inactive
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-700">
                            <FiCheckCircle className="h-3.5 w-3.5" />
                            Active
                          </span>
                        )}
                      </div>
                      {isMethodManual && method.accountNo ? (
                        <p className="text-sm text-gray-700">
                          Collect to: {method.accountNo}
                        </p>
                      ) : null}
                      {method.instructions ? (
                        <p className="text-sm text-gray-600">
                          {method.instructions}
                        </p>
                      ) : null}
                      {isMethodCod ? (
                        <p className="text-sm text-gray-600">
                          Cash on Delivery uses the district-based shipping
                          rules shown during checkout.
                        </p>
                      ) : null}
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => startEdit(method)}
                        className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteConfirm(method)}
                        className="inline-flex items-center gap-2 rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50"
                      >
                        <FiTrash2 className="h-4 w-4" />
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <ConfirmModal
        isOpen={Boolean(deleteConfirm)}
        onCancel={() => setDeleteConfirm(null)}
        onConfirm={confirmDelete}
        title="Delete payment method?"
        message={`This will remove "${deleteConfirm?.type || "this payment method"}" from checkout.`}
        confirmLabel={isDeleting ? "Deleting..." : "Delete"}
        cancelLabel="Keep"
        isDanger
        isLoading={isDeleting}
      />
    </div>
  );
};

export default AdminPaymentMethods;
