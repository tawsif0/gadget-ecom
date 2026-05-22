const mongoose = require("mongoose");

const contactSubmissionSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 120,
  },
  email: {
    type: String,
    required: true,
    trim: true,
    lowercase: true,
    maxlength: 120,
  },
  phone: {
    type: String,
    trim: true,
    default: "",
    maxlength: 40,
  },
  subject: {
    type: String,
    required: true,
    trim: true,
    maxlength: 120,
  },
  message: {
    type: String,
    required: true,
    trim: true,
  },
  status: {
    type: String,
    enum: ["new", "contacted", "resolved"],
    default: "new",
  },
  adminNotes: {
    type: String,
    trim: true,
    default: "",
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

contactSubmissionSchema.pre("save", function updateTimestamp(next) {
  this.updatedAt = new Date();
  next();
});

const ContactSubmission = mongoose.model(
  "ContactSubmission",
  contactSubmissionSchema,
);

module.exports = ContactSubmission;
