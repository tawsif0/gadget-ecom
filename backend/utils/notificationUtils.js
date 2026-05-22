const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const User = require("../models/User");

const MAX_NOTIFICATIONS = 50;
const notificationClients = new Map();

const uniqueIds = (values = []) =>
  [...new Set(values.map((value) => String(value || "").trim()).filter(Boolean))];

const normalizeMeta = (meta) =>
  meta && typeof meta === "object" && !Array.isArray(meta) ? meta : {};

const serializeNotification = (item = {}) => ({
  _id: String(item._id || ""),
  type: String(item.type || "").trim(),
  title: String(item.title || "").trim(),
  message: String(item.message || "").trim(),
  link: String(item.link || "").trim(),
  isRead: Boolean(item.isRead),
  createdAt: item.createdAt || null,
  readAt: item.readAt || null,
  meta: normalizeMeta(item.meta),
});

const writeSseEvent = (res, event, payload) => {
  if (!res || res.writableEnded) return;
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
};

const broadcastToUser = (userId, event, payload) => {
  const normalizedUserId = String(userId || "").trim();
  if (!normalizedUserId) return;

  const clients = notificationClients.get(normalizedUserId);
  if (!clients?.size) return;

  clients.forEach((client) => {
    writeSseEvent(client, event, payload);
  });
};

const registerNotificationClient = (userId, res) => {
  const normalizedUserId = String(userId || "").trim();
  if (!normalizedUserId) {
    return () => {};
  }

  if (!notificationClients.has(normalizedUserId)) {
    notificationClients.set(normalizedUserId, new Set());
  }

  const clients = notificationClients.get(normalizedUserId);
  clients.add(res);

  const heartbeat = setInterval(() => {
    writeSseEvent(res, "heartbeat", {
      ok: true,
      timestamp: new Date(),
    });
  }, 25000);

  return () => {
    clearInterval(heartbeat);
    const userClients = notificationClients.get(normalizedUserId);
    if (!userClients) return;
    userClients.delete(res);
    if (!userClients.size) {
      notificationClients.delete(normalizedUserId);
    }
  };
};

const buildNotificationDocument = (payload = {}) => ({
  _id: new mongoose.Types.ObjectId(),
  type: String(payload.type || "").trim(),
  title: String(payload.title || "").trim(),
  message: String(payload.message || "").trim(),
  link: String(payload.link || "/dashboard").trim(),
  isRead: false,
  createdAt: new Date(),
  meta: normalizeMeta(payload.meta),
});

const pushNotificationsToUsers = async (userIds = [], payload = {}) => {
  const ids = uniqueIds(userIds);
  if (!ids.length) return [];

  const prepared = ids.map((userId) => ({
    userId,
    notification: buildNotificationDocument(payload),
  }));

  await User.bulkWrite(
    prepared.map(({ userId, notification }) => ({
      updateOne: {
        filter: { _id: userId },
        update: {
          $push: {
            notifications: {
              $each: [notification],
              $position: 0,
              $slice: MAX_NOTIFICATIONS,
            },
          },
        },
      },
    })),
  );

  prepared.forEach(({ userId, notification }) => {
    broadcastToUser(userId, "notification", {
      notification: serializeNotification(notification),
    });
  });

  return prepared.map(({ userId, notification }) => ({
    userId,
    notification: serializeNotification(notification),
  }));
};

const pushNotificationsToQuery = async (query = {}, payload = {}) => {
  const users = await User.find(query).select("_id").lean();
  return pushNotificationsToUsers(
    users.map((user) => user._id),
    payload,
  );
};

const pushNotificationsToAdmins = async (payload = {}) =>
  pushNotificationsToQuery(
    {
      userType: "admin",
      status: "active",
    },
    payload,
  );

const pushNotificationsToOperationalUsers = async (payload = {}) =>
  pushNotificationsToQuery(
    {
      userType: { $in: ["admin", "staff"] },
      status: "active",
    },
    payload,
  );

const authenticateNotificationToken = async (rawToken = "") => {
  const token = String(rawToken || "")
    .replace(/^Bearer\s+/i, "")
    .trim();

  if (!token) {
    const error = new Error("Authentication token is required");
    error.statusCode = 401;
    throw error;
  }

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (_error) {
    const authError = new Error("Invalid notification token");
    authError.statusCode = 401;
    throw authError;
  }

  const user = await User.findOne({
    _id: decoded._id,
    "tokens.token": token,
  });

  if (!user) {
    const error = new Error("Authenticated user was not found");
    error.statusCode = 401;
    throw error;
  }

  return user;
};

const broadcastNotificationRead = (userId, notificationId, readAt = new Date()) => {
  broadcastToUser(userId, "notification.read", {
    notificationId: String(notificationId || ""),
    readAt,
  });
};

const broadcastNotificationsReadAll = (userId, readAt = new Date()) => {
  broadcastToUser(userId, "notification.readAll", {
    readAt,
  });
};

const broadcastNotificationDeleted = (userId, notificationId) => {
  broadcastToUser(userId, "notification.deleted", {
    notificationId: String(notificationId || "").trim(),
  });
};

const broadcastNotificationsCleared = (userId) => {
  broadcastToUser(userId, "notification.cleared", {
    clearedAt: new Date(),
  });
};

module.exports = {
  authenticateNotificationToken,
  broadcastNotificationDeleted,
  broadcastNotificationRead,
  broadcastNotificationsCleared,
  broadcastNotificationsReadAll,
  pushNotificationsToAdmins,
  pushNotificationsToOperationalUsers,
  pushNotificationsToUsers,
  registerNotificationClient,
  serializeNotification,
  writeSseEvent,
};
