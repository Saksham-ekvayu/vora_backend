# Framework Comparison Flow - Real-time WebSocket Implementation

## Overview

User compares their framework with expert framework using AI processing. POST API starts the process immediately, and all updates (including final results) come via WebSocket in real-time - like a chat application.

## Prerequisites

- User framework must be AI processed (has `aiProcessing.uuid`)
- Expert framework must be AI processed (has `aiProcessing.uuid`)
- Valid JWT token for authentication
- WebSocket connection for real-time updates

## Real-time Flow

### 1. Start Framework Comparison (POST API)

```http
POST /api/users/framework-comparisons
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "userFrameworkId": "framework_id",
  "expertFrameworkId": "expert_framework_id"
}
```

**Immediate Response:**

```json
{
  "success": true,
  "message": "Comparison started. Connect to WebSocket for updates.",
  "data": {
    "frameworkComparisonId": "comparison_id",
    "websocketUrl": "/ws/framework-comparisons?token=<jwt_token>"
  }
}
```

### 2. WebSocket Connection (Real-time Updates)

```javascript
// Connect to WebSocket
const ws = new WebSocket(
  "ws://localhost:3000/ws/framework-comparisons?token=<jwt_token>"
);

// Listen for real-time updates
ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  handleComparisonUpdate(message);
};
```

### 3. Real-time WebSocket Messages

**Connection Established:**

```json
{
  "type": "connection",
  "status": "connected"
}
```

**Comparison Started:**

```json
{
  "type": "framework-comparison",
  "frameworkComparisonId": "comparison_id",
  "status": "in-process",
  "message": "Comparison started"
}
```

**Final Results (Real-time):**

```json
{
  "type": "framework-comparison",
  "frameworkComparisonId": "comparison_id",
  "status": "completed",
  "message": "Comparison completed and stored in user framework",
  "data": [
    {
      "User_Document_Control_Name": "Define Security Requirements for Software Development",
      "User_Document_Control_Description": "Ensure that security requirements...",
      "Expert_Framework_Control_Id": "PO.1",
      "Expert_Framework_Control_Name": "Define Security Requirements for Software Development",
      "Expert_Framework_Control_Description": "Ensure that security requirements...",
      "Deployment_Points": "1. Establish a centralized repository...",
      "Comparison_Score": 0.9073
    }
  ],
  "resultsCount": 7,
  "averageScore": 0.8756
}
```

**Error (Real-time):**

```json
{
  "type": "framework-comparison",
  "frameworkComparisonId": "comparison_id",
  "status": "error",
  "message": "Connection error or AI processing failed"
}
```

## Complete Frontend Implementation

```javascript
class FrameworkComparisonClient {
  constructor(token) {
    this.token = token;
    this.ws = null;
  }

  // Connect to WebSocket
  connectWebSocket() {
    const wsUrl = `ws://localhost:3000/ws/framework-comparisons?token=${this.token}`;
    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = () => {
      console.log("✅ WebSocket connected");
    };

    this.ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      this.handleMessage(message);
    };

    this.ws.onclose = () => {
      console.log("🔌 WebSocket disconnected");
    };

    this.ws.onerror = (error) => {
      console.error("❌ WebSocket error:", error);
    };
  }

  // Handle WebSocket messages
  handleMessage(message) {
    switch (message.type) {
      case "connection":
        console.log("Connected to WebSocket");
        break;

      case "framework-comparison":
        this.handleComparisonUpdate(message);
        break;
    }
  }

  // Handle comparison updates
  handleComparisonUpdate(message) {
    const { frameworkComparisonId, status, data, resultsCount, averageScore } =
      message;

    switch (status) {
      case "in-process":
        this.showStatus("Processing...", "loading");
        break;

      case "completed":
        this.showStatus("Completed and stored!", "success");
        this.displayResults(data, resultsCount, averageScore);
        // Optionally refresh user framework data to show updated comparison results
        this.refreshUserFramework();
        break;

      case "error":
        this.showStatus("Error occurred", "error");
        this.showError(message.message);
        break;
    }
  }

  // Start comparison (POST API)
  async startComparison(userFrameworkId, expertFrameworkId) {
    try {
      const response = await fetch("/api/users/framework-comparisons", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userFrameworkId,
          expertFrameworkId,
        }),
      });

      const result = await response.json();

      if (result.success) {
        console.log(
          "✅ Comparison started:",
          result.data.frameworkComparisonId
        );
        // Real-time updates will come via WebSocket
        return result.data.frameworkComparisonId;
      } else {
        throw new Error(result.message);
      }
    } catch (error) {
      console.error("❌ Error starting comparison:", error);
      throw error;
    }
  }

  // Display methods
  showStatus(message, type) {
    console.log(`Status: ${message} (${type})`);
  }

  displayResults(results, count, averageScore) {
    console.log(`Results received: ${count} matches`);
    console.log(`Average comparison score: ${averageScore}`);
    console.log(results);
  }

  showError(message) {
    console.error("Error:", message);
  }

  // Refresh user framework to get updated comparison results
  async refreshUserFramework(frameworkId) {
    try {
      const response = await fetch(`/api/users/frameworks/${frameworkId}`, {
        headers: {
          Authorization: `Bearer ${this.token}`,
        },
      });
      const result = await response.json();
      if (result.success) {
        console.log(
          "Updated framework with comparison results:",
          result.data.framework
        );
        return result.data.framework;
      }
    } catch (error) {
      console.error("Error refreshing framework:", error);
    }
  }
}

