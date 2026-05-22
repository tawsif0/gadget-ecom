import React, { useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  FiArrowRight,
  FiBell,
  FiCheck,
  FiCheckCircle,
  FiCreditCard,
  FiTrash2,
  FiInbox,
  FiMail,
  FiMessageSquare,
  FiPackage,
  FiRadio,
  FiRefreshCw,
  FiTruck,
} from "react-icons/fi";
import {
  clearAllNotifications,
  deleteNotification,
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "../store/notificationsSlice";
import {
  formatNotificationTime,
  getNotificationRoleCopy,
  getNotificationTarget,
  getNotificationTypeLabel,
} from "../utils/notificationHelpers";
import ConfirmModal from "../components/ConfirmModal";

const filterOptions = [
  { value: "all", label: "All" },
  { value: "unread", label: "Unread" },
  { value: "read", label: "Read" },
];

const MotionButton = motion.button;

const getNotificationMeta = (notification) => {
  switch (String(notification?.type || "").trim()) {
    case "admin_order_created":
    case "order_created":
      return {
        Icon: FiPackage,
        badgeClass: "bg-sky-100 text-sky-700",
        iconClass: "bg-sky-500/10 text-sky-700",
      };
    case "order_status_updated":
    case "order_cancelled":
    case "order_cancellation_requested":
    case "order_cancellation_updated":
      return {
        Icon: FiTruck,
        badgeClass: "bg-amber-100 text-amber-700",
        iconClass: "bg-amber-500/10 text-amber-700",
      };
    case "payment_status_updated":
      return {
        Icon: FiCreditCard,
        badgeClass: "bg-emerald-100 text-emerald-700",
        iconClass: "bg-emerald-500/10 text-emerald-700",
      };
    case "review_pending":
    case "review_status_updated":
      return {
        Icon: FiMessageSquare,
        badgeClass: "bg-violet-100 text-violet-700",
        iconClass: "bg-violet-500/10 text-violet-700",
      };
    case "contact_submission":
      return {
        Icon: FiMail,
        badgeClass: "bg-cyan-100 text-cyan-700",
        iconClass: "bg-cyan-500/10 text-cyan-700",
      };
    default:
      return {
        Icon: FiBell,
        badgeClass: "bg-slate-100 text-slate-700",
        iconClass: "bg-slate-500/10 text-slate-700",
      };
  }
};

const NotificationsCenter = ({ user, onNavigate }) => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const {
    items: notifications = [],
    isLoading,
    streamConnected,
  } = useSelector((state) => state.notifications);
  const [filter, setFilter] = useState("all");
  const [openingId, setOpeningId] = useState("");
  const [deletingId, setDeletingId] = useState("");
  const [clearingAll, setClearingAll] = useState(false);
  const [showClearAllConfirm, setShowClearAllConfirm] = useState(false);

  const copy = getNotificationRoleCopy(user);
  const unreadCount = notifications.filter((item) => !item.isRead).length;
  const summary = {
    total: notifications.length,
    unread: unreadCount,
    read: Math.max(0, notifications.length - unreadCount),
  };

  const filteredNotifications = useMemo(() => {
    if (filter === "unread") {
      return notifications.filter((item) => !item.isRead);
    }

    if (filter === "read") {
      return notifications.filter((item) => item.isRead);
    }

    return notifications;
  }, [filter, notifications]);

  const refreshNotifications = () => {
    dispatch(fetchNotifications());
  };

  const handleMarkAllRead = () => {
    dispatch(markAllNotificationsRead());
  };

  const handleDeleteNotification = async (event, notificationId) => {
    event.stopPropagation();
    if (!notificationId) return;

    try {
      setDeletingId(notificationId);
      await dispatch(deleteNotification(notificationId)).unwrap();
    } finally {
      setDeletingId("");
    }
  };

  const handleClearAllNotifications = async () => {
    if (!notifications.length) return;

    try {
      setClearingAll(true);
      await dispatch(clearAllNotifications()).unwrap();
      setShowClearAllConfirm(false);
    } finally {
      setClearingAll(false);
    }
  };

  const openNotification = async (notification) => {
    if (!notification) return;

    try {
      setOpeningId(notification._id || "");

      if (notification._id && !notification.isRead) {
        await dispatch(markNotificationRead(notification._id));
      }

      const target = getNotificationTarget(notification, user);
      const link = String(notification?.link || "").trim();

      if (target?.targetTab && onNavigate) {
        onNavigate(target.targetTab);
        return;
      }

      if (link && link !== "/dashboard") {
        navigate(link);
      }
    } finally {
      setOpeningId("");
    }
  };

  return (
    <div
      className="space-y-6"
      style={{ fontFamily: 'var(--brand-font-family, "Poppins", sans-serif)' }}
    >
      <div className="overflow-hidden rounded-3xl border border-white/60 bg-[radial-gradient(850px_circle_at_0%_0%,rgba(14,165,233,0.22),transparent_45%),radial-gradient(850px_circle_at_100%_0%,rgba(16,185,129,0.14),transparent_42%),linear-gradient(135deg,rgba(15,23,42,0.96),rgba(30,41,59,0.92))] p-6 text-white md:p-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.32em] text-white/70">
              Live Alerts
            </p>
            <h2 className="mt-2 text-3xl font-semibold md:text-4xl">
              {copy.title}
            </h2>
            <p className="mt-2 max-w-2xl text-sm text-white/80">
              {copy.subtitle}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm">
              <FiRadio
                className={`h-4 w-4 ${
                  streamConnected ? "text-emerald-300" : "text-amber-300"
                }`}
              />
              <span>{streamConnected ? "Live connected" : "Reconnecting"}</span>
            </div>
            <button
              type="button"
              onClick={refreshNotifications}
              className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/20"
            >
              <FiRefreshCw className={isLoading ? "animate-spin" : ""} />
              Refresh
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {[
          { label: "Total", value: summary.total, icon: FiInbox },
          { label: "Unread", value: summary.unread, icon: FiBell },
          { label: "Read", value: summary.read, icon: FiCheckCircle },
        ].map((item) => (
          <div
            key={item.label}
            className="rounded-3xl border border-slate-200/70 bg-white/90 p-5 shadow-[0_20px_50px_rgba(15,23,42,0.08)]"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.22em] text-slate-500">
                  {item.label}
                </p>
                <p className="mt-3 text-3xl font-semibold text-slate-900">
                  {item.value}
                </p>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-900 text-white">
                <item.icon className="h-5 w-5" />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-3xl border border-slate-200/70 bg-white/90 p-5 shadow-[0_24px_60px_rgba(15,23,42,0.08)]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-2">
            {filterOptions.map((option) => {
              const active = filter === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setFilter(option.value)}
                  className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                    active
                      ? "bg-slate-900 text-white"
                      : "border border-slate-200 bg-slate-50 text-slate-700 hover:bg-white"
                  }`}
                >
                  {option.label}
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleMarkAllRead}
              disabled={!unreadCount}
              className="inline-flex items-center justify-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <FiCheck className="h-4 w-4" />
              Mark all as read
            </button>
            <button
              type="button"
              onClick={() => setShowClearAllConfirm(true)}
              disabled={!notifications.length || clearingAll}
              className="inline-flex items-center justify-center gap-2 rounded-full border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <FiTrash2 className="h-4 w-4" />
              {clearingAll ? "Deleting..." : "Delete all"}
            </button>
          </div>
        </div>

        <div className="mt-5 space-y-3">
          {filteredNotifications.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 px-6 py-12 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-slate-400 shadow-sm">
                <FiInbox className="h-6 w-6" />
              </div>
              <h3 className="mt-4 text-lg font-semibold text-slate-900">
                Nothing to review here
              </h3>
              <p className="mt-2 text-sm text-slate-500">{copy.empty}</p>
            </div>
          ) : (
            filteredNotifications.map((notification) => {
              const { Icon, badgeClass, iconClass } =
                getNotificationMeta(notification);
              const typeLabel = getNotificationTypeLabel(notification);
              const opening = openingId === notification._id;
              const deleting = deletingId === notification._id;

              return (
                <MotionButton
                  key={notification._id}
                  type="button"
                  whileHover={{ y: -2 }}
                  onClick={() => openNotification(notification)}
                  className={`w-full rounded-3xl border px-5 py-5 text-left transition ${
                    notification.isRead
                      ? "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                      : "border-slate-900 bg-slate-900 text-white hover:bg-slate-800"
                  }`}
                >
                  <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`inline-flex h-10 w-10 items-center justify-center rounded-2xl ${
                            notification.isRead
                              ? iconClass
                              : "bg-white/10 text-white"
                          }`}
                        >
                          <Icon className="h-4 w-4" />
                        </span>
                        <span
                          className={`inline-flex rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${
                            notification.isRead
                              ? badgeClass
                              : "bg-white/10 text-white"
                          }`}
                        >
                          {typeLabel}
                        </span>
                        {!notification.isRead && (
                          <span className="inline-flex rounded-full bg-rose-500 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-white">
                            New
                          </span>
                        )}
                      </div>

                      <h3 className="mt-4 text-lg font-semibold">
                        {notification.title || "Notification"}
                      </h3>
                      <p
                        className={`mt-2 text-sm leading-6 ${
                          notification.isRead
                            ? "text-slate-600"
                            : "text-slate-200"
                        }`}
                      >
                        {notification.message}
                      </p>
                    </div>

                    <div
                      className={`flex items-center gap-2 text-sm font-semibold ${
                        notification.isRead ? "text-slate-500" : "text-white"
                      }`}
                    >
                      <button
                        type="button"
                        onClick={(event) =>
                          handleDeleteNotification(event, notification._id)
                        }
                        disabled={deleting}
                        className={`inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${
                          notification.isRead
                            ? "border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"
                            : "border-white/20 bg-white/10 text-white hover:bg-white/20"
                        }`}
                      >
                        <FiTrash2 className="h-3.5 w-3.5" />
                        {deleting ? "Deleting..." : "Delete"}
                      </button>
                      <span>{opening ? "Opening..." : "Open"}</span>
                      <FiArrowRight className="h-4 w-4" />
                    </div>
                  </div>

                  <div
                    className={`mt-4 flex flex-wrap items-center justify-between gap-3 text-xs ${
                      notification.isRead ? "text-slate-400" : "text-slate-300"
                    }`}
                  >
                    <span>
                      {formatNotificationTime(notification.createdAt)}
                    </span>
                    <span>
                      {notification.isRead
                        ? "Already read"
                        : "Marks as read when opened"}
                    </span>
                  </div>
                </MotionButton>
              );
            })
          )}
        </div>
      </div>

      <ConfirmModal
        isOpen={showClearAllConfirm}
        title="Delete all notifications?"
        message="This will permanently remove every notification from your account. This action cannot be undone."
        confirmLabel="Delete all"
        cancelLabel="Cancel"
        isDanger
        isLoading={clearingAll}
        onCancel={() => {
          if (!clearingAll) {
            setShowClearAllConfirm(false);
          }
        }}
        onConfirm={handleClearAllNotifications}
      />
    </div>
  );
};

export default NotificationsCenter;
