const mongoose = require("mongoose");

const expertFrameworkSchema = new mongoose.Schema(
  {
    frameworkName: {
      type: String,
      required: [true, "Framework name is required"],
      trim: true,
      minlength: [2, "Framework name must be at least 2 characters long"],
      maxlength: [100, "Framework name cannot exceed 100 characters"],
    },
    fileUrl: {
      type: String,
      required: [true, "File URL is required"],
      trim: true,
    },
    frameworkType: {
      type: String,
      required: [true, "Framework type is required"],
      enum: {
        values: ["pdf", "doc", "docx", "xls", "xlsx"],
        message: "Framework type must be one of: pdf, doc, docx, xls, xlsx",
      },
    },
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Uploaded by expert is required"],
    },
    fileSize: {
      type: Number,
      required: [true, "File size is required"],
    },
    originalFileName: {
      type: String,
      required: [true, "Original file name is required"],
      trim: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true, // This adds createdAt and updatedAt automatically
  }
);

// Index for better query performance
expertFrameworkSchema.index({ uploadedBy: 1 });
expertFrameworkSchema.index({ frameworkType: 1 });
expertFrameworkSchema.index({ createdAt: -1 });

// Virtual for file extension
expertFrameworkSchema.virtual("fileExtension").get(function () {
  return this.frameworkType;
});

// Method to get formatted file size
expertFrameworkSchema.methods.getFormattedFileSize = function () {
  const bytes = this.fileSize;
  if (bytes === 0) return "0 Bytes";

  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
};

// Static method to get frameworks by type
expertFrameworkSchema.statics.getByType = function (frameworkType) {
  return this.find({ frameworkType, isActive: true }).populate(
    "uploadedBy",
    "name email role"
  );
};

// Static method to get expert frameworks
expertFrameworkSchema.statics.getExpertFrameworks = function (expertId) {
  return this.find({ uploadedBy: expertId, isActive: true }).populate(
    "uploadedBy",
    "name email role"
  );
};

const ExpertFramework = mongoose.model(
  "ExpertFramework",
  expertFrameworkSchema
);

module.exports = ExpertFramework;
