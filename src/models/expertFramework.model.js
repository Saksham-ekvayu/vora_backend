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
    // AI Processing Fields
    aiProcessing: {
      uuid: {
        type: String,
        trim: true,
        default: null,
      },
      status: {
        type: String,
        enum: {
          values: ["pending", "uploaded", "processing", "completed", "failed"],
          message:
            "AI status must be one of: pending, uploaded, processing, completed, failed",
        },
        default: "pending",
      },
      control_extraction_status: {
        type: String,
        enum: {
          values: ["pending", "started", "processing", "completed", "failed"],
          message:
            "Control extraction status must be one of: pending, started, processing, completed, failed",
        },
        default: "pending",
      },
      processedAt: {
        type: Date,
        default: null,
      },
      errorMessage: {
        type: String,
        default: null,
      },
      // Store extracted controls
      extractedControls: [
        {
          Control_id: {
            type: String,
            trim: true,
          },
          Control_name: {
            type: String,
            trim: true,
          },
          Control_type: {
            type: String,
            trim: true,
            default: "",
          },
          Control_description: {
            type: String,
            trim: true,
          },
          Deployment_points: {
            type: String,
            trim: true,
          },
        },
      ],
      controlsCount: {
        type: Number,
        default: 0,
      },
      controlsExtractedAt: {
        type: Date,
        default: null,
      },
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
expertFrameworkSchema.index({ "aiProcessing.uuid": 1 });
expertFrameworkSchema.index({ "aiProcessing.status": 1 });

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

// Method to update AI processing status
expertFrameworkSchema.methods.updateAIStatus = function (aiData) {
  this.aiProcessing.uuid = aiData.uuid || this.aiProcessing.uuid;
  this.aiProcessing.status = aiData.status || this.aiProcessing.status;
  this.aiProcessing.control_extraction_status =
    aiData.control_extraction_status ||
    this.aiProcessing.control_extraction_status;
  this.aiProcessing.processedAt = aiData.processedAt || new Date();
  this.aiProcessing.errorMessage = aiData.errorMessage || null;

  return this.save();
};

// Method to store extracted controls from WebSocket
expertFrameworkSchema.methods.storeExtractedControlsFromWS = function (
  wsMessage
) {
  // Handle different message formats from AI WebSocket
  let controls = [];

  if (wsMessage.controls && Array.isArray(wsMessage.controls)) {
    controls = wsMessage.controls;
  } else if (wsMessage.data && Array.isArray(wsMessage.data)) {
    controls = wsMessage.data;
  }

  this.aiProcessing.extractedControls = controls;
  this.aiProcessing.controlsCount = controls.length;
  this.aiProcessing.controlsExtractedAt = new Date();

  // Update status based on WebSocket message
  if (wsMessage.status) {
    this.aiProcessing.status = wsMessage.status;
    this.aiProcessing.control_extraction_status = wsMessage.status;
  }

  return this.save();
};

const ExpertFramework = mongoose.model(
  "ExpertFramework",
  expertFrameworkSchema
);

module.exports = ExpertFramework;
// Method to store extracted controls (original method - keep for backward compatibility)
expertFrameworkSchema.methods.storeExtractedControls = function (controls) {
  this.aiProcessing.extractedControls = controls || [];
  this.aiProcessing.controlsCount = controls ? controls.length : 0;
  this.aiProcessing.controlsExtractedAt = new Date();
  this.aiProcessing.status = "completed";
  this.aiProcessing.control_extraction_status = "completed";

  return this.save();
};
