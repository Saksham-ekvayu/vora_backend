# Document Management System API

This document management system provides a complete backend solution for handling document uploads, storage, and management with role-based access control.

## Features

- **Role-based Access Control**: Admin, Expert, and User roles with specific permissions
- **File Upload**: Support for PDF, DOC, DOCX, XLS, and XLSX files using Multer
- **Document Management**: Full CRUD operations with soft delete
- **File Validation**: Comprehensive validation using Joi schemas
- **Pagination & Search**: Advanced querying with pagination, sorting, and search
- **File Download**: Secure file download functionality

## Roles & Permissions

| Role | View Documents | Create Documents | Update Documents | Delete Documents |
|------|----------------|------------------|------------------|------------------|
| **User** | ✅ | ❌ | ❌ | ❌ |
| **Expert** | ✅ | ✅ | ✅ | ✅ |
| **Admin** | ✅ | ❌ | ❌ | ❌ |

> **Note**: Only **Expert** role can CREATE, UPDATE, and DELETE documents. All authenticated users can VIEW documents.

## API Endpoints

### Authentication Required
All endpoints require authentication via Bearer token in the Authorization header:
```
Authorization: Bearer <your-jwt-token>
```

### Document Endpoints

#### 1. Upload Document
```http
POST /api/documents
Content-Type: multipart/form-data
```

**Body (Form Data):**
- `document` (file): The document file to upload
- `documentName` (string, optional): Custom name for the document

**Access:** Expert only

**Response:**
```json
{
  "success": true,
  "message": "Document uploaded successfully",
  "data": {
    "document": {
      "_id": "document_id",
      "documentName": "My Document",
      "documentType": "pdf",
      "fileSize": "2.5 MB",
      "originalFileName": "original.pdf",
      "uploadedBy": {
        "_id": "user_id",
        "name": "John Doe",
        "email": "john@example.com",
        "role": "expert"
      },
      "createdAt": "2025-12-31T06:42:00.000Z",
      "updatedAt": "2025-12-31T06:42:00.000Z"
    }
  }
}
```

#### 2. Get All Documents
```http
GET /api/documents?page=1&limit=10&sort=-createdAt&search=report&documentType=pdf
```

**Query Parameters:**
- `page` (number, default: 1): Page number
- `limit` (number, default: 10, max: 100): Items per page
- `sort` (string, default: "-createdAt"): Sort field (prefix with - for descending)
- `search` (string): Search in document name and original filename
- `documentType` (string): Filter by document type (pdf, doc, docx, xls, xlsx)
- `uploadedBy` (string): Filter by uploader user ID

**Access:** All authenticated users

#### 3. Get Document by ID
```http
GET /api/documents/:id
```

**Access:** All authenticated users

#### 4. Get My Documents
```http
GET /api/documents/my-documents?page=1&limit=10
```

**Access:** All authenticated users

#### 5. Download Document
```http
GET /api/documents/:id/download
```

**Access:** All authenticated users

#### 6. Update Document
```http
PUT /api/documents/:id
Content-Type: application/json
```

**Body:**
```json
{
  "documentName": "Updated Document Name",
  "isActive": true
}
```

**Access:** Expert only

#### 7. Delete Document (Soft Delete)
```http
DELETE /api/documents/:id
```

**Access:** Expert only

## File Upload Specifications

### Supported File Types
- **PDF**: `.pdf` (application/pdf)
- **Word Documents**: `.doc` (application/msword), `.docx` (application/vnd.openxmlformats-officedocument.wordprocessingml.document)
- **Excel Files**: `.xls` (application/vnd.ms-excel), `.xlsx` (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)

### File Size Limit
- Maximum file size: **10MB**

### Storage
- Files are stored in `uploads/documents/` directory
- Files are renamed with timestamp and random suffix for uniqueness
- Original filename is preserved in database

## Database Schema