// Usage Example
const client = new FrameworkComparisonClient("your_jwt_token");

// 1. Connect to WebSocket first
client.connectWebSocket();

// 2. Start comparison (returns immediately)
client
  .startComparison("user_framework_id", "expert_framework_id")
  .then((comparisonId) => {
    console.log("Comparison started, waiting for real-time updates...");
    // Updates will come via WebSocket automatically
  })
  .catch((error) => {
    console.error("Failed to start comparison:", error);
  });
```

## AI Integration

The backend connects to AI WebSocket at:

```
ws://192.168.1.30:8002/user/websocket/comparision?user_framework_uuid=<uuid>&expert_framework_uuid=<uuid>
```

And forwards all AI responses through your WebSocket in real-time.

## Benefits of This Approach

✅ **Real-time Updates:** Immediate feedback via WebSocket  
✅ **Chat-like Experience:** Similar to messaging applications  
✅ **No Polling:** No need to repeatedly check status  
✅ **Instant Results:** Final results delivered immediately via WebSocket  
✅ **Auto Storage:** Results automatically stored in user framework  
✅ **Multiple Comparisons:** Single framework can be compared with multiple expert frameworks  
✅ **Better UX:** Users see progress in real-time  
✅ **Minimal APIs:** Only one POST endpoint needed

## API Endpoints Summary

- **POST** `/api/users/framework-comparisons` - Start comparison (returns immediately)
- **WebSocket** `/ws/framework-comparisons?token=<jwt>` - Real-time updates
- **GET** `/api/users/frameworks/:id` - Get framework with all comparison results

## WebSocket URLs

**Your Backend:**

```
ws://localhost:3000/ws/framework-comparisons?token=<jwt_token>
```

**AI Service (Internal):**

```
ws://192.168.1.30:8002/user/websocket/comparision?user_framework_uuid=<uuid>&expert_framework_uuid=<uuid>
```

## Database Schema

**Collection:** `framework-comparisons`

```javascript
{
  _id: ObjectId,
  userId: ObjectId,
  userFrameworkId: ObjectId,
  userFrameworkUuid: String, // For AI service
  expertFrameworkId: ObjectId,
  expertFrameworkUuid: String, // For AI service
  aiProcessing: {
    status: String, // "in-process", "completed", "error"
    comparisonResults: Array, // AI response data
    resultsCount: Number,
    errorMessage: String,
    processedAt: Date
  },
  createdAt: Date,
  updatedAt: Date
}
```

**Collection:** `user-frameworks` (Updated with comparison results)

```javascript
{
  _id: ObjectId,
  frameworkName: String,
  fileUrl: String,
  // ... other framework fields
  comparisonResults: [
    {
      expertFrameworkId: ObjectId,
      expertFrameworkName: String,
      comparisonData: Array, // Full AI comparison results
      comparisonScore: Number, // Average score (0-1)
      resultsCount: Number,
      comparedAt: Date,
      comparisonId: ObjectId // Reference to FrameworkComparison
    }
  ]
}
```

## Automatic Storage Feature

When a comparison completes via WebSocket:

1. **Results stored in `framework-comparisons`** - Complete comparison record
2. **Results also stored in `user-frameworks`** - For easy frontend access
3. **Multiple comparisons supported** - Single framework can have multiple comparison results
4. **GET framework API** - Returns framework with all comparison history

### Example: Get Framework with Comparison Results

```http
GET /api/users/frameworks/framework_id
Authorization: Bearer <jwt_token>
```

**Response:**

```json
{
  "success": true,
  "message": "Framework retrieved successfully with 5 extracted controls and 3 comparison results",
  "data": {
    "framework": {
      "id": "framework_id",
      "frameworkName": "My Security Framework",
      "comparisonResults": [
        {
          "expertFrameworkId": "expert_id_1",
          "expertFrameworkName": "NIST Cybersecurity Framework",
          "comparisonScore": 0.8756,
          "resultsCount": 7,
          "comparedAt": "2024-01-05T10:30:00Z",
          "comparisonData": [...] // Full comparison details
        },
        {
          "expertFrameworkId": "expert_id_2",
          "expertFrameworkName": "ISO 27001",
          "comparisonScore": 0.9234,
          "resultsCount": 12,
          "comparedAt": "2024-01-05T11:15:00Z",
          "comparisonData": [...] // Full comparison details
        }
      ],
      "comparisonCount": 2
    }
  }
}
```

Now WebSocket provides real value - immediate responses with real-time updates, just like a chat application!
