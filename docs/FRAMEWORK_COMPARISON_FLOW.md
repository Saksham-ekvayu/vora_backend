# Framework Comparison Flow

## Overview

User compares their framework with expert framework using AI processing and gets similarity results.

## Prerequisites

- User framework must be AI processed (has `aiProcessing.uuid`)
- Expert framework must be AI processed (has `aiProcessing.uuid`)
- Valid JWT token for authentication

## API Flow

### 1. Start Framework Comparison

```http
POST /api/users/framework-comparisons
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "userFrameworkId": "framework_id",
  "expertFrameworkId": "expert_framework_id"
}
```

**Response:**

```json
{
  "success": true,
  "message": "Framework comparison started successfully",
  "data": {
    "frameworkComparisonId": "comparison_id",
    "status": "in-process"
  }
}
```

### 2. Check Status

```http
GET /api/users/framework-comparisons/:frameworkComparisonId
Authorization: Bearer <jwt_token>
```

**Response:**

```json
{
  "success": true,
  "data": {
    "frameworkComparisonId": "comparison_id",
    "status": "completed",
    "results": [
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
}
```

### 3. Get History

```http
GET /api/users/framework-comparisons?page=1&limit=10
Authorization: Bearer <jwt_token>
```

## Technical Flow

```
1. User calls POST /api/users/framework-comparisons
2. Backend validates frameworks and UUIDs
3. Creates framework comparison record in database
4. Connects to AI WebSocket: ws://192.168.1.30:8002/user/websocket/comparision
5. AI processes comparison and sends updates
6. Backend updates database with results
7. User polls GET /api/users/framework-comparisons/:id for status
8. Returns final results when completed
```

## Status Values

- `pending` - Framework comparison created, waiting to start
- `in-process` - AI is processing the framework comparison
- `completed` - Framework comparison finished successfully
- `error` - Framework comparison failed

## AI WebSocket URL

```
ws://192.168.1.30:8002/user/websocket/comparision?user_framework_uuid={uuid}&expert_framework_uuid={uuid}
```

## AI Response Format

```json
{"status": "in-process"}
{"status": "completed", "data": [...]}
{"status": "error", "message": "error msg"}
```

## Database Collections

- `framework-comparisons` - Stores framework comparison records and results
- `user-frameworks` - User uploaded frameworks
- `expert-frameworks` - Expert frameworks

## Error Handling

- `400` - Invalid input parameters
- `401` - Authentication failed
- `404` - Framework not found
- `409` - Framework comparison already in progress
- `500` - Internal server error

## Usage Example

```javascript
// Start framework comparison
const response = await fetch("/api/users/framework-comparisons", {
  method: "POST",
  headers: {
    Authorization: "Bearer " + token,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    userFrameworkId: "user_fw_id",
    expertFrameworkId: "expert_fw_id",
  }),
});

const result = await response.json();
const frameworkComparisonId = result.data.frameworkComparisonId;

// Check status periodically
const checkStatus = async () => {
  const statusResponse = await fetch(
    `/api/users/framework-comparisons/${frameworkComparisonId}`,
    {
      headers: { Authorization: "Bearer " + token },
    }
  );
  const statusResult = await statusResponse.json();

  if (statusResult.data.status === "completed") {
    console.log("Results:", statusResult.data.results);
  } else if (statusResult.data.status === "in-process") {
    setTimeout(checkStatus, 5000); // Check again in 5 seconds
  }
};

checkStatus();
```
