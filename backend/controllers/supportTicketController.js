const SupportTicket = require("../models/SupportTicket");
const Vendor = require("../models/Vendor");
const { isAdmin, getUserId, getVendorForUser } = require("../utils/marketplaceAccess");
const {
  sendSupportTicketCreatedEmail,
  sendSupportTicketReplyEmail,
  sendSupportTicketStatusEmail,
} = require("../utils/emailTemplates");

const mapSenderRole = (user) => {
  const role = String(user?.userType || "").toLowerCase();
  if (["admin", "vendor", "staff"].includes(role)) return role;
  return "customer";
};

const ensureTicketAccess = async (req, ticket) => {
  if (isAdmin(req.user)) {
    return { allowed: true, role: "admin", vendorAccess: null };
  }

  const userId = String(getUserId(req.user));
  if (String(ticket.createdBy || "") === userId) {
    return { allowed: true, role: "owner", vendorAccess: null };
  }

  if (!ticket.vendor) {
    return { allowed: false, message: "Access denied for this ticket" };
  }

  const vendorAccess = await getVendorForUser(req.user, {
    approvedOnly: false,
    allowStaff: true,
  });

  if (!vendorAccess?.vendor || String(vendorAccess.vendor._id) !== String(ticket.vendor)) {
    return { allowed: false, message: "Access denied for this ticket" };
  }

  if (vendorAccess.source === "staff") {
    const canManageSupport = Boolean(vendorAccess.staffMember?.permissions?.manageSupport);
    if (!canManageSupport) {
      return { allowed: false, message: "Staff permission denied for support" };
    }
  }

  return { allowed: true, role: vendorAccess.source, vendorAccess };
};

exports.createTicket = async (req, res) => {
  try {
    const requesterRole = String(req.user?.userType || "").toLowerCase();

    if (!["user", "customer", "vendor"].includes(requesterRole)) {
      return res.status(403).json({
        success: false,
        message: "Only user and vendor accounts can create support tickets",
      });
    }

    const userId = getUserId(req.user);
    const {
      subject,
      category = "general",
      priority = "medium",
      message,
      vendorId = null,
    } = req.body || {};

    if (!String(subject || "").trim() || !String(message || "").trim()) {
      return res.status(400).json({
        success: false,
        message: "Subject and message are required",
      });
    }

    let ticketVendorId = null;

    if (vendorId) {
      const vendor = await Vendor.findById(vendorId).select("_id");
      if (!vendor) {
        return res.status(400).json({
          success: false,
          message: "Vendor not found",
        });
      }
      ticketVendorId = vendor._id;
    } else {
      const vendorAccess = await getVendorForUser(req.user, {
        approvedOnly: false,
        allowStaff: true,
      });

      if (vendorAccess?.vendor) {
        ticketVendorId = vendorAccess.vendor._id;
      }
    }

    const senderRole = mapSenderRole(req.user);

    const ticket = await SupportTicket.create({
      createdBy: userId,
      vendor: ticketVendorId,
      subject: String(subject).trim(),
      category,
      priority,
      status: "open",
      messages: [
        {
          sender: userId,
          senderRole,
          message: String(message).trim(),
          createdAt: new Date(),
        },
      ],
      lastMessageAt: new Date(),
    });

    const populated = await SupportTicket.findById(ticket._id)
      .populate("createdBy", "name email userType")
      .populate("vendor", "storeName slug")
      .populate("messages.sender", "name email userType");

    const creatorEmail = String(populated?.createdBy?.email || "").trim().toLowerCase();
    const supportInbox = String(process.env.SUPPORT_EMAIL || "").trim().toLowerCase();

    if (creatorEmail) {
      sendSupportTicketCreatedEmail({
        recipientEmail: creatorEmail,
        ticket: populated,
        isSupportInbox: false,
      }).catch(() => null);
    }

    if (supportInbox && supportInbox !== creatorEmail) {
      sendSupportTicketCreatedEmail({
        recipientEmail: supportInbox,
        ticket: populated,
        isSupportInbox: true,
      }).catch(() => null);
    }

    res.status(201).json({
      success: true,
      message: "Support ticket created",
      ticket: populated,
    });
  } catch (error) {
    console.error("Create ticket error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while creating support ticket",
    });
  }
};

exports.getTickets = async (req, res) => {
  try {
    const userId = getUserId(req.user);
    const { status } = req.query;

    let query = {};

    if (isAdmin(req.user)) {
      query = {};
    } else {
      const vendorAccess = await getVendorForUser(req.user, {
        approvedOnly: false,
        allowStaff: true,
      });

      if (vendorAccess?.vendor) {
        if (vendorAccess.source === "staff") {
          const canManageSupport = Boolean(vendorAccess.staffMember?.permissions?.manageSupport);
          if (!canManageSupport) {
            query = { createdBy: userId };
          } else {
            query = {
              $or: [{ createdBy: userId }, { vendor: vendorAccess.vendor._id }],
            };
          }
        } else {
          query = {
            $or: [{ createdBy: userId }, { vendor: vendorAccess.vendor._id }],
          };
        }
      } else {
        query = { createdBy: userId };
      }
    }

    if (status) {
      query.status = String(status).trim();
    }

    const tickets = await SupportTicket.find(query)
      .populate("createdBy", "name email userType")
      .populate("vendor", "storeName slug")
      .populate("assignedAdmin", "name email")
      .sort({ updatedAt: -1 });

    res.json({
      success: true,
      tickets,
    });
  } catch (error) {
    console.error("Get tickets error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching tickets",
    });
  }
};

