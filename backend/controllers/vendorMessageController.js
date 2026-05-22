const VendorConversation = require("../models/VendorConversation");
const Vendor = require("../models/Vendor");
const Product = require("../models/Product");
const { isAdmin, getVendorForUser } = require("../utils/marketplaceAccess");
const { attachImageDataToProducts } = require("../utils/imageUtils");
const { sendVendorConversationEmail } = require("../utils/emailTemplates");

const getUserId = (user) => user?.id || user?._id || null;

const toRole = (user) =>
  String(user?.userType || user?.role || "")
    .trim()
    .toLowerCase();

const hasVendorConversationAccess = async (user, conversation) => {
  const access = await getVendorForUser(user, {
    approvedOnly: false,
    allowStaff: true,
  });

  if (!access?.vendor) return false;
  if (String(access.vendor._id) !== String(conversation.vendor)) return false;

  if (access.source === "staff") {
    const canManage = Boolean(
      access.staffMember?.permissions?.manageSupport ||
        access.staffMember?.permissions?.manageOrders,
    );
    if (!canManage) return false;
  }

  return true;
};

const normalizeConversationStatus = (value) => {
  const normalized = String(value || "").trim().toLowerCase();
  return ["open", "closed"].includes(normalized) ? normalized : "";
};

const applyConversationImageHydration = async (conversation) => {
  if (!conversation?.product) return;
  if (!Array.isArray(conversation.product.images)) return;
  await attachImageDataToProducts([conversation.product]);
};

exports.createConversation = async (req, res) => {
  try {
    const requesterRole = toRole(req.user);
    const requesterId = getUserId(req.user);
    if (!requesterId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    if (!["user", "admin"].includes(requesterRole)) {
      return res.status(403).json({
        success: false,
        message: "Only customers can start a vendor conversation",
      });
    }

    const {
      vendorId,
      productId = null,
      subject = "",
      message,
      conversationId = "",
    } = req.body || {};

    const cleanMessage = String(message || "").trim();
    if (!cleanMessage) {
      return res.status(400).json({
        success: false,
        message: "Message is required",
      });
    }

    let resolvedVendorId = String(vendorId || "").trim();
    let resolvedProductId = null;

    if (productId) {
      const product = await Product.findById(productId).select("_id vendor title").lean();
      if (!product || !product.vendor) {
        return res.status(404).json({
          success: false,
          message: "Product not found or has no vendor",
        });
      }
      resolvedVendorId = String(product.vendor);
      resolvedProductId = product._id;
    }

    if (!resolvedVendorId) {
      return res.status(400).json({
        success: false,
        message: "Vendor ID or product ID is required",
      });
    }

    const vendor = await Vendor.findById(resolvedVendorId)
      .select("_id status email storeName")
      .lean();
    if (!vendor) {
      return res.status(404).json({
        success: false,
        message: "Vendor not found",
      });
    }

    let conversation = null;

    if (conversationId) {
      conversation = await VendorConversation.findById(conversationId);
      if (!conversation) {
        return res.status(404).json({
          success: false,
          message: "Conversation not found",
        });
      }

      if (String(conversation.customer) !== String(requesterId)) {
        return res.status(403).json({
          success: false,
          message: "You can reply only to your own conversations",
        });
      }
    } else {
      conversation = await VendorConversation.findOne({
        vendor: resolvedVendorId,
        customer: requesterId,
        product: resolvedProductId || null,
        status: "open",
      });
    }

    if (!conversation) {
      conversation = new VendorConversation({
        vendor: resolvedVendorId,
        customer: requesterId,
        product: resolvedProductId || null,
        subject: String(subject || "").trim(),
        status: "open",
        messages: [],
      });
    }

    conversation.messages.push({
      senderUser: requesterId,
      senderRole: requesterRole === "admin" ? "admin" : "customer",
      message: cleanMessage,
      createdAt: new Date(),
    });
    conversation.unreadByVendor = Number(conversation.unreadByVendor || 0) + 1;
    conversation.unreadByCustomer = 0;
    conversation.lastMessageAt = new Date();
    await conversation.save();

    const populated = await VendorConversation.findById(conversation._id)
      .populate("vendor", "storeName slug logo status")
      .populate("customer", "name email originalPhone phone")
      .populate("product", "title images")
      .populate("messages.senderUser", "name email userType")
      .lean();

    if (populated) {
      await applyConversationImageHydration(populated);
    }

    const vendorEmail = String(vendor?.email || "").trim().toLowerCase();
    if (vendorEmail) {
      sendVendorConversationEmail({
        recipientEmail: vendorEmail,
        conversation: populated || conversation,
        senderName: String(req.user?.name || req.user?.email || "Customer"),
        senderRole: requesterRole,
      }).catch(() => null);
    }

    res.status(201).json({
      success: true,
      message: "Conversation message sent",
      conversation: populated,
    });
  } catch (error) {
    console.error("Create vendor conversation error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while creating conversation",
    });
  }
};

