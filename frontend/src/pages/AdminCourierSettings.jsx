import React, { useEffect, useMemo } from "react";
import {
  FiTruck,
  FiSave,
  FiSettings,
  FiToggleLeft,
  FiToggleRight,
} from "react-icons/fi";
import { useDispatch, useSelector } from "react-redux";
import { toast } from "react-hot-toast";
import { useAuth } from "../hooks/useAuth";
import {
  loadAdminSettings,
  saveAdminSettings,
  selectAdminSettingsDraft,
  selectPublicSettingsState,
  updateAdminField,
} from "../store/publicSettingsSlice";

const baseProviderOrder = [
  "steadfast",
  "pathao",
  "ecourier",
  "carrybee",
  "redx",
];
const COURIER_PROVIDER_DEFINITIONS = {
  steadfast: { label: "Steadfast" },
  pathao: { label: "Pathao" },
  ecourier: { label: "eCourier" },
  carrybee: { label: "CarryBee" },
  redx: { label: "RedX" },
};

const sectionClass = "app-panel space-y-4 p-5 md:p-6";
const inputClass =
  "w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-black outline-none transition focus:border-black";

const defaultCourierConfig = (label) => ({
  providerName: label,
  enabled: false,
  apiBaseUrl: "",
  apiToken: "",
  apiKey: "",
  apiSecret: "",
  consignmentPath: "/consignments",
  trackingPath: "/track",
  labelPath: "/label",
  timeoutMs: 12000,
});

