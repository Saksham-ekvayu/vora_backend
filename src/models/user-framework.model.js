const mongoose = require("mongoose");

const frameworkSchema = new mongoose.Schema(
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
    // Comparison Results Storage
    comparisonResults: [
      {
        expertFrameworkId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "ExpertFramework",
          required: true,
        },
        expertFrameworkName: {
          type: String,
          required: true,
          trim: true,
        },
        comparisonData: {
          type: Array,
          default: [],
        },
        comparisonScore: {
          type: Number,
          min: 0,
          max: 1,
          default: 0,
        },
        resultsCount: {
          type: Number,
          default: 0,
        },
        comparedAt: {
          type: Date,
          default: Date.now,
        },
        comparisonId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "FrameworkComparison",
          required: true,
        },
      },
    ],
  },
  {
    timestamps: true, // This adds createdAt and updatedAt automatically
  }
);

// Index for better query performance
frameworkSchema.index({ uploadedBy: 1 });
frameworkSchema.index({ frameworkType: 1 });
frameworkSchema.index({ createdAt: -1 });
frameworkSchema.index({ "aiProcessing.uuid": 1 });
frameworkSchema.index({ "aiProcessing.status": 1 });
frameworkSchema.index({ "comparisonResults.expertFrameworkId": 1 });
frameworkSchema.index({ "comparisonResults.comparedAt": -1 });

const UserFramework = mongoose.model(
  "UserFramework",
  frameworkSchema,
  "user-frameworks" // Custom collection name
);

module.exports = UserFramework;