exports.getMyConversations = async (req, res) => {
  try {
    const requesterId = getUserId(req.user);
    if (!requesterId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const role = toRole(req.user);
    const status = normalizeConversationStatus(req.query?.status);
    const query = {};

    if (status) {
      query.status = status;
    }

    if (role === "user") {
      query.customer = requesterId;
    } else if (role === "vendor" || role === "staff") {
      const access = await getVendorForUser(req.user, {
        approvedOnly: false,
        allowStaff: true,
      });

      if (!access?.vendor) {
        return res.status(404).json({
          success: false,
          message: "Vendor profile not found",
        });
      }

      if (access.source === "staff") {
        const canView = Boolean(
          access.staffMember?.permissions?.manageSupport ||
            access.staffMember?.permissions?.manageOrders,
        );
        if (!canView) {
          return res.status(403).json({
            success: false,
            message: "Staff permission denied for vendor messages",
          });
        }
      }

      query.vendor = access.vendor._id;
    } else if (!isAdmin(req.user)) {
      return res.status(403).json({
        success: false,
        message: "Access denied",
      });
    }

    const conversations = await VendorConversation.find(query)
      .populate("vendor", "storeName slug logo status")
      .populate("customer", "name email originalPhone phone")
      .populate("product", "title images")
      .sort({ lastMessageAt: -1 })
      .lean();

    await Promise.all(conversations.map((entry) => applyConversationImageHydration(entry)));

    res.json({
      success: true,
      conversations,
    });
  } catch (error) {
    console.error("Get vendor conversations error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching conversations",
    });
  }
};

exports.getAdminConversations = async (req, res) => {
  try {
    if (!isAdmin(req.user)) {
      return res.status(403).json({
        success: false,
        message: "Admin access required",
      });
    }

    const status = normalizeConversationStatus(req.query?.status);
    const query = {};
    if (status) query.status = status;
    if (req.query?.vendorId) query.vendor = req.query.vendorId;

    const conversations = await VendorConversation.find(query)
      .populate("vendor", "storeName slug logo status")
      .populate("customer", "name email originalPhone phone")
      .populate("product", "title images")
      .sort({ lastMessageAt: -1 })
      .lean();

    await Promise.all(conversations.map((entry) => applyConversationImageHydration(entry)));

    res.json({
      success: true,
      conversations,
    });
  } catch (error) {
    console.error("Get admin vendor conversations error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching conversations",
    });
  }
};

exports.getConversation = async (req, res) => {
  try {
    const requesterId = String(getUserId(req.user) || "");
    const role = toRole(req.user);

    const conversation = await VendorConversation.findById(req.params.id)
      .populate("vendor", "storeName slug logo status")
      .populate("customer", "name email originalPhone phone")
      .populate("product", "title images")
      .populate("messages.senderUser", "name email userType");

    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: "Conversation not found",
      });
    }

    let canAccess = isAdmin(req.user);
    if (!canAccess && role === "user") {
      canAccess = String(conversation.customer?._id || conversation.customer) === requesterId;
    }

    if (!canAccess && (role === "vendor" || role === "staff")) {
      canAccess = await hasVendorConversationAccess(req.user, conversation);
    }

    if (!canAccess) {
      return res.status(403).json({
        success: false,
        message: "Access denied for this conversation",
      });
    }

    let shouldSave = false;
    if (role === "user") {
      if (conversation.unreadByCustomer !== 0) {
        conversation.unreadByCustomer = 0;
        shouldSave = true;
      }
    } else if (role === "vendor" || role === "staff") {
      if (conversation.unreadByVendor !== 0) {
        conversation.unreadByVendor = 0;
        shouldSave = true;
      }
    } else if (isAdmin(req.user)) {
      if (conversation.unreadByCustomer !== 0 || conversation.unreadByVendor !== 0) {
        conversation.unreadByCustomer = 0;
        conversation.unreadByVendor = 0;
        shouldSave = true;
      }
    }

    if (shouldSave) {
      await conversation.save();
    }

    const conversationObject = conversation.toObject();
    await applyConversationImageHydration(conversationObject);

    res.json({
      success: true,
      conversation: conversationObject,
    });
  } catch (error) {
    console.error("Get vendor conversation error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching conversation",
    });
  }
};

