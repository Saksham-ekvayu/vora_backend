const mongoose = require("mongoose");

const frameworkComparisonSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User ID is required"],
    },
    userFrameworkId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "UserFramework",
      required: [true, "User framework ID is required"],
    },
    userFrameworkUuid: {
      type: String,
      required: [true, "User framework UUID is required"],
      trim: true,
    },
    expertFrameworkId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ExpertFramework",
      required: [true, "Expert framework ID is required"],
    },
    expertFrameworkUuid: {
      type: String,
      required: [true, "Expert framework UUID is required"],
      trim: true,
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
          values: ["pending", "in-process", "completed", "error", "done"],
          message:
            "Status must be one of: pending, in-process, completed, error, done",
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
      // Store comparison results
      comparisonResults: [
        {
          User_Document_Control_Name: {
            type: String,
            trim: true,
          },
          User_Document_Control_Description: {
            type: String,
            trim: true,
          },
          Expert_Framework_Control_Id: {
            type: String,
            trim: true,
          },
          Expert_Framework_Control_Name: {
            type: String,
            trim: true,
          },
          Expert_Framework_Control_Description: {
            type: String,
            trim: true,
          },
          Deployment_Points: {
            type: String,
            trim: true,
          },
          Comparison_Score: {
            type: Number,
            min: 0,
            max: 1,
          },
        },
      ],
      resultsCount: {
        type: Number,
        default: 0,
      },
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for better query performance
frameworkComparisonSchema.index({ userId: 1 });
frameworkComparisonSchema.index({ userFrameworkId: 1 });
frameworkComparisonSchema.index({ expertFrameworkId: 1 });
frameworkComparisonSchema.index({ "aiProcessing.uuid": 1 });
frameworkComparisonSchema.index({ "aiProcessing.status": 1 });
frameworkComparisonSchema.index({ createdAt: -1 });

// Compound index for user's comparisons
frameworkComparisonSchema.index({ userId: 1, createdAt: -1 });

const FrameworkComparison = mongoose.model(
  "FrameworkComparison",
  frameworkComparisonSchema,
  "framework-comparisons"
);

module.exports = FrameworkComparison;
