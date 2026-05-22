const validator = require("validator");
const ContactSubmission = require("../models/ContactSubmission");
const { pushNotificationsToOperationalUsers } = require("../utils/notificationUtils");

const stripHtml = (value) =>
  String(value || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const ensureAdmin = (req, res) => {
  if (String(req?.user?.userType || "").toLowerCase() !== "admin") {
    res.status(403).json({
      success: false,
      message: "Admin access required",
    });
    return false;
  }

  return true;
};

exports.createContactSubmission = async (req, res) => {
  try {
    const { name, email, phone = "", subject, message } = req.body || {};

    if (!name || !email || !subject || !message) {
      return res.status(400).json({
        success: false,
        message: "Name, email, subject, and message are required",
      });
    }

    if (!validator.isEmail(String(email || "").trim())) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid email address",
      });
    }

    const cleanMessage = stripHtml(message);
    if (!cleanMessage) {
      return res.status(400).json({
        success: false,
        message: "Message cannot be empty",
      });
    }

    const submission = await ContactSubmission.create({
      name: String(name || "").trim(),
      email: String(email || "").trim().toLowerCase(),
      phone: String(phone || "").trim(),
      subject: String(subject || "").trim(),
      message: String(message || "").trim(),
    });

    await Promise.allSettled([
      pushNotificationsToOperationalUsers({
        type: "contact_submission",
        title: "New contact submission",
        message: `${submission.name} sent a message about "${submission.subject}".`,
        link: "/dashboard",
        meta: {
          targetTab: "contacted-list",
          submissionId: String(submission._id || ""),
          status: submission.status || "new",
        },
      }),
    ]);

    return res.status(201).json({
      success: true,
      message: "Message sent successfully",
      submission,
    });
  } catch (error) {
    console.error("Create contact submission error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to send contact message",
    });
  }
};

exports.getContactSubmissions = async (req, res) => {
  try {
    if (!ensureAdmin(req, res)) return;

    const search = String(req.query?.search || "").trim();
    const status = String(req.query?.status || "all").trim();
    const query = {};

    if (status && status !== "all" && ["new", "contacted", "resolved"].includes(status)) {
      query.status = status;
    }

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { phone: { $regex: search, $options: "i" } },
        { subject: { $regex: search, $options: "i" } },
        { message: { $regex: search, $options: "i" } },
      ];
    }

    const submissions = await ContactSubmission.find(query).sort({ createdAt: -1 });

    return res.json({
      success: true,
      submissions,
    });
  } catch (error) {
    console.error("Get contact submissions error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to load contacted users",
    });
  }
};

exports.updateContactSubmission = async (req, res) => {
  try {
    if (!ensureAdmin(req, res)) return;

    const submission = await ContactSubmission.findById(req.params.id);
    if (!submission) {
      return res.status(404).json({
        success: false,
        message: "Contact submission not found",
      });
    }

    const { status, adminNotes } = req.body || {};

    if (status !== undefined) {
      const normalizedStatus = String(status || "").trim().toLowerCase();
      if (!["new", "contacted", "resolved"].includes(normalizedStatus)) {
        return res.status(400).json({
          success: false,
          message: "Invalid status value",
        });
      }
      submission.status = normalizedStatus;
    }

    if (adminNotes !== undefined) {
      submission.adminNotes = String(adminNotes || "").trim();
    }

    await submission.save();

    return res.json({
      success: true,
      message: "Contact submission updated",
      submission,
    });
  } catch (error) {
    console.error("Update contact submission error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update contact submission",
    });
  }
};