exports.replyToConversation = async (req, res) => {
  try {
    const requesterId = String(getUserId(req.user) || "");
    const role = toRole(req.user);
    const text = String(req.body?.message || "").trim();

    if (!text) {
      return res.status(400).json({
        success: false,
        message: "Reply message is required",
      });
    }

    const conversation = await VendorConversation.findById(req.params.id);
    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: "Conversation not found",
      });
    }

    let senderRole = "customer";
    let canReply = false;

    if (isAdmin(req.user)) {
      senderRole = "admin";
      canReply = true;
    } else if (role === "user") {
      if (String(conversation.customer) === requesterId) {
        senderRole = "customer";
        canReply = true;
      }
    } else if (role === "vendor" || role === "staff") {
      const canAccess = await hasVendorConversationAccess(req.user, conversation);
      if (canAccess) {
        senderRole = "vendor";
        canReply = true;
      }
    }

    if (!canReply) {
      return res.status(403).json({
        success: false,
        message: "You cannot reply to this conversation",
      });
    }

    if (conversation.status !== "open" && !isAdmin(req.user)) {
      return res.status(400).json({
        success: false,
        message: "Conversation is closed",
      });
    }

    conversation.messages.push({
      senderUser: requesterId,
      senderRole,
      message: text,
      createdAt: new Date(),
    });
    conversation.lastMessageAt = new Date();

    if (senderRole === "customer") {
      conversation.unreadByVendor = Number(conversation.unreadByVendor || 0) + 1;
      conversation.unreadByCustomer = 0;
    } else if (senderRole === "vendor") {
      conversation.unreadByCustomer = Number(conversation.unreadByCustomer || 0) + 1;
      conversation.unreadByVendor = 0;
    } else {
      conversation.unreadByCustomer = Number(conversation.unreadByCustomer || 0) + 1;
      conversation.unreadByVendor = Number(conversation.unreadByVendor || 0) + 1;
    }

    await conversation.save();

    const populated = await VendorConversation.findById(conversation._id)
      .populate("vendor", "storeName slug logo status")
      .populate("customer", "name email originalPhone phone")
      .populate("product", "title images")
      .populate("messages.senderUser", "name email userType")
      .lean();

    if (populated) {
      await applyConversationImageHydration(populated);
    }

    let recipientEmail = "";
    if (senderRole === "customer") {
      const vendor = await Vendor.findById(conversation.vendor).select("email").lean();
      recipientEmail = String(vendor?.email || "").trim().toLowerCase();
    } else {
      recipientEmail = String(populated?.customer?.email || "").trim().toLowerCase();
    }

    if (recipientEmail) {
      sendVendorConversationEmail({
        recipientEmail,
        conversation: populated || conversation,
        senderName: String(req.user?.name || req.user?.email || "User"),
        senderRole,
      }).catch(() => null);
    }

    res.json({
      success: true,
      message: "Reply sent",
      conversation: populated,
    });
  } catch (error) {
    console.error("Reply vendor conversation error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while replying to conversation",
    });
  }
};

exports.updateConversationStatus = async (req, res) => {
  try {
    const status = normalizeConversationStatus(req.body?.status);
    if (!status) {
      return res.status(400).json({
        success: false,
        message: "Invalid conversation status",
      });
    }

    const requesterId = String(getUserId(req.user) || "");
    const role = toRole(req.user);

    const conversation = await VendorConversation.findById(req.params.id);
    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: "Conversation not found",
      });
    }

    let canManage = isAdmin(req.user);

    if (!canManage && role === "user") {
      canManage = String(conversation.customer) === requesterId;
    }

    if (!canManage && (role === "vendor" || role === "staff")) {
      canManage = await hasVendorConversationAccess(req.user, conversation);
    }

    if (!canManage) {
      return res.status(403).json({
        success: false,
        message: "Access denied for conversation status update",
      });
    }

    conversation.status = status;
    await conversation.save();

    const updated = await VendorConversation.findById(conversation._id)
      .populate("vendor", "storeName slug logo status")
      .populate("customer", "name email originalPhone phone")
      .populate("product", "title images")
      .populate("messages.senderUser", "name email userType")
      .lean();

    if (updated) {
      await applyConversationImageHydration(updated);
    }

    res.json({
      success: true,
      message: "Conversation status updated",
      conversation: updated,
    });
  } catch (error) {
    console.error("Update conversation status error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while updating conversation status",
    });
  }
};