### Document Model
```javascript
{
  documentName: String,        // Display name for the document
  fileUrl: String,            // Path to the uploaded file
  documentType: String,       // File type (pdf, doc, docx, xls, xlsx)
  uploadedBy: ObjectId,       // Reference to User model
  fileSize: Number,           // File size in bytes
  originalFileName: String,   // Original filename from upload
  isActive: Boolean,          // Soft delete flag
  createdAt: Date,           // Auto-generated timestamp
  updatedAt: Date            // Auto-generated timestamp
}
```

## Validation Rules

### Document Creation
- `documentName`: 2-100 characters (optional, defaults to original filename)
- `documentType`: Must be one of: pdf, doc, docx, xls, xlsx
- `fileSize`: Maximum 10MB
- `originalFileName`: Required, max 255 characters
- `fileUrl`: Must be valid URL
- `uploadedBy`: Must be valid MongoDB ObjectId

### Document Update
- `documentName`: 2-100 characters (optional)
- `isActive`: Boolean (optional)
- At least one field must be provided

### Query Parameters
- `page`: Integer, minimum 1
- `limit`: Integer, 1-100
- `sort`: Valid sort fields with optional - prefix
- `search`: 1-100 characters
- `documentType`: Valid document type
- `uploadedBy`: Valid MongoDB ObjectId

## Error Handling

### Common Error Responses

#### 400 Bad Request
```json
{
  "success": false,
  "message": "Validation error message",
  "field": "fieldName",
  "value": "invalidValue"
}
```

#### 401 Unauthorized
```json
{
  "success": false,
  "message": "Unauthorized! You are not logged in. Please login and try again."
}
```

#### 403 Forbidden
```json
{
  "success": false,
  "message": "Access denied! This action requires one of the following roles: expert. Your role: user"
}
```

#### 404 Not Found
```json
{
  "success": false,
  "message": "Document not found"
}
```

#### 500 Internal Server Error
```json
{
  "success": false,
  "message": "Internal server error while creating document"
}
```

## File Structure

```
src/
├── controllers/
│   └── document.controller.js     # Document CRUD operations
├── models/
│   └── document.model.js          # MongoDB schema
├── routes/
│   └── document.routes.js         # API routes with middleware
├── validations/
│   └── document.validation.js     # Joi validation schemas
└── middlewares/
    └── roleAccess.middleware.js   # Role-based access control

uploads/
└── documents/                     # Uploaded files storage
```

## Usage Examples

### Upload a Document (Expert only)
```bash
curl -X POST http://localhost:3000/api/documents \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -F "document=@/path/to/your/file.pdf" \
  -F "documentName=Important Report"
```

### Get All Documents
```bash
curl -X GET "http://localhost:3000/api/documents?page=1&limit=5&search=report" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Download a Document
```bash
curl -X GET http://localhost:3000/api/documents/DOCUMENT_ID/download \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -o downloaded_file.pdf
```

### Update Document (Expert only)
```bash
curl -X PUT http://localhost:3000/api/documents/DOCUMENT_ID \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"documentName": "Updated Document Name"}'
```

### Delete Document (Expert only)
```bash
curl -X DELETE http://localhost:3000/api/documents/DOCUMENT_ID \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

## Security Features

1. **Authentication**: JWT token required for all endpoints
2. **Role-based Authorization**: Granular permissions based on user roles
3. **File Type Validation**: Only allowed file types can be uploaded
4. **File Size Limits**: Prevents large file uploads
5. **Input Validation**: Comprehensive validation using Joi schemas
6. **Soft Delete**: Documents are not permanently deleted, just marked inactive
7. **Path Security**: Files are stored with unique names to prevent conflicts

## Installation & Setup

1. Install dependencies:
```bash
npm install joi multer
```

2. Create uploads directory:
```bash
mkdir -p uploads/documents
```

3. Ensure your `.env` file has required variables:
```env
JWT_SECRET=your_jwt_secret
MONGODB_URI=your_mongodb_connection_string
PORT=3000
```

4. Start the server:
```bash
npm run dev
```

The Document Management API is now ready to use at `http://localhost:3000/api/documents`!