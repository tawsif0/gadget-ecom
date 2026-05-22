const getSuccessRate = ({ deliveredOrders = 0, totalOrders = 0 } = {}) =>
  totalOrders > 0 ? (Number(deliveredOrders || 0) / Number(totalOrders || 0)) * 100 : 0;

const shouldAutoBlacklistByCancellation = ({
  totalOrders = 0,
  cancelledOrders = 0,
} = {}) => {
  const total = Number(totalOrders || 0);
  const cancelled = Number(cancelledOrders || 0);

  if (total <= 0 || cancelled < 3) return false;
  return cancelled / total >= 0.5;
};

const getRiskLevel = ({
  totalOrders = 0,
  deliveredOrders = 0,
  cancelledOrders = 0,
  returnedOrders = 0,
  successRate,
  isBlacklisted = false,
} = {}) => {
  if (isBlacklisted) return "blacklisted";

  const total = Number(totalOrders || 0);
  const cancelled = Number(cancelledOrders || 0);
  const returned = Number(returnedOrders || 0);
  const normalizedSuccessRate = Number.isFinite(Number(successRate))
    ? Number(successRate)
    : getSuccessRate({ deliveredOrders, totalOrders });

  if (total <= 0) return "new";

  if (shouldAutoBlacklistByCancellation({ totalOrders: total, cancelledOrders: cancelled })) {
    return "blacklisted";
  }

  if (cancelled >= 2 && cancelled / total >= 0.35) {
    return "high";
  }

  if (normalizedSuccessRate >= 80) return "trusted";
  if (normalizedSuccessRate >= 60) return "medium";
  if (normalizedSuccessRate >= 35 || cancelled > 0 || returned > 0) {
    return "high";
  }

  return "medium";
};

const calculateCustomerMetrics = (orders = []) => {
  const rows = Array.isArray(orders) ? orders : [];
  const totalOrders = rows.length;
  const deliveredOrders = rows.filter((order) => order?.orderStatus === "delivered").length;
  const returnedOrders = rows.filter((order) => order?.orderStatus === "returned").length;
  const cancelledOrders = rows.filter((order) => order?.orderStatus === "cancelled").length;
  const processingOrders = rows.filter((order) => order?.orderStatus === "processing").length;
  const shippedOrders = rows.filter((order) => order?.orderStatus === "shipped").length;
  const pendingOrders = rows.filter((order) =>
    ["pending", "confirmed"].includes(String(order?.orderStatus || "").toLowerCase()),
  ).length;
  const revenue = rows.reduce((sum, order) => sum + Number(order?.total || 0), 0);
  const successRate = getSuccessRate({ deliveredOrders, totalOrders });

  return {
    totalOrders,
    deliveredOrders,
    returnedOrders,
    cancelledOrders,
    processingOrders,
    shippedOrders,
    pendingOrders,
    revenue,
    successRate,
    riskLevel: getRiskLevel({
      totalOrders,
      deliveredOrders,
      returnedOrders,
      cancelledOrders,
      successRate,
    }),
  };
};

module.exports = {
  calculateCustomerMetrics,
  getRiskLevel,
  shouldAutoBlacklistByCancellation,
};
