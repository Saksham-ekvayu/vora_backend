const mongoose = require("mongoose");

const documentSchema = new mongoose.Schema(
  {
    documentName: {
      type: String,
      required: [true, "Document name is required"],
      trim: true,
      minlength: [2, "Document name must be at least 2 characters long"],
      maxlength: [100, "Document name cannot exceed 100 characters"],
    },
    fileUrl: {
      type: String,
      required: [true, "File URL is required"],
      trim: true,
    },
    documentType: {
      type: String,
      required: [true, "Document type is required"],
      enum: {
        values: ["pdf", "doc", "docx", "xls", "xlsx"],
        message: "Document type must be one of: pdf, doc, docx, xls, xlsx",
      },
    },
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Uploaded by user is required"],
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
  },
  {
    timestamps: true, // This adds createdAt and updatedAt automatically
  }
);

// Index for better query performance
documentSchema.index({ uploadedBy: 1 });
documentSchema.index({ documentType: 1 });
documentSchema.index({ createdAt: -1 });

// Virtual for file extension
documentSchema.virtual("fileExtension").get(function () {
  return this.documentType;
});

// Method to get formatted file size
documentSchema.methods.getFormattedFileSize = function () {
  const bytes = this.fileSize;
  if (bytes === 0) return "0 Bytes";

  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
};

// Static method to get documents by type
documentSchema.statics.getByType = function (documentType) {
  return this.find({ documentType }).populate("uploadedBy", "name email role");
};

// Static method to get user documents
documentSchema.statics.getUserDocuments = function (userId) {
  return this.find({ uploadedBy: userId }).populate(
    "uploadedBy",
    "name email role"
  );
};

const UserDocument = mongoose.model(
  "UserDocument",
  documentSchema,
  "user-documents" // Custom collection name
);

module.exports = UserDocument;
