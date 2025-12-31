// Examples of how to use the multer configuration in different controllers

const {
  createDocumentUpload,
  createImageUpload,
  documentUpload,
  getDocumentType,
  deleteFile,
  removeFileExtension,
} = require("./multer.config");

// Example 1: Using default document upload
const upload = documentUpload;

// Example 2: Creating custom document upload with different directory
const customDocumentUpload = createDocumentUpload(
  "src/uploads/custom-documents"
);

// Example 3: Creating image upload
const imageUpload = createImageUpload("src/uploads/profile-images");

// Example 4: Using in a controller
/*
const express = require('express');
const router = express.Router();
const { documentUpload } = require('../config/multer.config');

// Single file upload
router.post('/upload', documentUpload.single('document'), (req, res) => {
  // Handle file upload
});

// Multiple files upload
router.post('/upload-multiple', documentUpload.array('documents', 5), (req, res) => {
  // Handle multiple file uploads
});

// Mixed form data with file
router.post('/upload-form', documentUpload.fields([
  { name: 'document', maxCount: 1 },
  { name: 'images', maxCount: 3 }
]), (req, res) => {
  // Handle mixed form data
});
*/

module.exports = {
  // Export examples for reference
  upload,
  customDocumentUpload,
  imageUpload,
};
