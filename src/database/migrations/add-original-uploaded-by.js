const mongoose = require("mongoose");
const UserFramework = require("../../models/user-framework.model");
const ExpertFramework = require("../../models/expert-framework.model");
const UserDocument = require("../../models/user-document.model");
const User = require("../../models/user.model");

/**
 * Migration script to add originalUploadedBy field to existing documents/frameworks
 * This preserves user information even after user deletion
 */
async function migrateOriginalUploadedBy() {
  try {
    console.log("Starting migration: Adding originalUploadedBy field...");

    // Migrate UserFrameworks
    console.log("Migrating UserFrameworks...");
    const userFrameworks = await UserFramework.find({
      originalUploadedBy: { $exists: false },
    }).populate("uploadedBy", "name email role");

    let userFrameworksUpdated = 0;
    for (const framework of userFrameworks) {
      if (framework.uploadedBy) {
        framework.originalUploadedBy = {
          userId: framework.uploadedBy._id,
          name: framework.uploadedBy.name,
          email: framework.uploadedBy.email,
          role: framework.uploadedBy.role,
        };
        await framework.save();
        userFrameworksUpdated++;
      }
    }
    console.log(`Updated ${userFrameworksUpdated} UserFrameworks`);

    // Migrate ExpertFrameworks
    console.log("Migrating ExpertFrameworks...");
    const expertFrameworks = await ExpertFramework.find({
      originalUploadedBy: { $exists: false },
    }).populate("uploadedBy", "name email role");

    let expertFrameworksUpdated = 0;
    for (const framework of expertFrameworks) {
      if (framework.uploadedBy) {
        framework.originalUploadedBy = {
          userId: framework.uploadedBy._id,
          name: framework.uploadedBy.name,
          email: framework.uploadedBy.email,
          role: framework.uploadedBy.role,
        };
        await framework.save();
        expertFrameworksUpdated++;
      }
    }
    console.log(`Updated ${expertFrameworksUpdated} ExpertFrameworks`);

    // Migrate UserDocuments
    console.log("Migrating UserDocuments...");
    const userDocuments = await UserDocument.find({
      originalUploadedBy: { $exists: false },
    }).populate("uploadedBy", "name email role");

    let userDocumentsUpdated = 0;
    for (const document of userDocuments) {
      if (document.uploadedBy) {
        document.originalUploadedBy = {
          userId: document.uploadedBy._id,
          name: document.uploadedBy.name,
          email: document.uploadedBy.email,
          role: document.uploadedBy.role,
        };
        await document.save();
        userDocumentsUpdated++;
      }
    }
    console.log(`Updated ${userDocumentsUpdated} UserDocuments`);

    console.log("Migration completed successfully!");
    console.log(
      `Total updated: ${
        userFrameworksUpdated + expertFrameworksUpdated + userDocumentsUpdated
      } records`
    );
  } catch (error) {
    console.error("Migration failed:", error);
    throw error;
  }
}

// Run migration if called directly
if (require.main === module) {
  mongoose
    .connect(
      process.env.MONGODB_URI || "mongodb://localhost:27017/your-database",
      {
        useNewUrlParser: true,
        useUnifiedTopology: true,
      }
    )
    .then(() => {
      console.log("Connected to MongoDB");
      return migrateOriginalUploadedBy();
    })
    .then(() => {
      console.log("Migration completed successfully");
      process.exit(0);
    })
    .catch((error) => {
      console.error("Migration failed:", error);
      process.exit(1);
    });
}

module.exports = { migrateOriginalUploadedBy };