const AdminCourierSettings = () => {
  const { user } = useAuth();
  const dispatch = useDispatch();
  const settings = useSelector(selectAdminSettingsDraft);
  const { adminStatus, saveStatus } = useSelector(selectPublicSettingsState);
  const loading = adminStatus === "idle" || adminStatus === "loading";
  const saving = saveStatus === "loading";

  const isAdmin = useMemo(
    () => String(user?.userType || "").toLowerCase() === "admin",
    [user?.userType],
  );

  useEffect(() => {
    if (!isAdmin) return;

    dispatch(loadAdminSettings())
      .unwrap()
      .catch((message) => {
        toast.error(message || "Failed to load courier settings");
      });
  }, [dispatch, isAdmin]);

  const courierMap = useMemo(() => {
    const current =
      settings?.couriers && typeof settings.couriers === "object"
        ? settings.couriers
        : {};

    return baseProviderOrder.reduce((accumulator, providerKey) => {
      const label =
        COURIER_PROVIDER_DEFINITIONS[providerKey]?.label || providerKey;
      accumulator[providerKey] = {
        ...defaultCourierConfig(label),
        ...(current[providerKey] || {}),
        providerName: String(
          current[providerKey]?.providerName || label,
        ).trim(),
        enabled: Boolean(current[providerKey]?.enabled),
        timeoutMs: Math.max(
          1000,
          parseInt(current[providerKey]?.timeoutMs, 10) || 12000,
        ),
      };
      return accumulator;
    }, {});
  }, [settings?.couriers]);

  const updateCourier = (providerKey, key, value) => {
    const nextConfig = {
      ...courierMap[providerKey],
      [key]: key === "enabled" ? Boolean(value) : value,
    };

    if (key === "timeoutMs") {
      nextConfig.timeoutMs = Math.max(1000, parseInt(value, 10) || 12000);
    }

    dispatch(
      updateAdminField({
        key: "couriers",
        value: {
          ...courierMap,
          [providerKey]: nextConfig,
        },
      }),
    );
  };

  const handleSave = async (event) => {
    event.preventDefault();

    try {
      await dispatch(
        saveAdminSettings({
          couriers: courierMap,
          courier: { ...(settings?.courier || {}) },
        }),
      ).unwrap();
      toast.success("Courier settings saved");
    } catch (error) {
      toast.error(error || "Failed to save courier settings");
    }
  };

  if (!isAdmin) {
    return (
      <div className="app-panel p-8 text-center">
        <h2 className="mb-2 text-xl font-semibold text-black">
          Admin Access Required
        </h2>
        <p className="text-gray-600">Only admin can manage courier settings.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="app-hero p-6 md:p-8">
        <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full bg-white/10">
          <FiTruck className="h-6 w-6" />
        </div>
        <p className="app-kicker text-white/65!">Courier setup</p>
        <h1 className="mt-3 text-2xl font-black md:text-3xl">Courier Setup</h1>
        <p className="mt-2 max-w-2xl text-sm text-zinc-200 md:text-base">
          Configure the courier providers used for order handoff and tracking.
          Enable only the couriers you want available in the order lifecycle.
        </p>
      </div>

      <form onSubmit={handleSave} className="space-y-5">
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
          {baseProviderOrder.map((providerKey) => {
            const courier = courierMap[providerKey];
            const providerLabel =
              courier?.providerName ||
              COURIER_PROVIDER_DEFINITIONS[providerKey]?.label ||
              providerKey;

            return (
              <section key={providerKey} className={sectionClass}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold text-black">
                      {providerLabel}
                    </h2>
                    <p className="text-sm text-gray-600">
                      Store API credentials and endpoint paths for this courier.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      updateCourier(providerKey, "enabled", !courier?.enabled)
                    }
                    className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] ${
                      courier?.enabled
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {courier?.enabled ? (
                      <FiToggleRight className="h-4 w-4" />
                    ) : (
                      <FiToggleLeft className="h-4 w-4" />
                    )}
                    {courier?.enabled ? "Enabled" : "Disabled"}
                  </button>
                </div>

                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <input
                    value={courier?.providerName || providerLabel}
                    onChange={(event) =>
                      updateCourier(
                        providerKey,
                        "providerName",
                        event.target.value,
                      )
                    }
                    placeholder="Provider name"
                    className={inputClass}
                  />
                  <input
                    value={courier?.apiBaseUrl || ""}
                    onChange={(event) =>
                      updateCourier(
                        providerKey,
                        "apiBaseUrl",
                        event.target.value,
                      )
                    }
                    placeholder="API base URL"
                    className={inputClass}
                  />
                  <input
                    value={courier?.apiToken || ""}
                    onChange={(event) =>
                      updateCourier(providerKey, "apiToken", event.target.value)
                    }
                    placeholder="API token"
                    className={inputClass}
                  />
                  <input
                    value={courier?.apiKey || ""}
                    onChange={(event) =>
                      updateCourier(providerKey, "apiKey", event.target.value)
                    }
                    placeholder="API key"
                    className={inputClass}
                  />
                  <input
                    value={courier?.apiSecret || ""}
                    onChange={(event) =>
                      updateCourier(
                        providerKey,
                        "apiSecret",
                        event.target.value,
                      )
                    }
                    placeholder="API secret"
                    className={inputClass}
                  />
                  <input
                    type="number"
                    min="1000"
                    step="500"
                    value={courier?.timeoutMs || 12000}
                    onChange={(event) =>
                      updateCourier(
                        providerKey,
                        "timeoutMs",
                        event.target.value,
                      )
                    }
                    placeholder="Timeout (ms)"
                    className={inputClass}
                  />
                  <input
                    value={courier?.consignmentPath || ""}
                    onChange={(event) =>
                      updateCourier(
                        providerKey,
                        "consignmentPath",
                        event.target.value,
                      )
                    }
                    placeholder="Consignment path"
                    className={inputClass}
                  />
                  <input
                    value={courier?.trackingPath || ""}
                    onChange={(event) =>
                      updateCourier(
                        providerKey,
                        "trackingPath",
                        event.target.value,
                      )
                    }
                    placeholder="Tracking path"
                    className={inputClass}
                  />
                  <input
                    value={courier?.labelPath || ""}
                    onChange={(event) =>
                      updateCourier(
                        providerKey,
                        "labelPath",
                        event.target.value,
                      )
                    }
                    placeholder="Label path"
                    className={inputClass}
                  />
                </div>
              </section>
            );
          })}
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving || loading}
            className="app-btn-primary inline-flex items-center gap-2 rounded-lg px-5 py-3 text-sm font-medium shadow-md hover:shadow-lg disabled:opacity-60 transition-shadow"
          >
            <FiSave className="h-4 w-4" />
            {saving ? "Saving..." : "Save Courier Setup"}
          </button>
        </div>
      </form>
    </div>
  );
};

export default AdminCourierSettings;
