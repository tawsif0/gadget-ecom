require("dotenv").config({ path: require("path").resolve(__dirname, "../.env") });
const mongoose = require("mongoose");

const MONGODB_URI = process.env.MONGODB_URI;

const run = async () => {
  if (!MONGODB_URI) {
    throw new Error("MONGODB_URI is required");
  }

  await mongoose.connect(MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });

  const collections = [
    {
      name: "categories",
      update: {
        $unset: {
          commissionType: "",
          commissionValue: "",
          commissionFixed: "",
        },
      },
    },
    {
      name: "products",
      update: {
        $unset: {
          commissionType: "",
          commissionValue: "",
          commissionFixed: "",
        },
      },
    },
    {
      name: "vendors",
      update: {
        $unset: {
          commissionType: "",
          commissionValue: "",
          commissionFixed: "",
        },
      },
    },
    {
      name: "coupons",
      update: {
        $unset: {
          vendor: "",
        },
      },
    },
  ];

  for (const entry of collections) {
    const result = await mongoose.connection.collection(entry.name).updateMany({}, entry.update);
    console.log(
      `${entry.name}: matched=${result.matchedCount || 0}, modified=${result.modifiedCount || 0}`,
    );
  }

  const categoriesCollection = mongoose.connection.collection("categories");
  const categoryCursor = categoriesCollection.find({});
  while (await categoryCursor.hasNext()) {
    const doc = await categoryCursor.next();
    const name = String(doc?.name || "").trim().replace(/\s+/g, " ");
    const type = String(doc?.type || "Latest").trim().replace(/\s+/g, " ") || "Latest";
    await categoriesCollection.updateOne(
      { _id: doc._id },
      {
        $set: {
          name,
          type,
          normalizedName: name.toLowerCase(),
          normalizedType: type.toLowerCase(),
        },
      },
    );
  }

  const categoryTypesCollection = mongoose.connection.collection("categorytypes");
  const categoryTypeCursor = categoryTypesCollection.find({});
  while (await categoryTypeCursor.hasNext()) {
    const doc = await categoryTypeCursor.next();
    const name = String(doc?.name || "").trim().replace(/\s+/g, " ") || "Latest";
    await categoryTypesCollection.updateOne(
      { _id: doc._id },
      {
        $set: {
          name,
          normalizedName: name.toLowerCase(),
        },
      },
    );
  }

  const cleanupTargets = [
    {
      collection: "categories",
      dropIndexes: ["name_1"],
    },
    {
      collection: "categorytypes",
      dropIndexes: ["normalizedName_1"],
    },
  ];

  for (const entry of cleanupTargets) {
    const collection = mongoose.connection.collection(entry.collection);
    const indexes = await collection.indexes().catch(() => []);
    for (const indexName of entry.dropIndexes) {
      if (indexes.some((index) => index.name === indexName)) {
        await collection.dropIndex(indexName).catch(() => undefined);
        console.log(`${entry.collection}: dropped index ${indexName}`);
      }
    }
  }
};

run()
  .then(() => {
    console.log("Legacy commerce field cleanup completed.");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Legacy commerce field cleanup failed:", error);
    process.exit(1);
  })
  .finally(() => mongoose.connection.close().catch(() => undefined));
