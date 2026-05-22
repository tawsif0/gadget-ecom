const mongoose = require("mongoose");
const validator = require("validator");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const normalizePhone = (phone) => {
  if (!phone || typeof phone !== "string") return phone;

  let normalized = phone.replace(/[^\d+]/g, "");

  if (normalized.startsWith("+88")) {
    normalized = `0${normalized.slice(3)}`;
  }

  if (normalized.startsWith("880")) {
    normalized = `0${normalized.slice(3)}`;
  }

  if (!normalized.startsWith("0") && normalized.length > 0) {
    normalized = `0${normalized}`;
  }

  return normalized;
};

const validateBangladeshiPhone = (phone) => {
  const normalized = normalizePhone(phone);
  return /^01[3-9]\d{8}$/.test(normalized);
};

const addressBookEntrySchema = new mongoose.Schema(
  {
    label: {
      type: String,
      trim: true,
      maxlength: 50,
      default: "Home",
    },
    recipientName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    phone: {
      type: String,
      required: true,
      trim: true,
    },
    alternativePhone: {
      type: String,
      trim: true,
      default: "",
    },
    address: {
      type: String,
      required: true,
      trim: true,
      maxlength: 500,
    },
    city: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    subCity: {
      type: String,
      trim: true,
      default: "",
      maxlength: 120,
    },
    district: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    postalCode: {
      type: String,
      required: true,
      trim: true,
      maxlength: 20,
    },
    country: {
      type: String,
      trim: true,
      default: "Bangladesh",
      maxlength: 120,
    },
    deliveryNotes: {
      type: String,
      trim: true,
      default: "",
      maxlength: 500,
    },
    isDefault: {
      type: Boolean,
      default: false,
    },
  },
  {
    _id: true,
    timestamps: true,
  },
);

const userNotificationSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      trim: true,
      default: "",
    },
    title: {
      type: String,
      trim: true,
      default: "",
    },
    message: {
      type: String,
      trim: true,
      default: "",
    },
    link: {
      type: String,
      trim: true,
      default: "",
    },
    isRead: {
      type: Boolean,
      default: false,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
    readAt: {
      type: Date,
      default: null,
    },
    meta: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    _id: true,
  },
);

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    validate: (value) => {
      if (!validator.isEmail(value || "")) {
        throw new Error("Invalid email address");
      }
    },
  },
  phone: {
    type: String,
    required: true,
    unique: true,
    trim: true,
  },
  originalPhone: {
    type: String,
    trim: true,
  },
  password: {
    type: String,
    required: true,
    minlength: 8,
  },
  userType: {
    type: String,
    enum: ["admin", "user", "vendor", "staff"],
    default: "user",
  },
  status: {
    type: String,
    default: "active",
  },
  isBlacklisted: {
    type: Boolean,
    default: false,
    index: true,
  },
  blacklistReason: {
    type: String,
    default: "",
    trim: true,
    maxlength: 500,
  },
  adminNotes: {
    type: String,
    default: "",
    trim: true,
    maxlength: 2000,
  },
  adminSettings: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },
  addressBook: {
    type: [addressBookEntrySchema],
    default: [],
  },
  notifications: {
    type: [userNotificationSchema],
    default: [],
  },
  passwordResetToken: String,
  passwordResetExpires: Date,
  tokens: [
    {
      token: {
        type: String,
        required: true,
      },
    },
  ],
  createdAt: {
    type: Date,
    default: Date.now,
  },
  lastLogin: {
    type: Date,
  },
});

userSchema.path("phone").validate(
  (value) => validateBangladeshiPhone(value),
  "Invalid Bangladeshi phone number. Format: 01XXXXXXXXX or +8801XXXXXXXXX",
);

userSchema.pre("save", async function preSave(next) {
  try {
    const user = this;

    if (user.isModified("phone")) {
      const inputPhone = String(user.phone || "").trim();

      if (!validateBangladeshiPhone(inputPhone)) {
        return next(
          new Error(
            "Invalid Bangladeshi phone number. Format: 01XXXXXXXXX or +8801XXXXXXXXX",
          ),
        );
      }

      user.originalPhone = inputPhone;
      user.phone = normalizePhone(inputPhone);
    }

    if (user.isNew && !user.userType) {
      const userCount = await mongoose.model("User").countDocuments();
      user.userType = userCount === 0 ? "admin" : "user";
      user.status = "active";
    }

    if (user.isModified("password")) {
      user.password = await bcrypt.hash(user.password, 8);
    }

    return next();
  } catch (error) {
    return next(error);
  }
});

userSchema.methods.generateAuthToken = async function generateAuthToken() {
  const user = this;
  const token = jwt.sign({ _id: user._id }, process.env.JWT_SECRET, {
    expiresIn: "7d",
  });

  user.tokens = user.tokens.concat({ token });
  await user.save();
  return token;
};

userSchema.methods.toSafeObject = function toSafeObject() {
  const user = this.toObject();
  delete user.password;
  delete user.tokens;
  delete user.passwordResetToken;
  delete user.passwordResetExpires;
  delete user.notifications;
  user.phone = user.originalPhone || user.phone;
  return user;
};

userSchema.methods.toJSON = function toJSON() {
  return this.toSafeObject();
};

userSchema.statics.findByCredentials = async function findByCredentials(
  loginId,
  password,
) {
  const identifier = String(loginId || "").trim();
  const isEmail = identifier.includes("@");

  const query = isEmail
    ? { email: identifier.toLowerCase() }
    : { phone: normalizePhone(identifier) };

  const user = await this.findOne(query);
  if (!user) {
    throw new Error("Invalid login credentials");
  }

  const isPasswordMatch = await bcrypt.compare(password, user.password);
  if (!isPasswordMatch) {
    throw new Error("Invalid login credentials");
  }

  return user;
};

const User = mongoose.model("User", userSchema);

User.normalizePhone = normalizePhone;
User.validateBangladeshiPhone = validateBangladeshiPhone;

module.exports = User;
