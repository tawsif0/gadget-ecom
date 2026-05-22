import { resolveUserRole } from "./dashboardAccess";

const getNotificationUserRole = (user) =>
  resolveUserRole({
    ...user,
    userType: user?.userType || user?.role || "user",
  });

const resolveRoleAwareTargetTab = (notification, user, fallbackTab = "") => {
  const type = String(notification?.type || "").trim();
  const role = getNotificationUserRole(user);

  const isOrderNotification = [
    "admin_order_created",
    "order_created",
    "order_status_updated",
    "payment_status_updated",
    "order_cancellation_requested",
    "order_cancelled",
    "order_cancellation_updated",
  ].includes(type);

  if (role === "admin" && isOrderNotification) {
    return "order-list";
  }

  if (role === "user" && isOrderNotification) {
    return "my-orders";
  }

  if (role === "admin" && ["review_pending", "review_status_updated"].includes(type)) {
    return "product-reviews";
  }

  if (role === "admin" && type === "contact_submission") {
    return "contacted-list";
  }

  return String(fallbackTab || "").trim();
};

export const formatNotificationTime = (value) => {
  if (!value) return "";

  return new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
};

export const getNotificationTarget = (notification, user) => {
  const role = getNotificationUserRole(user);
  const meta =
    notification?.meta &&
    typeof notification.meta === "object" &&
    !Array.isArray(notification.meta)
      ? notification.meta
      : {};

  const resolvedMetaTargetTab = resolveRoleAwareTargetTab(
    notification,
    user,
    meta.targetTab,
  );

  if (resolvedMetaTargetTab) {
    return {
      ...meta,
      targetTab: resolvedMetaTargetTab,
    };
  }

  switch (String(notification?.type || "").trim()) {
    case "admin_order_created":
    case "order_cancellation_requested":
    case "order_cancelled":
      return {
        ...meta,
        targetTab: "order-list",
      };
    case "order_created":
    case "order_status_updated":
    case "payment_status_updated":
    case "order_cancellation_updated":
      return {
        ...meta,
        targetTab: role === "admin" ? "order-list" : "my-orders",
      };
    case "review_pending":
      return {
        ...meta,
        targetTab: "product-reviews",
      };
    case "contact_submission":
      return {
        ...meta,
        targetTab: "contacted-list",
      };
    default:
      return null;
  }
};

export const getNotificationTypeLabel = (notification) => {
  switch (String(notification?.type || "").trim()) {
    case "admin_order_created":
    case "order_created":
    case "order_status_updated":
    case "order_cancellation_requested":
    case "order_cancelled":
    case "order_cancellation_updated":
      return "Order";
    case "payment_status_updated":
      return "Payment";
    case "review_pending":
    case "review_status_updated":
      return "Review";
    case "contact_submission":
      return "Contact";
    default:
      return "Update";
  }
};

export const getNotificationRoleCopy = (user) => {
  const role = getNotificationUserRole(user);

  if (role === "admin") {
    return {
      title: "Admin Notifications",
      subtitle:
        "Orders, review approvals, contact submissions, and operational updates appear here live.",
      empty:
        "No admin notifications yet. New commerce and moderation updates will appear here.",
    };
  }

  return {
    title: "My Notifications",
    subtitle:
      "Your order, payment, and review updates appear here instantly without refreshing.",
    empty:
      "No notifications yet. Your order and review updates will appear here.",
  };
};
