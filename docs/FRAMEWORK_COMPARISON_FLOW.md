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
  "message": "Comparison completed",
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
  "resultsCount": 7
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
    const { frameworkComparisonId, status, data, resultsCount } = message;

    switch (status) {
      case "in-process":
        this.showStatus("Processing...", "loading");
        break;

      case "completed":
        this.showStatus("Completed!", "success");
        this.displayResults(data, resultsCount);
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

  displayResults(results, count) {
    console.log(`Results received: ${count} matches`);
    console.log(results);
  }

  showError(message) {
    console.error("Error:", message);
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
✅ **Better UX:** Users see progress in real-time  
✅ **Minimal APIs:** Only one POST endpoint needed

## API Endpoints Summary

- **POST** `/api/users/framework-comparisons` - Start comparison (returns immediately)
- **WebSocket** `/ws/framework-comparisons?token=<jwt>` - Real-time updates

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

Now WebSocket provides real value - immediate responses with real-time updates, just like a chat application!
