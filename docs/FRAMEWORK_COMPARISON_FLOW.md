# Framework Comparison Flow - Real-time WebSocket Implementation

## Overview

User compares their framework with expert framework using AI processing. POST API starts the process immediately, and all updates (including final results) come via WebSocket in real-time.

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
  "message": "Framework comparison started successfully. Connect to WebSocket for real-time updates.",
  "data": {
    "frameworkComparisonId": "comparison_id",
    "status": "in-process",
    "websocketUrl": "/ws/framework-comparisons?token=<your_jwt_token>",
    "userFramework": {
      "id": "framework_id",
      "name": "Framework Name"
    },
    "expertFramework": {
      "id": "expert_id",
      "name": "Expert Framework Name"
    }
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

  switch (message.type) {
    case "connection":
      console.log("Connected to WebSocket");
      break;

    case "framework-comparison":
      handleComparisonUpdate(message);
      break;
  }
};
```

### 3. Real-time WebSocket Messages

**Connection Established:**

```json
{
  "type": "connection",
  "status": "connected",
  "message": "WebSocket connection established",
  "userId": "user_id"
}
```

**Comparison Started:**

```json
{
  "type": "framework-comparison",
  "frameworkComparisonId": "comparison_id",
  "status": "in-process",
  "message": "Framework comparison started successfully"
}
```

**Processing Update:**

```json
{
  "type": "framework-comparison",
  "frameworkComparisonId": "comparison_id",
  "status": "in-process",
  "message": "Framework comparison is being processed by AI"
}
```

**Final Results (Real-time):**

```json
{
  "type": "framework-comparison",
  "frameworkComparisonId": "comparison_id",
  "status": "completed",
  "message": "Framework comparison completed successfully",
  "data": [
    {
      "User_Document_Control_Name": "Control Name",
      "User_Document_Control_Description": "Description...",
      "Expert_Framework_Control_Id": "PO.1",
      "Expert_Framework_Control_Name": "Expert Control",
      "Expert_Framework_Control_Description": "Expert Description...",
      "Deployment_Points": "Implementation points...",
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
  "message": "AI processing failed",
  "error": "Connection timeout"
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
        console.log("Connected:", message.message);
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
    // Update your UI status
    console.log(`Status: ${message} (${type})`);
  }

  displayResults(results, count) {
    // Display comparison results in your UI
    console.log(`Results received: ${count} matches`);
    console.log(results);
  }

  showError(message) {
    // Show error in your UI
    console.error("Error:", message);
  }
}

// Usage
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

## Benefits of This Approach

✅ **Real-time Updates:** Immediate feedback via WebSocket  
✅ **Chat-like Experience:** Similar to messaging applications  
✅ **No Polling:** No need to repeatedly check status  
✅ **Instant Results:** Final results delivered immediately via WebSocket  
✅ **Better UX:** Users see progress in real-time  
✅ **Efficient:** Single POST call + WebSocket connection

## API Endpoints Summary

- **POST** `/api/users/framework-comparisons` - Start comparison (returns immediately)
- **WebSocket** `/ws/framework-comparisons?token=<jwt>` - Real-time updates
- **GET** `/api/users/framework-comparisons/:id` - Optional status check
- **GET** `/api/users/framework-comparisons` - History

## WebSocket URL

```
ws://localhost:3000/ws/framework-comparisons?token=<jwt_token>
```

Now WebSocket provides real value - immediate responses with real-time updates, just like a chat application!
