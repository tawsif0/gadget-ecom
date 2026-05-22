import React, { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { toast } from "react-hot-toast";
import {
  FiCheckCircle,
  FiEdit2,
  FiHome,
  FiMapPin,
  FiPlus,
  FiTrash2,
} from "react-icons/fi";
import { useAuth } from "../hooks/useAuth";
import { useThemeColors } from "../hooks/useThemeColors";
import { BANGLADESH_DISTRICT_OPTIONS } from "../utils/bangladeshLocations";
import ConfirmModal from "../components/ConfirmModal";
import SearchableSelect from "../components/SearchableSelect";

const baseUrl = import.meta.env.VITE_API_URL;

const getAuthHeaders = () => {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const emptyForm = {
  label: "Home",
  recipientName: "",
  phone: "",
  alternativePhone: "",
  address: "",
  city: "",
  subCity: "",
  district: "",
  postalCode: "",
  country: "Bangladesh",
  deliveryNotes: "",
  isDefault: false,
};

const inputClassName =
  "w-full rounded-[20px] border border-black/8 bg-white px-4 py-3 text-sm text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-black";

const actionButtonBaseClassName =
  "inline-flex items-center justify-center gap-2 rounded-full px-4 py-2.5 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-60";

const neutralActionButtonClassName = `${actionButtonBaseClassName} border border-slate-200 bg-white text-slate-700 hover:border-slate-900 hover:text-black`;
const successActionButtonClassName = `${actionButtonBaseClassName} border border-emerald-200 bg-emerald-50 text-emerald-700 hover:border-emerald-300 hover:bg-emerald-100`;
const dangerActionButtonClassName = `${actionButtonBaseClassName} border border-rose-200 bg-rose-50 text-rose-700 hover:border-rose-300 hover:bg-rose-100`;
const newAddressButtonClassName =
  "inline-flex items-center justify-center gap-2 rounded-full border border-slate-900 bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800";

const MyAddresses = () => {
  const { user, updateUser } = useAuth();
  const { themeColor } = useThemeColors();
  const [addresses, setAddresses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState("");
  const [deletingId, setDeletingId] = useState("");
  const [defaultingId, setDefaultingId] = useState("");
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [form, setForm] = useState(emptyForm);

  const canSave = useMemo(
    () =>
      Boolean(
        form.recipientName &&
        form.phone &&
        form.address &&
        form.city &&
        form.district &&
        form.postalCode,
      ),
    [form],
  );

  const districtOptions = useMemo(
    () =>
      BANGLADESH_DISTRICT_OPTIONS.map((district) => ({
        value: district,
        label: district,
      })),
    [],
  );

  const syncUserPayload = useCallback(
    (payload) => {
      const nextUser = payload?.user || null;
      if (nextUser) {
        updateUser(nextUser);
      }
      setAddresses(
        Array.isArray(payload?.addressBook) ? payload.addressBook : [],
      );
    },
    [updateUser],
  );

  const fetchAddresses = useCallback(async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${baseUrl}/auth/addresses`, {
        headers: getAuthHeaders(),
      });
      syncUserPayload(response.data);
    } catch (error) {
      toast.error(error.response?.data?.error || "Failed to load addresses");
    } finally {
      setLoading(false);
    }
  }, [syncUserPayload]);

  useEffect(() => {
    fetchAddresses();
  }, [fetchAddresses]);

  const resetForm = () => {
    setEditingId("");
    setForm(emptyForm);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!canSave) {
      toast.error("Complete the required address fields first");
      return;
    }

    setSaving(true);
    try {
      const response = editingId
        ? await axios.put(`${baseUrl}/auth/addresses/${editingId}`, form, {
            headers: getAuthHeaders(),
          })
        : await axios.post(`${baseUrl}/auth/addresses`, form, {
            headers: getAuthHeaders(),
          });

      syncUserPayload(response.data);
      toast.success(editingId ? "Address updated" : "Address saved");
      resetForm();
    } catch (error) {
      toast.error(error.response?.data?.error || "Failed to save address");
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (address) => {
    setEditingId(String(address?._id || ""));
    setForm({
      label: String(address?.label || "Home"),
      recipientName: String(address?.recipientName || ""),
      phone: String(address?.phone || ""),
      alternativePhone: String(address?.alternativePhone || ""),
      address: String(address?.address || ""),
      city: String(address?.city || ""),
      subCity: String(address?.subCity || ""),
      district: String(address?.district || ""),
      postalCode: String(address?.postalCode || ""),
      country: String(address?.country || "Bangladesh"),
      deliveryNotes: String(address?.deliveryNotes || ""),
      isDefault: Boolean(address?.isDefault),
    });
  };

  const handleDelete = async (addressId) => {
    if (!addressId) return;
    setDeletingId(addressId);
    try {
      const response = await axios.delete(
        `${baseUrl}/auth/addresses/${addressId}`,
        {
          headers: getAuthHeaders(),
        },
      );
      syncUserPayload(response.data);
      toast.success("Address deleted");
      if (editingId === addressId) {
        resetForm();
      }
      setDeleteTarget(null);
    } catch (error) {
      toast.error(error.response?.data?.error || "Failed to delete address");
    } finally {
      setDeletingId("");
    }
  };

  const handleSetDefault = async (addressId) => {
    setDefaultingId(addressId);
    try {
      const response = await axios.patch(
        `${baseUrl}/auth/addresses/${addressId}/default`,
        {},
        {
          headers: getAuthHeaders(),
        },
      );
      syncUserPayload(response.data);
      toast.success("Default address updated");
      if (editingId === addressId) {
        setForm((current) => ({ ...current, isDefault: true }));
      }
    } catch (error) {
      toast.error(
        error.response?.data?.error || "Failed to update default address",
      );
    } finally {
      setDefaultingId("");
    }
  };

  return (
    <div className="w-full p-1 md:p-2">
      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <section className="app-panel p-5 md:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 pb-5">
            <div className="app-panel-muted px-4 py-3 text-sm text-gray-700">
              {addresses.length} saved address
              {addresses.length === 1 ? "" : "es"}
            </div>
            <button
              type="button"
              onClick={resetForm}
              className={newAddressButtonClassName}
            >
              <FiPlus className="h-4 w-4" />
              New address
            </button>
          </div>

          {loading ? (
            <div className="py-10 text-center text-sm text-gray-600">
              Loading addresses...
            </div>
          ) : addresses.length === 0 ? (
            <div className="py-12 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-3xl bg-gray-100 text-gray-500">
                <FiMapPin className="h-6 w-6" />
              </div>
              <h2 className="mt-4 text-lg font-bold text-black">
                No saved addresses yet
              </h2>
              <p className="mt-2 text-sm text-gray-600">
                Add a delivery address now so checkout can be filled instantly
                later.
              </p>
            </div>
          ) : (
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              {addresses.map((address) => (
                <article
                  key={address._id}
                  className={`rounded-[28px] border p-5 shadow-sm transition ${
                    address.isDefault
                      ? "border-black/20 bg-slate-50"
                      : "border-black/8 bg-white"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center gap-2 rounded-full bg-black px-3 py-1 text-xs font-semibold text-white">
                          <FiHome className="h-3.5 w-3.5" />
                          {address.label || "Address"}
                        </span>
                        {address.isDefault ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
                            <FiCheckCircle className="h-3.5 w-3.5" />
                            Default
                          </span>
                        ) : null}
                      </div>
                      <h3 className="mt-4 text-base font-bold text-black">
                        {address.recipientName}
                      </h3>
                      <p className="mt-1 text-sm text-gray-600">
                        {address.phone}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 space-y-1 text-sm text-gray-600">
                    <p>{address.address}</p>
                    <p>
                      {[address.subCity, address.city, address.district]
                        .filter(Boolean)
                        .join(", ")}
                    </p>
                    <p>
                      {[address.postalCode, address.country]
                        .filter(Boolean)
                        .join(", ")}
                    </p>
                    {address.deliveryNotes ? (
                      <p className="pt-1 text-xs text-gray-500">
                        {address.deliveryNotes}
                      </p>
                    ) : null}
                  </div>

                  <div className="mt-5 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => handleEdit(address)}
                      className={neutralActionButtonClassName}
                    >
                      <FiEdit2 className="h-3.5 w-3.5" />
                      Edit
                    </button>
                    {!address.isDefault ? (
                      <button
                        type="button"
                        onClick={() => handleSetDefault(String(address._id))}
                        disabled={defaultingId === String(address._id)}
                        className={successActionButtonClassName}
                      >
                        <FiCheckCircle className="h-3.5 w-3.5" />
                        {defaultingId === String(address._id)
                          ? "Saving..."
                          : "Set Default"}
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(address)}
                      disabled={deletingId === String(address._id)}
                      className={dangerActionButtonClassName}
                    >
                      <FiTrash2 className="h-3.5 w-3.5" />
                      {deletingId === String(address._id)
                        ? "Deleting..."
                        : "Delete"}
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="app-panel p-5 md:p-6">
          <div className="flex items-start justify-between gap-3 border-b border-gray-200 pb-5">
            <div>
              <p className="app-kicker">Address book editor</p>
              <h2 className="mt-3 text-xl font-black text-black">
                {editingId ? "Update saved address" : "Add new address"}
              </h2>
            </div>
            {editingId ? (
              <button
                type="button"
                onClick={resetForm}
                className={newAddressButtonClassName}
              >
                <FiPlus className="h-3.5 w-3.5" />
                New address
              </button>
            ) : null}
          </div>

          <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
            <div className="grid gap-4 sm:grid-cols-2">
              <input
                className={inputClassName}
                placeholder="Label"
                value={form.label}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    label: event.target.value,
                  }))
                }
              />
              <input
                className={inputClassName}
                placeholder="Recipient name"
                value={form.recipientName}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    recipientName: event.target.value,
                  }))
                }
              />
              <input
                className={inputClassName}
                placeholder="Phone"
                value={form.phone}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    phone: event.target.value,
                  }))
                }
              />
              <input
                className={inputClassName}
                placeholder="Alternative phone"
                value={form.alternativePhone}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    alternativePhone: event.target.value,
                  }))
                }
              />
            </div>

            <textarea
              rows="3"
              className={`${inputClassName} min-h-[110px] resize-y`}
              placeholder="Street address"
              value={form.address}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  address: event.target.value,
                }))
              }
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <input
                className={inputClassName}
                placeholder="City"
                value={form.city}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    city: event.target.value,
                  }))
                }
              />
              <input
                className={inputClassName}
                placeholder="Sub-city"
                value={form.subCity}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    subCity: event.target.value,
                  }))
                }
              />
              <SearchableSelect
                value={form.district}
                onChange={(value) =>
                  setForm((current) => ({
                    ...current,
                    district: value,
                  }))
                }
                options={
                  form.district &&
                  !BANGLADESH_DISTRICT_OPTIONS.includes(form.district)
                    ? [
                        { value: form.district, label: form.district },
                        ...districtOptions,
                      ]
                    : districtOptions
                }
                placeholder="Select district"
                className="w-full"
                buttonClassName="min-h-[52px] rounded-[20px] border-black/8 px-4 py-3 text-sm text-gray-900 hover:border-black"
                menuClassName="rounded-[20px]"
              />
              <input
                className={inputClassName}
                placeholder="Postal code"
                value={form.postalCode}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    postalCode: event.target.value,
                  }))
                }
              />
              <input
                className={inputClassName}
                placeholder="Country"
                value={form.country}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    country: event.target.value,
                  }))
                }
              />
              <label className="flex items-center gap-3 rounded-[20px] border border-black/8 px-4 py-3 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={form.isDefault}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      isDefault: event.target.checked,
                    }))
                  }
                  style={{ accentColor: themeColor }}
                />
                Make this my default delivery address
              </label>
            </div>

            <textarea
              rows="3"
              className={`${inputClassName} min-h-[96px] resize-y`}
              placeholder="Delivery notes"
              value={form.deliveryNotes}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  deliveryNotes: event.target.value,
                }))
              }
            />

            <div className="flex flex-wrap gap-3 pt-2">
              <button
                type="submit"
                disabled={!canSave || saving}
                className="app-btn-primary rounded-lg px-5 py-3 text-sm font-medium shadow-md hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-60 transition-shadow"
              >
                {saving
                  ? "Saving..."
                  : editingId
                    ? "Update Address"
                    : "Save Address"}
              </button>
              {editingId ? (
                <button
                  type="button"
                  onClick={resetForm}
                  className="app-btn-secondary px-5 py-3 text-sm"
                >
                  Cancel
                </button>
              ) : null}
            </div>
          </form>

          <div className="app-panel-muted mt-6 p-4 text-sm text-gray-600">
            Logged in as{" "}
            <span className="font-semibold text-black">
              {user?.name || "Customer"}
            </span>
            . Your default saved address can now be used directly in checkout.
          </div>
        </section>
      </div>

      <ConfirmModal
        isOpen={Boolean(deleteTarget)}
        title="Delete saved address"
        message={
          deleteTarget?.recipientName
            ? `Delete the saved address for ${deleteTarget.recipientName}?`
            : "Delete this saved address?"
        }
        confirmLabel="Delete"
        cancelLabel="Cancel"
        isDanger
        isLoading={
          Boolean(deleteTarget?._id) &&
          deletingId === String(deleteTarget?._id || "")
        }
        onCancel={() => {
          if (!deletingId) {
            setDeleteTarget(null);
          }
        }}
        onConfirm={() => handleDelete(String(deleteTarget?._id || ""))}
      />
    </div>
  );
};

export default MyAddresses;
