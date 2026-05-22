require("dotenv").config();
const mongoose = require("mongoose");
const cron = require("node-cron");
const app = require("./app");
const { processRecurringRenewals } = require("./utils/recurringSubscriptionUtils");

const PORT = process.env.PORT;
const MONGODB_URI = process.env.MONGODB_URI;
const MONGO_MAX_POOL_SIZE = Math.max(5, Number(process.env.MONGO_MAX_POOL_SIZE || 20));
const MONGO_MIN_POOL_SIZE = Math.max(1, Number(process.env.MONGO_MIN_POOL_SIZE || 2));
let recurringRenewalJob = null;

const dropLegacyUserIndexes = async () => {
  const allowedUserIndexes = new Set(["_id_", "email_1", "phone_1", "isBlacklisted_1"]);
  const legacyFieldNames = new Set([
    "referralCode",
    "referredBy",
    "sponsorId",
    "affiliateId",
    "affiliateCode",
    "activationCode",
    "activationStatus",
    "walletBalance",
    "withdrawableBalance",
    "dkId",
    "eaId",
  ]);
  const legacyNameHints = [
    "referral",
    "affiliate",
    "activation",
    "wallet",
    "withdraw",
    "dkid",
    "eaid",
  ];

  try {
    const usersCollection = mongoose.connection.collection("users");
    const indexes = await usersCollection.indexes();
    const indexesToDrop = indexes.filter((index) => {
      const indexName = String(index?.name || "").trim();
      if (allowedUserIndexes.has(indexName)) return false;

      const fields = Object.keys(index?.key || {});
      if (!fields.length) return false;

      if (fields.some((field) => legacyFieldNames.has(field))) {
        return true;
      }

      const normalizedName = indexName.toLowerCase();
      return legacyNameHints.some((hint) => normalizedName.includes(hint));
    });

    if (!indexesToDrop.length) return;

    for (const index of indexesToDrop) {
      await usersCollection.dropIndex(index.name);
      console.log(`Dropped legacy users index: ${index.name}`);
    }
  } catch (error) {
    console.warn("Legacy index cleanup skipped:", error.message);
  }
};

mongoose
  .connect(MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    maxPoolSize: MONGO_MAX_POOL_SIZE,
    minPoolSize: MONGO_MIN_POOL_SIZE,
    maxIdleTimeMS: 60000,
    serverSelectionTimeoutMS: 10000,
  })
  .then(async () => {
    console.log("Connected to MongoDB");
    await dropLegacyUserIndexes();

    const server = app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });

    if (!recurringRenewalJob) {
      recurringRenewalJob = cron.schedule("*/30 * * * *", async () => {
        try {
          const summary = await processRecurringRenewals({ limit: 100 });
          if ((summary?.processed || 0) > 0) {
            console.log("Recurring renewals processed:", summary);
          }
        } catch (jobError) {
          console.error("Recurring renewal job error:", jobError.message);
        }
      });
    }

    server.on("error", (error) => {
      if (error.code === "EADDRINUSE") {
        console.error(`Port ${PORT} is already in use`);
        process.exit(1);
      } else {
        console.error("Server error:", error);
        process.exit(1);
      }
    });
  })
  .catch((err) => {
    console.error("Database connection error:", err);
    process.exit(1);
  });

process.on("unhandledRejection", (err) => {
  console.error("Unhandled Promise Rejection:", err);
  if (process.env.NODE_ENV === "production") {
    console.log("Continuing in production despite unhandled rejection");
  }
});

process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception:", err);
  process.exit(1);
});

process.on("SIGTERM", () => {
  console.log("SIGTERM received. Shutting down gracefully...");
  if (recurringRenewalJob) {
    recurringRenewalJob.stop();
    recurringRenewalJob = null;
  }
  mongoose.connection.close(() => {
    console.log("MongoDB connection closed");
    process.exit(0);
  });
});