exports.getTicketById = async (req, res) => {
  try {
    const ticket = await SupportTicket.findById(req.params.id)
      .populate("createdBy", "name email userType")
      .populate("vendor", "storeName slug")
      .populate("assignedAdmin", "name email")
      .populate("messages.sender", "name email userType");

    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: "Ticket not found",
      });
    }

    const access = await ensureTicketAccess(req, ticket);
    if (!access.allowed) {
      return res.status(403).json({
        success: false,
        message: access.message || "Access denied",
      });
    }

    res.json({
      success: true,
      ticket,
    });
  } catch (error) {
    console.error("Get ticket by id error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching ticket",
    });
  }
};

exports.replyTicket = async (req, res) => {
  try {
    const ticket = await SupportTicket.findById(req.params.id);
    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: "Ticket not found",
      });
    }

    const access = await ensureTicketAccess(req, ticket);
    if (!access.allowed) {
      return res.status(403).json({
        success: false,
        message: access.message || "Access denied",
      });
    }

    const message = String(req.body?.message || "").trim();
    if (!message) {
      return res.status(400).json({
        success: false,
        message: "Reply message is required",
      });
    }

    ticket.messages.push({
      sender: getUserId(req.user),
      senderRole: mapSenderRole(req.user),
      message,
      createdAt: new Date(),
    });

    ticket.lastMessageAt = new Date();

    if (ticket.status === "resolved" || ticket.status === "closed") {
      ticket.status = "in_progress";
      ticket.resolvedAt = null;
    }

    await ticket.save();

    const populated = await SupportTicket.findById(ticket._id)
      .populate("createdBy", "name email userType")
      .populate("vendor", "storeName slug")
      .populate("assignedAdmin", "name email")
      .populate("messages.sender", "name email userType");

    const ticketOwnerEmail = String(populated?.createdBy?.email || "")
      .trim()
      .toLowerCase();
    const senderId = String(getUserId(req.user) || "");
    const ticketOwnerId = String(populated?.createdBy?._id || "");

    if (ticketOwnerEmail && senderId && senderId !== ticketOwnerId) {
      sendSupportTicketReplyEmail({
        recipientEmail: ticketOwnerEmail,
        ticket: populated,
        senderName: String(req.user?.name || req.user?.email || "Support"),
      }).catch(() => null);
    }

    res.json({
      success: true,
      message: "Reply added",
      ticket: populated,
    });
  } catch (error) {
    console.error("Reply ticket error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while replying to ticket",
    });
  }
};

exports.updateTicketStatus = async (req, res) => {
  try {
    const ticket = await SupportTicket.findById(req.params.id);
    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: "Ticket not found",
      });
    }

    const { status } = req.body || {};
    const normalizedStatus = String(status || "").toLowerCase().trim();

    if (!["open", "in_progress", "resolved", "closed"].includes(normalizedStatus)) {
      return res.status(400).json({
        success: false,
        message: "Invalid ticket status",
      });
    }

    let canUpdate = false;
    if (isAdmin(req.user)) {
      canUpdate = true;
      ticket.assignedAdmin = getUserId(req.user);
    } else {
      const access = await ensureTicketAccess(req, ticket);
      if (access.allowed && access.role !== "owner") {
        canUpdate = true;
      }
    }

    if (!canUpdate) {
      return res.status(403).json({
        success: false,
        message: "Permission denied for ticket status update",
      });
    }

    const previousStatus = ticket.status;
    ticket.status = normalizedStatus;
    if (["resolved", "closed"].includes(normalizedStatus)) {
      ticket.resolvedAt = new Date();
    } else {
      ticket.resolvedAt = null;
    }

    await ticket.save();

    const populated = await SupportTicket.findById(ticket._id)
      .populate("createdBy", "name email userType")
      .populate("vendor", "storeName slug")
      .populate("assignedAdmin", "name email")
      .populate("messages.sender", "name email userType");

    const ownerEmail = String(populated?.createdBy?.email || "").trim().toLowerCase();
    if (ownerEmail) {
      sendSupportTicketStatusEmail({
        recipientEmail: ownerEmail,
        ticket: populated,
        oldStatus: previousStatus,
        newStatus: normalizedStatus,
      }).catch(() => null);
    }

    res.json({
      success: true,
      message: "Ticket status updated",
      ticket: populated,
    });
  } catch (error) {
    console.error("Update ticket status error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while updating ticket status",
    });
  }
};
